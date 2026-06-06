/**
 * Dashboard.tsx — pure rendering component.
 *
 * Receives all pre-computed data from useDashboardData and renders either
 * the main area (KPI strip + map stage) or the side rail panels, controlled
 * by the `position` prop. No business logic lives here — only JSX.
 */
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Flame,
  Radio,
  Siren,
  Wind,
  X,
  FileText,
} from 'lucide-react';
import { AQI_BANDS, aqiBandFor } from '@climence/shared';
import { useOpenMeteoAirQuality } from '../hooks/useOpenMeteoAirQuality';
import { RiyadhGoogleMap } from './map/RiyadhGoogleMap';
import { FeedPanel } from './panels/FeedPanel';
import { ForecastPanel } from './panels/ForecastPanel';
import { HotspotsPanel } from './panels/HotspotsPanel';
import { PollutantsPanel } from './panels/PollutantsPanel';
import { SourcesPanel } from './panels/SourcesPanel';
import { WeatherPanel } from './panels/WeatherPanel';
import {
  seededSeries,
  makePath,
  type HotspotCard,
  type PollutantStat,
  type TimeRange,
} from '../hooks/useDashboardData';

/* ═══════════════════════════ SUB-COMPONENTS ═══════════════════════════ */

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
  co2Series,
  range,
}: {
  pm25Series: number[];
  pm10Series: number[];
  no2Series: number[];
  co2Series: number[];
  range: TimeRange;
}) {
  const width = 340;
  const height = 188;
  const pad = { l: 28, r: 30, t: 8, b: 26 };
  const max = 220;
  const ticks = [0, 50, 100, 150, 200];
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const xAt = (i: number, total: number) => pad.l + (i / Math.max(1, total - 1)) * innerW;
  const yAt = (v: number) => pad.t + innerH - (clamp(v, 0, max) / max) * innerH;

  const labels = range === '1s' ? ['-60s', '-45s', '-30s', '-15s', 'Now']
    : range === '15m' ? ['-15m', '-10m', '-5m', 'Now']
      : range === '30m' ? ['-30m', '-20m', '-10m', 'Now']
        : ['-60m', '-40m', '-20m', 'Now'];

  const pm25Path = makePath(pm25Series, width, height, pad, max);
  const pm10Path = makePath(pm10Series, width, height, pad, max);
  const no2Path = makePath(no2Series, width, height, pad, max);
  const co2Path = makePath(co2Series, width, height, pad, max);

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
      {ticks.map(tick => (<g key={tick}><line className="chart-grid" x1={pad.l} x2={width - pad.r} y1={yAt(tick)} y2={yAt(tick)} /><text className="chart-label" x={pad.l - 6} y={yAt(tick) + 3} textAnchor="end">{tick}</text></g>))}
      {labels.map((label, i) => (<text key={label} className="chart-label" x={xAt(i, labels.length)} y={height - 7} textAnchor="middle">{label}</text>))}
      <line x1={pad.l} x2={width - pad.r} y1={yAt(100)} y2={yAt(100)} stroke="oklch(0.68 0.16 285)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      <text className="chart-label" x={width - pad.r - 3} y={yAt(100) - 3} textAnchor="end" fill="var(--brand)">Alert</text>
      <path d={`${pm25Path} L ${xAt(pm25Series.length - 1, pm25Series.length)} ${yAt(0)} L ${xAt(0, pm25Series.length)} ${yAt(0)} Z`} fill="url(#area-pm25)" />
      <path d={no2Path} fill="none" stroke="oklch(0.85 0.16 95)" strokeWidth="1.5" opacity="0.86" />
      <path d={co2Path} fill="none" stroke="oklch(0.65 0.18 140)" strokeWidth="1.5" opacity="0.86" />
      <path d={pm10Path} fill="none" stroke="oklch(0.78 0.17 60)" strokeWidth="1.5" opacity="0.86" />
      <path d={pm25Path} fill="none" stroke="oklch(0.68 0.20 28)" strokeWidth="1.8" />
      <circle cx={xAt(pm25Series.length - 1, pm25Series.length)} cy={yAt(pm25Series[pm25Series.length - 1] ?? 0)} r="3.5" fill="oklch(0.68 0.20 28)" stroke="var(--bg-0)" strokeWidth="1.5" />
    </svg>
  );
}

