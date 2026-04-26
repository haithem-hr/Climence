import axios from 'axios';
import type { TelemetryPayload } from '@climence/shared';
import { DroneDevice } from './DroneDevice';

interface ActiveAlertRecord {
  lat: number;
  lng: number;
  pm25: number;
}

interface HazardZone {
  id: string;
  lat: number;
  lng: number;
  peakPm25: number;
}

interface LoginResponse {
  token: string;
  expiresAt?: string;
}

const AUTH_REFRESH_SKEW_MS = 30_000;
const DEFAULT_ALERT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_MAX_DRONES_PER_HAZARD = 3;

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

export class FleetManager {
  private drones: DroneDevice[] = [];
  private readonly endpoint: string;
  private readonly alertsEndpoint: string;
  private readonly loginEndpoint: string;
  private readonly alertPollIntervalMs: number;
  private readonly maxDronesPerHazard: number;
  private readonly authEmail: string;
  private readonly authPassword: string;

  private authToken: string | null;
  private authTokenExpiresAtMs = 0;
  private cachedHazards: HazardZone[] = [];
  private lastTickMs = Date.now();
  private lastAlertPollMs = 0;
  private lastBaselinePollMs = 0;
  private tickInFlight = false;

  constructor(droneCount: number, endpoint: string) {
    this.endpoint = endpoint;
    const apiOrigin = new URL(endpoint).origin;
    this.alertsEndpoint = `${apiOrigin}/api/alerts/active`;
    this.loginEndpoint = `${apiOrigin}/api/auth/login`;
    this.alertPollIntervalMs = parsePositiveInt(
      process.env.SIMULATOR_ALERT_POLL_MS,
      DEFAULT_ALERT_POLL_INTERVAL_MS,
    );
    this.maxDronesPerHazard = parsePositiveInt(
      process.env.SIMULATOR_MAX_DRONES_PER_HAZARD,
      DEFAULT_MAX_DRONES_PER_HAZARD,
    );
    this.authEmail = process.env.SIMULATOR_AUTH_EMAIL ?? 'analyst@mewa.gov.sa';
    this.authPassword = process.env.SIMULATOR_AUTH_PASSWORD ?? 'Analyst123!';

    this.authToken = process.env.SIMULATOR_AUTH_TOKEN ?? null;
    this.authTokenExpiresAtMs = this.authToken ? Number.POSITIVE_INFINITY : 0;

    for (let i = 0; i < droneCount; i++) {
      this.drones.push(new DroneDevice(i));
    }
  }

  public startSimulation(intervalMs: number) {
    console.log(`Starting fleet simulation with ${this.drones.length} drones.`);
    console.log(
      `Hazard dispatch: polling every ${this.alertPollIntervalMs}ms, max ${this.maxDronesPerHazard} drones per hazard.`,
    );
    void this.tick();
    setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  private async tick() {
    if (this.tickInFlight) {
      console.warn(
        `[${new Date().toISOString()}] Previous simulator tick still running, skipping overlapping cycle.`,
      );
      return;
    }

    this.tickInFlight = true;
    const nowMs = Date.now();
    const elapsedSec = Math.max(0.25, Math.min(10, (nowMs - this.lastTickMs) / 1000));
    this.lastTickMs = nowMs;
    DroneDevice.advanceEnvironment(elapsedSec);

    if (nowMs - this.lastBaselinePollMs > 300_000) {
      this.lastBaselinePollMs = nowMs;
      void this.fetchRealWorldBaseline();
    }

    try {
      await this.refreshHazardsIfDue(nowMs);
      this.reconcileHazardAssignments();
      this.dispatchNearestDrones();

      const payload: TelemetryPayload = {
        fleet: this.drones.map(drone => {
          drone.tick(nowMs);
          return drone.getTelemetry();
        }),
      };

      const token = await this.ensureAuthToken();
      await axios.post(this.endpoint, payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        timeout: 10_000,
      });
      console.log(
        `[${new Date().toISOString()}] Broadcasted telemetry for ${this.drones.length} drones to ${this.endpoint}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${new Date().toISOString()}] Failed simulator tick. Error: ${message}`);
    } finally {
      this.tickInFlight = false;
    }
  }

