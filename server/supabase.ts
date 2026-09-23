/**
 * Supabase Integration Layer for Ship Asaan
 * Provides full relational database sync and cloud persistence for Vercel serverless.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseSchema } from './db.js';

let supabaseClient: SupabaseClient | null = null;
let isInitialized = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (isInitialized) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      console.log(`[SUPABASE] Connected successfully to ${supabaseUrl}`);
    } catch (err) {
      console.error('[SUPABASE] Failed to initialize Supabase client:', err);
      supabaseClient = null;
    }
  } else {
    console.log('[SUPABASE] No SUPABASE_URL / SUPABASE_KEY detected. Operating in local JSON storage mode.');
  }

  isInitialized = true;
  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseClient());
}

/**
 * Fetch authoritative database state from Supabase
 */
export async function fetchStateFromSupabase(): Promise<DatabaseSchema | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    // 1. Check master snapshot first (complete fast hydrate)
    const { data, error } = await client
      .from('ship_asaan_snapshots')
      .select('data, updated_at')
      .eq('id', 'master')
      .maybeSingle();

    if (!error && data && data.data) {
      console.log(`[SUPABASE] Successfully loaded cloud state snapshot (last updated: ${data.updated_at})`);
      return data.data as DatabaseSchema;
    }

    // 2. Fallback: Check if relational users table has data
    const userRes = await client.from('users').select('*').limit(1);
    if (!userRes.error && userRes.data && userRes.data.length > 0) {
      console.log('[SUPABASE] Found existing users in relational table. Assembling state...');
      return await assembleStateFromRelationalTables(client);
    }

    console.log('[SUPABASE] Supabase tables are clean/empty. Ready for first-time bootstrap.');
    return null;
  } catch (err: any) {
    console.error('[SUPABASE] Unexpected error loading state from Supabase:', err?.message || err);
    return null;
  }
}

/**
 * Assemble database schema from relational tables if snapshot is not present
 */
async function assembleStateFromRelationalTables(client: SupabaseClient): Promise<DatabaseSchema | null> {
  try {
    const [
      users,
      roles,
      permissions,
      rolePermissions,
      customerProfiles,
      employeeProfiles,
      walletAccounts,
      warehouses,
      products
    ] = await Promise.all([
      client.from('users').select('*'),
      client.from('roles').select('*'),
      client.from('permissions').select('*'),
      client.from('role_permissions').select('*'),
      client.from('customer_profiles').select('*'),
      client.from('employee_profiles').select('*'),
      client.from('wallet_accounts').select('*'),
      client.from('warehouses').select('*'),
      client.from('products').select('*')
    ]);

    const mappedWarehouses = (warehouses.data || []).map((w: any) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      city: w.city,
      address: w.address,
      contact_person: w.contact_name || w.contact_person || '',
      contact_phone: w.contact_phone || '',
      status: w.status || 'active',
      total_area_sqft: 15000,
      created_at: w.created_at,
      updated_at: w.updated_at
    }));

    const mappedProducts = (products.data || []).map((p: any) => ({
      id: p.id,
      customer_id: p.customer_id,
      sku: p.sku,
      name: p.title || p.name,
      description: p.description || '',
      category: p.category || 'General',
      dimensions: {
        length_cm: Number(p.length_cm) || 10,
        width_cm: Number(p.width_cm) || 10,
        height_cm: Number(p.height_cm) || 10
      },
      weight_kg: Number(p.weight_kg) || 0.5,
      declared_value: Number(p.declared_value) || 0,
      low_stock_threshold: 5,
      status: (p.is_active ? 'active' : 'archived') as 'active' | 'archived',
      created_at: p.created_at,
      updated_at: p.updated_at
    }));

    return {
      users: users.data || [],
      roles: roles.data || [],
      permissions: permissions.data || [],
      role_permissions: rolePermissions.data || [],
      sessions: [],
      password_reset_otps: [],
      audit_logs: [],
      system_settings: [],
      customer_profiles: customerProfiles.data || [],
      employee_profiles: employeeProfiles.data || [],
      wallet_accounts: walletAccounts.data || [],
      wallet_transactions: [],
      warehouses: mappedWarehouses,
      storage_templates: [],
      warehouse_locations: [],
      products: mappedProducts,
      inventory_units: [],
      inventory_transactions: [],
      receiving_batches: [],
      fulfillment_orders: [],
      fulfillment_order_items: [],
      picking_batches: [],
      dispatch_manifests: [],
      order_tracking_events: [],
      return_orders: [],
      billing_rate_cards: []
    };
  } catch (err: any) {
    console.error('[SUPABASE] Failed to assemble relational tables:', err?.message || err);
    return null;
  }
}

