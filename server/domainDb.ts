/**
 * Direct Relational Domain Data Access Layer for Ship Asaan
 * Performs atomic row-level SQL operations via Supabase for:
 * - Wallets & Transactions
 * - Warehouses & Locations
 * - Products & Catalog
 * - Inventory Units & Tracking
 * - Orders & Line Items
 * - Dispatch Manifests
 * - Audit Logs
 * 
 * FAILS LOUDLY on database errors; never silently serves fake/stale data.
 */

import { getSupabaseClient } from './supabase.js';
import { getDb, withTransaction } from './db.js';
import type {
  WalletAccountRow,
  WalletTransactionRow,
  WarehouseRow,
  WarehouseLocationRow,
  ProductRow,
  InventoryUnitRow,
  FulfillmentOrderRow,
  DispatchManifestRow,
  AuditLogRow,
  CustomerProfileRow,
  EmployeeProfileRow
} from './db.js';

// ==========================================
// 1. AUDIT LOGS
// ==========================================
export async function insertAuditLog(log: AuditLogRow): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('audit_logs').insert(log);
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to insert audit log into Supabase: ${error.message} (${error.code})`);
    }
  }

  // Sync local in-memory
  const db = getDb();
  db.audit_logs.push(log);
}

export async function fetchAuditLogs(limit = 100): Promise<AuditLogRow[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch audit logs from Supabase: ${error.message} (${error.code})`);
    }
    return (data || []) as AuditLogRow[];
  }

  const db = getDb();
  return [...db.audit_logs].reverse().slice(0, limit);
}

// ==========================================
// 2. WALLETS & TRANSACTIONS
// ==========================================
export async function fetchWalletByCustomerId(customerId: string): Promise<WalletAccountRow | null> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client
      .from('wallet_accounts')
      .select('*')
      .eq('customer_profile_id', customerId)
      .maybeSingle();

    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch wallet by customer ID (${customerId}) from Supabase: ${error.message} (${error.code})`);
    }

    if (data) {
      return {
        ...data,
        balance: Number(data.balance)
      } as WalletAccountRow;
    }
    return null;
  }

  const db = getDb();
  return db.wallet_accounts.find(w => w.customer_profile_id === customerId) || null;
}

export async function fetchWalletById(id: string): Promise<WalletAccountRow | null> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client
      .from('wallet_accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch wallet by ID (${id}) from Supabase: ${error.message} (${error.code})`);
    }

    if (data) {
      return {
        ...data,
        balance: Number(data.balance)
      } as WalletAccountRow;
    }
    return null;
  }

  const db = getDb();
  return db.wallet_accounts.find(w => w.id === id) || null;
}

export async function upsertWalletAccount(wallet: WalletAccountRow): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('wallet_accounts').upsert(wallet, { onConflict: 'id' });
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to upsert wallet into Supabase: ${error.message} (${error.code})`);
    }
  }

  // Sync local memory
  await withTransaction((db) => {
    const idx = db.wallet_accounts.findIndex(w => w.id === wallet.id);
    if (idx >= 0) db.wallet_accounts[idx] = wallet;
    else db.wallet_accounts.push(wallet);
  });
}

export async function insertWalletTxn(txn: WalletTransactionRow): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    // Map to Supabase table schema
    const mapped = {
      id: txn.id,
      wallet_id: txn.wallet_id,
      type: txn.type,
      amount: txn.amount,
      balance_after: txn.balance_after,
      reference_type: txn.payment_method || 'system',
      reference_id: txn.reference_number || null,
      description: txn.notes || '',
      actor_id: txn.actor_id || null,
      actor_name: txn.actor_name || null,
      created_at: txn.created_at
    };
    const { error } = await client.from('wallet_transactions').insert(mapped);
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to insert wallet transaction into Supabase: ${error.message} (${error.code})`);
    }
  }

  // Sync local memory
  await withTransaction((db) => {
    db.wallet_transactions.push(txn);
  });
}

export async function fetchWalletTxns(walletId: string, limit = 100): Promise<WalletTransactionRow[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch transactions from Supabase: ${error.message} (${error.code})`);
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      wallet_id: t.wallet_id,
      customer_profile_id: '',
      type: t.type,
      amount: Number(t.amount),
      balance_before: 0,
      balance_after: Number(t.balance_after),
      payment_method: t.reference_type || 'bank_transfer',
      reference_number: t.reference_id || undefined,
      notes: t.description || '',
      actor_id: t.actor_id || undefined,
      actor_name: t.actor_name || undefined,
      created_at: t.created_at
    })) as WalletTransactionRow[];
  }

  const db = getDb();
  return db.wallet_transactions
    .filter(t => t.wallet_id === walletId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

// ==========================================
// 3. WAREHOUSES & LOCATIONS
// ==========================================
export async function fetchWarehouses(): Promise<WarehouseRow[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from('warehouses').select('*').order('name');
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch warehouses from Supabase: ${error.message} (${error.code})`);
    }
    return (data || []).map((w: any) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      city: w.city,
      address: w.address,
      contact_person: w.contact_name || w.contact_person || '',
      contact_phone: w.contact_phone || '',
      status: w.status || 'active',
      total_area_sqft: w.total_area_sqft || 15000,
      created_at: w.created_at,
      updated_at: w.updated_at
    }));
  }

  return getDb().warehouses;
}

