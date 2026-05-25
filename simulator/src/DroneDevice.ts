import { DroneState, type TelemetryInput } from '@climence/shared';

export class DroneDevice {
  public readonly uuid: string;
  public state: DroneState = DroneState.GATHERING_DATA;
  public batteryLevel = 100;

  private currentLat = 0;
  private currentLng = 0;
  private pm25 = 0;
  private co2 = 0;
  private no2 = 0;
  private temperature = 0;
  private humidity = 0;

  constructor(idIndex: number) {
    this.uuid = `DRONE-UNIT-${idIndex.toString().padStart(3, '0')}`;
  }

  public feedCsvRow(row: any) {
    this.currentLat = parseFloat(row.latitude);
    this.currentLng = parseFloat(row.longitude);
    this.pm25 = parseFloat(row.pm25);
    this.co2 = parseFloat(row.co2);
    this.no2 = parseFloat(row.no2);
    this.temperature = parseFloat(row.temperature);
    this.humidity = parseFloat(row.humidity);
    
    // Basic battery simulation loop
    this.batteryLevel -= 0.5;
    if (this.batteryLevel <= 0) {
      this.batteryLevel = 100; // Auto-recharge for the simulation loop
    }
  }

  public getTelemetry(): TelemetryInput {
    return {
      uuid: this.uuid,
      state: this.batteryLevel < 20 ? DroneState.LOW_BATTERY : DroneState.GATHERING_DATA,
      batteryLevel: Number(this.batteryLevel.toFixed(1)),
      rssi: -50,
      location: {
        lat: this.currentLat,
        lng: this.currentLng,
      },
      airQuality: {
<<<<<<< Updated upstream
        pm25: Number(spatialData.pm25.toFixed(2)),
        co2: Number(spatialData.co2.toFixed(2)),
        no2: Number((5 + spatialData.pm25 * 0.06 + this.nextRandom() * 2).toFixed(2)),
        temperature: Number((baseTemp + (this.nextRandom() - 0.5) * 2).toFixed(2)),
        humidity: Number(clamp(baseHumidity + (this.nextRandom() - 0.5) * 6, 10, 80).toFixed(2)),
=======
        pm25: this.pm25,
        co2: this.co2,
        no2: this.no2,
        temperature: this.temperature,
        humidity: this.humidity,
>>>>>>> Stashed changes
      },
      timestamp: new Date().toISOString(),
    };
  }
<<<<<<< Updated upstream

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
    weightedPm25 += 10 * ambientWeight;
    weightedCo2 += 400 * ambientWeight;
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
=======
>>>>>>> Stashed changes
}
