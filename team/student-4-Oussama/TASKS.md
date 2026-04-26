# Student 4 — Oussama
## Role: Frontend · Realtime Shell, Map, KPIs

You own **everything the user sees first**: the app shell, the KPI strip, the Riyadh map, the nav and topbar, and the live realtime hook that pipes WebSocket snapshots into React state. Basically the "command center" feel.

### Summary

- Maintain the 3-column shell (nav / main / side rail) and its responsive behavior.
- Map: sensor markers, AQI heatmap, hotspot circles, drill-down, zoom/pan.
- KPI strip: 5 live KPIs + trend pill + wind compass.
- Realtime hook: WS subscribe, reconnect, snapshot state.

### Files you own

- [frontend/src/App.tsx](../../frontend/src/App.tsx) — shell composition + data wiring (shared with Imad; you own shell + map + topbar/nav, Imad owns the side rail panels)
- [frontend/src/hooks/useLiveTelemetry.ts](../../frontend/src/hooks/useLiveTelemetry.ts)
- [frontend/src/components/map/](../../frontend/src/components/map/) — whole folder (`RiyadhGoogleMap.tsx`, `AlertLayer.tsx`, `HeatmapLayer.tsx`)
- [frontend/index.html](../../frontend/index.html) — root document + fonts
- [frontend/src/index.css](../../frontend/src/index.css) — layout + shell tokens (Imad owns the polish + responsive/a11y rules inside it; coordinate)
- [frontend/src/api/client.ts](../../frontend/src/api/client.ts) — login + history fetch

### Requirements

- **FR-04** Real-time pollution map (UI)
- **FR-05** Zoom/pan regions
- **FR-06** Pollutant switching
- **FR-07** AQI by region
- **UC1** Real-time map
- **NFR-07** Desktop/tablet/mobile
- **§8 trend pill** (already implemented; keep it in sync with server-side trend from Abderraouf)

---

## Prioritized tasks

> ✅ **DONE — 2026-04-25.**
> Branch: `oussama/frontend-map-drill-down`.
> Files changed: [frontend/src/components/map/RiyadhGoogleMap.tsx](../../frontend/src/components/map/RiyadhGoogleMap.tsx), [frontend/src/App.tsx](../../frontend/src/App.tsx), [package-lock.json](../../package-lock.json).
> Tests: **27/27 green** (`npm run test --silent`), plus frontend type/lint green (`npm run typecheck -w @climence/dashboard --silent`, `npm run lint -w @climence/dashboard --silent`).
> Requirement IDs moved: **FR-05 (Partial → Implemented)**; **UC1** strengthened through viewport-aware live map drill-down behavior.
> Heads-up: hotspot circles already accept `radiusKm` and currently fallback to 500m until backend cluster payload lands.

### P0 — Proper map drill-down (FR-05)

**Files:** [frontend/src/components/map/RiyadhGoogleMap.tsx](../../frontend/src/components/map/RiyadhGoogleMap.tsx), [frontend/src/App.tsx](../../frontend/src/App.tsx)

**What to do:**
- Today clicking a sensor opens the drawer. Add:
  - Zoom presets: buttons in the map overlay for `City`, `Sector`, `Zone`. Clicking a hotspot fly-to at zoom 14.
  - Bounding-box filter: when the user pans/zooms, pass the visible bounds to the parent so the KPI strip can show "Viewing: N sensors in current bounds" instead of the full fleet.
- Replace the static `"Zoom 11.4"` label in the bottom-right panel with the actual live map zoom.
- When Abderraouf's hotspot-cluster endpoint lands, draw filled circles with real `radiusKm` instead of fixed 500m.

**Acceptance:**
- Map is usable for exploring — can zoom into Industrial A7, see the sensors, click one for diagnostics.
- KPI strip "Sensors Online" honors the current viewport when a bounds filter is active.

**Dependencies:** Abderraouf's hotspot cluster shape (P0).

---