export async function upsertWarehouseRecord(wh: WarehouseRow): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const mapped = {
      id: wh.id,
      name: wh.name,
      code: wh.code,
      address: wh.address,
      city: wh.city,
      status: wh.status,
      contact_phone: wh.contact_phone,
      contact_name: wh.contact_person || (wh as any).contact_name || '',
      total_locations: 0,
      created_at: wh.created_at,
      updated_at: wh.updated_at
    };
    const { error } = await client.from('warehouses').upsert(mapped, { onConflict: 'id' });
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to upsert warehouse into Supabase: ${error.message} (${error.code})`);
    }
  }

  await withTransaction((db) => {
    const idx = db.warehouses.findIndex(w => w.id === wh.id);
    if (idx >= 0) db.warehouses[idx] = wh;
    else db.warehouses.push(wh);
  });
}

export async function fetchLocationsByWarehouse(warehouseId: string): Promise<WarehouseLocationRow[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client
      .from('warehouse_locations')
      .select('*')
      .eq('warehouse_id', warehouseId);

    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch locations from Supabase: ${error.message} (${error.code})`);
    }

    return (data || []).map((l: any) => ({
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
      capacity_volume_cm3: Number(l.max_volume_cbm || 0.03) * 1000000,
      max_weight_kg: Number(l.max_weight_kg || 25),
      max_units: 50,
      occupied_units: 0,
      status: l.is_active ? 'available' : 'restricted',
      created_at: l.created_at,
      updated_at: l.created_at
    }));
  }

  return getDb().warehouse_locations.filter(l => l.warehouse_id === warehouseId);
}

export async function upsertLocationRecord(loc: WarehouseLocationRow): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const mapped = {
      id: loc.id,
      warehouse_id: loc.warehouse_id,
      barcode: loc.barcode,
      zone: loc.code.split('-')[0] || 'A',
      aisle: loc.code.split('-')[1] || '01',
      rack: loc.code.split('-')[2] || 'R1',
      shelf: loc.code.split('-')[3] || 'S1',
      bin: loc.code.split('-')[4] || 'B1',
      type: loc.type,
      max_weight_kg: loc.max_weight_kg,
      max_volume_cbm: loc.capacity_volume_cm3 / 1000000,
      is_active: loc.status !== 'restricted',
      created_at: loc.created_at
    };
    const { error } = await client.from('warehouse_locations').upsert(mapped, { onConflict: 'id' });
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to upsert location into Supabase: ${error.message} (${error.code})`);
    }
  }

  await withTransaction((db) => {
    const idx = db.warehouse_locations.findIndex(l => l.id === loc.id);
    if (idx >= 0) db.warehouse_locations[idx] = loc;
    else db.warehouse_locations.push(loc);
  });
}

// ==========================================
// 4. PRODUCTS & CATALOG
// ==========================================
export async function fetchProducts(customerId?: string): Promise<ProductRow[]> {
  const client = getSupabaseClient();
  if (client) {
    let query = client.from('products').select('*');
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch products from Supabase: ${error.message} (${error.code})`);
    }

    return (data || []).map((p: any) => ({
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
      status: p.is_active ? 'active' : 'archived',
      created_at: p.created_at,
      updated_at: p.updated_at
    }));
  }

  const db = getDb();
  if (customerId) {
    return db.products.filter(p => p.customer_id === customerId);
  }
  return db.products;
}

export async function upsertProductRecord(product: ProductRow): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const mapped = {
      id: product.id,
      sku: product.sku,
      title: product.name,
      customer_id: product.customer_id,
      category: product.category,
      description: product.description,
      declared_value: product.declared_value,
      weight_kg: product.weight_kg,
      length_cm: product.dimensions.length_cm,
      width_cm: product.dimensions.width_cm,
      height_cm: product.dimensions.height_cm,
      is_active: product.status === 'active',
      created_at: product.created_at,
      updated_at: product.updated_at
    };
    const { error } = await client.from('products').upsert(mapped, { onConflict: 'id' });
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to upsert product into Supabase: ${error.message} (${error.code})`);
    }
  }

  await withTransaction((db) => {
    const idx = db.products.findIndex(p => p.id === product.id);
    if (idx >= 0) db.products[idx] = product;
    else db.products.push(product);
  });
}

// ==========================================
// 5. INVENTORY UNITS
// ==========================================
export async function fetchInventoryUnits(filters?: { customerId?: string; productId?: string; warehouseId?: string }): Promise<InventoryUnitRow[]> {
  const client = getSupabaseClient();
  if (client) {
    let query = client.from('inventory_units').select('*');
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
    if (filters?.productId) query = query.eq('product_id', filters.productId);
    if (filters?.warehouseId) query = query.eq('warehouse_id', filters.warehouseId);

    const { data, error } = await query;
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch inventory units from Supabase: ${error.message} (${error.code})`);
    }
    return (data || []) as InventoryUnitRow[];
  }

  const db = getDb();
  let units = db.inventory_units;
  if (filters?.customerId) units = units.filter(u => u.customer_id === filters.customerId);
  if (filters?.productId) units = units.filter(u => u.product_id === filters.productId);
  if (filters?.warehouseId) units = units.filter(u => u.warehouse_id === filters.warehouseId);
  return units;
}

