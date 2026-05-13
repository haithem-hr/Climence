# SWE496 Requirements Traceability

Status scale:

- `Implemented`: exists in codebase and wired end-to-end.
- `Partial`: partly implemented or mocked.
- `Planned`: not implemented yet.

## Functional Requirements

| ID | Requirement | Source | Status | Current Evidence |
| --- | --- | --- | --- | --- |
| FR-01 | Collect pollution data from IoT, drones, external APIs | 6.1.A | Partial | `simulator/src/DroneDevice.ts`, `simulator/src/FleetManager.ts`, `backend/src/routes/telemetry.ts` |
| FR-02 | Secure login with ministry credentials | 6.1.B | Implemented | `backend/src/routes/auth.ts`, `frontend/src/App.tsx` login flow, `backend/src/features/auth/lockout.ts` (5 fails / 10 min → 15 min lock per UC-A6) |
| FR-03 | Role-based access (admin/analyst/viewer) | 6.1.B | Implemented | `backend/src/features/auth/permissions.ts` defines role permissions; `backend/src/routes/auth.ts` exposes them on `/api/auth/me`; `backend/src/routes/alerts.ts`, `backend/src/routes/analytics.ts`, and `backend/src/routes/telemetry.ts` enforce explicit route roles; `backend/src/routes/rbac.test.ts` covers viewer/analyst/admin behavior |
| FR-04 | Real-time pollution map | 6.1.C | Implemented | `frontend/src/components/map/RiyadhGoogleMap.tsx` |
| FR-05 | Zoom/pan between regions/cities/zones | 6.1.C | Partial | Google map zoom/pan implemented; region flow incomplete |
| FR-06 | Pollutant switching (CO2/NO2/PM2.5/O3...) | 6.1.C | Partial | UI switching in `frontend/src/App.tsx` |
| FR-03 | Role-based access (admin/analyst/viewer) | 6.1.B | Partial | Auth roles enforced for protected APIs and admin alert settings; broader module-level RBAC still expanding |
| FR-04 | Real-time pollution map | 6.1.C | Implemented | `frontend/src/components/map/RiyadhGoogleMap.tsx` (Leaflet map, state-aware markers, offline timestamp tooltips), `frontend/src/components/map/markerState.ts` (AQI-fill marker state mapping), `frontend/src/components/panels/LiveMapView.tsx` (clustered live map operations tab, playback scrubber, filter chips, saved view presets), `frontend/src/lib/liveMap.ts`, `frontend/test/markerState.test.ts`, `frontend/test/liveMap.test.ts` |
| FR-05 | Zoom/pan between regions/cities/zones | 6.1.C | Implemented | `frontend/src/components/map/RiyadhGoogleMap.tsx` (city/sector/zone presets, fly-to, live viewport/zoom callbacks), `frontend/src/App.tsx` (bounds-aware KPI/viewing panels + hotspot fly-to wiring) |
| FR-06 | Pollutant switching (CO2/NO2/PM2.5/O3...) | 6.1.C | Implemented | `frontend/src/App.tsx` (active pollutant drives map overlay, hotspot severity, and legend labels), `frontend/src/components/map/RiyadhGoogleMap.tsx` (metric-aware heatmap + hotspots), `frontend/src/components/map/HeatmapLayer.tsx` (generic Leaflet heat layer), `frontend/src/lib/mapMetrics.ts` (per-pollutant normalization scales), `frontend/test/mapMetrics.test.ts` |
| FR-07 | Display AQI by region | 6.1.C | Partial | Sensor/city AQI implemented; regional aggregation incomplete |
| FR-08 | Filter data by time, pollutant, location | 6.1.C + UC-A1 | Partial | Time and pollutant filters implemented; location filter incomplete |
| FR-09 | Historical trends (daily/weekly/monthly) | 6.1.D + UC2 | Partial | Trend chart exists; full historical granularity incomplete |
| FR-10 | Detect and highlight hotspots | 6.1.D + UC-A2 | Implemented | `backend/src/db/queries.ts`, map hotspot overlays |
| FR-11 | Predictive analysis and forecast display | 6.1.D + UC3 | Partial | Forecast now computed live from city trend via linear extrapolation + mean reversion in `frontend/src/lib/analytics.ts`; production ML backend still pending |
| FR-12 | Highlight possible future pollution sources | 6.1.D | Partial | `computeSourceAttribution` in `frontend/src/lib/analytics.ts` drives the Sources panel from live telemetry (traffic/industry/dust/other heuristic); ML attribution still pending |
| FR-13 | Notify when thresholds are exceeded | 6.1.E + UC-A3 | Implemented | `backend/src/routes/alerts.ts`, dashboard feed/banner |
| FR-14 | User-configurable alert thresholds | 6.1.E + UC-A4 | Implemented | API config endpoints + dashboard settings panel |
| FR-15 | Generate structured reports | 6.1.F + UC4 | Implemented | `frontend/src/lib/reports.ts` + `ReportModal` produce CSV/JSON/printable-PDF snapshots of the live state |
| FR-16 | Export reports in PDF/Excel | 6.1.F + UC4 | Implemented | `frontend/src/lib/reports.ts` now exports printable PDF plus a true `.xlsx` workbook (`Sensors`, `Alerts`, `City Trend`) via `exportSnapshotXlsx()` / `buildSnapshotWorkbook()`; `frontend/src/components/ReportModal.tsx` exposes the Excel card; `frontend/test/reports.test.ts` covers sheet shape and typed number/date cells |
| FR-17 | Schedule automated reports | 6.1.F + UC-A5 | Partial | `frontend/src/lib/schedule-runner.ts` now detects due schedules, advances `nextRun`, formats countdown state, and dispatches exports; `frontend/src/App.tsx` runs the tab-local 5-minute schedule loop; `frontend/src/components/ReportModal.tsx` manages schedules and shows next-run countdowns; `frontend/test/schedule-runner.test.ts` covers due-run advancement and countdown behavior |

