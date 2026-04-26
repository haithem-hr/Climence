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
  type AuthUser,
  type Hotspot,
  type TelemetryRecord,
  type TelemetrySnapshot,
} from '@climence/shared';
import { fetchAlertConfig, fetchHistory, updateAlertConfig } from '../api/client';
import type { RiyadhMapBounds, RiyadhMapHotspot, RiyadhMapSensor, RiyadhZoomPreset } from '../components/map/RiyadhGoogleMap';
import type { HeatmapPoint } from '../components/map/HeatmapLayer';
import { computeDriftVector, computeForecast, computeSourceAttribution, detectTrend } from '../lib/analytics';
import { translate, type DictKey, type Locale } from '../lib/i18n';
import {
  bandForMetricValue,
  formatMetricValue,
  getMapMetricConfig,
  getMapMetricValue,
  heatIntensityForMetric,
  type MapMetricKey,
} from '../lib/mapMetrics';
import type { ReportPayload } from '../lib/reports';
import type { ConnectionStatus } from './useLiveTelemetry';

/* ═══════════════════════════ TYPES ═══════════════════════════ */

export type ViewMode = 'hardware' | 'heatmap';
export type TimeRange = '1h' | '24h' | '7d' | '30d';
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
  co2: number;
  no2: number;
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
}

/* ═══════════════════════════ CONSTANTS ═══════════════════════════ */

