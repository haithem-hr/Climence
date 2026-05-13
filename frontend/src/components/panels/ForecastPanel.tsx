/**
 * ForecastPanel — short-horizon AQI forecast cells for the overview side rail.
 *
 * Keeps the forecast strip decoupled from the broader dashboard render tree.
 */
import { Sparkles } from 'lucide-react';
import type { DashboardData } from '../../hooks/useDashboardData';

export function ForecastPanel({
  data,
}: {
  data: Pick<DashboardData, 't' | 'forecast'>;
}) {
  return (
    <div className="side-group">
      <div className="side-head">
        <div>
          <div className="eyebrow">{data.t('panel.forecast.eyebrow')}</div>
          <div className="side-title">{data.t('panel.forecast')}</div>
        </div>
        <span className="band" title="Linear trend + mean reversion"><Sparkles size={10} /> trend v1</span>
      </div>
      {data.forecast.length === 0 ? (
        <div className="empty-note">{data.t('panel.forecast.waiting')}</div>
      ) : (
        <div className="forecast">{data.forecast.map(point => (<div key={point.hr} className="f-cell"><div className="f-hr">{point.hr}</div><div className="f-val tnum">{point.val}</div><div className="f-dot" style={{ background: `var(--aqi-${point.band})` }} /></div>))}</div>
      )}
    </div>
  );
}
