import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { NextFunction, Request, Response } from 'express';
import { UserRole, type AuthUser } from '@climence/shared';
import { createAuthToken } from '../features/auth/token';
import { rolesForPermission } from '../features/auth/permissions';
import { requireAuth, requireRole } from '../lib/auth';
import { getCurrentUser } from './auth';

const USERS: Record<'admin' | 'analyst' | 'viewer', AuthUser> = {
  admin: {
    id: 'u-admin',
    name: 'Riyadh Admin',
    email: 'admin@mewa.gov.sa',
    role: UserRole.ADMINISTRATOR,
  },
  analyst: {
    id: 'u-analyst',
    name: 'Riyadh Analyst',
    email: 'analyst@mewa.gov.sa',
    role: UserRole.ANALYST,
  },
  viewer: {
    id: 'u-viewer',
    name: 'Riyadh Viewer',
    email: 'viewer@mewa.gov.sa',
    role: UserRole.VIEWER,
  },
};

const TOKENS = {
  admin: createAuthToken(USERS.admin).token,
  analyst: createAuthToken(USERS.analyst).token,
  viewer: createAuthToken(USERS.viewer).token,
};

interface MockResponse {
  body: unknown;
  statusCode: number;
  json(payload: unknown): MockResponse;
  send(): MockResponse;
  setHeader(): MockResponse;
  status(code: number): MockResponse;
}

function mockRequest(authHeader?: string, user?: AuthUser) {
  return {
    authUser: user,
    header(name: string) {
      return name.toLowerCase() === 'authorization' ? authHeader : undefined;
    },
  } as Request;
}

function mockResponse() {
  const res: MockResponse = {
    body: undefined,
    statusCode: 200,
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send() {
      return this;
    },
    setHeader() {
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };

  return res;
}

function runRequireAuth(authHeader?: string) {
  const req = mockRequest(authHeader);
  const res = mockResponse();
  let nextCalled = false;

  requireAuth(req, res as unknown as Response, (() => {
    nextCalled = true;
  }) as NextFunction);

  return { req, res, nextCalled };
}

function runRequireRole(user: AuthUser | undefined, allowedRoles: UserRole[]) {
  const req = mockRequest(undefined, user);
  const res = mockResponse();
  let nextCalled = false;

  requireRole(...allowedRoles)(req, res as unknown as Response, (() => {
    nextCalled = true;
  }) as NextFunction);

  return { res, nextCalled };
}

describe('route RBAC', () => {
  it('requires a valid bearer token before protected handlers run', () => {
    const missing = runRequireAuth();
    assert.equal(missing.nextCalled, false);
    assert.equal(missing.res.statusCode, 401);

    const invalid = runRequireAuth('Bearer not-a-valid-token');
    assert.equal(invalid.nextCalled, false);
    assert.equal(invalid.res.statusCode, 401);

    const valid = runRequireAuth(`Bearer ${TOKENS.viewer}`);
    assert.equal(valid.nextCalled, true);
    assert.deepEqual(valid.req.authUser, USERS.viewer);
  });

  it('returns user permissions from /api/auth/me', () => {
    const req = mockRequest(undefined, USERS.viewer);
    const res = mockResponse();

    getCurrentUser(req, res as unknown as Response);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      user: USERS.viewer,
      permissions: {
        canViewTelemetry: true,
        canViewAnalytics: true,
        canViewAlerts: true,
        canIngestTelemetry: false,
        canManageAlerts: false,
        canManageAlertThresholds: false,
        canExportReports: false,
        canManageSensors: false,
      },
    });
  });

  it('allows every role to read alerts, analytics, and telemetry', () => {
    for (const permission of ['canViewAlerts', 'canViewAnalytics', 'canViewTelemetry'] as const) {
      const allowedRoles = rolesForPermission(permission);

      for (const user of Object.values(USERS)) {
        const result = runRequireRole(user, allowedRoles);
        assert.equal(result.nextCalled, true, `${user.role} should pass ${permission}`);
      }
    }
  });

  it('blocks viewer write access while allowing analyst telemetry ingestion', () => {
    const allowedRoles = rolesForPermission('canIngestTelemetry');

    const missing = runRequireRole(undefined, allowedRoles);
    assert.equal(missing.nextCalled, false);
    assert.equal(missing.res.statusCode, 401);

    const viewer = runRequireRole(USERS.viewer, allowedRoles);
    assert.equal(viewer.nextCalled, false);
    assert.equal(viewer.res.statusCode, 403);

    const analyst = runRequireRole(USERS.analyst, allowedRoles);
    assert.equal(analyst.nextCalled, true);
  });

  it('limits alert threshold changes to administrators', () => {
    const allowedRoles = rolesForPermission('canManageAlertThresholds');

    for (const user of [USERS.viewer, USERS.analyst]) {
      const forbidden = runRequireRole(user, allowedRoles);
      assert.equal(forbidden.nextCalled, false);
      assert.equal(forbidden.res.statusCode, 403);
    }

    const admin = runRequireRole(USERS.admin, allowedRoles);
    assert.equal(admin.nextCalled, true);
  });
});
