/**
 * P0 — Hotspot detection (spec §8)
 *
 * Algorithm: DBSCAN-lite
 *  1. Filter candidate points where pm25 > threshold.
 *  2. Cluster by haversine proximity (~1 km epsilon).
 *  3. Compute weighted centroid (weights = pm25 values).
 *  4. Estimate radius = max haversine distance from centroid to any member.
 *  5. Score = peakPm25 / 500 clamped to [0,1].
 */

import type { HotspotCluster } from '@climence/shared';

export interface RawPoint {
  uuid: string;
  lat: number;
  lng: number;
  pm25: number;
}

/** Haversine distance in kilometres between two lat/lng points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const EPSILON_KM = 1.0; // neighbourhood radius
const MIN_POINTS = 1;   // minimum cluster size (1 = any point is a valid seed)

/**
 * Detect pollution hotspot clusters from raw telemetry points.
 *
 * @param points   Raw readings (already filtered for time window by the query layer).
 * @param pm25Min  Minimum pm25 to be considered a candidate point.
 */
export function detectHotspots(
  points: RawPoint[],
  pm25Min: number,
): HotspotCluster[] {
  // 1. Filter candidates
  const candidates = points.filter(p => p.pm25 >= pm25Min);
  if (candidates.length === 0) return [];

  // 2. DBSCAN-lite clustering
  const visited = new Set<number>();
  const clusterOf = new Array<number>(candidates.length).fill(-1);
  let clusterId = 0;

  function neighbourhood(idx: number): number[] {
    return candidates.reduce<number[]>((acc, _, j) => {
      if (
        haversineKm(
          candidates[idx].lat,
          candidates[idx].lng,
          candidates[j].lat,
          candidates[j].lng,
        ) <= EPSILON_KM
      )
        acc.push(j);
      return acc;
    }, []);
  }

  for (let i = 0; i < candidates.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const neighbours = neighbourhood(i);
    if (neighbours.length < MIN_POINTS) {
      clusterOf[i] = -1; // noise — will still form its own cluster below
      continue;
    }

    const queue = [...neighbours];
    clusterOf[i] = clusterId;

    while (queue.length > 0) {
      const q = queue.shift()!;
      if (!visited.has(q)) {
        visited.add(q);
        const qNeighbours = neighbourhood(q);
        if (qNeighbours.length >= MIN_POINTS) {
          queue.push(...qNeighbours.filter(n => !visited.has(n)));
        }
      }
      if (clusterOf[q] === -1) clusterOf[q] = clusterId;
    }

    clusterId++;
  }

  // Assign noise points as singleton clusters
  for (let i = 0; i < candidates.length; i++) {
    if (clusterOf[i] === -1) {
      clusterOf[i] = clusterId++;
    }
  }

  // 3. Build cluster objects
  const clusterMap = new Map<number, RawPoint[]>();
  candidates.forEach((p, i) => {
    const cid = clusterOf[i];
    if (!clusterMap.has(cid)) clusterMap.set(cid, []);
    clusterMap.get(cid)!.push(p);
  });

  const clusters: HotspotCluster[] = [];

  for (const members of clusterMap.values()) {
    // Weighted centroid
    const totalWeight = members.reduce((s, p) => s + p.pm25, 0);
    const centroidLat = members.reduce((s, p) => s + p.lat * p.pm25, 0) / totalWeight;
    const centroidLng = members.reduce((s, p) => s + p.lng * p.pm25, 0) / totalWeight;

    // Radius = max distance from centroid to any member
    const radiusKm = members.reduce((max, p) => {
      const d = haversineKm(centroidLat, centroidLng, p.lat, p.lng);
      return d > max ? d : max;
    }, 0);

    const peakPm25 = Math.max(...members.map(p => p.pm25));
    const score = Math.min(peakPm25 / 500, 1);

    clusters.push({
      centroidLat,
      centroidLng,
      radiusKm,
      peakPm25,
      memberUuids: members.map(p => p.uuid),
      score,
    });
  }

  // Sort by descending severity
  return clusters.sort((a, b) => b.score - a.score);
}
