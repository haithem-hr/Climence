import { useState, type FormEvent } from 'react';
import type { AlertEvent, AlertPollutantType } from '@climence/shared';
import type { DashboardData } from '../../hooks/useDashboardData';
import { AlertTriangle, Activity, ArrowUpRight, Settings, Siren, Zap, Trash2 } from 'lucide-react';
import { getMapMetricValue } from '../../lib/mapMetrics';

const POLLUTANT_OPTIONS: Array<{ key: AlertPollutantType; label: string; unit: string }> = [
  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³' },
  { key: 'pm10', label: 'PM10', unit: 'µg/m³' },
  { key: 'no2', label: 'NO2', unit: 'µg/m³' },
  { key: 'o3', label: 'O3', unit: 'µg/m³' },
  { key: 'so2', label: 'SO2', unit: 'µg/m³' },
  { key: 'co', label: 'CO', unit: 'mg/m³' },
];

function formatDate(value?: string | null) {
  if (!value) return '--';
  return new Date(value).toLocaleString();
}

function pollutantLabel(key?: string) {
  return POLLUTANT_OPTIONS.find(option => option.key === key)?.label ?? key?.toUpperCase() ?? '--';
}

type AlertFocusFields = Partial<{
  sensorId: string;
  sensor_id: string;
  uuid: string;
  lat: number;
  lng: number;
  latitude: number;
  longitude: number;
}>;

