import WebSocket from 'ws';
import { createAuthToken } from './backend/src/features/auth/token.ts';

const token = createAuthToken({ id: 'u-analyst', name: 'Analyst', email: 'test@mewa.gov.sa', role: 'analyst' });

const ws = new WebSocket(`ws://localhost:3002/ws/telemetry?token=${token.token}`);

ws.on('open', () => {
    console.log('Connected to WS');
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'snapshot') {
        console.log('Received snapshot');
        console.log('Threshold:', msg.data.alertThresholdPm25);
        console.log('Alerts count:', msg.data.alerts.length);
        if (msg.data.alerts.length > 0) {
            console.log('First alert:', msg.data.alerts[0].pm25);
        }
        process.exit(0);
    }
});

ws.on('error', (err) => {
    console.error('WS Error:', err);
});