  private async refreshHazardsIfDue(nowMs: number) {
    if (nowMs - this.lastAlertPollMs < this.alertPollIntervalMs) return;
    this.lastAlertPollMs = nowMs;

    try {
      const records = await this.fetchActiveAlerts();
      this.cachedHazards = this.clusterHazards(records);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${new Date().toISOString()}] Failed to fetch active hazards. Error: ${message}`);
    }
  }

  private async fetchRealWorldBaseline() {
    try {
      const res = await axios.get(
        'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=24.7136&longitude=46.6753&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,dust&timezone=auto',
        { timeout: 10_000 }
      );
      const current = res.data?.current;
      if (current) {
        DroneDevice.globalBaseline.pm25 = current.pm2_5 || 10;
        DroneDevice.globalBaseline.co2 = 400 + ((current.pm2_5 || 10) * 0.5); 
        DroneDevice.globalBaseline.no2 = current.nitrogen_dioxide || 20;
        
        console.log(`[${new Date().toISOString()}] 🌍 Real-world Riyadh AQI baseline synced: PM2.5=${DroneDevice.globalBaseline.pm25.toFixed(1)}, NO2=${DroneDevice.globalBaseline.no2.toFixed(1)}`);
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ⚠️ Failed to fetch live AQI from Open-Meteo:`, err instanceof Error ? err.message : String(err));
    }
  }

  private async fetchActiveAlerts() {
    const token = await this.ensureAuthToken();
    if (!token) return [];

    try {
      const response = await axios.get<ActiveAlertRecord[]>(this.alertsEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10_000,
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        this.authToken = null;
        this.authTokenExpiresAtMs = 0;
        const refreshedToken = await this.ensureAuthToken(true);
        if (!refreshedToken) return [];

        const retry = await axios.get<ActiveAlertRecord[]>(this.alertsEndpoint, {
          headers: { Authorization: `Bearer ${refreshedToken}` },
          timeout: 10_000,
        });
        return Array.isArray(retry.data) ? retry.data : [];
      }
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        console.error(`[sim] fetchActiveAlerts 404. Endpoint: ${this.alertsEndpoint}`);
      }
      throw err;
    }
  }

  private async ensureAuthToken(forceRefresh = false) {
    // --- TEMPORARY AUTH BYPASS REQEUSTED BY USER ---
    return "dev-bypass-token";
    // -----------------------------------------------
    const now = Date.now();
    if (
      !forceRefresh &&
      this.authToken &&
      now + AUTH_REFRESH_SKEW_MS < this.authTokenExpiresAtMs
    ) {
      return this.authToken;
    }

    try {
      const response = await axios.post<LoginResponse>(
        this.loginEndpoint,
        {
          email: this.authEmail,
          password: this.authPassword,
        },
        { timeout: 10_000 },
      );
      this.authToken = response.data.token;
      this.authTokenExpiresAtMs = response.data.expiresAt
        ? new Date(response.data.expiresAt as string).getTime()
        : now + 3600_000;
      return this.authToken;
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Simulator auth failed. Error: ${message}`);
    }
  }

  private clusterHazards(records: ActiveAlertRecord[]) {
    const zones = new Map<
      string,
      { latSum: number; lngSum: number; count: number; peakPm25: number }
    >();

    for (const record of records) {
      if (!Number.isFinite(record.lat) || !Number.isFinite(record.lng) || !Number.isFinite(record.pm25)) {
        continue;
      }

      const zoneLat = Number(record.lat.toFixed(2));
      const zoneLng = Number(record.lng.toFixed(2));
      const zoneId = `${zoneLat}:${zoneLng}`;
      const existing = zones.get(zoneId);

      if (!existing) {
        zones.set(zoneId, {
          latSum: record.lat,
          lngSum: record.lng,
          count: 1,
          peakPm25: record.pm25,
        });
        continue;
      }

      existing.latSum += record.lat;
      existing.lngSum += record.lng;
      existing.count += 1;
      existing.peakPm25 = Math.max(existing.peakPm25, record.pm25);
    }

    return Array.from(zones.entries())
      .map(([id, zone]) => ({
        id,
        lat: zone.latSum / zone.count,
        lng: zone.lngSum / zone.count,
        peakPm25: zone.peakPm25,
      }))
      .sort((a, b) => b.peakPm25 - a.peakPm25);
  }

  private reconcileHazardAssignments() {
    const activeHazardIds = new Set(this.cachedHazards.map(hazard => hazard.id));
    for (const drone of this.drones) {
      drone.clearHazardAssignmentIfInactive(activeHazardIds);
    }
  }

  private dispatchNearestDrones() {
    if (this.cachedHazards.length === 0) return;

    const reservedDroneIds = new Set<string>();
    let newlyAssigned = 0;

    for (const hazard of this.cachedHazards) {
      const ranked = this.drones
        .filter(
          drone =>
            !reservedDroneIds.has(drone.uuid) &&
            (drone.isHandlingHazard(hazard.id) || drone.canAcceptHazard()),
        )
        .sort((a, b) => {
          const aHandling = a.isHandlingHazard(hazard.id) ? 0 : 1;
          const bHandling = b.isHandlingHazard(hazard.id) ? 0 : 1;
          if (aHandling !== bHandling) return aHandling - bHandling;
          return a.distanceKmTo(hazard.lat, hazard.lng) - b.distanceKmTo(hazard.lat, hazard.lng);
        });

      let assignedForHazard = 0;
      for (const drone of ranked) {
        if (assignedForHazard >= this.maxDronesPerHazard) break;

        const alreadyHandling = drone.isHandlingHazard(hazard.id);
        const assigned =
          alreadyHandling || drone.assignHazardTarget(hazard.id, hazard.lat, hazard.lng);
        if (!assigned) continue;

        reservedDroneIds.add(drone.uuid);
        assignedForHazard += 1;
        if (!alreadyHandling) newlyAssigned += 1;
      }
    }

    if (newlyAssigned > 0) {
      console.log(
        `[${new Date().toISOString()}] Dispatched ${newlyAssigned} drones across ${this.cachedHazards.length} active hazard zones.`,
      );
    }
  }
}
