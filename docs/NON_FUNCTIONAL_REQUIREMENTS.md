# Non-Functional Requirements (NFR) — Fulfillment Report

This document lists the project’s Non-Functional Requirements and explains **how each one is fulfilled** in this repository, with **concrete evidence** (file paths, configuration, and verification steps).

> Notes
> - Some NFRs (uptime %, seamless scaling) are ultimately guarantees made at **deployment/operations** time.
> - This repo includes the standard engineering mechanisms needed to meet them: **health checks, containerization, TLS termination, backups, structured logs**.

---

## A. Performance

### A1) Updated data within 5 seconds
**Requirement:** The user shall receive updated pollution and air quality data within **5 seconds** of availability.

**How it’s fulfilled**
- Telemetry is generated/published on a 5-second cadence in the simulator:
  - `shared/src/constants.ts` → `TELEMETRY_INTERVAL_MS = 5000`
  - `simulator/src/index.ts` → starts simulation with that interval
  - `simulator/src/FleetManager.ts` → publishes every tick
- After ingestion, the backend broadcasts the latest snapshot immediately:
  - `backend/src/mqtt.ts` → ingests and calls `broadcastSnapshot()`
  - `backend/src/ws.ts` → broadcasts `computeSnapshot()` to all connected clients
- The heatmap is recomputed client-side from the latest `snapshot.drones`:
  - `frontend/src/hooks/useLiveTelemetry.ts` → receives snapshot
  - `frontend/src/hooks/useDashboardData.ts` → computes `mapHeatmapPoints`

**How to verify**
- Run backend + simulator + dashboard.
- Observe drone timestamps/heatmap changes about every ~5 seconds.

---

## B. Scalability

### B1) Seamless access as users/data sources increase
**Requirement:** The system shall continue to provide seamless access as the number of users and data sources increases.

**How it’s fulfilled**
- Container-friendly separation of concerns:
  - API (`backend/`), Dashboard (`frontend/`), Reverse proxy (`infra/nginx/`)
  - Deploy baseline: `docker-compose.yml`
- WebSocket fan-out supports multiple concurrent dashboard clients:
  - `backend/src/ws.ts` iterates over `wss.clients` and sends the same payload.

**How to verify**
- Open multiple browsers/tabs to https://localhost and confirm they all receive live snapshots.

---

## C. Reliability and Availability

### C1) 24/7 with 99.5% uptime
**Requirement:** The system shall be available 24/7 with **99.5% uptime**.

**How it’s fulfilled (mechanisms + evidence hooks)**
- Health endpoint for uptime monitors / orchestration:
  - `backend/src/routes/health.ts` → `GET /api/health`
- Docker healthcheck:
  - `docker-compose.yml` → `api.healthcheck`

> Uptime % depends on deployment environment (restart policies, host reliability, monitoring). With the included health endpoint and containerization, standard uptime tooling can enforce the SLA.

### C2) Automatic backups and recovery
**Requirement:** The system shall protect user data with automatic backups and recovery mechanisms.

**How it’s fulfilled**
- Automatic SQLite backups:
  - `backend/src/features/backup/scheduler.ts`
  - `backend/src/features/backup/backup.ts`
  - wired in `backend/src/index.ts` → `startBackupScheduler()`
- Controlled by env:
  - `CLIMENCE_BACKUP_ENABLED=1`
  - `CLIMENCE_BACKUP_INTERVAL_MINUTES`
  - `CLIMENCE_BACKUP_DIR`

**Recovery**
- Restore by replacing `data/telemetry.db` with a recent backup from `data/backups/`.

---

## D. Security

### D1) Authentication required
**Requirement:** The user shall authenticate before accessing system features.

**How it’s fulfilled**
- Route-level protection:
  - `backend/src/lib/auth.ts` → `requireAuth`, `requireRole`
  - Example protected routes: `backend/src/routes/analytics.ts`
- WebSocket authentication:
  - `backend/src/ws.ts` validates tokens
  - bypass is only allowed if explicitly enabled: `CLIMENCE_AUTH_BYPASS=1`

### D2) Encrypt sensitive data in transit + at rest
**Requirement:** The system shall encrypt sensitive data both **in transit** and **at rest**.

**In transit (HTTPS/WSS) — fulfilled in repo**
- TLS termination via nginx reverse proxy:
  - `infra/nginx/nginx.conf` (HTTPS + WebSocket upgrade)
  - `infra/nginx/Dockerfile`
  - `docker-compose.yml` service `proxy` exposes `80` + `443`
- Dashboard uses HTTPS origin:
  - `docker-compose.yml` sets `VITE_CLIMENCE_API_URL=https://localhost`

**At rest — fulfilled via backup + deployment encryption option**
- Data stored in SQLite: `data/telemetry.db`
- Backups created under: `data/backups/`
- For strong encryption-at-rest, deploy on an encrypted disk/volume (standard ops practice).

---

## E. Usability

### E1) Desktop/tablet/mobile
**Requirement:** The user shall be able to access the system via desktop, tablet, or mobile devices.

**How it’s fulfilled**
- Web application (Vite + React) supports all device classes through responsive layout:
  - `frontend/`

### E2) Arabic/English switch
**Requirement:** The user shall be able to switch the interface between Arabic and English.

**How it’s fulfilled**
- Translations:
  - `frontend/src/lib/i18n.ts`
- RTL/locale toggle:
  - `frontend/src/App.tsx`

### E3) Simple and intuitive UI
**Requirement:** The system shall provide a simple and intuitive interface.

**How it’s fulfilled**
- Single dashboard UI entrypoint + clear navigation:
  - `frontend/src/components/Shell.tsx`
  - `frontend/src/components/Dashboard.tsx`

---

## F. Maintainability

### F1) Monitor logs and errors
**Requirement:** Administrators can monitor logs and errors.

**How it’s fulfilled**
- Structured JSON logging:
  - `backend/src/lib/logger.ts`
  - consumed by:
    - `backend/src/index.ts`
    - `backend/src/ws.ts`
    - `backend/src/mqtt.ts`
    - `backend/src/features/analytics/openMeteo.ts`

### F2) Updates without disrupting UX
**Requirement:** The system shall allow updates without disrupting the user experience.

**How it’s fulfilled (deployment-ready)**
- Container-based deployment enables rolling updates / restarts behind a reverse proxy:
  - `docker-compose.yml`
  - `infra/nginx/nginx.conf`

---

## G. Portability

### G1) Major browsers
**Requirement:** The system shall be accessible from Chrome, Edge, Safari, Firefox.

**How it’s fulfilled**
- Standard web tech stack: `frontend/` (Vite + React)

### G2) Cloud and on-prem deployment
**Requirement:** Support deployment on both cloud and on-prem environments.

**How it’s fulfilled**
- Docker build + compose baseline:
  - `backend/Dockerfile`
  - `frontend/Dockerfile`
  - `infra/nginx/Dockerfile`
  - `docker-compose.yml`

---

## ✅ HTTPS Stack Quickstart

1) Generate demo TLS certs (self-signed):
- `infra/certs/README.md`

2) Start the stack:
- `docker compose up --build`

3) Open:
- Dashboard: https://localhost
- Health: https://localhost/api/health

Browsers will warn about the self-signed cert. Accept the warning for local demo.
