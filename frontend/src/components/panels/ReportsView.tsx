import { useState } from 'react';
import { Download, Sparkles, Zap } from 'lucide-react';
import {
  exportSnapshotCsv,
  exportSnapshotJson,
  exportSnapshotXlsx,
  openPrintablePdf,
} from '../../lib/reports';
import { tFormat, translate, type Locale } from '../../lib/i18n';
import type { DashboardData } from '../../hooks/useDashboardData';

interface Props {
  data: DashboardData;
  locale: Locale;
}

export function ReportsView({ data, locale }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv' | 'json' | 'xlsx'>('pdf');

  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const payload = data.reportPayload;

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
          <Download size={12} /> {t('report.subtitleTag')}
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
              {t('report.onDemandTitle')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {([
                { id: 'pdf', icon: Download, label: t('report.pdf') },
                { id: 'csv', icon: Download, label: t('report.csv') },
                { id: 'json', icon: Zap, label: t('report.json') },
                { id: 'xlsx', icon: Download, label: t('report.xlsx') },
              ] as const).map(f => (
                <button 
                  key={f.id}
                  onClick={() => setSelectedFormat(f.id)}
                  className={`flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 text-left ${selectedFormat === f.id ? 'bg-[var(--bg-1)] border-[var(--brand-40)] shadow-md ring-1 ring-[var(--brand-20)]' : 'bg-transparent border-[var(--line)] hover:border-[var(--brand-20)]'}`}
                >
                  <div className={`report-format-icon w-12 h-12 rounded-xl flex items-center justify-center ${selectedFormat === f.id ? 'report-format-icon--active' : ''}`}>
                    <f.icon size={22} />
                  </div>
                  <div>
                    <div className="font-bold text-[var(--ink-1)]">{f.label}</div>
                  </div>
                </button>
              ))}
            </div>

            <button 
              className="w-full py-5 rounded-2xl bg-[var(--brand)] text-white font-bold text-lg shadow-xl shadow-[rgba(3,218,197,0.2)] hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              onClick={handleGenerate}
            >
              <Sparkles size={20} /> {tFormat('report.generate', locale, { format: selectedFormat.toUpperCase() })}
            </button>
            
            <p className="text-center text-xs text-[var(--ink-3)] mt-6 font-medium">
              {tFormat('report.synthNote', locale, { sensors: data.sensors.length })}
            </p>
          </div>

          {/* Scheduler removed */}
        </div>

      </div>
    </div>
  );
}
