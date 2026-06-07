-- Postgres schema for Climence (redis+postgres storage backend)

CREATE TABLE IF NOT EXISTS telemetry_logs (
  id BIGSERIAL PRIMARY KEY,
  uuid TEXT NOT NULL,
  state TEXT NOT NULL,
  battery_level DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  pm25 DOUBLE PRECISION NOT NULL,
  pm10 DOUBLE PRECISION,
  co2 DOUBLE PRECISION NOT NULL,
  no2 DOUBLE PRECISION NOT NULL,
  o3 DOUBLE PRECISION,
  so2 DOUBLE PRECISION,
  co DOUBLE PRECISION,
  temperature DOUBLE PRECISION NOT NULL,
  humidity DOUBLE PRECISION NOT NULL,
  rssi INTEGER NOT NULL,
  client_timestamp TEXT NOT NULL,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telemetry_logs_uuid_ts_idx
  ON telemetry_logs (uuid, server_timestamp DESC);

CREATE INDEX IF NOT EXISTS telemetry_logs_ts_idx
  ON telemetry_logs (server_timestamp DESC);

ALTER TABLE telemetry_logs ADD COLUMN IF NOT EXISTS pm10 DOUBLE PRECISION;
ALTER TABLE telemetry_logs ADD COLUMN IF NOT EXISTS o3 DOUBLE PRECISION;
ALTER TABLE telemetry_logs ADD COLUMN IF NOT EXISTS so2 DOUBLE PRECISION;
ALTER TABLE telemetry_logs ADD COLUMN IF NOT EXISTS co DOUBLE PRECISION;


CREATE TABLE IF NOT EXISTS alert_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pm25_threshold DOUBLE PRECISION NOT NULL DEFAULT 140,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO alert_config (id, pm25_threshold)
VALUES (1, 140)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('administrator','analyst','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  rule_id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(user_id),
  pollutant_type VARCHAR(20) NOT NULL,
  threshold_value DOUBLE PRECISION NOT NULL,
  condition_operator VARCHAR(5) NOT NULL DEFAULT '>',
  notification_channel VARCHAR(20) DEFAULT 'system',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_events (
  event_id SERIAL PRIMARY KEY,
  rule_id INT REFERENCES alert_rules(rule_id),
  drone_id TEXT,
  triggered_at TIMESTAMP DEFAULT NOW(),
  cleared_at TIMESTAMP,
  peak_value DOUBLE PRECISION,
  status VARCHAR(20) DEFAULT 'active'
);

ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS drone_id TEXT;

CREATE INDEX IF NOT EXISTS alert_rules_user_idx ON alert_rules (user_id);
CREATE INDEX IF NOT EXISTS alert_events_rule_status_idx ON alert_events (rule_id, status);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  resource_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  report TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS missions_start_time_idx
  ON missions (start_time DESC);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  schedule_id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(user_id),
  report_type VARCHAR(50) NOT NULL DEFAULT 'snapshot',
  region VARCHAR(50),
  pollutants TEXT[],
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  recipients TEXT[] NOT NULL DEFAULT '{}',
  output_format VARCHAR(10) DEFAULT 'pdf',
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_reports_user_idx ON scheduled_reports (user_id);
CREATE INDEX IF NOT EXISTS scheduled_reports_next_run_idx ON scheduled_reports (next_run) WHERE is_active = true;
