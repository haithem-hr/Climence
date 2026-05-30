import { Router } from 'express';
import { getStorage } from '../storage/select.js';
import { rolesForPermission } from '../features/auth/permissions';
import { requireAuth, requireRole } from '../lib/auth';
import { sendBadRequest, sendInternalError } from '../lib/http';
import { logger } from '../lib/logger';

const router = Router();
const canManageReports = rolesForPermission('canViewAnalytics');

// GET /api/reports/schedules
router.get('/schedules', requireAuth, requireRole(...canManageReports), async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return sendBadRequest(res, 'Missing user context');
    const storage = getStorage();
    const schedules = await storage.listScheduledReports(userId);
    res.status(200).json(schedules);
  } catch (err) {
    sendInternalError(res, 'Database scheduled reports query error', err);
  }
});

// POST /api/reports/schedules
router.post('/schedules', requireAuth, requireRole(...canManageReports), async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return sendBadRequest(res, 'Missing user context');

    const body = req.body as Record<string, unknown>;
    const frequency = body?.frequency;
    if (!frequency || !['daily', 'weekly', 'monthly'].includes(frequency as string)) {
      return sendBadRequest(res, 'Invalid frequency. Must be daily, weekly, or monthly.');
    }

    const storage = getStorage();
    const schedule = await storage.createScheduledReport(userId, {
      report_type: (body.report_type as string) ?? 'snapshot',
      region: (body.region as string) ?? undefined,
      pollutants: Array.isArray(body.pollutants) ? body.pollutants as string[] : undefined,
      frequency: frequency as 'daily' | 'weekly' | 'monthly',
      recipients: Array.isArray(body.recipients) ? body.recipients as string[] : [],
      output_format: (body.output_format as string) ?? 'pdf',
    });

    logger.info('[reports] created schedule', { schedule_id: schedule.schedule_id, frequency });
    res.status(201).json(schedule);
  } catch (err) {
    sendInternalError(res, 'Database schedule creation error', err);
  }
});

// DELETE /api/reports/schedules/:id
router.delete('/schedules/:id', requireAuth, requireRole(...canManageReports), async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return sendBadRequest(res, 'Missing user context');

    const scheduleId = Number(req.params.id);
    if (!Number.isFinite(scheduleId)) return sendBadRequest(res, 'Invalid schedule id');

    const storage = getStorage();
    const ok = await storage.deleteScheduledReport(scheduleId, userId);
    if (!ok) {
      res.status(404).json({ message: 'Schedule not found or not owned by user' });
      return;
    }
    res.status(200).json({ status: 'deleted' });
  } catch (err) {
    sendInternalError(res, 'Database schedule deletion error', err);
  }
});

export default router;
