/**
 * Employee Management & Profile Completeness API Routes
 * Handles staff creation, privilege containment verification, onboarding, and documentation tracking.
 */

import { Router, Request, Response } from 'express';
import { getFreshDb, getDb, withTransaction } from './db.js';
import { hashPassword, generateId } from './security.js';
import { requireAuth, requirePermission } from './middleware.js';
import { logAudit } from './audit.js';
import { computeEmployeeCompleteness } from './completeness.js';
import { validatePrivilegeContainment, getRolePermissions } from './rbac.js';
import { SYSTEM_ROLE_ADMIN, SYSTEM_ROLE_EMPLOYEE } from './permissions.js';

export const employeeRouter = Router();

// GET /api/employees (List all staff members)
employeeRouter.get('/', requirePermission('employees.view'), async (req: Request, res: Response) => {
  const db = await getFreshDb();
  const { department, search, status } = req.query;

  let employees = db.users
    .filter(u => u.account_type === 'staff')
    .map(user => {
      const profile = db.employee_profiles.find(ep => ep.user_id === user.id);
      const role = db.roles.find(r => r.id === user.role_id);
      const completeness = profile ? computeEmployeeCompleteness(user, profile) : null;

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          status: user.status,
          role_id: user.role_id,
          role_name: role ? role.name : 'Unknown',
          created_at: user.created_at
        },
        profile: profile || null,
        completeness
      };
    });

  if (department && typeof department === 'string') {
    employees = employees.filter(e => e.profile?.department.toLowerCase() === department.toLowerCase());
  }

  if (status && typeof status === 'string') {
    employees = employees.filter(e => e.user.status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    employees = employees.filter(e =>
      e.user.name.toLowerCase().includes(q) ||
      e.user.email.toLowerCase().includes(q) ||
      e.profile?.designation.toLowerCase().includes(q) ||
      e.profile?.department.toLowerCase().includes(q)
    );
  }

  // Sort by name
  employees.sort((a, b) => a.user.name.localeCompare(b.user.name));

  res.json({ employees });
});

