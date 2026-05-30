import type { RiyadhMapSensor } from '../components/map/RiyadhGoogleMap';

export type LiveMapStatusFilter = 'all' | 'online' | 'offline';

export interface LiveMapFilterState {
  status: LiveMapStatusFilter;
  minPm25?: number;
  lowBatteryOnly?: boolean;
  batteryThreshold?: number;
}

export interface ReplayFrame {
  emittedAt: string;
  sensors: RiyadhMapSensor[];
}

export interface LiveMapCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  radiusMeters: number;
  avgPm25: number;
  maxPm25: number;
  minBattery: number;
  memberUuids: string[];
}

export interface SavedViewPreset {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  createdAt: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function filterLiveMapSensors(
  sensors: RiyadhMapSensor[],
  filter: LiveMapFilterState,
): RiyadhMapSensor[] {
  return sensors.filter(sensor => {
    if (filter.status === 'online' && sensor.status === 'offline') return false;
    if (filter.status === 'offline' && sensor.status !== 'offline') return false;

    if (typeof filter.minPm25 === 'number' && sensor.pm25 < filter.minPm25) return false;

    if (filter.lowBatteryOnly) {
      const threshold = typeof filter.batteryThreshold === 'number' ? filter.batteryThreshold : 35;
      if (sensor.battery > threshold) return false;
    }

    return true;
  });
}

export function nextReplayHistory(
  current: ReplayFrame[],
  nextFrame: ReplayFrame,
  maxFrames = 180,
): ReplayFrame[] {
  if (!nextFrame.emittedAt) return current;

  if (current.length > 0 && current[current.length - 1]?.emittedAt === nextFrame.emittedAt) {
    return current;
  }

  const appended = [...current, nextFrame];
  if (appended.length <= maxFrames) return appended;
  return appended.slice(appended.length - maxFrames);
}

export function clusterLiveMapSensors(
  sensors: RiyadhMapSensor[],
  options?: { zoom?: number; minClusterSize?: number },
): LiveMapCluster[] {
  if (sensors.length === 0) return [];

  const zoom = clamp(options?.zoom ?? 11, 8, 18);
  const minClusterSize = Math.max(2, options?.minClusterSize ?? 2);
  const cellSizeDeg = Math.max(0.004, 0.1 / zoom);
  const metersPerCell = Math.max(350, 2200 / zoom);

  const buckets = new Map<string, RiyadhMapSensor[]>();

  for (const sensor of sensors) {
    const latKey = Math.floor(sensor.lat / cellSizeDeg);
    const lngKey = Math.floor(sensor.lng / cellSizeDeg);
    const key = `${latKey}:${lngKey}`;
    const existing = buckets.get(key);
    if (existing) existing.push(sensor);
    else buckets.set(key, [sensor]);
  }

  return [...buckets.entries()]
    .map(([key, members]) => {
      if (members.length < minClusterSize) return null;
      const lat = average(members.map(member => member.lat));
      const lng = average(members.map(member => member.lng));
      const avgPm25 = average(members.map(member => member.pm25));
      const maxPm25 = Math.max(...members.map(member => member.pm25));
      const minBattery = Math.min(...members.map(member => member.battery));
      return {
        id: `cluster-${key}`,
        lat,
        lng,
        count: members.length,
        radiusMeters: metersPerCell * (1 + members.length / 8),
        avgPm25,
        maxPm25,
        minBattery,
        memberUuids: members.map(member => member.uuid),
      } satisfies LiveMapCluster;
    })
    .filter((cluster): cluster is LiveMapCluster => Boolean(cluster))
    .sort((left, right) => right.count - left.count);
}

export function serializeSavedViewPresets(presets: SavedViewPreset[]) {
  return JSON.stringify(presets);
}

export function parseSavedViewPresets(raw: string | null): SavedViewPreset[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(item => typeof item === 'object' && item !== null)
      .map(item => item as Partial<SavedViewPreset>)
      .filter(
        item =>
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.lat === 'number' &&
          typeof item.lng === 'number' &&
          typeof item.zoom === 'number' &&
          typeof item.createdAt === 'string',
      )
      .map(item => ({
        id: item.id as string,
        name: item.name as string,
        lat: item.lat as number,
        lng: item.lng as number,
        zoom: item.zoom as number,
        createdAt: item.createdAt as string,
      }));
  } catch {
    return [];
  }
}
