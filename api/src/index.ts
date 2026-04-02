import express from 'express';
import cors from 'cors';
import db from './database';

const app = express();
app.use(cors());
app.use(express.json());

// Prepare our insertion statement once for performance
const insertStmt = db.prepare(`
  INSERT INTO TelemetryLogs (
    uuid, state, batteryLevel, lat, lng,
    pm25, co2, no2, temperature, humidity, rssi, client_timestamp
  ) VALUES (
    @uuid, @state, @batteryLevel, @lat, @lng,
    @pm25, @co2, @no2, @temperature, @humidity, @rssi, @client_timestamp
  )
`);

app.post('/api/telemetry', (req, res) => {
    const data = req.body;
    
    if (!data.fleet || !Array.isArray(data.fleet)) {
        res.status(400).json({ error: 'Invalid payload. Expected { fleet: [...] }' });
        return;
    }

    try {
        // Wrap inserts in a transaction for speed and atomicity
        const insertMany = db.transaction((drones: any[]) => {
            for (const drone of drones) {
                insertStmt.run({
                    uuid: drone.uuid,
                    state: drone.state,
                    batteryLevel: drone.batteryLevel,
                    lat: drone.location.lat,
                    lng: drone.location.lng,
                    pm25: drone.airQuality.pm25,
                    co2: drone.airQuality.co2,
                    no2: drone.airQuality.no2,
                    temperature: drone.airQuality.temperature,
                    humidity: drone.airQuality.humidity,
                    rssi: drone.rssi,
                    client_timestamp: drone.timestamp
                });
            }
        });
        
        insertMany(data.fleet);
        console.log(`[${new Date().toISOString()}] Successfully ingested telemetry for ${data.fleet.length} drones.`);
        res.status(200).json({ status: 'success', count: data.fleet.length });
    } catch (err) {
        console.error('Database insertion error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/telemetry/latest', (req, res) => {
    try {
        // Query to get the latest row per UUID (Restricted only to actively broadcasting drones online within the last 5 minutes)
        const latestQuery = `
            SELECT * FROM TelemetryLogs 
            WHERE id IN (
                SELECT MAX(id) FROM TelemetryLogs 
                WHERE server_timestamp >= datetime('now', '-5 minutes')
                GROUP BY uuid
            )
        `;
        const results = db.prepare(latestQuery).all();
        res.status(200).json(results);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/telemetry/history/:droneId', (req, res) => {
    const droneId = req.params.droneId;
    try {
        const query = `
            SELECT * FROM (
                SELECT * FROM TelemetryLogs
                WHERE uuid = ?
                ORDER BY server_timestamp DESC
                LIMIT 60
            ) ordered_desc
            ORDER BY server_timestamp ASC;
        `;
        // Use better-sqlite3 parameterized queries (.all) to prevent SQL injection safely natively
        const results = db.prepare(query).all(droneId);
        
        if (!results || results.length === 0) {
            res.status(404).json({ error: 'Drone ID not found or has no generated history.' });
            return;
        }
        
        res.status(200).json(results);
    } catch (err) {
        console.error('Database history query error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/analytics/city-trend', (req, res) => {
    try {
        const query = `
            SELECT 
                strftime('%H:%M', server_timestamp) as minute_label, 
                AVG(pm25) as avg_pm25, 
                AVG(co2) as avg_co2 
            FROM TelemetryLogs 
            WHERE server_timestamp >= datetime('now', '-30 minutes')
            GROUP BY strftime('%Y-%m-%d %H:%M', server_timestamp)
            ORDER BY server_timestamp ASC;
        `;
        const results = db.prepare(query).all();
        res.status(200).json(results);
    } catch (err) {
        console.error('Database city-trend query error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/analytics/hotspots', (req, res) => {
    try {
        const query = `
            SELECT 
                ROUND(lat, 2) as lat_zone, 
                ROUND(lng, 2) as lng_zone, 
                AVG(pm25) as avg_pm25 
            FROM TelemetryLogs 
            WHERE server_timestamp >= datetime('now', '-5 minutes')
            GROUP BY ROUND(lat, 2), ROUND(lng, 2)
            ORDER BY avg_pm25 DESC 
            LIMIT 3;
        `;
        const results = db.prepare(query).all();
        res.status(200).json(results);
    } catch (err) {
        console.error('Database hotspots query error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/alerts/active', (req, res) => {
    try {
        const query = `
            SELECT * FROM TelemetryLogs 
            WHERE id IN (
                SELECT MAX(id) FROM TelemetryLogs 
                WHERE server_timestamp >= datetime('now', '-5 minutes')
                GROUP BY uuid
            )
            AND pm25 > 140
        `;
        const results = db.prepare(query).all();
        res.status(200).json(results);
    } catch (err) {
        console.error('Database active alerts query error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Central Ingestion API listening on http://localhost:${PORT}`);
});
