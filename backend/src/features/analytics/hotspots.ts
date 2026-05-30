/**
 * P0 — Hotspot detection (spec §8)
 *
 * Algorithm: DBSCAN-lite
 *  1. Filter candidate points where any pollutant exceeds its threshold.
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
  pm10?: number | null;
  no2?: number | null;
  o3?: number | null;
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
const WHO_THRESHOLDS = {
  pm25: 15,
  pm10: 45,
  no2: 25,
  o3: 100,
} as const;

function finiteOrZero(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function pollutantRatio(point: RawPoint) {
  return {
    pm25: finiteOrZero(point.pm25) / WHO_THRESHOLDS.pm25,
    pm10: finiteOrZero(point.pm10) / WHO_THRESHOLDS.pm10,
    no2: finiteOrZero(point.no2) / WHO_THRESHOLDS.no2,
    o3: finiteOrZero(point.o3) / WHO_THRESHOLDS.o3,
  };
}

function dominantPollutant(members: RawPoint[]) {
  const averages = {
    pm25: members.reduce((sum, point) => sum + finiteOrZero(point.pm25), 0) / members.length,
    pm10: members.reduce((sum, point) => sum + finiteOrZero(point.pm10), 0) / members.length,
    no2: members.reduce((sum, point) => sum + finiteOrZero(point.no2), 0) / members.length,
    o3: members.reduce((sum, point) => sum + finiteOrZero(point.o3), 0) / members.length,
  };

  const ratios = {
    pm25: averages.pm25 / WHO_THRESHOLDS.pm25,
    pm10: averages.pm10 / WHO_THRESHOLDS.pm10,
    no2: averages.no2 / WHO_THRESHOLDS.no2,
    o3: averages.o3 / WHO_THRESHOLDS.o3,
  };
  const key = (Object.keys(ratios) as Array<keyof typeof ratios>).sort((a, b) => ratios[b] - ratios[a])[0];
  const labels = { pm25: 'PM2.5', pm10: 'PM10', no2: 'NO2', o3: 'O3' } as const;
  return labels[key];
}

function severityFromAqi(avgAqi: number): HotspotCluster['severity'] {
  if (avgAqi >= 200) return 'critical';
  if (avgAqi >= 150) return 'high';
  if (avgAqi >= 100) return 'medium';
  return 'low';
}

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
  // 1. Filter candidates. Keep legacy PM2.5 threshold while allowing other
  // pollutants to seed hotspots via WHO-relative exceedance.
  const candidates = points.filter(p => {
    const ratios = pollutantRatio(p);
    return p.pm25 >= pm25Min || ratios.pm10 >= 1 || ratios.no2 >= 1 || ratios.o3 >= 1;
  });
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
    const avgPm25 = members.reduce((sum, p) => sum + p.pm25, 0) / members.length;
    const avgAqi = Math.max(0, Math.min(500, (avgPm25 / 250) * 300));
    const maxRatio = Math.max(...members.flatMap(p => Object.values(pollutantRatio(p))));
    const score = Math.min(Math.max(peakPm25 / 500, maxRatio / 8), 1);

    clusters.push({
      centroidLat,
      centroidLng,
      radiusKm,
      peakPm25,
      dominantPollutant: dominantPollutant(members),
      severity: severityFromAqi(avgAqi),
      memberUuids: members.map(p => p.uuid),
      score,
    });
  }

  // Sort by descending severity
  return clusters.sort((a, b) => b.score - a.score);
}
