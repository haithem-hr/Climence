import { useState } from 'react';
import { X, Users, Plane, Zap, ShieldAlert, FileText, Send } from 'lucide-react';
import type { MissionConfig, ResourceType, MissionPriority } from '../../hooks/useDashboardData';

interface DispatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: MissionConfig) => void;
  targetId: string;
  targetName: string;
  targetCoord: { lat: number; lng: number };
}

export function DispatchDialog({ isOpen, onClose, onConfirm, targetId, targetName, targetCoord }: DispatchDialogProps) {
  const [resourceType, setResourceType] = useState<ResourceType>('drone');
  const [priority, setPriority] = useState<MissionPriority>('high');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      targetId,
      targetName,
      targetCoord,
      resourceType,
      priority,
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.6)] backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[var(--bg-0)] border border-[var(--line)] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 ease-out">
        
        {/* Header */}
        <div className="p-8 border-b border-[var(--line)] flex items-center justify-between bg-gradient-to-br from-[var(--bg-1)] to-[var(--bg-0)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--brand)] opacity-[0.05] blur-2xl rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand)] text-white flex items-center justify-center shadow-lg shadow-[rgba(3,218,197,0.3)]">
              <Send size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--ink-1)]">Initiate Dispatch</h3>
              <p className="text-[10px] text-[var(--ink-3)] uppercase tracking-[0.2em] font-bold">Strategic Mission Planning</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-2)] transition-colors text-[var(--ink-3)]">
            <X size={22} />
          </button>
        </div>

        <div className="p-8 flex flex-col gap-8">
          
          {/* Target Summary Card */}
          <div className="p-5 rounded-3xl bg-[var(--bg-1)] border border-[var(--line)] flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[var(--bg-2)] shadow-sm border border-[var(--line)] flex items-center justify-center text-[var(--danger)]">
              <ShieldAlert size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-bold text-[var(--ink-3)] tracking-widest mb-1">Mission Target</div>
              <div className="font-bold text-base text-[var(--ink-1)] truncate">{targetName}</div>
              <div className="text-[10px] font-mono text-[var(--ink-3)] opacity-70 mt-0.5">{targetCoord.lat.toFixed(6)}°, {targetCoord.lng.toFixed(6)}°</div>
            </div>
          </div>

          {/* Resource Selection */}
          <div className="flex flex-col gap-4">
            <label className="text-[10px] uppercase font-bold tracking-[0.15em] text-[var(--ink-3)] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
              Resource Allocation
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setResourceType('drone')}
                className={`p-5 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-3 text-center ${resourceType === 'drone' ? 'border-[var(--brand)] bg-[var(--brand-10)] text-[var(--brand)] shadow-inner' : 'border-[var(--line)] bg-transparent text-[var(--ink-3)] hover:border-[var(--ink-3)] hover:text-[var(--ink-2)]'}`}
              >
                <div className={`p-3 rounded-2xl ${resourceType === 'drone' ? 'bg-[var(--brand)] text-white' : 'bg-[var(--bg-1)]'}`}>
                  <Plane size={24} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-sm font-bold">Autonomous Drone</div>
                  <div className="text-[9px] opacity-60 mt-0.5 uppercase tracking-wider">Rapid Deployment</div>
                </div>
              </button>
              <button 
                onClick={() => setResourceType('team')}
                className={`p-5 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-3 text-center ${resourceType === 'team' ? 'border-[#ff6b00] bg-[rgba(255,107,0,0.05)] text-[#ff6b00] shadow-inner' : 'border-[var(--line)] bg-transparent text-[var(--ink-3)] hover:border-[var(--ink-3)] hover:text-[var(--ink-2)]'}`}
              >
                <div className={`p-3 rounded-2xl ${resourceType === 'team' ? 'bg-[#ff6b00] text-white' : 'bg-[var(--bg-1)]'}`}>
                  <Users size={24} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-sm font-bold">Response Team</div>
                  <div className="text-[9px] opacity-60 mt-0.5 uppercase tracking-wider">On-site Investigation</div>
                </div>
              </button>
            </div>
          </div>

          {/* Priority Controls */}
          <div className="flex flex-col gap-4">
            <label className="text-[10px] uppercase font-bold tracking-[0.15em] text-[var(--ink-3)] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--danger)]" />
              Mission Priority
            </label>
            <div className="flex gap-3">
              {(['low', 'high', 'crit'] as MissionPriority[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all border-2 ${priority === p ? 'bg-[var(--ink-1)] text-white border-[var(--ink-1)] shadow-xl scale-[1.02]' : 'bg-transparent text-[var(--ink-3)] border-[var(--line)] hover:border-[var(--ink-2)] hover:text-[var(--ink-2)]'}`}
                >
                  {p === 'crit' ? 'Critical' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Special Instructions */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] uppercase font-bold tracking-[0.15em] text-[var(--ink-3)] flex items-center gap-2">
              <FileText size={12} /> Special Instructions
            </label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operational objectives or site notes..."
              className="w-full h-24 p-5 rounded-3xl bg-[var(--bg-1)] border border-[var(--line)] text-sm text-[var(--ink-1)] focus:outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand-10)] transition-all resize-none placeholder:text-[var(--ink-3)]"
            />
          </div>

          {/* Action Footer */}
          <button 
            onClick={handleConfirm}
            style={{
              backgroundColor: 'var(--brand)',
              color: 'white',
              padding: '18px',
              borderRadius: '20px',
              fontWeight: '800',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 12px 30px oklch(from var(--brand) l c h / 0.3)',
              transition: 'all 0.3s'
            }}
            className="hover:scale-[1.02] active:scale-[0.98] mt-2 group"
          >
            Authorize Deployment <Zap size={18} className="group-hover:animate-bounce" />
          </button>

        </div>
      </div>
    </div>
  );
}
