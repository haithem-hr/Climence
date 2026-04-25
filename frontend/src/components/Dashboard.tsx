/**
 * Dashboard.tsx — pure rendering component.
 *
 * Receives all pre-computed data from useDashboardData and renders either
 * the main area (KPI strip + map stage) or the side rail panels, controlled
 * by the `position` prop. No business logic lives here — only JSX.
 */
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  Filter,
  Flame,
  MapPin,
  Radio,
  Siren,
  Sparkles,
  Wind,
  X,
  FileText,
} from 'lucide-react';
import { AQI_BANDS, aqiBandFor } from '@climence/shared';
import { RiyadhGoogleMap } from './map/RiyadhGoogleMap';
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
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const xAt = (i: number, total: number) => pad.l + (i / Math.max(1, total - 1)) * innerW;
  const yAt = (v: number) => pad.t + innerH - (clamp(v, 0, max) / max) * innerH;

  const labels = range === '1h' ? ['14:00', '14:15', '14:30', '14:45', '15:00']
    : range === '24h' ? ['00', '06', '12', '18', '24']
    : range === '7d' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['W1', 'W2', 'W3', 'W4'];

  const pm25Path = makePath(pm25Series, width, height, pad, max);
  const pm10Path = makePath(pm10Series, width, height, pad, max);
  const no2Path = makePath(no2Series, width, height, pad, max);

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
      <path d={pm10Path} fill="none" stroke="oklch(0.78 0.17 60)" strokeWidth="1.5" opacity="0.86" />
      <path d={pm25Path} fill="none" stroke="oklch(0.68 0.20 28)" strokeWidth="1.8" />
      <circle cx={xAt(pm25Series.length - 1, pm25Series.length)} cy={yAt(pm25Series[pm25Series.length - 1] ?? 0)} r="3.5" fill="oklch(0.68 0.20 28)" stroke="var(--bg-0)" strokeWidth="1.5" />
    </svg>
  );
}