## Non-Functional Requirements

| ID | Requirement | Source | Status | Current Evidence |
| --- | --- | --- | --- | --- |
| NFR-01 | Update data to user within 5 seconds | 6.2.A | Partial | 5s simulator tick; end-to-end SLO not formally measured |
| NFR-02 | Scale with users/data growth | 6.2.B | Partial | Monorepo layering supports growth; no load validation yet |
| NFR-03 | 24/7 availability, 99.5% uptime | 6.2.C | Planned | No deployment SLO/monitoring stack yet |
| NFR-04 | Backups and recovery | 6.2.C | Planned | No backup automation yet |
| NFR-05 | Authentication required | 6.2.D | Implemented | `backend/src/lib/auth.ts` guards protected routes; `backend/src/routes/telemetry.ts` now requires analyst/admin auth for ingestion; `backend/src/ws.ts` requires WebSocket auth; `simulator/src/FleetManager.ts` sends bearer auth for telemetry POSTs |
| NFR-06 | Encrypt data at rest/in transit | 6.2.D | Planned | TLS/encryption controls pending |
| NFR-07 | Desktop/tablet/mobile support | 6.2.E | Implemented | Shell extracted + responsive breakpoints at ≤1280/≤1024/≤640px. Hamburger nav, bottom-sheet side rail, RTL-aware. iPad 1024×768 verified. |
| NFR-08 | Arabic/English interface | 6.2.E | Partial | Nav/KPIs/panels/banner/report modal translate via `frontend/src/lib/i18n.ts`; deeper labels and validation messages still English |
| NFR-09 | Intuitive interface | 6.2.E | Partial | Redesigned dashboard complete; overview side rail now extracted into dedicated panel files (`frontend/src/components/panels/EventBanner.tsx`, `AlertSettingsPanel.tsx`, `HotspotsPanel.tsx`, `PollutantsPanel.tsx`, `WeatherPanel.tsx`, `ForecastPanel.tsx`, `SourcesPanel.tsx`, `FeedPanel.tsx`) with shared empty-state/interaction styling in `frontend/src/index.css`; usability validation still pending |
| NFR-10 | Admin logging/error monitoring | 6.2.F | Partial | API logs/errors exist; centralized observability pending |
| NFR-11 | Non-disruptive updates | 6.2.F | Partial | Not formally automated yet |
| NFR-12 | Major browser support | 6.2.G | Partial | React/Vite compatible; cross-browser QA pending |
| NFR-13 | Cloud and on-prem deployment support | 6.2.G | Planned | Architecture defined; deployment pipeline pending |

