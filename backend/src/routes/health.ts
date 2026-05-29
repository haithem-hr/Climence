import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

// Lightweight health check for uptime monitoring / container orchestration.
router.get('/health', (_req, res) => {
  try {
    // Basic DB liveness.
    db.prepare('select 1 as ok').get();
    res.status(200).json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, ts: new Date().toISOString() });
  }
});

export default router;
