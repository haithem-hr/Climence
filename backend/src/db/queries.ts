import {
  PM25_ALERT_THRESHOLD,
  type AlertThresholdConfig,
  type CityTrendPoint,
  type Hotspot,
  type TelemetryInput,
  type TelemetryRecord,
  type TelemetrySnapshot,
} from '@climence/shared';
import db from './client';
import { detectHotspots, type RawPoint } from '../features/analytics/hotspots.js';
import { classifyTrend, type TrendPoint } from '../features/analytics/trend.js';
import { computeForecast, type HourlyReading } from '../features/analytics/forecast.js';
import { attributeSources, type AttributionReading } from '../features/analytics/sources.js';

// ---------------------------------------------------------------------------
// Existing queries
// ---------------------------------------------------------------------------

const insertStmt = db.prepare(`
  INSERT INTO TelemetryLogs (
    uuid, state, batteryLevel, lat, lng,
    pm25, co2, no2, temperature, humidity, rssi, client_timestamp
  ) VALUES (
    @uuid, @state, @batteryLevel, @lat, @lng,
    @pm25, @co2, @no2, @temperature, @humidity, @rssi, @client_timestamp
  )
`);

export const insertFleet = db.transaction((drones: TelemetryInput[]) => {
  for (const drone of drones) {
    insertStmt.run({
      uuid: drone.uuid,
      state: drone.state,
      batteryLevel: drone.batteryLevel,
      lat: drone.location.lat,
      lng: drone.location.lng,
      pm25: drone.airQuality.pm25,
      co2: drone.airQuality.co2,
      no2: drone.airQuality.no2,
      temperature: drone.airQuality.temperature,
      humidity: drone.airQuality.humidity,
      rssi: drone.rssi,
      client_timestamp: drone.timestamp,
    });
  }
});

const latestStmt = db.prepare(`
  SELECT * FROM TelemetryLogs
  WHERE id IN (
    SELECT MAX(id) FROM TelemetryLogs
    WHERE server_timestamp >= datetime('now', '-5 minutes')
    GROUP BY uuid
  )
`);

export const getLatest = (): TelemetryRecord[] => latestStmt.all() as TelemetryRecord[];

const historyStmt = db.prepare(`
  SELECT * FROM (
    SELECT * FROM TelemetryLogs
    WHERE uuid = ?
    ORDER BY server_timestamp DESC
    LIMIT 60
  ) ordered_desc
  ORDER BY server_timestamp ASC
`);

export const getHistory = (droneId: string): TelemetryRecord[] =>
  historyStmt.all(droneId) as TelemetryRecord[];

const cityTrendStmt = db.prepare(`
  SELECT
    strftime('%H:%M', server_timestamp) as minute_label,
    AVG(pm25) as avg_pm25,
    AVG(co2) as avg_co2
  FROM TelemetryLogs
  WHERE server_timestamp >= datetime('now', '-30 minutes')
  GROUP BY strftime('%Y-%m-%d %H:%M', server_timestamp)
  ORDER BY server_timestamp ASC
`);

export const getCityTrend = (): CityTrendPoint[] => cityTrendStmt.all() as CityTrendPoint[];

const hotspotsStmt = db.prepare(`
  SELECT
    ROUND(lat, 2) as lat_zone,
    ROUND(lng, 2) as lng_zone,
    AVG(pm25) as avg_pm25
  FROM TelemetryLogs
  WHERE server_timestamp >= datetime('now', '-5 minutes')
  GROUP BY ROUND(lat, 2), ROUND(lng, 2)
  ORDER BY avg_pm25 DESC
  LIMIT 3
`);

export const getHotspots = (): Hotspot[] => hotspotsStmt.all() as Hotspot[];

const activeAlertsStmt = db.prepare(`
  SELECT * FROM TelemetryLogs
  WHERE id IN (
    SELECT MAX(id) FROM TelemetryLogs
    WHERE server_timestamp >= datetime('now', '-5 minutes')
    GROUP BY uuid
  )
  AND pm25 > ?
`);

export const getActiveAlerts = (pm25Threshold: number): TelemetryRecord[] =>
  activeAlertsStmt.all(pm25Threshold) as TelemetryRecord[];

