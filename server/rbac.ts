/**
 * Role-Based Access Control & Privilege Containment Utilities
 */

import { DatabaseSchema, CustomerProfileRow } from './db.js';
import { SYSTEM_ROLE_ADMIN } from './permissions.js';

/**
 * Returns all permission codes assigned to a given role.
 */
export function getRolePermissions(roleId: string, db: DatabaseSchema): string[] {
  return db.role_permissions
    .filter((rp) => rp.role_id === roleId)
    .map((rp) => rp.permission_code);
}

/**
 * Returns all permission codes for a given user.
 * Administrator role automatically possesses all system permissions.
 */
export function getUserPermissions(userId: string, db: DatabaseSchema): string[] {
  const user = db.users.find((u) => u.id === userId);
  if (!user) return [];

  if (user.role_id === SYSTEM_ROLE_ADMIN) {
    return db.permissions.map((p) => p.code);
  }

  return getRolePermissions(user.role_id, db);
}

/**
 * Enforces privilege containment:
 * A user cannot assign a permission or a role with permissions that exceed their own permissions.
 * System administrators are exempt because they hold all permissions.
 */
export function validatePrivilegeContainment(
  actingUserRole: string,
  actingUserPermissions: string[],
  requestedPermissionCodes: string[]
): { allowed: boolean; disallowedCodes: string[] } {
  if (actingUserRole === SYSTEM_ROLE_ADMIN) {
    return { allowed: true, disallowedCodes: [] };
  }

  const disallowedCodes = requestedPermissionCodes.filter(
    (code) => !actingUserPermissions.includes(code)
  );

  return {
    allowed: disallowedCodes.length === 0,
    disallowedCodes
  };
}

/**
 * Locates the customer profile associated with a user account.
 */
export function getCustomerForUser(userId: string, db: DatabaseSchema): CustomerProfileRow | null {
  return db.customer_profiles.find((cp) => cp.user_id === userId) || null;
}
