/**
 * useDashboardData — custom hook that owns all snapshot-derived state.
 *
 * Extracts every computation that was bloating App.tsx (sensors, hotspots,
 * pollutant stats, alert feed, trend, forecast, sources, etc.) into a
 * single hook so the composition root stays thin.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AQI_BANDS,
  DroneState,
  PM25_ALERT_THRESHOLD,
  RIYADH_BOUNDS,
  UserRole,
  aqiBandFor,
  pm25ToAqi,
  type AlertEvent,
  type AlertRule,
  type AlertRuleInput,
  type AuthUser,
  type Hotspot,
  type TelemetryRecord,
  type TelemetrySnapshot,
} from '@climence/shared';
import { createAlertRule, deleteAlertRule, fetchAlertConfig, fetchAlertRules, fetchHistory, updateAlertConfig, updateAlertRule } from '../api/client';
import type { RiyadhMapBounds, RiyadhMapHotspot, RiyadhMapSensor, RiyadhZoomPreset } from '../components/map/RiyadhGoogleMap';
import type { HeatmapPoint } from '../components/map/HeatmapLayer';
import { computeDriftVector, computeForecast, computeSourceAttribution, detectTrend } from '../lib/analytics';
import { tFormat, translate, type DictKey, type Locale } from '../lib/i18n';
import {
  bandForMetricValue,
  formatMetricValue,
  getMapMetricConfig,
  getMapMetricValue,
  heatIntensityForMetric,
  POLLUTANT_METRIC_OPTIONS,
  type MapMetricKey,
} from '../lib/mapMetrics';
import type { ReportPayload } from '../lib/reports';
import type { ConnectionStatus } from './useLiveTelemetry';

/* ═══════════════════════════ TYPES ═══════════════════════════ */

export type ViewMode = 'hardware' | 'heatmap';
export type TimeRange = '1s' | '15m' | '30m' | '1h';
export type PollutantKey = MapMetricKey;
type AqiBandKey = (typeof AQI_BANDS)[number]['key'];
export type AlertSeverity = 'crit' | 'warn' | 'info' | 'ok';

export interface SensorPoint {
  id: string;
  label: string;
  uuid: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  aqi: number;
  band: AqiBandKey;
  pm25: number;
  pm10: number;
  co2: number;
  no2: number;
  o3: number;
  so2: number;
  co: number;
  temperature: number;
  humidity: number;
  battery: number;
  rssi: number;
  droneState: DroneState;
  status: 'online' | 'offline';
  serverTimestamp: string;
}

export interface HotspotCard {
  id: string;
  name: string;
  coord: string;
  lat: number;
  lng: number;
  aqi: number;
  metricKey: PollutantKey;
  metricLabel: string;
  metricUnit: string;
  metricValue: number;
  metricDisplayValue: string;
  band: AqiBandKey;
  trend: number;
  pollutant: string;
  sourceUuid?: string;
  radiusKm?: number;
}

export interface PollutantStat {
  key: PollutantKey;
  name: string;
  unit: string;
  value: number;
  delta: number;
  pct: number;
}

export interface FeedItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  meta: string;
  time: string;
  lat?: number;
  lng?: number;
  uuid?: string;
}



/* ═══════════════════════════ CONSTANTS ═══════════════════════════ */

const RANGE_SECONDS: Record<TimeRange, number> = {
  '1s': 60,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
};