const ensureAlertConfigStmt = db.prepare(`
  INSERT OR IGNORE INTO AlertConfig (id, pm25_threshold)
  VALUES (1, ?)
`);

const alertConfigStmt = db.prepare(`
  SELECT pm25_threshold, updated_at
  FROM AlertConfig
  WHERE id = 1
`);

const updateAlertConfigStmt = db.prepare(`
  UPDATE AlertConfig
  SET pm25_threshold = @pm25_threshold,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = 1
`);

export function getAlertThresholdConfig(): AlertThresholdConfig {
  ensureAlertConfigStmt.run(PM25_ALERT_THRESHOLD);
  return alertConfigStmt.get() as AlertThresholdConfig;
}

export function getAlertThresholdPm25(): number {
  return getAlertThresholdConfig().pm25_threshold;
}

export function setAlertThresholdPm25(pm25Threshold: number): AlertThresholdConfig {
  ensureAlertConfigStmt.run(PM25_ALERT_THRESHOLD);
  updateAlertConfigStmt.run({ pm25_threshold: pm25Threshold });
  return getAlertThresholdConfig();
}

// ---------------------------------------------------------------------------
// P0 — Raw points for hotspot clustering
// ---------------------------------------------------------------------------

interface RawRow {
  uuid: string;
  lat: number;
  lng: number;
  pm25: number;
}

const rawPointsStmt = db.prepare(`
  SELECT uuid, lat, lng, pm25
  FROM TelemetryLogs
  WHERE server_timestamp >= datetime('now', ? || ' minutes')
`);

/**
 * Return raw {uuid, lat, lng, pm25} for the DBSCAN cluster algorithm.
 * @param windowMinutes  Look-back window in minutes (negative, e.g. -5).
 */
export function getRawPointsForHotspot(windowMinutes: number = -5): RawPoint[] {
  return rawPointsStmt.all(`-${Math.abs(windowMinutes)}`) as RawRow[];
}

// ---------------------------------------------------------------------------
// P1 — Bucketed time series for trend classification
// ---------------------------------------------------------------------------

const historicalAvgStmt = db.prepare(`
  SELECT
    strftime('%Y-%m-%dT%H:%M:00Z', server_timestamp) as minute_iso,
    AVG(pm25) as avg_pm25
  FROM TelemetryLogs
  WHERE server_timestamp >= datetime('now', ? || ' minutes')
  GROUP BY strftime('%Y-%m-%d %H:%M', server_timestamp)
  ORDER BY server_timestamp ASC
`);

interface HistAvgRow {
  minute_iso: string;
  avg_pm25: number;
}

/**
 * Return 1-minute bucketed PM2.5 averages for trend classification.
 * @param windowMinutes  Window size in minutes (e.g. 30, 60, 1440).
 */
export function getHistoricalAvg(windowMinutes: number): TrendPoint[] {
  const rows = historicalAvgStmt.all(`-${windowMinutes}`) as HistAvgRow[];
  return rows.map((r, i) => ({ t: i, avgPm25: r.avg_pm25 }));
}

// ---------------------------------------------------------------------------
// P2 — Historical API with resolution and zone filter
// ---------------------------------------------------------------------------

type Pollutant = 'pm25' | 'co2' | 'no2';

const RANGE_MINUTES: Record<string, number> = {
  '1h':  60,
  '24h': 1440,
  '7d':  10080,
  '30d': 43200,
  '90d': 129600,
};

const BUCKET_MINUTES: Record<string, number> = {
  '1h':  1,
  '24h': 60,
  '7d':  60,
  '30d': 1440,
  '90d': 1440,
};

export interface HistoryPoint {
  label: string;
  value: number;
}

/**
 * Return a time series at appropriate resolution for a given range.
 * Optionally filtered by a bounding circle (zone).
 */
