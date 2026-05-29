import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { API_PORT } from '@climence/shared';
import authRouter from './routes/auth';
import alertsRouter from './routes/alerts';
import analyticsRouter from './routes/analytics';
import telemetryRouter from './routes/telemetry';
import missionsRouter from './routes/missions';
import healthRouter from './routes/health';
import { setupWebSocket } from './ws';
import { startOpenMeteoPolling } from './features/analytics/openMeteo';
import { setupMqttBroker } from './mqtt';
import { startBackupScheduler } from './features/backup/scheduler';
import { logger } from './lib/logger';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/missions', missionsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api', healthRouter);

const server = createServer(app);
setupWebSocket(server);
startOpenMeteoPolling();
startBackupScheduler();
await setupMqttBroker(1883);

server.listen(API_PORT, () => {
  logger.info('Central Ingestion API listening', { url: `http://localhost:${API_PORT}` });
  logger.info('WebSocket channel ready', { url: `ws://localhost:${API_PORT}/ws/telemetry` });
});
