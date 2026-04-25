import { aqiBandFor, pm25ToAqi, type AqiBandKey } from '@climence/shared';

export type MapMetricKey = 'pm25' | 'co2' | 'no2' | 'temperature' | 'humidity' | 'battery';

export interface MetricSample {
  pm25: number;
  co2: number;
  no2: number;
  temperature: number;
  humidity: number;
  battery: number;
}

interface MapMetricConfig {
  key: MapMetricKey;
  label: string;
  unit: string;
  legendTitle: string;
  legendStops: string[];
  min: number;
  max: number;
  invert?: boolean;
  accessor: (sample: MetricSample) => number;
  format: (value: number) => string;
}

const MAP_METRIC_CONFIG: Record<MapMetricKey, MapMetricConfig> = {
  pm25: {
    key: 'pm25',
    label: 'PM2.5',
    unit: 'ug/m3',
    legendTitle: 'AQI · US EPA',
    legendStops: ['0', '12', '35', '55', '150', '250+'],
    min: 0,
    max: 250,
    accessor: sample => sample.pm25,
    format: value => Math.round(value).toString(),
  },
  co2: {
    key: 'co2',
    label: 'CO2',
    unit: 'ppm',
    legendTitle: 'CO2 · live ppm',
    legendStops: ['400', '550', '700', '850', '1000', '1200+'],
    min: 400,
    max: 1200,
    accessor: sample => sample.co2,
    format: value => Math.round(value).toString(),
  },
  no2: {
    key: 'no2',
    label: 'NO2',
    unit: 'ppb',
    legendTitle: 'NO2 · live ppb',
    legendStops: ['0', '25', '50', '75', '100', '150+'],
    min: 0,
    max: 150,
    accessor: sample => sample.no2,
    format: value => Math.round(value).toString(),
  },
  temperature: {
    key: 'temperature',
    label: 'Temp',
    unit: 'degC',
    legendTitle: 'Temp · live degC',
    legendStops: ['15', '20', '25', '30', '35', '40+'],
    min: 15,
    max: 40,
    accessor: sample => sample.temperature,
    format: value => Math.round(value).toString(),
  },
  humidity: {
    key: 'humidity',
    label: 'Humidity',
    unit: '%',
    legendTitle: 'Humidity · live %',
    legendStops: ['10', '30', '50', '70', '85', '100'],
    min: 10,
    max: 100,
    accessor: sample => sample.humidity,
    format: value => Math.round(value).toString(),
  },
  battery: {
    key: 'battery',
    label: 'Battery',
    unit: '%',
    legendTitle: 'Battery · fleet %',
    legendStops: ['100', '80', '60', '40', '20', '0'],
    min: 0,
    max: 100,
    invert: true,
    accessor: sample => sample.battery,
    format: value => Math.round(value).toString(),
  },
};

export const HEATMAP_GRADIENT = {
  0.18: '#2f9f6b',
  0.36: '#c8a93f',
  0.55: '#d1873f',
  0.74: '#cf5f4a',
  0.9: '#8b5ea5',
  1: '#7f3c2f',
} as const;

const OTHER_METRIC_BANDS: Array<{ maxRatio: number; band: AqiBandKey }> = [
  { maxRatio: 1 / 6, band: 'good' },
  { maxRatio: 2 / 6, band: 'mod' },
  { maxRatio: 3 / 6, band: 'usg' },
  { maxRatio: 4 / 6, band: 'unh' },
  { maxRatio: 5 / 6, band: 'vunh' },
  { maxRatio: Number.POSITIVE_INFINITY, band: 'haz' },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getMapMetricConfig(key: MapMetricKey) {
  return MAP_METRIC_CONFIG[key];
}

export function getMapMetricValue(key: MapMetricKey, sample: MetricSample) {
  return MAP_METRIC_CONFIG[key].accessor(sample);
}

export function normalizeMetricValue(key: MapMetricKey, value: number) {
  const config = MAP_METRIC_CONFIG[key];
  const normalized = clamp((clamp(value, config.min, config.max) - config.min) / (config.max - config.min), 0, 1);
  return config.invert ? 1 - normalized : normalized;
}

export function heatIntensityForMetric(key: MapMetricKey, value: number) {
  return clamp(0.14 + normalizeMetricValue(key, value) * 0.86, 0.08, 1);
}

export function bandForMetricValue(key: MapMetricKey, value: number): AqiBandKey {
  if (key === 'pm25') {
    return aqiBandFor(pm25ToAqi(value)).key;
  }

  const ratio = normalizeMetricValue(key, value);
  return OTHER_METRIC_BANDS.find(entry => ratio <= entry.maxRatio)?.band ?? 'haz';
}

export function formatMetricValue(key: MapMetricKey, value: number) {
  return MAP_METRIC_CONFIG[key].format(value);
}
