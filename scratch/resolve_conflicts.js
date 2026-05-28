const fs = require('fs');

function keepTheirs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const result = [];
  let inOurs = false;
  let inTheirs = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('<<<<<<<')) {
      inOurs = true;
    } else if (line.startsWith('=======')) {
      inOurs = false;
      inTheirs = true;
    } else if (line.startsWith('>>>>>>>')) {
      inTheirs = false;
    } else {
      if (!inOurs) {
        result.push(line);
      }
    }
  }

  fs.writeFileSync(filePath, result.join('\n'));
}

keepTheirs('simulator/src/DroneDevice.ts');
keepTheirs('simulator/src/FleetManager.ts');
console.log('Resolved DroneDevice.ts and FleetManager.ts');
