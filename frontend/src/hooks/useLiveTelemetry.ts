import { useEffect, useState } from 'react';
import { type ServerMessage, type TelemetrySnapshot } from '@climence/shared';
import { wsUrlForToken } from '../lib/runtime-config';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting';

const EMPTY_SNAPSHOT: TelemetrySnapshot = {
  drones: [],
  alerts: [],
  cityTrend: [],
  hotspots: [],
  alertThresholdPm25: 140,
  emittedAt: '',
};

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;



export function useLiveTelemetry(token: string | null) {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>(EMPTY_SNAPSHOT);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    if (!token) return;

    let socket: WebSocket | null = null;
    let retryMs = INITIAL_RETRY_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      setStatus(prev => (prev === 'open' ? 'reconnecting' : 'connecting'));
      socket = new WebSocket(wsUrlForToken(token));

      socket.onopen = () => {
        retryMs = INITIAL_RETRY_MS;
        setStatus('open');
      };

      socket.onmessage = event => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          if (msg.type === 'snapshot') setSnapshot(msg.data);
        } catch (err) {
          console.error('[ws] bad message frame', err);
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        setStatus('reconnecting');
        reconnectTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      };

      socket.onerror = () => {
        // onclose fires after onerror; rely on that for retry scheduling.
        socket?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [token]);

  return { snapshot, status };
}
