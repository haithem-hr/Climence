import { API_BASE_URL, DRONE_FLEET_SIZE, TELEMETRY_INTERVAL_MS } from '@climence/shared';
import { FleetManager } from './FleetManager';

const endpoint = `${API_BASE_URL}/api/telemetry`;
console.log(`Starting Drone Simulator... Targeting Central Ingestion API at ${endpoint}`);

const fleet = new FleetManager(DRONE_FLEET_SIZE, endpoint);
await fleet.startSimulation(TELEMETRY_INTERVAL_MS);
