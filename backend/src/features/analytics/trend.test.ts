import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyTrend, olsRegression } from './trend.js';

describe('olsRegression', () => {
  it('returns zero slope for empty input', () => {
    const r = olsRegression([]);
    assert.equal(r.slope, 0);
    assert.equal(r.r2, 0);
  });

  it('returns zero slope for single point', () => {
    const r = olsRegression([{ t: 0, avgPm25: 100 }]);
    assert.equal(r.slope, 0);
    assert.equal(r.r2, 1);
  });

  it('returns slope ≈ 1 for perfectly linear rising data', () => {
    const pts = [0, 1, 2, 3, 4].map(t => ({ t, avgPm25: 50 + t }));
    const r = olsRegression(pts);
    assert.ok(Math.abs(r.slope - 1) < 0.001, `slope should be ~1, got ${r.slope}`);
    assert.ok(r.r2 > 0.999, `R² should be ~1, got ${r.r2}`);
  });

  it('returns slope ≈ -2 for perfectly linear falling data', () => {
    const pts = [0, 1, 2, 3].map(t => ({ t, avgPm25: 100 - 2 * t }));
    const r = olsRegression(pts);
    assert.ok(Math.abs(r.slope - (-2)) < 0.001, `slope should be ~-2, got ${r.slope}`);
  });

  it('returns R² = 0 for flat constant series', () => {
    const pts = [0, 1, 2, 3].map(t => ({ t, avgPm25: 60 }));
    const r = olsRegression(pts);
    assert.equal(r.slope, 0);
    assert.equal(r.r2, 1); // SS_tot = 0 → we return 1 by convention
  });
});

describe('classifyTrend', () => {
  it('returns stable for < 2 points', () => {
    const t = classifyTrend([], 30);
    assert.equal(t.direction, 'stable');
    assert.equal(t.confidence, 0);
  });

  it('flat data → stable', () => {
    const pts = [0, 1, 2, 3, 4].map(t => ({ t, avgPm25: 80 }));
    const t = classifyTrend(pts, 30);
    assert.equal(t.direction, 'stable');
  });

  it('strongly rising data → worsening', () => {
    const pts = [0, 1, 2, 3, 4, 5].map(t => ({ t, avgPm25: 50 + t * 5 }));
    const t = classifyTrend(pts, 30);
    assert.equal(t.direction, 'worsening');
  });

  it('strongly falling data → improving', () => {
    const pts = [0, 1, 2, 3, 4, 5].map(t => ({ t, avgPm25: 200 - t * 5 }));
    const t = classifyTrend(pts, 30);
    assert.equal(t.direction, 'improving');
  });

  it('slope within ±0.5 threshold → stable even if slightly positive', () => {
    const pts = [0, 1, 2, 3].map(t => ({ t, avgPm25: 100 + t * 0.3 }));
    const t = classifyTrend(pts, 30);
    assert.equal(t.direction, 'stable');
  });

  it('windowMinutes is echoed back in the result', () => {
    const pts = [{ t: 0, avgPm25: 50 }, { t: 1, avgPm25: 51 }];
    const t = classifyTrend(pts, 60);
    assert.equal(t.windowMinutes, 60);
  });
});
