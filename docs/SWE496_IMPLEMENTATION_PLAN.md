# SWE496 Implementation Plan (Part-II Execution)

This plan translates the Part-I report into iterative engineering delivery.

## Delivery Principles

- Keep architecture modular and testable by package boundaries.
- Ship vertical slices that close full use-case loops.
- Attach each slice to FR/NFR/UC IDs and automated checks.

## Phase Roadmap

| Phase | Requirements Focus | Status | Target Outcome |
| --- | --- | --- | --- |
| P1 | FR-13, FR-14, UC-A3, UC-A4 | Completed | Configurable alert thresholds with live propagation |
| P2 | FR-02, FR-03, UC-A6, NFR-05 | Partial | Authentication + role-based access control |
| P3 | FR-08, UC-A1 | Planned | Complete filtering by pollutant/time/location |
| P4 | FR-09, FR-11, UC2, UC3 | Planned | Real historical analytics + forecast service integration |
| P5 | FR-15, FR-16, FR-17, UC4, UC-A5 | Planned | Reporting, export, and scheduling |
| P6 | NFR-01..NFR-13 hardening | Planned | Performance, security, reliability, deployment readiness |

## Completed Slice (P1)

Implemented:

- Persistent alert config storage in SQLite (`AlertConfig` table).
- `GET /api/alerts/config` and `PUT /api/alerts/config`.
- Active alerts now evaluate against configured threshold.
- WebSocket snapshot includes `alertThresholdPm25`.
- Dashboard alert settings panel to update threshold at runtime.
- Validation tests for alert-threshold input.

Primary files:

- `backend/src/db/schema.sql`
- `backend/src/db/queries.ts`
- `backend/src/routes/alerts.ts`
- `backend/src/features/alerts/config.ts`
- `backend/src/features/alerts/config.test.ts`
- `frontend/src/api/client.ts`
- `frontend/src/hooks/useLiveTelemetry.ts`
- `frontend/src/App.tsx`

## Next Slice (P2) Definition

Scope:

- Login endpoint and session/JWT handling.
- Role model (`administrator`, `analyst`, `viewer`) in shared contracts.
- Route guards and UI capability gating.

Done criteria:

- Unauthorized requests rejected.
- Role-restricted endpoints return `403` for invalid roles.
- Dashboard renders role-appropriate controls.
- Unit tests for auth/authorization policies.

## Completed Slice (P2 Partial)

Implemented:

- `POST /api/auth/login` and `GET /api/auth/me`.
- Signed token issuance and verification (HMAC token module).
- Protected user-facing API routes and WebSocket channel.
- Dashboard login screen + persisted session storage.
- Role-based gating:
  - Admin-only alert threshold updates.
  - Read-only message for non-admin roles.
- Unit tests for token and login validation.

Primary files:

- `shared/src/auth.ts`
- `backend/src/routes/auth.ts`
- `backend/src/lib/auth.ts`
- `backend/src/features/auth/token.ts`
- `backend/src/features/auth/validation.ts`
- `backend/src/features/auth/token.test.ts`
- `backend/src/features/auth/validation.test.ts`
- `backend/src/ws.ts`
- `frontend/src/lib/auth-session.ts`
- `frontend/src/api/client.ts`
- `frontend/src/hooks/useLiveTelemetry.ts`
- `frontend/src/App.tsx`

## Test Strategy per Slice

- Unit tests for feature validation and policy logic.
- Integration tests for critical routes (auth, alerts, reports).
- UI-level checks for configuration and guard behavior.
- Root quality gate before merge: `npm run check`.
