import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
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
    const heatPoints = points ?? drones?.map(d => ({ lat: d.lat, lng: d.lng, intensity: d.pm25 })) ?? [];
    if (heatPoints.length === 0) return;
    const heatData: [number, number, number][] = heatPoints.map(point => [point.lat, point.lng, point.intensity]);
    const heatLayer = (L as unknown as HeatLayerApi)
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
