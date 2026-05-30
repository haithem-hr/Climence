export const DroneState = {
  IDLE: 'IDLE',
  EN_ROUTE: 'EN_ROUTE',
  GATHERING_DATA: 'GATHERING_DATA',
  INVESTIGATING_HAZARD: 'INVESTIGATING_HAZARD',
  LOW_BATTERY: 'LOW_BATTERY',
  OFFLINE: 'OFFLINE',
} as const;

export type DroneState = (typeof DroneState)[keyof typeof DroneState];

export interface AirQuality {
  pm25: number;
  pm10?: number;
  co2: number;
  no2: number;
  o3?: number;
  so2?: number;
  co?: number;
  temperature: number;
  humidity: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

// Shape the simulator POSTs to /api/telemetry
export interface TelemetryInput {
  uuid: string;
  state: DroneState;
  batteryLevel: number;
  rssi: number;
  location: LatLng;
  airQuality: AirQuality;
  timestamp: string;
}

export interface TelemetryPayload {
  fleet: TelemetryInput[];
}

// Flat DB row shape returned by GET endpoints
export interface TelemetryRecord {
  id: number;
  uuid: string;
  state: DroneState;
  batteryLevel: number;
  lat: number;
  lng: number;
  pm25: number;
  pm10?: number | null;
  co2: number;
  no2: number;
  o3?: number | null;
  so2?: number | null;
  co?: number | null;
  temperature: number;
  humidity: number;
  rssi: number;
  client_timestamp: string;
  server_timestamp: string;
}

export interface CityTrendPoint {
  minute_label: string;
  avg_pm25: number;
  avg_co2: number;
  avg_no2?: number;
}

export interface Hotspot {
  lat_zone: number;
  lng_zone: number;
  avg_pm25: number;
}

/** DBSCAN-lite cluster returned by the hotspot detection algorithm (P0) */
export interface HotspotCluster {
  centroidLat: number;
  centroidLng: number;
  radiusKm: number;
  peakPm25: number;
  dominantPollutant?: 'PM2.5' | 'PM10' | 'NO2' | 'O3';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  memberUuids: string[];
  score: number; // normalised 0-1 severity
}

/** Server-side trend signal (P1) */
export interface TrendSignal {
  slope: number; // µg/m³ per minute
  direction: 'worsening' | 'stable' | 'improving';
  confidence: number; // R² of the regression, 0-1
  windowMinutes: number;
}

/** One forecast hour (P3) */
export interface ForecastPoint {
  hourIso: string;
  aqi: number;
  pm25: number;
  pm10: number;
  co2: number;
  no2: number;
  dust: number;
  band: string; // AqiBandKey
  confidence: number; // 0-1
}

/** Rule-based pollution source entry (P4) */
export interface SourceAttribution {
  key: string; // 'traffic' | 'industry' | 'dust' | 'other'
  name: string;
  pct: number; // 0-100
  confidence: number;
  drivers: string[];
}

export interface AlertThresholdConfig {
  pm25_threshold: number;
  updated_at: string;
}

export type AlertPollutantType = 'pm25' | 'pm10' | 'no2' | 'o3' | 'so2' | 'co';
export type AlertConditionOperator = '>' | '>=' | '<' | '<=';
export type AlertEventStatus = 'active' | 'cleared';

export interface AlertRule {
  rule_id: number;
  user_id: number | null;
  pollutant_type: AlertPollutantType;
  threshold_value: number;
  condition_operator: AlertConditionOperator;
  notification_channel: string;
  is_active: boolean;
  created_at: string;
}

export interface AlertRuleInput {
  pollutant_type: AlertPollutantType;
  threshold_value: number;
  condition_operator?: AlertConditionOperator;
  notification_channel?: string;
  is_active?: boolean;
}

export interface AlertEvent {
  event_id: number;
  rule_id: number;
  triggered_at: string;
  cleared_at: string | null;
  peak_value: number;
  status: AlertEventStatus;
  pollutant_type?: AlertPollutantType;
  threshold_value?: number;
  condition_operator?: AlertConditionOperator;
  notification_channel?: string;
}
