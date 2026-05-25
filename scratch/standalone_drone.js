const mqtt = require('mqtt');

// Configuration
const BROKER_URL = 'mqtt://localhost:1883'; 
const TOPIC = 'climence/telemetry';
const DRONE_UUID = `STANDALONE-MQTT-DRONE-${Math.floor(Math.random() * 1000)}`;
const MQTT_USERNAME = 'drone';
const MQTT_PASSWORD = 'flight123';

// State
let batteryLevel = 100;
let localBuffer = []; // Our offline buffer
let isConnected = false;

// Connect to the broker
const client = mqtt.connect(BROKER_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clientId: DRONE_UUID,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 2000, // keep trying to reconnect every 2s if network drops
});

client.on('connect', () => {
  isConnected = true;
  console.log(`✅ Connected to MQTT broker at ${BROKER_URL}`);
  
  // If we have buffered data, send it all now
  if (localBuffer.length > 0) {
    console.log(`🔄 Reconnected! Flushing ${localBuffer.length} buffered telemetry records...`);
    
    // We can send the whole buffer as one fleet payload
    const payload = { fleet: localBuffer };
    client.publish(TOPIC, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (!err) {
        console.log(`✅ Flushed offline buffer successfully.`);
        localBuffer = []; // Clear buffer after successful publish
      } else {
        console.error('❌ Failed to publish buffer:', err);
      }
    });
  }
});

client.on('offline', () => {
  if (isConnected) {
    console.log(`⚠️ Network connection lost. Switching to offline buffering mode.`);
    isConnected = false;
  }
});

client.on('error', (err) => {
  console.error(`❌ MQTT Error:`, err.message);
});

// Generate realistic dummy telemetry
function generateTelemetry() {
  batteryLevel = Math.max(0, batteryLevel - 0.5);
  const lat = 24.7136 + (Math.random() - 0.5) * 0.1;
  const lng = 46.6753 + (Math.random() - 0.5) * 0.1;

  return {
    uuid: DRONE_UUID,
    state: batteryLevel < 20 ? 'LOW_BATTERY' : 'GATHERING_DATA',
    batteryLevel: Number(batteryLevel.toFixed(1)),
    rssi: -50 - Math.floor(Math.random() * 20),
    location: {
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
    },
    airQuality: {
      pm25: Number((15 + Math.random() * 10).toFixed(2)),
      co2: Number((400 + Math.random() * 50).toFixed(2)),
      no2: Number((20 + Math.random() * 5).toFixed(2)),
      temperature: Number((35 + Math.random() * 5).toFixed(2)),
      humidity: Number((20 + Math.random() * 10).toFixed(2)),
    },
    timestamp: new Date().toISOString(),
  };
}

// Main transmission loop
function transmitData() {
  const telemetry = generateTelemetry();
  
  if (isConnected) {
    // Send immediately via MQTT Publish
    // QoS 1 ensures the broker acknowledges receipt
    const payload = { fleet: [telemetry] };
    client.publish(TOPIC, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.warn(`⚠️ Publish failed, buffering data...`);
        localBuffer.push(telemetry);
      } else {
        console.log(`📡 [${new Date().toLocaleTimeString()}] Sent live telemetry | PM2.5: ${telemetry.airQuality.pm25}`);
      }
    });
  } else {
    // We are offline, push to the local buffer array
    localBuffer.push(telemetry);
    console.log(`📴 [${new Date().toLocaleTimeString()}] Offline. Buffered telemetry. Total buffer size: ${localBuffer.length}`);
  }

  // Loop every 5 seconds
  if (batteryLevel > 0) {
    setTimeout(transmitData, 5000);
  } else {
    console.log('🪫 Drone battery depleted. Shutting down.');
    client.end();
  }
}

console.log(`🚀 Starting standalone MQTT drone simulator: ${DRONE_UUID}`);
console.log(`⏳ Waiting for initial connection...`);
transmitData();