> ✅ **DONE — 2026-04-25.**
> Branch: `oussama/frontend-map-drill-down`.
> Files changed: [frontend/src/components/map/RiyadhGoogleMap.tsx](../../frontend/src/components/map/RiyadhGoogleMap.tsx), [frontend/src/components/map/markerState.ts](../../frontend/src/components/map/markerState.ts), [frontend/src/App.tsx](../../frontend/src/App.tsx), [frontend/src/index.css](../../frontend/src/index.css), [frontend/test/markerState.test.ts](../../frontend/test/markerState.test.ts), [frontend/package.json](../../frontend/package.json).
> Tests: **29/29 green** (`npm run test --silent`), plus repo type/lint green (`npm run typecheck`, `npm run lint`), frontend build green (`npm run build -w @climence/dashboard`), and manual dev boot verified (`npm run dev`).
> Requirement IDs moved: none — **FR-04** remained Implemented; **UC1** notes were refreshed with state-aware live marker evidence.
> Heads-up: `INVESTIGATING_HAZARD` currently falls back to the default marker visual, so the next map slice only needs to extend `markerState.ts` if product wants a dedicated icon.

### P1 — Encode drone state on markers

**Files:** [frontend/src/components/map/RiyadhGoogleMap.tsx](../../frontend/src/components/map/RiyadhGoogleMap.tsx)

**What to do:**
- Today every marker looks the same. Use the `DroneState` from the snapshot to drive marker appearance:
  - `OFFLINE` → 35% opacity, no pulse, tooltip says "Offline since {server_timestamp}".
  - `LOW_BATTERY` → amber ring + battery icon overlay.
  - `GATHERING_DATA` → subtle scale pulse.
  - `EN_ROUTE` → default marker.
- Keep the AQI color as the fill via `--aqi-{band}`.

**Acceptance:**
- A drone going offline visibly changes on the map within one snapshot cycle.
- Screenshots can be diffed by QA against the spec visuals.

**Dependencies:** none.

---

> ✅ **DONE — 2026-04-25.**
> Branch: `oussama/frontend-map-drill-down`.
> Files changed: [frontend/src/App.tsx](../../frontend/src/App.tsx), [frontend/src/components/map/RiyadhGoogleMap.tsx](../../frontend/src/components/map/RiyadhGoogleMap.tsx), [frontend/src/components/map/HeatmapLayer.tsx](../../frontend/src/components/map/HeatmapLayer.tsx), [frontend/src/lib/mapMetrics.ts](../../frontend/src/lib/mapMetrics.ts), [frontend/test/mapMetrics.test.ts](../../frontend/test/mapMetrics.test.ts).
> Tests: **31/31 green** (`npm run test --silent`), plus repo type/lint green (`npm run typecheck`, `npm run lint`), frontend build green (`npm run build -w @climence/dashboard`), and manual dev boot verified (`npm run dev`).
> Requirement IDs moved: **FR-06 (Partial → Implemented)**; **UC1** strengthened through metric-aware heatmap, hotspot, and legend switching.
> Heads-up: non-PM2.5 hotspot circles currently fall back to sensor-derived ranking until backend pollutant-specific hotspot aggregates land.

### P2 — Pollutant switching that actually switches (FR-06)

**Files:** [frontend/src/App.tsx](../../frontend/src/App.tsx), [frontend/src/components/map/HeatmapLayer.tsx](../../frontend/src/components/map/HeatmapLayer.tsx)

**What to do:**
- The map pollutant pill switches the overlay visually today. Make it actually change the heatmap intensity metric:
  - Each pollutant (PM2.5, CO2, NO2, Temp, Humidity, Battery) has its own normalization scale.
  - Legend's ramp labels update to match the active pollutant.
  - Hotspot circles key off the same metric.
- Memoize the sensor projection so 25 drones don't re-render on every snapshot when nothing moved.

**Acceptance:**
- Switching from PM2.5 to CO2 visibly changes the map colors to a different pattern.
- React Profiler shows no wasted renders on inert snapshots.

**Dependencies:** none.

---

