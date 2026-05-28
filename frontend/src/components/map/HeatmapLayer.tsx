import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import type { TelemetryRecord } from '@climence/shared';

interface HeatLayerApi {
  heatLayer: (points: [number, number, number][], opts: unknown) => L.Layer;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function HeatmapLayer({
  drones,
  points,
  radius = 70,
  blur = 60,
  max = 1,
  gradient = { 0.2: '#10b981', 0.5: '#f59e0b', 1.0: '#ef4444' },
}: {
  drones?: TelemetryRecord[];
  points?: HeatmapPoint[];
  radius?: number;
  blur?: number;
  max?: number;
  gradient?: Record<number, string>;
}) {
  const map = useMap();

  useEffect(() => {
    const size = map.getSize();
    if (size.x <= 0 || size.y <= 0) return;

    const heatPoints = points ?? drones?.map(d => ({ lat: d.lat, lng: d.lng, intensity: d.pm25 })) ?? [];
    const heatData: [number, number, number][] = heatPoints
      .filter(point => isFiniteNumber(point.lat) && isFiniteNumber(point.lng) && isFiniteNumber(point.intensity))
      .map(point => [point.lat, point.lng, clamp(point.intensity, 0.05, max)]);

    if (heatData.length === 0) return;

    const api = L as unknown as HeatLayerApi;
    if (!api.heatLayer) return;

    const heatLayer = api
      .heatLayer(heatData, {
        radius,
        blur,
        max,
        maxZoom: 13,
        gradient,
      })
      .addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [blur, drones, gradient, map, max, points, radius]);

  return null;
}
