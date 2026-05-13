import { useEffect, useState } from 'react';
import { Calendar, Download, FileText, Sparkles, X, Zap } from 'lucide-react';
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
import { describeScheduleCountdown } from '../lib/schedule-runner';
import { formatDateTime, tFormat, translate, type Locale } from '../lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  payload: ReportPayload;
  locale: Locale;
}

export function ReportModal({ open, onClose, payload, locale }: Props) {
  const [schedules, setSchedules] = useState<ScheduledReport[]>(() => loadScheduledReports());
  const [cadence, setCadence] = useState<ScheduledReport['cadence']>('daily');
  const [format, setFormat] = useState<ScheduledReport['format']>('pdf');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv' | 'json' | 'xlsx'>('pdf');
  const [now, setNow] = useState(() => new Date());

  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const handleAddSchedule = () => {
    const next: ScheduledReport = {
      id: `sch-${Date.now()}`,
      label: tFormat('report.scheduleRuns', locale, { cadence: t(`report.cadence.${cadence}`), format: format.toUpperCase() }),
      cadence,
      nextRun: nextRunIso(cadence),
      format,
    };
    const merged = [next, ...schedules].slice(0, 8);
    setSchedules(merged);
    saveScheduledReports(merged);
  };

  const handleRemoveSchedule = (id: string) => {
    const filtered = schedules.filter(item => item.id !== id);
    setSchedules(filtered);
    saveScheduledReports(filtered);
  };

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
              <span className="eyebrow">{t('nav.reports')} · On-Demand</span>
            </div>
            
            <div className="format-selection-grid">
              <button 
                className={`format-choice ${selectedFormat === 'pdf' ? 'active' : ''}`}
                onClick={() => setSelectedFormat('pdf')}
              >
                <div className="choice-icon"><FileText size={20} /></div>
                <div className="choice-meta">
                  <div className="name">{t('report.pdf')}</div>
                  <div className="ext">PDF Format</div>
                </div>
              </button>
              
              <button 
                className={`format-choice ${selectedFormat === 'csv' ? 'active' : ''}`}
                onClick={() => setSelectedFormat('csv')}
              >
                <div className="choice-icon"><Download size={20} /></div>
                <div className="choice-meta">
                  <div className="name">{t('report.csv')}</div>
                  <div className="ext">CSV Format</div>
                </div>
              </button>

              <button 
                className={`format-choice ${selectedFormat === 'json' ? 'active' : ''}`}
                onClick={() => setSelectedFormat('json')}
              >
                <div className="choice-icon"><Zap size={20} /></div>
                <div className="choice-meta">
                  <div className="name">{t('report.json')}</div>
                  <div className="ext">JSON Format</div>
                </div>
              </button>

              <button 
                className={`format-choice ${selectedFormat === 'xlsx' ? 'active' : ''}`}
                onClick={() => setSelectedFormat('xlsx')}
              >
                <div className="choice-icon"><FileText size={20} /></div>
                <div className="choice-meta">
                  <div className="name">{t('report.xlsx')}</div>
                  <div className="ext">Excel Workbook</div>
                </div>
              </button>
            </div>

            <button className="btn primary big-generate-btn" onClick={handleGenerate}>
              <Sparkles size={16} /> Generate {selectedFormat.toUpperCase()} Intelligence
            </button>
          </div>

          <div className="report-section">
            <div className="section-header">
              <Calendar size={14} />
              <span className="eyebrow">{t('report.schedule')}</span>
            </div>
            
            <div className="scheduler-box">
              <div className="scheduler-inputs">
                <div className="input-group">
                  <label className="input-label">Cadence</label>
                  <div className="seg">
                    {(['daily', 'weekly', 'monthly'] as const).map(value => (
                      <button
                        key={value}
                        className={`seg-btn ${cadence === value ? 'active' : ''}`}
                        onClick={() => setCadence(value)}
                      >
                        {t(`report.cadence.${value}` as const)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Format</label>
                  <div className="seg">
                    {(['pdf', 'csv', 'json', 'xlsx'] as const).map(value => (
                      <button
                        key={value}
                        className={`seg-btn ${format === value ? 'active' : ''}`}
                        onClick={() => setFormat(value)}
                      >
                        {value.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="btn primary add-sched-btn" onClick={handleAddSchedule}>
                  <Calendar size={14} /> {t('report.addSchedule')}
                </button>
              </div>

              <div className="scheduler-list-area">
                <div className="list-label">{t('report.existing')}</div>
                {schedules.length === 0 ? (
                  <div className="empty-state">{t('report.noneScheduled')}</div>
                ) : (
                  <div className="sched-list-scroll">
                    <ul className="sched-list">
                      {schedules.map(item => (
                        <li key={item.id} className="sched-item">
                          <div className="sched-info">
                            <div className="sched-label">{item.label}</div>
                            <div className="sched-meta">
                              <span className="dot active" /> {t('report.nextRun')} · {formatDateTime(item.nextRun, locale)}
                            </div>
                            <div className="sched-countdown">
                              {(() => {
                                const countdown = describeScheduleCountdown(item.nextRun, now);
                                if (countdown.bucket === 'now') return t('report.countdown.now');
                                return tFormat(`report.countdown.${countdown.bucket}` as const, locale, { value: countdown.value ?? 0 });
                              })()}
                            </div>
                          </div>
                          <button className="icon-btn delete-btn" onClick={() => handleRemoveSchedule(item.id)} aria-label={t('report.removeSchedule')}>
                            <X size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <p className="footer-note">Reports are generated using real-time sensor data and CAMS satellite validation.</p>
        </div>
      </div>
    </div>
  );
}
