import { RIYADH_CENTER } from '@climence/shared';
import type { HourlyReading } from './forecast';

let cachedForecast: HourlyReading[] = [];
let pollingInterval: NodeJS.Timeout | null = null;

export async function fetchOpenMeteoForecast() {
  try {
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${RIYADH_CENTER.lat}&longitude=${RIYADH_CENTER.lng}&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,dust&timezone=UTC`);
    const data = await res.json();

    if (data.hourly && data.hourly.time && data.hourly.pm2_5) {
      const newCache: HourlyReading[] = [];
      for (let i = 0; i < data.hourly.time.length; i++) {
        const timeStr = data.hourly.time[i] + 'Z';
        const pm25 = data.hourly.pm2_5[i];
        if (pm25 !== null && pm25 !== undefined) {
          newCache.push({
            hourIso: new Date(timeStr).toISOString(),
            avgPm25: pm25,
            pm10: data.hourly.pm10[i] ?? 0,
            co2: (data.hourly.carbon_monoxide[i] ?? 300) * 1.5, // Deriving CO2 from CO like in simulator
            no2: data.hourly.nitrogen_dioxide[i] ?? 0,
            dust: data.hourly.dust[i] ?? 0
          });
        }
      }
      cachedForecast = newCache;
      console.log(`[Open-Meteo] Successfully fetched and cached ${newCache.length} hours of multi-pollutant forecast.`);
    }
  } catch (err) {
    console.error('[Open-Meteo] Failed to fetch forecast:', err);
  }
}

export function startOpenMeteoPolling() {
  // Fetch immediately on boot
  fetchOpenMeteoForecast();
  // Then every 60 minutes
  pollingInterval = setInterval(fetchOpenMeteoForecast, 60 * 60 * 1000);
}

export function getCachedForecast(): HourlyReading[] {
  return cachedForecast;
}