/* ═══════════════════════════ PURE HELPERS ═══════════════════════════ */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export function formatCoord(lat: number, lng: number) {
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

export function formatAgo(iso: string) {
  if (!iso) return '--';
  const diffSec = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  return `${hours}h`;
}

export function seededSeries(seed: number, n: number, base: number, amp: number) {
  let state = seed + 1;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  const out: number[] = [];
  let value = base;
  for (let i = 0; i < n; i += 1) {
    value += (next() - 0.5) * amp * 0.4;
    value = clamp(value, base - amp, base + amp);
    if (next() > 0.94) value += (next() - 0.25) * amp;
    out.push(Math.max(10, value));
  }
  return out;
}

function resampleSeries(input: number[], target: number) {
  if (target <= 0) return [];
  if (input.length === 0) return seededSeries(target, target, 130, 25);
  if (input.length === 1) return Array.from({ length: target }, () => input[0]);

  const out: number[] = [];
  for (let i = 0; i < target; i += 1) {
    const idx = (i / (target - 1)) * (input.length - 1);
    const low = Math.floor(idx);
    const high = Math.min(input.length - 1, Math.ceil(idx));
    const ratio = idx - low;
    const value = input[low] + (input[high] - input[low]) * ratio;
    out.push(value);
  }
  return out;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidTelemetryRecord(drone: TelemetryRecord) {
  return (
    isFiniteNumber(drone.lat) &&
    isFiniteNumber(drone.lng) &&
    isFiniteNumber(drone.pm25) &&
    (drone.pm10 === undefined || drone.pm10 === null || isFiniteNumber(drone.pm10)) &&
    isFiniteNumber(drone.co2) &&
    isFiniteNumber(drone.no2) &&
    (drone.o3 === undefined || drone.o3 === null || isFiniteNumber(drone.o3)) &&
    (drone.so2 === undefined || drone.so2 === null || isFiniteNumber(drone.so2)) &&
    (drone.co === undefined || drone.co === null || isFiniteNumber(drone.co)) &&
    isFiniteNumber(drone.temperature) &&
    isFiniteNumber(drone.humidity) &&
    isFiniteNumber(drone.batteryLevel)
  );
}

export function makePath(data: number[], width: number, height: number, padding: { l: number; r: number; t: number; b: number }, maxValue: number) {
  if (data.length === 0) return '';
  const innerW = width - padding.l - padding.r;
  const innerH = height - padding.t - padding.b;

  return data
    .map((value, index) => {
      const x = padding.l + (index / Math.max(1, data.length - 1)) * innerW;
      const y = padding.t + innerH - (clamp(value, 0, maxValue) / maxValue) * innerH;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function toSensorPoint(drone: TelemetryRecord, index: number): SensorPoint {
  const latSpan = RIYADH_BOUNDS.maxLat - RIYADH_BOUNDS.minLat;
  const lngSpan = RIYADH_BOUNDS.maxLng - RIYADH_BOUNDS.minLng;
  const x = clamp((drone.lng - RIYADH_BOUNDS.minLng) / lngSpan, 0.06, 0.94);
  const y = clamp(1 - (drone.lat - RIYADH_BOUNDS.minLat) / latSpan, 0.08, 0.92);
  const aqi = pm25ToAqi(drone.pm25);
  const band = aqiBandFor(aqi).key;
  return {
    id: `S-${String(index + 1).padStart(3, '0')}`,
    label: `Sensor ${drone.uuid.slice(-4).toUpperCase()}`,
    uuid: drone.uuid,
    x, y,
    lat: drone.lat, lng: drone.lng,
    aqi, band,
    pm25: drone.pm25,
    pm10: drone.pm10 ?? drone.pm25 * 1.2,
    co2: drone.co2,
    no2: drone.no2,
    o3: drone.o3 ?? 0,
    so2: drone.so2 ?? 0,
    co: drone.co ?? 0,
    temperature: drone.temperature, humidity: drone.humidity,
    battery: drone.batteryLevel, rssi: drone.rssi,
    droneState: drone.state,
    status: drone.state === DroneState.OFFLINE ? 'offline' : 'online',
    serverTimestamp: drone.server_timestamp,
  };
}

function nearestSensorUuid(lat: number, lng: number, sensors: SensorPoint[]) {
  if (sensors.length === 0) return undefined;
  let closest = sensors[0];
  let best = Number.POSITIVE_INFINITY;
  for (const sensor of sensors) {
    const distance = Math.hypot(sensor.lat - lat, sensor.lng - lng);
    if (distance < best) { best = distance; closest = sensor; }
  }
  return closest.uuid;
}

function isSensorInBounds(sensor: SensorPoint, bounds: RiyadhMapBounds) {
  const inLat = sensor.lat >= bounds.south && sensor.lat <= bounds.north;
  const inLng =
    bounds.west <= bounds.east
      ? sensor.lng >= bounds.west && sensor.lng <= bounds.east
      : sensor.lng >= bounds.west || sensor.lng <= bounds.east;
  return inLat && inLng;
}

function hotspotsFromApi(hotspots: Hotspot[], sensors: SensorPoint[], metricKey: PollutantKey): HotspotCard[] {
  const metricConfig = getMapMetricConfig(metricKey);
  return hotspots.map((hotspot, index) => {
    const fallbackSensor = sensors[index % Math.max(1, sensors.length)];
    const metricValue = metricKey === 'pm25' ? hotspot.avg_pm25
      : fallbackSensor ? getMapMetricValue(metricKey, fallbackSensor)
        : getMapMetricConfig(metricKey).min;
    const aqi = pm25ToAqi(hotspot.avg_pm25);
    const band = bandForMetricValue(metricKey, metricValue);
    const trend = Math.round(((index % 3) - 1) * (4 + index * 2));
    const hotspotWithRadius = hotspot as Hotspot & { radius_km?: number; radiusKm?: number };
    const radiusCandidate = hotspotWithRadius.radiusKm ?? hotspotWithRadius.radius_km;
    const radiusKm = typeof radiusCandidate === 'number' && Number.isFinite(radiusCandidate) && radiusCandidate > 0 ? radiusCandidate : undefined;
    return {
      id: `API-${index + 1}`, name: `Zone ${hotspot.lat_zone.toFixed(2)} · ${hotspot.lng_zone.toFixed(2)}`,
      coord: formatCoord(hotspot.lat_zone, hotspot.lng_zone), lat: hotspot.lat_zone, lng: hotspot.lng_zone,
      aqi, metricKey, metricLabel: metricConfig.label, metricUnit: metricConfig.unit, metricValue,
      metricDisplayValue: formatMetricValue(metricKey, metricValue), band, trend,
      pollutant: metricConfig.label, sourceUuid: nearestSensorUuid(hotspot.lat_zone, hotspot.lng_zone, sensors), radiusKm,
    };
  });
}

function hotspotsFromSensors(sensors: SensorPoint[], metricKey: PollutantKey): HotspotCard[] {
  const metricConfig = getMapMetricConfig(metricKey);
  return [...sensors]
    .sort((left, right) => getMapMetricValue(metricKey, right) - getMapMetricValue(metricKey, left))
    .slice(0, 7)
    .map((sensor, index) => {
      const metricValue = getMapMetricValue(metricKey, sensor);
      return {
        id: `SNS-${index + 1}`, name: sensor.label,
        coord: formatCoord(sensor.lat, sensor.lng), lat: sensor.lat, lng: sensor.lng,
        aqi: sensor.aqi, metricKey, metricLabel: metricConfig.label, metricUnit: metricConfig.unit,
        metricValue, metricDisplayValue: formatMetricValue(metricKey, metricValue),
        band: bandForMetricValue(metricKey, metricValue), trend: Math.round((metricValue % 12) - 3),
        pollutant: metricConfig.label, sourceUuid: sensor.uuid,
      };
    });
}

/* ═══════════════════════════ THE HOOK ═══════════════════════════ */

const STORAGE_KEYS = {
  TAB: 'climence.active-tab',
  MODE: 'climence.map-mode',
  POLLUTANT: 'climence.active-pollutant',
  RANGE: 'climence.active-range',
};

export function useDashboardData(
  snapshot: TelemetrySnapshot,
  status: ConnectionStatus,
  authToken: string,
  authUser: AuthUser,
  locale: Locale,
  dataSource?: 'live' | 'stationary',
  stationaryHeatmapPoints?: HeatmapPoint[],
) {
  const t = useCallback((key: DictKey) => translate(key, locale), [locale]);

  const [mode, setMode] = useState<ViewMode>(() => (localStorage.getItem(STORAGE_KEYS.MODE) as ViewMode) || 'heatmap');
  const [pollutant, setPollutant] = useState<PollutantKey>(() => (localStorage.getItem(STORAGE_KEYS.POLLUTANT) as PollutantKey) || 'pm25');
  const [range, setRange] = useState<TimeRange>(() => (localStorage.getItem(STORAGE_KEYS.RANGE) as TimeRange) || '15m');
  const [selected, setSelected] = useState<HotspotCard | null>(null);
  const [mapBounds, setMapBounds] = useState<RiyadhMapBounds | null>(null);
  const [mapZoom, setMapZoom] = useState(11);
  const [zoomPreset, setZoomPreset] = useState<RiyadhZoomPreset>('city');
  const [currentTab, setCurrentTab] = useState<'overview' | 'livemap' | 'analytics' | 'alerts' | 'sensors' | 'reports'>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.TAB);
    const allowed = ['overview', 'livemap', 'analytics', 'alerts', 'sensors', 'reports'] as const;
    return (allowed.includes(stored as (typeof allowed)[number]) ? (stored as (typeof allowed)[number]) : 'overview');
  });
  const [mapFocusTarget, setMapFocusTarget] = useState<{ lat: number; lng: number; zoom?: number; nonce: number; uuid?: string } | null>(null);
  const [historySeries, setHistorySeries] = useState<number[]>([]);
  const [historySourceUuid, setHistorySourceUuid] = useState<string | null>(null);
  const [alertThreshold, setAlertThreshold] = useState(PM25_ALERT_THRESHOLD);
  const [alertThresholdDraft, setAlertThresholdDraft] = useState(String(PM25_ALERT_THRESHOLD));
  const [alertConfigState, setAlertConfigState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertRuleState, setAlertRuleState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');


  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TAB, currentTab);
  }, [currentTab]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MODE, mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.POLLUTANT, pollutant);
  }, [pollutant]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RANGE, range);
  }, [range]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    fetchAlertConfig(authToken)
      .then(config => { if (!cancelled) { setAlertThreshold(config.pm25Threshold); setAlertThresholdDraft(String(config.pm25Threshold)); } })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    fetchAlertRules(authToken)
      .then(rules => { if (!cancelled) setAlertRules(rules); })
      .catch(() => { if (!cancelled) setAlertRuleState('error'); });
    return () => { cancelled = true; };
  }, [authToken]);



  const validDrones = useMemo(
    () => snapshot.drones.filter(isValidTelemetryRecord),
    [snapshot.drones],
  );

  const sensorProjectionSignature = useMemo(
    () => validDrones.map(d => [d.uuid, d.state, d.lat, d.lng, d.pm25, d.pm10, d.co2, d.no2, d.o3, d.so2, d.co, d.temperature, d.humidity, d.batteryLevel, d.rssi, d.server_timestamp].join(':')).join('|'),
    [validDrones],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sensors = useMemo(() => validDrones.map((d, i) => toSensorPoint(d, i)).sort((a, b) => b.aqi - a.aqi), [sensorProjectionSignature, validDrones]);
  const onlineSensors = useMemo(() => sensors.filter(s => s.status === 'online').length, [sensors]);
  const sensorsInView = useMemo(() => mapBounds ? sensors.filter(s => isSensorInBounds(s, mapBounds)) : sensors, [mapBounds, sensors]);
  const onlineSensorsInView = useMemo(() => sensorsInView.filter(s => s.status === 'online').length, [sensorsInView]);

  const hotspots = useMemo(() => {
    if (snapshot.hotspots.length > 0) {
      const fromApi = pollutant === 'pm25' ? hotspotsFromApi(snapshot.hotspots, sensors, pollutant) : [];
      if (fromApi.length >= 7) return fromApi;
      return [...fromApi, ...hotspotsFromSensors(sensors, pollutant)].slice(0, 7);
    }
    return hotspotsFromSensors(sensors, pollutant);
  }, [pollutant, snapshot.hotspots, sensors]);

  const selectedHotspot = useMemo(() => {
    if (!selected) return null;
    const inHotspots = hotspots.find(h => h.id === selected.id);
    if (inHotspots) return inHotspots;

    // If it's a sensor that isn't in the top hotspots, look it up in sensors to keep values live
    if (selected.sourceUuid) {
      const source = sensors.find(s => s.uuid === selected.sourceUuid);
      if (source) {
        const metricValue = getMapMetricValue(pollutant, source);
        return {
          ...selected,
          lat: source.lat,
          lng: source.lng,
          aqi: source.aqi,
          metricKey: pollutant,
          metricValue,
          metricDisplayValue: formatMetricValue(pollutant, metricValue),
          band: bandForMetricValue(pollutant, metricValue)
        };
      }
    }
    return selected;
  }, [hotspots, selected, sensors, pollutant]);

  const mapHeatmapPoints = useMemo<HeatmapPoint[]>(
    () => sensors.map(s => ({ lat: s.lat, lng: s.lng, intensity: heatIntensityForMetric(pollutant, getMapMetricValue(pollutant, s)) })),
    [pollutant, sensors],
  );

  const mapHotspots = useMemo<RiyadhMapHotspot[]>(
    () => [
      ...hotspots.map(h => ({ id: h.id, lat: h.lat, lng: h.lng, aqi: h.aqi, band: h.band, radiusKm: h.radiusKm, label: h.name, valueLabel: `${h.metricLabel} ${h.metricDisplayValue} ${h.metricUnit}` })),
      ...(snapshot.hotspotClusters ?? []).map((cluster, index) => ({
        id: `cluster-${index}`,
        lat: cluster.centroidLat,
        lng: cluster.centroidLng,
        aqi: Math.round(cluster.score * 300),
        band: cluster.severity === 'critical' ? 'haz' as AqiBandKey : cluster.severity === 'high' ? 'unh' as AqiBandKey : cluster.severity === 'medium' ? 'usg' as AqiBandKey : 'mod' as AqiBandKey,
        radiusKm: cluster.radiusKm,
        label: `Hotspot – ${cluster.dominantPollutant ?? 'PM2.5'}`,
        valueLabel: `Peak PM2.5 ${Math.round(cluster.peakPm25)} · ${cluster.memberUuids.length} sensors`,
        dominantPollutant: cluster.dominantPollutant,
        severity: cluster.severity,
      })),
    ],
    [hotspots, snapshot.hotspotClusters],
  );

  useEffect(() => {
    if (!selectedHotspot) return;
    const fallback = seededSeries(selectedHotspot.aqi + selectedHotspot.name.length, 48, selectedHotspot.aqi * 0.7, 50);
    if (!selectedHotspot.sourceUuid || !authToken) return;
    const sourceUuid = selectedHotspot.sourceUuid;
    let cancelled = false;
    fetchHistory(sourceUuid, authToken)
      .then(rows => {
        if (cancelled) return;
        const history = rows.map(row => getMapMetricValue(selectedHotspot.metricKey, { pm25: row.pm25, pm10: row.pm10 ?? row.pm25 * 1.2, co2: row.co2, no2: row.no2, o3: row.o3 ?? 0, so2: row.so2 ?? 0, co: row.co ?? 0, temperature: row.temperature, humidity: row.humidity, battery: row.batteryLevel }));
        setHistorySeries(history.length > 1 ? history : fallback);
        setHistorySourceUuid(sourceUuid);
      })
      .catch(() => { if (!cancelled) { setHistorySeries(fallback); setHistorySourceUuid(sourceUuid); } });
    return () => { cancelled = true; };
  }, [authToken, selectedHotspot]);

  const basePm25Series = useMemo(() => {
    const raw = snapshot.cityTrend.map(p => p.avg_pm25);
    if (raw.length > 1) {
      return raw.slice(-RANGE_SECONDS[range]);
    }
    return seededSeries(17, 40, average(sensors.slice(0, 12).map(s => s.pm25)) || 85, 24);
  }, [snapshot.cityTrend, sensors, range]);

  const pm25Series = useMemo(() => {
    const aqiSeries = basePm25Series.map(v => pm25ToAqi(v));
    const targetPoints = Math.min(aqiSeries.length, 120);
    return resampleSeries(aqiSeries, targetPoints);
  }, [basePm25Series]);
  const baseNo2Series = useMemo(() => {
    const raw = snapshot.cityTrend.map(p => p.avg_no2 ?? 40);
    if (raw.length > 1) {
      return raw.slice(-RANGE_SECONDS[range]);
    }
    return seededSeries(25, 40, average(sensors.slice(0, 12).map(s => s.no2)) || 45, 10);
  }, [snapshot.cityTrend, sensors, range]);

  const baseCo2Series = useMemo(() => {
    const raw = snapshot.cityTrend.map(p => p.avg_co2 ?? 400);
    if (raw.length > 1) {
      return raw.slice(-RANGE_SECONDS[range]);
    }
    return seededSeries(33, 40, average(sensors.slice(0, 12).map(s => s.co2)) || 400, 30);
  }, [snapshot.cityTrend, sensors, range]);

  const pm10Series = useMemo(() => pm25Series.map(v => clamp(v * 1.18, 18, 260)), [pm25Series]);

  const no2Series = useMemo(() => {
    const targetPoints = Math.min(baseNo2Series.length, 120);
    return resampleSeries(baseNo2Series, targetPoints);
  }, [baseNo2Series]);

  const co2Series = useMemo(() => {
    const targetPoints = Math.min(baseCo2Series.length, 120);
    const scaled = resampleSeries(baseCo2Series, targetPoints);
    // Scale CO2 so it visually fits in the 0-220 chart scale (e.g. 400->40, 600->120)
    return scaled.map(v => clamp((v - 300) * 0.4, 0, 220));
  }, [baseCo2Series]);

  const trend = useMemo(() => detectTrend(pm25Series), [pm25Series]);
  const forecast = useMemo(() => computeForecast(pm25Series, 6), [pm25Series]);
  const sourcesLive = useMemo(() => computeSourceAttribution(sensors), [sensors]);
  const drift = useMemo(() => computeDriftVector(sensors.map(s => ({ lat: s.lat, lng: s.lng, pm25: s.pm25 }))), [sensors]);

  const sourceNameKey: Record<string, DictKey> = { traffic: 'src.traffic', industry: 'src.industry', dust: 'src.dust', other: 'src.other' };
  const sources = sourcesLive.map(s => ({ ...s, name: t(sourceNameKey[s.key]) }));
  const trendLabel = trend.direction === 'worsening' ? t('trend.worsening') : trend.direction === 'improving' ? t('trend.improving') : t('trend.stable');

  const cityAqi = Math.round(average(sensors.map(s => s.aqi)) || pm25Series[pm25Series.length - 1] || 0);
  const cityBand = aqiBandFor(cityAqi).key;

  const pm25Now = Math.round(average(sensors.map(s => s.pm25)) || 0);
  const pm10Now = Math.round(average(sensors.map(s => s.pm10 ?? s.pm25 * 1.2)) || 0);
  const co2Now = Math.round(average(sensors.map(s => s.co2)) || 0);
  const no2Now = Math.round(average(sensors.map(s => s.no2)) || 0);
  const o3Now = Math.round(average(sensors.map(s => s.o3 ?? 0)) || 0);
  const so2Now = Math.round(average(sensors.map(s => s.so2 ?? 0)) || 0);
  const coNow = Math.round(average(sensors.map(s => s.co ?? 0)) || 0);
  const tempNow = Math.round(average(sensors.map(s => s.temperature)) || 0);
  const humidityNow = Math.round(average(sensors.map(s => s.humidity)) || 0);
  const batteryNow = Math.round(average(sensors.map(s => s.battery)) || 0);
  const currentDelta = Math.round((pm25Series[pm25Series.length - 1] ?? cityAqi) - (pm25Series[pm25Series.length - 2] ?? cityAqi));

  const pollutantStats = useMemo<PollutantStat[]>(() => [
    { key: 'pm25', name: 'PM2.5', unit: 'ug/m3', value: pm25Now, delta: Math.round((pm25Series[pm25Series.length - 1] ?? 0) - (pm25Series[pm25Series.length - 2] ?? 0)), pct: clamp((pm25Now / 150) * 100, 4, 100) },
    { key: 'pm10', name: 'PM10', unit: 'ug/m3', value: pm10Now, delta: Math.round(((pm10Now - 60) / 60) * 10), pct: clamp((pm10Now / 200) * 100, 4, 100) },
    { key: 'co2', name: 'CO2', unit: 'ppm', value: co2Now, delta: Math.round(((co2Now - 520) / 520) * 20), pct: clamp((co2Now / 950) * 100, 4, 100) },
    { key: 'no2', name: 'NO2', unit: 'ppb', value: no2Now, delta: Math.round(((no2Now - 35) / 35) * 12), pct: clamp((no2Now / 90) * 100, 4, 100) },
    { key: 'o3', name: 'O3', unit: 'ug/m3', value: o3Now, delta: Math.round(((o3Now - 60) / 60) * 10), pct: clamp((o3Now / 180) * 100, 4, 100) },
    { key: 'so2', name: 'SO2', unit: 'ug/m3', value: so2Now, delta: Math.round(((so2Now - 10) / 10) * 8), pct: clamp((so2Now / 50) * 100, 4, 100) },
    { key: 'co', name: 'CO', unit: 'mg/m3', value: coNow, delta: Math.round(((coNow - 2) / 2) * 6), pct: clamp((coNow / 10) * 100, 4, 100) },
    { key: 'temperature', name: t('sensors.temp'), unit: 'degC', value: tempNow, delta: Math.round(((tempNow - 30) / 30) * 8), pct: clamp((tempNow / 45) * 100, 4, 100) },
    { key: 'humidity', name: t('weather.humidity'), unit: '%', value: humidityNow, delta: Math.round(((humidityNow - 35) / 35) * 8), pct: clamp((humidityNow / 100) * 100, 4, 100) },
    { key: 'battery', name: t('sensors.battery'), unit: '%', value: batteryNow, delta: Math.round(((batteryNow - 60) / 60) * 6), pct: clamp((batteryNow / 100) * 100, 4, 100) },
  ], [batteryNow, co2Now, humidityNow, no2Now, o3Now, pm10Now, pm25Now, pm25Series, so2Now, coNow, t, tempNow]);

  const pollutantMap = useMemo<Record<PollutantKey, number>>(() => ({ pm25: pm25Now, pm10: pm10Now, co2: co2Now, no2: no2Now, o3: o3Now, so2: so2Now, co: coNow, temperature: tempNow, humidity: humidityNow, battery: batteryNow }), [batteryNow, co2Now, humidityNow, no2Now, o3Now, pm10Now, pm25Now, so2Now, coNow, tempNow]);

  const effectiveAlertThreshold = Number.isFinite(snapshot.alertThresholdPm25) && snapshot.alertThresholdPm25 > 0 ? snapshot.alertThresholdPm25 : alertThreshold;
  const activeAlertEvents = snapshot.alertEvents ?? [];
  const clearedAlertEvents = snapshot.clearedAlertEvents ?? [];

  const feed = useMemo<FeedItem[]>(() => {
    if (activeAlertEvents.length > 0) {
      return activeAlertEvents.map(event => {
        const value = Math.round(event.peak_value * 10) / 10;
        const label = (event.pollutant_type ?? 'pm25').toUpperCase();
        return {
          id: `event-${event.event_id}`,
          severity: event.peak_value >= (event.threshold_value ?? effectiveAlertThreshold) * 1.5 ? 'crit' : 'warn',
          title: `${label} ${event.condition_operator ?? '>'} ${event.threshold_value ?? '--'} · peak ${value}`,
          meta: `Rule #${event.rule_id} · ${event.notification_channel ?? 'system'}`,
          time: formatAgo(event.triggered_at),
        };
      });
    }

    if (snapshot.alerts.length > 0) {
      return snapshot.alerts.map(alert => {
        let severity: AlertSeverity = 'info';
        if (alert.pm25 >= effectiveAlertThreshold + 45) severity = 'crit';
        else if (alert.pm25 >= effectiveAlertThreshold) severity = 'warn';
        return {
          id: `${alert.uuid}-${alert.id}`,
          severity,
          title: tFormat('feed.pm25Exceeded', locale, { value: `${Math.round(alert.pm25)} (AQI: ${Math.round(pm25ToAqi(alert.pm25))})` }),
          meta: `${alert.uuid} · ${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}`,
          time: formatAgo(alert.server_timestamp),
          lat: alert.lat,
          lng: alert.lng,
          uuid: alert.uuid
        };
      });
    }
    return hotspots.slice(0, 5).map((h, i) => ({
      id: `fallback-${h.id}`,
      severity: (i === 0 ? 'crit' : i < 3 ? 'warn' : 'ok') as AlertSeverity,
      title: tFormat('feed.monitoringAdvisory', locale, { name: h.name }),
      meta: tFormat('feed.metaDominant', locale, { coord: h.coord, label: h.metricLabel, value: h.metricDisplayValue, unit: h.metricUnit }),
      time: `${(i + 1) * 5}m`,
      lat: h.lat,
      lng: h.lng
    }));
  }, [activeAlertEvents, effectiveAlertThreshold, hotspots, locale, snapshot.alerts]);

  const liveAge = formatAgo(snapshot.emittedAt);
  const activePollutant = pollutantStats.find(s => s.key === pollutant)?.name ?? 'PM2.5';
  const activeMetricConfig = useMemo(() => getMapMetricConfig(pollutant), [pollutant]);
  const drawerHistorySeries = selectedHotspot?.sourceUuid && historySourceUuid === selectedHotspot.sourceUuid ? historySeries : [];
  const thresholdExceededBy = Math.max(0, pm25Now - effectiveAlertThreshold);
  const canManageAlertSettings = authUser?.role === UserRole.ADMINISTRATOR || authUser?.role === UserRole.ANALYST;

  const handlePickSensor = useCallback((sensor: RiyadhMapSensor) => {
    const source = sensors.find(item => item.uuid === sensor.uuid);
    const id = source?.id ?? `S-${sensor.uuid.slice(-4).toUpperCase()}`;
    const metricValue = getMapMetricValue(pollutant, source ?? { pm25: sensor.pm25, pm10: sensor.pm10 ?? sensor.pm25 * 1.2, co2: 0, no2: 0, o3: 0, so2: 0, co: 0, temperature: 0, humidity: 0, battery: sensor.battery });
    setSelected({ id, name: sensor.label, coord: formatCoord(sensor.lat, sensor.lng), lat: sensor.lat, lng: sensor.lng, aqi: sensor.aqi, metricKey: pollutant, metricLabel: activeMetricConfig.label, metricUnit: activeMetricConfig.unit, metricValue, metricDisplayValue: formatMetricValue(pollutant, metricValue), band: bandForMetricValue(pollutant, metricValue), trend: Math.round((metricValue % 15) - 4), pollutant: activeMetricConfig.label, sourceUuid: sensor.uuid });
    setZoomPreset('zone');
    setMapFocusTarget({ lat: sensor.lat, lng: sensor.lng, zoom: 14, nonce: Date.now(), uuid: sensor.uuid });
  }, [activeMetricConfig, pollutant, sensors]);

  const handleMapViewportChange = useCallback((viewport: { bounds: RiyadhMapBounds; zoom: number }) => { setMapBounds(viewport.bounds); setMapZoom(viewport.zoom); }, []);

  const handlePickHotspot = useCallback((hotspot: HotspotCard) => {
    setSelected(hotspot);
    setZoomPreset('zone');
    setMapFocusTarget({ lat: hotspot.lat, lng: hotspot.lng, zoom: 14, nonce: Date.now() });
  }, []);

  const handleSaveAlertThreshold = useCallback(() => {
    if (!authToken) { setAlertConfigState('error'); return; }
    const parsed = Number(alertThresholdDraft);
    if (!Number.isFinite(parsed)) { setAlertConfigState('error'); return; }
    setAlertConfigState('saving');
    updateAlertConfig(parsed, authToken)
      .then(config => { setAlertThreshold(config.pm25Threshold); setAlertThresholdDraft(String(config.pm25Threshold)); setAlertConfigState('saved'); })
      .catch(() => { setAlertConfigState('error'); });
  }, [alertThresholdDraft, authToken]);

  const refreshAlertRules = useCallback(() => {
    if (!authToken) return;
    fetchAlertRules(authToken)
      .then(setAlertRules)
      .catch(() => setAlertRuleState('error'));
  }, [authToken]);

  const handleCreateAlertRule = useCallback((input: AlertRuleInput) => {
    if (!authToken) { setAlertRuleState('error'); return; }
    setAlertRuleState('saving');
    createAlertRule(input, authToken)
      .then(rule => {
        setAlertRules(prev => [rule, ...prev]);
        setAlertRuleState('saved');
      })
      .catch(() => setAlertRuleState('error'));
  }, [authToken]);

  const handleUpdateAlertRule = useCallback((ruleId: number, input: Partial<AlertRuleInput>) => {
    if (!authToken) { setAlertRuleState('error'); return; }
    setAlertRuleState('saving');
    updateAlertRule(ruleId, input, authToken)
      .then(rule => {
        setAlertRules(prev => prev.map(item => item.rule_id === rule.rule_id ? rule : item));
        setAlertRuleState('saved');
      })
      .catch(() => setAlertRuleState('error'));
  }, [authToken]);

  const handleDeleteAlertRule = useCallback((ruleId: number) => {
    if (!authToken) { setAlertRuleState('error'); return; }
    setAlertRuleState('saving');
    deleteAlertRule(ruleId, authToken)
      .then(() => {
        setAlertRules(prev => prev.filter(item => item.rule_id !== ruleId));
        setAlertRuleState('saved');
      })
      .catch(() => setAlertRuleState('error'));
  }, [authToken]);

  const sensorLegend: Array<{ label: string; key: PollutantKey }> = POLLUTANT_METRIC_OPTIONS;

  const reportPayload = useMemo<ReportPayload>(() => ({
    snapshot, cityAqi, cityBandLabel: aqiBandFor(cityAqi).label, activeThreshold: effectiveAlertThreshold,
    onlineSensors, totalSensors: sensors.length,
    hotspots: hotspots.map(h => ({ name: h.name, coord: h.coord, aqi: h.aqi, trend: h.trend })),
    sources: sources.map(s => ({ name: s.name, pct: s.pct })),
    forecast: forecast.map(f => ({ hr: f.hr, val: f.val })),
    trendLabel, generatedBy: authUser ? `${authUser.name} (${authUser.role})` : 'Unknown',
  }), [authUser, cityAqi, effectiveAlertThreshold, forecast, hotspots, onlineSensors, sensors.length, snapshot, sources, trendLabel]);



  const effectiveHeatmapPoints =
    dataSource === 'stationary' && stationaryHeatmapPoints && stationaryHeatmapPoints.length > 0
      ? stationaryHeatmapPoints
      : mapHeatmapPoints;

  return {
    // layout
    locale,
    currentTab, setCurrentTab,
    mode, setMode, pollutant, setPollutant, range, setRange,
    // sensors
    sensors, onlineSensors, sensorsInView, onlineSensorsInView,
    // hotspots
    hotspots, selectedHotspot, selected, setSelected,
    // map
  mapHeatmapPoints: effectiveHeatmapPoints, mapHotspots, zoomPreset, setZoomPreset, mapFocusTarget, mapBounds, mapZoom,
    handlePickSensor, handleMapViewportChange, handlePickHotspot,
    // trend / forecast / sources
    pm25Series, pm10Series, no2Series, co2Series, trend, trendLabel, forecast, sources, drift,
    // city
    cityAqi, cityBand, pm25Now, co2Now, no2Now, tempNow, humidityNow, batteryNow, currentDelta,
    // pollutants
    pollutantStats, pollutantMap, activePollutant, activeMetricConfig, sensorLegend,
    // alerts
    effectiveAlertThreshold, feed, alertThresholdDraft, setAlertThresholdDraft, alertConfigState, setAlertConfigState,
    handleSaveAlertThreshold, canManageAlertSettings, thresholdExceededBy,
    alertRules, activeAlertEvents: activeAlertEvents as AlertEvent[], clearedAlertEvents: clearedAlertEvents as AlertEvent[],
    alertRuleState, setAlertRuleState, refreshAlertRules, handleCreateAlertRule, handleUpdateAlertRule, handleDeleteAlertRule,
    // history drawer
    drawerHistorySeries, historySeries,

    // meta
    liveAge, status, t, reportPayload,
  };
}

export type DashboardData = ReturnType<typeof useDashboardData>;
