import { Router } from 'express';
import { getStorage } from '../storage/select.js';
import { rolesForPermission } from '../features/auth/permissions';
import { requireAuth, requireRole } from '../lib/auth';
import { sendBadRequest, sendInternalError } from '../lib/http';
import { broadcastSnapshot } from '../ws';

const router = Router();
const canViewMissions = rolesForPermission('canViewAnalytics'); // Shared permission level
const canCreateMissions = rolesForPermission('canViewAnalytics');

// GET /api/missions
router.get('/', requireAuth, requireRole(...canViewMissions), async (_req, res) => {
  try {
    const storage = getStorage();
    res.status(200).json(await storage.getAllMissions());
  } catch (err) {
    sendInternalError(res, 'Database missions query error', err);
  }
});

// POST /api/missions
router.post('/', requireAuth, requireRole(...canCreateMissions), async (req, res) => {
  try {
    const m = req.body;
    if (!m.id || !m.targetId) {
      return sendBadRequest(res, 'Missing mission data');
    }
    const storage = getStorage();
    await storage.insertMission(m);
    await broadcastSnapshot(); // Notify everyone
    res.status(201).json({ status: 'success' });
  } catch (err) {
    sendInternalError(res, 'Database mission insertion error', err);
  }
});

// PATCH /api/missions/:id
router.patch('/:id', requireAuth, requireRole(...canCreateMissions), async (req, res) => {
  try {
    const rawId = (req.params as any)?.id as unknown;
    const rawStatus = (req.body as Record<string, unknown> | null | undefined)?.status;
    const rawReport = (req.body as Record<string, unknown> | null | undefined)?.report;

    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const status = typeof rawStatus === 'string' ? rawStatus : Array.isArray(rawStatus) ? rawStatus[0] : undefined;
    const report = typeof rawReport === 'string' ? rawReport : Array.isArray(rawReport) ? rawReport[0] : undefined;

    if (typeof id !== 'string' || !id) {
      return sendBadRequest(res, 'Missing mission id');
    }
    if (typeof status !== 'string' || !status) {
      return sendBadRequest(res, 'Missing mission status');
    }

    const storage = getStorage();
    await storage.updateMissionStatus(id, status, report);
    await broadcastSnapshot();
    res.status(200).json({ status: 'success' });
  } catch (err) {
    sendInternalError(res, 'Database mission update error', err);
  }
});

export default router;
