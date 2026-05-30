import {
  Activity,
  Bell,
  ChevronRight,
  CloudSun,
  Cpu,
  Gauge,
  Layers,
  MapPin,
  Radar,
  Search,
  Settings,
  ShieldAlert,
  Siren,
  SlidersHorizontal,
  Wind,
} from 'lucide-react';

import { aqiBandFor } from '@climence/shared';
import type { useDashboardData } from '../hooks/useDashboardData';

const SENSOR_FILTERS = ['PM2.5', 'PM10', 'NO2', 'O3', 'SO2', 'CO'];

type DashboardData = ReturnType<typeof useDashboardData>;

export function CommandCenterRedesign({ data, onNavigate }: { data: DashboardData, onNavigate?: (tab: string) => void }) {
  const KPI_CARDS = [
    { label: 'City AQI', value: data.cityAqi.toString(), meta: aqiBandFor(data.cityAqi).label, tone: data.cityBand === 'haz' || data.cityBand === 'vunh' ? 'hazard' : data.cityBand === 'unh' ? 'warn' : 'good', icon: Activity },
    { label: 'PM2.5', value: data.pm25Now.toString(), meta: `µg/m³ · ${data.trendLabel}`, tone: data.cityBand === 'haz' || data.cityBand === 'vunh' ? 'hazard' : data.cityBand === 'unh' ? 'warn' : 'good', icon: Gauge },
    { label: 'Active Alerts', value: data.feed.length.toString(), meta: `${data.feed.filter(a => a.severity === 'crit').length} critical`, tone: data.feed.length > 0 ? 'alert' : 'good', icon: Siren, actionName: 'Go to alerts', actionTab: 'alerts' },
    { label: 'Sensors Online', value: `${data.onlineSensors}/${data.sensors.length}`, meta: '100% coverage', tone: data.onlineSensors === data.sensors.length ? 'good' : 'warn', icon: Cpu, actionName: 'See all sensors', actionTab: 'sensors' },
    { label: 'Wind', value: data.drift.speedKmh.toString(), meta: `km/h · ${data.drift.cardinal}`, tone: 'neutral', icon: Wind },
  ];

  const HOTSPOTS = data.hotspots.slice(0, 5).map(spot => ({
    id: spot.id,
    name: spot.name,
    pm25: spot.metricValue,
    trend: `${spot.trend > 0 ? '+' : ''}${spot.trend}%`,
    tone: spot.band === 'haz' || spot.band === 'vunh' ? 'hazard' : spot.band === 'unh' || spot.band === 'usg' ? 'warn' : 'good'
  }));

  return (
    <div className="cc-theme min-h-screen bg-[var(--cc-bg)] text-[var(--cc-text)]">
      <div className="cc-shell grid min-h-screen grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="cc-sidebar border-r border-[var(--cc-border)] bg-[var(--cc-surface)]">
          <div className="cc-brand flex items-center gap-3 border-b border-[var(--cc-border)] px-5 py-6">
            <div className="cc-brand-mark">C</div>
            <div>
              <div className="cc-brand-title">Climence</div>
              <div className="cc-brand-sub">Command Center</div>
            </div>
          </div>

          <div className="cc-nav px-4 py-5">
            <div className="cc-nav-section">
              <div className="cc-nav-title">Monitor</div>
              <button className="cc-nav-item">Overview</button>
              <button className="cc-nav-item cc-nav-item--active">
                <span>Live Map</span>
                <span className="cc-nav-pill">Live</span>
              </button>
              <button className="cc-nav-item">Analytics</button>
              <button className="cc-nav-item">
                <span>Alerts</span>
                <span className="cc-nav-badge">{data.feed.length}</span>
              </button>
            </div>

            <div className="cc-nav-section">
              <div className="cc-nav-title">Operate</div>
              <button className="cc-nav-item">Sensors</button>
              <button className="cc-nav-item">Dispatch</button>
              <button className="cc-nav-item">Reports</button>
            </div>

            <div className="cc-nav-section">
              <div className="cc-nav-title">System</div>
              <button className="cc-nav-item">Integrations</button>
              <button className="cc-nav-item">Settings</button>
            </div>
          </div>

          <div className="cc-user border-t border-[var(--cc-border)] px-5 py-4">
            <div className="cc-user-chip">
              <div className="cc-user-avatar">RA</div>
              <div>
                <div className="cc-user-name">Riyadh Analyst</div>
                <div className="cc-user-meta">Analyst · Riyadh</div>
              </div>
              <ChevronRight size={14} />
            </div>
          </div>
        </aside>

        <main className="cc-main flex min-w-0 flex-col">
          <header className="cc-topbar border-b border-[var(--cc-border)] bg-[var(--cc-surface)] px-6 py-4">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="cc-crumb text-xs uppercase tracking-[0.24em] text-[var(--cc-muted)]">
                  Monitor / Live Map
                </div>
                <span className="cc-live-pill">
                  <span className="cc-live-dot" /> Live · 1s
                </span>
              </div>
              <div className="cc-top-actions flex items-center gap-3">
                <div className="cc-search">
                  <Search size={16} />
                  <input placeholder="Search sensors, zones, incidents" />
                </div>
                <button className="cc-icon-btn" aria-label="Notifications">
                  <Bell size={16} />
                  <span className="cc-icon-badge">{data.feed.length}</span>
                </button>
                <button className="cc-primary-btn">Export report</button>
                <button className="cc-ghost-btn">Sign out</button>
              </div>
            </div>
          </header>

          <section className="cc-kpi-grid grid grid-cols-5 gap-4 px-6 py-5">
            {KPI_CARDS.map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={`cc-kpi-card cc-kpi-card--${card.tone}`}>
                  <div className="cc-kpi-header">
                    <span className="cc-kpi-label">{card.label}</span>
                    <span className="cc-kpi-icon">
                      <Icon size={18} />
                    </span>
                  </div>
                  <div className="cc-kpi-value">{card.value}</div>
                  <div className="cc-kpi-meta flex items-center justify-between w-full">
                    <span>{card.meta}</span>
                    {onNavigate && card.actionName && card.actionTab && (
                      <button onClick={() => onNavigate(card.actionTab as string)} className="text-[var(--cc-teal)] hover:underline text-xs font-medium cursor-pointer">
                        {card.actionName}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          <section className="cc-map-area flex min-h-0 flex-1 gap-6 px-6 pb-6">
            <div className="cc-map-card flex min-w-0 flex-1 flex-col gap-4">
              <div className="cc-map-toolbar">
                <div className="cc-toolbar-group">
                  <span className="cc-chip-label">Status</span>
                  {['All', 'Online', 'Offline'].map(item => (
                    <button key={item} className={`cc-chip ${item === 'All' ? 'cc-chip--active' : ''}`}>
                      {item}
                    </button>
                  ))}
                </div>
                <div className="cc-toolbar-group">
                  <span className="cc-chip-label">PM2.5</span>
                  {['All', '≥ 35', '≥ 75', '≥ 120'].map(item => (
                    <button key={item} className={`cc-chip ${item === 'All' ? 'cc-chip--active' : ''}`}>
                      {item}
                    </button>
                  ))}
                </div>
                <div className="cc-toolbar-group">
                  <span className="cc-chip-label">Battery</span>
                  <button className="cc-chip cc-chip--active">≤ 30%</button>
                  <div className="cc-slider" />
                </div>
                <div className="cc-toolbar-group">
                  <button className="cc-chip cc-chip--active">Clustering</button>
                  <button className="cc-chip">Hardware</button>
                  <button className="cc-chip">Heatmap</button>
                </div>
              </div>

              <div className="cc-map-surface">
                <div className="cc-map-overlay">
                  <div className="cc-map-legend">
                    <div className="cc-legend-title">AQI · US EPA</div>
                    <div className="cc-legend-bar" />
                    <div className="cc-legend-labels">
                      <span>Good</span>
                      <span>Moderate</span>
                      <span>Unhealthy</span>
                      <span>Hazard</span>
                    </div>
                  </div>

                  <div className="cc-map-controls">
                    <div className="cc-segment">
                      <button className="cc-segment-btn cc-segment-btn--active">City</button>
                      <button className="cc-segment-btn">Sector</button>
                      <button className="cc-segment-btn">Zone</button>
                    </div>
                    <button className="cc-icon-btn" aria-label="Map layers">
                      <Layers size={16} />
                    </button>
                    <button className="cc-icon-btn" aria-label="Map filters">
                      <SlidersHorizontal size={16} />
                    </button>
                  </div>

                  <div className="cc-map-toolbar">
                    <div className="cc-map-toolbar-title">
                      <MapPin size={14} /> Sensor overlays
                    </div>
                    <div className="cc-map-toggle-row">
                      {SENSOR_FILTERS.map(item => (
                        <button key={item} className={`cc-toggle ${item === 'PM2.5' ? 'cc-toggle--active' : ''}`}>
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="cc-bottom-bar">
                <div className="cc-bottom-item">
                  <Radar size={14} /> Stream · Live
                </div>
                <div className="cc-bottom-item">
                  <CloudSun size={14} /> Model v2.1.4
                </div>
                <div className="cc-bottom-item cc-latency cc-latency--good">
                  <Activity size={14} /> Latency 42ms
                </div>
                <div className="cc-bottom-item">Updated 6 seconds ago</div>
              </div>
            </div>
          </section>
        </main>

        <aside className="cc-right border-l border-[var(--cc-border)] bg-[var(--cc-surface)] p-6">
          <div className="cc-card">
            <div className="cc-card-header">
              <div>
                <div className="cc-card-eyebrow">Alert threshold</div>
                <div className="cc-card-title">PM2.5 Threshold</div>
              </div>
              <span className="cc-pill cc-pill--alert">Critical</span>
            </div>
            <div className="cc-card-body">
              <div className="cc-threshold-value">{data.effectiveAlertThreshold} µg/m³</div>
              <div className="cc-threshold-meta">Current alerts are {data.thresholdExceededBy > 0 ? `${data.thresholdExceededBy} µg/m³ above` : 'below'} baseline</div>
              <div className="cc-threshold-actions">
                <button className="cc-secondary-btn">Edit Threshold</button>
                <button className="cc-primary-btn">Dispatch</button>
              </div>
            </div>
          </div>

          <div className="cc-card">
            <div className="cc-card-header">
              <div>
                <div className="cc-card-eyebrow">PM2.5 trend</div>
                <div className="cc-card-title">Last 30 minutes</div>
              </div>
              <span className={`cc-pill cc-pill--${data.trend.direction === 'worsening' ? 'warn' : 'good'}`}>{data.trendLabel}</span>
            </div>
            <div className="cc-chart">
              <div className="cc-chart-grid" />
              <div className="cc-chart-line" />
            </div>
            <div className="cc-chart-meta">
              <span>Avg {Math.round(data.pm25Series.reduce((a, b) => a + b, 0) / Math.max(1, data.pm25Series.length))} µg/m³</span>
              <span>Peak {Math.round(Math.max(...data.pm25Series))} µg/m³</span>
            </div>
          </div>

          <div className="cc-card">
            <div className="cc-card-header">
              <div>
                <div className="cc-card-eyebrow">Hotspots</div>
                <div className="cc-card-title">Highest exposure zones</div>
              </div>
              <button className="cc-icon-btn" aria-label="Hotspot settings">
                <Settings size={16} />
              </button>
            </div>
            <div className="cc-hotspot-list">
              {HOTSPOTS.map((spot, index) => (
                <div key={spot.id} className={`cc-hotspot-row cc-hotspot-row--${spot.tone}`}>
                  <div className="cc-hotspot-rank">#{index + 1}</div>
                  <div>
                    <div className="cc-hotspot-name">{spot.name}</div>
                    <div className="cc-hotspot-meta">PM2.5 {spot.pm25} µg/m³</div>
                  </div>
                  <div className="cc-hotspot-trend">{spot.trend}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="cc-alert-strip">
            <ShieldAlert size={16} />
            <div>
              <div className="cc-alert-title">{data.feed.filter(a => a.severity === 'crit').length} critical incidents</div>
              <div className="cc-alert-meta">{data.feed.length > 0 ? data.feed[0].meta : 'No recent incidents'}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
