/**
 * Customer Management & Lifecycle API Routes
 * Handles self-registration, verification queues, approval/rejection workflows, and KYC profiles.
 */

import { Router, Request, Response } from 'express';
import { getDb, withTransaction } from './db.js';
import { hashPassword, generateId } from './security.js';
import { requireAuth, requirePermission } from './middleware.js';
import { logAudit } from './audit.js';
import { computeCustomerCompleteness } from './completeness.js';
import { SYSTEM_ROLE_CUSTOMER } from './permissions.js';

export const customerRouter = Router();

// POST /api/customers/register (Public customer self-registration)
customerRouter.post('/register', async (req: Request, res: Response) => {
  const {
    email,
    password,
    name,
    business_name,
    brand_name,
    cnic_or_ntn,
    phone,
    address,
    city
  } = req.body;

  if (!email || !password || !name || !business_name || !cnic_or_ntn || !phone || !address || !city) {
    res.status(400).json({ error: 'All basic registration fields are required.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = getDb();

  if (db.users.some(u => u.email === cleanEmail)) {
    res.status(409).json({ error: 'An account with this email address already exists.' });
    return;
  }

  const { hash, salt } = hashPassword(password);
  const userId = generateId('usr');
  const profileId = generateId('cust');
  const now = new Date().toISOString();

  const tempUser = {
    id: userId,
    email: cleanEmail,
    password_hash: hash,
    password_salt: salt,
    name: name.trim(),
    phone: phone.trim(),
    role_id: SYSTEM_ROLE_CUSTOMER,
    account_type: 'customer' as const,
    status: 'pending_approval' as const,
    created_at: now,
    updated_at: now
  };

  const tempProfile = {
    id: profileId,
    user_id: userId,
    business_name: business_name.trim(),
    brand_name: (brand_name || business_name).trim(),
    cnic_or_ntn: cnic_or_ntn.trim(),
    phone: phone.trim(),
    address: address.trim(),
    city: city.trim(),
    approval_status: 'pending' as const,
    completeness_score: 0,
    created_at: now,
    updated_at: now
  };

  const completeness = computeCustomerCompleteness(tempUser, tempProfile);
  tempProfile.completeness_score = completeness.score;

  await withTransaction((database) => {
    database.users.push(tempUser);
    database.customer_profiles.push(tempProfile);
  });

  await logAudit({
    actorId: userId,
    actorEmail: cleanEmail,
    action: 'CUSTOMER_SELF_REGISTERED',
    entityType: 'CUSTOMER_PROFILE',
    entityId: profileId,
    metadata: {
      business_name: tempProfile.business_name,
      city: tempProfile.city,
      initial_completeness: completeness.score
    },
    ipAddress: req.ip
  });

  res.status(201).json({
    success: true,
    message: 'Your registration has been submitted successfully and is queued for verification by the Ship Asaan compliance team.'
  });
});

// GET /api/customers (Staff list of customers)
customerRouter.get('/', requirePermission('customers.view'), async (req: Request, res: Response) => {
  const db = getDb();
  const { status, search } = req.query;

  let customers = db.customer_profiles.map((profile) => {
    const user = db.users.find(u => u.id === profile.user_id);
    const completeness = user ? computeCustomerCompleteness(user, profile) : null;
    return {
      profile,
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        created_at: user.created_at
      } : null,
      completeness
    };
  }).filter(c => c.user !== null);

  if (status && typeof status === 'string') {
    customers = customers.filter(c => c.profile.approval_status === status);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    customers = customers.filter(c =>
      c.profile.business_name.toLowerCase().includes(q) ||
      c.profile.brand_name.toLowerCase().includes(q) ||
      c.profile.cnic_or_ntn.toLowerCase().includes(q) ||
      c.user?.name.toLowerCase().includes(q) ||
      c.user?.email.toLowerCase().includes(q) ||
      c.profile.city.toLowerCase().includes(q)
    );
  }

  // Sort descending by registration date
  customers.sort((a, b) => new Date(b.profile.created_at).getTime() - new Date(a.profile.created_at).getTime());

  res.json({ customers });
});

// GET /api/customers/:id (Single customer details with tenant scoping)
customerRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const profile = db.customer_profiles.find(cp => cp.id === id || cp.user_id === id);

  if (!profile) {
    res.status(404).json({ error: 'Customer profile not found.' });
    return;
  }

  // Tenant scoping: Customers can only view their own profile
  if (req.user!.account_type === 'customer' && req.user!.id !== profile.user_id) {
    res.status(403).json({ error: 'Forbidden: You can only access your own business profile.' });
    return;
  }

  // Non-customer staff must have customers.view permission
  if (req.user!.account_type === 'staff' && req.user!.role_id !== 'role_administrator' && !req.user!.permissions.includes('customers.view')) {
    res.status(403).json({ error: "Forbidden: Requires 'customers.view' permission." });
    return;
  }

  const user = db.users.find(u => u.id === profile.user_id);
  if (!user) {
    res.status(404).json({ error: 'Associated user account not found.' });
    return;
  }

  const completeness = computeCustomerCompleteness(user, profile);

  // Recent audit logs for this customer profile
  const auditLogs = db.audit_logs
    .filter(al => al.entity_id === profile.id || al.entity_id === user.id)
    .slice(-10)
    .reverse();

  res.json({
    customer: {
      profile,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        created_at: user.created_at
      },
      completeness,
      auditLogs
    }
  });
});

