import type {
  AlertThresholdConfig,
  CityTrendPoint,
  Hotspot,
  TelemetryInput,
  TelemetryRecord,
  TelemetrySnapshot,
} from '@climence/shared';
import type { Pool } from 'pg';
import type { RedisClientType } from 'redis';
import { PM25_ALERT_THRESHOLD } from '@climence/shared';
import { detectHotspots, type RawPoint } from '../../features/analytics/hotspots.js';
import { classifyTrend, type TrendPoint } from '../../features/analytics/trend.js';
import { computeForecast, type HourlyReading } from '../../features/analytics/forecast.js';
import { attributeSources, type AttributionReading } from '../../features/analytics/sources.js';
import type { HistoryPoint, MissionRecord, Storage } from '../index.js';

const REDIS_LATEST_PREFIX = 'climence:latest:'; // per drone

function latestKey(uuid: string) {
  return `${REDIS_LATEST_PREFIX}${uuid}`;
}

function mapTelemetryInputToRecord(d: TelemetryInput): Omit<TelemetryRecord, 'id' | 'server_timestamp'> {
  return {
    uuid: d.uuid,
    state: d.state,
    batteryLevel: d.batteryLevel,
    lat: d.location.lat,
    lng: d.location.lng,
    pm25: d.airQuality.pm25,
    pm10: d.airQuality.pm10 ?? null,
    co2: d.airQuality.co2,
    no2: d.airQuality.no2,
    o3: d.airQuality.o3 ?? null,
    so2: d.airQuality.so2 ?? null,
    co: d.airQuality.co ?? null,
    temperature: d.airQuality.temperature,
    humidity: d.airQuality.humidity,
    rssi: d.rssi,
    client_timestamp: d.timestamp,
  };
}

