import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  Calendar,
  ChevronRight,
  Cpu,
  Download,
  FileText,
  Filter,
  Flame,
  Grid2x2,
  Home,
  Languages,
  Layers,
  Map as MapIcon,
  MapPin,
  Radio,
  Search,
  Settings,
  Siren,
  Sparkles,
  Users,
  Wind,
  X,
} from 'lucide-react';
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
} from '@climence/shared';
import { fetchAlertConfig, fetchHistory, login, updateAlertConfig } from './api/client';
import {
  RiyadhGoogleMap,
  type RiyadhMapBounds,
  type RiyadhMapHotspot,
  type RiyadhMapSensor,
  type RiyadhZoomPreset,
} from './components/map/RiyadhGoogleMap';
import { ReportModal } from './components/ReportModal';
import type { HeatmapPoint } from './components/map/HeatmapLayer';
import { useLiveTelemetry, type ConnectionStatus } from './hooks/useLiveTelemetry';
import { computeDriftVector, computeForecast, computeSourceAttribution, detectTrend } from './lib/analytics';
import { translate, type DictKey, type Locale } from './lib/i18n';
import {
  bandForMetricValue,
  formatMetricValue,
  getMapMetricConfig,
  getMapMetricValue,
  heatIntensityForMetric,
  type MapMetricKey,
} from './lib/mapMetrics';
import type { ReportPayload } from './lib/reports';
import {
  clearAuthSession,
  isSessionExpired,
  loadAuthSession,
  saveAuthSession,
} from './lib/auth-session';
import climenceLogo from './assets/climence-logo.png';

type ViewMode = 'hardware' | 'heatmap';
type TimeRange = '1h' | '24h' | '7d' | '30d';
type PollutantKey = MapMetricKey;
type AqiBandKey = (typeof AQI_BANDS)[number]['key'];
type AlertSeverity = 'crit' | 'warn' | 'info' | 'ok';

