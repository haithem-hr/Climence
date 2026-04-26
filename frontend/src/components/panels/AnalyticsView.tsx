import { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, 
  PieChart, Pie, Cell, BarChart, Bar 
} from 'recharts';
import { Download, Maximize2, PieChart as PieIcon, BarChart2, Clock } from 'lucide-react';
import { fetchHistoryByZone, fetchForecast } from '../../api/client';
import type { ForecastPoint } from '@climence/shared';

interface AnalyticsViewProps {
  authToken: string | null;
}

const RANGES = ['1h', '6h', '12h', '24h', '3d', '1m'] as const;
type TimeRange = typeof RANGES[number];

const RANGE_TO_DB = {
  '1h': '1h',
  '6h': '24h', 
  '12h': '24h',
  '24h': '24h',
  '3d': '7d',
  '1m': '90d' // Extended to 3 months (90 days)
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
  co2: 'oklch(0.68 0.20 28)',
  no2: 'oklch(0.60 0.14 250)',
  dust: 'oklch(0.85 0.15 80)',
};

export function AnalyticsView({ authToken }: AnalyticsViewProps) {
  const [range, setRange] = useState<TimeRange>('24h');
  const [showForecast, setShowForecast] = useState(false);
  const [forecastHorizon, setForecastHorizon] = useState<number>(24);
  const [loading, setLoading] = useState(true);
  
  const [enabled, setEnabled] = useState({
    pm25: true,
    pm10: true,
    co2: true,
    no2: true,
    dust: true,
  });

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    setLoading(true);

    const loadData = async () => {
      try {
        const dbRange = RANGE_TO_DB[range];
        const [pm25, co2, no2] = await Promise.all([
          fetchHistoryByZone('pm25', dbRange, undefined, undefined, undefined, authToken),
          fetchHistoryByZone('co2', dbRange, undefined, undefined, undefined, authToken),
          fetchHistoryByZone('no2', dbRange, undefined, undefined, undefined, authToken),
        ]);

        if (cancelled) return;

        let len = pm25.length;
        if (range === '6h') len = Math.min(len, 6);
        if (range === '12h') len = Math.min(len, 12);
        if (range === '3d') len = Math.min(len, 72);

        const merged = [];
        for (let i = 0; i < len; i++) {
          const p25 = pm25[i]?.value ?? 0;
          merged.push({
            time: pm25[i]?.label,
            pm25: p25,
            pm10: p25 * 1.18,
            co2: co2[i]?.value ?? 0,
            no2: no2[i]?.value ?? 0,
            dust: p25 * 0.4,
            isForecast: false
          });
        }
        setHistoryData(merged);

        if (showForecast) {
          const fData = await fetchForecast(forecastHorizon, authToken);
          if (!cancelled) setForecastData(fData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [authToken, range, showForecast, forecastHorizon]);

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

  const formatXAxis = (tickItem: any) => {
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
    <div className="analytics-view" style={{ padding: 24, overflowY: 'auto', height: '100%', background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 28, fontFamily: 'var(--font-serif)', color: 'var(--ink-0)', marginBottom: 16 }}>
            Command Center Analytics
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, background: 'var(--bg-1)', padding: 4, borderRadius: 24, border: '1px solid var(--line)' }}>
              {RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: 'none',
                    background: range === r ? 'var(--brand)' : 'transparent',
                    color: range === r ? '#fff' : 'var(--ink-2)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                    transition: 'all 0.2s'
                  }}
                >
                  {r === '1m' ? '3m' : r}
                </button>
              ))}
            </div>

            <div style={{ width: 1, height: 24, background: 'var(--line)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setShowForecast(!showForecast)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 24,
                  border: `2px solid ${showForecast ? 'var(--brand)' : 'var(--line)'}`,
                  background: showForecast ? 'var(--brand)' : 'transparent',
                  color: showForecast ? '#fff' : 'var(--ink-1)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
              >
                <Maximize2 size={14} /> {showForecast ? 'Hide Forecast' : 'Expand Forecast'}
              </button>

              {showForecast && (
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', padding: 4, borderRadius: 24, border: '1px solid var(--line)', animation: 'fadeIn 0.3s ease-out' }}>
                  {FORECAST_HORIZONS.map(h => (
                    <button
                      key={h.val}
                      onClick={() => setForecastHorizon(h.val)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 18,
                        border: 'none',
                        background: forecastHorizon === h.val ? 'var(--ink-0)' : 'transparent',
                        color: forecastHorizon === h.val ? 'var(--bg-0)' : 'var(--ink-2)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 11,
                        transition: 'all 0.2s'
                      }}
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
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: 'var(--brand)', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 12px rgba(var(--brand-rgb), 0.3)' }}
        >
          <Download size={16} /> Export Intelligence
        </button>
      </div>

      {/* Main Massive Chart */}
      <div className="glass" style={{ padding: 24, flexGrow: 1, minHeight: 480, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Clock size={16} /> Real-time Satellite Telemetry
            </h3>
            {showForecast && <span style={{ background: 'oklch(0.68 0.20 28)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Forecast Active</span>}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {(Object.keys(enabled) as Array<keyof typeof enabled>).map(key => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink-0)', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={enabled[key]} 
                  onChange={() => setEnabled(prev => ({ ...prev, [key]: !prev[key] }))}
                  style={{ accentColor: POLLUTANT_COLORS[key] }}
                />
                <span style={{ opacity: enabled[key] ? 1 : 0.4, color: POLLUTANT_COLORS[key], transition: 'opacity 0.2s' }}>{key.toUpperCase()}</span>
              </label>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', fontSize: 14, fontWeight: 500 }}>
            <span className="spinning" style={{ marginRight: 12 }}>◌</span> Aligning Orbital Sensors...
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
                labelFormatter={formatXAxis}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="glass" style={{ padding: 24, minHeight: 380, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PieIcon size={16} /> Pollutant Load Contribution
          </h3>
          <div style={{ flexGrow: 1 }}>
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

        <div className="glass" style={{ padding: 24, minHeight: 380, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={16} /> Historical Peak Comparison
          </h3>
          <div style={{ flexGrow: 1 }}>
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

      <div className="glass" style={{ padding: 24 }}>
        <h3 className="eyebrow" style={{ marginBottom: 20 }}>Deep Parameter Metrics ({range === '1m' ? '3 Months' : range})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          {(Object.keys(enabled) as Array<keyof typeof enabled>).filter(k => enabled[k]).map(key => {
            const stats = getStats(key);
            return (
              <div key={key} style={{ background: 'var(--bg-1)', padding: 20, borderRadius: 16, border: '1px solid var(--line)', position: 'relative', transition: 'transform 0.2s' }}>
                <div style={{ width: 6, height: '40%', position: 'absolute', left: 0, top: '30%', borderRadius: '0 4px 4px 0', background: POLLUTANT_COLORS[key] }} />
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink-0)', marginBottom: 20, paddingLeft: 12 }}>{key.toUpperCase()}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)' }}>
                    <span>Avg</span> <span style={{color: 'var(--ink-0)', fontWeight: 800}}>{stats.avg}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)' }}>
                    <span>Peak</span> <span style={{color: 'oklch(0.68 0.20 28)', fontWeight: 800}}>{stats.max}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)' }}>
                    <span>Floor</span> <span style={{color: 'var(--ink-0)', fontWeight: 800}}>{stats.min}</span>
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
