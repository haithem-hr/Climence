import type { Storage } from './index.js';
import { sqliteStorage } from './sqlite.js';
import { getPostgresPool, getRedisClient, migratePostgres } from './redisPostgres/clients.js';
import { createRedisPostgresStorage } from './redisPostgres/storage.js';
import type { RedisClientType } from 'redis';

let active: Storage | null = null;

/**
 * Resolve the active storage backend.
 *
 * Defaults to SQLite to preserve the current behavior.
 * Set CLIMENCE_STORAGE=redis-postgres to enable the new stack (once added).
 */
export function getStorage(): Storage {
  if (active) return active;

  const kind = (process.env.CLIMENCE_STORAGE ?? 'sqlite').toLowerCase();
  switch (kind) {
    case 'sqlite': {
      active = sqliteStorage;
      return active;
    }
    case 'redis-postgres':
    case 'redis+postgres':
    case 'pg-redis':
    case 'postgres-redis': {
      // Note: this branch returns a Storage immediately, but its methods are async.
      // Our routes/ws/mqtt are updated to await storage methods when this backend is selected.
      const pool = getPostgresPool();
      // Fire-and-forget migration + redis connection; first awaited method will fail loudly
      // if dependencies are missing.
      void migratePostgres(pool);

      // Build a small async wrapper that lazily awaits redis connect (so getStorage stays sync).
      let redisPromise: Promise<RedisClientType> | null = null;
      const ensureRedis = () => {
        redisPromise ??= getRedisClient();
        return redisPromise;
      };

      active = createRedisPostgresStorage({
        pool,
        // placeholder; methods that need redis will await ensureRedis() first
        // we patch in a proxy client below
        redis: new Proxy(
          {},
          {
            get(_t, prop) {
              return async (...args: any[]) => {
                const r = await ensureRedis();
                return (r as any)[prop](...args);
              };
            },
          },
        ) as any,
      });

      return active;
    }
    default: {
      active = sqliteStorage;
      return active;
    }
  }
}
