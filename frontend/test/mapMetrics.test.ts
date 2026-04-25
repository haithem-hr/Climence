import assert from 'node:assert/strict';
import test from 'node:test';
import { bandForMetricValue, formatMetricValue, getMapMetricConfig, heatIntensityForMetric, normalizeMetricValue } from '../src/lib/mapMetrics';

test('battery heat scale is inverted so low battery is hotter', () => {
  assert.ok(normalizeMetricValue('battery', 10) > normalizeMetricValue('battery', 90));
  assert.ok(heatIntensityForMetric('battery', 10) > heatIntensityForMetric('battery', 90));
  assert.equal(bandForMetricValue('battery', 10), 'haz');
});

test('pm25 keeps EPA-derived banding and metric-specific legend labels', () => {
  assert.equal(bandForMetricValue('pm25', 10), 'good');
  assert.equal(bandForMetricValue('pm25', 80), 'unh');
  assert.deepEqual(getMapMetricConfig('co2').legendStops, ['400', '550', '700', '850', '1000', '1200+']);
  assert.equal(formatMetricValue('temperature', 31.6), '32');
});
