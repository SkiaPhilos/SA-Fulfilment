/**
 * Direct Relational Data Access Layer for Authentication & RBAC
 * Queries Postgres directly via Supabase client, eliminating in-memory stale cache desync on Vercel.
 */

import { getSupabaseClient } from './supabase.js';
import { getDb, withTransaction } from './db.js';
import type {
  UserRow,
  RoleRow,
  PermissionRow,
  RolePermissionRow,
  CustomerProfileRow,
  EmployeeProfileRow
} from './db.js';

export interface UserWithDetails extends UserRow {
  role_name?: string;
  permissions?: string[];
  customer_profile?: CustomerProfileRow | null;
  employee_profile?: EmployeeProfileRow | null;
}

/**
 * Fetch user by email directly from Postgres/Supabase
 */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const cleanEmail = email.trim().toLowerCase();
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (!error && data) {
        return data as UserRow;
      }
    } catch (err) {
      console.warn('[AUTH_DB] Error finding user by email in Supabase:', err);
    }
  }

  // Local fallback
  const db = getDb();
  return db.users.find(u => u.email.toLowerCase() === cleanEmail) || null;
}

/**
 * Fetch user by ID directly from Postgres/Supabase
 */
export async function findUserById(id: string): Promise<UserRow | null> {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return data as UserRow;
      }
    } catch (err) {
      console.warn('[AUTH_DB] Error finding user by ID in Supabase:', err);
    }
  }

  // Local fallback
  const db = getDb();
  return db.users.find(u => u.id === id) || null;
}

/**
 * Fetch complete user profile including role and assigned permissions
 */
export async function findUserWithPermissions(userId: string): Promise<UserWithDetails | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  const client = getSupabaseClient();

  if (client) {
    try {
      const [roleRes, permRes, custRes, empRes] = await Promise.all([
        client.from('roles').select('name').eq('id', user.role_id).maybeSingle(),
        client.from('role_permissions').select('permission_code').eq('role_id', user.role_id),
        client.from('customer_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        client.from('employee_profiles').select('*').eq('user_id', user.id).maybeSingle()
      ]);

      const permissions = (permRes.data || []).map((rp: any) => rp.permission_code);

      return {
        ...user,
        role_name: roleRes.data ? roleRes.data.name : 'Unknown Role',
        permissions,
        customer_profile: custRes.data || null,
        employee_profile: empRes.data || null
      };
    } catch (err) {
      console.warn('[AUTH_DB] Error fetching user permissions from Supabase:', err);
    }
  }

  // Local fallback
  const db = getDb();
  const role = db.roles.find(r => r.id === user.role_id);
  const permissions = db.role_permissions
    .filter(rp => rp.role_id === user.role_id)
    .map(rp => rp.permission_code);
  const customer_profile = db.customer_profiles.find(cp => cp.user_id === user.id) || null;
  const employee_profile = db.employee_profiles.find(ep => ep.user_id === user.id) || null;

  return {
    ...user,
    role_name: role ? role.name : 'Unknown Role',
    permissions,
    customer_profile,
    employee_profile
  };
}

/**
 * Create a new user record directly in Postgres/Supabase
 */
export async function insertUser(user: UserRow): Promise<void> {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { error } = await client.from('users').insert(user);
      if (error) {
        console.error('[AUTH_DB] Failed to insert user into Supabase:', error.message);
      }
    } catch (err) {
      console.error('[AUTH_DB] Exception inserting user into Supabase:', err);
    }
  }

  // Keep local memory in sync
  await withTransaction((db) => {
    const existingIdx = db.users.findIndex(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (existingIdx >= 0) {
      db.users[existingIdx] = user;
    } else {
      db.users.push(user);
    }
  });
}

/**
 * Update user record directly in Postgres/Supabase
 */
export async function updateUser(userId: string, updates: Partial<UserRow>): Promise<void> {
  const client = getSupabaseClient();
  const payload = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  if (client) {
    try {
      const { error } = await client
        .from('users')
        .update(payload)
        .eq('id', userId);

      if (error) {
        console.error('[AUTH_DB] Failed to update user in Supabase:', error.message);
      }
    } catch (err) {
      console.error('[AUTH_DB] Exception updating user in Supabase:', err);
    }
  }

  // Keep local memory in sync
  await withTransaction((db) => {
    const u = db.users.find(x => x.id === userId);
    if (u) {
      Object.assign(u, payload);
    }
  });
}

/**
 * Get all active roles from Postgres/Supabase
 */
export async function getRoles(): Promise<RoleRow[]> {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client.from('roles').select('*').order('name');
      if (!error && data) {
        return data as RoleRow[];
      }
    } catch (err) {
      console.warn('[AUTH_DB] Error fetching roles from Supabase:', err);
    }
  }

  return getDb().roles;
}

/**
 * Get all permissions from Postgres/Supabase
 */
export async function getPermissions(): Promise<PermissionRow[]> {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client.from('permissions').select('*').order('module');
      if (!error && data) {
        return data as PermissionRow[];
      }
    } catch (err) {
      console.warn('[AUTH_DB] Error fetching permissions from Supabase:', err);
    }
  }

  return getDb().permissions;
}

/**
 * Get permissions assigned to a role
 */
export async function getRolePermissions(roleId: string): Promise<string[]> {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from('role_permissions')
        .select('permission_code')
        .eq('role_id', roleId);

      if (!error && data) {
        return data.map((d: any) => d.permission_code);
      }
    } catch (err) {
      console.warn('[AUTH_DB] Error fetching role permissions from Supabase:', err);
    }
  }

  return getDb().role_permissions
    .filter(rp => rp.role_id === roleId)
    .map(rp => rp.permission_code);
}
