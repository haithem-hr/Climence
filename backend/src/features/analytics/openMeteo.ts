import { RIYADH_CENTER } from '@climence/shared';
import type { HourlyReading } from './forecast';
import { logger } from '../../lib/logger';

let cachedData: HourlyReading[] = []; // Past + future
let pollingInterval: NodeJS.Timeout | null = null;

export async function fetchOpenMeteoForecast() {
  try {
    // past_days=92 gives ~3 months of history + 7 days forward
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
      `?latitude=${RIYADH_CENTER.lat}&longitude=${RIYADH_CENTER.lng}` +
      `&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,dust` +
      `&timezone=UTC&past_days=92&forecast_days=7`;

    const res  = await fetch(url);
    const data = await res.json();

    if (data.hourly?.time && data.hourly?.pm2_5) {
      const newCache: HourlyReading[] = [];
      for (let i = 0; i < data.hourly.time.length; i++) {
        const pm25 = data.hourly.pm2_5[i];
        if (pm25 === null || pm25 === undefined) continue;
        newCache.push({
          hourIso:  new Date(data.hourly.time[i] + 'Z').toISOString(),
          avgPm25:  pm25,
          pm10:     data.hourly.pm10[i]              ?? pm25 * 1.2,
          co2:      (data.hourly.carbon_monoxide[i]  ?? 300) * 1.5,
          no2:      data.hourly.nitrogen_dioxide[i]  ?? 0,
          dust:     data.hourly.dust[i]              ?? pm25 * 0.4,
        });
      }
      cachedData = newCache;
      logger.info('[open-meteo] cache refreshed', { hours: newCache.length });
    }
  } catch (err) {
    logger.error('[open-meteo] fetch failed', { err: String(err) });
  }
}

export function startOpenMeteoPolling() {
  fetchOpenMeteoForecast();
  // Refresh every 60 minutes
  pollingInterval = setInterval(fetchOpenMeteoForecast, 60 * 60 * 1000);
}

/** Return only future (forecast) hourly readings. */
export function getCachedForecast(): HourlyReading[] {
  const nowMs = Date.now();
  return cachedData.filter(r => new Date(r.hourIso).getTime() > nowMs);
}

/**
 * Return a slice of history (past data only) for the analytics chart.
 * @param windowMs  How many milliseconds back from now to include.
 */
export function getHistoricalSlice(windowMs: number): HourlyReading[] {
  const nowMs  = Date.now();
  const fromMs = nowMs - windowMs;
  // Include up to the current hour (not future)
  return cachedData.filter(r => {
    const t = new Date(r.hourIso).getTime();
    return t >= fromMs && t <= nowMs + 3_600_000; // +1h so the current hour shows
  });
}
