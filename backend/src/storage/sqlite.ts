import type {
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
import {
  computeSnapshot,
  getActiveAlerts,
  getAlertThresholdConfig,
  getAlertThresholdPm25,
  createAlertRule,
  deleteAlertRule,
  evaluateAlerts,
  getAlertEvents,
  getAllMissions,
  getCityTrend,
  getHistoricalAvg,
  getHistory,
  getHistoryByZone,
  getHotspots,
  getHourlyHistory,
  getLatest,
  listAlertRules,
  getRawPointsForHotspot,
  getSourceData,
  insertFleet,
  insertMission,
  setAlertThresholdPm25,
  updateAlertRule,
  updateMissionStatus,
  listScheduledReports,
  createScheduledReport,
  deleteScheduledReport,
  getDueSchedules,
  markScheduleRun,
} from '../db/queries.js';
import type { HistoryPoint, MissionRecord, Storage } from './index.js';

export const sqliteStorage: Storage = {
  insertFleet,
  getLatest,
  getHistory,
  getCityTrend,
  getHotspots,
  getActiveAlerts,

  getAlertThresholdConfig,
  getAlertThresholdPm25,
  setAlertThresholdPm25,
  listAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  getAlertEvents,
  evaluateAlerts,

  getRawPointsForHotspot,
  getHistoricalAvg,
  getHistoryByZone: getHistoryByZone as (
    pollutant: 'pm25' | 'pm10' | 'co2' | 'no2' | 'o3' | 'so2' | 'co',
    range: string,
    centerLat?: number,
    centerLng?: number,
    radiusKm?: number,
  ) => HistoryPoint[],
  getHourlyHistory,
  getSourceData,

  insertMission,
  updateMissionStatus,
  getAllMissions: getAllMissions as () => MissionRecord[],

  listScheduledReports,
  createScheduledReport,
  deleteScheduledReport,
  getDueSchedules,
  markScheduleRun,

  computeSnapshot: computeSnapshot as () => TelemetrySnapshot,
};

// Type-only re-exports to keep downstream imports clean if needed.
export type {
  TelemetryInput,
  TelemetryRecord,
  CityTrendPoint,
  Hotspot,
  AlertThresholdConfig,
  RawPoint,
  TrendPoint,
  HourlyReading,
  AttributionReading,
};
