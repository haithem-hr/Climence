/**
 * HotspotsPanel — ranked hotspot list for the overview side rail.
 *
 * Keys include rank so a changed order visibly re-animates rows.
 */
import { MapPin } from 'lucide-react';
import type { DashboardData } from '../../hooks/useDashboardData';

export function HotspotsPanel({
  data,
}: {
  data: Pick<DashboardData, 't' | 'hotspots' | 'selectedHotspot' | 'handlePickHotspot'>;
}) {
  return (
    <div className="side-group">
      <div className="side-head">
        <div>
          <div className="eyebrow">{data.t('panel.hotspots.eyebrow')}</div>
          <div className="side-title">{data.t('panel.hotspots')} <span className="cnt">{String(data.hotspots.length).padStart(2, '0')}</span></div>
        </div>
        <button className="btn" style={{ padding: '5px 10px', fontSize: 11 }}>
          <MapPin size={11} /> {data.t('btn.onMap')}
        </button>
      </div>
      {data.hotspots.length === 0 ? (
        <div className="empty-note">{data.t('panel.hotspots.empty')}</div>
      ) : (
        <ul>
          {data.hotspots.map((hotspot, index) => (
            <li
              key={`${hotspot.id}-${index}`}
              className={`hotspot ${data.selectedHotspot?.id === hotspot.id ? 'selected' : ''}`}
              onClick={() => data.handlePickHotspot(hotspot)}
            >
              <div className="hotspot-rank">#{String(index + 1).padStart(2, '0')}</div>
              <div>
                <div className="hotspot-name">{hotspot.name}</div>
                <div className="hotspot-coord">{hotspot.coord} · dom. {hotspot.pollutant}</div>
              </div>
              <div className={`hotspot-val ${hotspot.band}`}>
                <div className="n tnum">{hotspot.metricDisplayValue}</div>
                <div className="u">{hotspot.metricLabel} · {hotspot.trend > 0 ? '+' : ''}{hotspot.trend}%</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
