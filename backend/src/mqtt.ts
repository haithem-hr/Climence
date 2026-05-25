import { Aedes } from 'aedes';
import { createServer } from 'node:net';
import { insertFleet } from './db/queries';
import { validateTelemetryPayload } from './features/telemetry/validation';
import { broadcastSnapshot } from './ws';

export async function setupMqttBroker(port = 1883) {
  const aedes = await Aedes.createBroker();
  const server = createServer(aedes.handle);

  // Authenticate simple connections for the mock
  aedes.authenticate = (client, username, password, callback) => {
    // A real drone would use client certificates or a hardcoded token.
    // We allow connection if they use a valid generic IoT password
    const valid = username === 'drone' && password?.toString() === 'flight123';
    callback(null, valid);
  };

  aedes.on('publish', (packet, client) => {
    if (packet.topic === 'climence/telemetry' && client) {
      try {
        const payloadString = packet.payload.toString();
        const rawPayload = JSON.parse(payloadString);
        
        // MQTT can send single or batched telemetry
        const fleetArray = Array.isArray(rawPayload.fleet) ? rawPayload.fleet : [rawPayload];
        
        const validation = validateTelemetryPayload({ fleet: fleetArray });
        if (!validation.ok) {
          console.warn(`[MQTT] Invalid telemetry payload from ${client.id}:`, validation.error);
          return;
        }

        insertFleet(validation.payload.fleet);
        broadcastSnapshot();
        console.log(`[MQTT] [${new Date().toISOString()}] Ingested telemetry via MQTT for ${validation.payload.fleet.length} drones.`);
      } catch (err) {
        console.error(`[MQTT] Error processing telemetry from ${client.id}:`, err);
      }
    }
  });

  server.listen(port, () => {
    console.log(`📡 Embedded MQTT Broker listening on port ${port}`);
  });

  return server;
}
