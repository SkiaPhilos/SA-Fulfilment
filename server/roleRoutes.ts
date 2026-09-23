/**
 * Roles & Permissions Management API Routes
 * Handles role listing, custom role creation with privilege containment, and permission auditing.
 */

import { Router, Request, Response } from 'express';
import { getDb, withTransaction } from './db.js';
import { generateId } from './security.js';
import { requirePermission } from './middleware.js';
import { logAudit } from './audit.js';
import { SYSTEM_PERMISSIONS, SYSTEM_ROLE_ADMIN } from './permissions.js';
import { validatePrivilegeContainment, getRolePermissions } from './rbac.js';

export const roleRouter = Router();

// GET /api/roles/permissions (Permission catalog)
roleRouter.get('/permissions', requirePermission('roles.view'), (_req: Request, res: Response) => {
  // Group permissions by module for structured UI display
  const modules: Record<string, typeof SYSTEM_PERMISSIONS> = {};
  SYSTEM_PERMISSIONS.forEach(p => {
    if (!modules[p.module]) modules[p.module] = [];
    modules[p.module].push(p);
  });

  res.json({
    permissions: SYSTEM_PERMISSIONS,
    grouped: modules
  });
});

// GET /api/roles (List all roles with permissions and user counts)
roleRouter.get('/', requirePermission('roles.view'), (_req: Request, res: Response) => {
  const db = getDb();

  const roles = db.roles.map(role => {
    const permissions = getRolePermissions(role.id, db);
    const assignedUserCount = db.users.filter(u => u.role_id === role.id).length;

    return {
      ...role,
      permissions,
      assignedUserCount
    };
  });

  res.json({ roles });
});

// POST /api/roles (Create custom role with privilege containment)
roleRouter.post('/', requirePermission('roles.manage'), async (req: Request, res: Response) => {
  const { name, description, permissions } = req.body;

  if (!name || !description || !Array.isArray(permissions)) {
    res.status(400).json({ error: 'Role name, description, and permissions array are required.' });
    return;
  }

  const cleanName = name.trim();
  const db = getDb();

  if (db.roles.some(r => r.name.toLowerCase() === cleanName.toLowerCase())) {
    res.status(409).json({ error: 'A role with this name already exists.' });
    return;
  }

  // Validate that all requested permissions exist in system catalog
  const validCodes = new Set(SYSTEM_PERMISSIONS.map(p => p.code));
  const invalidCodes = permissions.filter(p => !validCodes.has(p));
  if (invalidCodes.length > 0) {
    res.status(400).json({ error: `Invalid permission codes: ${invalidCodes.join(', ')}` });
    return;
  }

  // PRIVILEGE CONTAINMENT: Cannot assign permissions not held by acting user
  const containmentCheck = validatePrivilegeContainment(
    req.user!.role_id,
    req.user!.permissions,
    permissions
  );

  if (!containmentCheck.allowed) {
    res.status(403).json({
      error: 'Privilege containment violation: You cannot grant permissions exceeding your own clearance.',
      disallowedPermissions: containmentCheck.disallowedCodes
    });
    return;
  }

  const roleId = generateId('role_custom');
  const now = new Date().toISOString();

  const newRole = {
    id: roleId,
    name: cleanName,
    description: description.trim(),
    is_system: false,
    is_active: true,
    created_at: now,
    updated_at: now
  };

  const newRolePermissions = permissions.map(code => ({
    role_id: roleId,
    permission_code: code
  }));

  await withTransaction((database) => {
    database.roles.push(newRole);
    database.role_permissions.push(...newRolePermissions);
  });

  await logAudit({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'ROLE_CREATED',
    entityType: 'ROLE',
    entityId: roleId,
    metadata: {
      name: newRole.name,
      permission_count: permissions.length
    },
    ipAddress: req.ip
  });

  res.status(201).json({
    success: true,
    message: 'Custom role created successfully.',
    role: {
      ...newRole,
      permissions,
      assignedUserCount: 0
    }
  });
});

// PUT /api/roles/:id (Update role permissions and details)
roleRouter.put('/:id', requirePermission('roles.manage'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;

  const db = getDb();
  const existingRole = db.roles.find(r => r.id === id);

  if (!existingRole) {
    res.status(404).json({ error: 'Role not found.' });
    return;
  }

  // System roles cannot be renamed or deleted
  if (existingRole.is_system && name && name.trim() !== existingRole.name) {
    res.status(400).json({ error: 'System roles cannot be renamed.' });
    return;
  }

  // Cannot modify Administrator role permissions
  if (id === SYSTEM_ROLE_ADMIN) {
    res.status(400).json({ error: 'Administrator role permissions are immutable.' });
    return;
  }

  if (Array.isArray(permissions)) {
    // Privilege containment check
    const containmentCheck = validatePrivilegeContainment(
      req.user!.role_id,
      req.user!.permissions,
      permissions
    );

    if (!containmentCheck.allowed) {
      res.status(403).json({
        error: 'Privilege containment violation: You cannot grant permissions exceeding your own authorization.',
        disallowedPermissions: containmentCheck.disallowedCodes
      });
      return;
    }
  }

  const now = new Date().toISOString();
  let updatedRole: any = null;

  await withTransaction((database) => {
    const role = database.roles.find(r => r.id === id)!;
    if (name && !role.is_system) role.name = name.trim();
    if (description) role.description = description.trim();
    role.updated_at = now;

    if (Array.isArray(permissions)) {
      database.role_permissions = database.role_permissions.filter(rp => rp.role_id !== id);
      permissions.forEach(code => {
        database.role_permissions.push({
          role_id: id,
          permission_code: code
        });
      });
    }

    const assignedUserCount = database.users.filter(u => u.role_id === id).length;
    updatedRole = {
      ...role,
      permissions: permissions || getRolePermissions(id, database),
      assignedUserCount
    };
  });

  await logAudit({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'ROLE_UPDATED',
    entityType: 'ROLE',
    entityId: id,
    metadata: {
      role_name: updatedRole.name,
      permission_count: updatedRole.permissions.length
    },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    role: updatedRole
  });
});

// DELETE /api/roles/:id (Delete custom role)
roleRouter.delete('/:id', requirePermission('roles.manage'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const role = db.roles.find(r => r.id === id);

  if (!role) {
    res.status(404).json({ error: 'Role not found.' });
    return;
  }

  if (role.is_system) {
    res.status(400).json({ error: 'System roles are permanently protected and cannot be deleted.' });
    return;
  }

  const assignedUsers = db.users.filter(u => u.role_id === id);
  if (assignedUsers.length > 0) {
    res.status(400).json({
      error: `Cannot delete role. There are ${assignedUsers.length} user(s) currently assigned to this role. Please reassign them first.`
    });
    return;
  }

  await withTransaction((database) => {
    database.roles = database.roles.filter(r => r.id !== id);
    database.role_permissions = database.role_permissions.filter(rp => rp.role_id !== id);
  });

  await logAudit({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'ROLE_DELETED',
    entityType: 'ROLE',
    entityId: id,
    metadata: { role_name: role.name },
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Role deleted successfully.' });
});
