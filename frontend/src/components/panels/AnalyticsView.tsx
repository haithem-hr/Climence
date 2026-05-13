/* eslint-disable */
import { useState, useEffect, useCallback } from 'react';
import { 
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, 
  PieChart, Pie, Cell, BarChart, Bar 
} from 'recharts';
import { Download, Maximize2, PieChart as PieIcon, BarChart2, Clock, RefreshCw } from 'lucide-react';
import { fetchHistoryByZone, fetchOpenMeteoHistory, fetchForecast } from '../../api/client';
import type { ForecastPoint } from '@climence/shared';

import type { DashboardData } from '../../hooks/useDashboardData';
import { openPrintablePdf } from '../../lib/reports';
import { translate } from '../../lib/i18n';

interface AnalyticsViewProps {
  authToken: string | null;
  data: DashboardData;
}

const RANGES = ['1h', '6h', '12h', '24h', '3d', '1m'] as const;
type TimeRange = typeof RANGES[number];

// Ranges that use Open-Meteo historical data (hourly granularity, 92 days back)
// '1h' uses the live SQLite DB (per-minute granularity, auto-refreshed every 30s)
const USE_OPEN_METEO = new Set<TimeRange>(['6h', '12h', '24h', '3d', '1m']);

// Map UI label → backend range key for Open-Meteo endpoint
const OM_RANGE: Record<TimeRange, string> = {
  '1h':  '1h',   // unused — SQLite path
  '6h':  '6h',
  '12h': '12h',
  '24h': '24h',
  '3d':  '3d',
  '1m':  '30d',
};

const FORECAST_HORIZONS = [
  { label: 'Hourly', val: 6 },
  { label: '1D', val: 24 },
  { label: '3D', val: 72 },
  { label: '5D', val: 120 },
  { label: '7D', val: 168 }
] as const;

const POLLUTANT_COLORS = {
  pm25: 'var(--brand)',
  pm10: 'oklch(0.78 0.17 60)',
  co2:  'oklch(0.68 0.20 28)',
  no2:  'oklch(0.60 0.14 250)',
  dust: 'oklch(0.85 0.15 80)',
};

interface AnalyticsPoint {
  time: string;
  pm25: number;
  pm10: number;
  co2:  number;
  no2:  number;
  dust: number;
  isForecast: boolean;
}

// Auto-refresh interval for the live 1h chart (ms)
const LIVE_REFRESH_MS = 30_000;