function HotspotDrawer({ hotspot, historySeries, pollutantStats, onClose }: { hotspot: HotspotCard | null; historySeries: number[]; pollutantStats: PollutantStat[]; onClose: () => void }) {
  if (!hotspot) return null;
  const band = AQI_BANDS.find(b => b.key === hotspot.band);
  const series = historySeries.length > 0 ? historySeries : seededSeries(7, 48, hotspot.metricValue * 0.75, 40);
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
        <div style={{ marginTop: 18 }} className="eyebrow">Pollutant readings</div>
        <div className="pollutant-grid" style={{ marginTop: 8 }}>
          {pollutantStats.slice(0, 4).map(stat => (
            <div key={stat.key} className="pcard" style={{ cursor: 'default' }}>
              <div className="pcard-head"><div className="pcard-name">{stat.name} <span className="sub">{stat.unit}</span></div></div>
              <div className="pcard-val tnum" style={{ fontSize: 22 }}>{stat.value.toFixed(stat.value < 10 ? 1 : 0)}<span className="pcard-unit">{stat.unit}</span></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn primary" style={{ justifyContent: 'center' }}><Siren size={13} />Dispatch team</button>
          <button className="btn" style={{ justifyContent: 'center' }}><FileText size={13} />Full report</button>
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
}

export function Dashboard({ data: d, position }: DashboardProps) {
  if (position === 'main') return <MainContent d={d} />;
  return <SideContent d={d} />;
}

/* ───── Main (KPI strip + map stage) ───── */

function MainContent({ d }: { d: DashboardData }) {
  const statusLabel = d.status === 'open' ? 'live' : d.status === 'connecting' ? 'connecting' : 'reconnecting';
  const statusDotClass = d.status === 'open' ? 'ok' : 'warn';

  return (
    <>
      <div className="kpi-strip">
        <div className="kpi">
          <div className="kpi-label eyebrow"><Activity size={11} /> {d.t('kpi.city')}</div>
          <div className="kpi-row">
            <div className="kpi-value" style={{ color: `var(--aqi-${d.cityBand})` }}>{d.cityAqi}</div>
            <span className="band"><span className="dot" style={{ background: `var(--aqi-${d.cityBand})` }} />{aqiBandFor(d.cityAqi).label}</span>
            <span className={`kpi-delta ${d.currentDelta >= 0 ? 'up' : 'down'}`}>
              {d.currentDelta >= 0 ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}
              {d.currentDelta >= 0 ? '+' : ''}{d.currentDelta} vs. prev
            </span>
          </div>
          <div className="kpi-spark"><Sparkline data={d.pm25Series} color="oklch(0.68 0.20 28)" width={240} height={26} /></div>
        </div>

        <div className="kpi">
          <div className="kpi-label eyebrow"><Flame size={11} /> {d.t('kpi.dominant')}</div>
          <div className="kpi-row"><div className="kpi-value">{d.activePollutant}</div><span className="kpi-unit">{d.pollutantMap[d.pollutant]} current</span></div>
          <div className="kpi-meta tnum">Data from {d.sensors.length || 0} active sensors</div>
        </div>

        <div className="kpi">
          <div className="kpi-label eyebrow"><Siren size={11} /> {d.t('kpi.alerts')}</div>
          <div className="kpi-row"><div className="kpi-value" style={{ color: 'var(--aqi-unh)' }}>{d.feed.length}</div><span className="kpi-unit">threshold {d.effectiveAlertThreshold}+ ug/m3</span></div>
          <div className="kpi-meta">{d.feed.length} items in live feed</div>
        </div>

        <div className="kpi">
          <div className="kpi-label eyebrow"><Radio size={11} /> {d.t('kpi.sensors')}</div>
          <div className="kpi-row">
            <div className="kpi-value">{d.onlineSensorsInView}<span style={{ color: 'var(--ink-3)', fontSize: 22 }}>/{d.sensorsInView.length}</span></div>
            <span className="kpi-delta down"><ArrowDown size={11} strokeWidth={2.5} />{Math.max(0, d.sensorsInView.length - d.onlineSensorsInView)} offline</span>
          </div>
          <div className="kpi-meta">{d.mapBounds ? `Viewport filter active · ${statusLabel}` : `Realtime stream · ${statusLabel}`}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label eyebrow"><Wind size={11} /> {d.t('kpi.wind')}</div>
          <div className="kpi-row">
            <div className="kpi-value">{d.drift.speedKmh}<span className="kpi-unit" style={{ fontSize: 14, marginLeft: 4 }}>km/h</span></div>
            <span className="band" style={{ paddingTop: 3 }}><span className="dot" style={{ background: 'var(--brand)' }} />→ {d.drift.cardinal}</span>
          </div>
          <div className="kpi-meta">Humidity {d.humidityNow}% · Temp {d.tempNow}°C</div>
        </div>
      </div>

      <div className="stage">
        <RiyadhGoogleMap mode={d.mode} sensors={d.sensors} hotspots={d.mapHotspots} heatmapPoints={d.mapHeatmapPoints} zoomPreset={d.zoomPreset} focusTarget={d.mapFocusTarget} onViewportChange={d.handleMapViewportChange} onPickSensor={d.handlePickSensor} />

        <div className="map-panel-tl">
          <div className="pollutants">
            {d.sensorLegend.map(entry => (
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
          <div className="legend-bands">{AQI_BANDS.slice(0, 4).map(band => (<div key={band.key} className="legend-row"><span className="sw" style={{ background: `var(--aqi-${band.key})` }} /><span>{band.label}</span></div>))}</div>
        </div>

        <div className="map-panel-br glass" style={{ padding: '10px 14px', minWidth: 220 }}>
          <div className="row-between">
            <div><div className="eyebrow">Viewing</div><div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-0)', letterSpacing: '-0.01em' }}>{d.sensorsInView.length} sensors in current bounds</div></div>
            <div style={{ textAlign: 'right' }}><div className="eyebrow">Zoom</div><div className="mono tnum" style={{ fontSize: 13, color: 'var(--ink-1)' }}>{d.mapZoom.toFixed(1)}</div></div>
          </div>
          <div className="divider" style={{ margin: '10px 0' }} />
          <div className="row-between" style={{ fontSize: 11.5 }}>
            <span className="row-flex gap-tight"><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)' }} />{d.onlineSensorsInView} online</span>
            <span className="row-flex gap-tight"><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-3)', opacity: 0.6 }} />{Math.max(0, d.sensorsInView.length - d.onlineSensorsInView)} offline</span>
          </div>
        </div>

        <div className="statusbar desktop-only">
          <span className="item"><span className={`d ${statusDotClass}`} />Stream · {statusLabel}</span>
          <span className="item">Model v2.1.4</span>
          <span className="item">Lat. 42ms</span>
          <span className="spacer" />
          <span className="item">Riyadh · UTC+3</span>
          <span className="item">24.7136°, 46.6753°</span>
        </div>

        <HotspotDrawer hotspot={d.selectedHotspot} historySeries={d.drawerHistorySeries} pollutantStats={d.pollutantStats} onClose={() => d.setSelected(null)} />
      </div>
    </>
  );
}

/* ───── Side rail ───── */

function SideContent({ d }: { d: DashboardData }) {
  return (
    <>
      <div className="banner">
        <div className="banner-icon"><AlertTriangle size={14} /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="banner-title">{d.t('banner.over')} · +{d.thresholdExceededBy} µg/m³</div>
          <div className="banner-sub">Citywide advisory active</div>
        </div>
        <button className="banner-cta">{d.t('banner.dispatch')}</button>
      </div>

      {/* Alert Settings */}
      <div className="side-group">
        <div className="side-head"><div><div className="eyebrow">UC-A4</div><div className="side-title">{d.t('panel.alertSettings')}</div></div></div>
        {d.canManageAlertSettings ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <label className="eyebrow" htmlFor="pm25-threshold-input" style={{ fontSize: 10 }}>PM2.5 threshold (ug/m3)</label>
            <div className="row-flex gap-tight" style={{ alignItems: 'center' }}>
              <input id="pm25-threshold-input" type="number" min={1} max={500} step={0.1} value={d.alertThresholdDraft} onChange={e => { d.setAlertThresholdDraft(e.target.value); d.setAlertConfigState('idle'); }} style={{ flex: 1, minWidth: 0, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', color: 'var(--ink-1)', padding: '8px 10px' }} />
              <button className="btn primary" disabled={d.alertConfigState === 'saving'} onClick={d.handleSaveAlertThreshold}>{d.alertConfigState === 'saving' ? 'Saving...' : 'Save'}</button>
            </div>
            <div className="mono tnum" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Active threshold: {d.effectiveAlertThreshold}</div>
            {d.alertConfigState === 'saved' && <div style={{ fontSize: 11.5, color: 'var(--ok)' }}>Threshold saved and applied to live alerts.</div>}
            {d.alertConfigState === 'error' && <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>Failed to save threshold. Enter a value between 1 and 500.</div>}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>You have read-only access. Only administrators can change alert thresholds.</div>
        )}
      </div>

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
          <div className="range-picker">
            {(['1h', '24h', '7d', '30d'] as TimeRange[]).map(v => (<button key={v} className={d.range === v ? 'active' : ''} onClick={() => d.setRange(v)}>{v}</button>))}
          </div>
        </div>
        <div className="chart-wrap"><CityTrendChart pm25Series={d.pm25Series} pm10Series={d.pm10Series} no2Series={d.no2Series} range={d.range} /></div>
        <div className="row-between" style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-2)' }}>
          <div className="row-flex gap-tight">
            <span className="row-flex gap-tight"><span style={{ width: 10, height: 2, background: 'oklch(0.68 0.20 28)' }} /> PM2.5</span>
            <span className="row-flex gap-tight" style={{ marginLeft: 8 }}><span style={{ width: 10, height: 2, background: 'oklch(0.78 0.17 60)' }} /> PM10</span>
            <span className="row-flex gap-tight" style={{ marginLeft: 8 }}><span style={{ width: 10, height: 2, background: 'oklch(0.85 0.16 95)' }} /> NO2</span>
          </div>
          <span className="mono tnum" style={{ color: 'var(--ink-3)', fontSize: 10.5 }}>updated {d.liveAge} ago</span>
        </div>
      </div>

      {/* Hotspots */}
      <div className="side-group">
        <div className="side-head">
          <div><div className="eyebrow">{d.t('panel.hotspots.eyebrow')}</div><div className="side-title">{d.t('panel.hotspots')} <span className="cnt">{String(d.hotspots.length).padStart(2, '0')}</span></div></div>
          <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }}><MapPin size={11} /> {d.t('btn.onMap')}</button>
        </div>
        <ul>
          {d.hotspots.map((hotspot, index) => (
            <li key={hotspot.id} className={`hotspot ${d.selectedHotspot?.id === hotspot.id ? 'selected' : ''}`} onClick={() => d.handlePickHotspot(hotspot)}>
              <div className="hotspot-rank">#{String(index + 1).padStart(2, '0')}</div>
              <div><div className="hotspot-name">{hotspot.name}</div><div className="hotspot-coord">{hotspot.coord} · dom. {hotspot.pollutant}</div></div>
              <div className={`hotspot-val ${hotspot.band}`}><div className="n tnum">{hotspot.metricDisplayValue}</div><div className="u">{hotspot.metricLabel} · {hotspot.trend > 0 ? '+' : ''}{hotspot.trend}%</div></div>
            </li>
          ))}
        </ul>
      </div>

      {/* Pollutants */}
      <div className="side-group">
        <div className="side-head"><div><div className="eyebrow">{d.t('panel.pollutants.eyebrow')}</div><div className="side-title">{d.t('panel.pollutants')}</div></div><button className="btn" style={{ padding: '5px 10px', fontSize: 11 }}><Filter size={11} /> {d.t('btn.all')}</button></div>
        <div className="pollutant-grid">
          {d.pollutantStats.map(stat => {
            const pctColor = stat.pct > 70 ? 'var(--aqi-unh)' : stat.pct > 50 ? 'var(--aqi-usg)' : stat.pct > 30 ? 'var(--aqi-mod)' : 'var(--aqi-good)';
            return (
              <div key={stat.key} className={`pcard ${d.pollutant === stat.key ? 'active' : ''}`} onClick={() => d.setPollutant(stat.key)}>
                <div className="pcard-head"><div className="pcard-name">{stat.name} <span className="sub">{stat.unit}</span></div><span className={`pcard-delta ${stat.delta >= 0 ? 'up' : 'down'}`}>{stat.delta >= 0 ? '+' : ''}{stat.delta}</span></div>
                <div className="pcard-val tnum">{stat.value.toFixed(stat.value < 10 ? 1 : 0)}<span className="pcard-unit">{stat.unit}</span></div>
                <div className="pcard-bar"><div className="fill" style={{ width: `${stat.pct}%`, background: pctColor }} /></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weather */}
      <div className="side-group">
        <div className="side-head"><div><div className="eyebrow">{d.t('panel.weather.eyebrow')}</div><div className="side-title">{d.t('panel.weather')}</div></div><span className="mono tnum" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Riyadh · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span></div>
        <div className="weather-row">
          <div className="weather-cell"><div className="l">{d.t('weather.temp')}</div><div className="v tnum">{d.tempNow}<span className="u"> C</span></div></div>
          <div className="weather-cell"><div className="l">{d.t('weather.humidity')}</div><div className="v tnum">{d.humidityNow}<span className="u"> %</span></div></div>
          <div className="weather-cell"><div className="l">{d.t('weather.pressure')}</div><div className="v tnum">1013<span className="u"> hPa</span></div></div>
        </div>
        <div className="wind-compass">
          <div className="compass"><div className="compass-arrow" style={{ transform: `rotate(${d.drift.headingDeg}deg)`, transition: 'transform 0.6s ease' }}><MapPin size={20} /></div></div>
          <div className="wind-meta"><div className="hd">{d.t('weather.windHeader')}</div><div className="dir">{d.drift.speedKmh} <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>km/h · {d.drift.cardinal}</span></div><div className="sub">{d.drift.description}</div></div>
        </div>
      </div>

      {/* Forecast */}
      <div className="side-group">
        <div className="side-head"><div><div className="eyebrow">{d.t('panel.forecast.eyebrow')}</div><div className="side-title">{d.t('panel.forecast')}</div></div><span className="band" title="Linear trend + mean reversion"><Sparkles size={10} /> trend v1</span></div>
        <div className="forecast">{d.forecast.map(point => (<div key={point.hr} className="f-cell"><div className="f-hr">{point.hr}</div><div className="f-val tnum">{point.val}</div><div className="f-dot" style={{ background: `var(--aqi-${point.band})` }} /></div>))}</div>
      </div>

      {/* Sources */}
      <div className="side-group">
        <div className="side-head"><div><div className="eyebrow">{d.t('panel.sources.eyebrow')}</div><div className="side-title">{d.t('panel.sources')}</div></div></div>
        <div className="src-bar">{d.sources.map(source => (<div key={source.key} style={{ flex: source.pct, background: source.color }}>{source.pct}%</div>))}</div>
        <div className="src-legend">{d.sources.map(source => (<div key={source.key} className="src-row"><span className="sw" style={{ background: source.color }} /><span>{source.name}</span><span className="pct tnum">{source.pct}%</span></div>))}</div>
      </div>

      {/* Alert Feed */}
      <div className="side-group">
        <div className="side-head"><div><div className="eyebrow">{d.t('panel.feed.eyebrow')}</div><div className="side-title">{d.t('panel.feed')}</div></div><button className="btn" style={{ padding: '5px 10px', fontSize: 11 }}>{d.t('btn.all')}</button></div>
        <ul>
          {d.feed.map(item => (
            <li key={item.id} className="alert">
              <div className={`alert-icon ${item.severity}`}>
                {item.severity === 'crit' || item.severity === 'warn' ? <AlertTriangle size={12} /> : item.severity === 'ok' ? <Activity size={12} /> : <Bell size={12} />}
              </div>
              <div className="alert-body"><div className="t"><b>{item.title}</b></div><div className="m">{item.meta}</div></div>
              <div className="alert-time">{item.time}</div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
