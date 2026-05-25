const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mqtt = require('mqtt');

const CSV_FILE = path.join(__dirname, '../data/riyadh_flight_path.csv');
const BROKER_URL = 'mqtt://localhost:1883'; 
const TOPIC = 'climence/telemetry';
const DRONE_UUID = `CSV-DRONE-${Math.floor(Math.random() * 1000)}`;
const MQTT_USERNAME = 'drone';
const MQTT_PASSWORD = 'flight123';

const flightData = [];
let currentIndex = 0;
let batteryLevel = 100;

// Connect to the broker
const client = mqtt.connect(BROKER_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clientId: DRONE_UUID,
  clean: true,
  connectTimeout: 4000,
});

client.on('connect', () => {
  console.log(`✅ Connected to MQTT broker at ${BROKER_URL}`);
  loadCsvAndStartPlayback();
});

client.on('error', (err) => {
  console.error(`❌ MQTT Error:`, err.message);
  process.exit(1);
});

function loadCsvAndStartPlayback() {
  console.log(`📂 Loading flight data from ${CSV_FILE}...`);
  fs.createReadStream(CSV_FILE)
    .pipe(csv())
    .on('data', (data) => flightData.push(data))
    .on('end', () => {
      console.log(`📊 Loaded ${flightData.length} telemetry records. Starting playback...`);
      playbackNextRow();
    });
}

function playbackNextRow() {
  if (currentIndex >= flightData.length) {
    console.log(`🏁 Flight path complete. Drone returning to base.`);
    client.end();
    return;
  }

  const row = flightData[currentIndex];
  batteryLevel = Math.max(0, batteryLevel - 0.5);

  const telemetry = {
    uuid: DRONE_UUID,
    state: batteryLevel < 20 ? 'LOW_BATTERY' : 'GATHERING_DATA',
    batteryLevel: Number(batteryLevel.toFixed(1)),
    rssi: -50,
    location: {
      lat: Number(row.latitude),
      lng: Number(row.longitude),
    },
    airQuality: {
      pm25: Number(row.pm25),
      co2: Number(row.co2),
      no2: Number(row.no2),
      temperature: Number(row.temperature),
      humidity: Number(row.humidity),
    },
    timestamp: new Date().toISOString(),
  };

  const payload = { fleet: [telemetry] };

  client.publish(TOPIC, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error(`⚠️ Publish failed:`, err.message);
    } else {
      console.log(`📡 [${new Date().toLocaleTimeString()}] Sent row ${currentIndex + 1}/${flightData.length} | PM2.5: ${telemetry.airQuality.pm25} | Lat: ${telemetry.location.lat}`);
    }
  });

  currentIndex++;

  // Wait 2 seconds before sending the next row to simulate physical movement
  setTimeout(playbackNextRow, 2000);
}