export function AnalyticsView({ authToken, data: d }: AnalyticsViewProps) {
  const t = (key: Parameters<typeof translate>[0]) => translate(key, d.locale);
  const [range, setRange]               = useState<TimeRange>('24h');
  const [showForecast, setShowForecast] = useState(false);
  const [forecastHorizon, setForecastHorizon] = useState<number>(24);
  const [loading, setLoading]           = useState(true);
  const [lastRefresh, setLastRefresh]   = useState<Date>(new Date());

  const [enabled, setEnabled] = useState({
    pm25: true, pm10: true, co2: true, no2: true, dust: true,
  });

  const [historyData, setHistoryData]   = useState<AnalyticsPoint[]>([]);
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);

  const loadData = useCallback(async (silent = false) => {
    if (!authToken) return;
    if (!silent) setLoading(true);

    try {
      let merged: AnalyticsPoint[] = [];

      if (USE_OPEN_METEO.has(range)) {
        // ── Historical path: Open-Meteo (hourly, 92 days) ──
        const rows = await fetchOpenMeteoHistory(OM_RANGE[range], authToken);
        merged = rows.map(r => ({ ...r, time: r.label, isForecast: false }));
      } else {
        // ── Live path: SQLite per-minute data (1h only) ──
        const [pm25, co2, no2] = await Promise.all([
          fetchHistoryByZone('pm25', '1h', undefined, undefined, undefined, authToken),
          fetchHistoryByZone('co2',  '1h', undefined, undefined, undefined, authToken),
          fetchHistoryByZone('no2',  '1h', undefined, undefined, undefined, authToken),
        ]);
        for (let i = 0; i < pm25.length; i++) {
          const p25 = pm25[i]?.value ?? 0;
          merged.push({
            time:       pm25[i]?.label ?? '',
            pm25:       p25,
            pm10:       p25 * 1.18,
            co2:        co2[i]?.value  ?? 0,
            no2:        no2[i]?.value  ?? 0,
            dust:       p25 * 0.4,
            isForecast: false,
          });
        }
      }

      setHistoryData(merged);
      setLastRefresh(new Date());

      if (showForecast) {
        const fData = await fetchForecast(forecastHorizon, authToken);
        setForecastData(fData);
      }
    } catch (err) {
      console.error('[AnalyticsView] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [authToken, range, showForecast, forecastHorizon]);

  // Initial load + re-load when range / forecast settings change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 30-second auto-refresh (silent — no spinner)
  useEffect(() => {
    const id = setInterval(() => loadData(true), LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadData]);

  const combinedData = [...historyData];
  if (showForecast && forecastData.length > 0) {
    for (const f of forecastData) {
      combinedData.push({
        time: f.hourIso,
        pm25: f.pm25 ?? 0,
        pm10: f.pm10 ?? 0,
        co2: f.co2 ?? 0,
        no2: f.no2 ?? 0,
        dust: f.dust ?? 0,
        isForecast: true
      });
    }
  }

  const formatXAxis = (tickItem: string | number) => {
    try {
      const d = new Date(tickItem);
      if (isNaN(d.getTime())) return String(tickItem);
      
      if (range === '1h' || range === '6h' || range === '12h') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (range === '24h' || range === '3d') {
        return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
      }
      if (range === '1m') {
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
      // For very long combined views
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return String(tickItem);
    }
  };

  const formatXAxisLabel = (label: unknown) => {
    if (typeof label === 'string' || typeof label === 'number') {
      return formatXAxis(label);
    }
    return formatXAxis(String(label ?? ''));
  };

  const getStats = (key: keyof typeof enabled) => {
    const values = combinedData.map(d => d[key] as number).filter(v => v !== undefined && !isNaN(v));
    if (!values.length) return { min: 0, max: 0, avg: 0 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { min: Math.round(min), max: Math.round(max), avg: Math.round(avg) };
  };

  const pieData = (Object.keys(enabled) as Array<keyof typeof enabled>)
    .filter(k => enabled[k])
    .map(key => ({
      name: key.toUpperCase(),
      value: getStats(key).avg,
      color: POLLUTANT_COLORS[key]
    }));

  const barData = (Object.keys(enabled) as Array<keyof typeof enabled>)
    .filter(k => enabled[k])
    .map(key => ({
      name: key.toUpperCase(),
      peak: getStats(key).max,
      color: POLLUTANT_COLORS[key]
    }));

  return (
  <div className="analytics-view">
      
      {/* Header & Controls */}
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">
            {t('analytics.title')}
          </h2>
          <div className="analytics-controls">
            <div className="analytics-range-group">
              {RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`analytics-range-btn ${range === r ? 'active' : ''}`}
                >
                  {r === '1m' ? '3m' : r}
                </button>
              ))}
            </div>

            <div className="analytics-divider" />

            <div className="analytics-forecast-controls">
              <button
                onClick={() => setShowForecast(!showForecast)}
                className={`analytics-forecast-btn ${showForecast ? 'active' : ''}`}
              >
                <Maximize2 size={14} /> {showForecast ? t('analytics.forecast.hide') : t('analytics.forecast.show')}
              </button>

              {showForecast && (
                <div className="analytics-forecast-horizons">
                  {FORECAST_HORIZONS.map(h => (
                    <button
                      key={h.val}
                      onClick={() => setForecastHorizon(h.val)}
                      className={`analytics-forecast-pill ${forecastHorizon === h.val ? 'active' : ''}`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={() => openPrintablePdf(d.reportPayload)}
          className="analytics-export-btn"
        >
          <Download size={16} /> {t('analytics.export')}
        </button>
      </div>

      {/* Main Massive Chart */}
      <div className="glass analytics-chart-card">
        <div className="analytics-chart-head">
          <div className="analytics-chart-title">
            <h3 className="eyebrow analytics-chart-eyebrow">
              <Clock size={16} />
              {USE_OPEN_METEO.has(range) ? 'Historical Air Quality · Open-Meteo' : 'Live Sensor Stream · 1-min resolution'}
            </h3>
            {showForecast && <span className="analytics-forecast-badge">Forecast Active</span>}
            {USE_OPEN_METEO.has(range) && (
              <span className="analytics-source-badge">CAMS Satellite · Riyadh 24.71°N 46.68°E</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="analytics-last-refresh mono" title="Last data refresh">
              ↺ {t('analytics.lastRefresh')} {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              className="icon-btn"
              onClick={() => loadData()}
              title="Refresh now"
              style={{ width: 28, height: 28, borderRadius: 7 }}
            >
              <RefreshCw size={12} />
            </button>
            <div className="analytics-series-toggles">
              {(Object.keys(enabled) as Array<keyof typeof enabled>).map(key => (
                <label
                  key={key}
                  className={`analytics-series-label analytics-series-${key} ${enabled[key] ? '' : 'is-disabled'}`}
                >
                  <input 
                    type="checkbox" 
                    checked={enabled[key]} 
                    onChange={() => setEnabled(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="analytics-series-checkbox"
                  />
                  <span className="analytics-series-text">{key.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="analytics-loading">
            <span className="spinning analytics-loading-spinner">◌</span> Aligning Orbital Sensors...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" opacity={0.4} />
              <XAxis 
                dataKey="time" 
                stroke="var(--ink-3)" 
                fontSize={11} 
                tickLine={false} 
                tick={{fill: 'var(--ink-2)', fontWeight: 500}} 
                minTickGap={range === '1h' ? 40 : 80}
                tickFormatter={formatXAxis}
              />
              <YAxis yAxisId="left" stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
              {enabled.co2 && <YAxis yAxisId="right" orientation="right" stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />}
              
              <Tooltip 
                contentStyle={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 15px 35px -10px rgba(0,0,0,0.15)', padding: '16px' }}
                itemStyle={{ fontSize: 12, fontWeight: 700, padding: '4px 0' }}
                labelStyle={{ color: 'var(--ink-3)', marginBottom: 10, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}
                labelFormatter={formatXAxisLabel}
              />
              <Legend verticalAlign="top" height={40} align="right" iconType="circle" />
              
              {enabled.pm25 && <Line yAxisId="left" type="monotone" dataKey="pm25" name="PM2.5" stroke={POLLUTANT_COLORS.pm25} strokeWidth={3} dot={false} isAnimationActive={false} />}
              {enabled.pm10 && <Line yAxisId="left" type="monotone" dataKey="pm10" name="PM10" stroke={POLLUTANT_COLORS.pm10} strokeWidth={3} dot={false} isAnimationActive={false} />}
              {enabled.co2 && <Line yAxisId="right" type="monotone" dataKey="co2" name="CO2" stroke={POLLUTANT_COLORS.co2} strokeWidth={3} dot={false} isAnimationActive={false} />}
              {enabled.no2 && <Line yAxisId="left" type="monotone" dataKey="no2" name="NO2" stroke={POLLUTANT_COLORS.no2} strokeWidth={3} dot={false} isAnimationActive={false} />}
              {enabled.dust && <Line yAxisId="left" type="monotone" dataKey="dust" name="Dust" stroke={POLLUTANT_COLORS.dust} strokeWidth={3} dot={false} isAnimationActive={false} />}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stats Summary Grid */}
      <div className="analytics-grid">
        <div className="glass analytics-subcard">
          <h3 className="eyebrow analytics-subcard-title">
            <PieIcon size={16} /> Pollutant Load Contribution
          </h3>
          <div className="analytics-subcard-body">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                  animationDuration={1200}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 12 }}
                  itemStyle={{ fontSize: 12, fontWeight: 700 }}
                />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass analytics-subcard">
          <h3 className="eyebrow analytics-subcard-title">
            <BarChart2 size={16} /> Historical Peak Comparison
          </h3>
          <div className="analytics-subcard-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" opacity={0.4} />
                <XAxis dataKey="name" stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--ink-3)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'var(--bg-1)', opacity: 0.3 }}
                  contentStyle={{ background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 12 }}
                />
                <Bar dataKey="peak" radius={[8, 8, 0, 0]} barSize={40}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass analytics-metrics-card">
        <h3 className="eyebrow analytics-metrics-title">Deep Parameter Metrics ({range === '1m' ? '3 Months' : range})</h3>
        <div className="analytics-metrics-grid">
          {(Object.keys(enabled) as Array<keyof typeof enabled>).filter(k => enabled[k]).map(key => {
            const stats = getStats(key);
            return (
              <div key={key} className={`analytics-metric-card analytics-metric-card--${key}`}>
                <div className="analytics-metric-bar" />
                <div className="analytics-metric-name">{key.toUpperCase()}</div>
                <div className="analytics-metric-stats">
                  <div className="analytics-metric-row">
                    <span>Avg</span> <span className="analytics-metric-value">{stats.avg}</span>
                  </div>
                  <div className="analytics-metric-row">
                    <span>Peak</span> <span className="analytics-metric-value analytics-metric-value--peak">{stats.max}</span>
                  </div>
                  <div className="analytics-metric-row">
                    <span>Floor</span> <span className="analytics-metric-value">{stats.min}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}
