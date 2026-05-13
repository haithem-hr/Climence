/**
 * App.tsx — composition root.
 *
 * Owns: session lifecycle, RTL / locale, composing Shell + Dashboard + ReportModal.
 * Does NOT own: data logic (→ useDashboardData), layout (→ Shell), login (→ AuthScreen).
 */
import { useCallback, useEffect, useState } from 'react';
import { Grid2x2, Layers } from 'lucide-react';
import type { AuthUser } from '@climence/shared';
import { useLiveTelemetry } from './hooks/useLiveTelemetry';
import { useDashboardData } from './hooks/useDashboardData';
import { clearAuthSession, isSessionExpired, loadAuthSession } from './lib/auth-session';
import { exportSnapshotCsv, exportSnapshotJson, exportSnapshotXlsx, loadScheduledReports, openPrintablePdf, saveScheduledReports } from './lib/reports';
import { runDueSchedules } from './lib/schedule-runner';
import { translate, type Locale } from './lib/i18n';
import { MOCK_SNAPSHOT } from './lib/mockData';
import { AuthScreen } from './components/AuthScreen';
import { Shell } from './components/Shell';
import { Dashboard } from './components/Dashboard';
import { ReportModal } from './components/ReportModal';
import { AnalyticsView } from './components/panels/AnalyticsView';
import { LiveMapView } from './components/panels/LiveMapView';
import { AlertsView } from './components/panels/AlertsView';
import { SensorsView } from './components/panels/SensorsView';
import { DispatchView } from './components/panels/DispatchView';
import { ReportsView } from './components/panels/ReportsView';

export type DataSource = 'live' | 'demo';
const DS_KEY = 'climence.data-source';

/* ═══════════════════════════ SESSION INIT ═══════════════════════════ */

function loadInitialSession(): { token: string; user: AuthUser } | null {
  const session = loadAuthSession();
  if (!session || isSessionExpired(session)) {
    clearAuthSession();
    return null;
  }
  return session;
}

/* ═══════════════════════════ APP ═══════════════════════════ */

export default function App() {
  /* ── Auth ── */
  const [initialSession] = useState(loadInitialSession);
  const [authToken, setAuthToken] = useState<string | null>(initialSession?.token ?? null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(initialSession?.user ?? null);

  /* ── Data source (live / demo) — persisted ── */
  const [dataSource, setDataSource] = useState<DataSource>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(DS_KEY) : null;
    return stored === 'demo' ? 'demo' : 'live';
  });

  const handleToggleDataSource = useCallback(() => {
    setDataSource(prev => {
      const next: DataSource = prev === 'live' ? 'demo' : 'live';
      window.localStorage.setItem(DS_KEY, next);
      return next;
    });
  }, []);

  /* ── Layout ── */
  const [rtl, setRtl] = useState(false);
  const locale: Locale = rtl ? 'ar' : 'en';
  const [reportModalOpen, setReportModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', rtl ? 'ar' : 'en');
  }, [rtl]);

  /* ── Realtime ── */
  const { snapshot: liveSnapshot, status } = useLiveTelemetry(authToken);

  // In demo mode, substitute the static mock; keep status as-is so the
  // topbar connection indicator still reflects the real WS state.
  const snapshot = dataSource === 'demo' ? MOCK_SNAPSHOT : liveSnapshot;

  /* ── Data hook (only runs when authenticated) ── */
  const data = useDashboardData(
    snapshot,
    status,
    authToken ?? '',
    authUser ?? ({ name: '', email: '', role: 'viewer' } as AuthUser),
    locale,
  );

  /* ── Handlers ── */
  const handleLogin = useCallback((session: { token: string; user: AuthUser }) => {
    setAuthToken(session.token);
    setAuthUser(session.user);
  }, []);

  const handleLogout = useCallback(() => {
    clearAuthSession();
    setAuthToken(null);
    setAuthUser(null);
  }, []);

  useEffect(() => {
    if (!authToken || !authUser) return;

    const runSchedules = () => {
      const stored = loadScheduledReports();
      if (stored.length === 0) return;
      const result = runDueSchedules(
        stored,
        data.reportPayload,
        {
          pdf: openPrintablePdf,
          csv: exportSnapshotCsv,
          json: exportSnapshotJson,
          xlsx: exportSnapshotXlsx,
        },
      );
      if (result.executed.length > 0) {
        saveScheduledReports(result.schedules);
      }
    };

    runSchedules();
    const timer = window.setInterval(runSchedules, 300000);
    return () => window.clearInterval(timer);
  }, [authToken, authUser, data.reportPayload]);

  /* ── Auth gate ── */
  if (!authToken || !authUser) {
    return <AuthScreen onLogin={handleLogin} locale={locale} onToggleRtl={() => setRtl(prev => !prev)} />;
  }

  /* ── Mode segment (lives in topbar, driven by dashboard data) ── */
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const modeSegment = (
  <div className="seg desktop-only mode-segment">
      <button className={`seg-btn ${data.mode === 'hardware' ? 'active' : ''}`} onClick={() => data.setMode('hardware')}>
        <Grid2x2 size={12} /> {t('seg.hardware')}
      </button>
      <button className={`seg-btn ${data.mode === 'heatmap' ? 'active' : ''}`} onClick={() => data.setMode('heatmap')}>
        <Layers size={12} /> {t('seg.heatmap')}
      </button>
    </div>
  );

  return (
    <>
      <Shell
        authUser={authUser}
        status={status}
        liveAge={data.liveAge}
        feedCount={data.feed.length}
        dispatchCount={data.activeMissions.filter(m => m.status !== 'completed').length}
        onlineSensors={data.onlineSensors}
        totalSensors={data.sensors.length}
        locale={locale}
        onToggleRtl={() => setRtl(prev => !prev)}
        onOpenReportModal={() => setReportModalOpen(true)}
        onLogout={handleLogout}
        modeSegment={modeSegment}
        currentTab={data.currentTab}
        onTabChange={data.setCurrentTab}
        dataSource={dataSource}
        onToggleDataSource={handleToggleDataSource}
        sideContent={data.currentTab === 'overview' ? <Dashboard data={data} position="side" /> : null}
      >
        {data.currentTab === 'overview' && <Dashboard data={data} position="main" onNavigate={data.setCurrentTab} onOpenReportModal={() => setReportModalOpen(true)} />}
        {data.currentTab === 'livemap' && <LiveMapView data={data} />}
        {data.currentTab === 'analytics' && <AnalyticsView authToken={authToken} data={data} />}
        {data.currentTab === 'alerts' && <AlertsView data={data} />}
        {data.currentTab === 'sensors' && <SensorsView data={data} />}
        {data.currentTab === 'dispatch' && <DispatchView data={data} />}
        {data.currentTab === 'reports' && <ReportsView data={data} locale={locale} />}
      </Shell>

      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        payload={data.reportPayload}
        locale={locale}
      />
    </>
  );
}
