# Development Guide

## Common Commands

From repo root:

- `npm run dev`: run API + simulator + dashboard together.
- `npm run build`: build all workspaces.
- `npm run typecheck`: typecheck all workspaces that expose `typecheck`.
- `npm run test`: run unit tests across workspaces.
- `npm run check`: typecheck + lint + test.
- `npm run test:integration:api`: API smoke/integration script.

## Fast Search Patterns

Use `rg` for fast navigation.

- Route handlers:
  - `rg "router\.(get|post|put|delete)" backend/src`
- Shared contracts:
  - `rg "export (interface|type|const)" shared/src`
- WebSocket usage:
  - `rg "ws|WebSocket|broadcastSnapshot" backend frontend simulator`
- AQI logic:
  - `rg "aqi|pm25" shared/src frontend/src backend/src`

## Test Placement

- Place tests next to the module under test.
- Name tests `*.test.ts`.
- Prefer testing pure modules over transport glue.

## Adding New Feature (Checklist)

1. Add/extend shared contracts in `shared/`.
2. Implement API feature logic in `backend/src/features/<name>`.
3. Keep route handlers thin (`routes/*` should call feature functions).
4. Add unit tests for pure feature logic.
5. Update dashboard consumption with shared contracts only.
