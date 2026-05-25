const fs = require('fs');
const path = require('path');

const NUM_DRONES = 25;
const ROWS_PER_DRONE = 50; // Total 1250 rows
const OUT_FILE = path.join(__dirname, '../data/fleet_flight_paths.csv');

// Riyadh bounds
const MIN_LAT = 24.6;
const MAX_LAT = 24.8;
const MIN_LNG = 46.5;
const MAX_LNG = 46.8;

const stream = fs.createWriteStream(OUT_FILE);
stream.write('droneId,latitude,longitude,pm25,co2,no2,temperature,humidity\n');

for (let i = 0; i < NUM_DRONES; i++) {
  // Each drone gets a random starting point
  let lat = MIN_LAT + Math.random() * (MAX_LAT - MIN_LAT);
  let lng = MIN_LNG + Math.random() * (MAX_LNG - MIN_LNG);
  
  // Each drone has a different baseline pollution
  let basePm25 = 10 + Math.random() * 20;
  let baseCo2 = 400 + Math.random() * 50;
  
  // Drone moves in a consistent direction
  let latStep = (Math.random() - 0.5) * 0.002;
  let lngStep = (Math.random() - 0.5) * 0.002;

  for (let r = 0; r < ROWS_PER_DRONE; r++) {
    lat += latStep;
    lng += lngStep;
    
    // Slight jitter in pollution readings
    let pm25 = basePm25 + (Math.random() - 0.5) * 5;
    let co2 = baseCo2 + (Math.random() - 0.5) * 15;
    let no2 = 20 + pm25 * 0.5 + (Math.random() - 0.5) * 2;
    let temp = 35 + (Math.random() - 0.5);
    let hum = 20 + (Math.random() - 0.5) * 2;

    // Simulate hitting a hotspot in the middle of the flight
    if (r > 20 && r < 30) {
      pm25 += 40;
      co2 += 100;
    }

    stream.write(`${i},${lat.toFixed(5)},${lng.toFixed(5)},${pm25.toFixed(1)},${co2.toFixed(1)},${no2.toFixed(1)},${temp.toFixed(1)},${hum.toFixed(1)}\n`);
  }
}

stream.end();
console.log(`✅ Generated dataset with ${NUM_DRONES * ROWS_PER_DRONE} records at ${OUT_FILE}`);
