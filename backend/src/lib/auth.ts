import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@climence/shared';
import { verifyAuthToken } from '../features/auth/token';
import { sendForbidden, sendUnauthorized } from './http';

const AUTH_BYPASS_ENABLED = process.env.CLIMENCE_AUTH_BYPASS !== '0';

function extractBearerToken(req: Request) {
  const authHeader = req.header('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (AUTH_BYPASS_ENABLED) {
    req.authUser = { id: 'user-1', role: 'administrator', email: 'admin@climence.com', name: 'Admin' };
    next();
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    sendUnauthorized(res, 'Authentication required.');
    return;
  }

  const user = verifyAuthToken(token);
  if (!user) {
    sendUnauthorized(res, 'Invalid or expired token.');
    return;
  }

  req.authUser = user;
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      sendUnauthorized(res, 'Authentication required.');
      return;
    }

    if (!allowedRoles.includes(req.authUser.role)) {
      sendForbidden(res, 'Insufficient permissions.');
      return;
    }

    next();
  };
}
