import { useEffect, useState } from 'react';
import { Calendar, Download, FileText, Sparkles, Zap, Clock } from 'lucide-react';
import {
  exportSnapshotCsv,
  exportSnapshotJson,
  exportSnapshotXlsx,
  loadScheduledReports,
  nextRunIso,
  openPrintablePdf,
  saveScheduledReports,
  type ScheduledReport,
} from '../../lib/reports';
import { describeScheduleCountdown } from '../../lib/schedule-runner';
import { formatDateTime, tFormat, translate, type Locale } from '../../lib/i18n';
import type { DashboardData } from '../../hooks/useDashboardData';

interface Props {
  data: DashboardData;
  locale: Locale;
}

export function ReportsView({ data, locale }: Props) {
  const [schedules, setSchedules] = useState<ScheduledReport[]>(() => loadScheduledReports());
  const [cadence, setCadence] = useState<ScheduledReport['cadence']>('daily');
  const [format, setFormat] = useState<ScheduledReport['format']>('pdf');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv' | 'json' | 'xlsx'>('pdf');
  const [now, setNow] = useState(() => new Date());

  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const payload = data.reportPayload;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

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
    <div className="reports-view p-8 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(3,218,197,0.1)] text-[var(--cc-teal)] text-xs font-semibold tracking-wide uppercase mb-4">
          <FileText size={12} /> {t('report.subtitleTag')}
        </div>
        <h1 className="text-4xl font-bold text-[var(--ink-1)] mb-3">{t('report.title')}</h1>
        <p className="text-[var(--ink-2)] text-lg max-w-2xl">{t('report.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* On-Demand Export Section */}
        <div className="lg:col-span-7 space-y-8">
          <div className="glass rounded-[2rem] p-8 border border-[var(--line)] shadow-sm">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <Download size={20} className="text-[var(--brand)]" />
              On-Demand Intelligence Export
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[
                { id: 'pdf', icon: FileText, label: t('report.pdf'), sub: 'Print-Ready PDF', color: 'var(--brand)' },
                { id: 'csv', icon: Download, label: t('report.csv'), sub: 'Raw CSV Dataset', color: 'oklch(0.78 0.17 60)' },
                { id: 'json', icon: Zap, label: t('report.json'), sub: 'Structured JSON', color: 'oklch(0.68 0.20 28)' },
                { id: 'xlsx', icon: FileText, label: t('report.xlsx'), sub: 'Excel Workbook', color: 'oklch(0.60 0.14 250)' },
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => setSelectedFormat(f.id as any)}
                  className={`flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 text-left ${selectedFormat === f.id ? 'bg-[var(--bg-1)] border-[var(--brand-40)] shadow-md ring-1 ring-[var(--brand-20)]' : 'bg-transparent border-[var(--line)] hover:border-[var(--brand-20)]'}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center`} style={{ background: selectedFormat === f.id ? f.color : 'var(--bg-2)', color: selectedFormat === f.id ? 'white' : 'var(--ink-3)' }}>
                    <f.icon size={22} />
                  </div>
                  <div>
                    <div className="font-bold text-[var(--ink-1)]">{f.label}</div>
                    <div className="text-xs text-[var(--ink-3)] font-medium mt-0.5">{f.sub}</div>
                  </div>
                </button>
              ))}
            </div>

            <button 
              className="w-full py-5 rounded-2xl bg-[var(--brand)] text-white font-bold text-lg shadow-xl shadow-[rgba(3,218,197,0.2)] hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              onClick={handleGenerate}
            >
              <Sparkles size={20} /> Generate {selectedFormat.toUpperCase()} Snapshot
            </button>
            
            <p className="text-center text-xs text-[var(--ink-3)] mt-6 font-medium">
              Reports are synthesized from {data.sensors.length} live IoT nodes and validated via CAMS satellite telemetry.
            </p>
          </div>

          <div className="glass rounded-[2rem] p-8 border border-[var(--line)] shadow-sm">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
              <Clock size={20} className="text-[var(--brand)]" />
              Automated Report Scheduler
            </h2>

            <div className="flex flex-col sm:flex-row gap-6 mb-8">
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-widest text-[var(--ink-3)] mb-3 block">Cadence</label>
                <div className="flex bg-[var(--bg-1)] p-1 rounded-xl border border-[var(--line)]">
                  {(['daily', 'weekly', 'monthly'] as const).map(v => (
                    <button 
                      key={v}
                      onClick={() => setCadence(v)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${cadence === v ? 'bg-white shadow-sm text-[var(--brand)]' : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]'}`}
                    >
                      {t(`report.cadence.${v}` as const)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-widest text-[var(--ink-3)] mb-3 block">Format</label>
                <div className="flex bg-[var(--bg-1)] p-1 rounded-xl border border-[var(--line)]">
                  {(['pdf', 'csv', 'json', 'xlsx'] as const).map(v => (
                    <button 
                      key={v}
                      onClick={() => setFormat(v)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${format === v ? 'bg-white shadow-sm text-[var(--brand)]' : 'text-[var(--ink-3)] hover:text-[var(--ink-1)]'}`}
                    >
                      {v.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              className="w-full py-4 rounded-xl border-2 border-dashed border-[var(--brand-40)] text-[var(--brand)] font-bold hover:bg-[var(--brand-10)] hover:border-[var(--brand)] transition-all flex items-center justify-center gap-2"
              onClick={handleAddSchedule}
            >
              <Calendar size={18} /> {t('report.addSchedule')}
            </button>
          </div>
        </div>

        {/* Sidebar: Existing Schedules */}
        <div className="lg:col-span-5">
          <div className="glass rounded-[2rem] p-8 border border-[var(--line)] shadow-sm sticky top-8">
            <h3 className="text-lg font-bold mb-6">{t('report.existing')}</h3>
            
            {schedules.length === 0 ? (
              <div className="py-12 text-center text-[var(--ink-3)] font-medium bg-[var(--bg-1)] rounded-2xl border border-dashed border-[var(--line)]">
                <Calendar size={32} className="mx-auto mb-3 opacity-20" />
                {t('report.noneScheduled')}
              </div>
            ) : (
              <div className="space-y-4">
                {schedules.map(item => (
                  <div key={item.id} className="group p-5 rounded-2xl bg-white border border-[var(--line)] hover:border-[var(--brand-30)] hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-[var(--ink-1)] mb-1">{item.label}</div>
                        <div className="flex items-center gap-2 text-xs font-medium text-[var(--ink-3)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
                          {t('report.nextRun')} · {formatDateTime(item.nextRun, locale)}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveSchedule(item.id)}
                        className="p-2 rounded-lg text-[var(--ink-3)] hover:text-[var(--danger)] hover:bg-[var(--danger-10)] transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="mt-4 pt-4 border-t border-[var(--line)] text-xs font-bold text-[var(--brand)] uppercase tracking-wider">
                      {(() => {
                        const countdown = describeScheduleCountdown(item.nextRun, now);
                        if (countdown.bucket === 'now') return t('report.countdown.now');
                        return tFormat(`report.countdown.${countdown.bucket}` as const, locale, { value: countdown.value ?? 0 });
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 p-5 rounded-2xl bg-gradient-to-br from-[var(--bg-1)] to-white border border-[var(--line)]">
              <div className="text-xs font-bold text-[var(--ink-3)] uppercase tracking-widest mb-2">Notice</div>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                Scheduled reports are processed by the Climence background worker. You will receive an alert in the dashboard when a new report is ready for download.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function X({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
