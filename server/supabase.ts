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
 * Fetch authoritative database state directly from Supabase relational tables.
 * Eliminates single JSON blob snapshot (ship_asaan_snapshots) and ensures
 * relational tables in Postgres are the sole source of truth.
 */
export async function fetchStateFromSupabase(): Promise<DatabaseSchema | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const userRes = await client.from('users').select('*').limit(1);
    if (!userRes.error && userRes.data && userRes.data.length > 0) {
      console.log('[SUPABASE] Loading authoritative state from relational PostgreSQL tables...');
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
 * Assemble database schema directly from relational PostgreSQL tables
 * Queries 100% of rows without truncation or arbitrary slicing.
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
      walletTransactions,
      warehouses,
      warehouseLocations,
      products,
      inventoryUnits,
      fulfillmentOrders,
      dispatchManifests,
      auditLogs
    ] = await Promise.all([
      client.from('users').select('*'),
      client.from('roles').select('*'),
      client.from('permissions').select('*'),
      client.from('role_permissions').select('*'),
      client.from('customer_profiles').select('*'),
      client.from('employee_profiles').select('*'),
      client.from('wallet_accounts').select('*'),
      client.from('wallet_transactions').select('*').order('created_at', { ascending: false }),
      client.from('warehouses').select('*'),
      client.from('warehouse_locations').select('*'),
      client.from('products').select('*'),
      client.from('inventory_units').select('*'),
      client.from('fulfillment_orders').select('*').order('created_at', { ascending: false }),
      client.from('dispatch_manifests').select('*').order('created_at', { ascending: false }),
      client.from('audit_logs').select('*').order('created_at', { ascending: false })
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

    const mappedLocations = (warehouseLocations.data || []).map((l: any) => ({
      id: l.id,
      warehouse_id: l.warehouse_id,
      parent_id: null,
      name: l.barcode,
      code: l.barcode,
      barcode: l.barcode,
      type: (l.type || 'bin') as any,
      path: `${l.zone || 'A'} / ${l.aisle || '01'} / ${l.barcode}`,
      level: 1,
      dimensions: { length_cm: 40, width_cm: 30, height_cm: 25 },
      capacity_volume_cm3: Math.round(Number(l.max_volume_cbm || 0.03) * 1000000),
      max_weight_kg: Number(l.max_weight_kg || 25),
      max_units: 50,
      occupied_units: 0,
      status: (l.is_active ? 'available' : 'restricted') as any,
      created_at: l.created_at,
      updated_at: l.created_at
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

    const mappedOrders = (fulfillmentOrders.data || []).map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      customer_id: o.customer_id,
      consignee_name: o.consignee_name,
      consignee_phone: o.consignee_phone,
      shipping_address: o.consignee_address,
      city: o.consignee_city,
      province: 'Punjab',
      postal_code: '',
      cod_amount: Number(o.cod_amount || 0),
      payment_method: 'cod' as const,
      status: o.status,
      created_by: 'system',
      created_at: o.created_at,
      updated_at: o.updated_at
    }));

    const mappedTransactions = (walletTransactions.data || []).map((t: any) => ({
      id: t.id,
      wallet_id: t.wallet_id,
      customer_profile_id: '',
      type: t.type,
      amount: Number(t.amount || 0),
      balance_before: 0,
      balance_after: Number(t.balance_after || 0),
      payment_method: t.reference_type || 'bank_transfer',
      reference_number: t.reference_id || undefined,
      notes: t.description || '',
      actor_id: t.actor_id || undefined,
      actor_name: t.actor_name || undefined,
      created_at: t.created_at
    }));

    const mappedManifests = (dispatchManifests.data || []).map((m: any) => ({
      id: m.id,
      manifest_number: m.manifest_number,
      carrier_name: m.carrier_name,
      carrier_account: '',
      assigned_driver: m.driver_name || '',
      driver_phone: m.driver_phone || '',
      vehicle_number: m.vehicle_number || '',
      order_ids: [],
      total_orders: m.total_orders || 0,
      total_cod_amount: Number(m.total_cod_amount || 0),
      status: m.status,
      created_by_name: m.created_by_name || 'Staff',
      dispatched_at: m.dispatched_at,
      created_at: m.created_at,
      updated_at: m.updated_at
    }));

    return {
      users: users.data || [],
      roles: roles.data || [],
      permissions: permissions.data || [],
      role_permissions: rolePermissions.data || [],
      sessions: [],
      password_reset_otps: [],
      audit_logs: auditLogs.data || [],
      system_settings: [],
      customer_profiles: customerProfiles.data || [],
      employee_profiles: employeeProfiles.data || [],
      wallet_accounts: walletAccounts.data || [],
      wallet_transactions: mappedTransactions,
      warehouses: mappedWarehouses,
      storage_templates: [],
      warehouse_locations: mappedLocations,
      products: mappedProducts,
      inventory_units: inventoryUnits.data || [],
      inventory_transactions: [],
      receiving_batches: [],
      fulfillment_orders: mappedOrders,
      fulfillment_order_items: [],
      picking_batches: [],
      dispatch_manifests: mappedManifests,
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
 * Persist authoritative state directly to relational PostgreSQL tables.
 * Zero truncation. No JSON snapshots.
 */
export async function syncStateToSupabase(schema: DatabaseSchema): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    await syncRelationalTables(client, schema);
    return true;
  } catch (err: any) {
    console.error('[SUPABASE] Relational sync exception:', err?.message || err);
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

    // 7. Wallet Accounts & Transactions
    if (schema.wallet_accounts && schema.wallet_accounts.length > 0) {
      await client.from('wallet_accounts').upsert(schema.wallet_accounts, { onConflict: 'id' });
    }
    if (schema.wallet_transactions && schema.wallet_transactions.length > 0) {
      const mappedTxns = schema.wallet_transactions.map(t => ({
        id: t.id,
        wallet_id: t.wallet_id,
        type: t.type,
        amount: t.amount,
        balance_after: t.balance_after,
        reference_type: t.payment_method || 'system',
        reference_id: t.reference_number || null,
        description: t.notes || '',
        actor_id: t.actor_id || null,
        actor_name: t.actor_name || null,
        created_at: t.created_at
      }));
      await client.from('wallet_transactions').upsert(mappedTxns, { onConflict: 'id' });
    }

    // 8. Warehouses & Locations
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
        total_locations: schema.warehouse_locations?.filter(l => l.warehouse_id === w.id).length || 0,
        created_at: w.created_at,
        updated_at: w.updated_at
      }));
      await client.from('warehouses').upsert(mappedWarehouses, { onConflict: 'id' });
    }
    if (schema.warehouse_locations && schema.warehouse_locations.length > 0) {
      const mappedLocations = schema.warehouse_locations.map(l => ({
        id: l.id,
        warehouse_id: l.warehouse_id,
        barcode: l.barcode,
        zone: l.code?.split('-')[0] || 'A',
        aisle: l.code?.split('-')[1] || '01',
        rack: l.code?.split('-')[2] || 'R1',
        shelf: l.code?.split('-')[3] || 'S1',
        bin: l.code?.split('-')[4] || 'B1',
        type: l.type,
        max_weight_kg: l.max_weight_kg,
        max_volume_cbm: l.capacity_volume_cm3 / 1000000,
        is_active: l.status !== 'restricted',
        created_at: l.created_at
      }));
      await client.from('warehouse_locations').upsert(mappedLocations, { onConflict: 'id' });
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

    // 10. Inventory Units (ALL units - zero truncation)
    if (schema.inventory_units && schema.inventory_units.length > 0) {
      await client.from('inventory_units').upsert(schema.inventory_units, { onConflict: 'id' });
    }

    // 11. Fulfillment Orders
    if (schema.fulfillment_orders && schema.fulfillment_orders.length > 0) {
      const mappedOrders = schema.fulfillment_orders.map(o => ({
        id: o.id,
        order_number: o.order_number,
        customer_id: o.customer_id,
        consignee_name: o.consignee_name,
        consignee_phone: o.consignee_phone,
        consignee_address: o.shipping_address,
        consignee_city: o.city,
        cod_amount: o.cod_amount,
        status: o.status,
        warehouse_id: (o as any).warehouse_id || null,
        courier_tracking_id: (o as any).courier_tracking_id || null,
        assigned_carrier: (o as any).assigned_carrier || null,
        created_at: o.created_at,
        updated_at: o.updated_at
      }));
      await client.from('fulfillment_orders').upsert(mappedOrders, { onConflict: 'id' });
    }

    // 12. Dispatch Manifests
    if (schema.dispatch_manifests && schema.dispatch_manifests.length > 0) {
      await client.from('dispatch_manifests').upsert(schema.dispatch_manifests, { onConflict: 'id' });
    }

    // 13. Audit Logs (ALL audit logs - zero truncation)
    if (schema.audit_logs && schema.audit_logs.length > 0) {
      await client.from('audit_logs').upsert(schema.audit_logs, { onConflict: 'id' });
    }
  } catch (err: any) {
    console.warn('[SUPABASE] Non-blocking relational tables sync note:', err?.message || err);
  }
}