// POST /api/employees (Create new employee with privilege containment)
employeeRouter.post('/', requirePermission('employees.create'), async (req: Request, res: Response) => {
  const {
    name,
    email,
    password,
    phone,
    role_id,
    designation,
    department,
    joining_date,
    cnic,
    address,
    city
  } = req.body;

  if (!name || !email || !password || !designation || !department) {
    res.status(400).json({ error: 'Name, email, password, designation, and department are required.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Temporary password must be at least 8 characters long.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = await getFreshDb();

  if (db.users.some(u => u.email === cleanEmail)) {
    res.status(409).json({ error: 'An account with this email address already exists.' });
    return;
  }

  const assignedRoleId = role_id || SYSTEM_ROLE_EMPLOYEE;
  const targetRole = db.roles.find(r => r.id === assignedRoleId);
  if (!targetRole) {
    res.status(400).json({ error: 'Specified role does not exist.' });
    return;
  }

  // ENFORCE PRIVILEGE CONTAINMENT:
  // Check that the acting user holds every permission granted by the target role
  const targetRolePerms = getRolePermissions(assignedRoleId, db);
  const containmentCheck = validatePrivilegeContainment(
    req.user!.role_id,
    req.user!.permissions,
    targetRolePerms
  );

  if (!containmentCheck.allowed) {
    res.status(403).json({
      error: 'Privilege containment violation: You cannot assign a role with permissions exceeding your own authorization.',
      disallowedPermissions: containmentCheck.disallowedCodes
    });
    return;
  }

  const { hash, salt } = hashPassword(password);
  const userId = generateId('usr');
  const profileId = generateId('emp');
  const now = new Date().toISOString();

  const newUser = {
    id: userId,
    email: cleanEmail,
    password_hash: hash,
    password_salt: salt,
    name: name.trim(),
    phone: phone ? phone.trim() : undefined,
    role_id: assignedRoleId,
    account_type: 'staff' as const,
    status: 'active' as const,
    created_at: now,
    updated_at: now
  };

  const newProfile = {
    id: profileId,
    user_id: userId,
    designation: designation.trim(),
    department: department.trim(),
    joining_date: joining_date || now.split('T')[0],
    cnic: cnic ? cnic.trim() : '',
    phone: phone ? phone.trim() : '',
    address: address ? address.trim() : '',
    city: city ? city.trim() : '',
    cv_uploaded: false,
    cnic_uploaded: false,
    completeness_score: 0,
    created_at: now,
    updated_at: now
  };

  const completeness = computeEmployeeCompleteness(newUser, newProfile);
  newProfile.completeness_score = completeness.score;

  await withTransaction((database) => {
    database.users.push(newUser);
    database.employee_profiles.push(newProfile);
  });

  await logAudit({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'EMPLOYEE_CREATED',
    entityType: 'EMPLOYEE_PROFILE',
    entityId: profileId,
    metadata: {
      employee_email: cleanEmail,
      role_assigned: assignedRoleId,
      designation: newProfile.designation,
      department: newProfile.department
    },
    ipAddress: req.ip
  });

  res.status(201).json({
    success: true,
    message: 'Employee account created successfully.',
    employee: {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role_id: newUser.role_id,
        role_name: targetRole.name,
        status: newUser.status
      },
      profile: newProfile,
      completeness
    }
  });
});

// GET /api/employees/:id (Single employee view)
employeeRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = await getFreshDb();

  const user = db.users.find(u => (u.id === id || u.email === id) && u.account_type === 'staff');
  if (!user) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }

  // Permission check: Self or staff with employees.view
  if (req.user!.id !== user.id && req.user!.role_id !== SYSTEM_ROLE_ADMIN && !req.user!.permissions.includes('employees.view')) {
    res.status(403).json({ error: "Forbidden: Requires 'employees.view' permission." });
    return;
  }

  const profile = db.employee_profiles.find(ep => ep.user_id === user.id) || null;
  const role = db.roles.find(r => r.id === user.role_id);
  const completeness = profile ? computeEmployeeCompleteness(user, profile) : null;

  res.json({
    employee: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        role_id: user.role_id,
        role_name: role ? role.name : 'Unknown',
        created_at: user.created_at
      },
      profile,
      completeness
    }
  });
});

