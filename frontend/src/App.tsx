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
import { translate, type Locale } from './lib/i18n';
import { AuthScreen } from './components/AuthScreen';
import { Shell } from './components/Shell';
import { Dashboard } from './components/Dashboard';
import { ReportModal } from './components/ReportModal';

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

  /* ── Layout ── */
  const [rtl, setRtl] = useState(false);
  const locale: Locale = rtl ? 'ar' : 'en';
  const [reportModalOpen, setReportModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', rtl ? 'ar' : 'en');
  }, [rtl]);

  /* ── Realtime ── */
  const { snapshot, status } = useLiveTelemetry(authToken);

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

  /* ── Auth gate ── */
  if (!authToken || !authUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  /* ── Mode segment (lives in topbar, driven by dashboard data) ── */
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const modeSegment = (
    <div className="seg desktop-only" style={{ marginLeft: 8 }}>
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
        onlineSensors={data.onlineSensors}
        totalSensors={data.sensors.length}
        locale={locale}
        onToggleRtl={() => setRtl(prev => !prev)}
        onOpenReportModal={() => setReportModalOpen(true)}
        onLogout={handleLogout}
        modeSegment={modeSegment}
        sideContent={<Dashboard data={data} position="side" />}
      >
        <Dashboard data={data} position="main" />
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
