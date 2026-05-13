/**
 * AlertSettingsPanel — compact threshold controls for the overview side rail.
 *
 * Reuses the existing alert-threshold contract from the dashboard data hook.
 */
import type { ChangeEvent } from 'react';
import type { DashboardData } from '../../hooks/useDashboardData';

export function AlertSettingsPanel({
  data,
}: {
  data: Pick<
    DashboardData,
    | 't'
    | 'canManageAlertSettings'
    | 'alertThresholdDraft'
    | 'setAlertThresholdDraft'
    | 'alertConfigState'
    | 'setAlertConfigState'
    | 'effectiveAlertThreshold'
    | 'handleSaveAlertThreshold'
  >;
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    data.setAlertThresholdDraft(event.target.value);
    data.setAlertConfigState('idle');
  };

  return (
    <div className="side-group">
      <div className="side-head">
        <div>
          <div className="eyebrow">{data.t('panel.alertSettings')}</div>
          <div className="side-title">{data.t('alerts.globalThreshold')}</div>
        </div>
        <span className="mono tnum" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
          {data.effectiveAlertThreshold} µg/m³
        </span>
      </div>

      <div className="side-note">{data.t('alerts.thresholdHelp')}</div>

      {data.canManageAlertSettings ? (
        <>
          <label className="field-label" htmlFor="overview-pm25-threshold">
            {data.t('alerts.triggerLevel')}
          </label>
          <div className="field-row">
            <input
              id="overview-pm25-threshold"
              type="number"
              min={1}
              max={500}
              step={0.1}
              value={data.alertThresholdDraft}
              onChange={handleChange}
              className="field-input"
            />
            <span className="field-unit">µg/m³</span>
          </div>
          <button
            className="btn primary"
            disabled={data.alertConfigState === 'saving' || data.alertThresholdDraft === String(data.effectiveAlertThreshold)}
            onClick={data.handleSaveAlertThreshold}
          >
            {data.alertConfigState === 'saving' ? data.t('alerts.applying') : data.t('alerts.apply')}
          </button>
          {data.alertConfigState === 'saved' && <div className="status-note status-note--ok">{data.t('alerts.saved')}</div>}
          {data.alertConfigState === 'error' && <div className="status-note status-note--error">{data.t('alerts.error')}</div>}
        </>
      ) : (
        <div className="empty-note">{data.t('alerts.readOnly')}</div>
      )}
    </div>
  );
}
