import { type ReactNode, useState } from 'react';
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronRight,
  Cpu,
  Download,
  FileText,
  Home,
  Languages,
  Layers,
  Map as MapIcon,
  Menu,
  Search,
  Settings,
  Siren,
  Users,
  X,
} from 'lucide-react';
import { UserRole, type AuthUser } from '@climence/shared';
import type { ConnectionStatus } from '../hooks/useLiveTelemetry';
import { translate, type DictKey, type Locale } from '../lib/i18n';
import climenceLogo from '../assets/climence-logo.png';

const STATUS_META: Record<ConnectionStatus, { label: string; dotClass: string }> = {
  open: { label: 'Live', dotClass: 'ok' },
  connecting: { label: 'Connecting', dotClass: 'warn' },
  reconnecting: { label: 'Reconnecting', dotClass: 'warn' },
};

export interface ShellProps {
  authUser: AuthUser;
  status: ConnectionStatus;
  liveAge: string;
  feedCount: number;
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
  currentTab: 'overview' | 'analytics';
  onTabChange: (tab: 'overview' | 'analytics') => void;
}

export function Shell({
  authUser,
  status,
  liveAge,
  feedCount,
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
}: ShellProps) {
  const t = (key: DictKey) => translate(key, locale);
  const statusMeta = STATUS_META[status];
  const [navOpen, setNavOpen] = useState(false);

  const userInitials = authUser.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(chunk => chunk[0]?.toUpperCase() ?? '')
    .join('');

  const roleLabel =
    authUser.role === UserRole.ADMINISTRATOR
      ? 'Administrator'
      : authUser.role === UserRole.ANALYST
        ? 'Analyst'
        : 'Viewer';

  return (
    <div className="app">
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
          <div>
            <div className="brand-name">Climence</div>
            <div className="brand-sub">{t('app.brand.sub')}</div>
          </div>
          {/* Close button visible only on mobile when nav is open */}
          <button
            className="icon-btn nav-close-btn"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={14} />
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">{t('nav.monitor')}</div>
          <button 
            className={`nav-item ${currentTab === 'overview' ? 'active' : ''}`}
            onClick={() => onTabChange('overview')}
          >
            <Home size={16} />
            {t('nav.overview')}
          </button>
          <button className="nav-item">
            <MapIcon size={16} />
            {t('nav.livemap')}
          </button>
          <button 
            className={`nav-item ${currentTab === 'analytics' ? 'active' : ''}`}
            onClick={() => onTabChange('analytics')}
          >
            <BarChart3 size={16} />
            {t('nav.analytics')}
          </button>
          <button className="nav-item">
            <Siren size={16} />
            {t('nav.alerts')}
            <span className="count tnum">{feedCount}</span>
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">{t('nav.operate')}</div>
          <button className="nav-item">
            <Cpu size={16} />
            {t('nav.sensors')}
            <span className="count tnum">
              {onlineSensors}/{totalSensors || 0}
            </span>
          </button>
          <button className="nav-item">
            <Users size={16} />
            {t('nav.dispatch')}
          </button>
          <button className="nav-item" onClick={onOpenReportModal}>
            <FileText size={16} />
            {t('nav.reports')}
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">{t('nav.system')}</div>
          <button className="nav-item">
            <Layers size={16} />
            {t('nav.integrations')}
          </button>
          <button className="nav-item">
            <Settings size={16} />
            {t('nav.settings')}
          </button>
        </div>

        <div className="nav-footer">
          <div className="user-chip">
            <div className="avatar">{userInitials || 'U'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name">{authUser.name}</div>
              <div className="user-role">{roleLabel} · Riyadh</div>
            </div>
            <ChevronRight size={14} />
          </div>
        </div>
      </nav>

      <header className="topbar">
        {/* Hamburger toggle — visible only ≤ 1024px */}
        <button
          className="icon-btn hamburger-btn"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={16} />
        </button>

        <div className="crumb desktop-only">
          <span>{t('app.crumb.monitor')}</span>
          <span className="crumb-sep"> / </span>
          <span className="crumb-cur">{t('app.crumb.overview')}</span>
        </div>

        <span className="live">
          <span className={`pulse ${statusMeta.dotClass}`} />
          {statusMeta.label} · {liveAge}
        </span>

        {modeSegment}

        <div className="topbar-spacer" />

        <div className="search">
          <Search size={14} />
          <input placeholder={t('app.search')} />
          <span className="kbd desktop-only">⌘K</span>
        </div>

        <button className="icon-btn desktop-only" onClick={onToggleRtl} title="Toggle direction">
          <Languages size={15} />
        </button>
        <button className="icon-btn desktop-only" title="Calendar">
          <Calendar size={15} />
        </button>
        <button className="icon-btn" title="Notifications">
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

      <main className="main">
        {children}
      </main>

      <aside className="side">
        {sideContent}
      </aside>
    </div>
  );
}