### P3 — Responsive shell + layout perf (NFR-07)

**Files:** [frontend/src/index.css](../../frontend/src/index.css), [frontend/src/App.tsx](../../frontend/src/App.tsx), [frontend/src/components/AuthScreen.tsx](../../frontend/src/components/AuthScreen.tsx), [frontend/src/components/Shell.tsx](../../frontend/src/components/Shell.tsx), [frontend/src/components/Dashboard.tsx](../../frontend/src/components/Dashboard.tsx), [frontend/src/hooks/useDashboardData.ts](../../frontend/src/hooks/useDashboardData.ts)

**What to do:**
- Coordinate with Imad — he owns the deep responsive rules and a11y. Your job is the **shell skeleton**:
  - ≤ 1280px: narrow side rail to 320px.
  - ≤ 1024px: hide left nav rail, show hamburger toggle in topbar.
  - ≤ 640px: side rail becomes a bottom-sheet pattern.
- Split `App.tsx` into `Shell.tsx` (layout) + `Dashboard.tsx` (data). It's grown past 1500 lines — extract the login screen into its own file (`components/AuthScreen.tsx`).

**Acceptance:**
- iPad viewport (1024×768) shows the map + side rail with no horizontal scrollbars.
- `App.tsx` shrinks to ≤ 300 lines and is purely composition.

**Dependencies:** none (Imad's polish can layer on).

> ✅**DONE** — 2026-04-25
>
> - Split App.tsx (1786 → 118 lines) into: `AuthScreen.tsx`, `Shell.tsx`, `Dashboard.tsx`, `useDashboardData.ts`.
> - ≤1280px: side rail narrows to 320px. ≤1024px: nav becomes slide-out drawer with hamburger + backdrop overlay. ≤640px: side rail → bottom-sheet with drag handle.
> - All breakpoints RTL-aware. iPad 1024×768: map + side rail visible, no horizontal scrollbars.
> - Typecheck ✅ · Lint ✅ · 23/23 tests ✅ · Build ✅ (840ms).

---

### P4 — KPI micro-interactions + trend-pill parity

**Files:** [frontend/src/App.tsx](../../frontend/src/App.tsx), [frontend/src/index.css](../../frontend/src/index.css)

**What to do:**
- Once Abderraouf ships the server-side trend endpoint, wire the City-wide trend pill to read from `snapshot.trend` (fallback to client-side `detectTrend` if the field is missing).
- Add subtle number tweens on KPI value changes (CSS transition on `color` is there; add an `opacity` fade-in when the number changes — 120ms).
- Wind compass already rotates — add a dotted "intended trajectory" arc that shows the projected direction over the next hour using Abderraouf's forecast.

**Acceptance:**
- Numbers don't flicker during rapid snapshots.
- Trend pill reflects server value when available.
- Wind compass tells a 1-hour story, not just a snapshot.

**Dependencies:** Abderraouf P1 (server trend), P3 (server forecast).

> **BLOCKED** — 2026-04-25
>
> Waiting on Abderraouf's server-side trend endpoint (P1) and forecast endpoint (P3).
> Client-side `detectTrend` and `computeForecast` already work as fallbacks in `useDashboardData.ts`.
> Once the server fields land in the snapshot shape, wiring is straightforward.

---

## Tips

- **Lift state to `App.tsx` / `Shell.tsx`.** Don't reach for Zustand / Redux — the tree is small.
- **Memoize the sensor projection.** That's the hottest loop on every snapshot.
- **Keep `index.css` tokenized.** New colors go to `:root` CSS variables, never hex inline in components.
- **Google Maps quirks:** `useMemo` your icon objects. Markers re-instantiate if you don't.
- Pattern to copy: the `usePolling` → `useLiveTelemetry` migration (in git history) is a good reference for swapping data sources without rewriting the tree.

## Definition of Done

See [team/OVERVIEW.md](../OVERVIEW.md). Additionally: manually test the golden path (login → watch a snapshot tick → click a sensor → open the drawer) after every change.
