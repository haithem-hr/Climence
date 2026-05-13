/**
 * FeedPanel — latest incident and telemetry feed for the overview side rail.
 *
 * Extracted to keep alert rendering, empty states, and animations localized.
 */
import { Activity, AlertTriangle, Bell } from 'lucide-react';
import type { DashboardData } from '../../hooks/useDashboardData';

export function FeedPanel({
  data,
}: {
  data: Pick<DashboardData, 't' | 'feed'>;
}) {
  return (
    <div className="side-group">
      <div className="side-head"><div><div className="eyebrow">{data.t('panel.feed.eyebrow')}</div><div className="side-title">{data.t('panel.feed')}</div></div><button className="btn" style={{ padding: '5px 10px', fontSize: 11 }}>{data.t('btn.all')}</button></div>
      {data.feed.length === 0 ? (
        <div className="empty-note">{data.t('panel.feed.empty')}</div>
      ) : (
        <ul>
          {data.feed.map((item, index) => (
            <li key={`${item.id}-${index}`} className="alert">
              <div className={`alert-icon ${item.severity}`}>
                {item.severity === 'crit' || item.severity === 'warn' ? <AlertTriangle size={12} /> : item.severity === 'ok' ? <Activity size={12} /> : <Bell size={12} />}
              </div>
              <div className="alert-body"><div className="t"><b>{item.title}</b></div><div className="m">{item.meta}</div></div>
              <div className="alert-time">{item.time}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