const RANGE_POINTS: Record<TimeRange, number> = {
  '1h': 20,
  '24h': 48,
  '7d': 84,
  '30d': 120,
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
    pm25: drone.pm25, co2: drone.co2, no2: drone.no2,
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

export function useDashboardData(
  snapshot: TelemetrySnapshot,
  status: ConnectionStatus,
  authToken: string,
  authUser: AuthUser,
  locale: Locale,
) {
  const t = useCallback((key: DictKey) => translate(key, locale), [locale]);

  const [mode, setMode] = useState<ViewMode>('heatmap');
  const [pollutant, setPollutant] = useState<PollutantKey>('pm25');
  const [range, setRange] = useState<TimeRange>('24h');
  const [selected, setSelected] = useState<HotspotCard | null>(null);
  const [mapBounds, setMapBounds] = useState<RiyadhMapBounds | null>(null);
  const [mapZoom, setMapZoom] = useState(11);
  const [zoomPreset, setZoomPreset] = useState<RiyadhZoomPreset>('city');
  const [currentTab, setCurrentTab] = useState<'overview' | 'analytics'>('overview');
  const [mapFocusTarget, setMapFocusTarget] = useState<{ lat: number; lng: number; zoom?: number; nonce: number } | null>(null);
  const [historySeries, setHistorySeries] = useState<number[]>([]);
  const [historySourceUuid, setHistorySourceUuid] = useState<string | null>(null);
  const [alertThreshold, setAlertThreshold] = useState(PM25_ALERT_THRESHOLD);
  const [alertThresholdDraft, setAlertThresholdDraft] = useState(String(PM25_ALERT_THRESHOLD));
  const [alertConfigState, setAlertConfigState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    fetchAlertConfig(authToken)
      .then(config => { if (!cancelled) { setAlertThreshold(config.pm25Threshold); setAlertThresholdDraft(String(config.pm25Threshold)); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [authToken]);

  const sensorProjectionSignature = useMemo(
    () => snapshot.drones.map(d => [d.uuid, d.state, d.lat, d.lng, d.pm25, d.co2, d.no2, d.temperature, d.humidity, d.batteryLevel, d.rssi, d.server_timestamp].join(':')).join('|'),
    [snapshot.drones],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sensors = useMemo(() => snapshot.drones.map((d, i) => toSensorPoint(d, i)).sort((a, b) => b.aqi - a.aqi), [sensorProjectionSignature]);
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

  const selectedHotspot = useMemo(() => !selected ? null : hotspots.find(h => h.id === selected.id) ?? null, [hotspots, selected]);

  const mapHeatmapPoints = useMemo<HeatmapPoint[]>(
    () => sensors.map(s => ({ lat: s.lat, lng: s.lng, intensity: heatIntensityForMetric(pollutant, getMapMetricValue(pollutant, s)) })),
    [pollutant, sensors],
  );

  const mapHotspots = useMemo<RiyadhMapHotspot[]>(
    () => hotspots.map(h => ({ id: h.id, lat: h.lat, lng: h.lng, aqi: h.aqi, band: h.band, radiusKm: h.radiusKm, label: h.name, valueLabel: `${h.metricLabel} ${h.metricDisplayValue} ${h.metricUnit}` })),
    [hotspots],
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
        const history = rows.map(row => getMapMetricValue(selectedHotspot.metricKey, { pm25: row.pm25, co2: row.co2, no2: row.no2, temperature: row.temperature, humidity: row.humidity, battery: row.batteryLevel }));
        setHistorySeries(history.length > 1 ? history : fallback);
        setHistorySourceUuid(sourceUuid);
      })
      .catch(() => { if (!cancelled) { setHistorySeries(fallback); setHistorySourceUuid(sourceUuid); } });
    return () => { cancelled = true; };
  }, [authToken, selectedHotspot]);

  const basePm25Series = useMemo(() => { const raw = snapshot.cityTrend.map(p => p.avg_pm25); if (raw.length > 1) return raw; return seededSeries(17, 40, average(sensors.slice(0, 12).map(s => s.pm25)) || 85, 24); }, [snapshot.cityTrend, sensors]);
  const pm25Series = useMemo(() => resampleSeries(basePm25Series.map(v => pm25ToAqi(v)), RANGE_POINTS[range]), [basePm25Series, range]);
  const pm10Series = useMemo(() => pm25Series.map(v => clamp(v * 1.18, 18, 260)), [pm25Series]);
  const no2Series = useMemo(() => pm25Series.map(v => clamp(v * 0.68 + 22, 8, 180)), [pm25Series]);

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
  const co2Now = Math.round(average(sensors.map(s => s.co2)) || 0);
  const no2Now = Math.round(average(sensors.map(s => s.no2)) || 0);
  const tempNow = Math.round(average(sensors.map(s => s.temperature)) || 0);
  const humidityNow = Math.round(average(sensors.map(s => s.humidity)) || 0);
  const batteryNow = Math.round(average(sensors.map(s => s.battery)) || 0);
  const currentDelta = Math.round((pm25Series[pm25Series.length - 1] ?? cityAqi) - (pm25Series[pm25Series.length - 2] ?? cityAqi));

  const pollutantStats = useMemo<PollutantStat[]>(() => [
    { key: 'pm25', name: 'PM2.5', unit: 'ug/m3', value: pm25Now, delta: Math.round((pm25Series[pm25Series.length - 1] ?? 0) - (pm25Series[pm25Series.length - 2] ?? 0)), pct: clamp((pm25Now / 150) * 100, 4, 100) },
    { key: 'co2', name: 'CO2', unit: 'ppm', value: co2Now, delta: Math.round(((co2Now - 520) / 520) * 20), pct: clamp((co2Now / 950) * 100, 4, 100) },
    { key: 'no2', name: 'NO2', unit: 'ppb', value: no2Now, delta: Math.round(((no2Now - 35) / 35) * 12), pct: clamp((no2Now / 90) * 100, 4, 100) },
    { key: 'temperature', name: 'Temp', unit: 'degC', value: tempNow, delta: Math.round(((tempNow - 30) / 30) * 8), pct: clamp((tempNow / 45) * 100, 4, 100) },
    { key: 'humidity', name: 'Humidity', unit: '%', value: humidityNow, delta: Math.round(((humidityNow - 35) / 35) * 8), pct: clamp((humidityNow / 100) * 100, 4, 100) },
    { key: 'battery', name: 'Battery', unit: '%', value: batteryNow, delta: Math.round(((batteryNow - 60) / 60) * 6), pct: clamp((batteryNow / 100) * 100, 4, 100) },
  ], [batteryNow, co2Now, humidityNow, no2Now, pm25Now, pm25Series, tempNow]);

  const pollutantMap = useMemo<Record<PollutantKey, number>>(() => ({ pm25: pm25Now, co2: co2Now, no2: no2Now, temperature: tempNow, humidity: humidityNow, battery: batteryNow }), [batteryNow, co2Now, humidityNow, no2Now, pm25Now, tempNow]);

  const effectiveAlertThreshold = Number.isFinite(snapshot.alertThresholdPm25) && snapshot.alertThresholdPm25 > 0 ? snapshot.alertThresholdPm25 : alertThreshold;

  const feed = useMemo<FeedItem[]>(() => {
    if (snapshot.alerts.length > 0) {
      return snapshot.alerts.slice(0, 7).map(alert => {
        let severity: AlertSeverity = 'info';
        if (alert.pm25 >= effectiveAlertThreshold + 45) severity = 'crit';
        else if (alert.pm25 >= effectiveAlertThreshold) severity = 'warn';
        return { id: `${alert.uuid}-${alert.id}`, severity, title: `PM2.5 threshold exceeded · ${Math.round(alert.pm25)} ug/m3`, meta: `${alert.uuid.slice(0, 8)} · ${alert.state}`, time: formatAgo(alert.server_timestamp) };
      });
    }
    return hotspots.slice(0, 5).map((h, i) => ({ id: `fallback-${h.id}`, severity: (i === 0 ? 'crit' : i < 3 ? 'warn' : 'ok') as AlertSeverity, title: `${h.name} monitoring advisory`, meta: `${h.coord} · ${h.metricLabel} ${h.metricDisplayValue} ${h.metricUnit}`, time: `${(i + 1) * 5}m` }));
  }, [effectiveAlertThreshold, snapshot.alerts, hotspots]);

  const liveAge = formatAgo(snapshot.emittedAt);
  const activePollutant = pollutantStats.find(s => s.key === pollutant)?.name ?? 'PM2.5';
  const activeMetricConfig = useMemo(() => getMapMetricConfig(pollutant), [pollutant]);
  const drawerHistorySeries = selectedHotspot?.sourceUuid && historySourceUuid === selectedHotspot.sourceUuid ? historySeries : [];
  const thresholdExceededBy = Math.max(0, pm25Now - effectiveAlertThreshold);
  const canManageAlertSettings = authUser?.role === UserRole.ADMINISTRATOR;

  const handlePickSensor = useCallback((sensor: RiyadhMapSensor) => {
    const source = sensors.find(item => item.uuid === sensor.uuid);
    const id = source?.id ?? `S-${sensor.uuid.slice(-4).toUpperCase()}`;
    const metricValue = getMapMetricValue(pollutant, source ?? { pm25: sensor.pm25, co2: 0, no2: 0, temperature: 0, humidity: 0, battery: sensor.battery });
    setSelected({ id, name: sensor.label, coord: formatCoord(sensor.lat, sensor.lng), lat: sensor.lat, lng: sensor.lng, aqi: sensor.aqi, metricKey: pollutant, metricLabel: activeMetricConfig.label, metricUnit: activeMetricConfig.unit, metricValue, metricDisplayValue: formatMetricValue(pollutant, metricValue), band: bandForMetricValue(pollutant, metricValue), trend: Math.round((metricValue % 15) - 4), pollutant: activeMetricConfig.label, sourceUuid: sensor.uuid });
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

  const sensorLegend: Array<{ label: string; key: PollutantKey }> = [
    { label: 'PM2.5', key: 'pm25' }, { label: 'CO2', key: 'co2' }, { label: 'NO2', key: 'no2' },
    { label: 'Temp', key: 'temperature' }, { label: 'Humidity', key: 'humidity' }, { label: 'Battery', key: 'battery' },
  ];

  const reportPayload = useMemo<ReportPayload>(() => ({
    snapshot, cityAqi, cityBandLabel: aqiBandFor(cityAqi).label, activeThreshold: effectiveAlertThreshold,
    onlineSensors, totalSensors: sensors.length,
    hotspots: hotspots.map(h => ({ name: h.name, coord: h.coord, aqi: h.aqi, trend: h.trend })),
    sources: sources.map(s => ({ name: s.name, pct: s.pct })),
    forecast: forecast.map(f => ({ hr: f.hr, val: f.val })),
    trendLabel, generatedBy: authUser ? `${authUser.name} (${authUser.role})` : 'Unknown',
  }), [authUser, cityAqi, effectiveAlertThreshold, forecast, hotspots, onlineSensors, sensors.length, snapshot, sources, trendLabel]);

  return {
    // layout
    currentTab, setCurrentTab,
    mode, setMode, pollutant, setPollutant, range, setRange,
    // sensors
    sensors, onlineSensors, sensorsInView, onlineSensorsInView,
    // hotspots
    hotspots, selectedHotspot, selected, setSelected,
    // map
    mapHeatmapPoints, mapHotspots, zoomPreset, setZoomPreset, mapFocusTarget, mapBounds, mapZoom,
    handlePickSensor, handleMapViewportChange, handlePickHotspot,
    // trend / forecast / sources
    pm25Series, pm10Series, no2Series, trend, trendLabel, forecast, sources, drift,
    // city
    cityAqi, cityBand, pm25Now, co2Now, no2Now, tempNow, humidityNow, batteryNow, currentDelta,
    // pollutants
    pollutantStats, pollutantMap, activePollutant, activeMetricConfig, sensorLegend,
    // alerts
    effectiveAlertThreshold, feed, alertThresholdDraft, setAlertThresholdDraft, alertConfigState, setAlertConfigState,
    handleSaveAlertThreshold, canManageAlertSettings, thresholdExceededBy,
    // history drawer
    drawerHistorySeries, historySeries,
    // meta
    liveAge, status, t, reportPayload,
  };
}