interface SensorPoint {
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

interface HotspotCard {
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

interface PollutantStat {
  key: PollutantKey;
  name: string;
  unit: string;
  value: number;
  delta: number;
  pct: number;
}

interface FeedItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  meta: string;
  time: string;
}

const RANGE_POINTS: Record<TimeRange, number> = {
  '1h': 20,
  '24h': 48,
  '7d': 84,
  '30d': 120,
};

const STATUS_META: Record<ConnectionStatus, { label: string; dotClass: string }> = {
  open: { label: 'Live', dotClass: 'ok' },
  connecting: { label: 'Connecting', dotClass: 'warn' },
  reconnecting: { label: 'Reconnecting', dotClass: 'warn' },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

function formatCoord(lat: number, lng: number) {
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

function formatAgo(iso: string) {
  if (!iso) return '--';
  const diffSec = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  return `${hours}h`;
}

function seededSeries(seed: number, n: number, base: number, amp: number) {
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

function makePath(data: number[], width: number, height: number, padding: { l: number; r: number; t: number; b: number }, maxValue: number) {
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
    x,
    y,
    lat: drone.lat,
    lng: drone.lng,
    aqi,
    band,
    pm25: drone.pm25,
    co2: drone.co2,
    no2: drone.no2,
    temperature: drone.temperature,
    humidity: drone.humidity,
    battery: drone.batteryLevel,
    rssi: drone.rssi,
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
    if (distance < best) {
      best = distance;
      closest = sensor;
    }
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
    const metricValue =
      metricKey === 'pm25'
        ? hotspot.avg_pm25
        : fallbackSensor
          ? getMapMetricValue(metricKey, fallbackSensor)
          : getMapMetricConfig(metricKey).min;
    const aqi = pm25ToAqi(hotspot.avg_pm25);
    const band = bandForMetricValue(metricKey, metricValue);
    const trend = Math.round(((index % 3) - 1) * (4 + index * 2));
    const hotspotWithRadius = hotspot as Hotspot & { radius_km?: number; radiusKm?: number };
    const radiusCandidate = hotspotWithRadius.radiusKm ?? hotspotWithRadius.radius_km;
    const radiusKm =
      typeof radiusCandidate === 'number' && Number.isFinite(radiusCandidate) && radiusCandidate > 0
        ? radiusCandidate
        : undefined;

    return {
      id: `API-${index + 1}`,
      name: `Zone ${hotspot.lat_zone.toFixed(2)} · ${hotspot.lng_zone.toFixed(2)}`,
      coord: formatCoord(hotspot.lat_zone, hotspot.lng_zone),
      lat: hotspot.lat_zone,
      lng: hotspot.lng_zone,
      aqi,
      metricKey,
      metricLabel: metricConfig.label,
      metricUnit: metricConfig.unit,
      metricValue,
      metricDisplayValue: formatMetricValue(metricKey, metricValue),
      band,
      trend,
      pollutant: metricConfig.label,
      sourceUuid: nearestSensorUuid(hotspot.lat_zone, hotspot.lng_zone, sensors),
      radiusKm,
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
        id: `SNS-${index + 1}`,
        name: sensor.label,
        coord: formatCoord(sensor.lat, sensor.lng),
        lat: sensor.lat,
        lng: sensor.lng,
        aqi: sensor.aqi,
        metricKey,
        metricLabel: metricConfig.label,
        metricUnit: metricConfig.unit,
        metricValue,
        metricDisplayValue: formatMetricValue(metricKey, metricValue),
        band: bandForMetricValue(metricKey, metricValue),
        trend: Math.round((metricValue % 12) - 3),
        pollutant: metricConfig.label,
        sourceUuid: sensor.uuid,
      };
    });
}

function Sparkline({
  data,
  color,
  width = 220,
  height = 26,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(1, data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 2) - 1;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%' }}>
      <polygon points={area} fill={color} opacity="0.14" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CityTrendChart({
  pm25Series,
  pm10Series,
  no2Series,
  range,
}: {
  pm25Series: number[];
  pm10Series: number[];
  no2Series: number[];
  range: TimeRange;
}) {
  const width = 340;
  const height = 188;
  const pad = { l: 28, r: 30, t: 8, b: 26 };
  const max = 220;
  const ticks = [0, 50, 100, 150, 200];

  const labels =
    range === '1h'
      ? ['14:00', '14:15', '14:30', '14:45', '15:00']
      : range === '24h'
        ? ['00', '06', '12', '18', '24']
        : range === '7d'
          ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          : ['W1', 'W2', 'W3', 'W4'];

  const pm25Path = makePath(pm25Series, width, height, pad, max);
  const pm10Path = makePath(pm10Series, width, height, pad, max);
  const no2Path = makePath(no2Series, width, height, pad, max);

  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const xAt = (index: number, total: number) => pad.l + (index / Math.max(1, total - 1)) * innerW;
  const yAt = (value: number) => pad.t + innerH - (clamp(value, 0, max) / max) * innerH;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height: 210 }}>
      <defs>
        <linearGradient id="area-pm25" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.68 0.20 28)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="oklch(0.68 0.20 28)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x={pad.l} y={yAt(50)} width={innerW} height={yAt(0) - yAt(50)} fill="oklch(0.78 0.14 155 / 0.04)" />
      <rect x={pad.l} y={yAt(100)} width={innerW} height={yAt(50) - yAt(100)} fill="oklch(0.85 0.16 95 / 0.04)" />
      <rect x={pad.l} y={yAt(150)} width={innerW} height={yAt(100) - yAt(150)} fill="oklch(0.78 0.17 60 / 0.05)" />
      <rect x={pad.l} y={yAt(200)} width={innerW} height={yAt(150) - yAt(200)} fill="oklch(0.68 0.20 28 / 0.05)" />

      {ticks.map(tick => (
        <g key={tick}>
          <line className="chart-grid" x1={pad.l} x2={width - pad.r} y1={yAt(tick)} y2={yAt(tick)} />
          <text className="chart-label" x={pad.l - 6} y={yAt(tick) + 3} textAnchor="end">
            {tick}
          </text>
        </g>
      ))}

      {labels.map((label, index) => (
        <text key={label} className="chart-label" x={xAt(index, labels.length)} y={height - 7} textAnchor="middle">
          {label}
        </text>
      ))}

      <line x1={pad.l} x2={width - pad.r} y1={yAt(100)} y2={yAt(100)} stroke="oklch(0.68 0.16 285)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      <text className="chart-label" x={width - pad.r - 3} y={yAt(100) - 3} textAnchor="end" fill="var(--brand)">
        Alert
      </text>

      <path d={`${pm25Path} L ${xAt(pm25Series.length - 1, pm25Series.length)} ${yAt(0)} L ${xAt(0, pm25Series.length)} ${yAt(0)} Z`} fill="url(#area-pm25)" />
      <path d={no2Path} fill="none" stroke="oklch(0.85 0.16 95)" strokeWidth="1.5" opacity="0.86" />
      <path d={pm10Path} fill="none" stroke="oklch(0.78 0.17 60)" strokeWidth="1.5" opacity="0.86" />
      <path d={pm25Path} fill="none" stroke="oklch(0.68 0.20 28)" strokeWidth="1.8" />

      <circle
        cx={xAt(pm25Series.length - 1, pm25Series.length)}
        cy={yAt(pm25Series[pm25Series.length - 1] ?? 0)}
        r="3.5"
        fill="oklch(0.68 0.20 28)"
        stroke="var(--bg-0)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function HotspotDrawer({
  hotspot,
  historySeries,
  pollutantStats,
  onClose,
}: {
  hotspot: HotspotCard | null;
  historySeries: number[];
  pollutantStats: PollutantStat[];
  onClose: () => void;
}) {
  if (!hotspot) return null;

  const band = AQI_BANDS.find(item => item.key === hotspot.band);
  const series = historySeries.length > 0 ? historySeries : seededSeries(7, 48, hotspot.metricValue * 0.75, 40);

  return (
    <div className={`drawer ${hotspot ? 'open' : ''}`}>
      <div className="drawer-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Hotspot · rank {hotspot.id}
          </div>
          <h3>{hotspot.name}</h3>
          <div className="coord">{hotspot.coord}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close drawer">
          <X size={14} />
        </button>
      </div>

      <div className="drawer-body">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12 }}>
          <div
            className="serif tnum"
            style={{
              fontSize: 72,
              lineHeight: 0.9,
              color: `var(--aqi-${hotspot.band})`,
              letterSpacing: '-0.02em',
            }}
          >
            {hotspot.metricDisplayValue}
          </div>
          <div>
            <span className="band">
              <span className="dot" style={{ background: `var(--aqi-${hotspot.band})` }} />
              {band?.label ?? hotspot.metricLabel}
            </span>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {hotspot.metricLabel} · {hotspot.metricUnit}
            </div>
          </div>
        </div>

        <div style={{ margin: '14px 0 6px' }} className="eyebrow">
          48h trend
        </div>
        <div style={{ height: 60 }}>
          <Sparkline data={series} color={`var(--aqi-${hotspot.band})`} width={380} height={60} />
        </div>

        <div style={{ marginTop: 18 }} className="eyebrow">
          Pollutant readings
        </div>
        <div className="pollutant-grid" style={{ marginTop: 8 }}>
          {pollutantStats.slice(0, 4).map(stat => (
            <div key={stat.key} className="pcard" style={{ cursor: 'default' }}>
              <div className="pcard-head">
                <div className="pcard-name">
                  {stat.name} <span className="sub">{stat.unit}</span>
                </div>
              </div>
              <div className="pcard-val tnum" style={{ fontSize: 22 }}>
                {stat.value.toFixed(stat.value < 10 ? 1 : 0)}
                <span className="pcard-unit">{stat.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn primary" style={{ justifyContent: 'center' }}>
            <Siren size={13} />
            Dispatch team
          </button>
          <button className="btn" style={{ justifyContent: 'center' }}>
            <FileText size={13} />
            Full report
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [initialSession] = useState(() => {
    const session = loadAuthSession();
    if (!session || isSessionExpired(session)) {
      clearAuthSession();
      return null;
    }
    return session;
  });

  const [authToken, setAuthToken] = useState<string | null>(initialSession?.token ?? null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(initialSession?.user ?? null);
  const [loginEmail, setLoginEmail] = useState(initialSession?.user.email ?? 'analyst@mewa.gov.sa');
  const [loginPassword, setLoginPassword] = useState('Analyst123!');
  const [loginState, setLoginState] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [loginError, setLoginError] = useState('');

  const [mode, setMode] = useState<ViewMode>('heatmap');
  const [pollutant, setPollutant] = useState<PollutantKey>('pm25');
  const [range, setRange] = useState<TimeRange>('24h');
  const [selected, setSelected] = useState<HotspotCard | null>(null);
  const [rtl, setRtl] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [mapBounds, setMapBounds] = useState<RiyadhMapBounds | null>(null);
  const [mapZoom, setMapZoom] = useState(11);
  const [zoomPreset, setZoomPreset] = useState<RiyadhZoomPreset>('city');
  const [mapFocusTarget, setMapFocusTarget] = useState<{ lat: number; lng: number; zoom?: number; nonce: number } | null>(null);
  const locale: Locale = rtl ? 'ar' : 'en';
  const t = useCallback((key: DictKey) => translate(key, locale), [locale]);
  const [historySeries, setHistorySeries] = useState<number[]>([]);
  const [historySourceUuid, setHistorySourceUuid] = useState<string | null>(null);
  const [alertThreshold, setAlertThreshold] = useState(PM25_ALERT_THRESHOLD);
  const [alertThresholdDraft, setAlertThresholdDraft] = useState(String(PM25_ALERT_THRESHOLD));
  const [alertConfigState, setAlertConfigState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const { snapshot, status } = useLiveTelemetry(authToken);
  const statusMeta = STATUS_META[status];

  useEffect(() => {
    document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', rtl ? 'ar' : 'en');
  }, [rtl]);

  useEffect(() => {
    if (!authToken) return;

    let cancelled = false;
    fetchAlertConfig(authToken)
      .then(config => {
        if (cancelled) return;
        setAlertThreshold(config.pm25Threshold);
        setAlertThresholdDraft(String(config.pm25Threshold));
      })
      .catch(() => {
        // Fallback stays at the shared default if config fetch fails.
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const sensorProjectionSignature = useMemo(
    () =>
      snapshot.drones
        .map(drone =>
          [
            drone.uuid,
            drone.state,
            drone.lat,
            drone.lng,
            drone.pm25,
            drone.co2,
            drone.no2,
            drone.temperature,
            drone.humidity,
            drone.batteryLevel,
            drone.rssi,
            drone.server_timestamp,
          ].join(':'),
        )
        .join('|'),
    [snapshot.drones],
  );

  const sensors = useMemo(() => {
    return snapshot.drones
      .map((drone, index) => toSensorPoint(drone, index))
      .sort((left, right) => right.aqi - left.aqi);
    // The drone array reference changes on every snapshot tick; the signature above
    // keeps the projection stable when the telemetry values themselves did not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensorProjectionSignature]);

  const onlineSensors = useMemo(
    () => sensors.filter(sensor => sensor.status === 'online').length,
    [sensors],
  );

  const sensorsInView = useMemo(
    () => (mapBounds ? sensors.filter(sensor => isSensorInBounds(sensor, mapBounds)) : sensors),
    [mapBounds, sensors],
  );

  const onlineSensorsInView = useMemo(
    () => sensorsInView.filter(sensor => sensor.status === 'online').length,
    [sensorsInView],
  );

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
    return hotspots.find(hotspot => hotspot.id === selected.id) ?? null;
  }, [hotspots, selected]);

  const mapHeatmapPoints = useMemo<HeatmapPoint[]>(
    () =>
      sensors.map(sensor => {
        const metricValue = getMapMetricValue(pollutant, sensor);
        return {
          lat: sensor.lat,
          lng: sensor.lng,
          intensity: heatIntensityForMetric(pollutant, metricValue),
        };
      }),
    [pollutant, sensors],
  );

  const mapHotspots = useMemo<RiyadhMapHotspot[]>(
    () => hotspots.map(hotspot => ({
      id: hotspot.id,
      lat: hotspot.lat,
      lng: hotspot.lng,
      aqi: hotspot.aqi,
      band: hotspot.band,
      radiusKm: hotspot.radiusKm,
      label: hotspot.name,
      valueLabel: `${hotspot.metricLabel} ${hotspot.metricDisplayValue} ${hotspot.metricUnit}`,
    })),
    [hotspots],
  );

  useEffect(() => {
    if (!selectedHotspot) {
      return;
    }

    const fallback = seededSeries(
      selectedHotspot.aqi + selectedHotspot.name.length,
      48,
      selectedHotspot.aqi * 0.7,
      50,
    );
    if (!selectedHotspot.sourceUuid) {
      return;
    }
    const sourceUuid = selectedHotspot.sourceUuid;

    let cancelled = false;
    if (!authToken) {
      return;
    }

    fetchHistory(sourceUuid, authToken)
      .then(rows => {
        if (cancelled) return;
        const history = rows.map(row =>
          getMapMetricValue(selectedHotspot.metricKey, {
            pm25: row.pm25,
            co2: row.co2,
            no2: row.no2,
            temperature: row.temperature,
            humidity: row.humidity,
            battery: row.batteryLevel,
          }),
        );
        setHistorySeries(history.length > 1 ? history : fallback);
        setHistorySourceUuid(sourceUuid);
      })
      .catch(() => {
        if (!cancelled) {
          setHistorySeries(fallback);
          setHistorySourceUuid(sourceUuid);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, selectedHotspot]);

  const basePm25Series = useMemo(() => {
    const raw = snapshot.cityTrend.map(point => point.avg_pm25);
    if (raw.length > 1) return raw;

    const fallbackSource = sensors.slice(0, 12).map(sensor => sensor.pm25);
    const baseline = average(fallbackSource) || 85;
    return seededSeries(17, 40, baseline, 24);
  }, [snapshot.cityTrend, sensors]);

  const pm25Series = useMemo(() => {
    return resampleSeries(basePm25Series.map(value => pm25ToAqi(value)), RANGE_POINTS[range]);
  }, [basePm25Series, range]);

  const pm10Series = useMemo(() => pm25Series.map(value => clamp(value * 1.18, 18, 260)), [pm25Series]);
  const no2Series = useMemo(() => pm25Series.map(value => clamp(value * 0.68 + 22, 8, 180)), [pm25Series]);

  const trend = useMemo(() => detectTrend(pm25Series), [pm25Series]);
  const forecast = useMemo(() => computeForecast(pm25Series, 6), [pm25Series]);
  const sourcesLive = useMemo(() => computeSourceAttribution(sensors), [sensors]);
  const drift = useMemo(
    () => computeDriftVector(sensors.map(s => ({ lat: s.lat, lng: s.lng, pm25: s.pm25 }))),
    [sensors],
  );

  const sourceNameKey: Record<string, DictKey> = {
    traffic: 'src.traffic',
    industry: 'src.industry',
    dust: 'src.dust',
    other: 'src.other',
  };
  const sources = sourcesLive.map(s => ({ ...s, name: t(sourceNameKey[s.key]) }));
  const trendLabel =
    trend.direction === 'worsening'
      ? t('trend.worsening')
      : trend.direction === 'improving'
        ? t('trend.improving')
        : t('trend.stable');

  const cityAqi = Math.round(average(sensors.map(sensor => sensor.aqi)) || pm25Series[pm25Series.length - 1] || 0);
  const cityBand = aqiBandFor(cityAqi).key;

  const pm25Now = Math.round(average(sensors.map(sensor => sensor.pm25)) || 0);
  const co2Now = Math.round(average(sensors.map(sensor => sensor.co2)) || 0);
  const no2Now = Math.round(average(sensors.map(sensor => sensor.no2)) || 0);
  const tempNow = Math.round(average(sensors.map(sensor => sensor.temperature)) || 0);
  const humidityNow = Math.round(average(sensors.map(sensor => sensor.humidity)) || 0);
  const batteryNow = Math.round(average(sensors.map(sensor => sensor.battery)) || 0);
  const currentDelta = Math.round((pm25Series[pm25Series.length - 1] ?? cityAqi) - (pm25Series[pm25Series.length - 2] ?? cityAqi));

  const pollutantStats = useMemo<PollutantStat[]>(() => {
    const rows: PollutantStat[] = [
      {
        key: 'pm25',
        name: 'PM2.5',
        unit: 'ug/m3',
        value: pm25Now,
        delta: Math.round((pm25Series[pm25Series.length - 1] ?? 0) - (pm25Series[pm25Series.length - 2] ?? 0)),
        pct: clamp((pm25Now / 150) * 100, 4, 100),
      },
      {
        key: 'co2',
        name: 'CO2',
        unit: 'ppm',
        value: co2Now,
        delta: Math.round(((co2Now - 520) / 520) * 20),
        pct: clamp((co2Now / 950) * 100, 4, 100),
      },
      {
        key: 'no2',
        name: 'NO2',
        unit: 'ppb',
        value: no2Now,
        delta: Math.round(((no2Now - 35) / 35) * 12),
        pct: clamp((no2Now / 90) * 100, 4, 100),
      },
      {
        key: 'temperature',
        name: 'Temp',
        unit: 'degC',
        value: tempNow,
        delta: Math.round(((tempNow - 30) / 30) * 8),
        pct: clamp((tempNow / 45) * 100, 4, 100),
      },
      {
        key: 'humidity',
        name: 'Humidity',
        unit: '%',
        value: humidityNow,
        delta: Math.round(((humidityNow - 35) / 35) * 8),
        pct: clamp((humidityNow / 100) * 100, 4, 100),
      },
      {
        key: 'battery',
        name: 'Battery',
        unit: '%',
        value: batteryNow,
        delta: Math.round(((batteryNow - 60) / 60) * 6),
        pct: clamp((batteryNow / 100) * 100, 4, 100),
      },
    ];
    return rows;
  }, [batteryNow, co2Now, humidityNow, no2Now, pm25Now, pm25Series, tempNow]);

  const pollutantMap = useMemo(() => {
    const values: Record<PollutantKey, number> = {
      pm25: pm25Now,
      co2: co2Now,
      no2: no2Now,
      temperature: tempNow,
      humidity: humidityNow,
      battery: batteryNow,
    };
    return values;
  }, [batteryNow, co2Now, humidityNow, no2Now, pm25Now, tempNow]);

  const effectiveAlertThreshold =
    Number.isFinite(snapshot.alertThresholdPm25) && snapshot.alertThresholdPm25 > 0
      ? snapshot.alertThresholdPm25
      : alertThreshold;

  const feed = useMemo<FeedItem[]>(() => {
    if (snapshot.alerts.length > 0) {
      return snapshot.alerts.slice(0, 7).map(alert => {
        let severity: AlertSeverity = 'info';
        if (alert.pm25 >= effectiveAlertThreshold + 45) severity = 'crit';
        else if (alert.pm25 >= effectiveAlertThreshold) severity = 'warn';

        return {
          id: `${alert.uuid}-${alert.id}`,
          severity,
          title: `PM2.5 threshold exceeded · ${Math.round(alert.pm25)} ug/m3`,
          meta: `${alert.uuid.slice(0, 8)} · ${alert.state}`,
          time: formatAgo(alert.server_timestamp),
        };
      });
    }

    return hotspots.slice(0, 5).map((hotspot, index) => ({
      id: `fallback-${hotspot.id}`,
      severity: index === 0 ? 'crit' : index < 3 ? 'warn' : 'ok',
      title: `${hotspot.name} monitoring advisory`,
      meta: `${hotspot.coord} · ${hotspot.metricLabel} ${hotspot.metricDisplayValue} ${hotspot.metricUnit}`,
      time: `${(index + 1) * 5}m`,
    }));
  }, [effectiveAlertThreshold, snapshot.alerts, hotspots]);

  const liveAge = formatAgo(snapshot.emittedAt);

  const activePollutant = pollutantStats.find(stat => stat.key === pollutant)?.name ?? 'PM2.5';
  const activeMetricConfig = useMemo(() => getMapMetricConfig(pollutant), [pollutant]);
  const drawerHistorySeries =
    selectedHotspot?.sourceUuid && historySourceUuid === selectedHotspot.sourceUuid ? historySeries : [];
  const thresholdExceededBy = Math.max(0, pm25Now - effectiveAlertThreshold);

  const handlePickSensor = useCallback((sensor: RiyadhMapSensor) => {
    const source = sensors.find(item => item.uuid === sensor.uuid);
    const id = source?.id ?? `S-${sensor.uuid.slice(-4).toUpperCase()}`;
    const metricValue = getMapMetricValue(
      pollutant,
      source ?? {
        pm25: sensor.pm25,
        co2: 0,
        no2: 0,
        temperature: 0,
        humidity: 0,
        battery: sensor.battery,
      },
    );
    setSelected({
      id,
      name: sensor.label,
      coord: formatCoord(sensor.lat, sensor.lng),
      lat: sensor.lat,
      lng: sensor.lng,
      aqi: sensor.aqi,
      metricKey: pollutant,
      metricLabel: activeMetricConfig.label,
      metricUnit: activeMetricConfig.unit,
      metricValue,
      metricDisplayValue: formatMetricValue(pollutant, metricValue),
      band: bandForMetricValue(pollutant, metricValue),
      trend: Math.round((metricValue % 15) - 4),
      pollutant: activeMetricConfig.label,
      sourceUuid: sensor.uuid,
    });
  }, [activeMetricConfig.label, activeMetricConfig.unit, pollutant, sensors]);

  const handleMapViewportChange = useCallback((viewport: { bounds: RiyadhMapBounds; zoom: number }) => {
    setMapBounds(viewport.bounds);
    setMapZoom(viewport.zoom);
  }, []);

  const handlePickHotspot = useCallback((hotspot: HotspotCard) => {
    setSelected(hotspot);
    setZoomPreset('zone');
    setMapFocusTarget({ lat: hotspot.lat, lng: hotspot.lng, zoom: 14, nonce: Date.now() });
  }, []);

  const handleSaveAlertThreshold = useCallback(() => {
    if (!authToken) {
      setAlertConfigState('error');
      return;
    }

    const parsed = Number(alertThresholdDraft);
    if (!Number.isFinite(parsed)) {
      setAlertConfigState('error');
      return;
    }

    setAlertConfigState('saving');
    updateAlertConfig(parsed, authToken)
      .then(config => {
        setAlertThreshold(config.pm25Threshold);
        setAlertThresholdDraft(String(config.pm25Threshold));
        setAlertConfigState('saved');
      })
      .catch(() => {
        setAlertConfigState('error');
      });
  }, [alertThresholdDraft, authToken]);

  const sensorLegend: Array<{ label: string; key: PollutantKey }> = [
    { label: 'PM2.5', key: 'pm25' },
    { label: 'CO2', key: 'co2' },
    { label: 'NO2', key: 'no2' },
    { label: 'Temp', key: 'temperature' },
    { label: 'Humidity', key: 'humidity' },
    { label: 'Battery', key: 'battery' },
  ];

  const canManageAlertSettings = authUser?.role === UserRole.ADMINISTRATOR;

  const handleLogin = useCallback(() => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Email and password are required.');
      setLoginState('error');
      return;
    }

    setLoginState('submitting');
    setLoginError('');
    login({ email: loginEmail.trim().toLowerCase(), password: loginPassword })
      .then(session => {
        setAuthToken(session.token);
        setAuthUser(session.user);
        saveAuthSession(session);
        setAlertConfigState('idle');
        setLoginState('idle');
      })
      .catch(() => {
        setLoginError('Incorrect email or password.');
        setLoginState('error');
      });
  }, [loginEmail, loginPassword]);

  const reportPayload = useMemo<ReportPayload>(() => ({
    snapshot,
    cityAqi,
    cityBandLabel: aqiBandFor(cityAqi).label,
    activeThreshold: effectiveAlertThreshold,
    onlineSensors,
    totalSensors: sensors.length,
    hotspots: hotspots.map(h => ({ name: h.name, coord: h.coord, aqi: h.aqi, trend: h.trend })),
    sources: sources.map(s => ({ name: s.name, pct: s.pct })),
    forecast: forecast.map(f => ({ hr: f.hr, val: f.val })),
    trendLabel,
    generatedBy: authUser ? `${authUser.name} (${authUser.role})` : 'Unknown',
  }), [authUser, cityAqi, effectiveAlertThreshold, forecast, hotspots, onlineSensors, sensors.length, snapshot, sources, trendLabel]);

  const handleLogout = useCallback(() => {
    clearAuthSession();
    setAuthToken(null);
    setAuthUser(null);
    setSelected(null);
    setHistorySeries([]);
    setHistorySourceUuid(null);
  }, []);

  if (!authToken || !authUser) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">
            <img src={climenceLogo} alt="Climence logo" className="auth-logo" />
            <div>
              <div className="auth-title">Climence</div>
              <div className="auth-sub">Secure Access · MEWA</div>
            </div>
          </div>

          <h1>Sign in to dashboard</h1>
          <p className="auth-copy">
            Use your ministry credentials to access real-time monitoring, analytics, and reporting.
          </p>

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={loginEmail}
            onChange={event => {
              setLoginEmail(event.target.value);
              if (loginState === 'error') setLoginState('idle');
            }}
            placeholder="analyst@mewa.gov.sa"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={loginPassword}
            onChange={event => {
              setLoginPassword(event.target.value);
              if (loginState === 'error') setLoginState('idle');
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') handleLogin();
            }}
            placeholder="••••••••"
          />

          {loginState === 'error' && <div className="auth-error">{loginError}</div>}

          <button className="btn primary auth-submit" onClick={handleLogin} disabled={loginState === 'submitting'}>
            {loginState === 'submitting' ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="auth-hint">
            Demo accounts: <code>admin@mewa.gov.sa</code>, <code>analyst@mewa.gov.sa</code>, <code>viewer@mewa.gov.sa</code>
          </div>
        </div>
      </div>
    );
  }

  const userInitials = authUser.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(chunk => chunk[0]?.toUpperCase() ?? '')
    .join('');

  const roleLabel =
    authUser.role === UserRole.ADMINISTRATOR
      ? 'Administrator'
      : authUser.role === UserRole.ANALYST
        ? 'Analyst'
        : 'Viewer';

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <div className="brand-mark">
            <img src={climenceLogo} alt="Climence logo" className="brand-logo" />
          </div>
          <div>
            <div className="brand-name">Climence</div>
            <div className="brand-sub">{t('app.brand.sub')}</div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">{t('nav.monitor')}</div>
          <button className="nav-item active">
            <Home size={16} />
            {t('nav.overview')}
          </button>
          <button className="nav-item">
            <MapIcon size={16} />
            {t('nav.livemap')}
          </button>
          <button className="nav-item">
            <BarChart3 size={16} />
            {t('nav.analytics')}
          </button>
          <button className="nav-item">
            <Siren size={16} />
            {t('nav.alerts')}
            <span className="count tnum">{feed.length}</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">{t('nav.operate')}</div>
          <button className="nav-item">
            <Cpu size={16} />
            {t('nav.sensors')}
            <span className="count tnum">
              {onlineSensors}/{sensors.length || 0}
            </span>
          </button>
          <button className="nav-item">
            <Users size={16} />
            {t('nav.dispatch')}
          </button>
          <button className="nav-item" onClick={() => setReportModalOpen(true)}>
            <FileText size={16} />
            {t('nav.reports')}
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">{t('nav.system')}</div>
          <button className="nav-item">
            <Layers size={16} />
            {t('nav.integrations')}
          </button>
          <button className="nav-item">
            <Settings size={16} />
            {t('nav.settings')}
          </button>
        </div>

        <div className="nav-footer">
          <div className="user-chip">
            <div className="avatar">{userInitials || 'U'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name">{authUser.name}</div>
              <div className="user-role">{roleLabel} · Riyadh</div>
            </div>
            <ChevronRight size={14} />
          </div>
        </div>
      </nav>

      <header className="topbar">
        <div className="crumb desktop-only">
          <span>{t('app.crumb.monitor')}</span>
          <span className="crumb-sep"> / </span>
          <span className="crumb-cur">{t('app.crumb.overview')}</span>
        </div>

        <span className="live">
          <span className={`pulse ${statusMeta.dotClass}`} />
          {statusMeta.label} · {liveAge}
        </span>

        <div className="seg desktop-only" style={{ marginLeft: 8 }}>
          <button className={`seg-btn ${mode === 'hardware' ? 'active' : ''}`} onClick={() => setMode('hardware')}>
            <Grid2x2 size={12} /> {t('seg.hardware')}
          </button>
          <button className={`seg-btn ${mode === 'heatmap' ? 'active' : ''}`} onClick={() => setMode('heatmap')}>
            <Layers size={12} /> {t('seg.heatmap')}
          </button>
        </div>

        <div className="topbar-spacer" />

        <div className="search">
          <Search size={14} />
          <input placeholder={t('app.search')} />
          <span className="kbd desktop-only">⌘K</span>
        </div>

        <button className="icon-btn desktop-only" onClick={() => setRtl(!rtl)} title="Toggle direction">
          <Languages size={15} />
        </button>
        <button className="icon-btn desktop-only" title="Calendar">
          <Calendar size={15} />
        </button>
        <button className="icon-btn" title="Notifications">
          <Bell size={15} />
          <span className="badge tnum">{feed.length}</span>
        </button>
        <button className="btn primary desktop-only" onClick={() => setReportModalOpen(true)}>
          <Download size={13} />
          {t('app.export')}
        </button>
        <button className="btn desktop-only" onClick={handleLogout}>
          {t('app.signout')}
        </button>
      </header>

      <main className="main">
        <div className="kpi-strip">
          <div className="kpi">
            <div className="kpi-label eyebrow">
              <Activity size={11} /> {t('kpi.city')}
            </div>
            <div className="kpi-row">
              <div className="kpi-value" style={{ color: `var(--aqi-${cityBand})` }}>
                {cityAqi}
              </div>
              <span className="band">
                <span className="dot" style={{ background: `var(--aqi-${cityBand})` }} />
                {aqiBandFor(cityAqi).label}
              </span>
              <span className={`kpi-delta ${currentDelta >= 0 ? 'up' : 'down'}`}>
                {currentDelta >= 0 ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}
                {currentDelta >= 0 ? '+' : ''}
                {currentDelta} vs. prev
              </span>
            </div>
            <div className="kpi-spark">
              <Sparkline data={pm25Series} color="oklch(0.68 0.20 28)" width={240} height={26} />
            </div>
          </div>

          <div className="kpi">
            <div className="kpi-label eyebrow">
              <Flame size={11} /> {t('kpi.dominant')}
            </div>
            <div className="kpi-row">
              <div className="kpi-value">
                {activePollutant}
              </div>
              <span className="kpi-unit">{pollutantMap[pollutant]} current</span>
            </div>
            <div className="kpi-meta tnum">Data from {sensors.length || 0} active sensors</div>
          </div>

          <div className="kpi">
            <div className="kpi-label eyebrow">
              <Siren size={11} /> {t('kpi.alerts')}
            </div>
            <div className="kpi-row">
              <div className="kpi-value" style={{ color: 'var(--aqi-unh)' }}>
                {snapshot.alerts.length}
              </div>
              <span className="kpi-unit">threshold {effectiveAlertThreshold}+ ug/m3</span>
            </div>
            <div className="kpi-meta">{feed.length} items in live feed</div>
          </div>

          <div className="kpi">
            <div className="kpi-label eyebrow">
              <Radio size={11} /> {t('kpi.sensors')}
            </div>
            <div className="kpi-row">
              <div className="kpi-value">
                {onlineSensorsInView}
                <span style={{ color: 'var(--ink-3)', fontSize: 22 }}>/{sensorsInView.length}</span>
              </div>
              <span className="kpi-delta down">
                <ArrowDown size={11} strokeWidth={2.5} />
                {Math.max(0, sensorsInView.length - onlineSensorsInView)} offline
              </span>
            </div>
            <div className="kpi-meta">
              {mapBounds
                ? `Viewport filter active · ${statusMeta.label.toLowerCase()}`
                : `Realtime stream · ${statusMeta.label.toLowerCase()}`}
            </div>
          </div>

          <div className="kpi">
            <div className="kpi-label eyebrow">
              <Wind size={11} /> {t('kpi.wind')}
            </div>
            <div className="kpi-row">
              <div className="kpi-value">
                {drift.speedKmh}
                <span className="kpi-unit" style={{ fontSize: 14, marginLeft: 4 }}>
                  km/h
                </span>
              </div>
              <span className="band" style={{ paddingTop: 3 }}>
                <span className="dot" style={{ background: 'var(--brand)' }} />
                → {drift.cardinal}
              </span>
            </div>
            <div className="kpi-meta">Humidity {humidityNow}% · Temp {tempNow}°C</div>
          </div>
        </div>

        <div className="stage">
          <RiyadhGoogleMap
            mode={mode}
            sensors={sensors}
            hotspots={mapHotspots}
            heatmapPoints={mapHeatmapPoints}
            zoomPreset={zoomPreset}
            focusTarget={mapFocusTarget}
            onViewportChange={handleMapViewportChange}
            onPickSensor={handlePickSensor}
          />

          <div className="map-panel-tl">
            <div className="pollutants">
              {sensorLegend.map(entry => (
                <button
                  key={entry.key}
                  className={`pollutant-pill ${pollutant === entry.key ? 'active' : ''}`}
                  onClick={() => setPollutant(entry.key)}
                >
                  {entry.label}
                  <span className="val tnum">{Math.round(pollutantMap[entry.key])}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="map-panel-tr glass">
            <div className="map-tools">
              <button className={`map-tool ${zoomPreset === 'city' ? 'active' : ''}`} title="City view" onClick={() => setZoomPreset('city')}>
                City
              </button>
              <button className={`map-tool ${zoomPreset === 'sector' ? 'active' : ''}`} title="Sector view" onClick={() => setZoomPreset('sector')}>
                Sector
              </button>
              <button className={`map-tool ${zoomPreset === 'zone' ? 'active' : ''}`} title="Zone view" onClick={() => setZoomPreset('zone')}>
                Zone
              </button>
            </div>
          </div>

          <div className="map-panel-bl glass legend">
            <div className="legend-title">
              <span className="eyebrow">{activeMetricConfig.legendTitle}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                {activePollutant}
              </span>
            </div>
            <div className="legend-ramp">
              {AQI_BANDS.map(band => (
                <div key={band.key} style={{ background: `var(--aqi-${band.key})` }} />
              ))}
            </div>
            <div className="legend-scale tnum">
              {activeMetricConfig.legendStops.map(stop => (
                <span key={stop}>{stop}</span>
              ))}
            </div>
            <div className="legend-bands">
              {AQI_BANDS.slice(0, 4).map(band => (
                <div key={band.key} className="legend-row">
                  <span className="sw" style={{ background: `var(--aqi-${band.key})` }} />
                  <span>{band.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="map-panel-br glass" style={{ padding: '10px 14px', minWidth: 220 }}>
            <div className="row-between">
              <div>
                <div className="eyebrow">Viewing</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-0)', letterSpacing: '-0.01em' }}>
                  {sensorsInView.length} sensors in current bounds
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="eyebrow">Zoom</div>
                <div className="mono tnum" style={{ fontSize: 13, color: 'var(--ink-1)' }}>
                  {mapZoom.toFixed(1)}
                </div>
              </div>
            </div>
            <div className="divider" style={{ margin: '10px 0' }} />
            <div className="row-between" style={{ fontSize: 11.5 }}>
              <span className="row-flex gap-tight">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)' }} />
                {onlineSensorsInView} online
              </span>
              <span className="row-flex gap-tight">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-3)', opacity: 0.6 }} />
                {Math.max(0, sensorsInView.length - onlineSensorsInView)} offline
              </span>
            </div>
          </div>

          <div className="statusbar desktop-only">
            <span className="item">
              <span className={`d ${statusMeta.dotClass}`} />
              Stream · {statusMeta.label.toLowerCase()}
            </span>
            <span className="item">Model v2.1.4</span>
            <span className="item">Lat. 42ms</span>
            <span className="spacer" />
            <span className="item">Riyadh · UTC+3</span>
            <span className="item">24.7136°, 46.6753°</span>
          </div>

          <HotspotDrawer
            hotspot={selectedHotspot}
            historySeries={drawerHistorySeries}
            pollutantStats={pollutantStats}
            onClose={() => setSelected(null)}
          />
        </div>
      </main>

      <aside className="side">
        <div className="banner">
          <div className="banner-icon">
            <AlertTriangle size={14} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="banner-title">{t('banner.over')} · +{thresholdExceededBy} µg/m³</div>
            <div className="banner-sub">Citywide advisory active</div>
          </div>
          <button className="banner-cta">{t('banner.dispatch')}</button>
        </div>

        <div className="side-group">
          <div className="side-head">
            <div>
              <div className="eyebrow">UC-A4</div>
              <div className="side-title">{t('panel.alertSettings')}</div>
            </div>
          </div>
          {canManageAlertSettings ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <label className="eyebrow" htmlFor="pm25-threshold-input" style={{ fontSize: 10 }}>
                PM2.5 threshold (ug/m3)
              </label>
              <div className="row-flex gap-tight" style={{ alignItems: 'center' }}>
                <input
                  id="pm25-threshold-input"
                  type="number"
                  min={1}
                  max={500}
                  step={0.1}
                  value={alertThresholdDraft}
                  onChange={event => {
                    setAlertThresholdDraft(event.target.value);
                    setAlertConfigState('idle');
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    background: 'var(--bg-1)',
                    color: 'var(--ink-1)',
                    padding: '8px 10px',
                  }}
                />
                <button
                  className="btn primary"
                  disabled={alertConfigState === 'saving'}
                  onClick={handleSaveAlertThreshold}
                >
                  {alertConfigState === 'saving' ? 'Saving...' : 'Save'}
                </button>
              </div>
              <div className="mono tnum" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Active threshold: {effectiveAlertThreshold}
              </div>
              {alertConfigState === 'saved' && (
                <div style={{ fontSize: 11.5, color: 'var(--ok)' }}>Threshold saved and applied to live alerts.</div>
              )}
              {alertConfigState === 'error' && (
                <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>
                  Failed to save threshold. Enter a value between 1 and 500.
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              You have read-only access. Only administrators can change alert thresholds.
            </div>
          )}
        </div>

        <div className="side-group">
          <div className="side-head">
            <div>
              <div className="eyebrow">{t('panel.trend.eyebrow')}</div>
              <div className="side-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {t('panel.trend')}
                <span className={`trend-pill ${trend.direction}`}>
                  {trend.direction === 'worsening' && <ArrowUp size={10} strokeWidth={2.5} />}
                  {trend.direction === 'improving' && <ArrowDown size={10} strokeWidth={2.5} />}
                  {trendLabel}
                </span>
              </div>
            </div>
            <div className="range-picker">
              {(['1h', '24h', '7d', '30d'] as TimeRange[]).map(value => (
                <button
                  key={value}
                  className={range === value ? 'active' : ''}
                  onClick={() => setRange(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="chart-wrap">
            <CityTrendChart pm25Series={pm25Series} pm10Series={pm10Series} no2Series={no2Series} range={range} />
          </div>
          <div className="row-between" style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-2)' }}>
            <div className="row-flex gap-tight">
              <span className="row-flex gap-tight">
                <span style={{ width: 10, height: 2, background: 'oklch(0.68 0.20 28)' }} /> PM2.5
              </span>
              <span className="row-flex gap-tight" style={{ marginLeft: 8 }}>
                <span style={{ width: 10, height: 2, background: 'oklch(0.78 0.17 60)' }} /> PM10
              </span>
              <span className="row-flex gap-tight" style={{ marginLeft: 8 }}>
                <span style={{ width: 10, height: 2, background: 'oklch(0.85 0.16 95)' }} /> NO2
              </span>
            </div>
            <span className="mono tnum" style={{ color: 'var(--ink-3)', fontSize: 10.5 }}>
              updated {liveAge} ago
            </span>
          </div>
        </div>

        <div className="side-group">
          <div className="side-head">
            <div>
              <div className="eyebrow">{t('panel.hotspots.eyebrow')}</div>
              <div className="side-title">
                {t('panel.hotspots')} <span className="cnt">{String(hotspots.length).padStart(2, '0')}</span>
              </div>
            </div>
            <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }}>
              <MapPin size={11} /> {t('btn.onMap')}
            </button>
          </div>
          <ul>
            {hotspots.map((hotspot, index) => (
              <li
                key={hotspot.id}
                className={`hotspot ${selectedHotspot?.id === hotspot.id ? 'selected' : ''}`}
                onClick={() => handlePickHotspot(hotspot)}
              >
                <div className="hotspot-rank">#{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <div className="hotspot-name">{hotspot.name}</div>
                  <div className="hotspot-coord">
                    {hotspot.coord} · dom. {hotspot.pollutant}
                  </div>
                </div>
                <div className={`hotspot-val ${hotspot.band}`}>
                  <div className="n tnum">{hotspot.metricDisplayValue}</div>
                  <div className="u">
                    {hotspot.metricLabel} · {hotspot.trend > 0 ? '+' : ''}
                    {hotspot.trend}%
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="side-group">
          <div className="side-head">
            <div>
              <div className="eyebrow">{t('panel.pollutants.eyebrow')}</div>
              <div className="side-title">{t('panel.pollutants')}</div>
            </div>
            <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }}>
              <Filter size={11} /> {t('btn.all')}
            </button>
          </div>
          <div className="pollutant-grid">
            {pollutantStats.map(stat => {
              const pctColor =
                stat.pct > 70
                  ? 'var(--aqi-unh)'
                  : stat.pct > 50
                    ? 'var(--aqi-usg)'
                    : stat.pct > 30
                      ? 'var(--aqi-mod)'
                      : 'var(--aqi-good)';
              return (
                <div
                  key={stat.key}
                  className={`pcard ${pollutant === stat.key ? 'active' : ''}`}
                  onClick={() => setPollutant(stat.key)}
                >
                  <div className="pcard-head">
                    <div className="pcard-name">
                      {stat.name} <span className="sub">{stat.unit}</span>
                    </div>
                    <span className={`pcard-delta ${stat.delta >= 0 ? 'up' : 'down'}`}>
                      {stat.delta >= 0 ? '+' : ''}
                      {stat.delta}
                    </span>
                  </div>
                  <div className="pcard-val tnum">
                    {stat.value.toFixed(stat.value < 10 ? 1 : 0)}
                    <span className="pcard-unit">{stat.unit}</span>
                  </div>
                  <div className="pcard-bar">
                    <div className="fill" style={{ width: `${stat.pct}%`, background: pctColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="side-group">
          <div className="side-head">
            <div>
              <div className="eyebrow">{t('panel.weather.eyebrow')}</div>
              <div className="side-title">{t('panel.weather')}</div>
            </div>
            <span className="mono tnum" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
              Riyadh · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          </div>
          <div className="weather-row">
            <div className="weather-cell">
              <div className="l">{t('weather.temp')}</div>
              <div className="v tnum">
                {tempNow}
                <span className="u"> C</span>
              </div>
            </div>
            <div className="weather-cell">
              <div className="l">{t('weather.humidity')}</div>
              <div className="v tnum">
                {humidityNow}
                <span className="u"> %</span>
              </div>
            </div>
            <div className="weather-cell">
              <div className="l">{t('weather.pressure')}</div>
              <div className="v tnum">
                1013
                <span className="u"> hPa</span>
              </div>
            </div>
          </div>
          <div className="wind-compass">
            <div className="compass">
              <div className="compass-arrow" style={{ transform: `rotate(${drift.headingDeg}deg)`, transition: 'transform 0.6s ease' }}>
                <MapPin size={20} />
              </div>
            </div>
            <div className="wind-meta">
              <div className="hd">{t('weather.windHeader')}</div>
              <div className="dir">
                {drift.speedKmh} <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>km/h · {drift.cardinal}</span>
              </div>
              <div className="sub">{drift.description}</div>
            </div>
          </div>
        </div>

        <div className="side-group">
          <div className="side-head">
            <div>
              <div className="eyebrow">{t('panel.forecast.eyebrow')}</div>
              <div className="side-title">{t('panel.forecast')}</div>
            </div>
            <span className="band" title="Linear trend + mean reversion">
              <Sparkles size={10} /> trend v1
            </span>
          </div>
          <div className="forecast">
            {forecast.map(point => (
              <div key={point.hr} className="f-cell">
                <div className="f-hr">{point.hr}</div>
                <div className="f-val tnum">{point.val}</div>
                <div className="f-dot" style={{ background: `var(--aqi-${point.band})` }} />
              </div>
            ))}
          </div>
        </div>

        <div className="side-group">
          <div className="side-head">
            <div>
              <div className="eyebrow">{t('panel.sources.eyebrow')}</div>
              <div className="side-title">{t('panel.sources')}</div>
            </div>
          </div>
          <div className="src-bar">
            {sources.map(source => (
              <div key={source.key} style={{ flex: source.pct, background: source.color }}>
                {source.pct}%
              </div>
            ))}
          </div>
          <div className="src-legend">
            {sources.map(source => (
              <div key={source.key} className="src-row">
                <span className="sw" style={{ background: source.color }} />
                <span>{source.name}</span>
                <span className="pct tnum">{source.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="side-group">
          <div className="side-head">
            <div>
              <div className="eyebrow">{t('panel.feed.eyebrow')}</div>
              <div className="side-title">{t('panel.feed')}</div>
            </div>
            <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }}>
              {t('btn.all')}
            </button>
          </div>
          <ul>
            {feed.map(item => (
              <li key={item.id} className="alert">
                <div className={`alert-icon ${item.severity}`}>
                  {item.severity === 'crit' || item.severity === 'warn' ? (
                    <AlertTriangle size={12} />
                  ) : item.severity === 'ok' ? (
                    <Activity size={12} />
                  ) : (
                    <Bell size={12} />
                  )}
                </div>
                <div className="alert-body">
                  <div className="t">
                    <b>{item.title}</b>
                  </div>
                  <div className="m">{item.meta}</div>
                </div>
                <div className="alert-time">{item.time}</div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        payload={reportPayload}
        locale={locale}
      />
    </div>
  );
}
