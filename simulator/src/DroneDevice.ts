import {
  DroneState,
  ENVIRONMENT_MAP,
  RIYADH_BOUNDS,
  type PollutionHotspot,
  type TelemetryInput,
} from '@climence/shared';
import { haversineKm } from './domain/geo';

interface RuntimeHotspot extends PollutionHotspot {
  baselinePm25: number;
  baselineCo2: number;
}

interface HazardTarget {
  id: string;
  lat: number;
  lng: number;
  assignedAt: number;
}

const SCRUBBER_DURATION_MS = 30_000;
const PATROL_GATHERING_MS = 12_000;
const LOW_BATTERY_THRESHOLD = 14;
const LOW_BATTERY_RECOVER_TO = 95;
const MOVE_SPEED_DEG_PER_SEC = 0.001;
const SCRUBBER_RADIUS_KM = 5;
const HOTSPOT_REGEN_PM25_PER_SEC = 0.25;
const HOTSPOT_REGEN_CO2_PER_SEC = 1.4;
const MIN_PM25_FLOOR = 8;
const MIN_CO2_FLOOR = 380;
const MAX_TICK_SECONDS = 10;
const MIN_TICK_SECONDS = 0.25;

const runtimeEnvironment: RuntimeHotspot[] = ENVIRONMENT_MAP.map(spot => ({
  ...spot,
  baselinePm25: spot.peakPm25,
  baselineCo2: spot.peakCo2,
}));

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export class DroneDevice {
  public static globalBaseline = {
    pm25: 10,
    co2: 400,
    no2: 20
  };

  public readonly uuid: string;
  public state: DroneState = DroneState.IDLE;
  public batteryLevel = 100;

  private currentLat: number;
  private currentLng: number;
  private targetLat: number;
  private targetLng: number;
  private hazardTarget: HazardTarget | null = null;
  private gatheringUntilMs = 0;
  private investigatingUntilMs = 0;
  private lastTickMs = Date.now();
  private rngState: number;

  constructor(idIndex: number) {
    this.uuid = `DRONE-UNIT-${idIndex.toString().padStart(3, '0')}`;
    this.rngState = (idIndex + 1) * 2654435761;
    this.currentLat = this.randomInRange(RIYADH_BOUNDS.minLat, RIYADH_BOUNDS.maxLat);
    this.currentLng = this.randomInRange(RIYADH_BOUNDS.minLng, RIYADH_BOUNDS.maxLng);
    this.targetLat = this.currentLat;
    this.targetLng = this.currentLng;
    this.setNewPatrolTarget();
  }

  public static advanceEnvironment(elapsedSec: number) {
    if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) return;

    for (const spot of runtimeEnvironment) {
      spot.peakPm25 = Math.min(
        spot.baselinePm25,
        spot.peakPm25 + HOTSPOT_REGEN_PM25_PER_SEC * elapsedSec,
      );
      spot.peakCo2 = Math.min(
        spot.baselineCo2,
        spot.peakCo2 + HOTSPOT_REGEN_CO2_PER_SEC * elapsedSec,
      );
    }
  }

  public static resetEnvironment() {
    for (const spot of runtimeEnvironment) {
      spot.peakPm25 = spot.baselinePm25;
      spot.peakCo2 = spot.baselineCo2;
    }
  }

  public static getEnvironmentSnapshot(): PollutionHotspot[] {
    return runtimeEnvironment.map(spot => ({
      lat: spot.lat,
      lng: spot.lng,
      peakPm25: spot.peakPm25,
      peakCo2: spot.peakCo2,
    }));
  }

  public tick(nowMs = Date.now()) {
    if (this.state === DroneState.OFFLINE) return;

    const elapsedSec = clamp((nowMs - this.lastTickMs) / 1000, MIN_TICK_SECONDS, MAX_TICK_SECONDS);
    this.lastTickMs = nowMs;

    if (this.state === DroneState.LOW_BATTERY) {
      this.recharge(elapsedSec);
      return;
    }

    this.consumeBattery(elapsedSec);
    if (this.batteryLevel <= LOW_BATTERY_THRESHOLD) {
      this.enterLowBatteryMode();
      return;
    }

    if (this.state === DroneState.INVESTIGATING_HAZARD) {
      this.applyScrubberEffect(elapsedSec);
      if (nowMs >= this.investigatingUntilMs) {
        this.finishHazardInvestigation();
      }
      return;
    }

    if (this.state === DroneState.GATHERING_DATA && nowMs < this.gatheringUntilMs) {
      return;
    }

    if (this.state === DroneState.GATHERING_DATA && nowMs >= this.gatheringUntilMs) {
      if (this.hazardTarget) {
        this.routeToHazard(this.hazardTarget);
      } else {
        this.setNewPatrolTarget();
      }
    }

    const arrived = this.moveTowardTarget(elapsedSec);
    if (!arrived) {
      this.state = DroneState.EN_ROUTE;
      return;
    }

    if (this.hazardTarget) {
      this.state = DroneState.INVESTIGATING_HAZARD;
      this.investigatingUntilMs = nowMs + SCRUBBER_DURATION_MS;
      return;
    }

    this.state = DroneState.GATHERING_DATA;
    this.gatheringUntilMs = nowMs + PATROL_GATHERING_MS + Math.floor(this.nextRandom() * 3000);
  }

  public canAcceptHazard() {
    if (this.state === DroneState.OFFLINE) return false;
    if (this.state === DroneState.LOW_BATTERY) return false;
    if (this.state === DroneState.INVESTIGATING_HAZARD) return false;
    return this.hazardTarget === null;
  }

  public isHandlingHazard(hazardId: string) {
    return this.hazardTarget?.id === hazardId;
  }

  public assignHazardTarget(hazardId: string, lat: number, lng: number) {
    if (this.state === DroneState.OFFLINE || this.state === DroneState.LOW_BATTERY) {
      return false;
    }

    if (this.hazardTarget?.id === hazardId) {
      this.routeToHazard(this.hazardTarget);
      return true;
    }

    if (this.state === DroneState.INVESTIGATING_HAZARD) {
      return false;
    }

    const target: HazardTarget = {
      id: hazardId,
      lat: clamp(lat, RIYADH_BOUNDS.minLat, RIYADH_BOUNDS.maxLat),
      lng: clamp(lng, RIYADH_BOUNDS.minLng, RIYADH_BOUNDS.maxLng),
      assignedAt: Date.now(),
    };
    this.hazardTarget = target;
    this.gatheringUntilMs = 0;
    this.investigatingUntilMs = 0;
    this.routeToHazard(target);
    return true;
  }

  public clearHazardAssignmentIfInactive(activeHazardIds: Set<string>) {
    const target = this.hazardTarget;
    if (!target) return;
    if (activeHazardIds.has(target.id)) return;
    if (this.state === DroneState.INVESTIGATING_HAZARD) return;

    this.hazardTarget = null;
    this.setNewPatrolTarget();
  }

  public distanceKmTo(lat: number, lng: number) {
    return haversineKm(this.currentLat, this.currentLng, lat, lng);
  }

  public getTelemetry(): TelemetryInput {
    const spatialData = this.calculateSpatialAQI();
    const hourFraction = (Date.now() % 86_400_000) / 86_400_000;
    const baseTemp = 33 + Math.sin(hourFraction * Math.PI * 2) * 7;
    const baseHumidity = 34 - Math.sin(hourFraction * Math.PI * 2) * 9;
    const signalJitter = (this.nextRandom() - 0.5) * 12;

    return {
      uuid: this.uuid,
      state: this.state,
      batteryLevel: Number(this.batteryLevel.toFixed(2)),
      rssi: Math.round(clamp(-42 - (100 - this.batteryLevel) * 0.35 + signalJitter, -90, -35)),
      location: {
        lat: Number(this.currentLat.toFixed(5)),
        lng: Number(this.currentLng.toFixed(5)),
      },
      airQuality: {
        pm25: Number(spatialData.pm25.toFixed(2)),
        co2: Number(spatialData.co2.toFixed(2)),
        no2: Number((DroneDevice.globalBaseline.no2 + spatialData.pm25 * 0.02 + this.nextRandom() * 2).toFixed(2)),
        temperature: Number((baseTemp + (this.nextRandom() - 0.5) * 2).toFixed(2)),
        humidity: Number(clamp(baseHumidity + (this.nextRandom() - 0.5) * 6, 10, 80).toFixed(2)),
      },
      timestamp: new Date().toISOString(),
    };
  }

  private nextRandom() {
    this.rngState = (1664525 * this.rngState + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }

  private randomInRange(min: number, max: number) {
    return min + (max - min) * this.nextRandom();
  }

  private setNewPatrolTarget() {
    this.targetLat = this.randomInRange(RIYADH_BOUNDS.minLat, RIYADH_BOUNDS.maxLat);
    this.targetLng = this.randomInRange(RIYADH_BOUNDS.minLng, RIYADH_BOUNDS.maxLng);
    if (this.state !== DroneState.LOW_BATTERY && this.state !== DroneState.OFFLINE) {
      this.state = DroneState.EN_ROUTE;
    }
  }

  private routeToHazard(target: HazardTarget) {
    this.targetLat = target.lat;
    this.targetLng = target.lng;
    this.state = DroneState.EN_ROUTE;
  }

  private moveTowardTarget(elapsedSec: number) {
    const step = MOVE_SPEED_DEG_PER_SEC * elapsedSec;
    const latDiff = this.targetLat - this.currentLat;
    const lngDiff = this.targetLng - this.currentLng;
    const distance = Math.hypot(latDiff, lngDiff);
    if (distance <= step) {
      this.currentLat = this.targetLat;
      this.currentLng = this.targetLng;
      return true;
    }

    this.currentLat += (latDiff / distance) * step;
    this.currentLng += (lngDiff / distance) * step;
    return false;
  }

  private consumeBattery(elapsedSec: number) {
    let drainPerSec = 0.1;
    if (this.state === DroneState.EN_ROUTE) drainPerSec = 0.48;
    if (this.state === DroneState.GATHERING_DATA) drainPerSec = 0.22;
    if (this.state === DroneState.INVESTIGATING_HAZARD) drainPerSec = 0.62;
    this.batteryLevel = clamp(this.batteryLevel - drainPerSec * elapsedSec, 0, 100);
  }

  private recharge(elapsedSec: number) {
    this.batteryLevel = clamp(this.batteryLevel + 18 * elapsedSec, 0, 100);
    if (this.batteryLevel >= LOW_BATTERY_RECOVER_TO) {
      this.batteryLevel = 100;
      this.setNewPatrolTarget();
    }
  }

  private enterLowBatteryMode() {
    this.state = DroneState.LOW_BATTERY;
    this.hazardTarget = null;
    this.investigatingUntilMs = 0;
    this.gatheringUntilMs = 0;
    this.targetLat = this.currentLat;
    this.targetLng = this.currentLng;
  }

  private finishHazardInvestigation() {
    this.hazardTarget = null;
    this.investigatingUntilMs = 0;
    this.setNewPatrolTarget();
  }

  // Inverse Distance Weighting for spatial AQI calibration
  private calculateSpatialAQI() {
    let weightedPm25 = 0;
    let weightedCo2 = 0;
    let totalWeight = 0;

    for (const spot of runtimeEnvironment) {
      const distanceKm = haversineKm(this.currentLat, this.currentLng, spot.lat, spot.lng);
      const safeDistance = Math.max(distanceKm, 0.5);
      const weight = 1 / Math.pow(safeDistance, 2);
      weightedPm25 += spot.peakPm25 * weight;
      weightedCo2 += spot.peakCo2 * weight;
      totalWeight += weight;
    }

    const ambientWeight = 1 / Math.pow(20, 2);
    weightedPm25 += DroneDevice.globalBaseline.pm25 * ambientWeight;
    weightedCo2 += DroneDevice.globalBaseline.co2 * ambientWeight;
    totalWeight += ambientWeight;

    return {
      pm25: weightedPm25 / totalWeight,
      co2: weightedCo2 / totalWeight,
    };
  }

  private applyScrubberEffect(elapsedSec: number) {
    for (const spot of runtimeEnvironment) {
      const distanceKm = haversineKm(this.currentLat, this.currentLng, spot.lat, spot.lng);
      if (distanceKm > SCRUBBER_RADIUS_KM) continue;

      const influence = 1 - distanceKm / SCRUBBER_RADIUS_KM;
      const pm25Drop = (4 + spot.baselinePm25 * 0.01) * influence * elapsedSec;
      const co2Drop = (18 + spot.baselineCo2 * 0.01) * influence * elapsedSec;
      const pm25Floor = Math.max(MIN_PM25_FLOOR, spot.baselinePm25 * 0.3);
      const co2Floor = Math.max(MIN_CO2_FLOOR, spot.baselineCo2 * 0.55);

      spot.peakPm25 = Math.max(pm25Floor, spot.peakPm25 - pm25Drop);
      spot.peakCo2 = Math.max(co2Floor, spot.peakCo2 - co2Drop);
    }
  }
}
