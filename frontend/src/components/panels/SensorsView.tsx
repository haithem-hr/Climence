import { useState } from 'react';
import { Activity, Battery, Cpu, MapPin, Radio, X, Wind } from 'lucide-react';
import type { DashboardData } from '../../hooks/useDashboardData';
import { aqiBandFor, pm25ToAqi } from '@climence/shared';
import { useOpenMeteoAirQuality } from '../../hooks/useOpenMeteoAirQuality';
import type { RiyadhMapSensor } from '../map/RiyadhGoogleMap';

export function SensorsView({ data: d }: { data: DashboardData }) {
  const [detailTarget, setDetailTarget] = useState<RiyadhMapSensor | null>(null);

  return (
    <div className="p-6 h-full overflow-y-auto bg-[var(--bg-0)] animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--bg-1)] to-[var(--bg-0)] border border-[var(--line)] p-8 shadow-sm">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--brand)] opacity-[0.03] blur-3xl rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(3,218,197,0.1)] text-[var(--cc-teal)] text-xs font-semibold tracking-wide uppercase mb-4">
                <Radio size={12} className="animate-pulse" /> {d.t('sensors.gridNetwork')}
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2 text-[var(--ink-1)]">{d.t('sensors.title')}</h1>
              <p className="text-[var(--ink-2)] text-base max-w-xl">{d.t('sensors.subtitle')}</p>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-end">
                <span className="text-4xl font-light tracking-tighter text-[var(--ink-1)]">{d.sensors.length}</span>
                <span className="text-xs font-medium text-[var(--ink-3)] uppercase tracking-widest">{d.t('sensors.totalUnits')}</span>
              </div>
              <div className="w-px bg-[var(--line)] self-stretch mx-2" />
              <div className="flex flex-col items-end">
                <span className="text-4xl font-light tracking-tighter text-[var(--brand)]">{d.onlineSensors}</span>
                <span className="text-xs font-medium text-[var(--brand)] uppercase tracking-widest">{d.t('sensors.online')}</span>
              </div>
              {d.sensors.length - d.onlineSensors > 0 && (
                <>
                  <div className="w-px bg-[var(--line)] self-stretch mx-2" />
                  <div className="flex flex-col items-end">
                    <span className="text-4xl font-light tracking-tighter text-[var(--danger)]">{d.sensors.length - d.onlineSensors}</span>
                    <span className="text-xs font-medium text-[var(--danger)] uppercase tracking-widest">{d.t('sensors.offline')}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {d.sensors.map((sensor, i) => (
            <SensorCard key={sensor.uuid} sensor={sensor} i={i} d={d} onShowDetail={setDetailTarget} />
          ))}
        </div>

        <SensorDetailDialog
          isOpen={!!detailTarget}
          onClose={() => setDetailTarget(null)}
          sensor={detailTarget}
          d={d}
        />
      </div>
    </div>
  );
}