// POST /api/customers/:id/approve (Staff approval)
customerRouter.post('/:id/approve', requirePermission('customers.approve'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const now = new Date().toISOString();

  let targetUserId = '';
  let updatedProfile: any = null;

  await withTransaction((db) => {
    const profile = db.customer_profiles.find(cp => cp.id === id);
    if (!profile) {
      throw new Error('Customer profile not found.');
    }

    const user = db.users.find(u => u.id === profile.user_id);
    if (!user) {
      throw new Error('Associated user not found.');
    }

    profile.approval_status = 'approved';
    profile.reviewed_by = req.user!.id;
    profile.reviewed_at = now;
    profile.updated_at = now;

    user.status = 'active';
    user.updated_at = now;

    targetUserId = user.id;
    updatedProfile = profile;
  });

  await logAudit({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'CUSTOMER_APPROVED',
    entityType: 'CUSTOMER_PROFILE',
    entityId: id,
    metadata: {
      user_id: targetUserId,
      approved_by: req.user!.email
    },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Customer account successfully approved.',
    profile: updatedProfile
  });
});

// POST /api/customers/:id/reject (Staff rejection)
customerRouter.post('/:id/reject', requirePermission('customers.approve'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim().length === 0) {
    res.status(400).json({ error: 'A specific rejection reason must be provided.' });
    return;
  }

  const now = new Date().toISOString();
  let targetUserId = '';
  let updatedProfile: any = null;

  await withTransaction((db) => {
    const profile = db.customer_profiles.find(cp => cp.id === id);
    if (!profile) throw new Error('Customer profile not found.');

    const user = db.users.find(u => u.id === profile.user_id);
    if (!user) throw new Error('Associated user not found.');

    profile.approval_status = 'rejected';
    profile.rejection_reason = reason.trim();
    profile.reviewed_by = req.user!.id;
    profile.reviewed_at = now;
    profile.updated_at = now;

    user.status = 'suspended';
    user.updated_at = now;

    targetUserId = user.id;
    updatedProfile = profile;
  });

  await logAudit({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'CUSTOMER_REJECTED',
    entityType: 'CUSTOMER_PROFILE',
    entityId: id,
    metadata: {
      user_id: targetUserId,
      reason: reason.trim()
    },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Customer application rejected.',
    profile: updatedProfile
  });
});

// POST /api/customers/:id/suspend (Staff suspension)
customerRouter.post('/:id/suspend', requirePermission('customers.approve'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const now = new Date().toISOString();
  let updatedProfile: any = null;

  await withTransaction((db) => {
    const profile = db.customer_profiles.find(cp => cp.id === id);
    if (!profile) throw new Error('Customer profile not found.');

    const user = db.users.find(u => u.id === profile.user_id);
    if (!user) throw new Error('Associated user not found.');

    profile.approval_status = 'suspended';
    profile.rejection_reason = reason ? reason.trim() : 'Administrative suspension';
    profile.updated_at = now;

    user.status = 'suspended';
    user.updated_at = now;

    updatedProfile = profile;
  });

  await logAudit({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'CUSTOMER_SUSPENDED',
    entityType: 'CUSTOMER_PROFILE',
    entityId: id,
    metadata: { reason },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Customer account suspended.',
    profile: updatedProfile
  });
});

// PUT /api/customers/:id/profile (Update customer KYC / details)
customerRouter.put('/:id/profile', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const profile = db.customer_profiles.find(cp => cp.id === id);

  if (!profile) {
    res.status(404).json({ error: 'Customer profile not found.' });
    return;
  }

  // Tenant scoping check
  if (req.user!.account_type === 'customer' && req.user!.id !== profile.user_id) {
    res.status(403).json({ error: 'Forbidden: You can only edit your own profile.' });
    return;
  }

  if (req.user!.account_type === 'staff' && req.user!.role_id !== 'role_administrator' && !req.user!.permissions.includes('customers.edit')) {
    res.status(403).json({ error: "Forbidden: Requires 'customers.edit' permission." });
    return;
  }

  const {
    business_name,
    brand_name,
    cnic_or_ntn,
    phone,
    address,
    city,
    bank_name,
    bank_account_title,
    bank_iban
  } = req.body;

  let completenessResult: any = null;
  let savedProfile: any = null;

  await withTransaction((database) => {
    const targetProfile = database.customer_profiles.find(cp => cp.id === id)!;
    const targetUser = database.users.find(u => u.id === targetProfile.user_id)!;

    if (business_name) targetProfile.business_name = business_name.trim();
    if (brand_name) targetProfile.brand_name = brand_name.trim();
    if (cnic_or_ntn) targetProfile.cnic_or_ntn = cnic_or_ntn.trim();
    if (phone) {
      targetProfile.phone = phone.trim();
      targetUser.phone = phone.trim();
    }
    if (address) targetProfile.address = address.trim();
    if (city) targetProfile.city = city.trim();
    if (bank_name !== undefined) targetProfile.bank_name = bank_name.trim();
    if (bank_account_title !== undefined) targetProfile.bank_account_title = bank_account_title.trim();
    if (bank_iban !== undefined) targetProfile.bank_iban = bank_iban.trim();

    targetProfile.updated_at = new Date().toISOString();

    completenessResult = computeCustomerCompleteness(targetUser, targetProfile);
    targetProfile.completeness_score = completenessResult.score;

    savedProfile = targetProfile;
  });

  await logAudit({
    actorId: req.user!.id,
    actorEmail: req.user!.email,
    action: 'CUSTOMER_PROFILE_UPDATED',
    entityType: 'CUSTOMER_PROFILE',
    entityId: id,
    metadata: {
      completeness: completenessResult.score
    },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    profile: savedProfile,
    completeness: completenessResult
  });
});
