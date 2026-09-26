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
 * Fetch user by email directly from Postgres/Supabase.
 * Fails loudly on database errors; never silently serves stale fallback data when Supabase is configured.
 */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const cleanEmail = email.trim().toLowerCase();
  const client = getSupabaseClient();

  if (client) {
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error) {
      throw new Error(`[AUTH_DB] Database error finding user by email (${cleanEmail}): ${error.message} (${error.code})`);
    }
    return (data as UserRow) || null;
  }

  // Local JSON fallback ONLY allowed when Supabase is not configured at all
  const db = getDb();
  return db.users.find(u => u.email.toLowerCase() === cleanEmail) || null;
}

/**
 * Fetch user by ID directly from Postgres/Supabase.
 * Fails loudly on database errors; never silently serves stale fallback data when Supabase is configured.
 */
export async function findUserById(id: string): Promise<UserRow | null> {
  const client = getSupabaseClient();

  if (client) {
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`[AUTH_DB] Database error finding user by ID (${id}): ${error.message} (${error.code})`);
    }
    return (data as UserRow) || null;
  }

  // Local JSON fallback ONLY allowed when Supabase is not configured at all
  const db = getDb();
  return db.users.find(u => u.id === id) || null;
}

/**
 * Fetch complete user profile including role and assigned permissions.
 * Fails loudly on database errors.
 */
export async function findUserWithPermissions(userId: string): Promise<UserWithDetails | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  const client = getSupabaseClient();

  if (client) {
    const [roleRes, permRes, custRes, empRes] = await Promise.all([
      client.from('roles').select('name').eq('id', user.role_id).maybeSingle(),
      client.from('role_permissions').select('permission_code').eq('role_id', user.role_id),
      client.from('customer_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      client.from('employee_profiles').select('*').eq('user_id', user.id).maybeSingle()
    ]);

    if (roleRes.error) throw new Error(`[AUTH_DB] Database error fetching role for user (${userId}): ${roleRes.error.message}`);
    if (permRes.error) throw new Error(`[AUTH_DB] Database error fetching permissions for user (${userId}): ${permRes.error.message}`);
    if (custRes.error) throw new Error(`[AUTH_DB] Database error fetching customer profile for user (${userId}): ${custRes.error.message}`);
    if (empRes.error) throw new Error(`[AUTH_DB] Database error fetching employee profile for user (${userId}): ${empRes.error.message}`);

    const permissions = (permRes.data || []).map((rp: any) => rp.permission_code);

    return {
      ...user,
      role_name: roleRes.data ? roleRes.data.name : 'Unknown Role',
      permissions,
      customer_profile: custRes.data || null,
      employee_profile: empRes.data || null
    };
  }

  // Local fallback ONLY when Supabase is not configured at all
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
 * Create a new user record directly in Postgres/Supabase.
 * Fails loudly if insertion fails.
 */
export async function insertUser(user: UserRow): Promise<void> {
  const client = getSupabaseClient();

  if (client) {
    const { error } = await client.from('users').insert(user);
    if (error) {
      throw new Error(`[AUTH_DB] Failed to insert user into Supabase: ${error.message} (${error.code})`);
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
 * Update user record directly in Postgres/Supabase.
 * Fails loudly if update fails.
 */
export async function updateUser(userId: string, updates: Partial<UserRow>): Promise<void> {
  const client = getSupabaseClient();
  const payload = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  if (client) {
    const { error } = await client
      .from('users')
      .update(payload)
      .eq('id', userId);

    if (error) {
      throw new Error(`[AUTH_DB] Failed to update user in Supabase: ${error.message} (${error.code})`);
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
 * Get all active roles from Postgres/Supabase.
 * Fails loudly if query fails.
 */
export async function getRoles(): Promise<RoleRow[]> {
  const client = getSupabaseClient();

  if (client) {
    const { data, error } = await client.from('roles').select('*').order('name');
    if (error) throw new Error(`[AUTH_DB] Error fetching roles from Supabase: ${error.message}`);
    return (data || []) as RoleRow[];
  }

  return getDb().roles;
}

/**
 * Get all permissions from Postgres/Supabase.
 * Fails loudly if query fails.
 */
export async function getPermissions(): Promise<PermissionRow[]> {
  const client = getSupabaseClient();

  if (client) {
    const { data, error } = await client.from('permissions').select('*').order('module');
    if (error) throw new Error(`[AUTH_DB] Error fetching permissions from Supabase: ${error.message}`);
    return (data || []) as PermissionRow[];
  }

  return getDb().permissions;
}

/**
 * Get permissions assigned to a role.
 * Fails loudly if query fails.
 */
export async function getRolePermissions(roleId: string): Promise<string[]> {
  const client = getSupabaseClient();

  if (client) {
    const { data, error } = await client
      .from('role_permissions')
      .select('permission_code')
      .eq('role_id', roleId);

    if (error) throw new Error(`[AUTH_DB] Error fetching role permissions from Supabase: ${error.message}`);
    return (data || []).map((d: any) => d.permission_code);
  }

  return getDb().role_permissions
    .filter(rp => rp.role_id === roleId)
    .map(rp => rp.permission_code);
}
