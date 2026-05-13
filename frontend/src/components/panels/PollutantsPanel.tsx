/**
 * PollutantsPanel — pollutant cards for overview-side quick switching.
 *
 * Keeps the metric picker separate from the dashboard composition shell.
 */
import { Filter } from 'lucide-react';
import type { DashboardData } from '../../hooks/useDashboardData';

export function PollutantsPanel({
  data,
}: {
  data: Pick<DashboardData, 't' | 'pollutantStats' | 'pollutant' | 'setPollutant'>;
}) {
  return (
    <div className="side-group">
      <div className="side-head">
        <div>
          <div className="eyebrow">{data.t('panel.pollutants.eyebrow')}</div>
          <div className="side-title">{data.t('panel.pollutants')}</div>
        </div>
        <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }}>
          <Filter size={11} /> {data.t('btn.all')}
        </button>
      </div>
      <div className="pollutant-grid">
        {data.pollutantStats.map(stat => {
          const pctColor = stat.pct > 70 ? 'var(--aqi-unh)' : stat.pct > 50 ? 'var(--aqi-usg)' : stat.pct > 30 ? 'var(--aqi-mod)' : 'var(--aqi-good)';
          return (
            <button key={stat.key} className={`pcard ${data.pollutant === stat.key ? 'active' : ''}`} onClick={() => data.setPollutant(stat.key)}>
              <div className="pcard-head"><div className="pcard-name">{stat.name} <span className="sub">{stat.unit}</span></div><span className={`pcard-delta ${stat.delta >= 0 ? 'up' : 'down'}`}>{stat.delta >= 0 ? '+' : ''}{stat.delta}</span></div>
              <div className="pcard-val tnum">{stat.value.toFixed(stat.value < 10 ? 1 : 0)}<span className="pcard-unit">{stat.unit}</span></div>
              <div className="pcard-bar"><div className="fill" style={{ width: `${stat.pct}%`, background: pctColor }} /></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
