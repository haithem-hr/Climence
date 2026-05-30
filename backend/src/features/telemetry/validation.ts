import type { TelemetryInput, TelemetryPayload } from '@climence/shared';

export type TelemetryValidation =
  | { ok: true; payload: TelemetryPayload }
  | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTelemetryInput(value: unknown): value is TelemetryInput {
  if (!isObject(value)) return false;
  if (typeof value.uuid !== 'string' || value.uuid.length === 0) return false;
  if (typeof value.state !== 'string' || value.state.length === 0) return false;
  if (!isFiniteNumber(value.batteryLevel)) return false;
  if (!isFiniteNumber(value.rssi)) return false;
  if (typeof value.timestamp !== 'string' || value.timestamp.length === 0) return false;

  if (!isObject(value.location)) return false;
  if (!isFiniteNumber(value.location.lat) || !isFiniteNumber(value.location.lng)) return false;

  if (!isObject(value.airQuality)) return false;
  if (!isFiniteNumber(value.airQuality.pm25)) return false;
  if (!isFiniteNumber(value.airQuality.co2)) return false;
  if (!isFiniteNumber(value.airQuality.no2)) return false;
  if ('pm10' in value.airQuality && value.airQuality.pm10 !== undefined && value.airQuality.pm10 !== null && !isFiniteNumber(value.airQuality.pm10)) return false;
  if ('o3' in value.airQuality && value.airQuality.o3 !== undefined && value.airQuality.o3 !== null && !isFiniteNumber(value.airQuality.o3)) return false;
  if ('so2' in value.airQuality && value.airQuality.so2 !== undefined && value.airQuality.so2 !== null && !isFiniteNumber(value.airQuality.so2)) return false;
  if ('co' in value.airQuality && value.airQuality.co !== undefined && value.airQuality.co !== null && !isFiniteNumber(value.airQuality.co)) return false;
  if (!isFiniteNumber(value.airQuality.temperature)) return false;
  if (!isFiniteNumber(value.airQuality.humidity)) return false;

  return true;
}

export function validateTelemetryPayload(input: unknown): TelemetryValidation {
  if (!isObject(input)) {
    return { ok: false, error: 'Invalid payload. Expected an object body.' };
  }

  const fleet = input.fleet;
  if (!Array.isArray(fleet)) {
    return { ok: false, error: 'Invalid payload. Expected { fleet: [...] }' };
  }

  if (!fleet.every(isTelemetryInput)) {
    return { ok: false, error: 'Invalid payload. One or more fleet items have invalid telemetry shape.' };
  }

  return { ok: true, payload: { fleet } };
}
