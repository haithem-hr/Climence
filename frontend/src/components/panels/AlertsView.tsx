import type { DashboardData } from '../../hooks/useDashboardData';
import { AlertTriangle, Bell, Activity, Settings, Siren, Wind, Zap } from 'lucide-react';

export function AlertsView({ data: d }: { data: DashboardData }) {
  return (
    <div className="p-6 h-full overflow-y-auto bg-[var(--bg-0)] animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="flex flex-col gap-8 max-w-[1400px]">

        {/* Page Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--bg-1)] to-[var(--bg-0)] border border-[var(--line)] p-8 shadow-sm">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--brand)] opacity-[0.03] blur-3xl rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--danger)] opacity-[0.02] blur-3xl rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--brand-10)] text-[var(--brand)] text-xs font-semibold tracking-wide uppercase mb-4">
                <Zap size={14} /> {d.t('alerts.liveMonitor')}
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2 text-[var(--ink-1)]">{d.t('alerts.title')}</h1>
              <p className="text-[var(--ink-2)] text-base max-w-xl">{d.t('alerts.subtitle')}</p>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-end">
                <span className="text-4xl font-light tracking-tighter text-[var(--ink-1)]">{d.feed.length}</span>
                <span className="text-xs font-medium text-[var(--ink-3)] uppercase tracking-widest">{d.t('alerts.activeIncidents')}</span>
              </div>
              <div className="w-px bg-[var(--line)] self-stretch" />
              <div className="flex flex-col items-end">
                <span className="text-4xl font-light tracking-tighter text-[var(--ink-1)]">{d.feed.filter(a => a.severity === 'crit').length}</span>
                <span className="text-xs font-medium text-[var(--danger)] uppercase tracking-widest">{d.t('alerts.critical')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">

          {/* Live Feed Card */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-[var(--danger-10)] flex items-center justify-center text-[var(--danger)] shadow-[0_0_15px_var(--danger-20)]">
                <Siren size={14} className="animate-pulse" />
              </div>
              <h2 className="font-semibold text-lg">{d.t('alerts.active')}</h2>
            </div>

            <ul className="flex flex-col gap-3">
              {d.feed.length === 0 ? (
                <li className="px-6 py-16 text-center border border-dashed border-[var(--line)] rounded-2xl bg-[var(--bg-1)]/50">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[var(--ok-10)] text-[var(--ok)] flex items-center justify-center mb-4">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-[var(--ink-1)] font-medium mb-1">{d.t('alerts.networkOptimal')}</h3>
                  <p className="text-[var(--ink-3)] text-sm">{d.t('alerts.none')}</p>
                </li>
              ) : (
                d.feed.map((item, i) => (
                  <li
                    key={item.id}
                    className="group relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 p-5 rounded-2xl bg-[var(--bg-0)] border border-[var(--line)] hover:border-[var(--brand-30)] hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${item.severity === 'crit' ? 'bg-[var(--danger-10)] text-[var(--danger)] border border-[var(--danger-20)]' :
                        item.severity === 'warn' ? 'bg-[var(--warn-10)] text-[var(--warn)] border border-[var(--warn-20)]' :
                          item.severity === 'ok' ? 'bg-[var(--ok-10)] text-[var(--ok)] border border-[var(--ok-20)]' :
                            'bg-[var(--ink-10)] text-[var(--ink-2)] border border-[var(--line)]'
                      }`}>
                      {item.severity === 'crit' ? <AlertTriangle size={20} /> : item.severity === 'warn' ? <AlertTriangle size={20} /> : item.severity === 'ok' ? <Activity size={20} /> : <Bell size={20} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${item.severity === 'crit' ? 'bg-[var(--danger)] text-white' :
                            item.severity === 'warn' ? 'bg-[var(--warn)] text-white' :
                              'bg-[var(--line)] text-[var(--ink-2)]'
                          }`}>
                          {item.severity === 'crit' ? d.t('alerts.critical') : item.severity === 'warn' ? d.t('alerts.warning') : d.t('alerts.info')}
                        </span>
                        <span className="text-xs text-[var(--ink-3)] font-mono">{item.time}</span>
                      </div>
                      <div className="font-semibold text-base text-[var(--ink-1)] truncate group-hover:text-[var(--brand)] transition-colors">{item.title}</div>
                      <div className="text-sm text-[var(--ink-2)] mt-1 truncate flex items-center gap-2">
                        <Wind size={14} className="opacity-50" /> {item.meta}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Settings Sidebar */}
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl bg-[var(--bg-0)] border border-[var(--line)] p-6 shadow-sm sticky top-6">
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-10)] flex items-center justify-center text-[var(--brand)] mb-5">
                <Settings size={20} />
              </div>

              <h3 className="font-semibold text-lg mb-1">{d.t('alerts.globalThreshold')}</h3>
              <p className="text-sm text-[var(--ink-3)] mb-6 leading-relaxed">{d.t('alerts.thresholdHelp')}</p>

              {d.canManageAlertSettings ? (
                <div className="flex flex-col gap-5">
                  <div className="relative">
                    <label htmlFor="pm25-threshold-input" className="block text-[11px] font-bold text-[var(--ink-2)] mb-2 uppercase tracking-widest">
                      {d.t('alerts.triggerLevel')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="pm25-threshold-input"
                        type="number"
                        min={1}
                        max={500}
                        step={0.1}
                        value={d.alertThresholdDraft}
                        onChange={e => { d.setAlertThresholdDraft(e.target.value); d.setAlertConfigState('idle'); }}
                        className="w-full text-xl font-medium bg-[var(--bg-1)] border border-[var(--line)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-10)] rounded-xl px-4 py-3 outline-none transition-all"
                      />
                      <span className="text-sm font-medium text-[var(--ink-3)] px-2">µg/m³</span>
                    </div>
                  </div>

                  <button
                    className="cc-primary-btn w-full hover:opacity-80 transition-all disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-inset ring-[#031d17]/20 shadow-sm"
                    disabled={d.alertConfigState === 'saving' || d.alertThresholdDraft === String(d.effectiveAlertThreshold)}
                    onClick={d.handleSaveAlertThreshold}
                  >
                    {d.alertConfigState === 'saving' ? d.t('alerts.applying') : d.t('alerts.apply')}
                  </button>

                  {d.alertConfigState === 'saved' && (
                    <div className="text-sm text-[var(--ok)] bg-[var(--ok-10)] px-4 py-3 rounded-lg border border-[var(--ok-20)] flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                      <Activity size={16} /> {d.t('alerts.updateLive')}
                    </div>
                  )}
                  {d.alertConfigState === 'error' && (
                    <div className="text-sm text-[var(--danger)] bg-[var(--danger-10)] px-4 py-3 rounded-lg border border-[var(--danger-20)] flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {d.t('alerts.error')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[var(--bg-1)] border border-[var(--line)] text-sm text-[var(--ink-2)]">
                  {d.t('alerts.readOnly')}
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-[var(--line)]">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--ink-3)]">{d.t('alerts.currentlyActive')}</span>
                  <span className="font-mono font-medium">{d.effectiveAlertThreshold} µg/m³</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
