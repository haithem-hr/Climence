CREATE TABLE IF NOT EXISTS TelemetryLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL,
  state TEXT NOT NULL,
  batteryLevel REAL NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  pm25 REAL NOT NULL,
  pm10 REAL,
  co2 REAL NOT NULL,
  no2 REAL NOT NULL,
  o3 REAL,
  so2 REAL,
  co REAL,
  temperature REAL NOT NULL,
  humidity REAL NOT NULL,
  rssi INTEGER NOT NULL,
  client_timestamp TEXT NOT NULL,
  server_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS AlertConfig (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pm25_threshold REAL NOT NULL DEFAULT 140,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO AlertConfig (id, pm25_threshold) VALUES (1, 140);

CREATE TABLE IF NOT EXISTS alert_rules (
  rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  pollutant_type TEXT NOT NULL,
  threshold_value REAL NOT NULL,
  condition_operator TEXT NOT NULL DEFAULT '>',
  notification_channel TEXT DEFAULT 'system',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER REFERENCES alert_rules(rule_id),
  triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  cleared_at DATETIME,
  peak_value REAL,
  status TEXT DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS alert_rules_user_idx ON alert_rules (user_id);
CREATE INDEX IF NOT EXISTS alert_events_rule_status_idx ON alert_events (rule_id, status);

INSERT INTO alert_rules (user_id, pollutant_type, threshold_value, condition_operator, notification_channel, is_active)
SELECT 1, 'pm25', 140, '>', 'system', 1
WHERE NOT EXISTS (SELECT 1 FROM alert_rules);

CREATE TABLE IF NOT EXISTS Missions (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  resource_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  report TEXT,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  report_type TEXT NOT NULL DEFAULT 'snapshot',
  region TEXT,
  pollutants TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  recipients TEXT NOT NULL DEFAULT '[]',
  output_format TEXT DEFAULT 'pdf',
  is_active INTEGER DEFAULT 1,
  last_run DATETIME,
  next_run DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
