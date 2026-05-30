import { Router } from 'express';
import { db } from '../db/client';
import { getPostgresPool } from '../storage/redisPostgres/clients.js';

const router = Router();

// Lightweight health check for uptime monitoring / container orchestration.
router.get('/health', (_req, res) => {
  try {
    const ts = new Date().toISOString();
    // If DATABASE_URL is present we assume we're running with Postgres.
    // (This keeps docker-compose healthchecks working after enabling redis+postgres.)
    if (process.env.DATABASE_URL) {
      const pool = getPostgresPool();
      // Fire-and-forget; respond after query resolves
      pool
        .query('select 1 as ok')
        .then(() => res.status(200).json({ ok: true, ts }))
        .catch(() => res.status(503).json({ ok: false, ts }));
      return;
    }

    // Default: SQLite liveness.
    db.prepare('select 1 as ok').get();
    res.status(200).json({ ok: true, ts });
  } catch (err) {
    res.status(503).json({ ok: false, ts: new Date().toISOString() });
  }
});

export default router;
