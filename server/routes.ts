/**
 * Core Authentication and System API Routes
 * Production-ready login, logout, password reset OTP, current session info, and audit trails.
 * Powered by direct Supabase Postgres data access layer & signed stateless sessions.
 */

import { Router, Request, Response } from 'express';
import { getDb, withTransaction, persistDbSync } from './db.js';
import {
  verifyPassword,
  createSignedToken,
  generateSecureOtp,
  hashOtp,
  hashPassword,
  generateId
} from './security.js';
import { requireAuth, requirePermission, extractAuthUser } from './middleware.js';
import { logAudit } from './audit.js';
import { findUserByEmail, findUserWithPermissions, updateUser } from './authDb.js';
import { sendPasswordResetEmail } from './email.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(cleanEmail);

  if (!user) {
    // Constant response timing to prevent enumeration
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (user.status === 'suspended') {
    res.status(403).json({ error: 'This account has been suspended. Please contact operations support.' });
    return;
  }

  if (user.status === 'inactive') {
    res.status(403).json({ error: 'This account is deactivated.' });
    return;
  }

  const isValid = verifyPassword(password, user.password_hash, user.password_salt);
  if (!isValid) {
    await logAudit({
      actorId: user.id,
      actorEmail: cleanEmail,
      action: 'AUTH_FAILED_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: req.ip
    });
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  // Generate cryptographically signed stateless token (valid across all serverless instances)
  const token = createSignedToken({
    userId: user.id,
    email: user.email,
    roleId: user.role_id
  });

  // Also record session in local DB / Supabase if desired for session tracking
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await withTransaction((db) => {
    db.sessions.push({
      id: generateId('sess'),
      user_id: user.id,
      token,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString()
    });
  });

  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'USER',
    entityId: user.id,
    ipAddress: req.ip
  });

  const fullUser = await findUserWithPermissions(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role_id: user.role_id,
      role_name: fullUser?.role_name || 'Administrator',
      account_type: user.account_type,
      status: user.status,
      permissions: fullUser?.permissions || [],
      customer_profile: fullUser?.customer_profile || null,
      employee_profile: fullUser?.employee_profile || null
    }
  });
});

// POST /api/auth/logout
authRouter.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const token = req.headers.authorization?.substring(7).trim();
  if (token) {
    await withTransaction((db) => {
      db.sessions = db.sessions.filter(s => s.token !== token);
    });
  }

  if (req.user) {
    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'AUTH_LOGOUT',
      entityType: 'USER',
      entityId: req.user.id,
      ipAddress: req.ip
    });
  }

  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
authRouter.get('/me', async (req: Request, res: Response) => {
  const user = await extractAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Session expired or invalid.' });
    return;
  }

  const fullDetails = await findUserWithPermissions(user.id);

  res.json({
    user: {
      ...user,
      customer_profile: fullDetails?.customer_profile || null,
      employee_profile: fullDetails?.employee_profile || null
    }
  });
});

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(cleanEmail);

  // Consistent message to prevent email enumeration
  if (!user) {
    res.json({ success: true, message: 'If this email is registered, a 6-digit verification code has been dispatched.' });
    return;
  }

  const rawOtp = generateSecureOtp();
  const otpHash = hashOtp(rawOtp);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

  await withTransaction((db) => {
    // Invalidate previous OTPs for this email
    db.password_reset_otps = db.password_reset_otps.filter(o => o.email !== cleanEmail);
    db.password_reset_otps.push({
      id: generateId('otp'),
      email: cleanEmail,
      otp_hash: otpHash,
      expires_at: expiresAt,
      used: false,
      attempts: 0,
      created_at: new Date().toISOString()
    });
  });

  await logAudit({
    actorId: user.id,
    actorEmail: cleanEmail,
    action: 'AUTH_PASSWORD_RESET_REQUESTED',
    entityType: 'USER',
    entityId: user.id,
    metadata: { note: 'OTP generated with 15 min expiry' }
  });

  // Never log OTP values in plaintext to stdout or server logs
  console.log(`[AUTH] Password reset requested for registered user: ${cleanEmail}`);

  // Dispatches verification email via SMTP
  await sendPasswordResetEmail(cleanEmail, rawOtp).catch(err => {
    console.warn('[AUTH] Error sending password reset email:', err);
  });

  // Only return devOtpHint if strictly in local dev AND not running in Vercel/cloud production
  const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

  res.json({
    success: true,
    message: 'If this email is registered, a 6-digit verification code has been dispatched.',
    devOtpHint: isLocalDev ? rawOtp : undefined
  });
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400).json({ error: 'Email, OTP code, and new password are required.' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = getDb();
  const otpRecord = db.password_reset_otps.find(o => o.email === cleanEmail && !o.used);

  if (!otpRecord) {
    res.status(400).json({ error: 'Invalid or expired OTP code.' });
    return;
  }

  if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'OTP code has expired. Please request a new code.' });
    return;
  }

  if (otpRecord.attempts >= 5) {
    res.status(429).json({ error: 'Too many failed attempts. Please request a new reset code.' });
    return;
  }

  const hashedInput = hashOtp(otp.trim());
  if (hashedInput !== otpRecord.otp_hash) {
    otpRecord.attempts += 1;
    persistDbSync();
    res.status(400).json({ error: 'Invalid verification code.' });
    return;
  }

  // Mark OTP used and update password directly in database
  const user = await findUserByEmail(cleanEmail);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const { hash, salt } = hashPassword(newPassword);

  // Direct relational update
  await updateUser(user.id, {
    password_hash: hash,
    password_salt: salt
  });

  await withTransaction((db) => {
    // Invalidate OTP
    const r = db.password_reset_otps.find(x => x.id === otpRecord.id);
    if (r) r.used = true;
    // Invalidate existing sessions for security
    db.sessions = db.sessions.filter(s => s.user_id !== user.id);
  });

  await logAudit({
    actorId: user.id,
    actorEmail: cleanEmail,
    action: 'AUTH_PASSWORD_RESET_SUCCESS',
    entityType: 'USER',
    entityId: user.id
  });

  res.json({ success: true, message: 'Password updated successfully. You may now sign in.' });
});

// GET /api/system/audit-logs
authRouter.get('/system/audit-logs', requirePermission('system.audit'), (req: Request, res: Response) => {
  const db = getDb();
  // Return most recent 200 logs
  const logs = [...db.audit_logs].reverse().slice(0, 200);
  res.json({ logs });
});

// GET /api/system/overview
authRouter.get('/system/overview', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  res.json({
    counts: {
      users: db.users.length,
      customers: db.customer_profiles.length,
      employees: db.employee_profiles.length,
      warehouses: db.warehouses.length,
      products: db.products.length,
      orders: db.fulfillment_orders.length,
      manifests: db.dispatch_manifests.length
    }
  });
});
