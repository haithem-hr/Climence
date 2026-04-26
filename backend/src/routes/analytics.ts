/**
 * Analytics routes — /api/analytics/*
 *
 * All routes require a valid Bearer token (requireAuth).
 * Business logic stays in features/analytics/*; SQL stays in db/queries.ts.
 *
 * Endpoints:
 *   GET /city-trend          — 30-min bucketed PM2.5 + CO2 averages
 *   GET /hotspots            — legacy grid-bucket hotspots (compat)
 *   GET /hotspot-clusters    — DBSCAN-lite clusters with centroid + radius
 *   GET /trend               — linear-regression trend signal (?window=30m|1h|24h)
 *   GET /history             — time-series (?pollutant=pm25|co2|no2 &range=1h|24h|7d|30d &zone=lat,lng,radiusKm)
 *   GET /forecast            — next N hours AQI forecast (?hours=6|12|24)
 *   GET /sources             — source attribution breakdown (?range=24h)
 */

import { Router } from 'express';
import { getCityTrend, getHotspots } from '../db/queries';
import { rolesForPermission } from '../features/auth/permissions';
import { requireAuth, requireRole } from '../lib/auth';
import { sendInternalError } from '../lib/http';
import {
  getCityTrend,
  getAlertThresholdPm25,
  getHistoricalAvg,
  getHistoryByZone,
  getHotspots,
  getHourlyHistory,
  getRawPointsForHotspot,
  getSourceData,
} from '../db/queries.js';
import { detectHotspots } from '../features/analytics/hotspots.js';
import { classifyTrend } from '../features/analytics/trend.js';
import { computeForecast } from '../features/analytics/forecast.js';
import { attributeSources } from '../features/analytics/sources.js';
import { requireAuth } from '../lib/auth.js';
import { sendBadRequest, sendInternalError } from '../lib/http.js';

const router = Router();
const canViewAnalytics = rolesForPermission('canViewAnalytics');

router.get('/city-trend', requireAuth, requireRole(...canViewAnalytics), (_req, res) => {
// ---------------------------------------------------------------------------
// GET /api/analytics/city-trend
// ---------------------------------------------------------------------------
router.get('/city-trend', requireAuth, (_req, res) => {
  try {
    res.status(200).json(getCityTrend());
  } catch (err) {
    sendInternalError(res, 'Database city-trend query error', err);
  }
});

router.get('/hotspots', requireAuth, requireRole(...canViewAnalytics), (_req, res) => {
// ---------------------------------------------------------------------------
// GET /api/analytics/hotspots  (legacy grid-bucket, kept for compat)
// ---------------------------------------------------------------------------
router.get('/hotspots', requireAuth, (_req, res) => {
  try {
    res.status(200).json(getHotspots());
  } catch (err) {
    sendInternalError(res, 'Database hotspots query error', err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/hotspot-clusters
// ---------------------------------------------------------------------------
router.get('/hotspot-clusters', requireAuth, (_req, res) => {
  try {
    const rawPoints = getRawPointsForHotspot(5);
    const threshold = getAlertThresholdPm25();
    res.status(200).json(detectHotspots(rawPoints, threshold));
  } catch (err) {
    sendInternalError(res, 'Hotspot cluster computation error', err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/trend?window=30m|1h|24h
// ---------------------------------------------------------------------------
const WINDOW_MINUTES: Record<string, number> = {
  '30m': 30,
  '1h':  60,
  '24h': 1440,
};

router.get('/trend', requireAuth, (req, res) => {
  try {
    const windowKey = (req.query['window'] as string) ?? '30m';
    const windowMin = WINDOW_MINUTES[windowKey];
    if (!windowMin) {
      sendBadRequest(res, `Invalid window. Use one of: ${Object.keys(WINDOW_MINUTES).join(', ')}`);
      return;
    }

    const series = getHistoricalAvg(windowMin);
    const trend  = classifyTrend(series, windowMin);
    res.status(200).json(trend);
  } catch (err) {
    sendInternalError(res, 'Trend computation error', err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/history?pollutant=pm25|co2|no2&range=1h|24h|7d|30d&zone=lat,lng,radiusKm
// ---------------------------------------------------------------------------
const VALID_POLLUTANTS = new Set(['pm25', 'co2', 'no2']);
const VALID_RANGES     = new Set(['1h', '24h', '7d', '30d']);

router.get('/history', requireAuth, (req, res) => {
  try {
    const pollutant = (req.query['pollutant'] as string) ?? 'pm25';
    const range     = (req.query['range']     as string) ?? '1h';
    const zoneStr   = req.query['zone'] as string | undefined;

    if (!VALID_POLLUTANTS.has(pollutant)) {
      sendBadRequest(res, `Invalid pollutant. Use one of: ${[...VALID_POLLUTANTS].join(', ')}`);
      return;
    }
    if (!VALID_RANGES.has(range)) {
      sendBadRequest(res, `Invalid range. Use one of: ${[...VALID_RANGES].join(', ')}`);
      return;
    }

    let centerLat: number | undefined;
    let centerLng: number | undefined;
    let radiusKm:  number | undefined;

    if (zoneStr) {
      const parts = zoneStr.split(',').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) {
        sendBadRequest(res, 'zone must be "lat,lng,radiusKm" (e.g. 24.7,46.7,5)');
        return;
      }
      [centerLat, centerLng, radiusKm] = parts;
    }

    const data = getHistoryByZone(
      pollutant as 'pm25' | 'co2' | 'no2',
      range,
      centerLat,
      centerLng,
      radiusKm,
    );
    res.status(200).json(data);
  } catch (err) {
    sendInternalError(res, 'History query error', err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/forecast?hours=6|12|24|72|168
// ---------------------------------------------------------------------------
const VALID_HOURS = new Set([6, 12, 24, 72, 168]);

router.get('/forecast', requireAuth, (req, res) => {
  try {
    const hoursParam = parseInt((req.query['hours'] as string) ?? '6', 10);
    if (!VALID_HOURS.has(hoursParam)) {
      sendBadRequest(res, `Invalid hours. Use one of: ${[...VALID_HOURS].join(', ')}`);
      return;
    }

    const history  = getHourlyHistory(7);
    const forecast = computeForecast(history, hoursParam);
    res.status(200).json(forecast);
  } catch (err) {
    sendInternalError(res, 'Forecast computation error', err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/sources?range=1h|24h
// ---------------------------------------------------------------------------
const SOURCE_HOURS: Record<string, number> = {
  '1h':  1,
  '24h': 24,
};

router.get('/sources', requireAuth, (req, res) => {
  try {
    const rangeKey = (req.query['range'] as string) ?? '24h';
    const hours    = SOURCE_HOURS[rangeKey];
    if (!hours) {
      sendBadRequest(res, `Invalid range. Use one of: ${Object.keys(SOURCE_HOURS).join(', ')}`);
      return;
    }

    const readings = getSourceData(hours);
    const sources  = attributeSources(readings);
    res.status(200).json(sources);
  } catch (err) {
    sendInternalError(res, 'Source attribution error', err);
  }
});

export default router;

