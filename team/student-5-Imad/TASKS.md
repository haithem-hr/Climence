# Student 5 — Imad
## Role: Frontend · Reports, i18n, Panels, UX Polish

You own **the features around the map**: the side-rail panels (weather / forecast / sources / alerts / alert settings), the full report generation flow, Arabic localization, accessibility, and the cross-cutting visual polish. Multiple traceability items sit here: UC4 reports, UC-A5 schedule, NFR-08 full Arabic, NFR-07 mobile polish.

### Summary

- Report generation in all 3 formats (CSV / JSON / print-to-PDF) and schedule.
- Arabic translation coverage and RTL correctness.
- Side-rail panels (non-map parts of the dashboard).
- Accessibility (keyboard nav, ARIA, color contrast).
- Responsive polish below the shell skeleton.

### Files you own

- [frontend/src/components/ReportModal.tsx](../../frontend/src/components/ReportModal.tsx)
- [frontend/src/lib/reports.ts](../../frontend/src/lib/reports.ts)
- [frontend/src/lib/i18n.ts](../../frontend/src/lib/i18n.ts)
- [frontend/src/lib/analytics.ts](../../frontend/src/lib/analytics.ts) — client-side fallbacks for forecast/sources/trend (keep the fallback when the server field is missing)
- Side-rail panels inside [frontend/src/App.tsx](../../frontend/src/App.tsx): EventBanner, AlertSettings, Hotspots, Pollutants, Weather, Forecast, Sources, Feed — coordinate with Oussama to extract them into `frontend/src/components/panels/*.tsx` as they stabilize
- Responsive + a11y rules inside [frontend/src/index.css](../../frontend/src/index.css) (shell skeleton is Oussama's)
- [docs/SWE496_REQUIREMENTS_TRACEABILITY.md](../../docs/SWE496_REQUIREMENTS_TRACEABILITY.md) — keep it current when you deliver UI pieces

### Requirements

- **FR-11** Forecast UI
- **FR-12** Sources UI
- **FR-15** Generate reports
- **FR-16** Export PDF/Excel
- **FR-17** Schedule automated reports
- **NFR-07** Desktop/tablet/mobile
- **NFR-08** Arabic/English
- **NFR-09** Intuitive interface
- **UC4** Generate reports
- **UC-A5** Schedule report

---

## Prioritized tasks

> ✅ **DONE — 2026-05-13.** Shipped on branch `imad/reports-xlsx-export`. Files: [frontend/src/lib/reports.ts](../../frontend/src/lib/reports.ts) (added pure workbook builders plus browser `.xlsx` export for `Sensors`, `Alerts`, and `City Trend`), [frontend/src/components/ReportModal.tsx](../../frontend/src/components/ReportModal.tsx) (added the Excel workbook export card), [frontend/test/reports.test.ts](../../frontend/test/reports.test.ts) (2 workbook-focused unit tests), [frontend/package.json](../../frontend/package.json) (fixed the frontend test glob so dashboard tests run). 10/10 dashboard tests green; dashboard typecheck and lint green. Traceability: FR-16 evidence updated to cite the true `.xlsx` path while UC4 stays implemented. **Heads-up for the next maintainer:** the schedule format union is still `pdf/csv/json`; wire `xlsx` into scheduling when P2 lands. Original task description preserved below for reference.

### P0 — Real Excel (.xlsx) export (FR-16)

**Files:** [frontend/src/lib/reports.ts](../../frontend/src/lib/reports.ts), [frontend/src/components/ReportModal.tsx](../../frontend/src/components/ReportModal.tsx)

**What to do:**
- Current "Excel" output is a CSV. Add a true `.xlsx` export using a tiny library (e.g. `write-excel-file` — ~20KB).
- Structure as three sheets: `Sensors`, `Alerts`, `City Trend`.
- Add the new format card to the modal.
- Make sure exports work offline (after initial page load) — they already do today, keep it that way.

**Acceptance:**
- Excel file opens in Excel/Numbers with typed cells (numbers as numbers, dates as dates).
- Bundle size impact documented in the PR.

**Dependencies:** none.

---

### P1 — Full translation pass + locale switch (NFR-08)

**Files:** [frontend/src/lib/i18n.ts](../../frontend/src/lib/i18n.ts), every `.tsx` in [frontend/src/](../../frontend/src/)

**What to do:**
- Audit visible strings. Anything not going through `t(key)` today gets added to `DICT` and translated for both `en` and `ar`.
- Priorities, in order: login screen, validation errors, drawer (drone diagnostics), feed items, weather cell labels (temperature units etc.), report modal error states, hotspot trend suffixes ("+8%" should stay numeric — only the label translates).
- Add an ESLint rule that warns on bare string literals inside `<*>...</>` JSX — a practical way to catch regressions.
- Handle Arabic digits: expose a `formatNumber(value, locale)` helper; optionally display Eastern Arabic numerals when locale is `ar`.
- Verify RTL layout: the map panels at `left:16` need `right:16` in RTL — test both.

**Acceptance:**
- Screenshots EN vs AR are fully translated, including login.
- No English text visible when `dir="rtl"` except technical mono identifiers (UUIDs, coordinates) — those stay LTR.

**Dependencies:** none.

---

> ✅ **DONE — 2026-05-13.** Shipped on branch `imad/report-schedule-runner`. Files: [frontend/src/lib/schedule-runner.ts](../../frontend/src/lib/schedule-runner.ts) (due-schedule detection, advancement, countdown helpers, exporter dispatch), [frontend/src/components/ReportModal.tsx](../../frontend/src/components/ReportModal.tsx) (added `xlsx` scheduling and visible next-run countdown), [frontend/src/lib/reports.ts](../../frontend/src/lib/reports.ts) (extended `ScheduledReport['format']` to include `xlsx`), [frontend/src/App.tsx](../../frontend/src/App.tsx) (tab-local 5-minute runner mounted at the app level), [frontend/test/schedule-runner.test.ts](../../frontend/test/schedule-runner.test.ts) (2 scheduler unit tests). 12/12 dashboard tests green; dashboard typecheck and lint green. Traceability: FR-17 and UC-A5 evidence updated to cite the active tab-local runner while status remains Partial pending backend/server-side execution. **Heads-up for the next maintainer:** scheduled PDF runs still open the printable tab in the browser, so server-side execution remains the next backend-integrated phase. Original task description preserved below for reference.

### P2 — Schedule UI → server-side execution hook (FR-17)

**Files:** [frontend/src/components/ReportModal.tsx](../../frontend/src/components/ReportModal.tsx), new [frontend/src/lib/schedule-runner.ts](../../frontend/src/lib/schedule-runner.ts)

**What to do:**
- Today schedules live in localStorage but never fire. Two-step plan:
  1. **Tab-local runner (immediately useful):** a `setInterval` check every 5 minutes that compares `scheduled.nextRun <= now()` and triggers the export. Update `nextRun` to the next slot.
  2. **Server-side runner (coordinate with Haithem/Hamza):** when the team decides to own it server-side, move the schedule store to a `ReportSchedules` table and run it via a cron job in the API — the UI becomes a management console.
- Add a visible "next run" countdown in the modal.

**Acceptance:**
- Leaving the tab open overnight executes a daily schedule automatically.
- Schedule list survives page refresh (localStorage).

**Dependencies:** none for step 1; Haithem/Hamza for step 2.

---

### P3 — Accessibility pass (NFR-09)

**Files:** all of [frontend/src/](../../frontend/src/), [frontend/src/index.css](../../frontend/src/index.css)

**What to do:**
- Keyboard: every interactive element must be reachable and have a visible focus ring (currently missing on many buttons). Add `:focus-visible` styles.
- ARIA: `role`, `aria-label`, `aria-live` (for the banner), `aria-current` (nav active item).
- Color contrast: audit the trend pill + dim text on dark bg (`--ink-3` on `--bg-0`) — some combos are sub-WCAG-AA. Bump the problematic tokens.
- Screen reader: verify the KPI strip reads sensibly ("City AQI, now, 168, unhealthy, up 14 versus previous").
- Reduce motion: honor `prefers-reduced-motion` — disable the pulse + slide-up.

**Acceptance:**
- axe-core scan returns 0 serious/critical issues.
- Tab key navigates through the whole dashboard without a dead-end.

**Dependencies:** none.

---

### P4 — Responsive deep pass (NFR-07)

**Files:** [frontend/src/index.css](../../frontend/src/index.css)

**What to do:**
- After Oussama's shell skeleton is in, own the fine-grain:
  - Stack side-rail panels in a horizontal swipe carousel on ≤ 640px (or a collapsible accordion — your call).
  - Ensure modal (ReportModal) adjusts to narrow viewports with a full-height sheet pattern.
  - The map overlays shouldn't overlap the statusbar on short screens.
- Test on a 1366×768 laptop (the most common Windows resolution in the team's target environment) — the default today is tuned for 1440+.

**Acceptance:**
- On 1366×768 nothing is cut off.
- On a phone-sized viewport the side rail is usable (not just scaled down).

**Dependencies:** Oussama P3 (shell skeleton).

---

> ✅ **DONE — 2026-05-13.** Shipped on branch `imad/panels-side-rail-extraction`. Files: [frontend/src/components/Dashboard.tsx](../../frontend/src/components/Dashboard.tsx) (overview side rail now composes extracted panel files), [frontend/src/components/panels/EventBanner.tsx](../../frontend/src/components/panels/EventBanner.tsx), [frontend/src/components/panels/AlertSettingsPanel.tsx](../../frontend/src/components/panels/AlertSettingsPanel.tsx), [frontend/src/components/panels/HotspotsPanel.tsx](../../frontend/src/components/panels/HotspotsPanel.tsx), [frontend/src/components/panels/PollutantsPanel.tsx](../../frontend/src/components/panels/PollutantsPanel.tsx), [frontend/src/components/panels/WeatherPanel.tsx](../../frontend/src/components/panels/WeatherPanel.tsx), [frontend/src/components/panels/ForecastPanel.tsx](../../frontend/src/components/panels/ForecastPanel.tsx), [frontend/src/components/panels/SourcesPanel.tsx](../../frontend/src/components/panels/SourcesPanel.tsx), [frontend/src/components/panels/FeedPanel.tsx](../../frontend/src/components/panels/FeedPanel.tsx), [frontend/src/index.css](../../frontend/src/index.css) (new side-panel field/empty-state styles and row entry animation). 10/10 dashboard tests green; dashboard typecheck and lint green. Traceability: NFR-09 evidence expanded to cite the extracted panel architecture and alert-settings surface. **Heads-up for the next maintainer:** P1/P3 still need to finish translating and hardening the newly extracted panels, but the file ownership boundaries are now stable. Original task description preserved below for reference.

### P5 — Panel extraction + polish

**Files:** new `frontend/src/components/panels/*.tsx`, [frontend/src/App.tsx](../../frontend/src/App.tsx)

**What to do:**
- Extract inline side-rail panels from `App.tsx` into components (`EventBanner`, `AlertSettings`, `HotspotsPanel`, `PollutantsPanel`, `WeatherPanel`, `ForecastPanel`, `SourcesPanel`, `FeedPanel`).
- Coordinate with Oussama — he's splitting `App.tsx` too. Lane off: he takes shell/header/map/KPI, you take everything inside `<aside className="side">`.
- Add empty-state illustrations (or at least friendly copy) when a panel has no data.
- Micro-animations on list reorder for hotspots + feed (FLIP technique or CSS `view-transition-name` if we're feeling modern).

**Acceptance:**
- Each panel is its own file with a top-of-file header comment (see convention in [team/OVERVIEW.md](../OVERVIEW.md)).
- Hotspots panel visibly animates when ranks change.

**Dependencies:** Oussama P3.

---

## Tips

- **Always test Arabic.** It's not just direction — it changes word order, numerals, and breaks some flex assumptions. Toggle early and often.
- **Export payload is a pure function of `snapshot + derived`.** Keep it that way — no side effects in `lib/reports.ts`.
- **Bundle budget:** each `.xlsx`/`.pdf` library you add has a cost. Before adding one, check if a small custom implementation is cheaper.
- Pattern to copy: the existing `ReportModal` → it's already the right shape, just needs richer cards and the xlsx format.
- Font stack: Noto Kufi Arabic is already loaded; use it for Arabic text (CSS sets it automatically when `dir="rtl"`).

## Definition of Done

See [team/OVERVIEW.md](../OVERVIEW.md). Additionally: every UI change is tested in both `en` and `ar`, and all new text lives in the i18n dictionary (no bare string literals).
