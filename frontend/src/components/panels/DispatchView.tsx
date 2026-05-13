import { useState } from 'react';
import type { DashboardData, Mission } from '../../hooks/useDashboardData';
import { Users, Plane, Clock, MapPin, CheckCircle2, FileText } from 'lucide-react';
import { MissionReportDialog } from './MissionReportDialog';

export function DispatchView({ data: d }: { data: DashboardData }) {
  const activeMissions = d.activeMissions;
  const [completingMission, setCompletingMission] = useState<Mission | null>(null);

  return (
    <div className="p-6 h-full overflow-y-auto bg-[var(--bg-0)] animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Dispatch Center</h1>
            <p className="text-[var(--ink-2)] text-base max-w-xl">Coordinate and track field responses, drone scouts, and maintenance missions across the city grid.</p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-4xl font-light tracking-tighter text-[var(--brand)]">{activeMissions.filter(m => m.status !== 'completed').length}</span>
              <span className="text-xs font-medium text-[var(--brand)] uppercase tracking-widest">Active Missions</span>
            </div>
          </div>
        </div>

        {/* Missions List */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--ink-3)]">Mission Log</h2>
          
          {activeMissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-[var(--line)] rounded-3xl text-[var(--ink-3)]">
              <Users size={48} strokeWidth={1} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">No active dispatches</p>
              <p className="text-sm">Initiate a mission from the Map, Sensors, or Alerts view.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {activeMissions.map(mission => (
                <div key={mission.id} className={`p-6 rounded-2xl border bg-[var(--bg-1)] border-[var(--line)] flex flex-col md:flex-row md:items-center gap-6 transition-all hover:border-[var(--brand-30)] ${mission.status === 'completed' ? 'opacity-80' : ''}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${mission.resourceType === 'drone' ? 'bg-[rgba(3,218,197,0.1)] text-[var(--cc-teal)]' : 'bg-[rgba(255,107,0,0.1)] text-[var(--cc-orange)]'}`}>
                    {mission.resourceType === 'drone' ? <Plane size={24} /> : <Users size={24} />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded ${mission.priority === 'crit' ? 'bg-[var(--danger)] text-white' : mission.priority === 'high' ? 'bg-[var(--warn)] text-white' : 'bg-[var(--bg-2)] text-[var(--ink-2)]'}`}>
                        {mission.priority} priority
                      </span>
                      <span className="text-xs text-[var(--ink-3)] font-mono">ID: {mission.id}</span>
                    </div>
                    <h3 className="text-lg font-bold">{mission.targetName}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-[var(--ink-2)] flex items-center gap-1"><MapPin size={12} /> {mission.targetCoord.lat.toFixed(3)}, {mission.targetCoord.lng.toFixed(3)}</span>
                      <span className="text-xs text-[var(--ink-2)] flex items-center gap-1"><Clock size={12} /> Started {new Date(mission.startTime).toLocaleTimeString()}</span>
                    </div>

                    {mission.report && (
                      <div className="mt-4 p-4 rounded-xl bg-[var(--bg-0)] border border-[var(--line)] flex items-start gap-3">
                        <FileText size={14} className="mt-1 text-[var(--ink-3)]" />
                        <div>
                          <div className="text-[10px] uppercase font-bold text-[var(--ink-3)] tracking-wider">Mission Report</div>
                          <p className="text-sm text-[var(--ink-2)] mt-1 italic">"{mission.report}"</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3 min-w-[140px]">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
                      {mission.status === 'en_route' && <span className="text-[var(--warn)] flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[var(--warn)] animate-pulse" /> En Route</span>}
                      {mission.status === 'on_site' && <span className="text-[var(--brand)] flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse" /> On Site</span>}
                      {mission.status === 'completed' && <span className="text-[var(--ok)] flex items-center gap-1.5"><CheckCircle2 size={16} /> Resolved</span>}
                    </div>
                    
                    {mission.status !== 'completed' && (
                      <button 
                        onClick={() => setCompletingMission(mission)}
                        className="px-4 py-2 rounded-xl bg-[var(--brand)] text-white text-xs font-bold hover:bg-[var(--brand-dark)] transition-all shadow-md shadow-[rgba(3,218,197,0.2)]"
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <MissionReportDialog
        isOpen={!!completingMission}
        onClose={() => setCompletingMission(null)}
        onConfirm={(report) => {
          if (completingMission) {
            d.handleCompleteMission(completingMission.id, report);
          }
        }}
        missionId={completingMission?.id ?? ''}
        targetName={completingMission?.targetName ?? ''}
      />
    </div>
  );
}
