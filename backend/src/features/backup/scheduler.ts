import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { backupSqliteDb } from './backup';
import { logger } from '../../lib/logger';

const __dirname = dirname(fileURLToPath(import.meta.url));

function defaultDbPath() {
  // backend/src/features/backup -> <repo>/data/telemetry.db (4 ups)
  return resolve(__dirname, '../../../../data/telemetry.db');
}

function defaultBackupDir() {
  return resolve(__dirname, '../../../../data/backups');
}

export function startBackupScheduler() {
  const enabled = process.env.CLIMENCE_BACKUP_ENABLED === '1';
  if (!enabled) return;

  const intervalMinutes = Number(process.env.CLIMENCE_BACKUP_INTERVAL_MINUTES ?? '60');
  const intervalMs =
    Number.isFinite(intervalMinutes) && intervalMinutes > 0
      ? intervalMinutes * 60_000
      : 60 * 60_000;

  const dbPath = process.env.CLIMENCE_DB_PATH ?? defaultDbPath();
  const dir = process.env.CLIMENCE_BACKUP_DIR ?? defaultBackupDir();

  const run = () => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = resolve(dir, `telemetry-${ts}.db`);
    try {
      backupSqliteDb({ dbPath, outPath });
      logger.info('[backup] SQLite backup created', { outPath });
    } catch (err) {
      logger.error('[backup] SQLite backup failed', { err: String(err) });
    }
  };

  run();
  setInterval(run, intervalMs);
}
