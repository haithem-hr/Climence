import { aqiBandFor, pm25ToAqi } from '@climence/shared';
import type { ForecastPoint } from '@climence/shared';
import { getCachedForecast } from './openMeteo';

export interface HourlyReading {
  hourIso: string;
  avgPm25: number;
  pm10: number;
  co2: number;
  no2: number;
  dust: number;
}

/**
 * Forecast PM2.5 for the next `horizonHours` hours.
 * Uses the highly accurate 7-day API forecast fetched from Open-Meteo.
 */
export function computeForecast(
  history: HourlyReading[], // Kept for interface compatibility
  horizonHours: number = 6,
  nowOverride?: Date,
): ForecastPoint[] {
  const now = nowOverride ?? new Date();
  const cached = getCachedForecast();
  const out: ForecastPoint[] = [];

  if (cached.length === 0) {
    // Fallback if Open-Meteo hasn't loaded yet
    const flatMean = history.length > 0 ? history.reduce((s, r) => s + r.avgPm25, 0) / history.length : 50;
    return buildFlatForecast(flatMean, horizonHours, now);
  }

  // Find where "now" is in the cached array
  const nowMs = now.getTime();
  let startIndex = 0;
  
  for (let i = 0; i < cached.length; i++) {
    if (new Date(cached[i].hourIso).getTime() > nowMs) {
      startIndex = i;
      break;
    }
  }

  // Slice the requested horizon
  for (let i = 0; i < horizonHours; i++) {
    const idx = startIndex + i;
    if (idx < cached.length) {
      const pm25 = cached[idx].avgPm25;
      const pm10 = cached[idx].pm10;
      const co2 = cached[idx].co2;
      const no2 = cached[idx].no2;
      const dust = cached[idx].dust;
      const aqi = Math.round(pm25ToAqi(pm25));
      out.push({
        hourIso: cached[idx].hourIso,
        aqi,
        pm25,
        pm10,
        co2,
        no2,
        dust,
        band: aqiBandFor(aqi).key,
        confidence: parseFloat(Math.max(0.5, 0.95 - (i * 0.02)).toFixed(2)) // Open-Meteo degrades slightly over time
      });
    } else {
      // If we run out of Open-Meteo data, pad it
      const fallbackTime = new Date(nowMs + (i + 1) * 3600000).toISOString();
      out.push({
        hourIso: fallbackTime,
        aqi: 50,
        pm25: 12,
        pm10: 20,
        co2: 400,
        no2: 20,
        dust: 5,
        band: 'good',
        confidence: 0.5
      });
    }
  }

  return out;
}

function buildFlatForecast(flatMean: number, hours: number, now: Date): ForecastPoint[] {
  const out: ForecastPoint[] = [];
  const aqi = Math.round(pm25ToAqi(flatMean));
  const band = aqiBandFor(aqi).key;

  for (let i = 1; i <= hours; i++) {
    const t = new Date(now.getTime() + i * 3600000);
    out.push({
      hourIso: t.toISOString(),
      aqi,
      pm25: flatMean,
      pm10: flatMean * 1.2,
      co2: 400,
      no2: 20,
      dust: 5,
      band,
      confidence: 0.5,
    });
  }
  return out;
}
