import { Router } from 'express';
import { getHistory, getLatest, insertFleet } from '../db/queries';
import { rolesForPermission } from '../features/auth/permissions';
import { validateTelemetryPayload } from '../features/telemetry/validation';
import { requireAuth, requireRole } from '../lib/auth';
import { sendBadRequest, sendInternalError, sendNotFound } from '../lib/http';
import { broadcastSnapshot } from '../ws';

const router = Router();
const canViewTelemetry = rolesForPermission('canViewTelemetry');
// Legacy HTTP POST telemetry ingestion removed. Now exclusively handled via MQTT.

router.get('/latest', requireAuth, requireRole(...canViewTelemetry), (_req, res) => {
  try {
    res.status(200).json(getLatest());
  } catch (err) {
    sendInternalError(res, 'Database query error', err);
  }
});

router.get('/history/:droneId', requireAuth, requireRole(...canViewTelemetry), (req, res) => {
  try {
    const droneId = Array.isArray(req.params.droneId) ? req.params.droneId[0] : req.params.droneId;
    if (!droneId) {
      sendBadRequest(res, 'Drone ID is required.');
      return;
    }

    const results = getHistory(droneId);
    if (results.length === 0) {
      sendNotFound(res, 'Drone ID not found or has no generated history.');
      return;
    }
    res.status(200).json(results);
  } catch (err) {
    sendInternalError(res, 'Database history query error', err);
  }
});

export default router;
