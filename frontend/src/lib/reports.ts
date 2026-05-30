import type { TelemetrySnapshot } from '@climence/shared';
import writeExcelFile, { type CellObject, type Sheet } from './write-excel-file-mock';

export interface ReportPayload {
  snapshot: TelemetrySnapshot;
  cityAqi: number;
  cityBandLabel: string;
  activeThreshold: number;
  onlineSensors: number;
  totalSensors: number;
  hotspots: Array<{ name: string; coord: string; aqi: number; trend: number }>;
  sources: Array<{ name: string; pct: number }>;
  forecast: Array<{ hr: string; val: number }>;
  trendLabel: string;
  generatedBy: string;
}

type WorkbookCell = CellObject | string | number | boolean | Date | null;

interface WorkbookColumn {
  width: number;
}

export interface WorkbookSheet extends Sheet<Blob> {
  columns: WorkbookColumn[];
  data: WorkbookCell[][];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function timestampSlug() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function csvEscape(value: string | number) {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function headerCell(value: string): WorkbookCell {
  return { value, type: String, fontWeight: 'bold' };
}

function stringCell(value: string): WorkbookCell {
  return { value, type: String };
}

function numberCell(value: number): WorkbookCell {
  return { value, type: Number };
}

function dateCell(value: string): WorkbookCell {
  return { value: new Date(value), type: Date };
}

function buildSensorsSheet(payload: ReportPayload): WorkbookSheet {
  const rows: WorkbookCell[][] = [
    [
      headerCell('UUID'),
      headerCell('State'),
      headerCell('Battery'),
      headerCell('Latitude'),
      headerCell('Longitude'),
      headerCell('PM2.5'),
      headerCell('CO2'),
      headerCell('NO2'),
      headerCell('Temperature'),
      headerCell('Humidity'),
      headerCell('RSSI'),
      headerCell('Timestamp'),
    ],
  ];

  if (payload.snapshot.drones.length === 0) {
    rows.push([
      stringCell('No sensor rows in this snapshot.'),
      stringCell(''),
      stringCell(''),
      stringCell(''),
      stringCell(''),
      stringCell(''),
      stringCell(''),
      stringCell(''),
      stringCell(''),
      stringCell(''),
      stringCell(''),
      stringCell(''),
    ]);
  } else {
    for (const drone of payload.snapshot.drones) {
      rows.push([
        stringCell(drone.uuid),
        stringCell(drone.state),
        numberCell(drone.batteryLevel),
        numberCell(drone.lat),
        numberCell(drone.lng),
        numberCell(drone.pm25),
        numberCell(drone.co2),
        numberCell(drone.no2),
        numberCell(drone.temperature),
        numberCell(drone.humidity),
        numberCell(drone.rssi),
        dateCell(drone.server_timestamp),
      ]);
    }
  }

  return {
    sheet: 'Sensors',
    columns: [
      { width: 20 },
      { width: 18 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 12 },
      { width: 10 },
      { width: 24 },
    ],
    data: rows,
  };
}

function buildAlertsSheet(payload: ReportPayload): WorkbookSheet {
  const rows: WorkbookCell[][] = [
    [
      headerCell('UUID'),
      headerCell('PM2.5'),
      headerCell('Latitude'),
      headerCell('Longitude'),
      headerCell('Timestamp'),
    ],
  ];

  if (payload.snapshot.alerts.length === 0) {
    rows.push([
      stringCell('No active alerts in this snapshot.'),
      stringCell(''),
      stringCell(''),
      stringCell(''),
      stringCell(''),
    ]);
  } else {
    for (const alert of payload.snapshot.alerts) {
      rows.push([
        stringCell(alert.uuid),
        numberCell(alert.pm25),
        numberCell(alert.lat),
        numberCell(alert.lng),
        dateCell(alert.server_timestamp),
      ]);
    }
  }

  return {
    sheet: 'Alerts',
    columns: [
      { width: 20 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 24 },
    ],
    data: rows,
  };
}

function buildCityTrendSheet(payload: ReportPayload): WorkbookSheet {
  const rows: WorkbookCell[][] = [
    [
      headerCell('Minute Label'),
      headerCell('Average PM2.5'),
      headerCell('Average CO2'),
    ],
  ];

  if (payload.snapshot.cityTrend.length === 0) {
    rows.push([
      stringCell('No city trend points in this snapshot.'),
      stringCell(''),
      stringCell(''),
    ]);
  } else {
    for (const point of payload.snapshot.cityTrend) {
      rows.push([
        stringCell(point.minute_label),
        numberCell(point.avg_pm25),
        numberCell(point.avg_co2),
      ]);
    }
  }

  return {
    sheet: 'City Trend',
    columns: [
      { width: 18 },
      { width: 16 },
      { width: 16 },
    ],
    data: rows,
  };
}

export function buildSnapshotWorkbook(payload: ReportPayload): WorkbookSheet[] {
  return [
    buildSensorsSheet(payload),
    buildAlertsSheet(payload),
    buildCityTrendSheet(payload),
  ];
}

export function exportSnapshotCsv(payload: ReportPayload) {
  const { snapshot } = payload;
  const rows: string[] = [];

  rows.push('# Climence pollution snapshot');
  rows.push(`# Generated,${new Date().toISOString()}`);
  rows.push(`# Operator,${payload.generatedBy}`);
  rows.push(`# City AQI,${payload.cityAqi}`);
  rows.push(`# City band,${payload.cityBandLabel}`);
  rows.push(`# Trend,${payload.trendLabel}`);
  rows.push(`# Alert threshold PM2.5 (ug/m3),${payload.activeThreshold}`);
  rows.push(`# Sensors online,${payload.onlineSensors}/${payload.totalSensors}`);
  rows.push('');
  rows.push('section,uuid,state,battery,lat,lng,pm25,co2,no2,temperature,humidity,rssi,timestamp');
  for (const drone of snapshot.drones) {
    rows.push(
      [
        'sensor',
        drone.uuid,
        drone.state,
        drone.batteryLevel,
        drone.lat,
        drone.lng,
        drone.pm25,
        drone.co2,
        drone.no2,
        drone.temperature,
        drone.humidity,
        drone.rssi,
        drone.server_timestamp,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  rows.push('');
  rows.push('section,uuid,pm25,lat,lng,timestamp');
  for (const alert of snapshot.alerts) {
    rows.push(
      ['alert', alert.uuid, alert.pm25, alert.lat, alert.lng, alert.server_timestamp]
        .map(csvEscape)
        .join(','),
    );
  }
  rows.push('');
  rows.push('section,lat_zone,lng_zone,avg_pm25');
  for (const hotspot of snapshot.hotspots) {
    rows.push(
      ['hotspot', hotspot.lat_zone, hotspot.lng_zone, hotspot.avg_pm25]
        .map(csvEscape)
        .join(','),
    );
  }
  rows.push('');
  rows.push('section,minute_label,avg_pm25,avg_co2');
  for (const point of snapshot.cityTrend) {
    rows.push(
      ['city_trend', point.minute_label, point.avg_pm25, point.avg_co2].map(csvEscape).join(','),
    );
  }

  downloadBlob(
    new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' }),
    `climence-snapshot-${timestampSlug()}.csv`,
  );
}

export function exportSnapshotJson(payload: ReportPayload) {
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    `climence-snapshot-${timestampSlug()}.json`,
  );
}

export function exportSnapshotXlsx(payload: ReportPayload): void {
  void writeExcelFile(buildSnapshotWorkbook(payload), {
    fontFamily: 'Inter',
    fontSize: 11,
  }).toFile(`climence-snapshot-${timestampSlug()}.xlsx`);
}

/**
 * Open a print-ready HTML report in a new tab. The user picks "Save as PDF"
 * from the browser print dialog — gives us a functional PDF export
 * without bundling a PDF library.
 */
export function openPrintablePdf(payload: ReportPayload) {
  const when = new Date().toLocaleString();
  const timestamp = timestampSlug();
  
  const hotspotRows = payload.hotspots
    .map(
      (h, i) =>
        `<tr>
          <td style="font-weight: 700; color: #888;">${String(i + 1).padStart(2, '0')}</td>
          <td style="font-weight: 600;">${h.name}</td>
          <td style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">${h.coord}</td>
          <td><span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 800; background: #f0f0f0;">${h.aqi}</span></td>
          <td style="color: ${h.trend >= 0 ? '#ef4444' : '#22c55e'}; font-weight: 700;">${h.trend >= 0 ? '↑' : '↓'} ${Math.abs(h.trend)}%</td>
        </tr>`,
    )
    .join('');

  const sourceRows = payload.sources
    .map(s => `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">
          <span>${s.name}</span>
          <span style="margin-left: auto;">${s.pct}%</span>
        </div>
        <div style="height: 6px; background: #eee; border-radius: 3px; overflow: hidden;">
          <div style="height: 100%; width: ${s.pct}%; background: #03dac5;"></div>
        </div>
      </div>
    `)
    .join('');

  const forecastRows = payload.forecast
    .map(f => `
      <div style="flex: 1; min-width: 60px; text-align: center; padding: 10px; border-right: 1px solid #eee;">
        <div style="font-size: 10px; font-weight: 800; color: #888; margin-bottom: 4px;">${f.hr}</div>
        <div style="font-size: 16px; font-weight: 800;">${f.val}</div>
      </div>
    `)
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Climence Intelligence Report — ${timestamp}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
  body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px; color: #1b1a19; background: #fff; line-height: 1.5; }
  
  .report-container { max-width: 900px; margin: 0 auto; }
  
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; }
  .logo-area { display: flex; align-items: center; gap: 15px; }
  .logo-icon { width: 45px; height: 45px; background: #03dac5; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 24px; }
  .logo-text { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; }
  
  .meta-area { text-align: right; }
  .meta-label { font-family: 'JetBrains Mono', monospace; text-transform: uppercase; font-size: 10px; letter-spacing: 0.15em; color: #888; margin-bottom: 2px; }
  .meta-value { font-size: 13px; font-weight: 700; }

  .hero-banner { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 24px; padding: 32px; margin-bottom: 32px; position: relative; overflow: hidden; }
  .hero-banner::after { content: ''; position: absolute; top: 0; right: 0; width: 300px; height: 300px; background: radial-gradient(circle, #03dac520 0%, transparent 70%); border-radius: 50%; translate: 50% -50%; }

  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .kpi { }
  .kpi-label { font-family: 'JetBrains Mono', monospace; text-transform: uppercase; font-size: 10px; letter-spacing: 0.15em; color: #64748b; margin-bottom: 8px; font-weight: 700; }
  .kpi-value { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; margin-bottom: 4px; }
  .kpi-sub { font-size: 12px; font-weight: 600; color: #94a3b8; }

  section { margin-bottom: 40px; }
  section h2 { font-size: 18px; font-weight: 800; margin: 0 0 20px; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 10px; color: #0f172a; }
  section h2::before { content: ''; display: block; width: 4px; height: 18px; background: #03dac5; border-radius: 2px; }

  .table-card { border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 12px 16px; background: #f8fafc; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  tr:last-child td { border-bottom: none; }

  .forecast-bar { display: flex; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: white; }
  
  .source-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }

  footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start; }
  .footer-left { font-size: 11px; color: #94a3b8; max-width: 400px; }
  .footer-right { text-align: right; }

  @media print {
    body { padding: 0; }
    .report-container { max-width: 100%; }
    @page { margin: 15mm; }
  }
</style>
</head>
<body>
<div class="report-container">
  <header>
    <div class="logo-area">
      <div class="logo-icon">C</div>
      <div class="logo-text">CLIMENCE</div>
    </div>
    <div class="meta-area">
      <div style="margin-bottom: 12px;">
        <div class="meta-label">Generated On</div>
        <div class="meta-value">${when}</div>
      </div>
      <div>
        <div class="meta-label">Mission Control Operator</div>
        <div class="meta-value">${payload.generatedBy}</div>
      </div>
    </div>
  </header>

  <div class="hero-banner">
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">City AQI Score</div>
        <div class="kpi-value" style="color: #03dac5;">${payload.cityAqi}</div>
        <div class="kpi-sub">${payload.cityBandLabel.toUpperCase()}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Current Trend</div>
        <div class="kpi-value">${payload.trendLabel}</div>
        <div class="kpi-sub">LAST 60 MINUTES</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Active Alerts</div>
        <div class="kpi-value" style="color: ${payload.snapshot.alerts.length > 0 ? '#ef4444' : '#1b1a19'};">${payload.snapshot.alerts.length}</div>
        <div class="kpi-sub">THRESHOLD: ${payload.activeThreshold}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Sensor Status</div>
        <div class="kpi-value">${payload.onlineSensors}<span style="font-size: 16px; color: #cbd5e1; margin-left: 4px;">/ ${payload.totalSensors}</span></div>
        <div class="kpi-sub">SYSTEMS ONLINE</div>
      </div>
    </div>
  </div>

  <section>
    <h2>Strategic Hotspots</h2>
    <div class="table-card">
      <table>
        <thead>
          <tr><th>Index</th><th>Location Name</th><th>Coordinates</th><th>AQI</th><th>Trend</th></tr>
        </thead>
        <tbody>
          ${hotspotRows || '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #94a3b8;">No critical hotspots detected in the current snapshot.</td></tr>'}
        </tbody>
      </table>
    </div>
  </section>

  <div class="source-grid">
    <section>
      <h2>Short-Term Forecast</h2>
      <div class="forecast-bar">
        ${forecastRows}
      </div>
    </section>

    <section>
      <h2>Pollutant Attribution</h2>
      <div>
        ${sourceRows}
      </div>
    </section>
  </div>

  <section>
    <h2>Executive Summary</h2>
    <p style="font-size: 14px; color: #475569; background: #f1f5f9; padding: 20px; border-radius: 12px; margin: 0;">
      As of ${when}, the Riyadh environmental grid shows a city-wide AQI of <strong>${payload.cityAqi}</strong>. 
      The trend is classified as <strong>${payload.trendLabel}</strong>. 
      ${payload.snapshot.alerts.length > 0 ? `Attention is required at ${payload.snapshot.alerts.length} location(s) where levels exceed the safety threshold.` : 'All monitored sectors are currently within operational safety parameters.'}
      Field response units are standing by for deployment from the Central Command Center.
    </p>
  </section>

  <footer>
    <div class="footer-left">
      This document is a certified snapshot from the Climence Intelligence System. 
      All data is derived from the live IoT sensor mesh and validated via CAMS satellite telemetry.
    </div>
    <div class="footer-right">
      <div class="meta-label">Report ID</div>
      <div class="meta-value" style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">CLN-${timestamp}</div>
    </div>
  </footer>
</div>

<script>
  window.addEventListener('load', () => {
    setTimeout(() => {
      window.print();
    }, 1000);
  });
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  
  if (!win) {
    alert('The report was blocked by your browser. Please allow popups for this site to view reports.');
    return;
  }
}

// ---------- scheduled reports (FR-17, client-stub) ----------

export interface ScheduledReport {
  id: string;
  label: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  nextRun: string;
  format: 'pdf' | 'csv' | 'json' | 'xlsx';
}

const STORAGE_KEY = 'climence-scheduled-reports';

export function loadScheduledReports(): ScheduledReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScheduledReport[];
  } catch {
    return [];
  }
}

export function saveScheduledReports(reports: ScheduledReport[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function nextRunIso(cadence: ScheduledReport['cadence']) {
  const d = new Date();
  if (cadence === 'daily') d.setDate(d.getDate() + 1);
  if (cadence === 'weekly') d.setDate(d.getDate() + 7);
  if (cadence === 'monthly') d.setMonth(d.getMonth() + 1);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}