function HotspotDrawer({
  hotspot,
  historySeries,
  pollutantStats,
  onClose,
  onOpenReportModal,
}: {
  hotspot: HotspotCard | null;
  historySeries: number[];
  pollutantStats: PollutantStat[];
  onClose: () => void;
  onOpenReportModal?: () => void;
}) {
  const { data: omData } = useOpenMeteoAirQuality(hotspot?.lat, hotspot?.lng);

  if (!hotspot) return null;
  const band = AQI_BANDS.find(b => b.key === hotspot.band);
  const series = historySeries.length > 0 ? historySeries : seededSeries(7, 48, hotspot.metricValue * 0.75, 40);

  // Combine hardware stats with Open-Meteo if available
  const extendedStats = [...pollutantStats.slice(0, 4)];
  if (omData?.current) {
    const c = omData.current;
    const u = omData.current_units;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    extendedStats.push({ key: 'pm10' as any, name: 'PM10', unit: u.pm10 || 'µg/m³', value: c.pm10, delta: 0, pct: 0 });
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    extendedStats.push({ key: 'ozone' as any, name: 'O3', unit: u.ozone || 'µg/m³', value: c.ozone, delta: 0, pct: 0 });
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    extendedStats.push({ key: 'so2' as any, name: 'SO2', unit: u.sulphur_dioxide || 'µg/m³', value: c.sulphur_dioxide, delta: 0, pct: 0 });
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    extendedStats.push({ key: 'dust' as any, name: 'Dust', unit: u.dust || 'µg/m³', value: c.dust, delta: 0, pct: 0 });
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    extendedStats.push({ key: 'uv' as any, name: 'UV Index', unit: '', value: c.uv_index, delta: 0, pct: 0 });
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    extendedStats.push({ key: 'eu_aqi' as any, name: 'EU AQI', unit: '', value: c.european_aqi, delta: 0, pct: 0 });
  }

  return (
    <div className={`drawer ${hotspot ? 'open' : ''}`}>
      <div className="drawer-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Hotspot · rank {hotspot.id}</div>
          <h3>{hotspot.name}</h3>
          <div className="coord">{hotspot.coord}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close drawer"><X size={14} /></button>
      </div>
      <div className="drawer-body">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 12 }}>
          <div className="serif tnum" style={{ fontSize: 72, lineHeight: 0.9, color: `var(--aqi-${hotspot.band})`, letterSpacing: '-0.02em' }}>{hotspot.metricDisplayValue}</div>
          <div>
            <span className="band"><span className="dot" style={{ background: `var(--aqi-${hotspot.band})` }} />{band?.label ?? hotspot.metricLabel}</span>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{hotspot.metricLabel} · {hotspot.metricUnit}</div>
          </div>
        </div>
        <div style={{ margin: '14px 0 6px' }} className="eyebrow">48h trend</div>
        <div style={{ height: 60 }}><Sparkline data={series} color={`var(--aqi-${hotspot.band})`} width={380} height={60} /></div>

        <div style={{ marginTop: 18 }} className="eyebrow">Live Atmospheric Readings</div>
        <div className="pollutant-grid" style={{ marginTop: 8 }}>
          {extendedStats.map(stat => (
            <div key={stat.key} className="pcard" style={{ cursor: 'default' }}>
              <div className="pcard-head"><div className="pcard-name">{stat.name} <span className="sub">{stat.unit}</span></div></div>
              <div className="pcard-val tnum" style={{ fontSize: 22 }}>{stat.value.toFixed(stat.value < 10 ? 1 : 0)}<span className="pcard-unit">{stat.unit}</span></div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          <button
            className="btn"
            style={{ justifyContent: 'center' }}
            onClick={() => onOpenReportModal?.()}
          >
            <FileText size={13} />Full report
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ DASHBOARD ═══════════════════════════ */

// The data bag returned by useDashboardData.
type DashboardData = ReturnType<typeof import('../hooks/useDashboardData').useDashboardData>;

interface DashboardProps {
  data: DashboardData;
  /** Which portion to render — 'main' for center area, 'side' for sidebar. */
  position: 'main' | 'side';
  onNavigate?: (tab: 'overview' | 'livemap' | 'analytics' | 'alerts' | 'sensors' | 'reports') => void;
  onOpenReportModal?: () => void;
}

export function Dashboard({ data: d, position, onNavigate, onOpenReportModal }: DashboardProps) {
  if (position === 'main') return <MainContent d={d} onNavigate={onNavigate} onOpenReportModal={onOpenReportModal} />;
  return <SideContent d={d} />;
}

/* ───── Main (KPI strip + map stage) ───── */

function MainContent({
  d,
  onNavigate,
  onOpenReportModal,
}: {
  d: DashboardData;
  onNavigate?: (tab: 'overview' | 'livemap' | 'analytics' | 'alerts' | 'sensors' | 'reports') => void;
  onOpenReportModal?: () => void;
}) {
  const statusLabel = d.status === 'open' ? 'live' : d.status === 'connecting' ? 'connecting' : 'reconnecting';
  const statusDotClass = d.status === 'open' ? 'ok' : 'warn';
  const [kpiCollapsed, setKpiCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('climence.kpi-collapsed') === '1';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('climence.kpi-collapsed', kpiCollapsed ? '1' : '0');
  }, [kpiCollapsed]);

  const kpiSummary = `AQI ${d.cityAqi} · ${aqiBandFor(d.cityAqi).label.toUpperCase()} · ${d.feed.length} Alerts · ${d.onlineSensorsInView}/${d.sensorsInView.length} Sensors`;

  return (
    <>
      <div className={`kpi-bar ${kpiCollapsed ? 'collapsed' : ''}`}>
        <div className="kpi-bar-header">
          <div className="kpi-summary mono tnum">{kpiSummary}</div>
          <button className="kpi-toggle" onClick={() => setKpiCollapsed(prev => !prev)} aria-label="Toggle KPI bar">
            {kpiCollapsed ? '▼' : '▲'}
          </button>
        </div>
        <div className="kpi-strip">
          <div className="kpi">
            <div className="kpi-label eyebrow"><Activity size={11} /> {d.t('kpi.city')}</div>
            <div className="kpi-row kpi-row--baseline">
              <div className="kpi-value" style={{ color: `var(--aqi-${d.cityBand})` }}>{d.cityAqi}</div>
              <span className="band kpi-band"><span className="dot" style={{ background: `var(--aqi-${d.cityBand})` }} />{aqiBandFor(d.cityAqi).label}</span>
              <span className={`kpi-delta ${d.currentDelta >= 0 ? 'up' : 'down'}`}>
                {d.currentDelta >= 0 ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}
                {d.currentDelta >= 0 ? '+' : ''}{d.currentDelta} vs. prev
              </span>
            </div>
            <div className="kpi-spark"><Sparkline data={d.pm25Series} color="oklch(0.68 0.20 28)" width={240} height={26} /></div>
          </div>

          <div className="kpi">
            <div className="kpi-label eyebrow"><Flame size={11} /> {d.t('kpi.dominant')}</div>
            <div className="kpi-row kpi-row--baseline"><div className="kpi-value">{d.activePollutant}</div><span className="kpi-unit">{d.pollutantMap[d.pollutant]} current</span></div>
            <div className="kpi-meta tnum">Data from {d.sensors.length || 0} active sensors</div>
          </div>

          <div className="kpi">
            <div className="kpi-label eyebrow"><Siren size={11} /> {d.t('kpi.alerts')}</div>
            <div className="kpi-row kpi-row--baseline"><div className="kpi-value" style={{ color: 'var(--aqi-unh)' }}>{d.feed.length}</div><span className="kpi-unit">threshold {d.effectiveAlertThreshold}+ ug/m3</span></div>
            <div className="kpi-meta flex items-center justify-between w-full">
              <span>{d.feed.length} items in live feed</span>
              {onNavigate && (
                <button onClick={() => onNavigate('alerts')} className="text-[var(--brand)] hover:underline text-xs font-medium cursor-pointer">Go to Alerts</button>
              )}
            </div>
          </div>

          <div className="kpi">
            <div className="kpi-label eyebrow"><Radio size={11} /> {d.t('kpi.sensors')}</div>
            <div className="kpi-row kpi-row--baseline">
              <div className="kpi-value">{d.onlineSensorsInView}<span className="kpi-value-sub">/{d.sensorsInView.length}</span></div>
              <span className="kpi-delta down"><ArrowDown size={11} strokeWidth={2.5} />{Math.max(0, d.sensorsInView.length - d.onlineSensorsInView)} offline</span>
            </div>
            <div className="kpi-meta flex items-center justify-between w-full">
              <span>{d.mapBounds ? `Viewport filter active · ${statusLabel}` : `Realtime stream · ${statusLabel}`}</span>
              {onNavigate && (
                <button onClick={() => onNavigate('sensors')} className="text-[var(--brand)] hover:underline text-xs font-medium cursor-pointer">See all sensors</button>
              )}
            </div>
          </div>

          <div className="kpi">
            <div className="kpi-label eyebrow"><Wind size={11} /> {d.t('kpi.wind')}</div>
            <div className="kpi-row kpi-row--center">
              <div className="kpi-value">{d.drift.speedKmh}<span className="kpi-unit">km/h</span></div>
              <span className="band kpi-inline"><span className="dot" style={{ background: 'var(--brand)' }} />→ {d.drift.cardinal}</span>
            </div>
            <div className="kpi-meta">Humidity {d.humidityNow}% · Temp {d.tempNow}°C</div>
          </div>
        </div>
      </div>

      <div className="stage">
        <RiyadhGoogleMap mode={d.mode} sensors={d.sensors} hotspots={d.mapHotspots} heatmapPoints={d.mapHeatmapPoints} zoomPreset={d.zoomPreset} focusTarget={d.mapFocusTarget} onViewportChange={d.handleMapViewportChange} onPickSensor={d.handlePickSensor} dataSource={d.dataSource} />

        <div className="map-panel-tl">
          <div className="pollutants">
            {d.sensorLegend
              .filter(entry => {
                if (d.dataSource === 'stationary') {
                  return !['o3', 'so2', 'co', 'battery'].includes(entry.key);
                }
                return true;
              })
              .map(entry => (
                <button key={entry.key} className={`pollutant-pill ${d.pollutant === entry.key ? 'active' : ''}`} onClick={() => d.setPollutant(entry.key)}>
                  {entry.label}<span className="val tnum">{Math.round(d.pollutantMap[entry.key])}</span>
                </button>
              ))}
          </div>
        </div>

        <div className="map-panel-tr glass">
          <div className="map-tools">
            <button className={`map-tool ${d.zoomPreset === 'city' ? 'active' : ''}`} title="City view" onClick={() => d.setZoomPreset('city')}>City</button>
            <button className={`map-tool ${d.zoomPreset === 'sector' ? 'active' : ''}`} title="Sector view" onClick={() => d.setZoomPreset('sector')}>Sector</button>
            <button className={`map-tool ${d.zoomPreset === 'zone' ? 'active' : ''}`} title="Zone view" onClick={() => d.setZoomPreset('zone')}>Zone</button>
          </div>
        </div>

        <div className="map-panel-bl glass legend">
          <div className="legend-title"><span className="eyebrow">{d.activeMetricConfig.legendTitle}</span><span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{d.activePollutant}</span></div>
          <div className="legend-ramp">{AQI_BANDS.map(band => (<div key={band.key} style={{ background: `var(--aqi-${band.key})` }} />))}</div>
          <div className="legend-scale tnum">{d.activeMetricConfig.legendStops.map(stop => (<span key={stop}>{stop}</span>))}</div>
          <div className="legend-direction">WORSE →</div>
          <div className="legend-bands">{AQI_BANDS.slice(0, 4).map(band => (<div key={band.key} className="legend-row"><span className="sw" style={{ background: `var(--aqi-${band.key})` }} /><span>{band.label}</span></div>))}</div>
        </div>

        <div className="statusbar desktop-only">
          <span className="item"><span className={`d ${statusDotClass}`} />Stream · {statusLabel}</span>
          <span className="item">Model v2.1.4</span>
          <span className="item latency latency--good">Lat. 42ms</span>
          <span className="spacer" />
          <span className="item">Riyadh · UTC+3</span>
          <span className="item">24.7136°, 46.6753°</span>
        </div>

        <HotspotDrawer
          hotspot={d.selectedHotspot}
          historySeries={d.drawerHistorySeries}
          pollutantStats={d.pollutantStats}
          onClose={() => d.setSelected(null)}
          onOpenReportModal={onOpenReportModal}
        />
      </div>
    </>
  );
}

/* ───── Side rail ───── */

function SideContent({ d }: { d: DashboardData }) {
  return (
    <>


      {/* City Trend */}
      <div className="side-group">
        <div className="side-head">
          <div>
            <div className="eyebrow">{d.t('panel.trend.eyebrow')}</div>
            <div className="side-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {d.t('panel.trend')}
              <span className={`trend-pill ${d.trend.direction}`}>
                {d.trend.direction === 'worsening' && <ArrowUp size={10} strokeWidth={2.5} />}
                {d.trend.direction === 'improving' && <ArrowDown size={10} strokeWidth={2.5} />}
                {d.trendLabel}
              </span>
            </div>
          </div>

        </div>
        <div className="chart-wrap"><CityTrendChart pm25Series={d.pm25Series} pm10Series={d.pm10Series} no2Series={d.no2Series} co2Series={d.co2Series} range={d.range} /></div>
        <div className="row-between" style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-2)' }}>
          <div className="row-flex gap-tight">
            <span className="row-flex gap-tight"><span style={{ width: 10, height: 2, background: 'oklch(0.68 0.20 28)' }} /> PM2.5</span>
            <span className="row-flex gap-tight" style={{ marginLeft: 8 }}><span style={{ width: 10, height: 2, background: 'oklch(0.78 0.17 60)' }} /> PM10</span>
            <span className="row-flex gap-tight" style={{ marginLeft: 8 }}><span style={{ width: 10, height: 2, background: 'oklch(0.85 0.16 95)' }} /> NO2</span>
            <span className="row-flex gap-tight" style={{ marginLeft: 8 }}><span style={{ width: 10, height: 2, background: 'oklch(0.65 0.18 140)' }} /> CO2</span>
          </div>
          <span className="mono tnum" style={{ color: 'var(--ink-3)', fontSize: 10.5 }}>updated {d.liveAge} ago</span>
        </div>
      </div>

      <HotspotsPanel data={d} />
      <PollutantsPanel data={d} />
      <WeatherPanel data={d} />
      <ForecastPanel data={d} />
      <SourcesPanel data={d} />
      <FeedPanel data={d} />
    </>
  );
}
