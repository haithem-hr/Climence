/**
 * WeatherPanel — current meteorology summary and wind drift cue.
 *
 * Isolated from Dashboard.tsx so responsive and RTL work can target one panel.
 */
import { MapPin } from 'lucide-react';
import type { DashboardData } from '../../hooks/useDashboardData';

export function WeatherPanel({
  data,
}: {
  data: Pick<DashboardData, 't' | 'tempNow' | 'humidityNow' | 'drift'>;
}) {
  return (
    <div className="side-group">
      <div className="side-head">
        <div>
          <div className="eyebrow">{data.t('panel.weather.eyebrow')}</div>
          <div className="side-title">{data.t('panel.weather')}</div>
        </div>
        <span className="mono tnum" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
          Riyadh · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
      </div>
      <div className="weather-row">
        <div className="weather-cell"><div className="l">{data.t('weather.temp')}</div><div className="v tnum">{data.tempNow}<span className="u"> C</span></div></div>
        <div className="weather-cell"><div className="l">{data.t('weather.humidity')}</div><div className="v tnum">{data.humidityNow}<span className="u"> %</span></div></div>
        <div className="weather-cell"><div className="l">{data.t('weather.pressure')}</div><div className="v tnum">1013<span className="u"> hPa</span></div></div>
      </div>
      <div className="wind-compass">
        <div className="compass"><div className="compass-arrow" style={{ transform: `rotate(${data.drift.headingDeg}deg)`, transition: 'transform 0.6s ease' }}><MapPin size={20} /></div></div>
        <div className="wind-meta"><div className="hd">{data.t('weather.windHeader')}</div><div className="dir">{data.drift.speedKmh} <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>km/h · {data.drift.cardinal}</span></div><div className="sub">{data.drift.description}</div></div>
      </div>
    </div>
  );
}
