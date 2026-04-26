# Student 2 — Haithem
## Role: Backend · Auth, Roles, Alerts

You own **who can do what** and **when to shout**. Every protected route enforces your middleware; every alert uses your configurable threshold. Two planned items in the traceability matrix are yours to push from Partial → Implemented: UC-A6 lockout policy (FR-02) and deeper module-level RBAC (FR-03).

### Summary

- Session lifecycle: login, token, logout, lockout, session expiry.
- Three-role RBAC: `administrator` / `analyst` / `viewer`, enforced at route + WebSocket.
- Alert lifecycle: threshold config, active alerts, webhooks (stretch).

### Files you own

- [backend/src/routes/auth.ts](../../backend/src/routes/auth.ts)
- [backend/src/routes/alerts.ts](../../backend/src/routes/alerts.ts)
- [backend/src/features/auth/](../../backend/src/features/auth/) — whole folder (`directory.ts`, `token.ts`, `passwords.ts`, etc.)
- [backend/src/features/alerts/](../../backend/src/features/alerts/) — whole folder (`config.ts`, validators, lifecycle)
- [backend/src/lib/auth.ts](../../backend/src/lib/auth.ts) — `requireAuth`, `requireRole`
- [shared/src/auth.ts](../../shared/src/auth.ts) — `UserRole`, `LoginRequest`, `LoginResponse`, `AuthUser`
- The auth path inside [backend/src/ws.ts](../../backend/src/ws.ts) (token extraction) — edit in coordination with Haithem

### Requirements

- **FR-02** Secure login with ministry credentials
- **FR-03** Role-based access
- **FR-13** Notify when thresholds exceeded
- **FR-14** User-configurable thresholds
- **NFR-05** Authentication required
- **NFR-06** Encryption in transit and at rest
- **UC-A3** Receive alerts
- **UC-A4** Set alert thresholds
- **UC-A6** Log in

---

## Prioritized tasks

> ✅ **DONE — 2026-04-25.** Shipped on branch `haithem/auth-lockout-policy`. Files: [backend/src/features/auth/lockout.ts](../../backend/src/features/auth/lockout.ts) (sliding 10-min window, 15-min lock, injectable clock), [backend/src/features/auth/lockout.test.ts](../../backend/src/features/auth/lockout.test.ts) (6 time-mocked unit tests, all green), [backend/src/routes/auth.ts](../../backend/src/routes/auth.ts) (wired `loginLockout` + added `POST /api/auth/logout`), [backend/src/lib/http.ts](../../backend/src/lib/http.ts) (`sendTooManyRequests` helper sets `Retry-After`), [shared/src/auth.ts](../../shared/src/auth.ts) (shared constants). Live curl verified: 4×401 → 429 with `Retry-After: 900`; admin login on a different account still 200. Traceability: FR-02 evidence updated, UC-A6 promoted Partial → Implemented. **Note for the team:** the lockout is per-process in-memory; a multi-node deployment will need to back this with Redis (interface already isolated in `lockout.ts`). Original task description preserved below for reference.

### P0 — Login lockout policy

**Files:** [backend/src/features/auth/directory.ts](../../backend/src/features/auth/directory.ts), [backend/src/routes/auth.ts](../../backend/src/routes/auth.ts)

**What to do:**
- Track failed login attempts per email in memory (`Map<email, {count, lockedUntil}>`). After 5 failures within 10 minutes, respond with 429 until the lock expires (15 minutes).
- Successful login resets the counter.
- Expose a `POST /api/auth/logout` endpoint that invalidates the session server-side if you've moved beyond pure JWT (see P2).

**Acceptance:**
- Six wrong passwords in a row → 429 `{ error: 'Account temporarily locked' }`.
- Correct password clears the counter.
- Unit test on the policy (time-mocked) in `features/auth/lockout.test.ts`.

**Dependencies:** none.

---

> ✅ **DONE — 2026-04-25.** Shipped on branch `haithem/backend-rbac-permissions`. Files: [backend/src/features/auth/permissions.ts](../../backend/src/features/auth/permissions.ts) (role-to-permission matrix), [backend/src/features/auth/permissions.test.ts](../../backend/src/features/auth/permissions.test.ts) (matrix coverage), [backend/src/routes/rbac.test.ts](../../backend/src/routes/rbac.test.ts) (auth + role guard coverage), [backend/src/routes/auth.ts](../../backend/src/routes/auth.ts) (`/api/auth/me` returns permissions), [backend/src/routes/alerts.ts](../../backend/src/routes/alerts.ts), [backend/src/routes/analytics.ts](../../backend/src/routes/analytics.ts), [backend/src/routes/telemetry.ts](../../backend/src/routes/telemetry.ts), [shared/src/auth.ts](../../shared/src/auth.ts), [simulator/src/FleetManager.ts](../../simulator/src/FleetManager.ts), [backend/package.json](../../backend/package.json). Root test suite: 35/35 green; typecheck, lint, and dev boot smoke all green. Traceability: FR-03 and NFR-05 promoted Partial → Implemented. **Note for the team:** telemetry ingest now requires an analyst/admin bearer token; the simulator sends its default analyst token automatically.

