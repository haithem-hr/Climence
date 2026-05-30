import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { createClient, type RedisClientType } from 'redis';
import { logger } from '../../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getPostgresPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required when using redis+postgres storage');
  }

  // Keep a small pool (this app is lightweight)
  return new Pool({ connectionString: databaseUrl, max: 10 });
}

export async function migratePostgres(pool: Pool) {
  const schemaPath = resolve(__dirname, '../postgres/schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required when using redis+postgres storage');
  }

  redisClient = createClient({ url: redisUrl });
  redisClient.on('error', (err: unknown) => {
    logger.error('[redis] client error', { err: String(err) });
  });

  await redisClient.connect();
  return redisClient;
}