function SensorCard({ sensor, i, d, onShowDetail }: { sensor: RiyadhMapSensor; i: number; d: DashboardData; onShowDetail: (sensor: RiyadhMapSensor) => void }) {
  const isOffline = sensor.status === 'offline';
  const aqiBand = aqiBandFor(sensor.aqi || pm25ToAqi(sensor.pm25));

  return (
    <div
      className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${isOffline ? 'bg-[var(--bg-0)] border-[var(--line)] opacity-60' : 'bg-[var(--bg-0)] border-[var(--line)] hover:border-[var(--brand-30)] hover:shadow-lg'}`}
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
        <div 
          className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border animate-in fade-in duration-300"
          style={{
            backgroundColor: sensor.status === 'offline'
              ? 'rgba(239, 68, 68, 0.1)'
              : sensor.status === 'mission'
                ? 'rgba(245, 158, 11, 0.1)'
                : 'rgba(16, 185, 129, 0.1)',
            color: sensor.status === 'offline'
              ? 'var(--danger)'
              : sensor.status === 'mission'
                ? 'var(--warn)'
                : 'var(--ok)',
            borderColor: sensor.status === 'offline'
              ? 'rgba(239, 68, 68, 0.2)'
              : sensor.status === 'mission'
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(16, 185, 129, 0.2)',
          }}
        >
          {sensor.status === 'offline'
            ? d.t('sensors.offline')
            : sensor.status === 'mission'
              ? d.t('sensors.mission')
              : d.t('sensors.idle')}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] flex items-center gap-1"><Activity size={12} /> {d.t('sensors.currentAqi')}</span>
          <span className="text-lg font-bold tnum flex items-baseline gap-1 leading-none mt-1" style={{ color: isOffline ? 'var(--ink-3)' : aqiBand.color }}>
            {isOffline ? '--' : Math.round(sensor.aqi || pm25ToAqi(sensor.pm25))}
            {!isOffline && <span className="text-[10px] font-medium opacity-80 ml-1.5">· {aqiBand.label}</span>}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] flex items-center gap-1"><Battery size={12} /> {d.t('sensors.battery')}</span>
          <span className={`text-xl font-medium tnum flex items-baseline gap-1 ${!isOffline && sensor.battery < 20 ? 'text-[var(--danger)]' : 'text-[var(--ink-1)]'}`}>
            {isOffline ? '--' : Math.round(sensor.battery)}
            <span className="text-xs text-[var(--ink-3)]">%</span>
          </span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-[var(--line)] flex items-center justify-between">
        <button
          onClick={() => onShowDetail(sensor)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-1)] hover:bg-[var(--bg-2)] text-[var(--ink-2)] text-xs font-semibold transition-colors border border-[var(--line)]"
        >
          <Activity size={14} /> {d.t('sensors.seeDetails')}
        </button>
        <button
          onClick={() => {
            d.handlePickSensor(sensor);
            d.setCurrentTab('livemap');
          }}
          style={{
            backgroundColor: 'var(--ok)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '700',
            boxShadow: '0 4px 12px oklch(from var(--ok) l c h / 0.25)',
            transition: 'all 0.2s'
          }}
          className="hover:opacity-90"
        >
          {d.t('btn.onMap')}
        </button>
      </div>
    </div>
  );
}
function SensorDetailDialog({ isOpen, onClose, sensor, d }: { isOpen: boolean; onClose: () => void; sensor: RiyadhMapSensor | null; d: DashboardData }) {
  const { data: omData } = useOpenMeteoAirQuality(sensor?.lat || 0, sensor?.lng || 0);
  if (!isOpen || !sensor) return null;

  const aqiValue = (sensor.aqi || pm25ToAqi(sensor.pm25)) || 0;
  const aqiBand = aqiBandFor(aqiValue);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[var(--bg-0)] rounded-[2.5rem] shadow-2xl border border-[var(--line)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 ease-out">
        <div className="p-8 pb-4 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${sensor.status === 'offline' ? 'bg-[var(--bg-2)] text-[var(--ink-3)]' : 'bg-[var(--brand-10)] text-[var(--brand)]'}`}>
              <Cpu size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--ink-1)] leading-tight">{sensor.label || `Sensor ${sensor.uuid.slice(0, 8)}`}</h2>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs font-mono text-[var(--ink-3)]">{sensor.lat.toFixed(4)}, {sensor.lng.toFixed(4)}</span>
                <span 
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                  style={{
                    backgroundColor: sensor.status === 'offline'
                      ? 'rgba(239, 68, 68, 0.1)'
                      : sensor.status === 'mission'
                        ? 'rgba(245, 158, 11, 0.1)'
                        : 'rgba(16, 185, 129, 0.1)',
                    color: sensor.status === 'offline'
                      ? 'var(--danger)'
                      : sensor.status === 'mission'
                        ? 'var(--warn)'
                        : 'var(--ok)',
                    borderColor: sensor.status === 'offline'
                      ? 'rgba(239, 68, 68, 0.2)'
                      : sensor.status === 'mission'
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(16, 185, 129, 0.2)',
                  }}
                >
                  {sensor.status === 'offline'
                    ? d.t('sensors.offline')
                    : sensor.status === 'mission'
                      ? d.t('sensors.mission')
                      : d.t('sensors.idle')}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-2)] text-[var(--ink-3)] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 pt-4 space-y-8">
          {/* Main Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-3xl bg-[var(--bg-1)] border border-[var(--line)]">
              <div className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-widest mb-1">AQI Index</div>
              <div className="text-2xl font-bold" style={{ color: aqiBand.color }}>{Math.round(sensor.aqi || 0)}</div>
              <div className="text-[10px] font-medium opacity-60">{aqiBand.label}</div>
            </div>
            <div className="p-4 rounded-3xl bg-[var(--bg-1)] border border-[var(--line)]">
              <div className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-widest mb-1">PM2.5</div>
              <div className="text-2xl font-bold text-[var(--ink-1)]">{sensor.pm25.toFixed(1)}</div>
              <div className="text-[10px] font-medium text-[var(--ink-3)]">µg/m³</div>
            </div>
            <div className="p-4 rounded-3xl bg-[var(--bg-1)] border border-[var(--line)]">
              <div className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-widest mb-1">Battery</div>
              <div className="text-2xl font-bold text-[var(--ink-1)]">{Math.round(sensor.battery)}%</div>
              <div className="flex items-center gap-1">
                <Battery size={10} className={sensor.battery < 20 ? 'text-[var(--danger)]' : 'text-[var(--ok)]'} />
                <span className="text-[10px] font-medium text-[var(--ink-3)]">{sensor.battery > 20 ? 'Healthy' : 'Critical'}</span>
              </div>
            </div>
            <div className="p-4 rounded-3xl bg-[var(--bg-1)] border border-[var(--line)]">
              <div className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-widest mb-1">Last Sync</div>
              <div className="text-sm font-bold text-[var(--ink-1)] mt-2">Active</div>
              <div className="text-[10px] font-medium text-[var(--ink-3)]">Real-time telemetry</div>
            </div>
          </div>

          {/* Atmospheric Data */}
          <div>
            <h3 className="text-sm font-bold text-[var(--ink-1)] mb-4 flex items-center gap-2">
              <Wind size={16} className="text-[var(--brand)]" />
              Environmental Telemetry
            </h3>
            {omData?.current ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'PM10', value: omData.current.pm10, unit: 'µg/m³' },
                  { label: 'Ozone (O3)', value: omData.current.ozone, unit: 'µg/m³' },
                  { label: 'SO2', value: omData.current.sulphur_dioxide, unit: 'µg/m³' },
                  { label: 'Nitrogen Dioxide', value: omData.current.nitrogen_dioxide, unit: 'µg/m³' },
                  { label: 'Dust', value: omData.current.dust, unit: 'µg/m³' },
                  { label: 'UV Index', value: omData.current.uv_index, unit: '' },
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-2xl border border-[var(--line)] flex flex-col justify-between h-20">
                    <span className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-wider">{item.label}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-[var(--ink-1)]">{item.value}</span>
                      <span className="text-[10px] text-[var(--ink-3)]">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center rounded-2xl bg-[var(--bg-1)] border border-dashed border-[var(--line)]">
                <div className="flex flex-col items-center gap-2 text-[var(--ink-3)]">
                  <Activity size={24} className="animate-pulse" />
                  <span className="text-xs font-medium">Fetching satellite metrics...</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex gap-3 pt-4 border-t border-[var(--line)]">
            <button
              onClick={() => {
                d.handlePickSensor(sensor);
                d.setCurrentTab('livemap');
                onClose();
              }}
              style={{
                backgroundColor: 'var(--ok)',
                color: 'white',
                padding: '16px',
                borderRadius: '16px',
                fontSize: '14px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                flex: 1,
                boxShadow: '0 8px 20px oklch(from var(--ok) l c h / 0.25)',
                transition: 'all 0.2s'
              }}
              className="hover:opacity-90 active:scale-[0.98]"
            >
              <MapPin size={18} /> Locate on Grid
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
