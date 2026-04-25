export const RIYADH_BOUNDS = {
  minLat: 24.5,
  maxLat: 24.9,
  minLng: 46.5,
  maxLng: 46.9,
} as const;

export const RIYADH_CENTER = { lat: 24.7136, lng: 46.6753 } as const;

export interface PollutionHotspot {
  lat: number;
  lng: number;
  peakPm25: number;
  peakCo2: number;
}

export const ENVIRONMENT_MAP: readonly PollutionHotspot[] = [
  { lat: 24.55, lng: 46.75, peakPm25: 180, peakCo2: 800 }, // Industrial Zone
  { lat: 24.68, lng: 46.68, peakPm25: 150, peakCo2: 680 }, // Central Traffic Core
  { lat: 24.80, lng: 46.60, peakPm25: 120, peakCo2: 560 }, // North Development
  { lat: 24.72, lng: 46.84, peakPm25: 165, peakCo2: 720 }, // East Logistics Belt
  { lat: 24.60, lng: 46.58, peakPm25: 140, peakCo2: 620 }, // West Construction Arc
];

export const PM25_ALERT_THRESHOLD = 140;
export const DRONE_FLEET_SIZE = 25;
export const TELEMETRY_INTERVAL_MS = 5000;
export const API_PORT = 3002;
export const WS_PORT = API_PORT;
export const API_BASE_URL = `http://localhost:${API_PORT}`;
export const WS_BASE_URL = `ws://localhost:${WS_PORT}`;

export const DEFAULT_PM25_THRESHOLD = 50.0;
