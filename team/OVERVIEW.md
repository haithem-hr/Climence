# Team Overview — Climence

Five engineers, five vertical slices. Each slice owns a clean set of files and a clear batch of requirements from [docs/SWE496_REQUIREMENTS_TRACEABILITY.md](../docs/SWE496_REQUIREMENTS_TRACEABILITY.md). There is overlap at **interfaces** (shared types, the WebSocket snapshot shape) — which is intentional — but **not at file ownership**.

## Ownership matrix

| # | Student | Role | Primary files / folders | Requirements | Depends on |
|---|---|---|---|---|---|
| 1 | **Hamza** | Team Lead · Platform & Telemetry Pipeline | [simulator/](../simulator/), [backend/src/index.ts](../backend/src/index.ts), [backend/src/ws.ts](../backend/src/ws.ts), [backend/src/db/](../backend/src/db/), [backend/src/routes/telemetry.ts](../backend/src/routes/telemetry.ts), [shared/src/telemetry.ts](../shared/src/telemetry.ts), [shared/src/messages.ts](../shared/src/messages.ts), [shared/src/constants.ts](../shared/src/constants.ts), [data/](../data/), root tooling | FR-01, FR-04 ingestion, NFR-01, NFR-02, NFR-10 | — (unblocks everyone) |
| 2 | **Haithem** | Backend · Auth, Roles, Alerts | [backend/src/routes/auth.ts](../backend/src/routes/auth.ts), [backend/src/routes/alerts.ts](../backend/src/routes/alerts.ts), [backend/src/features/auth/](../backend/src/features/auth/), [backend/src/features/alerts/](../backend/src/features/alerts/), [backend/src/lib/auth.ts](../backend/src/lib/auth.ts), [shared/src/auth.ts](../shared/src/auth.ts) | FR-02, FR-03, FR-13, FR-14, NFR-05, NFR-06, UC-A3, UC-A4, UC-A6 | #1 (needs ws + db schema contract) |
| 3 | **Abderraouf** | Backend · Analytics, Hotspots, Forecast | [backend/src/routes/analytics.ts](../backend/src/routes/analytics.ts), hotspot + trend SQL inside [backend/src/db/queries.ts](../backend/src/db/queries.ts), [backend/src/features/analytics/](../backend/src/features/analytics/) (new), [shared/src/aqi.ts](../shared/src/aqi.ts) | FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-11, FR-12, UC1, UC2, UC3, UC-A1, UC-A2 | #1 (needs telemetry rows), #2 (protected routes) |
| 4 | **Oussama** | Frontend · Realtime Shell, Map, KPIs | [frontend/src/App.tsx](../frontend/src/App.tsx) shell, [frontend/src/components/map/](../frontend/src/components/map/), [frontend/src/hooks/useLiveTelemetry.ts](../frontend/src/hooks/useLiveTelemetry.ts), KPI strip, Topbar, Sidebar, Command Center, trend pill, wind compass, [frontend/src/index.css](../frontend/src/index.css) layout | FR-04, FR-05, FR-06, FR-07, UC1 UI, NFR-07, §8 trend pill | #1 (snapshot contract), #3 (analytics endpoints + derived values) |
| 5 | **Imad** | Frontend · Reports, i18n, Panels, UX | [frontend/src/components/ReportModal.tsx](../frontend/src/components/ReportModal.tsx), [frontend/src/lib/reports.ts](../frontend/src/lib/reports.ts), [frontend/src/lib/i18n.ts](../frontend/src/lib/i18n.ts), [frontend/src/lib/analytics.ts](../frontend/src/lib/analytics.ts) client-side derivations, side panels (Weather/Forecast/Sources/Alerts/AlertSettings), accessibility, responsive CSS | FR-11 UI, FR-12 UI, FR-15, FR-16, FR-17, NFR-07, NFR-08, NFR-09, UC4, UC-A5 | #1 (snapshot contract), #2 (alert config endpoint), #4 (shell scaffold) |

## Implementation order

Dependencies flow left → right in this diagram. Work in parallel **within a column**.

```
Phase 1 (unblock)       Phase 2 (build in parallel)         Phase 3 (polish)
─────────────────       ───────────────────────             ────────────────

#1 Hamza  ──────▶     #2 Haithem     (auth, alerts)
  (contracts)           #3 Abderraouf (analytics)
                        #4 Oussama   (shell, map)   ──▶    cross-cutting:
                                                           #5 Imad (reports, i18n)
                                                           polish + accessibility
                                                           across everyone's panels
```

**Start order**

