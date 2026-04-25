# Climence

Riyadh air-quality monitoring system — real-time dashboard, ingestion API, and drone telemetry simulator.

## Project Layout

```
/frontend    — React command center (dashboard)
/backend     — Express ingestion API + WebSocket snapshot broadcaster
/simulator   — Drone fleet simulator (posts telemetry to /backend)
/shared      — Cross-service contracts: types, AQI, message shapes
/team        — Per-student task ownership (see team/OVERVIEW.md)
/docs        — Architecture notes, specs, requirements traceability
/data        — Runtime SQLite file (gitignored)
```

Each of `frontend`, `backend`, `simulator`, `shared` is a workspace. The root [package.json](package.json) lists them in `workspaces`, so `npm install` at the root installs everything.

## Quick Start

```bash
npm install      # one time
npm run dev      # boots API + simulator + dashboard concurrently
```

Then open `http://localhost:5173`.

Individual services:

```bash
npm run dev:api    # backend only
npm run dev:sim    # simulator only
npm run dev:ui     # frontend only
```

## Authentication (demo users)

- `admin@mewa.gov.sa` / `Admin123!` — full config access
- `analyst@mewa.gov.sa` / `Analyst123!` — read + triage
- `viewer@mewa.gov.sa` / `Viewer123!` — read-only

## Environment

Each deployable has its own `.env.example`:

- [backend/.env.example](backend/.env.example)
- [frontend/.env.example](frontend/.env.example)

Copy to `.env.local` and fill in any values you need for local overrides. The frontend map now uses Leaflet with OpenStreetMap tiles, so no maps API key is required.

## Quality gates

```bash
npm run typecheck
npm run lint
npm run test
npm run check       # runs all three
```

## Documentation

- [Architecture](ARCHITECTURE.md) — chosen style, layer responsibilities, data flow
- [Team overview](team/OVERVIEW.md) — who owns what, build order, conventions
- [Development guide](docs/DEVELOPMENT.md)
- [SWE496 specs](docs/SWE496_SPECIFICATIONS.md) · [traceability](docs/SWE496_REQUIREMENTS_TRACEABILITY.md) · [implementation plan](docs/SWE496_IMPLEMENTATION_PLAN.md)
