import { useCallback, useMemo, useState } from 'react';
import { Clock, Download, FileText, Sparkles, X, Zap } from 'lucide-react';
import {
  exportSnapshotCsv,
  exportSnapshotJson,
  exportSnapshotXlsx,
  loadScheduledReports,
  nextRunIso,
  openPrintablePdf,
  saveScheduledReports,
  type ReportPayload,
  type ScheduledReport,
} from '../lib/reports';
import { formatDateTimeCompact, tFormat, translate, type Locale } from '../lib/i18n';
import { describeScheduleCountdown } from '../lib/schedule-runner';

interface Props {
  open: boolean;
  onClose: () => void;
  payload: ReportPayload;
  locale: Locale;
}

export function ReportModal({ open, onClose, payload, locale }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv' | 'json' | 'xlsx'>('pdf');
  const [cadence, setCadence] = useState<ScheduledReport['cadence']>('daily');
  const [scheduleFormat, setScheduleFormat] = useState<ScheduledReport['format']>('pdf');
  const [schedules, setSchedules] = useState<ScheduledReport[]>(() => loadScheduledReports());
  const [toast, setToast] = useState<string | null>(null);

  const t = useCallback((key: Parameters<typeof translate>[0]) => translate(key, locale), [locale]);

  const cadenceLabel = useMemo(() => {
    if (cadence === 'daily') return t('report.cadence.daily');
    if (cadence === 'weekly') return t('report.cadence.weekly');
    return t('report.cadence.monthly');
  }, [cadence, t]);

  if (!open) return null;

  const handleGenerate = () => {
    if (selectedFormat === 'pdf') openPrintablePdf(payload);
    else if (selectedFormat === 'csv') exportSnapshotCsv(payload);
    else if (selectedFormat === 'json') exportSnapshotJson(payload);
    else if (selectedFormat === 'xlsx') exportSnapshotXlsx(payload);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title" onClick={event => event.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title-area">
            <div className="brand-badge">{t('report.subtitleTag')}</div>
            <h3 id="report-modal-title">{t('report.title')}</h3>
            <p className="modal-sub">{t('report.subtitle')}</p>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} aria-label={t('report.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="report-section">
            <div className="section-header">
              <Download size={14} />
              <span className="eyebrow">{t('nav.reports')} · {t('report.onDemand')}</span>
            </div>
            
            <div className="format-selection-grid">
              <button 
                className={`format-choice ${selectedFormat === 'pdf' ? 'active' : ''}`}
                onClick={() => setSelectedFormat('pdf')}
              >
                <div className="choice-icon"><FileText size={20} /></div>
                <div className="choice-meta">
                  <div className="name">{t('report.pdf')}</div>
                    <div className="ext">{t('report.format.pdfSub')}</div>
                </div>
              </button>
              
              <button 
                className={`format-choice ${selectedFormat === 'csv' ? 'active' : ''}`}
                onClick={() => setSelectedFormat('csv')}
              >
                <div className="choice-icon"><Download size={20} /></div>
                <div className="choice-meta">
                  <div className="name">{t('report.csv')}</div>
                    <div className="ext">{t('report.format.csvSub')}</div>
                </div>
              </button>

              <button 
                className={`format-choice ${selectedFormat === 'json' ? 'active' : ''}`}
                onClick={() => setSelectedFormat('json')}
              >
                <div className="choice-icon"><Zap size={20} /></div>
                <div className="choice-meta">
                  <div className="name">{t('report.json')}</div>
                    <div className="ext">{t('report.format.jsonSub')}</div>
                </div>
              </button>

              <button 
                className={`format-choice ${selectedFormat === 'xlsx' ? 'active' : ''}`}
                onClick={() => setSelectedFormat('xlsx')}
              >
                <div className="choice-icon"><FileText size={20} /></div>
                <div className="choice-meta">
                  <div className="name">{t('report.xlsx')}</div>
                    <div className="ext">{t('report.format.xlsxSub')}</div>
                </div>
              </button>
            </div>

            <button className="btn primary big-generate-btn" onClick={handleGenerate}>
              <Sparkles size={16} /> {tFormat('report.generate', locale, { format: selectedFormat.toUpperCase() })}
            </button>
          </div>

          <div className="report-section">
            <div className="section-header">
              <Zap size={14} />
              <span className="eyebrow">{t('report.ready')}</span>
            </div>
            <div className="scheduler-box">
              <div className="scheduler-inputs">
                <div>
                  <label className="input-label">{t('report.cadence.daily')} / {t('report.cadence.weekly')} / {t('report.cadence.monthly')}</label>
                  <select
                    className="select"
                    title={t('report.schedule')}
                    value={cadence}
                    onChange={e => setCadence(e.target.value as ScheduledReport['cadence'])}
                  >
                    <option value="daily">{t('report.cadence.daily')}</option>
                    <option value="weekly">{t('report.cadence.weekly')}</option>
                    <option value="monthly">{t('report.cadence.monthly')}</option>
                  </select>
                </div>

                <div>
                  <label className="input-label">{t('report.onDemand')}</label>
                  <select
                    className="select"
                    title={t('report.schedule')}
                    value={scheduleFormat}
                    onChange={e => setScheduleFormat(e.target.value as ScheduledReport['format'])}
                  >
                    <option value="pdf">{t('report.pdf')}</option>
                    <option value="csv">{t('report.csv')}</option>
                    <option value="json">{t('report.json')}</option>
                    <option value="xlsx">{t('report.xlsx')}</option>
                  </select>
                </div>

                <button
                  className="btn primary add-sched-btn"
                  onClick={() => {
                    const next: ScheduledReport = {
                      id: crypto.randomUUID(),
                      label: tFormat('report.scheduleRuns', locale, {
                        cadence: cadenceLabel,
                        format: scheduleFormat.toUpperCase(),
                      }),
                      cadence,
                      nextRun: nextRunIso(cadence),
                      format: scheduleFormat,
                    };
                    const nextSchedules = [next, ...schedules];
                    setSchedules(nextSchedules);
                    saveScheduledReports(nextSchedules);
                    setToast(t('report.scheduleAdded'));
                    window.setTimeout(() => setToast(null), 2500);
                  }}
                >
                  <Sparkles size={14} /> {t('report.addSchedule')}
                </button>
              </div>

              <div className="scheduler-list-area">
                <div className="list-label">{t('report.existing')}</div>

                {schedules.length === 0 ? (
                  <div className="empty-state">{t('report.noneScheduled')}</div>
                ) : (
                  <div className="sched-list">
                    {schedules.map(item => {
                      const countdown = describeScheduleCountdown(item.nextRun);
                      const countdownLabel =
                        countdown.bucket === 'now'
                          ? t('report.countdown.now')
                          : countdown.bucket === 'minutes'
                            ? tFormat('report.countdown.minutes', locale, { value: countdown.value ?? 0 })
                            : countdown.bucket === 'hours'
                              ? tFormat('report.countdown.hours', locale, { value: countdown.value ?? 0 })
                              : tFormat('report.countdown.days', locale, { value: countdown.value ?? 0 });

                      return (
                        <div className="sched-item" key={item.id}>
                          <div>
                            <div className="sched-label">{item.label}</div>
                            <div className="sched-meta">
                              <span className="dot active" />
                              <Clock size={12} />
                              <span>
                                {t('report.nextRun')}: {formatDateTimeCompact(item.nextRun, locale)} · {countdownLabel}
                              </span>
                            </div>
                          </div>

                          <button
                            className="btn ghost"
                            onClick={() => {
                              const nextSchedules = schedules.filter(s => s.id !== item.id);
                              setSchedules(nextSchedules);
                              saveScheduledReports(nextSchedules);
                              setToast(t('report.scheduleRemoved'));
                              window.setTimeout(() => setToast(null), 2500);
                            }}
                          >
                            {t('report.removeSchedule')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {toast ? (
                  <div className="toast" role="status" aria-live="polite">{toast}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <p className="footer-note">{t('report.footerNote')}</p>
        </div>
      </div>
    </div>
  );
}