function finiteCoord(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function alertFocusRequest(event: AlertEvent) {
  const focusFields = event as AlertEvent & AlertFocusFields;
  const lat = finiteCoord(focusFields.lat) ?? finiteCoord(focusFields.latitude);
  const lng = finiteCoord(focusFields.lng) ?? finiteCoord(focusFields.longitude);

  return {
    focusSensorId: focusFields.sensorId ?? focusFields.sensor_id ?? focusFields.uuid,
    focusCoords: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
    focusPollutant: event.pollutant_type,
  };
}

type AlertSensor = DashboardData['sensors'][number];

function crossesAlertRule(value: number, event: AlertEvent) {
  const threshold = event.threshold_value;
  const operator = event.condition_operator ?? '>';
  if (typeof threshold !== 'number' || !Number.isFinite(threshold)) return false;

  if (operator === '>') return value > threshold;
  if (operator === '>=') return value >= threshold;
  if (operator === '<') return value < threshold;
  return value <= threshold;
}

function sensorForAlert(event: AlertEvent, sensors: AlertSensor[]) {
  const pollutantType = event.pollutant_type;
  if (!pollutantType || sensors.length === 0) return null;
  const targetValue = Number.isFinite(event.peak_value) ? event.peak_value : event.threshold_value;
  if (typeof targetValue !== 'number' || !Number.isFinite(targetValue)) return null;

  return [...sensors]
    .sort((left, right) => {
      const leftValue = getMapMetricValue(pollutantType, left);
      const rightValue = getMapMetricValue(pollutantType, right);
      const leftCrosses = crossesAlertRule(leftValue, event) ? 0 : 1;
      const rightCrosses = crossesAlertRule(rightValue, event) ? 0 : 1;
      if (leftCrosses !== rightCrosses) return leftCrosses - rightCrosses;

      const leftDelta = Math.abs(leftValue - targetValue);
      const rightDelta = Math.abs(rightValue - targetValue);
      if (leftDelta !== rightDelta) return leftDelta - rightDelta;

      const leftOffline = left.status === 'offline' ? 1 : 0;
      const rightOffline = right.status === 'offline' ? 1 : 0;
      return leftOffline - rightOffline;
    })[0] ?? null;
}

export function AlertsView({ data: d }: { data: DashboardData }) {
  const [pollutantType, setPollutantType] = useState<AlertPollutantType>('pm25');
  const [thresholdValue, setThresholdValue] = useState('140');
  const [conditionOperator, setConditionOperator] = useState<'>' | '>=' | '<' | '<='>('>');

  const activeRules = d.alertRules.filter(rule => rule.is_active);
  const inactiveRules = d.alertRules.filter(rule => !rule.is_active);

  function submitRule(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(thresholdValue);
    if (!Number.isFinite(parsed)) {
      d.setAlertRuleState('error');
      return;
    }

    d.handleCreateAlertRule({
      pollutant_type: pollutantType,
      threshold_value: parsed,
      condition_operator: conditionOperator,
      notification_channel: 'system',
      is_active: true,
    });
  }

  function openAlertOnMap(event: AlertEvent) {
    const request = alertFocusRequest(event);
    const sensor = request.focusSensorId
      ? d.sensors.find(item => item.uuid === request.focusSensorId || item.id === request.focusSensorId)
      : sensorForAlert(event, d.sensors);

    d.requestLiveMapFocus({
      ...request,
      focusSensorId: request.focusSensorId ?? sensor?.uuid,
      focusCoords: request.focusCoords ?? (sensor ? { lat: sensor.lat, lng: sensor.lng } : undefined),
    });
    d.setCurrentTab('livemap');
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-[var(--bg-0)] animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="flex flex-col gap-8 max-w-[1400px]">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--bg-1)] to-[var(--bg-0)] border border-[var(--line)] p-8 shadow-sm">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--brand)] opacity-[0.03] blur-3xl rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--danger)] opacity-[0.02] blur-3xl rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--brand-10)] text-[var(--brand)] text-xs font-semibold tracking-wide uppercase mb-4">
                <Zap size={14} /> {d.t('alerts.liveMonitor')}
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2 text-[var(--ink-1)]">{d.t('alerts.title')}</h1>
              <p className="text-[var(--ink-2)] text-base max-w-xl">Per-pollutant alert rules with active and cleared event tracking.</p>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-end">
                <span className="text-4xl font-light tracking-tighter text-[var(--ink-1)]">{d.activeAlertEvents.length}</span>
                <span className="text-xs font-medium text-[var(--ink-3)] uppercase tracking-widest">{d.t('alerts.activeIncidents')}</span>
              </div>
              <div className="w-px bg-[var(--line)] self-stretch" />
              <div className="flex flex-col items-end">
                <span className="text-4xl font-light tracking-tighter text-[var(--ink-1)]">{activeRules.length}</span>
                <span className="text-xs font-medium text-[var(--danger)] uppercase tracking-widest">Active Rules</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-[var(--danger-10)] flex items-center justify-center text-[var(--danger)] shadow-[0_0_15px_var(--danger-20)]">
                  <Siren size={14} className="animate-pulse" />
                </div>
                <h2 className="font-semibold text-lg">Active Alert Events</h2>
              </div>

              <ul className="flex flex-col gap-3">
                {d.activeAlertEvents.length === 0 ? (
                  <li className="px-6 py-12 text-center border border-dashed border-[var(--line)] rounded-2xl bg-[var(--bg-1)]/50">
                    <div className="w-12 h-12 mx-auto rounded-full bg-[var(--ok-10)] text-[var(--ok)] flex items-center justify-center mb-4">
                      <Activity size={20} />
                    </div>
                    <h3 className="text-[var(--ink-1)] font-medium mb-1">{d.t('alerts.networkOptimal')}</h3>
                    <p className="text-[var(--ink-3)] text-sm">No alert rules are currently triggered.</p>
                  </li>
                ) : (
                  d.activeAlertEvents.map(event => (
                    <li key={event.event_id} className="group p-5 rounded-2xl bg-[var(--bg-0)] border border-[var(--danger-20)] shadow-sm cursor-pointer transition-shadow hover:shadow-md">
                      <button
                        type="button"
                        onClick={() => openAlertOnMap(event)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--danger)] text-white">Active</span>
                              <span className="text-xs text-[var(--ink-3)] font-mono">{formatDate(event.triggered_at)}</span>
                            </div>
                            <div className="font-semibold text-base text-[var(--ink-1)]">
                              {pollutantLabel(event.pollutant_type)} {event.condition_operator ?? '>'} {event.threshold_value ?? '--'}
                            </div>
                            <div className="text-sm text-[var(--ink-2)] mt-1">
                              Peak value {Math.round(event.peak_value * 10) / 10} · Rule #{event.rule_id}{event.drone_id ? ` · ${event.drone_id}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <ArrowUpRight className="text-[var(--ink-3)] opacity-0 transition-opacity group-hover:opacity-100" size={16} />
                            <AlertTriangle className="text-[var(--danger)]" size={22} />
                          </div>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 px-2">
                <h2 className="font-semibold text-lg">Recently Cleared</h2>
                {d.clearedAlertEvents.length > 0 && d.canManageAlertSettings && (
                  <button
                    className="text-xs text-[var(--ink-3)] hover:text-[var(--danger)] transition-colors"
                    onClick={() => d.handleClearAlertEvents()}
                  >
                    Clear All
                  </button>
                )}
              </div>
              <ul className="flex flex-col gap-3">
                {d.clearedAlertEvents.length === 0 ? (
                  <li className="p-5 rounded-2xl bg-[var(--bg-1)] border border-[var(--line)] text-sm text-[var(--ink-3)]">
                    No recently cleared alert events.
                  </li>
                ) : (
                  d.clearedAlertEvents.map(event => (
                    <li key={event.event_id} className="group p-5 rounded-2xl bg-[var(--bg-0)] border border-[var(--line)] cursor-pointer transition-shadow hover:shadow-md">
                      <button
                        type="button"
                        onClick={() => openAlertOnMap(event)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-semibold text-[var(--ink-1)]">
                              {pollutantLabel(event.pollutant_type)} back to normal
                            </div>
                            <div className="text-sm text-[var(--ink-3)]">
                              Cleared {formatDate(event.cleared_at)} · peak {Math.round(event.peak_value * 10) / 10}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <ArrowUpRight className="text-[var(--ink-3)] opacity-0 transition-opacity group-hover:opacity-100" size={16} />
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--ok-10)] text-[var(--ok)]">Cleared</span>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl bg-[var(--bg-0)] border border-[var(--line)] p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-10)] flex items-center justify-center text-[var(--brand)] mb-5">
                <Settings size={20} />
              </div>
              <h3 className="font-semibold text-lg mb-1">Create Alert Rule</h3>
              <p className="text-sm text-[var(--ink-3)] mb-6 leading-relaxed">Rules evaluate current readings and the 1-hour rolling average.</p>

              {d.canManageAlertSettings ? (
                <form className="flex flex-col gap-4" onSubmit={submitRule}>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-[11px] font-bold text-[var(--ink-2)] uppercase tracking-widest">Pollutant</span>
                    <select
                      value={pollutantType}
                      onChange={event => setPollutantType(event.target.value as AlertPollutantType)}
                      className="bg-[var(--bg-1)] border border-[var(--line)] rounded-xl px-4 py-3 outline-none"
                    >
                      {POLLUTANT_OPTIONS.map(option => (
                        <option key={option.key} value={option.key}>{option.label} ({option.unit})</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-[11px] font-bold text-[var(--ink-2)] uppercase tracking-widest">Operator</span>
                    <select
                      value={conditionOperator}
                      onChange={event => setConditionOperator(event.target.value as '>' | '>=' | '<' | '<=')}
                      className="bg-[var(--bg-1)] border border-[var(--line)] rounded-xl px-4 py-3 outline-none"
                    >
                      <option value=">">&gt;</option>
                      <option value=">=">&gt;=</option>
                      <option value="<">&lt;</option>
                      <option value="<=">&lt;=</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-[11px] font-bold text-[var(--ink-2)] uppercase tracking-widest">Threshold</span>
                    <input
                      type="number"
                      step={0.1}
                      value={thresholdValue}
                      onChange={event => setThresholdValue(event.target.value)}
                      className="bg-[var(--bg-1)] border border-[var(--line)] rounded-xl px-4 py-3 outline-none"
                    />
                  </label>

                  <button className="cc-primary-btn w-full disabled:opacity-50" disabled={d.alertRuleState === 'saving'}>
                    {d.alertRuleState === 'saving' ? 'Saving...' : 'Create Rule'}
                  </button>
                </form>
              ) : (
                <div className="p-4 rounded-xl bg-[var(--bg-1)] border border-[var(--line)] text-sm text-[var(--ink-2)]">
                  {d.t('alerts.readOnly')}
                </div>
              )}

              {d.alertRuleState === 'saved' && (
                <div className="mt-4 text-sm text-[var(--ok)] bg-[var(--ok-10)] px-4 py-3 rounded-lg border border-[var(--ok-20)]">
                  Alert rule saved.
                </div>
              )}
              {d.alertRuleState === 'error' && (
                <div className="mt-4 text-sm text-[var(--danger)] bg-[var(--danger-10)] px-4 py-3 rounded-lg border border-[var(--danger-20)]">
                  Unable to save alert rule.
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-[var(--bg-0)] border border-[var(--line)] p-6 shadow-sm">
              <h3 className="font-semibold text-lg mb-4">Active Rules</h3>
              <div className="flex flex-col gap-3">
                {activeRules.length === 0 ? (
                  <div className="text-sm text-[var(--ink-3)]">No active alert rules.</div>
                ) : activeRules.map(rule => (
                  <div key={rule.rule_id} className="p-4 rounded-xl bg-[var(--bg-1)] border border-[var(--line)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[var(--ink-1)]">
                          {pollutantLabel(rule.pollutant_type)} {rule.condition_operator} {rule.threshold_value}
                        </div>
                        <div className="text-xs text-[var(--ink-3)]">Channel {rule.notification_channel} · Rule #{rule.rule_id}</div>
                      </div>
                      {d.canManageAlertSettings && (
                        <button
                          className="text-[var(--danger)] hover:opacity-80"
                          title="Delete rule"
                          onClick={() => d.handleDeleteAlertRule(rule.rule_id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {inactiveRules.length > 0 && (
                <div className="mt-6 pt-5 border-t border-[var(--line)]">
                  <h4 className="text-sm font-semibold text-[var(--ink-2)] mb-3">Inactive Rules</h4>
                  <div className="flex flex-col gap-2">
                    {inactiveRules.map(rule => (
                      <div key={rule.rule_id} className="text-sm text-[var(--ink-3)]">
                        {pollutantLabel(rule.pollutant_type)} {rule.condition_operator} {rule.threshold_value}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
