import { useCallback, useEffect, useState } from 'react';
import { Clock, Download, FileText, Sparkles, X, Zap } from 'lucide-react';
import {
  exportSnapshotCsv,
  exportSnapshotJson,
  exportSnapshotXlsx,
  openPrintablePdf,
  type ReportPayload,
} from '../lib/reports';
import {
  fetchScheduledReports,
  createScheduledReport,
  deleteScheduledReport,
  type ApiScheduledReport,
} from '../api/client';
import { formatDateTimeCompact, tFormat, translate, type Locale } from '../lib/i18n';
import { describeScheduleCountdown } from '../lib/schedule-runner';

interface Props {
  open: boolean;
  onClose: () => void;
  payload: ReportPayload;
  locale: Locale;
  authToken: string;
}

export function ReportModal({ open, onClose, payload, locale, authToken }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv' | 'json' | 'xlsx'>('pdf');
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [scheduleFormat, setScheduleFormat] = useState<'pdf' | 'csv' | 'json' | 'xlsx'>('pdf');
  const [schedules, setSchedules] = useState<ApiScheduledReport[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const t = useCallback((key: Parameters<typeof translate>[0]) => translate(key, locale), [locale]);

  const loadSchedules = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const data = await fetchScheduledReports(authToken);
      setSchedules(data);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (open && authToken) {
      void loadSchedules();
    }
  }, [open, authToken, loadSchedules]);


  if (!open) return null;

  const handleGenerate = () => {
    if (selectedFormat === 'pdf') openPrintablePdf(payload);
    else if (selectedFormat === 'csv') exportSnapshotCsv(payload);
    else if (selectedFormat === 'json') exportSnapshotJson(payload);
    else if (selectedFormat === 'xlsx') exportSnapshotXlsx(payload);
  };

  const handleAddSchedule = async () => {
    try {
      const newSchedule = await createScheduledReport(
        {
          frequency: cadence,
          output_format: scheduleFormat,
          report_type: 'snapshot',
          recipients: [],
        },
        authToken
      );
      setSchedules(prev => [newSchedule, ...prev]);
      setToast(t('report.scheduleAdded'));
      window.setTimeout(() => setToast(null), 2500);
    } catch (err) {
      console.error('Failed to add schedule:', err);
      setToast('Failed to add schedule');
      window.setTimeout(() => setToast(null), 2500);
    }
  };

  const handleRemoveSchedule = async (scheduleId: number) => {
    try {
      await deleteScheduledReport(scheduleId, authToken);
      setSchedules(prev => prev.filter(s => s.schedule_id !== scheduleId));
      setToast(t('report.scheduleRemoved'));
      window.setTimeout(() => setToast(null), 2500);
    } catch (err) {
      console.error('Failed to remove schedule:', err);
      setToast('Failed to remove schedule');
      window.setTimeout(() => setToast(null), 2500);
    }
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
                    onChange={e => setCadence(e.target.value as 'daily' | 'weekly' | 'monthly')}
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
                    onChange={e => setScheduleFormat(e.target.value as 'pdf' | 'csv' | 'json' | 'xlsx')}
                  >
                    <option value="pdf">{t('report.pdf')}</option>
                    <option value="csv">{t('report.csv')}</option>
                    <option value="json">{t('report.json')}</option>
                    <option value="xlsx">{t('report.xlsx')}</option>
                  </select>
                </div>

                <button
                  className="btn primary add-sched-btn"
                  onClick={handleAddSchedule}
                >
                  <Sparkles size={14} /> {t('report.addSchedule')}
                </button>
              </div>

              <div className="scheduler-list-area">
                <div className="list-label">{t('report.existing')}</div>

                {loading ? (
                  <div className="empty-state">Loading schedules...</div>
                ) : schedules.length === 0 ? (
                  <div className="empty-state">{t('report.noneScheduled')}</div>
                ) : (
                  <div className="sched-list">
                    {schedules.map(item => {
                      const itemCadenceLabel =
                        item.frequency === 'daily'
                          ? t('report.cadence.daily')
                          : item.frequency === 'weekly'
                            ? t('report.cadence.weekly')
                            : t('report.cadence.monthly');
                      
                      const itemLabel = tFormat('report.scheduleRuns', locale, {
                        cadence: itemCadenceLabel,
                        format: (item.output_format || 'pdf').toUpperCase(),
                      });

                      const nextRunStr = item.next_run || '';
                      const countdown = describeScheduleCountdown(nextRunStr);
                      const countdownLabel =
                        countdown.bucket === 'now'
                          ? t('report.countdown.now')
                          : countdown.bucket === 'minutes'
                            ? tFormat('report.countdown.minutes', locale, { value: countdown.value ?? 0 })
                            : countdown.bucket === 'hours'
                              ? tFormat('report.countdown.hours', locale, { value: countdown.value ?? 0 })
                              : tFormat('report.countdown.days', locale, { value: countdown.value ?? 0 });

                      return (
                        <div className="sched-item" key={item.schedule_id}>
                          <div>
                            <div className="sched-label">{itemLabel}</div>
                            <div className="sched-meta">
                              <span className="dot active" />
                              <Clock size={12} />
                              <span>
                                {t('report.nextRun')}: {nextRunStr ? formatDateTimeCompact(nextRunStr, locale) : '--'} · {countdownLabel}
                              </span>
                            </div>
                          </div>

                          <button
                            className="btn ghost"
                            onClick={() => handleRemoveSchedule(item.schedule_id)}
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
