import type { TelemetryPayload } from '@climence/shared';
import { DroneDevice } from './DroneDevice';
import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

const CSV_FILE = path.join(process.cwd(), '../data/fleet_flight_paths.csv');

export class FleetManager {
  private drones: DroneDevice[] = [];
  private mqttClient: mqtt.MqttClient;
  private flightData: Map<number, any[]> = new Map();
  private tickIndices: Map<number, number> = new Map();

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
  }
}
