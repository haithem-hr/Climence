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
  co2: number;
  no2: number;
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
  co2: number;
  no2: number;
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
