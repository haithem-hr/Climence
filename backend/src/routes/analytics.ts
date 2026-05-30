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
import { getStorage } from '../storage/select.js';
import { rolesForPermission } from '../features/auth/permissions';
import { detectHotspots } from '../features/analytics/hotspots';
import { classifyTrend } from '../features/analytics/trend';
import { computeForecast } from '../features/analytics/forecast';
import { attributeSources } from '../features/analytics/sources';
import { requireAuth, requireRole } from '../lib/auth';
import { sendBadRequest, sendInternalError } from '../lib/http';
import { getHistoricalSlice } from '../features/analytics/openMeteo';

const router = Router();
const canViewAnalytics = rolesForPermission('canViewAnalytics');

// ---------------------------------------------------------------------------
// GET /api/analytics/city-trend
// ---------------------------------------------------------------------------
router.get('/city-trend', requireAuth, requireRole(...canViewAnalytics), (_req, res) => {
  try {
    const storage = getStorage();
    Promise.resolve(storage.getCityTrend())
      .then(data => res.status(200).json(data))
      .catch(err => sendInternalError(res, 'Database city-trend query error', err));
  } catch (err) {
    sendInternalError(res, 'Database city-trend query error', err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/hotspots  (legacy grid-bucket, kept for compat)
// ---------------------------------------------------------------------------
router.get('/hotspots', requireAuth, requireRole(...canViewAnalytics), (_req, res) => {
  try {
    const storage = getStorage();
    Promise.resolve(storage.getHotspots())
      .then(data => res.status(200).json(data))
      .catch(err => sendInternalError(res, 'Database hotspots query error', err));
  } catch (err) {
    sendInternalError(res, 'Database hotspots query error', err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/hotspot-clusters
// ---------------------------------------------------------------------------
router.get('/hotspot-clusters', requireAuth, requireRole(...canViewAnalytics), (_req, res) => {
  try {
    const storage = getStorage();
    Promise.all([
      storage.getRawPointsForHotspot(5),
      storage.getAlertThresholdPm25(),
    ])
      .then(([rawPoints, threshold]) => res.status(200).json(detectHotspots(rawPoints, threshold)))
      .catch(err => sendInternalError(res, 'Hotspot cluster computation error', err));
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

router.get('/trend', requireAuth, requireRole(...canViewAnalytics), (req, res) => {
  try {
    const windowKey = (req.query['window'] as string) ?? '30m';
    const windowMin = WINDOW_MINUTES[windowKey];
    if (!windowMin) {
      sendBadRequest(res, `Invalid window. Use one of: ${Object.keys(WINDOW_MINUTES).join(', ')}`);
      return;
    }

    const storage = getStorage();
    Promise.resolve(storage.getHistoricalAvg(windowMin))
      .then(series => res.status(200).json(classifyTrend(series, windowMin)))
      .catch(err => sendInternalError(res, 'Trend computation error', err));
  } catch (err) {
    sendInternalError(res, 'Trend computation error', err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/history?pollutant=pm25|co2|no2&range=1h|24h|7d|30d&zone=lat,lng,radiusKm
// ---------------------------------------------------------------------------
const VALID_POLLUTANTS = new Set(['pm25', 'pm10', 'co2', 'no2', 'o3', 'so2', 'co']);
const VALID_RANGES     = new Set(['1h', '6h', '12h', '24h', '7d', '30d']);

router.get('/history', requireAuth, requireRole(...canViewAnalytics), (req, res) => {
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

    const storage = getStorage();
    Promise.resolve(
      storage.getHistoryByZone(
        pollutant as 'pm25' | 'pm10' | 'co2' | 'no2' | 'o3' | 'so2' | 'co',
        range,
        centerLat,
        centerLng,
        radiusKm,
      ),
    )
      .then(data => res.status(200).json(data))
      .catch(err => sendInternalError(res, 'History query error', err));
  } catch (err) {
    sendInternalError(res, 'History query error', err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/forecast?hours=6|12|24|72|168
// ---------------------------------------------------------------------------
const VALID_HOURS = new Set([6, 12, 24, 72, 120, 168]);

router.get('/forecast', requireAuth, requireRole(...canViewAnalytics), (req, res) => {
  try {
    const hoursParam = parseInt((req.query['hours'] as string) ?? '6', 10);
    if (!VALID_HOURS.has(hoursParam)) {
      sendBadRequest(res, `Invalid hours. Use one of: ${[...VALID_HOURS].join(', ')}`);
      return;
    }

    const storage = getStorage();
    Promise.resolve(storage.getHourlyHistory(7))
      .then(history => res.status(200).json(computeForecast(history, hoursParam)))
      .catch(err => sendInternalError(res, 'Forecast computation error', err));
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

router.get('/sources', requireAuth, requireRole(...canViewAnalytics), (req, res) => {
  try {
    const rangeKey = (req.query['range'] as string) ?? '24h';
    const hours    = SOURCE_HOURS[rangeKey];
    if (!hours) {
      sendBadRequest(res, `Invalid range. Use one of: ${Object.keys(SOURCE_HOURS).join(', ')}`);
      return;
    }

    const storage = getStorage();
    Promise.resolve(storage.getSourceData(hours))
      .then(readings => res.status(200).json(attributeSources(readings)))
      .catch(err => sendInternalError(res, 'Source attribution error', err));
  } catch (err) {
    sendInternalError(res, 'Source attribution error', err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/openmeteo-history?range=1h|6h|12h|24h|3d|7d|30d
// Returns sliced Open-Meteo historical data (past_days=92) for the main chart
// ---------------------------------------------------------------------------
const OM_WINDOW_MS: Record<string, number> = {
  '1h':  1      * 3_600_000,
  '6h':  6      * 3_600_000,
  '12h': 12     * 3_600_000,
  '24h': 24     * 3_600_000,
  '3d':  3  * 24 * 3_600_000,
  '7d':  7  * 24 * 3_600_000,
  '30d': 30 * 24 * 3_600_000,
};

router.get('/openmeteo-history', requireAuth, requireRole(...canViewAnalytics), (req, res) => {
  try {
    const range = (req.query['range'] as string | undefined) ?? '24h';
    const windowMs = OM_WINDOW_MS[range];
    if (!windowMs) {
      sendBadRequest(res, `Invalid range. Use one of: ${Object.keys(OM_WINDOW_MS).join(', ')}`);
      return;
    }
    const slice = getHistoricalSlice(windowMs);
    // Return array of {label, pm25, pm10, co2, no2, dust}
    const out = slice.map(r => ({
      label: r.hourIso,
      pm25:  Math.round(r.avgPm25  * 10) / 10,
      pm10:  Math.round(r.pm10     * 10) / 10,
      co2:   Math.round(r.co2      * 10) / 10,
      no2:   Math.round(r.no2      * 10) / 10,
      dust:  Math.round(r.dust     * 10) / 10,
    }));
    res.status(200).json(out);
  } catch (err) {
    sendInternalError(res, 'Open-Meteo history error', err);
  }
});

export default router;
