import { useEffect, useMemo, useState } from 'react';
import { RIYADH_BOUNDS } from '@climence/shared';
import type { HeatmapPoint } from '../components/map/HeatmapLayer';
import { fetchOpenMeteoHistory } from '../api/client';

type State =
  | { status: 'idle'; points: HeatmapPoint[] }
  | { status: 'loading'; points: HeatmapPoint[] }
  | { status: 'ready'; points: HeatmapPoint[] }
  | { status: 'error'; points: HeatmapPoint[] };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function latestPm25(points: Array<{ pm25: number }>) {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const v = points[i]?.pm25;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return 0;
}

/**
 * Stationary heatmap = a synthetic spatial field over Riyadh derived from the
 * latest Open‑Meteo PM2.5 reading.
 *
 * Open‑Meteo is a single coordinate time series, so we generate a small grid
 * and apply a smooth radial falloff around the city center.
 */
export function useStationaryHeatmap(authToken: string, enabled: boolean) {
  const [state, setState] = useState<State>({ status: 'idle', points: [] });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    fetchOpenMeteoHistory('1h', authToken)
      .then(history => {
        if (cancelled) return;
        const pm25 = latestPm25(history);

        // Scale into [0.2, 1.0] intensity-ish range using a conservative envelope.
        const base = clamp(pm25 / 180, 0.2, 1.0);

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
            const intensity = clamp(base * (1 - dist * 1.35), 0.05, 1);
            next.push({ lat, lng, intensity });
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
  }, [authToken, enabled]);

  const points = useMemo(() => state.points, [state.points]);
  return { status: state.status, points };
}
