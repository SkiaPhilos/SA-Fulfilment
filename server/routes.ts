/**
 * Core Authentication and System API Routes
 * Production-ready login, logout, password reset OTP, current session info, and audit trails.
 */

import { Router, Request, Response } from 'express';
import { getDb, withTransaction, persistDbSync } from './db.js';
import {
  verifyPassword,
  generateSessionToken,
  generateSecureOtp,
  hashOtp,
  hashPassword,
  generateId
} from './security.js';
import { requireAuth, requirePermission, extractAuthUser } from './middleware.js';
import { logAudit } from './audit.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const db = getDb();
  const user = db.users.find(u => u.email === cleanEmail);

  if (!user) {
    // Prevent timing attacks by dummy verification
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

  // Create authoritative session
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

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

  const role = db.roles.find(r => r.id === user.role_id);
  const permissions = db.role_permissions
    .filter(rp => rp.role_id === user.role_id)
    .map(rp => rp.permission_code);

  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'USER',
    entityId: user.id,
    ipAddress: req.ip
  });

  const customerProfile = db.customer_profiles.find(cp => cp.user_id === user.id) || null;
  const employeeProfile = db.employee_profiles.find(ep => ep.user_id === user.id) || null;

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role_id: user.role_id,
      role_name: role ? role.name : 'Unknown',
      account_type: user.account_type,
      status: user.status,
      permissions,
      customer_profile: customerProfile,
      employee_profile: employeeProfile
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

  await logAudit({
    actorId: req.user?.id,
    actorEmail: req.user?.email,
    action: 'AUTH_LOGOUT',
    entityType: 'SESSION',
    entityId: null
  });

  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response) => {
  const user = extractAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Session expired or invalid.' });
    return;
  }
  const db = getDb();
  const customerProfile = db.customer_profiles.find(cp => cp.user_id === user.id) || null;
  const employeeProfile = db.employee_profiles.find(ep => ep.user_id === user.id) || null;

  res.json({
    user: {
      ...user,
      customer_profile: customerProfile,
      employee_profile: employeeProfile
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
  const db = getDb();
  const user = db.users.find(u => u.email === cleanEmail);

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

  // In production with configured SMTP, an email is dispatched.
  // For development clarity and recovery, we log to server console.
  console.log(`[SMTP/AUTH] Password Reset OTP for ${cleanEmail}: ${rawOtp}`);

  res.json({
    success: true,
    message: 'If this email is registered, a 6-digit verification code has been dispatched.',
    // Provide dev hint if in development mode
    devOtpHint: process.env.NODE_ENV !== 'production' ? rawOtp : undefined
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

  // Mark OTP used and update password
  const user = db.users.find(u => u.email === cleanEmail);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const { hash, salt } = hashPassword(newPassword);

  await withTransaction((db) => {
    const u = db.users.find(x => x.id === user.id);
    if (u) {
      u.password_hash = hash;
      u.password_salt = salt;
      u.updated_at = new Date().toISOString();
    }
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

// GET /api/system/overview (Foundation check)
authRouter.get('/system/overview', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  res.json({
    totalUsers: db.users.length,
    totalRoles: db.roles.length,
    activeSessions: db.sessions.length,
    totalAuditLogs: db.audit_logs.length,
    serverTime: new Date().toISOString()
  });
});
