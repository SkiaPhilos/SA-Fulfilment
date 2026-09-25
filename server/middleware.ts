/**
 * Server Authentication & Authorization Middleware
 * Validates cryptographically signed stateless tokens (HMAC-SHA256),
 * enforces direct Postgres user & RBAC permission checks, and extracts active user.
 */

import { Request, Response, NextFunction } from 'express';
import { verifySignedToken } from './security.js';
import { findUserWithPermissions, findUserByEmail } from './authDb.js';
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
  customer_profile_id?: string | null;
  employee_profile_id?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authoritatively extract and authenticate the requesting user from the Bearer token.
 * Works seamlessly across multi-instance and serverless runtimes.
 */
export async function extractAuthUser(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  // 1. Primary: Verify cryptographically signed stateless token
  const tokenPayload = verifySignedToken(token);
  if (tokenPayload) {
    let user = await findUserWithPermissions(tokenPayload.userId);
    if (!user && tokenPayload.email) {
      const userByEmail = await findUserByEmail(tokenPayload.email);
      if (userByEmail) {
        user = await findUserWithPermissions(userByEmail.id);
      }
    }

    if (!user || user.status === 'suspended' || user.status === 'inactive') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role_id: user.role_id,
      role_name: user.role_name || (user.role_id === 'role_administrator' ? 'Administrator' : 'Staff'),
      account_type: user.account_type,
      status: user.status,
      permissions: user.permissions || [],
      customer_profile_id: user.customer_profile?.id || null,
      employee_profile_id: user.employee_profile?.id || null
    };
  }

  // 2. Fallback: Check local sessions table (backward compatibility for legacy sessions)
  try {
    const db = getDb();
    const session = db.sessions.find(s => s.token === token);
    if (session && new Date(session.expires_at).getTime() >= Date.now()) {
      const user = await findUserWithPermissions(session.user_id);
      if (user && user.status !== 'suspended' && user.status !== 'inactive') {
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role_id: user.role_id,
          role_name: user.role_name || 'Staff',
          account_type: user.account_type,
          status: user.status,
          permissions: user.permissions || [],
          customer_profile_id: user.customer_profile?.id || null,
          employee_profile_id: user.employee_profile?.id || null
        };
      }
    }
  } catch {
    // Ignore legacy check failure
  }

  return null;
}

/**
 * Require valid authentication for the route
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await extractAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Valid authentication token required.' });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Authentication verification failed.' });
  }
}

/**
 * Require a specific RBAC permission for the route
 */
export function requirePermission(permissionCode: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user || (await extractAuthUser(req));
      if (!user) {
        res.status(401).json({ error: 'Unauthorized: Authentication required.' });
        return;
      }

      req.user = user;

      // Administrator role bypasses specific granular permission checks
      if (user.role_id === 'role_administrator' || user.permissions.includes(permissionCode)) {
        next();
        return;
      }

      res.status(403).json({
        error: `Forbidden: Lacks required permission '${permissionCode}'.`
      });
    } catch (err) {
      res.status(403).json({ error: 'Forbidden: Authorization check failed.' });
    }
  };
}