## Use-Case Coverage

| Use Case | Status | Notes |
| --- | --- | --- |
| UC1 Real-Time Map | Partial | Drill-down, viewport-aware counts, drone-state marker cues, and pollutant-driven heat/hotspot switching are implemented; fuller regional aggregation is still pending |
| UC2 Historical Trends | Partial | Core charting implemented, richer data controls pending |
| UC3 Forecast | Partial | UI present, production forecasting pipeline pending |
| UC4 Generate Reports | Implemented | Reports modal (topbar + left nav) exports CSV / JSON / print-to-PDF of live snapshot |
| UC-A1 Filter Pollution Data | Partial | Time/pollutant done, location/advanced filtering pending |
| UC-A2 Identify Hotspots | Implemented | Active in API + map rendering |
| UC-A3 Receive Alerts | Implemented | Active threshold-based alerts and feed |
| UC-A4 Set Alert Thresholds | Implemented | Completed in this iteration |
| UC-A5 Schedule Report | Partial | Reports modal stores schedules locally and now executes them while the dashboard tab remains open; backend persistence/cron execution is still pending |
| UC-A6 Log In | Implemented | Login/session/token flow + lockout policy (5 failures in 10 min → 15 min lock with `Retry-After` header), `POST /api/auth/logout`, and `/api/auth/me` permission payload |

## This Iteration (2026-04-24)

Delivered requirement slice:

- FR-14 / UC-A4: configurable PM2.5 threshold.
- FR-13 / UC-A3 hardening: active alerts now use configurable threshold.
- Snapshot propagation: threshold is now part of live WebSocket snapshot.
- FR-02 / UC-A6: authentication endpoint + dashboard login session.
- FR-03: role model (`administrator`, `analyst`, `viewer`) with permission checks.

## Iteration (2026-04-25)

Delivered requirement slice:

- FR-15 / FR-16 / UC4: report generation and PDF/CSV/JSON export via the Reports modal.
- FR-17 / UC-A5: client-side scheduled report configuration (localStorage).
- FR-11: live forecast computed from `cityTrend` via linear-trend extrapolation + mean reversion.
- FR-12: live source attribution heuristic drives the Sources panel from telemetry instead of static percentages.
- Spec §8 Trend detection: worsening/improving/stable classification is shown as a pill in the City Trend panel.
- NFR-08: Arabic translations for nav, KPIs, side panels, banner, and report modal.
- Design polish: live drift vector in wind compass, trend pill animation, modal micro-interactions, smoother KPI/sources/pollutant transitions.

## Iteration (2026-04-25 — Haithem · Auth slice)

Delivered requirement slice:

- FR-02 / UC-A6: login lockout policy — `backend/src/features/auth/lockout.ts` (sliding 10-min window, 15-min lock after 5 failures, 429 response with `Retry-After` header). Six unit tests in `lockout.test.ts` cover threshold, reset-on-success, window expiry, lock expiry, and email-normalization paths.
- UC-A6: `POST /api/auth/logout` endpoint added (204; placeholder for future server-side token revocation).
- Shared lockout constants exposed in `shared/src/auth.ts` so the frontend can mirror countdown messaging.

## Iteration (2026-04-25 — Hamza · Simulator hazard loop)

Delivered requirement slice:

- FR-01 realism hardening: restored hazard-driven swarm behavior in the simulator (`FleetManager` polls `/api/alerts/active`, clusters hazards, dispatches up to 3 nearest drones).
- FR-01 data channel hardening: added `INVESTIGATING_HAZARD` state to shared telemetry contract and expanded deterministic environment map to 5 hotspots.
- NFR-01 partial hardening: added simulator tests for investigation transition and hotspot pollution burn-down (`simulator/src/device/DroneDevice.test.ts`).

