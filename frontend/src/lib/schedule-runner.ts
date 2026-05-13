import type { ReportPayload, ScheduledReport } from './reports';

export interface CountdownState {
  bucket: 'now' | 'minutes' | 'hours' | 'days';
  value?: number;
}

export type ReportExporters = Record<ScheduledReport['format'], (payload: ReportPayload) => void>;

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function isScheduleDue(schedule: ScheduledReport, now: Date = new Date()): boolean {
  return toDate(schedule.nextRun).getTime() <= now.getTime();
}

export function advanceSchedule(schedule: ScheduledReport, now: Date = new Date()): ScheduledReport {
  const nextRun = new Date(schedule.nextRun);

  while (nextRun.getTime() <= now.getTime()) {
    if (schedule.cadence === 'daily') nextRun.setDate(nextRun.getDate() + 1);
    if (schedule.cadence === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
    if (schedule.cadence === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
    nextRun.setHours(8, 0, 0, 0);
  }

  return {
    ...schedule,
    nextRun: nextRun.toISOString(),
  };
}

export function describeScheduleCountdown(nextRun: string, now: Date = new Date()): CountdownState {
  const deltaMs = toDate(nextRun).getTime() - now.getTime();
  if (deltaMs <= 0) return { bucket: 'now' };

  const totalMinutes = Math.ceil(deltaMs / 60000);
  if (totalMinutes < 60) return { bucket: 'minutes', value: totalMinutes };

  const totalHours = Math.ceil(totalMinutes / 60);
  if (totalHours < 24) return { bucket: 'hours', value: totalHours };

  return { bucket: 'days', value: Math.ceil(totalHours / 24) };
}

export function runDueSchedules(
  schedules: ScheduledReport[],
  payload: ReportPayload,
  exporters: ReportExporters,
  now: Date = new Date(),
) {
  const executed: ScheduledReport[] = [];

  const nextSchedules = schedules.map(schedule => {
    if (!isScheduleDue(schedule, now)) return schedule;
    exporters[schedule.format](payload);
    executed.push(schedule);
    return advanceSchedule(schedule, now);
  });

  return {
    schedules: nextSchedules,
    executed,
  };
}
