import type { Server as HttpServer } from 'node:http';
import { URL } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { WS_PATH, type ServerMessage } from '@climence/shared';
import { computeSnapshot } from './db/queries';
import { verifyAuthToken } from './features/auth/token';
import { logger } from './lib/logger';

let wss: WebSocketServer | null = null;
// Keep semantics consistent with requireAuth(): only bypass when explicitly enabled.
const AUTH_BYPASS_ENABLED = process.env.CLIMENCE_AUTH_BYPASS === '1';

export function setupWebSocket(server: HttpServer) {
  wss = new WebSocketServer({ server, path: WS_PATH });

  wss.on('connection', (socket: WebSocket, request) => {
    const token = extractToken(request.url, request.headers.authorization);
    const user = AUTH_BYPASS_ENABLED
      ? { id: 'user-1', role: 'administrator', email: 'admin@climence.com', name: 'Admin' }
      : token
        ? verifyAuthToken(token)
        : null;
    if (!user) {
      socket.close(1008, 'Unauthorized');
      return;
    }

  logger.info('[ws] client connected', { total: wss?.clients.size ?? 0 });
    // Hydrate the new client with the current snapshot immediately.
    sendSnapshot(socket);

    socket.on('close', () => {
      logger.info('[ws] client disconnected', { total: wss?.clients.size ?? 0 });
    });
  });

  return wss;
}

function extractToken(requestUrl: string | undefined, authorizationHeader: string | undefined) {
  if (requestUrl) {
    const url = new URL(requestUrl, 'http://localhost');
    const queryToken = url.searchParams.get('token');
    if (queryToken) return queryToken;
  }

  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

function sendSnapshot(socket: WebSocket) {
  if (socket.readyState !== socket.OPEN) return;
  const msg: ServerMessage = { type: 'snapshot', data: computeSnapshot() };
  socket.send(JSON.stringify(msg));
}

// Broadcast a freshly-computed snapshot to every connected dashboard.
// Called from the telemetry POST handler after a successful insert.
export function broadcastSnapshot() {
  if (!wss || wss.clients.size === 0) return;
  const msg: ServerMessage = { type: 'snapshot', data: computeSnapshot() };
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}