export function createRedisPostgresStorage(opts: {
  pool: Pool;
  redis: RedisClientType;
}): Storage {
  const { pool, redis } = opts;

  async function insertFleet(drones: TelemetryInput[]) {
    if (drones.length === 0) return;

    // 1) Insert into Postgres (durable history)
    // Use a single INSERT with VALUES list for efficiency.
    const cols =
      '(uuid, state, battery_level, lat, lng, pm25, pm10, co2, no2, o3, so2, co, temperature, humidity, rssi, client_timestamp)';
    const values: unknown[] = [];
    const placeholders: string[] = [];

    let i = 1;
    for (const d of drones) {
      const row = mapTelemetryInputToRecord(d);
      placeholders.push(
        `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`,
      );
      values.push(
        row.uuid,
        row.state,
        row.batteryLevel,
        row.lat,
        row.lng,
        row.pm25,
        row.pm10,
        row.co2,
        row.no2,
        row.o3,
        row.so2,
        row.co,
        row.temperature,
        row.humidity,
        row.rssi,
        row.client_timestamp,
      );
    }

    await pool.query(
      `INSERT INTO telemetry_logs ${cols} VALUES ${placeholders.join(', ')};`,
      values,
    );

    // 2) Update Redis latest values (fast reads)
    const multi = redis.multi();
    const nowIso = new Date().toISOString();
    for (const d of drones) {
      const row = mapTelemetryInputToRecord(d);
      const record: TelemetryRecord = {
        id: 0,
        ...row,
        server_timestamp: nowIso,
      };
      multi.set(latestKey(d.uuid), JSON.stringify(record), { EX: 60 * 10 }); // 10 min TTL
    }
    await multi.exec();
  }

  async function getLatest(): Promise<TelemetryRecord[]> {
    // Redis scan keys (small fleet, acceptable). If needed we can maintain a set of active uuids.
    const keys: string[] = [];
    for await (const k of redis.scanIterator({ MATCH: `${REDIS_LATEST_PREFIX}*`, COUNT: 100 })) {
      keys.push(String(k));
    }

    if (keys.length === 0) return [];
    const jsons = await redis.mGet(keys);
    return jsons
      .filter((v): v is string => typeof v === 'string')
      .map(v => JSON.parse(v) as TelemetryRecord);
  }

  async function getHistory(droneId: string): Promise<TelemetryRecord[]> {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        uuid,
        state,
        battery_level as "batteryLevel",
        lat,
        lng,
        pm25,
        pm10,
        co2,
        no2,
        o3,
        so2,
        co,
        temperature,
        humidity,
        rssi,
        client_timestamp,
        server_timestamp
      FROM telemetry_logs
      WHERE uuid = $1
      ORDER BY server_timestamp DESC
      LIMIT 60
      `,
      [droneId],
    );

    // Return ascending like SQLite version
    return rows.reverse() as TelemetryRecord[];
  }

  async function getCityTrend(): Promise<CityTrendPoint[]> {
    // 60 minutes, 1-minute buckets
    const { rows } = await pool.query(
      `
      SELECT
        to_char(date_trunc('minute', server_timestamp), 'HH24:MI:SS') as minute_label,
        AVG(pm25) as avg_pm25,
        AVG(co2) as avg_co2,
        AVG(no2) as avg_no2
      FROM telemetry_logs
      WHERE server_timestamp >= now() - interval '60 minutes'
      GROUP BY 1
      ORDER BY 1 ASC;
      `,
    );

    return rows.map(r => ({
      minute_label: r.minute_label,
      avg_pm25: Number(r.avg_pm25),
      avg_co2: Number(r.avg_co2),
      avg_no2: Number(r.avg_no2),
    }));
  }

  async function getHotspots(): Promise<Hotspot[]> {
    // Match legacy behavior (rounded grid)
    const { rows } = await pool.query(
      `
      SELECT
        ROUND(lat::numeric, 2) as lat_zone,
        ROUND(lng::numeric, 2) as lng_zone,
        AVG(pm25) as avg_pm25
      FROM telemetry_logs
      WHERE server_timestamp >= now() - interval '5 minutes'
      GROUP BY 1,2
      ORDER BY avg_pm25 DESC
      LIMIT 3;
      `,
    );
    return rows.map(r => ({
      lat_zone: Number(r.lat_zone),
      lng_zone: Number(r.lng_zone),
      avg_pm25: Number(r.avg_pm25),
    }));
  }

  async function getActiveAlerts(pm25Threshold: number): Promise<TelemetryRecord[]> {
    // Find latest row per uuid in last 5 minutes, then threshold filter.
    const { rows } = await pool.query(
      `
      SELECT DISTINCT ON (uuid)
        id,
        uuid,
        state,
        battery_level as "batteryLevel",
        lat,
        lng,
        pm25,
        pm10,
        co2,
        no2,
        o3,
        so2,
        co,
        temperature,
        humidity,
        rssi,
        client_timestamp,
        server_timestamp
      FROM telemetry_logs
      WHERE server_timestamp >= now() - interval '5 minutes'
      ORDER BY uuid, server_timestamp DESC
      `,
    );
    return (rows as TelemetryRecord[]).filter(r => Number(r.pm25) > pm25Threshold);
  }

  async function getAlertThresholdConfig(): Promise<AlertThresholdConfig> {
    const { rows } = await pool.query(
      `SELECT pm25_threshold, updated_at FROM alert_config WHERE id = 1;`,
    );
    if (!rows[0]) {
      // should never happen because schema seeds row 1
      return { pm25_threshold: PM25_ALERT_THRESHOLD, updated_at: new Date().toISOString() };
    }
    return {
      pm25_threshold: Number(rows[0].pm25_threshold),
      updated_at: new Date(rows[0].updated_at).toISOString(),
    };
  }

  async function getAlertThresholdPm25(): Promise<number> {
    return (await getAlertThresholdConfig()).pm25_threshold;
  }

  async function setAlertThresholdPm25(pm25Threshold: number): Promise<AlertThresholdConfig> {
    await pool.query(
      `UPDATE alert_config SET pm25_threshold=$1, updated_at=now() WHERE id=1;`,
      [pm25Threshold],
    );
    return getAlertThresholdConfig();
  }

  async function getRawPointsForHotspot(windowMinutes: number = -5): Promise<RawPoint[]> {
    const minutes = Math.abs(windowMinutes);
    const { rows } = await pool.query(
      `
      SELECT uuid, lat, lng, pm25
      FROM telemetry_logs
      WHERE server_timestamp >= now() - ($1::int * interval '1 minute');
      `,
      [minutes],
    );
    return rows.map(r => ({
      uuid: String(r.uuid),
      lat: Number(r.lat),
      lng: Number(r.lng),
      pm25: Number(r.pm25),
    }));
  }

  async function getHistoricalAvg(windowMinutes: number): Promise<TrendPoint[]> {
    const { rows } = await pool.query(
      `
      SELECT
        date_trunc('minute', server_timestamp) as minute,
        AVG(pm25) as avg_pm25
      FROM telemetry_logs
      WHERE server_timestamp >= now() - ($1::int * interval '1 minute')
      GROUP BY 1
      ORDER BY 1 ASC;
      `,
      [windowMinutes],
    );
    return rows.map((r, idx) => ({ t: idx, avgPm25: Number(r.avg_pm25) }));
  }

  async function getHistoryByZone(
    pollutant: 'pm25' | 'pm10' | 'co2' | 'no2' | 'o3' | 'so2' | 'co',
    range: string,
    centerLat?: number,
    centerLng?: number,
    radiusKm?: number,
  ): Promise<HistoryPoint[]> {
    // Keep the same resolution behavior as SQLite (approx)
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

    const windowMin = RANGE_MINUTES[range] ?? 60;
    const bucketMin = BUCKET_MINUTES[range] ?? 1;

    const params: unknown[] = [windowMin];
    let zoneClause = '';
    if (centerLat !== undefined && centerLng !== undefined && radiusKm !== undefined) {
      const dLat = radiusKm / 111;
      const dLng = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));
      zoneClause = ` AND lat BETWEEN $2 AND $3 AND lng BETWEEN $4 AND $5 `;
      params.push(centerLat - dLat, centerLat + dLat, centerLng - dLng, centerLng + dLng);
    }

    // bucket expression: date_trunc + floor extraction
    let bucketExpr = `date_trunc('minute', server_timestamp)`;
    if (bucketMin === 5) {
      bucketExpr = `date_trunc('hour', server_timestamp) + (floor(extract(minute from server_timestamp)/5)*5) * interval '1 minute'`;
    } else if (bucketMin === 30) {
      bucketExpr = `date_trunc('hour', server_timestamp) + (floor(extract(minute from server_timestamp)/30)*30) * interval '1 minute'`;
    } else if (bucketMin === 60) {
      bucketExpr = `date_trunc('hour', server_timestamp)`;
    } else if (bucketMin === 360) {
      bucketExpr = `date_trunc('hour', server_timestamp)`;
    } else if (bucketMin >= 1440) {
      bucketExpr = `date_trunc('day', server_timestamp)`;
    }

    const col = pollutant;
    const { rows } = await pool.query(
      `
      SELECT
        (${bucketExpr}) as bucket,
        AVG(${col}) as value
      FROM telemetry_logs
      WHERE server_timestamp >= now() - ($1::int * interval '1 minute')
      ${zoneClause}
      GROUP BY 1
      ORDER BY 1 ASC;
      `,
      params,
    );

    return rows.map(r => ({
      label: new Date(r.bucket).toISOString(),
      value: Number(r.value),
    }));
  }

  async function getHourlyHistory(days: number = 7): Promise<HourlyReading[]> {
    const { rows } = await pool.query(
      `
      SELECT
        date_trunc('hour', server_timestamp) as hour,
        AVG(pm25) as avg_pm25,
        AVG(pm25) * 1.2 as pm10,
        AVG(co2) as co2,
        AVG(no2) as no2,
        AVG(pm25) * 0.4 as dust
      FROM telemetry_logs
      WHERE server_timestamp >= now() - ($1::int * interval '1 day')
      GROUP BY 1
      ORDER BY 1 ASC;
      `,
      [days],
    );
    return rows.map(r => ({
      hourIso: new Date(r.hour).toISOString(),
      avgPm25: Number(r.avg_pm25),
      pm10: Number(r.pm10),
      co2: Number(r.co2),
      no2: Number(r.no2),
      dust: Number(r.dust),
    }));
  }

  async function getSourceData(hours: number = 24): Promise<AttributionReading[]> {
    const { rows } = await pool.query(
      `
      SELECT lat, lng, pm25, no2, humidity, server_timestamp as timestamp
      FROM telemetry_logs
      WHERE server_timestamp >= now() - ($1::int * interval '1 hour')
      ORDER BY server_timestamp ASC;
      `,
      [hours],
    );

    return rows.map(r => ({
      lat: Number(r.lat),
      lng: Number(r.lng),
      pm25: Number(r.pm25),
      no2: Number(r.no2),
      humidity: Number(r.humidity),
      timestamp: new Date(r.timestamp).toISOString(),
    }));
  }

  async function insertMission(m: any) {
    const lat = m.targetCoord?.lat ?? 0;
    const lng = m.targetCoord?.lng ?? 0;
    await pool.query(
      `
      INSERT INTO missions (id, target_id, target_name, lat, lng, resource_type, priority, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO NOTHING;
      `,
      [m.id, m.targetId, m.targetName, lat, lng, m.resourceType, m.priority, m.status],
    );
  }

  async function updateMissionStatus(id: string, status: string, report?: string) {
    await pool.query(
      `UPDATE missions SET status=$1, report=$2, updated_at=now() WHERE id=$3;`,
      [status, report ?? null, id],
    );
    return { ok: true };
  }

  async function getAllMissions(): Promise<MissionRecord[]> {
    const { rows } = await pool.query(
      `SELECT * FROM missions ORDER BY start_time DESC;`,
    );
    return rows as MissionRecord[];
  }

  async function computeSnapshot(): Promise<TelemetrySnapshot> {
    const alertThresholdPm25 = await getAlertThresholdPm25();

    const drones = await getLatest();
    const alerts = await getActiveAlerts(alertThresholdPm25);
    const cityTrend = await getCityTrend();
    const hotspots = await getHotspots();

    const rawPoints = await getRawPointsForHotspot(-5);
    const hotspotClusters = detectHotspots(rawPoints, alertThresholdPm25);

    const trendSeries = await getHistoricalAvg(30);
    const trend = classifyTrend(trendSeries, 30);

    const hourlyHistory = await getHourlyHistory(7);
    const forecast = computeForecast(hourlyHistory, 6);

    const sourceReadings = await getSourceData(24);
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
      missions: await getAllMissions(),
      emittedAt: new Date().toISOString(),
    };
  }

  return {
    insertFleet,
    getLatest,
    getHistory,
    getCityTrend,
    getHotspots,
    getActiveAlerts,

    getAlertThresholdConfig,
    getAlertThresholdPm25,
    setAlertThresholdPm25,

    getRawPointsForHotspot,
    getHistoricalAvg,
    getHistoryByZone,
    getHourlyHistory,
    getSourceData,

    insertMission,
    updateMissionStatus,
    getAllMissions,

    computeSnapshot,
  };
}
