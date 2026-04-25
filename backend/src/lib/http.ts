import type { Response } from 'express';

export function sendBadRequest(res: Response, error: string) {
  res.status(400).json({ error });
}

export function sendUnauthorized(res: Response, error: string) {
  res.status(401).json({ error });
}

export function sendForbidden(res: Response, error: string) {
  res.status(403).json({ error });
}

export function sendNotFound(res: Response, error: string) {
  res.status(404).json({ error });
}

export function sendTooManyRequests(res: Response, error: string, retryAfterSec: number) {
  // Retry-After lets browsers + curl honor the lock window without polling.
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterSec))));
  res.status(429).json({ error, retryAfterSec });
}

export function sendInternalError(res: Response, context: string, err: unknown) {
  console.error(`${context}:`, err);
  res.status(500).json({ error: 'Internal server error' });
}
