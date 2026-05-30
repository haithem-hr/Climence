import type {
  AlertEvent,
  AlertRule,
  CityTrendPoint,
  ForecastPoint,
  Hotspot,
  HotspotCluster,
  SourceAttribution,
  TelemetryRecord,
  TrendSignal,
} from './telemetry';

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

// Single snapshot of everything the dashboard renders.
// Server sends one on connect, then one per simulator tick.
// Analytics fields (trend, forecast, hotspotClusters, sources) are optional
// so old clients stay compatible during rollout.
export interface TelemetrySnapshot {
  drones: TelemetryRecord[];
  alerts: TelemetryRecord[];
  cityTrend: CityTrendPoint[];
  hotspots: Hotspot[];                    // legacy grid-bucket dots (kept for compat)
  hotspotClusters?: HotspotCluster[];     // P0 — DBSCAN-lite clusters with radius
  trend?: TrendSignal;                    // P1 — server-side slope classification
  forecast?: ForecastPoint[];             // P3 — next N hours AQI prediction
  sources?: SourceAttribution[];          // P4 — rule-based source breakdown
  alertThresholdPm25: number;
  alertRules?: AlertRule[];
  alertEvents?: AlertEvent[];
  clearedAlertEvents?: AlertEvent[];
  missions?: MissionRecord[];
  emittedAt: string;
}

export type ServerMessage = { type: 'snapshot'; data: TelemetrySnapshot };

export const WS_PATH = '/ws/telemetry';
