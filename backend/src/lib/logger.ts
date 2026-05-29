type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL: Level = (process.env.CLIMENCE_LOG_LEVEL as Level) ?? 'info';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function shouldLog(level: Level) {
  return ORDER[level] >= ORDER[LEVEL];
}

function line(level: Level, msg: string, meta?: unknown) {
  const base = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta !== undefined ? { meta } : {}),
  };
  return JSON.stringify(base);
}

export const logger = {
  debug(msg: string, meta?: unknown) {
    if (shouldLog('debug')) console.debug(line('debug', msg, meta));
  },
  info(msg: string, meta?: unknown) {
    if (shouldLog('info')) console.info(line('info', msg, meta));
  },
  warn(msg: string, meta?: unknown) {
    if (shouldLog('warn')) console.warn(line('warn', msg, meta));
  },
  error(msg: string, meta?: unknown) {
    if (shouldLog('error')) console.error(line('error', msg, meta));
  },
};