### P1 — Tighten RBAC beyond alert config

**Files:** [backend/src/lib/auth.ts](../../backend/src/lib/auth.ts), every file in [backend/src/routes/](../../backend/src/routes/)

**What to do:**
- Audit every route. Today only `PUT /alerts/config` requires administrator. Decide + document the minimum role for each route (most are `viewer`, a few will be `analyst`, and admin-only writes).
- Extend `requireRole` to accept multiple roles: `requireRole(UserRole.ANALYST, UserRole.ADMINISTRATOR)`.
- Build a permissions matrix in code: `backend/src/features/auth/permissions.ts` — `canManageAlerts`, `canExportReports`, `canManageSensors`, etc.
- Mirror the permissions matrix in the frontend by exposing it on `/api/auth/me` for Oussama/Imad to render role-appropriate UI.

**Acceptance:**
- Viewer token cannot POST `/alerts/config` or any write endpoint (403).
- Analyst token can acknowledge alerts (P3) but not change thresholds.
- `/api/auth/me` returns `{ user, permissions: {...} }`.

**Dependencies:** Hamza's WS auth hook (already in place — just don't break it).

---

### P2 — Alert lifecycle (not just a filtered SELECT)

**Files:** [backend/src/db/schema.sql](../../backend/src/db/schema.sql), [backend/src/db/queries.ts](../../backend/src/db/queries.ts), [backend/src/routes/alerts.ts](../../backend/src/routes/alerts.ts)

**What to do:**
- Add an `Alerts` table with `id, uuid, opened_at, closed_at, status ('open'|'ack'|'resolved'), acknowledged_by, pm25_peak, note`.
- On every ingest, feature code opens new alerts for drones crossing the threshold and closes alerts for drones that dropped below it for 3 consecutive ticks.
- New endpoints:
  - `POST /api/alerts/:id/ack` (analyst+) — sets `status='ack'`, records user.
  - `POST /api/alerts/:id/resolve` (analyst+) — sets `status='resolved'`, `closed_at`.
  - `GET /api/alerts/history?since=...` — historical alerts.
- Rebroadcast a snapshot when lifecycle changes so dashboards update.

**Acceptance:**
- Snapshot now includes `openAlerts: Alert[]` alongside the raw threshold-filtered list.
- Dashboard's banner/feed (Imad's responsibility) reflects the new shape.
- Migration-safe: existing DBs upgrade cleanly (add column defaults).

**Dependencies:** Haithem (coordinate on snapshot shape + schema migration plan).

---

### P3 — Secrets hygiene + password storage

**Files:** [backend/src/features/auth/directory.ts](../../backend/src/features/auth/directory.ts), [backend/src/features/auth/passwords.ts](../../backend/src/features/auth/passwords.ts) (new), [backend/.env.example](../../backend/.env.example)

**What to do:**
- Current user store hashes/compares passwords in a specific way — move to Argon2id (package `argon2`) with per-user salt. Keep the dev users but seed their hashes at boot if missing.
- Fail fast if `CLIMENCE_JWT_SECRET` is the placeholder in production (read `NODE_ENV`). Dev retains a deterministic default.
- Load users from a JSON seed file mounted from `data/users.json` when present, otherwise fall back to the hardcoded demo users. Gitignore the seed file.

**Acceptance:**
- Bcrypt-free (if that's what's there) — only Argon2 in the tree.
- `NODE_ENV=production` + placeholder secret → process refuses to start with a clear error.

**Dependencies:** none.

---

### P4 — Webhook on alert open (stretch)

**Files:** [backend/src/features/alerts/webhook.ts](../../backend/src/features/alerts/webhook.ts) (new), [backend/src/routes/alerts.ts](../../backend/src/routes/alerts.ts)

**What to do:**
- Environment-configurable webhook URL (`CLIMENCE_ALERT_WEBHOOK_URL`). On alert open/ack/resolve, POST a minimal JSON.
- Retry 3× with exponential backoff. Log drops after the last failure.
- Admin-only UI endpoint to toggle the integration (pairs with Imad's integrations panel).

**Acceptance:**
- Webhook fires within 1s of alert open.
- If the endpoint is down, the API itself is unaffected.

**Dependencies:** P2.

---

## Tips

- **Always require + verify inside `lib/auth.ts`** — never re-implement JWT verification in a route.
- **Audit log** for any write: who did it, when, what changed. Drop into a dedicated table later.
- **Validate in `features/alerts/config.ts`, not in the route.** Routes stay thin.
- Pattern to copy: the existing `validateAlertThresholdInput` + route pattern for PUT `/alerts/config`.
- Watch for CORS: you'll be touching auth headers; if you add custom headers, update the CORS config in [backend/src/index.ts](../../backend/src/index.ts).

## Definition of Done

See [team/OVERVIEW.md](../OVERVIEW.md). Additionally: every protected endpoint has an integration test that covers (1) no token → 401, (2) wrong role → 403, (3) right role → 200.
