import type { AuthPermission, AuthPermissions, AuthUser, UserRole as UserRoleType } from '@climence/shared';
import { UserRole } from '@climence/shared';

const ALL_ROLES = [
  UserRole.ADMINISTRATOR,
  UserRole.ANALYST,
  UserRole.VIEWER,
] satisfies UserRoleType[];

export const ROLE_PERMISSIONS: Record<UserRoleType, AuthPermissions> = {
  [UserRole.ADMINISTRATOR]: {
    canViewTelemetry: true,
    canViewAnalytics: true,
    canViewAlerts: true,
    canIngestTelemetry: true,
    canManageAlerts: true,
    canManageAlertThresholds: true,
    canExportReports: true,
    canManageSensors: true,
  },
  [UserRole.ANALYST]: {
    canViewTelemetry: true,
    canViewAnalytics: true,
    canViewAlerts: true,
    canIngestTelemetry: true,
    canManageAlerts: true,
    canManageAlertThresholds: false,
    canExportReports: true,
    canManageSensors: false,
  },
  [UserRole.VIEWER]: {
    canViewTelemetry: true,
    canViewAnalytics: true,
    canViewAlerts: true,
    canIngestTelemetry: false,
    canManageAlerts: false,
    canManageAlertThresholds: false,
    canExportReports: false,
    canManageSensors: false,
  },
};

export function getPermissionsForRole(role: UserRoleType): AuthPermissions {
  return { ...ROLE_PERMISSIONS[role] };
}

export function getPermissionsForUser(user: AuthUser): AuthPermissions {
  return getPermissionsForRole(user.role);
}

export function rolesForPermission(permission: AuthPermission): UserRoleType[] {
  return ALL_ROLES.filter(role => ROLE_PERMISSIONS[role][permission]);
}
