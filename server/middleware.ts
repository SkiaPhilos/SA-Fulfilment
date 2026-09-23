/**
 * Server Authentication & Authorization Middleware
 * Validates session tokens, enforces permissions server-side, and extracts active user.
 */

import { Request, Response, NextFunction } from 'express';
import { getDb } from './db.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role_id: string;
  role_name: string;
  account_type: 'staff' | 'customer';
  status: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function extractAuthUser(req: Request): AuthenticatedUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  const db = getDb();
  const session = db.sessions.find(s => s.token === token);
  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    return null;
  }

  const user = db.users.find(u => u.id === session.user_id);
  if (!user || user.status === 'suspended' || user.status === 'inactive') {
    return null;
  }

  const role = db.roles.find(r => r.id === user.role_id);
  const permissions = db.role_permissions
    .filter(rp => rp.role_id === user.role_id)
    .map(rp => rp.permission_code);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role_id: user.role_id,
    role_name: role ? role.name : 'Unknown',
    account_type: user.account_type,
    status: user.status,
    permissions
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = extractAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Valid authentication token required.' });
    return;
  }
  req.user = user;
  next();
}

export function requirePermission(permissionCode: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = extractAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required.' });
      return;
    }

    req.user = user;

    // Administrator role bypasses specific permission checks
    if (user.role_id === 'role_administrator' || user.permissions.includes(permissionCode)) {
      next();
      return;
    }

    res.status(403).json({
      error: `Forbidden: Lacks required permission '${permissionCode}'.`
    });
  };
}
