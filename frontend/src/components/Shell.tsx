import { type ReactNode, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FlaskConical,
  Home,
  Languages,
  Layers,
  Map as MapIcon,
  Menu,
  Radio,
  Search,
  Settings,
  Siren,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { UserRole, type AuthUser } from '@climence/shared';
import type { DataSource } from '../App';
import type { ConnectionStatus } from '../hooks/useLiveTelemetry';
import { translate, type DictKey, type Locale } from '../lib/i18n';
import climenceLogo from '../assets/climence-logo.png';

const STATUS_META: Record<ConnectionStatus, { labelKey: DictKey; dotClass: string }> = {
  open: { labelKey: 'app.live', dotClass: 'ok' },
  connecting: { labelKey: 'app.connecting', dotClass: 'warn' },
  reconnecting: { labelKey: 'app.reconnecting', dotClass: 'warn' },
};
export interface ShellProps {
  authUser: AuthUser;
  status: ConnectionStatus;
  liveAge: string;
  feedCount: number;
  dispatchCount?: number;
  onlineSensors: number;
  totalSensors: number;
  locale: Locale;
  onToggleRtl: () => void;
  onOpenReportModal: () => void;
  onLogout: () => void;
  /** The view-mode segment in the topbar. */
  modeSegment: ReactNode;
  /** Everything rendered inside <main> (the center area). */
  children: ReactNode;
  /** Everything rendered inside the side rail (<aside>). */
  sideContent: ReactNode;
  currentTab: 'overview' | 'livemap' | 'analytics' | 'alerts' | 'sensors' | 'dispatch' | 'reports';
  onTabChange: (tab: 'overview' | 'livemap' | 'analytics' | 'alerts' | 'sensors' | 'dispatch' | 'reports') => void;
  /** Current data source mode. */
  dataSource: DataSource;
  /** Callback to toggle between live and demo. */
  onToggleDataSource: () => void;
}

export function Shell({
  authUser,
  status,
  liveAge,
  feedCount,
  dispatchCount = 0,
  onlineSensors,
  totalSensors,
  locale,
  onToggleRtl,
  onOpenReportModal,
  onLogout,
  modeSegment,
  children,
  sideContent,
  currentTab,
  onTabChange,
  dataSource,
  onToggleDataSource,
}: ShellProps) {
  const t = (key: DictKey) => translate(key, locale);
  const statusMeta = STATUS_META[status];
  const [navOpen, setNavOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('climence.nav-collapsed') === '1';
  });
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('climence.side-collapsed') === '1';
  });
  const hasSideContent = sideContent !== null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('climence.nav-collapsed', navCollapsed ? '1' : '0');
  }, [navCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('climence.side-collapsed', sideCollapsed ? '1' : '0');
  }, [sideCollapsed]);

  const userInitials = authUser.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(chunk => chunk[0]?.toUpperCase() ?? '')
    .join('');

  const roleLabel =
    authUser.role === UserRole.ADMINISTRATOR
      ? t('nav.role.administrator')
      : authUser.role === UserRole.ANALYST
        ? t('nav.role.analyst')
        : t('nav.role.viewer');

  const currentCrumbLabel =
    currentTab === 'livemap'
      ? t('nav.livemap')
      : currentTab === 'analytics'
        ? t('nav.analytics')
        : currentTab === 'alerts'
          ? t('nav.alerts')
          : currentTab === 'sensors'
            ? t('nav.gridSensors')
            : currentTab === 'dispatch'
              ? t('nav.dispatch')
              : currentTab === 'reports'
                ? t('nav.reports')
                : t('nav.overview');

  const handleNavToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      setNavOpen(true);
      return;
    }
    setNavCollapsed(prev => !prev);
  };

  const handleSideToggle = () => {
    setSideCollapsed(prev => !prev);
  };

  return (
  <div
    className={`app ${hasSideContent ? '' : 'app--no-side'} ${navCollapsed ? 'app--nav-collapsed' : ''} ${sideCollapsed ? 'app--side-collapsed' : ''}`}
  >
      {/* ─── Mobile hamburger overlay ─── */}
      {navOpen && (
        <div
          className="nav-overlay"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav className={`nav ${navOpen ? 'nav--open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <img src={climenceLogo} alt="Climence logo" className="brand-logo" />
          </div>
          <div className="brand-copy">
            <div className="brand-name">Climence</div>
            <div className="brand-sub">{t('app.brand.sub')}</div>
          </div>
          <button
            className="icon-btn nav-collapse-btn"
            onClick={handleNavToggle}
            aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {navCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          {/* Close button visible only on mobile when nav is open */}
          <button
            className="icon-btn nav-close-btn"
            onClick={() => setNavOpen(false)}
            aria-label={t('app.closeNav')}
          >
            <X size={14} />
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">{t('nav.monitor')}</div>
          <button 
            className={`nav-item ${currentTab === 'overview' ? 'active' : ''}`}
            onClick={() => onTabChange('overview')}
            title={t('nav.overview')}
            aria-current={currentTab === 'overview' ? 'page' : undefined}
            data-tooltip={t('nav.overview')}
          >
            <Home size={16} />
            <span className="nav-label">{t('nav.overview')}</span>
          </button>
          <button
            className={`nav-item ${currentTab === 'livemap' ? 'active' : ''}`}
            onClick={() => onTabChange('livemap')}
            title={t('nav.livemap')}
            aria-current={currentTab === 'livemap' ? 'page' : undefined}
            data-tooltip={t('nav.livemap')}
          >
            <MapIcon size={16} />
            <span className="nav-label">{t('nav.livemap')}</span>
          </button>
          <button 
            className={`nav-item ${currentTab === 'analytics' ? 'active' : ''}`}
            onClick={() => onTabChange('analytics')}
            title={t('nav.analytics')}
            aria-current={currentTab === 'analytics' ? 'page' : undefined}
            data-tooltip={t('nav.analytics')}
          >
            <BarChart3 size={16} />
            <span className="nav-label">{t('nav.analytics')}</span>
          </button>
          <button 
            className={`nav-item ${currentTab === 'alerts' ? 'active' : ''}`}
            onClick={() => onTabChange('alerts')}
            title={t('nav.alerts')}
            aria-current={currentTab === 'alerts' ? 'page' : undefined}
            data-tooltip={t('nav.alerts')}
          >
            <Siren size={16} />
            <span className="nav-label">{t('nav.alerts')}</span>
            <span className="count tnum">{feedCount}</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">{t('nav.operate')}</div>
          <button
            className={`nav-item ${currentTab === 'sensors' ? 'active' : ''}`}
            onClick={() => onTabChange('sensors')}
            title="Grid Sensors"
            data-tooltip="Grid Sensors"
          >
            <Radio size={16} />
            <span className="nav-label">Grid Sensors</span>
            <span className="count tnum">
              {onlineSensors}/{totalSensors || 0}
            </span>
          </button>
          <button 
            className={`nav-item ${currentTab === 'dispatch' ? 'active' : ''}`}
            onClick={() => onTabChange('dispatch')}
            title={t('nav.dispatch')} 
            data-tooltip={t('nav.dispatch')}
          >
            <Users size={16} />
            <span className="nav-label">{t('nav.dispatch')}</span>
            {dispatchCount > 0 && <span className="count tnum">{dispatchCount}</span>}
          </button>
          <button
            className={`nav-item ${currentTab === 'reports' ? 'active' : ''}`}
            onClick={() => onTabChange('reports')}
            title={t('nav.reports')}
            data-tooltip={t('nav.reports')}
          >
            <FileText size={16} />
            <span className="nav-label">{t('nav.reports')}</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">{t('nav.system')}</div>
          <button className="nav-item" title={t('nav.integrations')} data-tooltip={t('nav.integrations')}>
            <Layers size={16} />
            <span className="nav-label">{t('nav.integrations')}</span>
          </button>
          <button className="nav-item" title={t('nav.settings')} data-tooltip={t('nav.settings')}>
            <Settings size={16} />
            <span className="nav-label">{t('nav.settings')}</span>
          </button>
        </div>

        <div className="nav-footer">
          <div className="user-chip">
            <div className="avatar">{userInitials || 'U'}</div>
            <div className="user-chip-meta">
              <div className="user-name">{authUser.name}</div>
              <div className="user-role">{roleLabel} · {t('nav.region.riyadh')}</div>
            </div>
            <ChevronRight size={14} />
          </div>
        </div>
      </nav>

      <header className="topbar">
        {/* Hamburger toggle — visible only ≤ 1024px */}
        <button
          className="icon-btn hamburger-btn"
          onClick={handleNavToggle}
          aria-label={t('app.toggleNav')}
        >
          <Menu size={16} />
        </button>

        <div className="crumb desktop-only">
          <span>{t('app.crumb.monitor')}</span>
          <span className="crumb-sep"> / </span>
          <span className="crumb-cur">{currentCrumbLabel}</span>
        </div>

        <span className="live" aria-live="polite">
          <span className={`pulse ${statusMeta.dotClass}`} />
          {t(statusMeta.labelKey)} · {liveAge}
        </span>

        {/* ── Data-source toggle ── */}
        <button
          id="data-source-toggle"
          className={`ds-toggle ${dataSource === 'demo' ? 'ds-toggle--demo' : 'ds-toggle--live'}`}
          onClick={onToggleDataSource}
          title={dataSource === 'live' ? t('app.switchToDemo') : t('app.switchToLive')}
          aria-pressed={dataSource === 'demo'}
        >
          <span className="ds-toggle-track">
            <span className="ds-toggle-thumb" />
          </span>
          <span className="ds-toggle-live">
            <Zap size={10} />
            {t('app.live')}
          </span>
          <span className="ds-toggle-demo">
            <FlaskConical size={10} />
            {t('app.demo')}
          </span>
        </button>

        {dataSource === 'demo' && (
          <span className="topbar-demo-badge" title={t('app.demo.title')}>
            {t('app.demo.badge')}
          </span>
        )}

        {modeSegment}

        <div className="topbar-spacer" />

        <div className="search">
          <Search size={14} />
          <input placeholder={t('app.search')} />
          <span className="kbd desktop-only">⌘K</span>
        </div>

        <button className="icon-btn desktop-only" onClick={onToggleRtl} title={t('app.toggleDirection')}>
          <Languages size={15} />
        </button>
        <button className="icon-btn desktop-only" title={t('app.calendar')}>
          <Calendar size={15} />
        </button>
        <button className="icon-btn" title={t('app.notifications')}>
          <Bell size={15} />
          <span className="badge tnum">{feedCount}</span>
        </button>
        <button className="btn primary desktop-only" onClick={onOpenReportModal}>
          <Download size={13} />
          {t('app.export')}
        </button>
        <button className="btn desktop-only" onClick={onLogout}>
          {t('app.signout')}
        </button>
      </header>

      <main className={`main ${currentTab === 'overview' ? '' : 'main--single'}`}>
        {children}
      </main>

      {hasSideContent && (
        <aside className={`side ${sideCollapsed ? 'side--collapsed' : ''}`}>
          <div className="side-rail-header">
            <button
              className="icon-btn side-collapse-btn"
              onClick={handleSideToggle}
              aria-label={sideCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sideCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sideCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
          <div className="side-rail-body">{sideContent}</div>
        </aside>
      )}
    </div>
  );
}
