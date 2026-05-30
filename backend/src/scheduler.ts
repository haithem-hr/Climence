/**
 * Report scheduler — runs periodic checks for due scheduled reports.
 *
 * Uses `setInterval` instead of `node-cron` to avoid the dependency.
 * Checks every 5 minutes for overdue schedules and marks them as run.
 */
import { getStorage } from './storage/select.js';
import { logger } from './lib/logger.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let timer: ReturnType<typeof setInterval> | null = null;

async function processSchedules() {
  try {
    const storage = getStorage();
    const dueSchedules = await storage.getDueSchedules();

    if (dueSchedules.length === 0) return;

    for (const schedule of dueSchedules) {
      try {
        logger.info('[scheduler] executing report schedule', {
          schedule_id: schedule.schedule_id,
          frequency: schedule.frequency,
          output_format: schedule.output_format,
        });

        // Mark as run and advance next_run to the next interval.
        // The actual report generation is triggered on the frontend
        // by polling the schedule's last_run timestamp, or the client
        // picks up the data on the next dashboard load.
        await storage.markScheduleRun(schedule.schedule_id, schedule.frequency);

        logger.info('[scheduler] schedule executed, next_run advanced', {
          schedule_id: schedule.schedule_id,
        });
      } catch (err) {
        logger.error('[scheduler] failed to process schedule', {
          schedule_id: schedule.schedule_id,
          err: String(err),
        });
      }
    }
  } catch (err) {
    logger.error('[scheduler] processSchedules error', { err: String(err) });
  }
}

/**
 * Start the periodic scheduler. Safe to call multiple times (idempotent).
 */
export function startReportScheduler() {
  if (timer) return;

  logger.info('[scheduler] starting report scheduler (check every 5 minutes)');

  // Run once immediately on startup
  void processSchedules();

  timer = setInterval(() => {
    void processSchedules();
  }, CHECK_INTERVAL_MS);

  // Don't keep the process alive just for this timer
  if (timer && typeof timer === 'object' && 'unref' in timer) {
    timer.unref();
  }
}

/**
 * Stop the periodic scheduler (for graceful shutdown).
 */
export function stopReportScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('[scheduler] report scheduler stopped');
  }
}
