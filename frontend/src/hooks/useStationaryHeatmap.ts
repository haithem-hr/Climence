import { useEffect, useMemo, useState } from 'react';
import { RIYADH_BOUNDS } from '@climence/shared';
import type { HeatmapPoint } from '../components/map/HeatmapLayer';
import { getMapMetricValue, heatIntensityForMetric, type MapMetricKey, type MetricSample } from '../lib/mapMetrics';
import { fetchOpenMeteoHistory, type OpenMeteoHistoryPoint } from '../api/client';

type State =
  | { status: 'idle'; points: HeatmapPoint[] }
  | { status: 'loading'; points: HeatmapPoint[] }
  | { status: 'ready'; points: HeatmapPoint[] }
  | { status: 'error'; points: HeatmapPoint[] };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteOrFallback(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sampleFromOpenMeteo(point: OpenMeteoHistoryPoint): MetricSample {
  const extra = point as Partial<MetricSample>;
  const pm25 = finiteOrFallback(point.pm25, 0);
  const pm10 = finiteOrFallback(point.pm10, pm25 * 1.18);
  const co2 = finiteOrFallback(point.co2, 420 + pm25 * 2);
  const no2 = finiteOrFallback(point.no2, pm25 * 0.45);
  const dust = finiteOrFallback(point.dust, pm10 * 0.4);
  const pollutionRatio = clamp(pm25 / 180, 0, 1);

  return {
    pm25,
    pm10,
    co2,
    no2,
    o3: finiteOrFallback(extra.o3, pm25 * 0.3),
    so2: finiteOrFallback(extra.so2, pm25 * 0.08),
    co: finiteOrFallback(extra.co, pm25 * 0.02),
    dust,
    temperature: finiteOrFallback(extra.temperature, 32 + pollutionRatio * 8),
    humidity: finiteOrFallback(extra.humidity, 45 - pollutionRatio * 25),
    battery: finiteOrFallback(extra.battery, 100),
  };
}

function getMetricValue(points: OpenMeteoHistoryPoint[], metric: MapMetricKey): number {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i];
    if (!point) continue;

    const value = getMapMetricValue(metric, sampleFromOpenMeteo(point));
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

/**
 * Stationary heatmap = a synthetic spatial field over Riyadh derived from the
 * latest Open‑Meteo metric reading (configurable per selected pollutant).
 *
 * Open‑Meteo is a single coordinate time series, so we generate a small grid
 * and apply a smooth radial falloff around the city center.
 */
export function useStationaryHeatmap(
  authToken: string,
  enabled: boolean,
  selectedPollutant: MapMetricKey = 'pm25',
) {
  const [state, setState] = useState<State>({ status: 'idle', points: [] });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    fetchOpenMeteoHistory('1h', authToken)
      .then(history => {
        if (cancelled) return;
        const metricValue = getMetricValue(history, selectedPollutant);

        // Scale into [0.2, 1.0] intensity-ish range using heatIntensityForMetric.
        const intensity = heatIntensityForMetric(selectedPollutant, metricValue);
        const base = clamp(intensity, 0.2, 1.0);

        const centerLat = (RIYADH_BOUNDS.minLat + RIYADH_BOUNDS.maxLat) / 2;
        const centerLng = (RIYADH_BOUNDS.minLng + RIYADH_BOUNDS.maxLng) / 2;

        const rows = 12;
        const cols = 12;
        const latSpan = RIYADH_BOUNDS.maxLat - RIYADH_BOUNDS.minLat;
        const lngSpan = RIYADH_BOUNDS.maxLng - RIYADH_BOUNDS.minLng;

        const next: HeatmapPoint[] = [];
        for (let r = 0; r < rows; r += 1) {
          for (let c = 0; c < cols; c += 1) {
            const lat = RIYADH_BOUNDS.minLat + (r / (rows - 1)) * latSpan;
            const lng = RIYADH_BOUNDS.minLng + (c / (cols - 1)) * lngSpan;

            const dx = (lng - centerLng) / lngSpan;
            const dy = (lat - centerLat) / latSpan;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Radial falloff, keeps intensity highest in the core.
            const cellIntensity = clamp(base * (1 - dist * 1.35), 0.05, 1);
            next.push({ lat, lng, intensity: cellIntensity });
          }
        }

        setState({ status: 'ready', points: next });
      })
      .catch(() => {
        if (cancelled) return;
        setState(prev => ({ status: 'error', points: prev.points }));
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, enabled, selectedPollutant]);

  const points = useMemo(() => state.points, [state.points]);
  return { status: state.status, points };
}
