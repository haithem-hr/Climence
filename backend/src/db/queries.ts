import {
  type AlertConditionOperator,
  type AlertEvent,
  type AlertEventStatus,
  type AlertPollutantType,
  type AlertRule,
  type AlertRuleInput,
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

const ALERT_POLLUTANTS = ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co'] as const;
const ALERT_OPERATORS = ['>', '>=', '<', '<='] as const;

function isAlertPollutant(value: unknown): value is AlertPollutantType {
  return typeof value === 'string' && ALERT_POLLUTANTS.includes(value as AlertPollutantType);
}

function isAlertOperator(value: unknown): value is AlertConditionOperator {
  return typeof value === 'string' && ALERT_OPERATORS.includes(value as AlertConditionOperator);
}

function normalizeRuleInput(input: Partial<AlertRuleInput>) {
  const pollutant = input.pollutant_type;
  if (pollutant !== undefined && !isAlertPollutant(pollutant)) throw new Error('Invalid pollutant_type');
  if (input.threshold_value !== undefined && !Number.isFinite(input.threshold_value)) throw new Error('Invalid threshold_value');
  const operator = input.condition_operator ?? '>';
  if (!isAlertOperator(operator)) throw new Error('Invalid condition_operator');
  return {
    pollutant_type: pollutant,
    threshold_value: input.threshold_value,
    condition_operator: operator,
    notification_channel: input.notification_channel ?? 'system',
    is_active: input.is_active ?? true,
  };
}

function mapAlertRule(row: any): AlertRule {
  return {
    rule_id: Number(row.rule_id),
    user_id: row.user_id === null || row.user_id === undefined ? null : Number(row.user_id),
    pollutant_type: row.pollutant_type,
    threshold_value: Number(row.threshold_value),
    condition_operator: row.condition_operator,
    notification_channel: row.notification_channel ?? 'system',
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  };
}

function mapAlertEvent(row: any): AlertEvent {
  return {
    event_id: Number(row.event_id),
    rule_id: Number(row.rule_id),
    triggered_at: row.triggered_at,
    cleared_at: row.cleared_at ?? null,
    peak_value: Number(row.peak_value),
    status: row.status,
    pollutant_type: row.pollutant_type,
    threshold_value: row.threshold_value === undefined ? undefined : Number(row.threshold_value),
    condition_operator: row.condition_operator,
    notification_channel: row.notification_channel,
  };
}

const listAlertRulesAllStmt = db.prepare(`
  SELECT * FROM alert_rules
  ORDER BY created_at DESC, rule_id DESC
`);

const listAlertRulesForUserStmt = db.prepare(`
  SELECT * FROM alert_rules
  WHERE user_id = ?
  ORDER BY created_at DESC, rule_id DESC
`);

export function listAlertRules(userId?: number): AlertRule[] {
  const rows = userId === undefined ? listAlertRulesAllStmt.all() : listAlertRulesForUserStmt.all(userId);
  return rows.map(mapAlertRule);
}

const createAlertRuleStmt = db.prepare(`
  INSERT INTO alert_rules (
    user_id, pollutant_type, threshold_value, condition_operator, notification_channel, is_active
  ) VALUES (
    @user_id, @pollutant_type, @threshold_value, @condition_operator, @notification_channel, @is_active
  )
`);

const alertRuleByIdStmt = db.prepare(`SELECT * FROM alert_rules WHERE rule_id = ?`);

export function createAlertRule(userId: number, input: AlertRuleInput): AlertRule {
  const normalized = normalizeRuleInput(input);
  if (!normalized.pollutant_type || normalized.threshold_value === undefined) throw new Error('Missing alert rule fields');
  const result = createAlertRuleStmt.run({
    user_id: userId,
    pollutant_type: normalized.pollutant_type,
    threshold_value: normalized.threshold_value,
    condition_operator: normalized.condition_operator,
    notification_channel: normalized.notification_channel,
    is_active: normalized.is_active ? 1 : 0,
  });
  return mapAlertRule(alertRuleByIdStmt.get(result.lastInsertRowid));
}

export function updateAlertRule(ruleId: number, userId: number, input: Partial<AlertRuleInput>): AlertRule | null {
  const existing = alertRuleByIdStmt.get(ruleId) as AlertRule | undefined;
  if (!existing || Number(existing.user_id) !== userId) return null;
  const normalized = normalizeRuleInput(input);
  const next = {
    pollutant_type: normalized.pollutant_type ?? existing.pollutant_type,
    threshold_value: normalized.threshold_value ?? Number(existing.threshold_value),
    condition_operator: input.condition_operator ?? existing.condition_operator,
    notification_channel: input.notification_channel ?? existing.notification_channel ?? 'system',
    is_active: input.is_active ?? Boolean(existing.is_active),
    rule_id: ruleId,
  };
  db.prepare(`
    UPDATE alert_rules
    SET pollutant_type = @pollutant_type,
        threshold_value = @threshold_value,
        condition_operator = @condition_operator,
        notification_channel = @notification_channel,
        is_active = @is_active
    WHERE rule_id = @rule_id
  `).run({ ...next, is_active: next.is_active ? 1 : 0 });
  return mapAlertRule(alertRuleByIdStmt.get(ruleId));
}

export function deleteAlertRule(ruleId: number, userId: number): boolean {
  const result = db.prepare(`DELETE FROM alert_rules WHERE rule_id = ? AND user_id = ?`).run(ruleId, userId);
  return result.changes > 0;
}

export function getAlertEvents(status?: AlertEventStatus, limit = 50): AlertEvent[] {
  const params: (string | number)[] = [];
  let statusClause = '';
  if (status) {
    statusClause = 'WHERE e.status = ?';
    params.push(status);
  }
  params.push(limit);
  const rows = db.prepare(`
    SELECT e.*, r.pollutant_type, r.threshold_value, r.condition_operator, r.notification_channel
    FROM alert_events e
    JOIN alert_rules r ON r.rule_id = e.rule_id
    ${statusClause}
    ORDER BY COALESCE(e.cleared_at, e.triggered_at) DESC
    LIMIT ?
  `).all(...params);
  return rows.map(mapAlertEvent);
}

function compareAlertValue(value: number, threshold: number, operator: AlertConditionOperator) {
  switch (operator) {
    case '>=': return value >= threshold;
    case '<': return value < threshold;
    case '<=': return value <= threshold;
    default: return value > threshold;
  }
}

function getDronePollutantValue(drone: TelemetryInput, pollutant: AlertPollutantType) {
  const value = drone.airQuality[pollutant];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getRollingAverage(pollutant: AlertPollutantType) {
  const row = db.prepare(`
    SELECT AVG(${pollutant}) as avg_val
    FROM TelemetryLogs
    WHERE server_timestamp > datetime('now', '-60 minutes')
  `).get() as { avg_val?: number | null };
  return row.avg_val === null || row.avg_val === undefined ? null : Number(row.avg_val);
}

export function evaluateAlerts(drones: TelemetryInput[]): void {
  const rules = listAlertRules().filter(rule => rule.is_active);
  if (rules.length === 0) return;

  const activeEventStmt = db.prepare(`SELECT * FROM alert_events WHERE rule_id = ? AND status = 'active' LIMIT 1`);
  const insertEventStmt = db.prepare(`
    INSERT INTO alert_events (rule_id, peak_value, status)
    VALUES (?, ?, 'active')
  `);
  const clearEventStmt = db.prepare(`
    UPDATE alert_events
    SET cleared_at = CURRENT_TIMESTAMP,
        status = 'cleared'
    WHERE event_id = ?
  `);
  const updatePeakStmt = db.prepare(`
    UPDATE alert_events
    SET peak_value = ?
    WHERE event_id = ?
  `);

  for (const rule of rules) {
    const readings = drones
      .map(drone => ({ drone, value: getDronePollutantValue(drone, rule.pollutant_type) }))
      .filter((item): item is { drone: TelemetryInput; value: number } => item.value !== null);
    const current = readings.length > 0 ? Math.max(...readings.map(item => item.value)) : null;
    const rollingAverage = getRollingAverage(rule.pollutant_type);
    const values = [current, rollingAverage].filter((value): value is number => value !== null && Number.isFinite(value));
    const crossed = values.some(value => compareAlertValue(value, rule.threshold_value, rule.condition_operator));
    const peakValue = values.length > 0 ? Math.max(...values) : 0;
    const activeEvent = activeEventStmt.get(rule.rule_id) as { event_id: number; peak_value: number } | undefined;

    if (crossed && !activeEvent) {
      insertEventStmt.run(rule.rule_id, peakValue);
      const source = readings.find(item => item.value === current)?.drone;
      const location = source ? `${source.location.lat.toFixed(4)}, ${source.location.lng.toFixed(4)}` : 'rolling average';
      console.log(`ALERT: ${rule.pollutant_type} exceeded ${rule.threshold_value} at ${location}`);
    } else if (crossed && activeEvent && peakValue > Number(activeEvent.peak_value)) {
      updatePeakStmt.run(peakValue, activeEvent.event_id);
    } else if (!crossed && activeEvent) {
      clearEventStmt.run(activeEvent.event_id);
      console.log(`CLEARED: ${rule.pollutant_type} back to normal`);
    }
  }
}

// ---------------------------------------------------------------------------
// P0 — Raw points for hotspot clustering
// ---------------------------------------------------------------------------

interface RawRow {
  uuid: string;
  lat: number;
  lng: number;
  pm25: number;
  pm10?: number | null;
  no2?: number | null;
  o3?: number | null;
}

const rawPointsStmt = db.prepare(`
  SELECT uuid, lat, lng, pm25, pm10, no2, o3
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

let cachedHotspotClusters: ReturnType<typeof detectHotspots> | null = null;
let hotspotRefreshTimerStarted = false;

function getCachedHotspotClusters(alertThresholdPm25: number) {
  if (!hotspotRefreshTimerStarted) {
    hotspotRefreshTimerStarted = true;
    setInterval(() => {
      cachedHotspotClusters = null;
    }, 10 * 60 * 1000).unref();
  }

  if (!cachedHotspotClusters) {
    cachedHotspotClusters = detectHotspots(getRawPointsForHotspot(-15), alertThresholdPm25);
  }
  return cachedHotspotClusters;
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
  '1h':   60,
  '6h':   360,
  '12h':  720,
  '24h':  1440,
  '7d':   10080,
  '30d':  43200,
  '90d':  129600,
};

const BUCKET_MINUTES: Record<string, number> = {
  '1h':  1,
  '6h':  5,
  '12h': 5,
  '24h': 5,
  '7d':  30,
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
  const windowMin  = RANGE_MINUTES[range]  ?? 60;
  const bucketMin  = BUCKET_MINUTES[range] ?? 1;

  // SQLite strftime format that groups by the right bucket
  const fmtMap: Record<number, string> = {
    1:    '%Y-%m-%dT%H:%M:00Z',
    5:    '%Y-%m-%dT%H:%f:00Z',   // will be overridden below
    30:   '%Y-%m-%dT%H:%M:00Z',   // will be overridden below
    60:   '%Y-%m-%dT%H:00:00Z',
    360:  '%Y-%m-%dT%H:00:00Z',   // will be overridden below
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
    AVG(COALESCE(pm10, pm25 * 1.2)) as pm10,
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
  const drones    = getLatest();
  const alerts    = getActiveAlerts(alertThresholdPm25);
  const cityTrend = getCityTrend();
  const hotspots  = getHotspots();

  // P0 — DBSCAN-lite clusters
  const hotspotClusters = getCachedHotspotClusters(alertThresholdPm25);

  // P1 — trend over last 30 minutes
  const trendSeries = getHistoricalAvg(30);
  const trend       = classifyTrend(trendSeries, 30);

  // P3 — 6-hour forecast
  const hourlyHistory = getHourlyHistory(7);
  const forecast      = computeForecast(hourlyHistory, 6);

  // P4 — source attribution over last 24 hours
  const sourceReadings = getSourceData(24);
  const sources        = attributeSources(sourceReadings);
  const alertRules     = listAlertRules();
  const alertEvents    = getAlertEvents('active', 50);
  const clearedAlertEvents = getAlertEvents('cleared', 20);

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
    alertRules,
    alertEvents,
    clearedAlertEvents,
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
