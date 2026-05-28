const fs = require('fs');

function rewriteCSV(filename) {
    const content = fs.readFileSync(filename, 'utf-8');
    const lines = content.trim().split('\n');
    const header = lines[0];
    
    const newLines = [header];
    
    // Calculate bounding box
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const parts = line.split(',');
        const lat = parseFloat(parts[1]);
        const lng = parseFloat(parts[2]);
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    }
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const parts = line.split(',');
        const droneId = parts[0];
        const lat = parseFloat(parts[1]);
        const lng = parseFloat(parts[2]);
        
        const basePm25 = parseFloat(parts[3]);
        const baseCo2 = parseFloat(parts[4]);
        const baseNo2 = parseFloat(parts[5]);
        const baseTemp = parseFloat(parts[6]);
        const baseHum = parseFloat(parts[7]);
        
        // Normalize coordinates to 0-1
        const normLat = (lat - minLat) / (maxLat - minLat || 1);
        const normLng = (lng - minLng) / (maxLng - minLng || 1);
        
        // Create a spatial multiplier that varies across the map
        const spatialMultiplier1 = Math.sin(normLat * Math.PI) * Math.cos(normLng * Math.PI); // -1 to 1
        const spatialMultiplier2 = Math.sin(normLng * Math.PI * 2) * Math.cos(normLat * Math.PI * 2); // -1 to 1
        const combinedSpatial = (spatialMultiplier1 + spatialMultiplier2 + 2) / 4; // 0 to 1
        
        // Hotspot 1: South-East (Industrial Area approximation)
        const distSouthEast = Math.sqrt(Math.pow(normLat - 0.2, 2) + Math.pow(normLng - 0.8, 2));
        const hotspot1 = Math.max(0, 1 - distSouthEast * 2.5); // 0 to 1
        
        // Hotspot 2: Center-West (Heavy traffic approximation)
        const distCenterWest = Math.sqrt(Math.pow(normLat - 0.6, 2) + Math.pow(normLng - 0.3, 2));
        const hotspot2 = Math.max(0, 1 - distCenterWest * 3.0); // 0 to 1
        
        // Final pollution scalar ranges roughly from 1.0 to 4.5 depending on location
        const pollutionScalar = 1.0 + (combinedSpatial * 1.5) + (hotspot1 * 3.0) + (hotspot2 * 2.0);
        
        const pm25 = Math.max(10, basePm25 * pollutionScalar + (Math.random() - 0.5) * 5).toFixed(1);
        const co2 = (baseCo2 * (1 + combinedSpatial * 0.2) + (Math.random() - 0.5) * 10).toFixed(1);
        const no2 = Math.max(5, baseNo2 * pollutionScalar * 0.8 + (Math.random() - 0.5) * 5).toFixed(1);
        
        // Temperature varies mostly from South to North
        const temp = (36 + (normLat * 4) + (Math.random() * 1)).toFixed(1);
        // Humidity varies somewhat
        const hum = (10 + ((1 - normLat) * 10) + (Math.random() * 2)).toFixed(1);
        
        newLines.push(`${droneId},${lat.toFixed(5)},${lng.toFixed(5)},${pm25},${co2},${no2},${temp},${hum}`);
    }
    
    fs.writeFileSync(filename, newLines.join('\n'));
    console.log(`Rewrote ${filename} with spatial hotspots`);
}

rewriteCSV('data/fleet_flight_paths.csv');
