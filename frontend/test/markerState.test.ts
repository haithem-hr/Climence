import assert from 'node:assert/strict';
import test from 'node:test';
import { DroneState } from '@climence/shared';
import { buildSensorMarkerHtml, describeDroneState, markerFillVar, markerStateClass } from '../src/components/map/markerState';

test('offline marker state keeps AQI fill and exposes offline tooltip text', () => {
  assert.equal(markerFillVar('haz'), 'var(--aqi-haz)');
  assert.equal(markerStateClass(DroneState.OFFLINE), 'is-offline');
  assert.equal(
    describeDroneState({
      droneState: DroneState.OFFLINE,
      serverTimestamp: '2026-04-25T12:34:56.000Z',
    }),
    'Offline since 2026-04-25T12:34:56.000Z',
  );
});

test('low-battery marker html includes the amber ring state and battery overlay', () => {
  const html = buildSensorMarkerHtml({
    band: 'usg',
    droneState: DroneState.LOW_BATTERY,
    serverTimestamp: '2026-04-25T12:34:56.000Z',
  });

  assert.match(html, /is-low-battery/);
  assert.match(html, /map-sensor-battery/);
  assert.match(html, /var\(--aqi-usg\)/);
});
