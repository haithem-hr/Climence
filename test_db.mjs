import Database from 'better-sqlite3';
const db = new Database('./data/telemetry.db');
const alertConfig = db.prepare(`SELECT * FROM AlertConfig`).get();
console.log('Current DB AlertConfig:', alertConfig);

const activeAlerts = db.prepare(`
  SELECT * FROM TelemetryLogs
  WHERE id IN (
    SELECT MAX(id) FROM TelemetryLogs
    WHERE server_timestamp >= datetime('now', '-5 minutes')
    GROUP BY uuid
  )
  AND pm25 > ?
`).all(1);

console.log('Active Alerts with threshold 1:', activeAlerts.length);
if (activeAlerts.length > 0) {
    console.log('First alert:', activeAlerts[0]);
}
