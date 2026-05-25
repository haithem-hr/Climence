import type { TelemetryPayload } from '@climence/shared';
import { DroneDevice } from './DroneDevice';
import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

const CSV_FILE = path.join(process.cwd(), '../data/fleet_flight_paths.csv');

export class FleetManager {
  private drones: DroneDevice[] = [];
<<<<<<< Updated upstream
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
  private tickInFlight = false;
=======
  private mqttClient: mqtt.MqttClient;
  private flightData: Map<number, any[]> = new Map();
  private tickIndices: Map<number, number> = new Map();
>>>>>>> Stashed changes

  constructor(droneCount: number, endpoint: string) {
    for (let i = 0; i < droneCount; i++) {
      this.drones.push(new DroneDevice(i));
      this.flightData.set(i, []);
      this.tickIndices.set(i, 0);
    }

    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    this.mqttClient = mqtt.connect(brokerUrl, {
      username: 'drone',
      password: 'flight123',
      clientId: `SIM-FLEET-${Math.floor(Math.random() * 1000)}`,
      clean: true,
      connectTimeout: 4000,
    });

    this.mqttClient.on('connect', () => {
      console.log(`✅ FleetManager edge gateway connected to MQTT broker at ${brokerUrl}`);
    });

    this.mqttClient.on('error', (err) => {
      console.error(`❌ MQTT Gateway Error:`, err.message);
    });
  }

  public async startSimulation(intervalMs: number) {
    console.log(`Starting CSV fleet simulation with ${this.drones.length} drones.`);
    console.log(`📂 Loading flight data from ${CSV_FILE}...`);
    
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(CSV_FILE)
        .pipe(csv())
        .on('data', (row) => {
          const droneId = parseInt(row.droneId, 10);
          if (this.flightData.has(droneId)) {
            this.flightData.get(droneId)!.push(row);
          }
        })
        .on('end', () => resolve())
        .on('error', reject);
    });

    console.log(`📊 Loaded CSV data for all 25 drones. Starting playback loop.`);

    this.tick();
    setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  private tick() {
    const payload: TelemetryPayload = { fleet: [] };

<<<<<<< Updated upstream
    this.tickInFlight = true;
    const nowMs = Date.now();
    const elapsedSec = Math.max(0.25, Math.min(10, (nowMs - this.lastTickMs) / 1000));
    this.lastTickMs = nowMs;
    DroneDevice.advanceEnvironment(elapsedSec);

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

  private async fetchActiveAlerts() {
    const token = await this.ensureAuthToken();
    if (!token) return [];

    try {
      const response = await axios.get<ActiveAlertRecord[]>(this.alertsEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10_000,
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
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
      throw err;
    }
  }

  private async ensureAuthToken(forceRefresh = false) {
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
        ? new Date(response.data.expiresAt).getTime()
        : now + 30 * 60 * 1000;
      return this.authToken;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${new Date().toISOString()}] Simulator auth failed. Error: ${message}`);
      return null;
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
=======
    for (let i = 0; i < this.drones.length; i++) {
      const drone = this.drones[i];
      const data = this.flightData.get(i);
      let idx = this.tickIndices.get(i)!;
      
      if (data && data.length > 0) {
        if (idx >= data.length) idx = 0; // Loop back when reaching the end of the CSV chunk
        
        const row = data[idx];
        drone.feedCsvRow(row);
        this.tickIndices.set(i, idx + 1);
      }
      
      payload.fleet.push(drone.getTelemetry());
    }

    this.mqttClient.publish('climence/telemetry', JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error(`[${new Date().toISOString()}] Failed to publish MQTT telemetry. Error: ${err.message}`);
      } else {
        console.log(
          `[${new Date().toISOString()}] Broadcasted CSV telemetry for ${this.drones.length} drones to MQTT broker`,
        );
      }
    });
>>>>>>> Stashed changes
  }
}
