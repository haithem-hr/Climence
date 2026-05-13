/**
 * SourcesPanel — live source-attribution bars and legend.
 *
 * Extracted so attribution copy and empty states can evolve independently.
 */
import type { DashboardData } from '../../hooks/useDashboardData';

export function SourcesPanel({
  data,
}: {
  data: Pick<DashboardData, 't' | 'sources'>;
}) {
  return (
    <div className="side-group">
      <div className="side-head"><div><div className="eyebrow">{data.t('panel.sources.eyebrow')}</div><div className="side-title">{data.t('panel.sources')}</div></div></div>
      {data.sources.length === 0 ? (
        <div className="empty-note">{data.t('panel.sources.empty')}</div>
      ) : (
        <>
          <div className="src-bar">{data.sources.map(source => (<div key={source.key} style={{ flex: source.pct, background: source.color }}>{source.pct}%</div>))}</div>
          <div className="src-legend">{data.sources.map(source => (<div key={source.key} className="src-row"><span className="sw" style={{ background: source.color }} /><span>{source.name}</span><span className="pct tnum">{source.pct}%</span></div>))}</div>
        </>
      )}
    </div>
  );
}
