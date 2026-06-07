import {
  PM25_ALERT_THRESHOLD,
  type AlertThresholdConfig,
  type CityTrendPoint,
  type Hotspot,
  type TelemetryInput,
  type TelemetryRecord,
  type TelemetrySnapshot,
  type AlertRule,
  type AlertRuleInput,
} from '@climence/shared';
import db from './client';
import { detectHotspots, type RawPoint } from '../features/analytics/hotspots.js';
import { classifyTrend, type TrendPoint } from '../features/analytics/trend.js';
import { computeForecast, type HourlyReading } from '../features/analytics/forecast.js';
import { attributeSources, type AttributionReading } from '../features/analytics/sources.js';

export interface MissionRecord {
  id: string;
  target_id: string;
  target_name: string;
  lat: number;
  lng: number;
  resource_type: string;
  priority: string;
  status: string;
  report?: string;
  start_time: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Existing queries
// ---------------------------------------------------------------------------

const insertStmt = db.prepare(`
  INSERT INTO TelemetryLogs (
    uuid, state, batteryLevel, lat, lng,
    pm25, pm10, co2, no2, o3, so2, co, temperature, humidity, rssi, client_timestamp
  ) VALUES (
    @uuid, @state, @batteryLevel, @lat, @lng,
    @pm25, @pm10, @co2, @no2, @o3, @so2, @co, @temperature, @humidity, @rssi, @client_timestamp
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
      pm10: drone.airQuality.pm10 ?? null,
      co2: drone.airQuality.co2,
      no2: drone.airQuality.no2,
      o3: drone.airQuality.o3 ?? null,
      so2: drone.airQuality.so2 ?? null,
      co: drone.airQuality.co ?? null,
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
    strftime('%H:%M:%S', server_timestamp) as minute_label,
    AVG(pm25) as avg_pm25,
    AVG(co2) as avg_co2,
    AVG(no2) as avg_no2
  FROM TelemetryLogs
  WHERE server_timestamp >= datetime('now', '-60 minutes')
  GROUP BY strftime('%Y-%m-%d %H:%M:%S', server_timestamp)
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

type Pollutant = 'pm25' | 'pm10' | 'co2' | 'no2' | 'o3' | 'so2' | 'co';

const RANGE_MINUTES: Record<string, number> = {
  '1h': 60,
  '6h': 360,
  '12h': 720,
  '24h': 1440,
  '7d': 10080,
  '30d': 43200,
  '90d': 129600,
};

const BUCKET_MINUTES: Record<string, number> = {
  '1h': 1,
  '6h': 5,
  '12h': 5,
  '24h': 5,
  '7d': 30,
  '30d': 360,
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
  const windowMin = RANGE_MINUTES[range] ?? 60;
  const bucketMin = BUCKET_MINUTES[range] ?? 1;

  // SQLite strftime format that groups by the right bucket
  const fmtMap: Record<number, string> = {
    1: '%Y-%m-%dT%H:%M:00Z',
    5: '%Y-%m-%dT%H:%f:00Z',   // will be overridden below
    30: '%Y-%m-%dT%H:%M:00Z',   // will be overridden below
    60: '%Y-%m-%dT%H:00:00Z',
    360: '%Y-%m-%dT%H:00:00Z',   // will be overridden below
    1440: '%Y-%m-%dT00:00:00Z',
  };

  // For sub-hour buckets that need rounding, use minute-level grouping
  // but truncated to the bucket size via integer division trick.
  let fmt: string;
  if (bucketMin === 5) {
    // Group by 5-minute slots: floor(minute/5)*5
    fmt = '%Y-%m-%dT%H:'; // handled specially below
  } else if (bucketMin === 30) {
    fmt = '%Y-%m-%dT%H:'; // handled specially below
  } else if (bucketMin === 360) {
    fmt = '%Y-%m-%dT%H:00:00Z';
  } else {
    fmt = fmtMap[bucketMin] ?? '%Y-%m-%dT%H:00:00Z';
  }

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

  let stmt;
  if (bucketMin === 5) {
    // Group into 5-minute windows: cast(strftime('%M')/5)*5
    stmt = db.prepare(`
      SELECT
        strftime('%Y-%m-%dT%H:', server_timestamp)
          || printf('%02d', (CAST(strftime('%M', server_timestamp) AS INTEGER) / 5) * 5)
          || ':00Z' as label,
        AVG(${col}) as value
      FROM TelemetryLogs
      WHERE server_timestamp >= datetime('now', ? || ' minutes')
      ${zoneClause}
      GROUP BY strftime('%Y-%m-%d %H', server_timestamp),
               (CAST(strftime('%M', server_timestamp) AS INTEGER) / 5)
      ORDER BY server_timestamp ASC
    `);
  } else if (bucketMin === 30) {
    stmt = db.prepare(`
      SELECT
        strftime('%Y-%m-%dT%H:', server_timestamp)
          || printf('%02d', (CAST(strftime('%M', server_timestamp) AS INTEGER) / 30) * 30)
          || ':00Z' as label,
        AVG(${col}) as value
      FROM TelemetryLogs
      WHERE server_timestamp >= datetime('now', ? || ' minutes')
      ${zoneClause}
      GROUP BY strftime('%Y-%m-%d %H', server_timestamp),
               (CAST(strftime('%M', server_timestamp) AS INTEGER) / 30)
      ORDER BY server_timestamp ASC
    `);
  } else {
    stmt = db.prepare(`
      SELECT
        strftime('${fmt}', server_timestamp) as label,
        AVG(${col}) as value
      FROM TelemetryLogs
      WHERE server_timestamp >= datetime('now', ? || ' minutes')
      ${zoneClause}
      GROUP BY strftime('${fmt}', server_timestamp)
      ORDER BY server_timestamp ASC
    `);
  }

  return stmt.all(...params) as HistoryPoint[];
}

// ---------------------------------------------------------------------------
// P3 — Hourly history for forecast seasonal decomposition
// ---------------------------------------------------------------------------

const hourlyHistoryStmt = db.prepare(`
  SELECT
    strftime('%Y-%m-%dT%H:00:00Z', server_timestamp) as hourIso,
    AVG(pm25) as avgPm25,
    AVG(pm25) * 1.2 as pm10,
    AVG(co2) as co2,
    AVG(no2) as no2,
    AVG(pm25) * 0.4 as dust
  FROM TelemetryLogs
  WHERE server_timestamp >= datetime('now', ? || ' days')
  GROUP BY strftime('%Y-%m-%d %H', server_timestamp)
  ORDER BY server_timestamp ASC
`);

interface HourlyRow {
  hourIso: string;
  avgPm25: number;
  pm10: number;
  co2: number;
  no2: number;
  dust: number;
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
  const drones = getLatest();
  const alerts = getActiveAlerts(alertThresholdPm25);
  const cityTrend = getCityTrend();
  const hotspots = getHotspots();

  // P0 — DBSCAN-lite clusters
  const rawPoints = getRawPointsForHotspot(-5);
  const hotspotClusters = detectHotspots(rawPoints, alertThresholdPm25);

  // P1 — trend over last 30 minutes
  const trendSeries = getHistoricalAvg(30);
  const trend = classifyTrend(trendSeries, 30);

  // P3 — 6-hour forecast
  const hourlyHistory = getHourlyHistory(7);
  const forecast = computeForecast(hourlyHistory, 6);

  // P4 — source attribution over last 24 hours
  const sourceReadings = getSourceData(24);
  const sources = attributeSources(sourceReadings);

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
    missions: getAllMissions(),
    emittedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Mission Queries
// ---------------------------------------------------------------------------

const insertMissionStmt = db.prepare(`
  INSERT INTO Missions (
    id, target_id, target_name, lat, lng, resource_type, priority, status
  ) VALUES (
    @id, @targetId, @targetName, @lat, @lng, @resourceType, @priority, @status
  )
`);

export const insertMission = (m: any) => {
  insertMissionStmt.run({
    ...m,
    lat: m.targetCoord?.lat ?? 0,
    lng: m.targetCoord?.lng ?? 0,
  });
  // Note: broadcastSnapshot() is usually called by the route after this.
};

const updateMissionStatusStmt = db.prepare(`
  UPDATE Missions 
  SET status = @status, report = @report, updated_at = CURRENT_TIMESTAMP 
  WHERE id = @id
`);

export const updateMissionStatus = (id: string, status: string, report?: string) =>
  updateMissionStatusStmt.run({ id, status, report });

const allMissionsStmt = db.prepare(`
  SELECT * FROM Missions ORDER BY start_time DESC
`);

export const getAllMissions = (): MissionRecord[] => allMissionsStmt.all() as MissionRecord[];

// ---------------------------------------------------------------------------
// Scheduled Reports (Fix 8)
// ---------------------------------------------------------------------------

export interface ScheduledReportRecord {
  schedule_id: number;
  user_id: number | null;
  report_type: string;
  region: string | null;
  pollutants: string | null;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string;
  output_format: string;
  is_active: number;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

export interface ScheduledReportInput {
  report_type?: string;
  region?: string;
  pollutants?: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  output_format?: string;
}

function computeNextRun(frequency: string, from?: Date): string {
  const d = from ?? new Date();
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

const listSchedulesStmt = db.prepare(`
  SELECT * FROM scheduled_reports WHERE user_id = ? ORDER BY created_at DESC
`);

export function listScheduledReports(userId: number): ScheduledReportRecord[] {
  return listSchedulesStmt.all(userId) as ScheduledReportRecord[];
}

const insertScheduleStmt = db.prepare(`
  INSERT INTO scheduled_reports (
    user_id, report_type, region, pollutants, frequency, recipients, output_format, next_run
  ) VALUES (
    @user_id, @report_type, @region, @pollutants, @frequency, @recipients, @output_format, @next_run
  )
`);

const getScheduleByIdStmt = db.prepare(`SELECT * FROM scheduled_reports WHERE schedule_id = ?`);

export function createScheduledReport(userId: number, input: ScheduledReportInput): ScheduledReportRecord {
  const info = insertScheduleStmt.run({
    user_id: userId,
    report_type: input.report_type ?? 'snapshot',
    region: input.region ?? null,
    pollutants: input.pollutants ? JSON.stringify(input.pollutants) : null,
    frequency: input.frequency,
    recipients: JSON.stringify(input.recipients),
    output_format: input.output_format ?? 'pdf',
    next_run: computeNextRun(input.frequency),
  });
  return getScheduleByIdStmt.get(info.lastInsertRowid) as ScheduledReportRecord;
}

const deleteScheduleStmt = db.prepare(`
  DELETE FROM scheduled_reports WHERE schedule_id = ? AND user_id = ?
`);

export function deleteScheduledReport(scheduleId: number, userId: number): boolean {
  const result = deleteScheduleStmt.run(scheduleId, userId);
  return result.changes > 0;
}

const dueSchedulesStmt = db.prepare(`
  SELECT * FROM scheduled_reports
  WHERE is_active = 1 AND next_run <= datetime('now')
`);

const updateScheduleRunStmt = db.prepare(`
  UPDATE scheduled_reports
  SET last_run = CURRENT_TIMESTAMP, next_run = @next_run
  WHERE schedule_id = @schedule_id
`);

export function getDueSchedules(): ScheduledReportRecord[] {
  return dueSchedulesStmt.all() as ScheduledReportRecord[];
}

export function markScheduleRun(scheduleId: number, frequency: string): void {
  updateScheduleRunStmt.run({
    schedule_id: scheduleId,
    next_run: computeNextRun(frequency),
  });
}

// ---------------------------------------------------------------------------
// Alert Rules and Events (Fix 5 / 6)
// ---------------------------------------------------------------------------

const listAlertRulesStmt = db.prepare(`
  SELECT rule_id, user_id, pollutant_type, threshold_value, condition_operator,
         notification_channel, is_active, created_at
  FROM alert_rules WHERE user_id = ? OR ? IS NULL ORDER BY created_at DESC
`);

export function listAlertRules(userId?: number): AlertRule[] {
  const rows = listAlertRulesStmt.all(userId ?? null, userId ?? null) as any[];
  return rows.map(r => ({
    ...r,
    is_active: Boolean(r.is_active),
  }));
}

const insertAlertRuleStmt = db.prepare(`
  INSERT INTO alert_rules (user_id, pollutant_type, threshold_value, condition_operator, notification_channel, is_active)
  VALUES (@user_id, @pollutant_type, @threshold_value, @condition_operator, @notification_channel, @is_active)
`);

const getAlertRuleByIdStmt = db.prepare(`SELECT * FROM alert_rules WHERE rule_id = ?`);

export function createAlertRule(userId: number, input: AlertRuleInput): AlertRule {
  const info = insertAlertRuleStmt.run({
    user_id: userId,
    pollutant_type: input.pollutant_type,
    threshold_value: input.threshold_value,
    condition_operator: input.condition_operator ?? '>',
    notification_channel: input.notification_channel ?? 'system',
    is_active: (input.is_active ?? true) ? 1 : 0,
  });
  const row = getAlertRuleByIdStmt.get(info.lastInsertRowid) as any;
  return {
    ...row,
    is_active: Boolean(row.is_active),
  };
}

export function updateAlertRule(ruleId: number, userId: number, input: Partial<AlertRuleInput>): AlertRule | null {
  const sets: string[] = [];
  const params: any = { ruleId, userId };
  for (const [key, val] of Object.entries(input)) {
    if (val !== undefined) {
      sets.push(`${key} = @${key}`);
      params[key] = key === 'is_active' ? (val ? 1 : 0) : val;
    }
  }
  if (sets.length === 0) return getAlertRuleByIdStmt.get(ruleId) as AlertRule | null;

  const updateStmt = db.prepare(`
    UPDATE alert_rules SET ${sets.join(', ')} WHERE rule_id = @ruleId AND user_id = @userId
  `);
  updateStmt.run(params);
  const row = getAlertRuleByIdStmt.get(ruleId) as any;
  return row ? { ...row, is_active: Boolean(row.is_active) } : null;
}

const deleteAlertEventsForRuleStmt = db.prepare(`
  DELETE FROM alert_events WHERE rule_id = ?
`);

const deleteAlertRuleStmt = db.prepare(`
  DELETE FROM alert_rules WHERE rule_id = ?
`);

export function deleteAlertRule(ruleId: number, userId: number): boolean {
  deleteAlertEventsForRuleStmt.run(ruleId);
  const result = deleteAlertRuleStmt.run(ruleId);
  return result.changes > 0;
}
export function clearClearedAlertEvents(): void {
  db.prepare(`DELETE FROM alert_events WHERE status = 'cleared'`).run();
}

export function getAlertEvents(status?: string, limit: number = 50): any[] {
  let query = `
    SELECT ae.*, ar.pollutant_type, ar.threshold_value, ar.condition_operator, ar.notification_channel
    FROM alert_events ae LEFT JOIN alert_rules ar ON ae.rule_id = ar.rule_id
  `;
  const params: any[] = [];
  if (status) {
    query += ` WHERE ae.status = ?`;
    params.push(status);
  }
  query += ` ORDER BY ae.triggered_at DESC LIMIT ?`;
  params.push(limit);

  return db.prepare(query).all(...params) as any[];
}

// Runtime migration: add drone_id column if it doesn't exist yet
try { db.prepare(`ALTER TABLE alert_events ADD COLUMN drone_id TEXT`).run(); } catch { /* column already exists */ }

const activeEventByRuleDroneStmt = db.prepare(`
  SELECT * FROM alert_events WHERE rule_id = ? AND drone_id = ? AND status = 'active' LIMIT 1
`);

const insertAlertEventStmt = db.prepare(`
  INSERT INTO alert_events (rule_id, drone_id, peak_value, status) VALUES (?, ?, ?, 'active')
`);

const updateAlertEventPeakStmt = db.prepare(`
  UPDATE alert_events SET peak_value = ? WHERE event_id = ?
`);

const clearAlertEventByDroneStmt = db.prepare(`
  UPDATE alert_events SET cleared_at = CURRENT_TIMESTAMP, status = 'cleared'
  WHERE rule_id = ? AND drone_id = ? AND status = 'active'
`);

export function evaluateAlerts(drones: TelemetryInput[]): void {
  const rules = db.prepare(`SELECT * FROM alert_rules WHERE is_active = 1`).all() as any[];

  for (const rule of rules) {
    const pollutant = rule.pollutant_type;
    for (const drone of drones) {
      const droneId = drone.uuid;
      const value = (drone.airQuality as any)[pollutant];
      if (value === undefined || value === null) continue;

      const op = rule.condition_operator;
      const threshold = Number(rule.threshold_value);
      const crosses = op === '>' ? value > threshold
        : op === '>=' ? value >= threshold
          : op === '<' ? value < threshold
            : op === '<=' ? value <= threshold
              : false;

      if (crosses) {
        const existing = activeEventByRuleDroneStmt.get(rule.rule_id, droneId) as any;
        if (!existing) {
          insertAlertEventStmt.run(rule.rule_id, droneId, value);
        } else if (value > existing.peak_value) {
          updateAlertEventPeakStmt.run(value, existing.event_id);
        }
      } else {
        clearAlertEventByDroneStmt.run(rule.rule_id, droneId);
      }
    }
  }
}
