import { Router } from 'express';
import { getCityTrend, getHotspots } from '../db/queries';
import { rolesForPermission } from '../features/auth/permissions';
import { requireAuth, requireRole } from '../lib/auth';
import { sendInternalError } from '../lib/http';

const router = Router();
const canViewAnalytics = rolesForPermission('canViewAnalytics');

router.get('/city-trend', requireAuth, requireRole(...canViewAnalytics), (_req, res) => {
  try {
    res.status(200).json(getCityTrend());
  } catch (err) {
    sendInternalError(res, 'Database city-trend query error', err);
  }
});

router.get('/hotspots', requireAuth, requireRole(...canViewAnalytics), (_req, res) => {
  try {
    res.status(200).json(getHotspots());
  } catch (err) {
    sendInternalError(res, 'Database hotspots query error', err);
  }
});

export default router;
