import { useState } from 'react';
import { X, CheckCircle2, FileText, ClipboardList } from 'lucide-react';

interface MissionReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (report: string) => void;
  missionId: string;
  targetName: string;
}

export function MissionReportDialog({ isOpen, onClose, onConfirm, missionId, targetName }: MissionReportDialogProps) {
  const [report, setReport] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.6)] backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[var(--bg-0)] border border-[var(--line)] w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-8 border-b border-[var(--line)] flex items-center justify-between bg-gradient-to-br from-[var(--ok-10)] to-[var(--bg-0)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--ok)] opacity-[0.05] blur-2xl rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[var(--ok)] text-white flex items-center justify-center shadow-lg shadow-[rgba(34,197,94,0.3)]">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--ink-1)]">Mission Complete</h3>
              <p className="text-[10px] text-[var(--ink-3)] uppercase tracking-[0.2em] font-bold">Operational De-briefing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-2)] transition-colors text-[var(--ink-3)]">
            <X size={22} />
          </button>
        </div>

        <div className="p-8 flex flex-col gap-8">
          
          <div className="flex flex-col gap-2">
            <div className="text-[10px] uppercase font-bold text-[var(--ink-3)] tracking-widest">Target Resolved</div>
            <div className="font-bold text-lg text-[var(--ink-1)]">{targetName}</div>
            <div className="text-[10px] font-mono text-[var(--ink-3)] opacity-70">Log ID: {missionId}</div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-[10px] uppercase font-bold tracking-[0.15em] text-[var(--ink-3)] flex items-center gap-2">
              <FileText size={12} /> Post-Mission Report
            </label>
            <textarea 
              value={report}
              onChange={(e) => setReport(e.target.value)}
              placeholder="Describe findings, actions taken, or maintenance performed..."
              className="w-full h-32 p-5 rounded-3xl bg-[var(--bg-1)] border border-[var(--line)] text-sm text-[var(--ink-1)] focus:outline-none focus:border-[var(--ok)] focus:ring-4 focus:ring-[var(--ok-10)] transition-all resize-none placeholder:text-[var(--ink-3)]"
              autoFocus
            />
          </div>

          <button 
            onClick={() => {
              onConfirm(report);
              onClose();
            }}
            style={{
              backgroundColor: 'var(--ok)',
              color: 'white',
              padding: '18px',
              borderRadius: '20px',
              fontWeight: '800',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 12px 30px oklch(from var(--ok) l c h / 0.3)',
              transition: 'all 0.3s'
            }}
            className="hover:scale-[1.02] active:scale-[0.98] group"
          >
            Finalize Mission <ClipboardList size={18} />
          </button>

        </div>
      </div>
    </div>
  );
}