/**
 * Save authoritative state to Supabase:
 * Both as a high-speed complete snapshot AND directly into individual relational tables!
 */
export async function syncStateToSupabase(schema: DatabaseSchema): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    // 1. Authoritative snapshot upsert
    const payload = {
      id: 'master',
      data: schema,
      updated_at: new Date().toISOString()
    };

    const snapResult = await client
      .from('ship_asaan_snapshots')
      .upsert(payload, { onConflict: 'id' });

    if (snapResult.error) {
      console.warn('[SUPABASE] Snapshot sync note:', snapResult.error.message);
    }

    // 2. Relational table sync (non-blocking across all relational tables)
    await syncRelationalTables(client, schema);

    return true;
  } catch (err: any) {
    console.error('[SUPABASE] Sync exception:', err?.message || err);
    return false;
  }
}

/**
 * Sync individual relational domain tables in Supabase
 */
async function syncRelationalTables(client: SupabaseClient, schema: DatabaseSchema): Promise<void> {
  try {
    // 1. Roles
    if (schema.roles && schema.roles.length > 0) {
      await client.from('roles').upsert(schema.roles, { onConflict: 'id' });
    }

    // 2. Permissions
    if (schema.permissions && schema.permissions.length > 0) {
      await client.from('permissions').upsert(schema.permissions, { onConflict: 'id' });
    }

    // 3. Role Permissions
    if (schema.role_permissions && schema.role_permissions.length > 0) {
      await client.from('role_permissions').upsert(schema.role_permissions, { onConflict: 'role_id,permission_code' });
    }

    // 4. Users
    if (schema.users && schema.users.length > 0) {
      await client.from('users').upsert(schema.users, { onConflict: 'id' });
    }

    // 5. Customer Profiles
    if (schema.customer_profiles && schema.customer_profiles.length > 0) {
      await client.from('customer_profiles').upsert(schema.customer_profiles, { onConflict: 'id' });
    }

    // 6. Employee Profiles
    if (schema.employee_profiles && schema.employee_profiles.length > 0) {
      await client.from('employee_profiles').upsert(schema.employee_profiles, { onConflict: 'id' });
    }

    // 7. Wallet Accounts
    if (schema.wallet_accounts && schema.wallet_accounts.length > 0) {
      await client.from('wallet_accounts').upsert(schema.wallet_accounts, { onConflict: 'id' });
    }

    // 8. Warehouses
    if (schema.warehouses && schema.warehouses.length > 0) {
      const mappedWarehouses = schema.warehouses.map(w => ({
        id: w.id,
        name: w.name,
        code: w.code,
        address: w.address,
        city: w.city,
        status: w.status,
        contact_phone: w.contact_phone,
        contact_name: w.contact_person,
        total_locations: 0,
        created_at: w.created_at,
        updated_at: w.updated_at
      }));
      await client.from('warehouses').upsert(mappedWarehouses, { onConflict: 'id' });
    }

    // 9. Products
    if (schema.products && schema.products.length > 0) {
      const mappedProducts = schema.products.map(p => ({
        id: p.id,
        sku: p.sku,
        title: p.name,
        customer_id: p.customer_id,
        category: p.category || 'General',
        description: p.description || '',
        declared_value: p.declared_value,
        weight_kg: p.weight_kg,
        length_cm: p.dimensions?.length_cm || 10,
        width_cm: p.dimensions?.width_cm || 10,
        height_cm: p.dimensions?.height_cm || 10,
        is_active: p.status === 'active',
        created_at: p.created_at,
        updated_at: p.updated_at
      }));
      await client.from('products').upsert(mappedProducts, { onConflict: 'id' });
    }

    // 10. Audit Logs (recent 100)
    if (schema.audit_logs && schema.audit_logs.length > 0) {
      const recentLogs = schema.audit_logs.slice(0, 100);
      await client.from('audit_logs').upsert(recentLogs, { onConflict: 'id' });
    }
  } catch (err: any) {
    console.warn('[SUPABASE] Non-blocking relational tables sync note:', err?.message || err);
  }
}

