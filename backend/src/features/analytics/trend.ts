/**
 * P1 — Server-side trend slope classification (spec §8)
 *
 * Algorithm:
 *  1. Take a time-ordered array of {minuteLabel, avgPm25} points.
 *  2. Fit a simple OLS linear regression (slope in µg/m³ per minute).
 *  3. Compute R² as the confidence of the signal.
 *  4. Classify direction:
 *     - slope > +0.5  → 'worsening'
 *     - slope < -0.5  → 'improving'
 *     - otherwise     → 'stable'
 */

import type { TrendSignal } from '@climence/shared';

export interface TrendPoint {
  /** Integer index (0-based) representing time order. */
  t: number;
  avgPm25: number;
}

const WORSENING_THRESHOLD = 0.5;  // µg/m³ per minute

/**
 * Ordinary Least Squares linear regression on a set of (t, y) pairs.
 * Returns { slope, intercept, r2 }.
 */
export function olsRegression(points: TrendPoint[]): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  if (n === 1) return { slope: 0, intercept: points[0].avgPm25, r2: 1 };

  const sumT = points.reduce((s, p) => s + p.t, 0);
  const sumY = points.reduce((s, p) => s + p.avgPm25, 0);
  const sumTT = points.reduce((s, p) => s + p.t * p.t, 0);
  const sumTY = points.reduce((s, p) => s + p.t * p.avgPm25, 0);

  const denom = n * sumTT - sumT * sumT;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumTY - sumT * sumY) / denom;
  const intercept = (sumY - slope * sumT) / n;

  // R² = 1 - SS_res / SS_tot
  const yMean = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.avgPm25 - yMean) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.avgPm25 - (slope * p.t + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

/**
 * Classify a series of bucketed PM2.5 averages into a TrendSignal.
 *
 * @param series         Time-ordered array of {t, avgPm25}.
 * @param windowMinutes  Total window size (for the returned metadata).
 */
export function classifyTrend(
  series: TrendPoint[],
  windowMinutes: number,
): TrendSignal {
  if (series.length < 2) {
    return { slope: 0, direction: 'stable', confidence: 0, windowMinutes };
  }

  const { slope, r2 } = olsRegression(series);

  const direction: TrendSignal['direction'] =
    slope > WORSENING_THRESHOLD
      ? 'worsening'
      : slope < -WORSENING_THRESHOLD
        ? 'improving'
        : 'stable';

  return {
    slope: parseFloat(slope.toFixed(4)),
    direction,
    confidence: parseFloat(r2.toFixed(4)),
    windowMinutes,
  };
}
