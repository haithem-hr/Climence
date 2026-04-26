export const UserRole = {
  ADMINISTRATOR: 'administrator',
  ANALYST: 'analyst',
  VIEWER: 'viewer',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

export interface AuthPermissions {
  canViewTelemetry: boolean;
  canViewAnalytics: boolean;
  canViewAlerts: boolean;
  canIngestTelemetry: boolean;
  canManageAlerts: boolean;
  canManageAlertThresholds: boolean;
  canExportReports: boolean;
  canManageSensors: boolean;
}

export type AuthPermission = keyof AuthPermissions;

export interface AuthMeResponse {
  user: AuthUser;
  permissions: AuthPermissions;
}

// Login lockout policy (UC-A6 / FR-02). Lives in shared so the frontend can
// surface countdowns / messaging consistently with the server-side enforcement.
export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_FAILURE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes sliding window
export const LOGIN_LOCK_MS = 15 * 60 * 1000;           // 15 minute lock after threshold
