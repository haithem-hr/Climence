import { Aedes } from 'aedes';
import { createServer } from 'node:net';
import { getStorage } from './storage/select.js';
import { validateTelemetryPayload } from './features/telemetry/validation';
import { broadcastSnapshot } from './ws';
import { logger } from './lib/logger';

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

  aedes.on('publish', async (packet, client) => {
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

        const storage = getStorage();
        await storage.insertFleet(validation.payload.fleet);
        await storage.evaluateAlerts(validation.payload.fleet);
        await broadcastSnapshot();
        logger.info('[mqtt] telemetry ingested', { clientId: client.id, drones: validation.payload.fleet.length });
      } catch (err) {
        logger.error('[mqtt] error processing telemetry', { clientId: client.id, err: String(err) });
      }
    }
  });

  server.listen(port, () => {
    logger.info('Embedded MQTT Broker listening', { port });
  });

  return server;
}