1. **Hamza (Day 1-2)**: lock down the snapshot contract in `shared/src/messages.ts` and any schema changes in `backend/src/db/schema.sql`. Publish a PR so everyone unblocks.
2. **Haithem + Abderraouf + Oussama (Day 3+)**: begin in parallel. Hamza's auth middleware is a prerequisite for Abderraouf's new protected routes — sequence the middleware PR first, then backfill tests.
3. **Imad (Day 4+)**: depends on Oussama's shell scaffold to mount the ReportModal and i18n wiring. Can start the i18n dictionary and report exporters in isolation on Day 3.

## Progress log

Most recent first. Each entry: date · who · what landed · branch / files (so the next reviewer knows where to look).

- **2026-05-13 — Imad** — P2 **Schedule UI → tab-local execution hook** complete (FR-17 / UC-A5 → Partial hardening). Added a pure schedule runner, mounted a 5-minute app-level due-check loop, extended scheduled formats to include `xlsx`, and surfaced per-report next-run countdowns in the Reports modal. Branch `imad/report-schedule-runner`. Files: [frontend/src/lib/schedule-runner.ts](../frontend/src/lib/schedule-runner.ts), [frontend/src/components/ReportModal.tsx](../frontend/src/components/ReportModal.tsx), [frontend/src/App.tsx](../frontend/src/App.tsx), [frontend/test/schedule-runner.test.ts](../frontend/test/schedule-runner.test.ts). 12/12 tests green. **Heads-up for #1 Hamza / #2 Haithem:** the client now executes schedules while a tab stays open; the next phase is replacing this with a backend `ReportSchedules` store and cron runner.
- **2026-05-13 — Imad** — P5 **Panel extraction + polish** complete (NFR-09 → Partial hardening). Extracted the overview side rail into dedicated panel files, added a compact alert-settings panel, and introduced reusable empty-state and row-animation styling without moving snapshot logic out of `useDashboardData`. Branch `imad/panels-side-rail-extraction`. Files: [frontend/src/components/Dashboard.tsx](../frontend/src/components/Dashboard.tsx), [frontend/src/components/panels/EventBanner.tsx](../frontend/src/components/panels/EventBanner.tsx), [frontend/src/components/panels/AlertSettingsPanel.tsx](../frontend/src/components/panels/AlertSettingsPanel.tsx), [frontend/src/components/panels/HotspotsPanel.tsx](../frontend/src/components/panels/HotspotsPanel.tsx), [frontend/src/components/panels/FeedPanel.tsx](../frontend/src/components/panels/FeedPanel.tsx), [frontend/src/index.css](../frontend/src/index.css). 10/10 tests green. **Heads-up for #4 Oussama:** the overview side rail now has stable component boundaries, so shell/responsive work can target individual panels instead of `Dashboard.tsx`.
- **2026-05-13 — Imad** — P0 **Real Excel (.xlsx) export** complete (FR-16 / UC4 → Implemented). Added a true browser-side workbook export with typed cells across `Sensors`, `Alerts`, and `City Trend`, exposed it in the Reports modal, and added workbook unit coverage while fixing the dashboard test glob. Branch `imad/reports-xlsx-export`. Files: [frontend/src/lib/reports.ts](../frontend/src/lib/reports.ts), [frontend/src/components/ReportModal.tsx](../frontend/src/components/ReportModal.tsx), [frontend/test/reports.test.ts](../frontend/test/reports.test.ts), [frontend/package.json](../frontend/package.json). 10/10 tests green. **Heads-up for #2 Haithem / #4 Oussama:** the report UI now offers a real `.xlsx` export; P2 still needs to add `xlsx` to scheduled exports and any role-aware gating can reuse the existing modal card.
- **2026-04-25 — Haithem** — P1 **Tighten RBAC beyond alert config** complete (FR-03 / NFR-05 → Implemented). Added a backend permission matrix, returned permissions from `/api/auth/me`, enforced explicit read/write route roles, and required analyst/admin auth for telemetry ingestion while keeping the simulator boot path authenticated. Branch `haithem/backend-rbac-permissions`. Files: [backend/src/features/auth/permissions.ts](../backend/src/features/auth/permissions.ts), [backend/src/routes/auth.ts](../backend/src/routes/auth.ts), [backend/src/routes/alerts.ts](../backend/src/routes/alerts.ts), [backend/src/routes/analytics.ts](../backend/src/routes/analytics.ts), [backend/src/routes/telemetry.ts](../backend/src/routes/telemetry.ts), [simulator/src/FleetManager.ts](../simulator/src/FleetManager.ts), [shared/src/auth.ts](../shared/src/auth.ts). 35/35 tests green. **Heads-up for #1 Hamza / #4 Oussama / #5 Imad:** telemetry POSTs now need analyst/admin bearer auth, and the frontend can consume `/api/auth/me.permissions` for role-aware UI.
- **2026-04-25 — Oussama** — P3 **Responsive shell + layout perf** complete (NFR-07 → Implemented). Split the monolithic App.tsx (1786 lines) into 4 clean modules: `AuthScreen.tsx` (login screen), `Shell.tsx` (3-column grid layout + hamburger nav), `Dashboard.tsx` (pure render), and `useDashboardData.ts` (all data logic as a custom hook). App.tsx is now 118 lines of pure composition. Added responsive breakpoints: ≤1280px narrows side rail to 320px, ≤1024px hides nav rail with slide-out hamburger drawer + overlay, ≤640px converts side rail to bottom-sheet pattern with drag handle. RTL-aware at every breakpoint. Branch `oussama/frontend-responsive-shell`. Files: [frontend/src/App.tsx](../frontend/src/App.tsx), [frontend/src/components/AuthScreen.tsx](../frontend/src/components/AuthScreen.tsx), [frontend/src/components/Shell.tsx](../frontend/src/components/Shell.tsx), [frontend/src/components/Dashboard.tsx](../frontend/src/components/Dashboard.tsx), [frontend/src/hooks/useDashboardData.ts](../frontend/src/hooks/useDashboardData.ts), [frontend/src/index.css](../frontend/src/index.css). 23/23 tests green. **Heads-up for #5 Imad:** responsive shell skeleton is in place — deep a11y polish and component-level responsive rules can layer on top without conflicts.
- **2026-04-25 — Oussama** — P2 **Pollutant switching that actually switches** complete (FR-06 / UC1 → Implemented). Wired the active pollutant into the Leaflet heatmap, hotspot severity, and legend scale so PM2.5, CO2, NO2, temperature, humidity, and battery now render different spatial patterns, with stable sensor projection on inert snapshots. Branch `oussama/frontend-map-drill-down`. Files: [frontend/src/App.tsx](../frontend/src/App.tsx), [frontend/src/components/map/RiyadhGoogleMap.tsx](../frontend/src/components/map/RiyadhGoogleMap.tsx), [frontend/src/components/map/HeatmapLayer.tsx](../frontend/src/components/map/HeatmapLayer.tsx), [frontend/src/lib/mapMetrics.ts](../frontend/src/lib/mapMetrics.ts), [frontend/test/mapMetrics.test.ts](../frontend/test/mapMetrics.test.ts). 31/31 tests green. **Heads-up for #3 Abderraouf:** once backend exposes pollutant-specific hotspot aggregates, the map can swap out its current sensor-derived fallback for non-PM2.5 modes without changing the UI contract.
- **2026-04-25 — Oussama** — P1 **Encode drone state on markers** complete (FR-04 / UC1 → Implemented). Added state-aware Leaflet markers so offline drones fade to 35% opacity with an `Offline since {server_timestamp}` tooltip, low-battery drones show an amber ring + battery overlay, and gathering drones pulse without losing AQI color fill. Branch `oussama/frontend-map-drill-down`. Files: [frontend/src/components/map/RiyadhGoogleMap.tsx](../frontend/src/components/map/RiyadhGoogleMap.tsx), [frontend/src/components/map/markerState.ts](../frontend/src/components/map/markerState.ts), [frontend/src/index.css](../frontend/src/index.css), [frontend/test/markerState.test.ts](../frontend/test/markerState.test.ts). 29/29 tests green. **Heads-up for #1 Hamza:** the UI now consumes `DroneState` per marker; if new simulator states land, extend the class/tooltip mapping in `markerState.ts`.
- **2026-04-25 — Oussama** — P0 **Proper map drill-down** complete (FR-05 / UC1 → Implemented). Added city/sector/zone zoom presets, viewport bounds propagation into KPI counts, live zoom readout, hotspot fly-to (zoom 14), and hotspot radiusKm-ready overlay rendering with fallback radius. Branch `oussama/frontend-map-drill-down`. Files: [frontend/src/components/map/RiyadhGoogleMap.tsx](../frontend/src/components/map/RiyadhGoogleMap.tsx), [frontend/src/App.tsx](../frontend/src/App.tsx). 27/27 tests green. **Heads-up for #3 Abderraouf:** once hotspot cluster payload includes `radiusKm`, the map will consume it immediately with no extra frontend wiring.
- **2026-04-25 — Hamza** — P3 **Simulator hazard convergence + scrubber loop restored** (FR-01 / NFR-01 partial hardening). Reintroduced hazard-driven swarm behavior: `FleetManager` now authenticates and polls `/api/alerts/active`, clusters zones, and dispatches up to 3 nearest available drones; `DroneDevice` now supports `INVESTIGATING_HAZARD` with a 30s scrubber cycle that mutates the runtime environment map and regenerates over time. Added simulator tests for hazard investigation and hotspot pollution reduction. Files: [simulator/src/FleetManager.ts](../simulator/src/FleetManager.ts), [simulator/src/DroneDevice.ts](../simulator/src/DroneDevice.ts), [simulator/src/device/DroneDevice.test.ts](../simulator/src/device/DroneDevice.test.ts), [shared/src/telemetry.ts](../shared/src/telemetry.ts), [shared/src/constants.ts](../shared/src/constants.ts). **Heads-up for #2 Haithem:** simulator now uses alert API auth (env overrides supported). **Heads-up for #4 Oussama / #5 Imad:** UI can now receive `INVESTIGATING_HAZARD` state.
- **2026-04-25 — Haithem** — P0 **Login lockout policy** complete (FR-02 / UC-A6 → Implemented). Sliding 10-min window, 15-min lock after 5 failures, 429 + `Retry-After`. New `POST /api/auth/logout`. Shared lockout constants in `shared/src/auth.ts`. Branch `haithem/auth-lockout-policy`. Files: [backend/src/features/auth/lockout.ts](../backend/src/features/auth/lockout.ts), [lockout.test.ts](../backend/src/features/auth/lockout.test.ts), [routes/auth.ts](../backend/src/routes/auth.ts), [lib/http.ts](../backend/src/lib/http.ts). 19/19 tests green. **Heads-up for #4 Oussama / #5 Imad:** the frontend can now call `/api/auth/logout` on sign-out and surface a "locked, try again in N seconds" message using the `retryAfterSec` field in the 429 body.

