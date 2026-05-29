import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface BackupOptions {
  dbPath: string;
  outPath: string;
}

/**
 * Simple SQLite backup strategy for the project:
 * - copy the DB file to a timestamped location (or a fixed path)
 * - can be run on an interval
 *
 * Note: for production-grade SQLite backups, you'd typically use the SQLite
 * backup API / online backup or a filesystem snapshot. This is a pragmatic
 * implementation suitable for the course demo + evidence.
 */
export function backupSqliteDb({ dbPath, outPath }: BackupOptions) {
  mkdirSync(dirname(outPath), { recursive: true });
  copyFileSync(dbPath, outPath);
}
