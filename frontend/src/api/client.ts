import { type LoginRequest, type LoginResponse, type TelemetryRecord } from '@climence/shared';
import { API_BASE_URL } from '../lib/runtime-config';

export class ApiError extends Error {
  readonly status?: number;
  readonly retryAfterSec?: number;

  constructor(
    message: string,
    status?: number,
    retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

function withAuth(token?: string) {
  return token ? ({ Authorization: `Bearer ${token}` } as Record<string, string>) : {};
}

// History is fetched on-demand when a drone is selected; everything else
// arrives over the WebSocket snapshot stream.
export async function fetchHistory(droneId: string, token?: string): Promise<TelemetryRecord[]> {
  const res = await fetch(`${API_BASE_URL}/api/telemetry/history/${droneId}`, {
    headers: withAuth(token),
  });
  if (!res.ok) throw new Error(`GET history failed: ${res.status}`);
  return res.json() as Promise<TelemetryRecord[]>;
}

export async function fetchHistoryByZone(
  pollutant: string,
  range: string,
  lat?: number,
  lng?: number,
  radiusKm?: number,
  token?: string
): Promise<{ label: string; value: number }[]> {
  const params = new URLSearchParams({ pollutant, range });
  if (lat !== undefined && lng !== undefined && radiusKm !== undefined) {
    params.set('zone', `${lat},${lng},${radiusKm}`);
  }
  const res = await fetch(`${API_BASE_URL}/api/analytics/history?${params.toString()}`, {
    headers: withAuth(token),
  });
  if (!res.ok) throw new Error(`GET history by zone failed: ${res.status}`);
  return res.json() as Promise<{ label: string; value: number }[]>;
}

export interface OpenMeteoHistoryPoint {
  label: string;
  pm25: number;
  pm10: number;
  co2: number;
  no2: number;
  dust: number;
}

export async function fetchOpenMeteoHistory(
  range: string,
  token?: string
): Promise<OpenMeteoHistoryPoint[]> {
  const params = new URLSearchParams({ range });
  const res = await fetch(`${API_BASE_URL}/api/analytics/openmeteo-history?${params.toString()}`, {
    headers: withAuth(token),
  });
  if (!res.ok) throw new Error(`GET openmeteo-history failed: ${res.status}`);
  return res.json() as Promise<OpenMeteoHistoryPoint[]>;
}

export async function fetchForecast(hours: number, token?: string) {
  const res = await fetch(`${API_BASE_URL}/api/analytics/forecast?hours=${hours}`, {
    headers: withAuth(token),
  });
  if (!res.ok) throw new Error(`GET forecast failed: ${res.status}`);
  return res.json();
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `Login failed (${res.status})`;
    let retryAfterSec: number | undefined;

    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) {
      const parsed = Number(retryAfter);
      if (Number.isFinite(parsed) && parsed > 0) retryAfterSec = parsed;
    }

    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body?.message === 'string' && body.message.trim()) {
        message = body.message;
      }
    } catch {
      // Non-JSON response; keep the status-based fallback message.
    }

    throw new ApiError(message, res.status, retryAfterSec);
  }

  return res.json() as Promise<LoginResponse>;
}

export interface AlertConfigResponse {
  pm25Threshold: number;
  updatedAt: string;
}

export async function fetchAlertConfig(token: string): Promise<AlertConfigResponse> {
  const res = await fetch(`${API_BASE_URL}/api/alerts/config`, {
    headers: withAuth(token),
  });
  if (!res.ok) throw new Error(`GET alert config failed: ${res.status}`);
  return res.json() as Promise<AlertConfigResponse>;
}

export async function updateAlertConfig(pm25Threshold: number, token: string): Promise<AlertConfigResponse> {
  const res = await fetch(`${API_BASE_URL}/api/alerts/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify({ pm25Threshold }),
  });

  if (!res.ok) throw new Error(`PUT alert config failed: ${res.status}`);
  return res.json() as Promise<AlertConfigResponse>;
}

export async function createMission(mission: unknown, token: string) {
  const res = await fetch(`${API_BASE_URL}/api/missions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(mission),
  });
  if (!res.ok) throw new Error(`POST mission failed: ${res.status}`);
  return res.json();
}

export async function updateMission(id: string, payload: { status: string; report?: string }, token: string) {
  const res = await fetch(`${API_BASE_URL}/api/missions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PATCH mission failed: ${res.status}`);
  return res.json();
}