## Shared conventions

### Branching

- `main` is protected. No direct commits.
- Feature branches: `<student>/<slice>-<short-desc>`
  - `haithem/platform-snapshot-retention`
  - `hamza/auth-lockout-policy`
  - `abderraouf/analytics-forecast-service`
  - `oussama/frontend-map-drill-down`
  - `imad/reports-excel-exporter`
- One PR per branch. Squash-merge into `main`.

### Commit messages

Conventional Commits, short scope first:

```
feat(backend/auth): add lockout after 5 failed attempts
fix(frontend/map): memo sensor markers so they don't flicker on snapshot
chore(shared): bump AQI band thresholds to EPA 2024
docs(architecture): document WS reconnect backoff
test(backend/alerts): cover threshold boundary at 55.4 ug/m3
```

### Code style

- TypeScript everywhere. `strict: true` is non-negotiable.
- Backend: no SQL in `routes/`, no framework types in `features/`, no Express in `db/`. See the layer table in [ARCHITECTURE.md](../ARCHITECTURE.md).
- Frontend: no cross-panel coupling — lift state to `App.tsx`, pass via props.
- Shared: must stay free of Node-only APIs (runs in the browser).
- Comments: write the **WHY** when non-obvious (incident, invariant, surprising decision). Don't write what the code already says.

### Definition of Done

A task is done when all of the following are true:

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (new logic has at least one unit test)
- [ ] `npm run dev` still boots end-to-end (simulator → API → dashboard)
- [ ] Traceability matrix in [docs/SWE496_REQUIREMENTS_TRACEABILITY.md](../docs/SWE496_REQUIREMENTS_TRACEABILITY.md) is updated if status changed
- [ ] New env vars are in the relevant `.env.example`
- [ ] PR description lists user-visible changes and the requirement ID(s)

### Review policy

- Every PR gets at least one review — ideally from the student whose slice is nearest. Cross-slice reviewers watch for:
  - Snapshot shape changes (Haithem reviews)
  - Auth + RBAC changes (Hamza reviews)
  - SQL + query plan changes (Abderraouf reviews)
  - App shell or render path changes (Oussama reviews)
  - Anything touching translations, a11y, or reports (Imad reviews)

### Communication

- Daily 15-min sync (async if remote) — each student says: *yesterday / today / blockers*.
- Design questions → open an issue with `[proposal]` prefix; 24h SLA for written feedback before merging.
- Contract changes to `shared/` require a short heads-up — it breaks everybody.
