import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { API_PORT } from '@climence/shared';
import authRouter from './routes/auth';
import alertsRouter from './routes/alerts';
import analyticsRouter from './routes/analytics';
import telemetryRouter from './routes/telemetry';
import { setupWebSocket } from './ws';
import { startOpenMeteoPolling } from './features/analytics/openMeteo';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/alerts', alertsRouter);

const server = createServer(app);
setupWebSocket(server);
startOpenMeteoPolling();

server.listen(API_PORT, () => {
  console.log(`Central Ingestion API listening on http://localhost:${API_PORT}`);
  console.log(`WebSocket channel ready on ws://localhost:${API_PORT}/ws/telemetry`);
});
