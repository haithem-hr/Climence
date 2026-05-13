import assert from 'node:assert/strict';
import test from 'node:test';
import { DroneState, type TelemetrySnapshot } from '@climence/shared';
import { buildSnapshotWorkbook, type ReportPayload } from '../src/lib/reports';

function makePayload(snapshot: TelemetrySnapshot): ReportPayload {
  return {
    snapshot,
    cityAqi: 167,
    cityBandLabel: 'Unhealthy',
    activeThreshold: 120,
    onlineSensors: snapshot.drones.length,
    totalSensors: snapshot.drones.length,
    hotspots: [],
    sources: [],
    forecast: [],
    trendLabel: 'Worsening',
    generatedBy: 'Imad (viewer)',
  };
}

test('buildSnapshotWorkbook creates the required three typed sheets', () => {
  const payload = makePayload({
    emittedAt: '2026-05-13T08:00:00.000Z',
    alertThresholdPm25: 120,
    drones: [
      {
        id: 1,
        uuid: 'drone-001',
        lat: 24.7136,
        lng: 46.6753,
        pm25: 91,
        co2: 540,
        no2: 37,
        temperature: 31,
        humidity: 18,
        rssi: -67,
        batteryLevel: 84,
        state: DroneState.GATHERING_DATA,
        client_timestamp: '2026-05-13T07:54:55.000Z',
        server_timestamp: '2026-05-13T07:55:00.000Z',
      },
    ],
    alerts: [
      {
        id: 9,
        uuid: 'alert-001',
        batteryLevel: 72,
        lat: 24.715,
        lng: 46.68,
        pm25: 142,
        co2: 610,
        no2: 49,
        temperature: 33,
        humidity: 14,
        rssi: -71,
        state: DroneState.INVESTIGATING_HAZARD,
        client_timestamp: '2026-05-13T07:55:55.000Z',
        server_timestamp: '2026-05-13T07:56:00.000Z',
      },
    ],
    hotspots: [],
    cityTrend: [
      {
        minute_label: '07:50',
        avg_pm25: 88,
        avg_co2: 530,
      },
    ],
  });

  const workbook = buildSnapshotWorkbook(payload);

  assert.deepEqual(workbook.map(sheet => sheet.sheet), ['Sensors', 'Alerts', 'City Trend']);
  assert.equal(workbook[0].data.length, 2);
  assert.equal(workbook[1].data.length, 2);
  assert.equal(workbook[2].data.length, 2);
  assert.equal(workbook[0].data[1][2]?.type, Number);
  assert.equal(workbook[0].data[1][11]?.type, Date);
  assert.equal(workbook[1].data[1][1]?.type, Number);
  assert.equal(workbook[1].data[1][4]?.type, Date);
  assert.equal(workbook[2].data[1][1]?.type, Number);
});

test('buildSnapshotWorkbook emits friendly empty-state rows when sections have no data', () => {
  const payload = makePayload({
    emittedAt: '2026-05-13T08:00:00.000Z',
    alertThresholdPm25: 120,
    drones: [],
    alerts: [],
    hotspots: [],
    cityTrend: [],
  });

  const workbook = buildSnapshotWorkbook(payload);

  assert.equal(workbook[0].data[1][0]?.value, 'No sensor rows in this snapshot.');
  assert.equal(workbook[1].data[1][0]?.value, 'No active alerts in this snapshot.');
  assert.equal(workbook[2].data[1][0]?.value, 'No city trend points in this snapshot.');
});
