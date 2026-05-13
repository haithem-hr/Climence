import { Router } from 'express';
import { insertMission, updateMissionStatus, getAllMissions } from '../db/queries';
import { rolesForPermission } from '../features/auth/permissions';
import { requireAuth, requireRole } from '../lib/auth';
import { sendBadRequest, sendInternalError } from '../lib/http';
import { broadcastSnapshot } from '../ws';

const router = Router();
const canViewMissions = rolesForPermission('canViewAnalytics'); // Shared permission level
const canCreateMissions = rolesForPermission('canViewAnalytics');

// GET /api/missions
router.get('/', requireAuth, requireRole(...canViewMissions), (_req, res) => {
  try {
    res.status(200).json(getAllMissions());
  } catch (err) {
    sendInternalError(res, 'Database missions query error', err);
  }
});

// POST /api/missions
router.post('/', requireAuth, requireRole(...canCreateMissions), (req, res) => {
  try {
    const m = req.body;
    if (!m.id || !m.targetId) {
      return sendBadRequest(res, 'Missing mission data');
    }
    insertMission(m);
    broadcastSnapshot(); // Notify everyone
    res.status(201).json({ status: 'success' });
  } catch (err) {
    sendInternalError(res, 'Database mission insertion error', err);
  }
});

// PATCH /api/missions/:id
router.patch('/:id', requireAuth, requireRole(...canCreateMissions), (req, res) => {
  try {
    const { id } = req.params;
    const { status, report } = req.body;
    updateMissionStatus(id, status, report);
    broadcastSnapshot();
    res.status(200).json({ status: 'success' });
  } catch (err) {
    sendInternalError(res, 'Database mission update error', err);
  }
});

export default router;
