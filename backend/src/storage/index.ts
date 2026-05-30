import type {
  AlertEvent,
  AlertEventStatus,
  AlertRule,
  AlertRuleInput,
  AlertThresholdConfig,
  CityTrendPoint,
  Hotspot,
  TelemetryInput,
  TelemetryRecord,
  TelemetrySnapshot,
} from '@climence/shared';
import type { RawPoint } from '../features/analytics/hotspots.js';
import type { TrendPoint } from '../features/analytics/trend.js';
import type { HourlyReading } from '../features/analytics/forecast.js';
import type { AttributionReading } from '../features/analytics/sources.js';

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

export interface HistoryPoint {
  label: string;
  value: number;
}

export interface Storage {
  // Telemetry writes
  insertFleet(drones: TelemetryInput[]): void | Promise<void>;

  // Telemetry reads
  getLatest(): TelemetryRecord[] | Promise<TelemetryRecord[]>;
  getHistory(droneId: string): TelemetryRecord[] | Promise<TelemetryRecord[]>;
  getCityTrend(): CityTrendPoint[] | Promise<CityTrendPoint[]>;
  getHotspots(): Hotspot[] | Promise<Hotspot[]>;
  getActiveAlerts(pm25Threshold: number): TelemetryRecord[] | Promise<TelemetryRecord[]>;

  // Alert config
  getAlertThresholdConfig(): AlertThresholdConfig | Promise<AlertThresholdConfig>;
  getAlertThresholdPm25(): number | Promise<number>;
  setAlertThresholdPm25(pm25Threshold: number): AlertThresholdConfig | Promise<AlertThresholdConfig>;
  listAlertRules(userId?: number): AlertRule[] | Promise<AlertRule[]>;
  createAlertRule(userId: number, input: AlertRuleInput): AlertRule | Promise<AlertRule>;
  updateAlertRule(ruleId: number, userId: number, input: Partial<AlertRuleInput>): AlertRule | null | Promise<AlertRule | null>;
  deleteAlertRule(ruleId: number, userId: number): boolean | Promise<boolean>;
  getAlertEvents(status?: AlertEventStatus, limit?: number): AlertEvent[] | Promise<AlertEvent[]>;
  evaluateAlerts(drones: TelemetryInput[]): void | Promise<void>;

  // Analytics primitives
  getRawPointsForHotspot(windowMinutes?: number): RawPoint[] | Promise<RawPoint[]>;
  getHistoricalAvg(windowMinutes: number): TrendPoint[] | Promise<TrendPoint[]>;
  getHistoryByZone(
    pollutant: 'pm25' | 'pm10' | 'co2' | 'no2' | 'o3' | 'so2' | 'co',
    range: string,
    centerLat?: number,
    centerLng?: number,
    radiusKm?: number,
  ): HistoryPoint[] | Promise<HistoryPoint[]>;
  getHourlyHistory(days?: number): HourlyReading[] | Promise<HourlyReading[]>;
  getSourceData(hours?: number): AttributionReading[] | Promise<AttributionReading[]>;

  // Missions
  insertMission(m: any): void | Promise<void>;
  updateMissionStatus(id: string, status: string, report?: string): unknown | Promise<unknown>;
  getAllMissions(): MissionRecord[] | Promise<MissionRecord[]>;

  // Snapshot
  computeSnapshot(): TelemetrySnapshot | Promise<TelemetrySnapshot>;
}
