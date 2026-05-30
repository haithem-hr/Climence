import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Repo-level data dir lives at <repo>/data/telemetry.db (backend/src/db -> 3 ups)
const dbPath = process.env.CLIMENCE_DB_PATH ?? resolve(__dirname, '../../../data/telemetry.db');
const schemaPath = resolve(__dirname, 'schema.sql');

export const db = new Database(dbPath);
db.exec(readFileSync(schemaPath, 'utf8'));

const telemetryColumns = new Set(
  db.prepare('PRAGMA table_info(TelemetryLogs)').all().map((column: any) => String(column.name)),
);

for (const [name, type] of [
  ['pm10', 'REAL'],
  ['o3', 'REAL'],
  ['so2', 'REAL'],
  ['co', 'REAL'],
] as const) {
  if (!telemetryColumns.has(name)) {
    db.exec(`ALTER TABLE TelemetryLogs ADD COLUMN ${name} ${type}`);
  }
}

export default db;
