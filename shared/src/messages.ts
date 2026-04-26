import type {
  CityTrendPoint,
  ForecastPoint,
  Hotspot,
  HotspotCluster,
  SourceAttribution,
  TelemetryRecord,
  TrendSignal,
} from './telemetry';

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
  emittedAt: string;
}

export type ServerMessage = { type: 'snapshot'; data: TelemetrySnapshot };

export const WS_PATH = '/ws/telemetry';
