import { DroneState, type TelemetryInput } from '@climence/shared';

export class DroneDevice {
  public static globalBaseline = {
    pm25: 10,
    co2: 400,
    no2: 20
  };

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
    
    // Use exact values from CSV without additional scaling or noise
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
        pm25: this.pm25,
        co2: this.co2,
        no2: this.no2,
        temperature: this.temperature,
        humidity: this.humidity,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
