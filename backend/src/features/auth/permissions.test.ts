import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UserRole } from '@climence/shared';
import { getPermissionsForRole, rolesForPermission } from './permissions';

describe('auth permissions', () => {
  it('keeps viewers read-only', () => {
    const permissions = getPermissionsForRole(UserRole.VIEWER);

    assert.equal(permissions.canViewTelemetry, true);
    assert.equal(permissions.canViewAlerts, true);
    assert.equal(permissions.canIngestTelemetry, false);
    assert.equal(permissions.canManageAlerts, false);
    assert.equal(permissions.canManageAlertThresholds, false);
    assert.equal(permissions.canExportReports, false);
  });

  it('allows analysts to ingest telemetry and manage alert lifecycle, not thresholds', () => {
    const permissions = getPermissionsForRole(UserRole.ANALYST);

    assert.equal(permissions.canIngestTelemetry, true);
    assert.equal(permissions.canManageAlerts, true);
    assert.equal(permissions.canManageAlertThresholds, false);
  });

  it('maps permissions to the roles accepted by route guards', () => {
    assert.deepEqual(rolesForPermission('canViewAlerts'), [
      UserRole.ADMINISTRATOR,
      UserRole.ANALYST,
      UserRole.VIEWER,
    ]);
    assert.deepEqual(rolesForPermission('canIngestTelemetry'), [
      UserRole.ADMINISTRATOR,
      UserRole.ANALYST,
    ]);
    assert.deepEqual(rolesForPermission('canManageAlertThresholds'), [
      UserRole.ADMINISTRATOR,
    ]);
  });
});
