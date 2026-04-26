import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectHotspots, haversineKm } from './hotspots.js';

// Riyadh-vicinity base coordinate
const BASE_LAT = 24.7;
const BASE_LNG = 46.7;

/** Offset a coordinate by ~metres north and east. */
function offset(lat: number, lng: number, northM: number, eastM: number) {
  return {
    lat: lat + northM / 111_000,
    lng: lng + eastM / (111_000 * Math.cos((lat * Math.PI) / 180)),
  };
}

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    assert.equal(haversineKm(24.7, 46.7, 24.7, 46.7), 0);
  });

  it('returns ~1 km for ~0.009° lat difference', () => {
    const d = haversineKm(24.700, 46.700, 24.709, 46.700);
    assert.ok(d > 0.95 && d < 1.05, `expected ~1 km, got ${d.toFixed(3)}`);
  });
});

describe('detectHotspots', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(detectHotspots([], 35), []);
  });

  it('returns empty array when no point exceeds pm25Min', () => {
    const pts = [{ uuid: 'a', lat: BASE_LAT, lng: BASE_LNG, pm25: 20 }];
    assert.deepEqual(detectHotspots(pts, 35), []);
  });

  it('5 points within 500 m → 1 cluster', () => {
    const pts = [0, 100, 200, 300, 400].map((m, i) => ({
      uuid: `d${i}`,
      ...offset(BASE_LAT, BASE_LNG, m, m),
      pm25: 150 + i * 5,
    }));
    const clusters = detectHotspots(pts, 35);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].memberUuids.length, 5);
    assert.ok(clusters[0].radiusKm < 1, 'radius should be < 1 km for 500 m spread');
  });

  it('2 far-apart points → 2 clusters', () => {
    const pts = [
      { uuid: 'north', ...offset(BASE_LAT, BASE_LNG, 0, 0),           pm25: 180 },
      { uuid: 'south', ...offset(BASE_LAT, BASE_LNG, -20_000, 0),     pm25: 160 },
    ];
    const clusters = detectHotspots(pts, 35);
    assert.equal(clusters.length, 2);
  });

  it('cluster score is clamped to 1 for extreme pm25', () => {
    const pts = [{ uuid: 'x', lat: BASE_LAT, lng: BASE_LNG, pm25: 9999 }];
    const [c] = detectHotspots(pts, 35);
    assert.equal(c.score, 1);
  });

  it('clusters sorted by descending score', () => {
    const pts = [
      { uuid: 'low',  lat: BASE_LAT,        lng: BASE_LNG,        pm25: 50 },
      { uuid: 'high', lat: BASE_LAT + 0.1,  lng: BASE_LNG + 0.1,  pm25: 300 },
    ];
    const clusters = detectHotspots(pts, 35);
    assert.ok(clusters[0].score >= clusters[1].score);
  });
});