// PUT /api/employees/:id/profile (Update employee details and KYC documentation)
employeeRouter.put('/:id/profile', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = await getFreshDb();

  const user = db.users.find(u => u.id === id && u.account_type === 'staff');
  if (!user) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }

  const isSelf = req.user!.id === user.id;
  const hasEditPerm = req.user!.role_id === SYSTEM_ROLE_ADMIN || req.user!.permissions.includes('employees.edit');

  if (!isSelf && !hasEditPerm) {
    res.status(403).json({ error: "Forbidden: Requires 'employees.edit' permission." });
    return;
  }

  const {
    name,
    phone,
    designation,
    department,
    joining_date,
    cnic,
    address,
    city,
    emergency_contact_name,
    emergency_contact_phone,
    bank_name,
    bank_account_title,
    bank_iban,
    cv_uploaded,
    cnic_uploaded,
    role_id
  } = req.body;

  // If changing role, must have roles.assign AND privilege containment
  if (role_id && role_id !== user.role_id) {
    if (!hasEditPerm) {
      res.status(403).json({ error: 'You are not authorized to change operational roles.' });
      return;
    }

    const targetRolePerms = getRolePermissions(role_id, db);
    const containmentCheck = validatePrivilegeContainment(
      req.user!.role_id,
      req.user!.permissions,
      targetRolePerms
    );

    if (!containmentCheck.allowed) {
      res.status(403).json({
        error: 'Privilege containment violation: You cannot assign permissions exceeding your own clearance.',
        disallowedPermissions: containmentCheck.disallowedCodes
      });
      return;
    }
  }

  let completenessResult: any = null;
  let updatedEmployee: any = null;

  await withTransaction((database) => {
    const targetUser = database.users.find(u => u.id === id)!;
    let targetProfile = database.employee_profiles.find(ep => ep.user_id === id);

    if (!targetProfile) {
      targetProfile = {
        id: generateId('emp'),
        user_id: id,
        designation: designation || 'Staff Member',
        department: department || 'Operations',
        joining_date: joining_date || new Date().toISOString().split('T')[0],
        cnic: cnic || '',
        phone: phone || '',
        address: address || '',
        city: city || '',
        cv_uploaded: false,
        cnic_uploaded: false,
        completeness_score: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      database.employee_profiles.push(targetProfile);
    }

    if (name) targetUser.name = name.trim();
    if (phone) {
      targetUser.phone = phone.trim();
      targetProfile.phone = phone.trim();
    }
    if (role_id && hasEditPerm) targetUser.role_id = role_id;

    if (designation && hasEditPerm) targetProfile.designation = designation.trim();
    if (department && hasEditPerm) targetProfile.department = department.trim();
    if (joining_date && hasEditPerm) targetProfile.joining_date = joining_date.trim();

    if (cnic !== undefined) targetProfile.cnic = cnic.trim();
    if (address !== undefined) targetProfile.address = address.trim();
    if (city !== undefined) targetProfile.city = city.trim();
    if (emergency_contact_name !== undefined) targetProfile.emergency_contact_name = emergency_contact_name.trim();
    if (emergency_contact_phone !== undefined) targetProfile.emergency_contact_phone = emergency_contact_phone.trim();
    if (bank_name !== undefined) targetProfile.bank_name = bank_name.trim();
    if (bank_account_title !== undefined) targetProfile.bank_account_title = bank_account_title.trim();
    if (bank_iban !== undefined) targetProfile.bank_iban = bank_iban.trim();

    // Document checklist flags (requires employees.documents or admin)
    if (cv_uploaded !== undefined && (hasEditPerm || req.user!.permissions.includes('employees.documents'))) {
      targetProfile.cv_uploaded = Boolean(cv_uploaded);
    }
    if (cnic_uploaded !== undefined && (hasEditPerm || req.user!.permissions.includes('employees.documents'))) {
      targetProfile.cnic_uploaded = Boolean(cnic_uploaded);
    }

    targetUser.updated_at = new Date().toISOString();
    targetProfile.updated_at = new Date().toISOString();

    completenessResult = computeEmployeeCompleteness(targetUser, targetProfile);
    targetProfile.completeness_score = completenessResult.score;

    const role = database.roles.find(r => r.id === targetUser.role_id);

    updatedEmployee = {
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        phone: targetUser.phone,
        status: targetUser.status,
        role_id: targetUser.role_id,
        role_name: role ? role.name : 'Unknown'
      },
      profile: targetProfile,
      completeness: completenessResult
    };
  });

  await logAudit({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'EMPLOYEE_PROFILE_UPDATED',
    entityType: 'EMPLOYEE_PROFILE',
    entityId: updatedEmployee.profile.id,
    metadata: {
      completeness: completenessResult.score
    },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    employee: updatedEmployee
  });
});

// PUT /api/employees/:id/status (Toggle employee active/inactive)
employeeRouter.put('/:id/status', requirePermission('employees.edit'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['active', 'inactive', 'suspended'].includes(status)) {
    res.status(400).json({ error: "Status must be 'active', 'inactive', or 'suspended'." });
    return;
  }

  if (req.user!.id === id) {
    res.status(400).json({ error: 'You cannot alter your own account status.' });
    return;
  }

  await withTransaction((db) => {
    const user = db.users.find(u => u.id === id);
    if (!user) throw new Error('Employee not found.');
    user.status = status;
    user.updated_at = new Date().toISOString();
  });

  await logAudit({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'EMPLOYEE_STATUS_CHANGED',
    entityType: 'USER',
    entityId: id,
    metadata: { new_status: status },
    ipAddress: req.ip
  });

  res.json({ success: true, message: `Employee status set to ${status}.` });
});
