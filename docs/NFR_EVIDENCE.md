# Non-Functional Requirements (NFR) — Implementation & Evidence

This document maps the SWE496 NFR statements to concrete implementation evidence in this repository (code paths + configuration + how to verify).

> Scope note: some NFRs (uptime %, seamless scaling) ultimately depend on deployment and operations. This repo provides the **mechanisms and evidence hooks** (health checks, containers, backups, TLS termination, logs) typically required to satisfy them.

## A. Performance

### Requirement
**The user shall receive updated pollution and air quality data within 5 seconds of availability.**

### Implementation evidence
- Simulator publish cadence:
  - `shared/src/constants.ts` → `TELEMETRY_INTERVAL_MS = 5000`
  - `simulator/src/index.ts` → `FleetManager.startSimulation(TELEMETRY_INTERVAL_MS)`
  - `simulator/src/FleetManager.ts` publishes MQTT payloads on every tick.
- Ingest → broadcast path is immediate:
  - `backend/src/mqtt.ts` ingests and calls `broadcastSnapshot()`
  - `backend/src/ws.ts` broadcasts the latest `computeSnapshot()`.

### How to verify
- With API + simulator running, watch the dashboard sensor timestamps update at ~5s.
- (Optional) Check logs: mqtt ingest + ws broadcast should appear repeatedly.

## B. Scalability

### Requirement
**The system shall continue to provide seamless access as the number of users and data sources increases.**

### Implementation evidence
- Split services, container-friendly:
  - `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`
- WebSocket broadcast uses a single payload per snapshot and fan-out to connected clients:
  - `backend/src/ws.ts` loops `wss.clients`.

### How to verify
- Open multiple browser tabs; confirm they all receive snapshots.
- For higher load, deploy multiple dashboard instances without changing the API.

## C. Reliability & Availability

### Requirement
- **The system shall be available to the user 24/7 with 99.5% uptime.**
- **The system shall ensure users’ data is protected with automatic backups and recovery mechanisms.**

### Implementation evidence
- Health endpoint (for monitors / orchestration):
  - `backend/src/routes/health.ts` → `GET /api/health`
- Container healthcheck:
  - `docker-compose.yml` → `api.healthcheck` hits the health endpoint.
- Automatic SQLite backups:
  - `backend/src/features/backup/scheduler.ts`
  - `backend/src/features/backup/backup.ts`
  - Wired in `backend/src/index.ts` → `startBackupScheduler()`
  - Controlled via env:
    - `CLIMENCE_BACKUP_ENABLED=1`
    - `CLIMENCE_BACKUP_INTERVAL_MINUTES`
    - `CLIMENCE_BACKUP_DIR`

### Recovery mechanism
- Restore is a straightforward file restore of the latest backup:
  - replace `data/telemetry.db` with a backup file from `data/backups/`.

### How to verify
- `GET /api/health` returns HTTP 200 when DB is accessible.
- Confirm periodic backup files appear under `data/backups/`.

## D. Security

### Requirement
- **The user shall authenticate before accessing system features.**
- **The system shall encrypt sensitive user data both at rest and in transit.**

### Authentication evidence
- Route guards:
  - `backend/src/lib/auth.ts` (`requireAuth`, `requireRole`)
  - Protected routes: e.g. `backend/src/routes/analytics.ts`
- WebSocket auth:
  - `backend/src/ws.ts` validates token (bypass only if `CLIMENCE_AUTH_BYPASS=1`).

### Encryption in transit (HTTPS/WSS)
- TLS termination via nginx reverse proxy:
  - `infra/nginx/nginx.conf` (HTTPS + WSS upgrade)
  - `infra/nginx/Dockerfile`
  - `docker-compose.yml` service `proxy` exposes ports `80` and `443`
- Dashboard uses same-origin HTTPS base:
  - `docker-compose.yml` sets `VITE_CLIMENCE_API_URL=https://localhost`

### Encryption at rest (pragmatic)
- Data persistence is SQLite (`data/telemetry.db`).
- Backups are stored under `data/backups/`.
- For stronger at-rest encryption, mount an encrypted volume or use OS/disk encryption (deployment responsibility).

### How to verify
- In the browser, open **https://localhost**.
- WebSocket should be `wss://localhost/ws/telemetry?...`.

## E. Usability

### Requirement
- **Desktop, tablet, mobile**
- **Switch between Arabic and English**
- **Simple and intuitive interface**

### Evidence
- Single web dashboard (responsive layout & modern UI): `frontend/`
- Arabic/English + RTL:
  - `frontend/src/lib/i18n.ts`
  - `frontend/src/App.tsx` (dir/lang switch)

### How to verify
- Resize viewport and confirm layout adapts.
- Toggle RTL/Locale and confirm UI strings change.

## F. Maintainability

### Requirement
- **Administrators can monitor logs and errors**
- **Allow updates without disrupting user experience**

### Evidence
- Structured logs:
  - `backend/src/lib/logger.ts`
  - Used in `backend/src/mqtt.ts`, `backend/src/ws.ts`, `backend/src/features/analytics/openMeteo.ts`, `backend/src/index.ts`
- Containerized deployment supports rolling upgrade strategies (deployment responsibility):
  - `docker-compose.yml` + Dockerfiles provide an upgrade baseline.

## G. Portability

### Requirement
- **Major browsers** (Chrome/Edge/Safari/Firefox)
- **Cloud + on-prem deployment**

### Evidence
- Standard web stack (Vite + React): `frontend/`
- Containers:
  - `backend/Dockerfile`, `frontend/Dockerfile`, `infra/nginx/Dockerfile`
  - `docker-compose.yml`

### How to verify
- Open https://localhost on different browsers.
- Deploy the same compose stack on any docker-capable host.

---

## 🔧 Running the HTTPS stack (quickstart)

1) Generate a self-signed cert (demo): see `infra/certs/README.md`.
2) Start:
  - `docker compose up --build`
3) Open:
  - Dashboard: **https://localhost**
  - API health: **https://localhost/api/health**
  - WebSocket path: **wss://localhost/ws/telemetry**
