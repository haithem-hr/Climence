export const AQI_BANDS = [
  { max: 50, key: 'good', label: 'Good', color: 'var(--ok)' },
  { max: 100, key: 'mod', label: 'Moderate', color: 'var(--warn)' },
  { max: 150, key: 'usg', label: 'Sensitive Groups', color: 'var(--warn)' },
  { max: 200, key: 'unh', label: 'Unhealthy', color: 'var(--danger)' },
  { max: 300, key: 'vunh', label: 'Very Unhealthy', color: 'var(--danger)' },
  { max: 9999, key: 'haz', label: 'Hazardous', color: 'var(--danger)' },
] as const;

export type AqiBand = (typeof AQI_BANDS)[number];
export type AqiBandKey = AqiBand['key'];

export function aqiBandFor(aqi: number): AqiBand {
  return AQI_BANDS.find(b => aqi <= b.max) ?? AQI_BANDS[AQI_BANDS.length - 1];
}

// EPA 24-hour PM2.5 breakpoints (µg/m³ → AQI)
const PM25_BREAKPOINTS = [
  { pmLo: 0.0, pmHi: 12.0, aqiLo: 0, aqiHi: 50 },
  { pmLo: 12.1, pmHi: 35.4, aqiLo: 51, aqiHi: 100 },
  { pmLo: 35.5, pmHi: 55.4, aqiLo: 101, aqiHi: 150 },
  { pmLo: 55.5, pmHi: 150.4, aqiLo: 151, aqiHi: 200 },
  { pmLo: 150.5, pmHi: 250.4, aqiLo: 201, aqiHi: 300 },
  { pmLo: 250.5, pmHi: 500.4, aqiLo: 301, aqiHi: 500 },
];

export function pm25ToAqi(pm25: number): number {
  const bp =
    PM25_BREAKPOINTS.find(b => pm25 <= b.pmHi) ?? PM25_BREAKPOINTS[PM25_BREAKPOINTS.length - 1];
  const clamped = Math.max(bp.pmLo, Math.min(pm25, bp.pmHi));
  const aqi = ((bp.aqiHi - bp.aqiLo) / (bp.pmHi - bp.pmLo)) * (clamped - bp.pmLo) + bp.aqiLo;
  return Math.round(aqi);
}

export function bandKeyForPm25(pm25: number): AqiBandKey {
  return aqiBandFor(pm25ToAqi(pm25)).key;
}
