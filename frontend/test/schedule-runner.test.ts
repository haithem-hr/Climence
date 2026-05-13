import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceSchedule, describeScheduleCountdown, isScheduleDue, runDueSchedules } from '../src/lib/schedule-runner';
import type { ReportPayload, ScheduledReport } from '../src/lib/reports';

const payload: ReportPayload = {
  snapshot: {
    drones: [],
    alerts: [],
    cityTrend: [],
    hotspots: [],
    alertThresholdPm25: 120,
    emittedAt: '2026-05-13T08:00:00.000Z',
  },
  cityAqi: 100,
  cityBandLabel: 'Unhealthy',
  activeThreshold: 120,
  onlineSensors: 0,
  totalSensors: 0,
  hotspots: [],
  sources: [],
  forecast: [],
  trendLabel: 'Stable',
  generatedBy: 'Imad',
};

test('runDueSchedules executes due jobs and advances them beyond now', () => {
  const calls: string[] = [];
  const schedule: ScheduledReport = {
    id: 'daily-1',
    label: 'daily xlsx snapshot',
    cadence: 'daily',
    nextRun: '2026-05-12T08:00:00.000Z',
    format: 'xlsx',
  };

  const result = runDueSchedules(
    [schedule],
    payload,
    {
      pdf: () => calls.push('pdf'),
      csv: () => calls.push('csv'),
      json: () => calls.push('json'),
      xlsx: () => calls.push('xlsx'),
    },
    new Date('2026-05-13T09:00:00.000Z'),
  );

  assert.deepEqual(calls, ['xlsx']);
  assert.equal(result.executed.length, 1);
  assert.equal(isScheduleDue(result.schedules[0], new Date('2026-05-13T09:00:00.000Z')), false);
});

test('advanceSchedule and describeScheduleCountdown handle overdue and near-future schedules', () => {
  const base: ScheduledReport = {
    id: 'weekly-1',
    label: 'weekly pdf snapshot',
    cadence: 'weekly',
    nextRun: '2026-05-01T08:00:00.000Z',
    format: 'pdf',
  };

  const advanced = advanceSchedule(base, new Date('2026-05-13T09:00:00.000Z'));
  const advancedDate = new Date(advanced.nextRun);

  assert.equal(advancedDate.getDate(), 15);
  assert.equal(advancedDate.getHours(), 8);
  assert.equal(advancedDate.getMinutes(), 0);
  assert.deepEqual(describeScheduleCountdown('2026-05-13T09:20:00.000Z', new Date('2026-05-13T09:00:00.000Z')), { bucket: 'minutes', value: 20 });
  assert.deepEqual(describeScheduleCountdown('2026-05-13T09:00:00.000Z', new Date('2026-05-13T09:00:00.000Z')), { bucket: 'now' });
});