## Iteration (2026-04-25 — Haithem · RBAC slice)

Delivered requirement slice:

- FR-03: module-level RBAC now has a shared `AuthPermissions` contract, backend permission matrix, `/api/auth/me` permission payload, and explicit role guards across alerts, analytics, and telemetry routes.
- NFR-05: telemetry ingestion now requires an authenticated analyst/admin bearer token, and the simulator attaches its default analyst token when posting fleet telemetry.
- UC-A6 hardening: `/api/auth/me` now returns `{ user, permissions }` so the frontend can render role-appropriate controls without duplicating backend policy.
## Iteration (2026-04-25 — Oussama · map drill-down)

Delivered requirement slice:

- FR-05: implemented map drill-down controls (`City` / `Sector` / `Zone`), hotspot fly-to at zoom 14, and live zoom display wiring (`frontend/src/components/map/RiyadhGoogleMap.tsx`, `frontend/src/App.tsx`).
- UC1: strengthened real-time map exploration by propagating map bounds to the shell and applying viewport-aware sensor counts in KPI and map viewing panels (`frontend/src/App.tsx`).
- FR-10 UI compatibility hardening: hotspot circles now consume `radiusKm` when present with safe fallback radius to preserve rendering across backend payload versions (`frontend/src/components/map/RiyadhGoogleMap.tsx`, `frontend/src/App.tsx`).

## Iteration (2026-04-25 — Oussama · drone-state markers)

Delivered requirement slice:

- FR-04: encoded `OFFLINE`, `LOW_BATTERY`, `GATHERING_DATA`, and `EN_ROUTE` marker cues in the Leaflet map while preserving AQI band fill (`frontend/src/components/map/RiyadhGoogleMap.tsx`, `frontend/src/components/map/markerState.ts`, `frontend/src/index.css`).
- UC1: strengthened live map diagnostics with offline timestamp tooltips/popup labels and added frontend unit coverage for the marker-state mapping (`frontend/src/components/map/RiyadhGoogleMap.tsx`, `frontend/test/markerState.test.ts`).

## Iteration (2026-04-25 — Oussama · pollutant map switching)

Delivered requirement slice:

- FR-06: implemented real pollutant-driven map switching so the active metric now controls heatmap intensity, hotspot severity, and legend labels across PM2.5, CO2, NO2, temperature, humidity, and battery (`frontend/src/App.tsx`, `frontend/src/components/map/RiyadhGoogleMap.tsx`, `frontend/src/components/map/HeatmapLayer.tsx`, `frontend/src/lib/mapMetrics.ts`).
- UC1: strengthened live map exploration by stabilizing sensor projection on inert snapshots and adding frontend unit coverage for the per-metric normalization/banding rules (`frontend/src/App.tsx`, `frontend/test/mapMetrics.test.ts`).

## Iteration (2026-05-13 — Imad · reports-xlsx-export)

Delivered requirement slice:

- FR-16 / UC4: replaced the faux Excel path with a true browser-generated `.xlsx` workbook in `frontend/src/lib/reports.ts`, exposed it in `frontend/src/components/ReportModal.tsx`, and added workbook unit coverage in `frontend/test/reports.test.ts`.

## Iteration (2026-05-13 — Imad · panels-side-rail-extraction)

Delivered requirement slice:

- NFR-09 partial hardening: extracted the overview side rail from `frontend/src/components/Dashboard.tsx` into dedicated panel files under `frontend/src/components/panels/` and added shared panel field/empty-state/row-animation styling in `frontend/src/index.css`.

## Iteration (2026-05-13 — Imad · report-schedule-runner)

Delivered requirement slice:

- FR-17 / UC-A5 partial hardening: added the tab-local schedule runner in `frontend/src/lib/schedule-runner.ts`, mounted app-level execution in `frontend/src/App.tsx`, exposed next-run countdowns in `frontend/src/components/ReportModal.tsx`, and added scheduler unit coverage in `frontend/test/schedule-runner.test.ts`.
