import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRedisPostgresStorage } from './storage.js';

// This integration test requires services:
// - Postgres at DATABASE_URL
// - Redis at REDIS_URL
// Run via: npm run test:integration

function servicesAvailable() {
  return Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);
}

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for redis+postgres integration test`);
  return v;
}

async function ensureSchema(pool: any) {
  const { readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schemaSql = readFileSync(resolve(__dirname, '../postgres/schema.sql'), 'utf8');
  await pool.query(schemaSql);
}

test('redis+postgres storage: insertFleet -> getLatest/getHistory', async () => {
  if (!servicesAvailable()) {
    test.skip('requires DATABASE_URL and REDIS_URL');
    return;
  }

  const { Pool } = await import('pg');
  const { createClient } = await import('redis');

  const pool = new Pool({ connectionString: env('DATABASE_URL') });
  const redis = createClient({ url: env('REDIS_URL') });
  await redis.connect();

  await ensureSchema(pool);

  const storage = createRedisPostgresStorage({ pool, redis: redis as any });
  const uuid = `itest-${randomUUID()}`;

  await storage.insertFleet([
    {
      uuid,
      state: 'IDLE',
      batteryLevel: 99,
      rssi: -42,
      location: { lat: 24.71, lng: 46.67 },
      airQuality: { pm25: 10, co2: 400, no2: 12, temperature: 30, humidity: 10 },
      timestamp: new Date().toISOString(),
    },
  ]);

  const latest = await storage.getLatest();
  const found = latest.find(r => r.uuid === uuid);
  assert.ok(found, 'expected latest to include inserted uuid');
  assert.equal(found!.pm25, 10);

  const history = await storage.getHistory(uuid);
  assert.ok(history.length >= 1, 'expected history to have at least one record');
  assert.equal(history[history.length - 1]!.uuid, uuid);

  await redis.quit();
  await pool.end();
});

test('redis+postgres storage: alert config and missions basic flow', async () => {
  if (!servicesAvailable()) {
    test.skip('requires DATABASE_URL and REDIS_URL');
    return;
  }

  const { Pool } = await import('pg');
  const { createClient } = await import('redis');

  const pool = new Pool({ connectionString: env('DATABASE_URL') });
  const redis = createClient({ url: env('REDIS_URL') });
  await redis.connect();

  await ensureSchema(pool);

  const storage = createRedisPostgresStorage({ pool, redis: redis as any });

  const cfg0 = await storage.getAlertThresholdConfig();
  const updated = await storage.setAlertThresholdPm25(cfg0.pm25_threshold + 1);
  assert.equal(updated.pm25_threshold, cfg0.pm25_threshold + 1);

  const missionId = `m-${randomUUID()}`;
  await storage.insertMission({
    id: missionId,
    targetId: 't-1',
    targetName: 'Test',
    resourceType: 'drone',
    priority: 'low',
    status: 'queued',
    targetCoord: { lat: 24.7, lng: 46.6 },
  });

  const missions = await storage.getAllMissions();
  assert.ok(missions.some(m => m.id === missionId));

  await storage.updateMissionStatus(missionId, 'done', 'ok');

  await redis.quit();
  await pool.end();
});