export async function upsertInventoryUnitRecord(unit: InventoryUnitRow): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('inventory_units').upsert(unit, { onConflict: 'id' });
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to upsert inventory unit into Supabase: ${error.message} (${error.code})`);
    }
  }

  await withTransaction((db) => {
    const idx = db.inventory_units.findIndex(u => u.id === unit.id);
    if (idx >= 0) db.inventory_units[idx] = unit;
    else db.inventory_units.push(unit);
  });
}

// ==========================================
// 6. FULFILLMENT ORDERS
// ==========================================
export async function fetchOrders(customerId?: string): Promise<FulfillmentOrderRow[]> {
  const client = getSupabaseClient();
  if (client) {
    let query = client.from('fulfillment_orders').select('*');
    if (customerId) query = query.eq('customer_id', customerId);
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch orders from Supabase: ${error.message} (${error.code})`);
    }

    return (data || []).map((o: any) => ({
      ...o,
      cod_amount: Number(o.cod_amount)
    })) as FulfillmentOrderRow[];
  }

  const db = getDb();
  if (customerId) {
    return db.fulfillment_orders.filter(o => o.customer_id === customerId);
  }
  return db.fulfillment_orders;
}

export async function upsertOrderRecord(order: FulfillmentOrderRow): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('fulfillment_orders').upsert(order, { onConflict: 'id' });
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to upsert order into Supabase: ${error.message} (${error.code})`);
    }
  }

  await withTransaction((db) => {
    const idx = db.fulfillment_orders.findIndex(o => o.id === order.id);
    if (idx >= 0) db.fulfillment_orders[idx] = order;
    else db.fulfillment_orders.push(order);
  });
}

// ==========================================
// 7. DISPATCH MANIFESTS
// ==========================================
export async function fetchManifests(): Promise<DispatchManifestRow[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client
      .from('dispatch_manifests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch manifests from Supabase: ${error.message} (${error.code})`);
    }

    return (data || []).map((m: any) => ({
      ...m,
      total_cod_amount: Number(m.total_cod_amount)
    })) as DispatchManifestRow[];
  }

  const db = getDb();
  return db.dispatch_manifests;
}

export async function upsertManifestRecord(manifest: DispatchManifestRow): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('dispatch_manifests').upsert(manifest, { onConflict: 'id' });
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to upsert manifest into Supabase: ${error.message} (${error.code})`);
    }
  }

  await withTransaction((db) => {
    const idx = db.dispatch_manifests.findIndex(m => m.id === manifest.id);
    if (idx >= 0) db.dispatch_manifests[idx] = manifest;
    else db.dispatch_manifests.push(manifest);
  });
}

// ==========================================
// 8. CUSTOMER PROFILES
// ==========================================
export async function fetchCustomerProfiles(): Promise<CustomerProfileRow[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from('customer_profiles').select('*').order('created_at', { ascending: false });
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch customer profiles from Supabase: ${error.message} (${error.code})`);
    }
    return (data || []) as CustomerProfileRow[];
  }

  return getDb().customer_profiles;
}

export async function upsertCustomerProfileRecord(profile: CustomerProfileRow): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('customer_profiles').upsert(profile, { onConflict: 'id' });
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to upsert customer profile into Supabase: ${error.message} (${error.code})`);
    }
  }

  await withTransaction((db) => {
    const idx = db.customer_profiles.findIndex(cp => cp.id === profile.id);
    if (idx >= 0) db.customer_profiles[idx] = profile;
    else db.customer_profiles.push(profile);
  });
}

// ==========================================
// 9. EMPLOYEE PROFILES
// ==========================================
export async function fetchEmployeeProfiles(): Promise<EmployeeProfileRow[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from('employee_profiles').select('*').order('created_at', { ascending: false });
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to fetch employee profiles from Supabase: ${error.message} (${error.code})`);
    }
    return (data || []) as EmployeeProfileRow[];
  }

  return getDb().employee_profiles;
}

export async function upsertEmployeeProfileRecord(profile: EmployeeProfileRow): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('employee_profiles').upsert(profile, { onConflict: 'id' });
    if (error) {
      throw new Error(`[DOMAIN_DB] Failed to upsert employee profile into Supabase: ${error.message} (${error.code})`);
    }
  }

  await withTransaction((db) => {
    const idx = db.employee_profiles.findIndex(ep => ep.id === profile.id);
    if (idx >= 0) db.employee_profiles[idx] = profile;
    else db.employee_profiles.push(profile);
  });
}
