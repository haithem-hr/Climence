/**
 * App.tsx — composition root.
 *
 * Owns: session lifecycle, RTL / locale, composing Shell + Dashboard + ReportModal.
 * Does NOT own: data logic (→ useDashboardData), layout (→ Shell), login (→ AuthScreen).
 */
import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@climence/shared';
import { useLiveTelemetry } from './hooks/useLiveTelemetry';
import { DASHBOARD_STORAGE_KEYS, useDashboardData, type PollutantKey } from './hooks/useDashboardData';
import { useStationaryHeatmap } from './hooks/useStationaryHeatmap';
import { clearAuthSession, isSessionExpired, loadAuthSession } from './lib/auth-session';
import { type Locale } from './lib/i18n';
import { isMapMetricKey } from './lib/mapMetrics';
import { MOCK_SNAPSHOT } from './lib/mockData';
import { AuthScreen } from './components/AuthScreen';
import { Shell } from './components/Shell';
import { Dashboard } from './components/Dashboard';
import { ReportModal } from './components/ReportModal';
import { AnalyticsView } from './components/panels/AnalyticsView';
import { LiveMapView } from './components/panels/LiveMapView';
import { AlertsView } from './components/panels/AlertsView';
import { SensorsView } from './components/panels/SensorsView';

export type DataSource = 'live' | 'stationary';
const DS_KEY = 'climence.data-source';

function loadInitialPollutant(): PollutantKey {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(DASHBOARD_STORAGE_KEYS.POLLUTANT) : null;
  return isMapMetricKey(stored) ? stored : 'pm25';
}

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
    // Backward compat: older builds stored 'demo'. Treat it as 'stationary'.
    if (stored === 'stationary' || stored === 'demo') return 'stationary';
    return 'live';
  });

  const handleToggleDataSource = useCallback(() => {
    setDataSource(prev => {
      const next: DataSource = prev === 'live' ? 'stationary' : 'live';
      window.localStorage.setItem(DS_KEY, next);
      return next;
    });
  }, []);

  /* ── Layout ── */
  const [rtl, setRtl] = useState(false);
  const locale: Locale = rtl ? 'ar' : 'en';
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [pollutant, setPollutant] = useState<PollutantKey>(loadInitialPollutant);

  useEffect(() => {
    document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', rtl ? 'ar' : 'en');
  }, [rtl]);

  /* ── Realtime ── */
  const { snapshot: liveSnapshot, status } = useLiveTelemetry(authToken);

  // In stationary mode, substitute the static mock; keep status as-is so the
  // topbar connection indicator still reflects the real WS state.
  const snapshot = dataSource === 'stationary' ? MOCK_SNAPSHOT : liveSnapshot;

  const stationaryHeatmap = useStationaryHeatmap(authToken ?? '', dataSource === 'stationary' && Boolean(authToken), pollutant);

  /* ── Data hook (only runs when authenticated) ── */
  const data = useDashboardData(
    snapshot,
    status,
    authToken ?? '',
    authUser ?? ({ name: '', email: '', role: 'viewer' } as AuthUser),
    locale,
    dataSource,
    stationaryHeatmap.points,
    pollutant,
    setPollutant,
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

  /* ── Auth gate ── */
  if (!authToken || !authUser) {
    return <AuthScreen onLogin={handleLogin} locale={locale} onToggleRtl={() => setRtl(prev => !prev)} />;
  }

  return (
    <>
      <Shell
        authUser={authUser}
        status={status}
        liveAge={data.liveAge}
        feedCount={data.feed.length}
        feed={data.feed}
        onlineSensors={data.onlineSensors}
        totalSensors={data.sensors.length}
        locale={locale}
        onToggleRtl={() => setRtl(prev => !prev)}
        onOpenReportModal={() => setReportModalOpen(true)}
        onLogout={handleLogout}
        modeSegment={null}
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
      </Shell>

      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        payload={data.reportPayload}
        locale={locale}
        authToken={authToken}
      />
    </>
  );
}
