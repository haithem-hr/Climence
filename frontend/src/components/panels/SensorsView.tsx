import { useState } from 'react';
import { Activity, Battery, ChevronDown, ChevronUp, Cpu, Radio } from 'lucide-react';
import type { DashboardData } from '../../hooks/useDashboardData';
import { aqiBandFor, pm25ToAqi } from '@climence/shared';
import { useOpenMeteoAirQuality } from '../../hooks/useOpenMeteoAirQuality';
import type { RiyadhMapSensor } from '../map/RiyadhGoogleMap';

export function SensorsView({ data: d }: { data: DashboardData }) {
  return (
    <div className="p-6 h-full overflow-y-auto bg-[var(--bg-0)] animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--bg-1)] to-[var(--bg-0)] border border-[var(--line)] p-8 shadow-sm">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--brand)] opacity-[0.03] blur-3xl rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(3,218,197,0.1)] text-[var(--cc-teal)] text-xs font-semibold tracking-wide uppercase mb-4">
                <Radio size={12} className="animate-pulse" /> Grid Network
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2 text-[var(--ink-1)]">Sensor Array</h1>
              <p className="text-[var(--ink-2)] text-base max-w-xl">Monitor the real-time telemetry and hardware status of all active environmental sensors across the city grid.</p>
            </div>
            
            <div className="flex gap-4">
              <div className="flex flex-col items-end">
                <span className="text-4xl font-light tracking-tighter text-[var(--ink-1)]">{d.sensors.length}</span>
                <span className="text-xs font-medium text-[var(--ink-3)] uppercase tracking-widest">Total Units</span>
              </div>
              <div className="w-px bg-[var(--line)] self-stretch mx-2" />
              <div className="flex flex-col items-end">
                <span className="text-4xl font-light tracking-tighter text-[var(--brand)]">{d.onlineSensors}</span>
                <span className="text-xs font-medium text-[var(--brand)] uppercase tracking-widest">Online</span>
              </div>
              {d.sensors.length - d.onlineSensors > 0 && (
                <>
                  <div className="w-px bg-[var(--line)] self-stretch mx-2" />
                  <div className="flex flex-col items-end">
                    <span className="text-4xl font-light tracking-tighter text-[var(--danger)]">{d.sensors.length - d.onlineSensors}</span>
                    <span className="text-xs font-medium text-[var(--danger)] uppercase tracking-widest">Offline</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {d.sensors.map((sensor, i) => (
            <SensorCard key={sensor.uuid} sensor={sensor} i={i} d={d} />
          ))}
        </div>

      </div>
    </div>
  );
}

function SensorCard({ sensor, i, d }: { sensor: RiyadhMapSensor; i: number; d: DashboardData }) {
  const isOffline = sensor.status === 'offline';
  const aqiBand = aqiBandFor(sensor.aqi || pm25ToAqi(sensor.pm25));
  const [expanded, setExpanded] = useState(false);
  const { data: omData } = useOpenMeteoAirQuality(sensor.lat, sensor.lng);

  return (
    <div 
      className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${isOffline ? 'bg-[var(--bg-0)] border-[var(--line)] opacity-60' : 'bg-[var(--bg-0)] border-[var(--line)] hover:border-[var(--brand-30)] hover:shadow-lg'} ${expanded ? 'shadow-lg border-[var(--brand-30)] z-10' : ''}`}
      style={{ animationDelay: `${(i % 10) * 50}ms` }}
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-[var(--ink-1)] flex items-center gap-2">
            <Cpu size={18} className={isOffline ? 'text-[var(--ink-3)]' : 'text-[var(--brand)]'} />
            {sensor.label || `Sensor ${sensor.uuid.slice(0, 8)}`}
          </h3>
          <p className="text-xs text-[var(--ink-3)] font-mono mt-1">{sensor.lat.toFixed(4)}, {sensor.lng.toFixed(4)}</p>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          isOffline 
            ? 'bg-transparent text-[var(--ink-3)] border-[var(--line)]' 
            : 'bg-[var(--brand-10)] text-[var(--brand)] border-[var(--brand-20)]'
        }`}>
          {isOffline ? 'Offline' : 'Online'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] flex items-center gap-1"><Activity size={12} /> PM2.5</span>
          <span className="text-xl font-medium tnum flex items-baseline gap-1 text-[var(--ink-1)]">
            {isOffline ? '--' : Math.round(sensor.pm25)}
            <span className="text-xs text-[var(--ink-3)]">µg/m³</span>
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] flex items-center gap-1"><Battery size={12} /> Battery</span>
          <span className={`text-xl font-medium tnum flex items-baseline gap-1 ${!isOffline && sensor.battery < 20 ? 'text-[var(--danger)]' : 'text-[var(--ink-1)]'}`}>
            {isOffline ? '--' : Math.round(sensor.battery)}
            <span className="text-xs text-[var(--ink-3)]">%</span>
          </span>
        </div>
      </div>

      {expanded && omData?.current && !isOffline && (
        <div className="mt-6 pt-4 border-t border-[var(--line)] animate-in fade-in slide-in-from-top-2">
          <h4 className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mb-3">Live Atmospheric Breakdown</h4>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--ink-3)]">PM10</span>
              <span className="text-sm font-medium tnum">{omData.current.pm10} <span className="text-[10px] text-[var(--ink-3)]">µg/m³</span></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--ink-3)]">Ozone (O3)</span>
              <span className="text-sm font-medium tnum">{omData.current.ozone} <span className="text-[10px] text-[var(--ink-3)]">µg/m³</span></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--ink-3)]">SO2</span>
              <span className="text-sm font-medium tnum">{omData.current.sulphur_dioxide} <span className="text-[10px] text-[var(--ink-3)]">µg/m³</span></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--ink-3)]">Dust</span>
              <span className="text-sm font-medium tnum">{omData.current.dust} <span className="text-[10px] text-[var(--ink-3)]">µg/m³</span></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--ink-3)]">UV Index</span>
              <span className="text-sm font-medium tnum">{omData.current.uv_index}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--ink-3)]">EU AQI</span>
              <span className="text-sm font-medium tnum">{omData.current.european_aqi}</span>
            </div>
          </div>
        </div>
      )}

      {!isOffline && (
        <div className="mt-6 pt-4 border-t border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-sm text-[var(--ink-3)]">Current AQI</span>
              <span className="text-sm font-bold ml-2" style={{ color: aqiBand.key === 'good' ? 'var(--brand)' : aqiBand.key === 'mod' || aqiBand.key === 'usg' ? 'var(--warn)' : 'var(--danger)' }}>
                {Math.round(sensor.aqi || pm25ToAqi(sensor.pm25))} · {aqiBand.label}
              </span>
            </div>
            <button 
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-md text-[var(--ink-3)] hover:bg-[var(--bg-1)] hover:text-[var(--ink-1)] transition-colors"
              title={expanded ? "Show less" : "Show more details"}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          <button
            onClick={() => {
              d.handlePickSensor(sensor);
              d.setCurrentTab('livemap');
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-1)] hover:bg-[var(--bg-2)] text-[var(--brand)] transition-colors border border-[var(--line)]"
          >
            See on Map
          </button>
        </div>
      )}
    </div>
  );
}