export function getHistoryByZone(
  pollutant: Pollutant,
  range: string,
  centerLat?: number,
  centerLng?: number,
  radiusKm?: number,
): HistoryPoint[] {
  const windowMin  = RANGE_MINUTES[range]  ?? 60;
  const bucketMin  = BUCKET_MINUTES[range] ?? 1;

  // SQLite strftime format that groups by the right bucket
  const fmtMap: Record<number, string> = {
    1:    '%Y-%m-%dT%H:%M:00Z',
    60:   '%Y-%m-%dT%H:00:00Z',
    1440: '%Y-%m-%dT00:00:00Z',
  };
  const fmt = fmtMap[bucketMin] ?? '%Y-%m-%dT%H:00:00Z';

  // Build query dynamically (still uses prepared-style binding for values)
  // Zone filter uses a bounding box approximation (cheap, no extension needed).
  let zoneClause = '';
  const params: (string | number)[] = [`-${windowMin}`];

  if (centerLat !== undefined && centerLng !== undefined && radiusKm !== undefined) {
    // ~1 km ≈ 0.009° lat, adjust lng by cos(lat)
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));
    zoneClause = `
      AND lat  BETWEEN ? AND ?
      AND lng  BETWEEN ? AND ?
    `;
    params.push(centerLat - dLat, centerLat + dLat, centerLng - dLng, centerLng + dLng);
  }

  const col = pollutant; // pm25 | co2 | no2  (column names match exactly)

  const stmt = db.prepare(`
    SELECT
      strftime('${fmt}', server_timestamp) as label,
      AVG(${col}) as value
    FROM TelemetryLogs
    WHERE server_timestamp >= datetime('now', ? || ' minutes')
    ${zoneClause}
    GROUP BY strftime('${fmt}', server_timestamp)
    ORDER BY server_timestamp ASC
  `);

  return stmt.all(...params) as HistoryPoint[];
}

// ---------------------------------------------------------------------------
// P3 — Hourly history for forecast seasonal decomposition
// ---------------------------------------------------------------------------

const hourlyHistoryStmt = db.prepare(`
  SELECT
    strftime('%Y-%m-%dT%H:00:00Z', server_timestamp) as hourIso,
    AVG(pm25) as avgPm25
  FROM TelemetryLogs
  WHERE server_timestamp >= datetime('now', ? || ' days')
  GROUP BY strftime('%Y-%m-%d %H', server_timestamp)
  ORDER BY server_timestamp ASC
`);

interface HourlyRow {
  hourIso: string;
  avgPm25: number;
}

/**
 * Return hourly average PM2.5 for the last N days (for forecast model).
 */
export function getHourlyHistory(days: number = 7): HourlyReading[] {
  return hourlyHistoryStmt.all(`-${days}`) as HourlyRow[];
}

// ---------------------------------------------------------------------------
// P4 — Source attribution readings
// ---------------------------------------------------------------------------

const sourceDataStmt = db.prepare(`
  SELECT lat, lng, pm25, no2, humidity,
         server_timestamp as timestamp
  FROM TelemetryLogs
  WHERE server_timestamp >= datetime('now', ? || ' hours')
  ORDER BY server_timestamp ASC
`);

/**
 * Return readings for source attribution over the last N hours.
 */
export function getSourceData(hours: number = 24): AttributionReading[] {
  return sourceDataStmt.all(`-${hours}`) as AttributionReading[];
}

// ---------------------------------------------------------------------------
// Snapshot (enriched with analytics)
// ---------------------------------------------------------------------------

export function computeSnapshot(): TelemetrySnapshot {
  const alertThresholdPm25 = getAlertThresholdPm25();

  // Legacy fields
  const drones    = getLatest();
  const alerts    = getActiveAlerts(alertThresholdPm25);
  const cityTrend = getCityTrend();
  const hotspots  = getHotspots();

  // P0 — DBSCAN-lite clusters
  const rawPoints       = getRawPointsForHotspot(-5);
  const hotspotClusters = detectHotspots(rawPoints, alertThresholdPm25);

  // P1 — trend over last 30 minutes
  const trendSeries = getHistoricalAvg(30);
  const trend       = classifyTrend(trendSeries, 30);

  // P3 — 6-hour forecast
  const hourlyHistory = getHourlyHistory(7);
  const forecast      = computeForecast(hourlyHistory, 6);

  // P4 — source attribution over last 24 hours
  const sourceReadings = getSourceData(24);
  const sources        = attributeSources(sourceReadings);

  return {
    drones,
    alerts,
    cityTrend,
    hotspots,
    hotspotClusters,
    trend,
    forecast,
    sources,
    alertThresholdPm25,
    emittedAt: new Date().toISOString(),
  };
}
