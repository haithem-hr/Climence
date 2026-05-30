import { Router } from 'express';
import type { AlertConditionOperator, AlertPollutantType, AlertRuleInput } from '@climence/shared';
import { getStorage } from '../storage/select.js';
import { validateAlertThresholdInput } from '../features/alerts/config';
import { rolesForPermission } from '../features/auth/permissions';
import { requireAuth, requireRole } from '../lib/auth';
import { sendBadRequest, sendInternalError, sendNotFound } from '../lib/http';
import { broadcastSnapshot } from '../ws';

const router = Router();
const canViewAlerts = rolesForPermission('canViewAlerts');
const canManageAlerts = rolesForPermission('canManageAlerts');
const canManageAlertThresholds = rolesForPermission('canManageAlertThresholds');

const ALERT_POLLUTANTS = new Set<AlertPollutantType>(['pm25', 'pm10', 'no2', 'o3', 'so2', 'co']);
const ALERT_OPERATORS = new Set<AlertConditionOperator>(['>', '>=', '<', '<=']);

function currentUserId(req: { authUser?: { id: string } }) {
  const numeric = Number(req.authUser?.id);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 1;
}

function validateRuleInput(body: unknown, partial = false): { ok: true; value: AlertRuleInput } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Invalid payload. Expected an object body.' };
  }

  const input = body as Record<string, unknown>;
  const pollutant = input.pollutant_type;
  const threshold = input.threshold_value;
  const operator = input.condition_operator ?? (partial ? undefined : '>');
  const channel = input.notification_channel ?? (partial ? undefined : 'system');
  const isActive = input.is_active;

  if (!partial || pollutant !== undefined) {
    if (typeof pollutant !== 'string' || !ALERT_POLLUTANTS.has(pollutant as AlertPollutantType)) {
      return { ok: false, error: 'Invalid payload. "pollutant_type" must be one of pm25, pm10, no2, o3, so2, co.' };
    }
  }

  if (!partial || threshold !== undefined) {
    if (typeof threshold !== 'number' || !Number.isFinite(threshold)) {
      return { ok: false, error: 'Invalid payload. "threshold_value" must be a finite number.' };
    }
  }

  if (operator !== undefined && (typeof operator !== 'string' || !ALERT_OPERATORS.has(operator as AlertConditionOperator))) {
    return { ok: false, error: 'Invalid payload. "condition_operator" must be one of >, >=, <, <=.' };
  }

  if (channel !== undefined && (typeof channel !== 'string' || channel.trim().length === 0 || channel.length > 20)) {
    return { ok: false, error: 'Invalid payload. "notification_channel" must be a non-empty string up to 20 characters.' };
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return { ok: false, error: 'Invalid payload. "is_active" must be a boolean.' };
  }

  return {
    ok: true,
    value: {
      ...(pollutant !== undefined ? { pollutant_type: pollutant as AlertPollutantType } : {}),
      ...(threshold !== undefined ? { threshold_value: threshold as number } : {}),
      ...(operator !== undefined ? { condition_operator: operator as AlertConditionOperator } : {}),
      ...(channel !== undefined ? { notification_channel: channel.trim() } : {}),
      ...(isActive !== undefined ? { is_active: isActive } : {}),
    } as AlertRuleInput,
  };
}

router.get('/active', requireAuth, requireRole(...canViewAlerts), async (_req, res) => {
  try {
    const storage = getStorage();
    res.status(200).json(await storage.getAlertEvents('active', 50));
  } catch (err) {
    sendInternalError(res, 'Database active alerts query error', err);
  }
});

router.get('/cleared', requireAuth, requireRole(...canViewAlerts), async (_req, res) => {
  try {
    const storage = getStorage();
    res.status(200).json(await storage.getAlertEvents('cleared', 50));
  } catch (err) {
    sendInternalError(res, 'Database cleared alerts query error', err);
  }
});

router.get('/rules', requireAuth, requireRole(...canViewAlerts), async (req, res) => {
  try {
    const storage = getStorage();
    res.status(200).json(await storage.listAlertRules(currentUserId(req)));
  } catch (err) {
    sendInternalError(res, 'Database alert rules query error', err);
  }
});

router.post('/rules', requireAuth, requireRole(...canManageAlerts), async (req, res) => {
  const validation = validateRuleInput(req.body);
  if (!validation.ok) {
    sendBadRequest(res, validation.error);
    return;
  }

  try {
    const storage = getStorage();
    const created = await storage.createAlertRule(currentUserId(req), validation.value);
    await broadcastSnapshot();
    res.status(201).json(created);
  } catch (err) {
    sendInternalError(res, 'Database alert rule create error', err);
  }
});

router.put('/rules/:id', requireAuth, requireRole(...canManageAlerts), async (req, res) => {
  const ruleId = Number(req.params.id);
  if (!Number.isInteger(ruleId) || ruleId <= 0) {
    sendBadRequest(res, 'Invalid rule id.');
    return;
  }

  const validation = validateRuleInput(req.body, true);
  if (!validation.ok) {
    sendBadRequest(res, validation.error);
    return;
  }

  try {
    const storage = getStorage();
    const updated = await storage.updateAlertRule(ruleId, currentUserId(req), validation.value);
    if (!updated) {
      sendNotFound(res, 'Alert rule not found.');
      return;
    }
    await broadcastSnapshot();
    res.status(200).json(updated);
  } catch (err) {
    sendInternalError(res, 'Database alert rule update error', err);
  }
});

router.delete('/rules/:id', requireAuth, requireRole(...canManageAlerts), async (req, res) => {
  const ruleId = Number(req.params.id);
  if (!Number.isInteger(ruleId) || ruleId <= 0) {
    sendBadRequest(res, 'Invalid rule id.');
    return;
  }

  try {
    const storage = getStorage();
    const deleted = await storage.deleteAlertRule(ruleId, currentUserId(req));
    if (!deleted) {
      sendNotFound(res, 'Alert rule not found.');
      return;
    }
    await broadcastSnapshot();
    res.status(204).send();
  } catch (err) {
    sendInternalError(res, 'Database alert rule delete error', err);
  }
});

router.get('/config', requireAuth, requireRole(...canViewAlerts), async (_req, res) => {
  try {
    const storage = getStorage();
    const config = await storage.getAlertThresholdConfig();
    res.status(200).json({
      pm25Threshold: config.pm25_threshold,
      updatedAt: config.updated_at,
    });
  } catch (err) {
    sendInternalError(res, 'Database alert config query error', err);
  }
});

router.put('/config', requireAuth, requireRole(...canManageAlertThresholds), async (req, res) => {
  const validation = validateAlertThresholdInput(req.body);
  if (!validation.ok) {
    sendBadRequest(res, validation.error);
    return;
  }

  try {
    const storage = getStorage();
    const updated = await storage.setAlertThresholdPm25(validation.pm25Threshold);
    // Push fresh snapshot so connected dashboards apply the new threshold instantly.
    await broadcastSnapshot();
    res.status(200).json({
      pm25Threshold: updated.pm25_threshold,
      updatedAt: updated.updated_at,
    });
  } catch (err) {
    sendInternalError(res, 'Database alert config update error', err);
  }
});

export default router;
