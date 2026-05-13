/**
 * EventBanner — overview side-rail threshold advisory banner.
 *
 * Keeps the threshold warning copy and CTA isolated from Dashboard.tsx.
 */
import { AlertTriangle } from 'lucide-react';
import type { DashboardData } from '../../hooks/useDashboardData';

export function EventBanner({ data }: { data: Pick<DashboardData, 't' | 'thresholdExceededBy'> }) {
  const isOverThreshold = data.thresholdExceededBy > 0;

  return (
    <div className="banner" role="status" aria-live="polite">
      <div className="banner-icon"><AlertTriangle size={14} /></div>
      <div className="banner-body">
        <div className="banner-title">
          {isOverThreshold ? data.t('banner.over') : data.t('banner.under')}
          {isOverThreshold ? ` · +${data.thresholdExceededBy} µg/m³` : ''}
        </div>
        <div className="banner-sub">{isOverThreshold ? data.t('banner.sub.over') : data.t('banner.sub.under')}</div>
      </div>
      <button className="banner-cta">{data.t('banner.dispatch')}</button>
    </div>
  );
}
