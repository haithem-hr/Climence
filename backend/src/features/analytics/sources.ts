/**
 * P4 — Source attribution (FR-12)
 *
 * Rule-based attribution engine. Exposes a clean interface
 * (`IAttributionInput`) so a future ML model can replace the rules.
 *
 * Rules:
 *  TRAFFIC  — NO2 dominance (high avg_no2) + weekday rush hour (7–9, 17–19 UTC)
 *  INDUSTRY — Sustained high PM2.5 AND spatial clustering near industrial coords
 *  DUST     — Spatial PM2.5 uniformity (low std-dev) + low humidity
 *  OTHER    — Residual
 */

import type { SourceAttribution } from '@climence/shared';
import { ENVIRONMENT_MAP } from '@climence/shared';
import { haversineKm } from './hotspots.js';

export interface AttributionReading {
  lat: number;
  lng: number;
  pm25: number;
  no2: number;
  humidity: number;
  /** ISO datetime string */
  timestamp: string;
}

// Industrial zone centroid from ENVIRONMENT_MAP (index 0 = highest peakPm25)
const INDUSTRIAL_ZONE = ENVIRONMENT_MAP.reduce((max, h) =>
  h.peakPm25 > max.peakPm25 ? h : max,
);
const INDUSTRIAL_RADIUS_KM = 3;

const RUSH_HOURS_UTC = new Set([7, 8, 17, 18]);
const WEEKDAYS = new Set([1, 2, 3, 4, 5]); // Mon-Fri

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
}

/**
 * Attribute pollution sources from a set of recent telemetry readings.
 *
 * @param readings  Array of recent readings (e.g. last 24h).
 */
export function attributeSources(readings: AttributionReading[]): SourceAttribution[] {
  if (readings.length === 0) {
    return defaultAttribution();
  }

  const pm25Values = readings.map(r => r.pm25);
  const no2Values  = readings.map(r => r.no2);
  const humValues  = readings.map(r => r.humidity);

  const avgPm25 = pm25Values.reduce((s, v) => s + v, 0) / pm25Values.length;
  const avgNo2  = no2Values.reduce((s, v) => s + v, 0) / no2Values.length;
  const avgHum  = humValues.reduce((s, v) => s + v, 0) / humValues.length;
  const pm25Std = stdDev(pm25Values);

  // --- TRAFFIC signal ---
  const rushHourReadings = readings.filter(r => {
    const d = new Date(r.timestamp);
    return WEEKDAYS.has(d.getUTCDay()) && RUSH_HOURS_UTC.has(d.getUTCHours());
  });
  const rushHourFraction = rushHourReadings.length / readings.length;
  // Weight: NO2 dominance (>40 ppb is significant) × rush-hour fraction
  const no2Score = Math.min(avgNo2 / 100, 1); // normalise to 0-1 (100 ppb = max)
  const trafficRaw = no2Score * 0.6 + rushHourFraction * 0.4;

  // --- INDUSTRY signal ---
  const nearIndustrial = readings.filter(r =>
    haversineKm(r.lat, r.lng, INDUSTRIAL_ZONE.lat, INDUSTRIAL_ZONE.lng) <= INDUSTRIAL_RADIUS_KM,
  );
  const industrialFraction = nearIndustrial.length / readings.length;
  const industrialPm25 = nearIndustrial.length > 0
    ? nearIndustrial.reduce((s, r) => s + r.pm25, 0) / nearIndustrial.length
    : 0;
  const industryRaw = Math.min(industrialPm25 / 200, 1) * 0.5 + industrialFraction * 0.5;

  // --- DUST signal ---
  // Low std-dev (uniform spread) + low humidity → wind-blown dust
  const uniformity = Math.max(0, 1 - pm25Std / (avgPm25 + 1));
  const dryness    = Math.max(0, 1 - avgHum / 100);
  const dustRaw    = uniformity * 0.5 + dryness * 0.5;

  // --- Normalise to 100% ---
  const total = trafficRaw + industryRaw + dustRaw + 0.1; // 0.1 = min "other" weight
  const scale = 100 / total;

  const trafficPct  = parseFloat((trafficRaw  * scale).toFixed(1));
  const industryPct = parseFloat((industryRaw * scale).toFixed(1));
  const dustPct     = parseFloat((dustRaw     * scale).toFixed(1));
  const otherPct    = parseFloat(Math.max(0, 100 - trafficPct - industryPct - dustPct).toFixed(1));

  // --- Confidence ---
  const trafficConf  = parseFloat(Math.min(no2Score + rushHourFraction, 1).toFixed(2));
  const industryConf = parseFloat(Math.min(industrialFraction * 2, 1).toFixed(2));
  const dustConf     = parseFloat((uniformity * dryness).toFixed(2));

  return [
    {
      key: 'traffic',
      name: 'Road Traffic',
      pct: trafficPct,
      confidence: trafficConf,
      drivers: [
        `avg NO₂ ${avgNo2.toFixed(1)} ppb`,
        `${(rushHourFraction * 100).toFixed(0)}% rush-hour readings`,
      ],
    },
    {
      key: 'industry',
      name: 'Industrial Emissions',
      pct: industryPct,
      confidence: industryConf,
      drivers: [
        `${(industrialFraction * 100).toFixed(0)}% readings near industrial zone`,
        `avg PM₂.₅ near zone: ${industrialPm25.toFixed(1)} µg/m³`,
      ],
    },
    {
      key: 'dust',
      name: 'Dust / Sand',
      pct: dustPct,
      confidence: dustConf,
      drivers: [
        `PM₂.₅ std-dev ${pm25Std.toFixed(1)} (uniform spread)`,
        `avg humidity ${avgHum.toFixed(0)}%`,
      ],
    },
    {
      key: 'other',
      name: 'Other Sources',
      pct: otherPct,
      confidence: 0.5,
      drivers: ['Residual unattributed contribution'],
    },
  ].sort((a, b) => b.pct - a.pct);
}

/** Returned when there are no readings to analyze. */
function defaultAttribution(): SourceAttribution[] {
  return [
    { key: 'other', name: 'Other Sources', pct: 100, confidence: 0, drivers: ['No data'] },
  ];
}
