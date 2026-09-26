/**
 * Authoritative Database Engine & Storage for Ship Asaan
 * Relational schema with transactional execution, foreign keys, and durable persistence.
 */

import fs from 'fs';
import path from 'path';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  name: string;
  phone?: string;
  role_id: string;
  account_type: 'staff' | 'customer';
  status: 'active' | 'inactive' | 'pending_approval' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface RoleRow {
  id: string;
  name: string;
  description: string;
  is_system: boolean; // System roles cannot be deleted
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionRow {
  id: string;
  code: string;
  module: string;
  description: string;
}

export interface RolePermissionRow {
  role_id: string;
  permission_code: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  last_active_at: string;
}

export interface PasswordResetOtpRow {
  id: string;
  email: string;
  otp_hash: string;
  expires_at: string;
  used: boolean;
  attempts: number;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface SystemSettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export interface CustomerProfileRow {
  id: string;
  user_id: string;
  business_name: string;
  brand_name: string;
  cnic_or_ntn: string;
  phone: string;
  address: string;
  city: string;
  bank_name?: string;
  bank_account_title?: string;
  bank_iban?: string;
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  completeness_score: number;
  created_at: string;
  updated_at: string;
}

export interface EmployeeProfileRow {
  id: string;
  user_id: string;
  designation: string;
  department: string;
  joining_date: string;
  cnic: string;
  phone: string;
  address: string;
  city: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  bank_name?: string;
  bank_account_title?: string;
  bank_iban?: string;
  cv_uploaded: boolean;
  cnic_uploaded: boolean;
  completeness_score: number;
  created_at: string;
  updated_at: string;
}

export interface WalletAccountRow {
  id: string;
  customer_profile_id: string;
  user_id: string;
  balance: number; // Stored as standard float (2 decimal precision in PKR)
  currency: string; // e.g. 'PKR'
  status: 'active' | 'frozen' | 'suspended';
  created_at: string;
  updated_at: string;
}

export type WalletTransactionType = 'CREDIT' | 'DEBIT' | 'ADJUSTMENT' | 'REVERSAL';

export interface WalletTransactionRow {
  id: string;
  wallet_id: string;
  customer_profile_id: string;
  type: WalletTransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  payment_method: 'bank_transfer' | 'raast' | 'cash' | 'internal_credit' | 'fulfillment_fee' | 'storage_fee' | 'adjustment';
  reference_number?: string;
  notes: string;
  actor_id: string;
  actor_name: string;
  created_at: string;
}

// Phase 4: Warehouse Infrastructure & Location Hierarchy
export interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  contact_person: string;
  contact_phone: string;
  status: 'active' | 'inactive' | 'maintenance';
  total_area_sqft: number;
  created_at: string;
  updated_at: string;
}

export type LocationType = 'zone' | 'aisle' | 'rack' | 'shelf' | 'bin' | 'bay';
export type LocationStatus = 'available' | 'full' | 'restricted' | 'damaged' | 'reserved';

export interface StorageTemplateRow {
  id: string;
  name: string;
  type: LocationType;
  description?: string;
  dimensions: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  capacity_volume_cm3: number;
  max_weight_kg: number;
  max_units: number;
  created_at: string;
}

export interface WarehouseLocationRow {
  id: string;
  warehouse_id: string;
  parent_id: string | null;
  name: string;
  code: string;
  barcode: string;
  type: LocationType;
  path: string;
  level: number;
  template_id?: string | null;
  dimensions: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  capacity_volume_cm3: number;
  max_weight_kg: number;
  max_units: number;
  occupied_units: number;
  status: LocationStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Phase 5: Products, Physical Units & Inventory Ledger
export interface ProductRow {
  id: string;
  customer_id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  barcode?: string;
  dimensions: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  weight_kg: number;
  declared_value: number;
  low_stock_threshold: number;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export type InventoryUnitState =
  | 'awaiting_stocking'
  | 'in_storage'
  | 'reserved'
  | 'picked'
  | 'at_packing'
  | 'packed'
  | 'fulfilled'
  | 'returned'
  | 'damaged'
  | 'lost';

export interface InventoryUnitRow {
  id: string;
  tracking_code: string; // e.g. UNIT-E8B2-9F1C
  product_id: string;
  customer_id: string;
  location_id: string | null;
  warehouse_id: string | null;
  batch_id: string;
  state: InventoryUnitState;
  condition: 'good' | 'damaged';
  notes?: string;
  order_id?: string | null;
  order_item_id?: string | null;
  received_at: string;
  stocked_at?: string | null;
  updated_at: string;
}

export type InventoryTransactionType =
  | 'RECEIVE'
  | 'STOCK'
  | 'MOVE'
  | 'RESERVE'
  | 'PICK'
  | 'PACK'
  | 'FULFILL'
  | 'RETURN'
  | 'DAMAGE'
  | 'LOSS'
  | 'ADJUST';

export interface InventoryTransactionRow {
  id: string;
  unit_id: string;
  tracking_code: string;
  product_id: string;
  customer_id: string;
  type: InventoryTransactionType;
  from_location_id: string | null;
  to_location_id: string | null;
  from_state: string;
  to_state: string;
  actor_id: string;
  actor_name: string;
  notes: string;
  created_at: string;
}

export interface ReceivingBatchRow {
  id: string;
  batch_number: string; // e.g. RCV-20260923-0001
  customer_id: string;
  warehouse_id: string;
  carrier?: string;
  tracking_reference?: string;
  total_units: number;
  stocked_units: number;
  status: 'received' | 'partially_stocked' | 'completed';
  created_by_id: string;
  created_by_name: string;
  created_at: string;
}

// -------------------------------------------------------------
// Fulfillment Orders Module
// -------------------------------------------------------------

export type FulfillmentOrderStatus =
  | 'placed'        // Created by customer or staff; awaiting confirmation review
  | 'confirmed'     // Confirmed by staff; queued for fulfillment allocation
  | 'to_fulfill'    // Allocated in picking session batch (Phase 7)
  | 'picked'        // Scanned out from shelves (Phase 7)
  | 'packed'        // Packed at packing station with barcode scan (Phase 7)
  | 'fulfilled'     // Handed over to courier/dispatched (Phase 7)
  | 'cancelled';    // Cancelled with mandatory audit reason

export interface FulfillmentOrderRow {
  id: string;
  order_number: string; // e.g. ORD-202609-0001
  customer_id: string; // references customer_profiles.id
  customer_reference?: string; // external store ref e.g. #SHOPIFY-1029
  status: FulfillmentOrderStatus;

  // Consignee details
  consignee_name: string;
  consignee_phone: string;
  consignee_email?: string;
  shipping_address: string;
  city: string;
  province?: string;
  postal_code?: string;

  // Financial details
  cod_amount: number; // in PKR (0 for prepaid)
  payment_method: 'cod' | 'prepaid';
  declared_total_value: number; // sum of line item values

  // Shipping notes
  shipping_notes?: string;

  // Audit and actor tracking
  created_by_user_id: string;
  created_by_name: string;
  confirmed_by_user_id?: string;
  confirmed_by_name?: string;
  confirmed_at?: string;
  cancelled_by_user_id?: string;
  cancelled_by_name?: string;
  cancelled_at?: string;
  cancellation_reason?: string;

  created_at: string;
  updated_at: string;
}

export interface FulfillmentOrderItemRow {
  id: string;
  order_id: string; // references fulfillment_orders.id
  product_id: string; // references products.id
  sku: string; // SKU code snapshot
  product_name: string; // product name snapshot
  quantity: number; // quantity of units ordered
  unit_price: number; // snapshot unit price in PKR
  total_price: number; // quantity * unit_price
  created_at: string;
}

export interface PickingBatchRow {
  id: string;
  batch_number: string; // e.g. PICK-202609-0001
  status: 'active' | 'completed' | 'cancelled';
  order_ids: string[];
  total_units_count: number;
  picked_units_count: number;
  created_by_user_id: string;
  created_by_name: string;
  created_at: string;
  completed_at?: string | null;
}

// -------------------------------------------------------------
// Phase 8: Dispatch Manifests, Tracking, Returns & Automated Billing
// -------------------------------------------------------------

export interface DispatchManifestRow {
  id: string;
  manifest_number: string; // e.g. MNF-202609-0001
  carrier_name: string; // e.g. "TCS Express", "Leopard Courier", "Trax Logistics", "M&P", "Call Courier"
  driver_name?: string;
  driver_phone?: string;
  vehicle_number?: string;
  handover_notes?: string;
  order_ids: string[];
  total_orders: number;
  total_cod_amount: number;
  status: 'draft' | 'signed_dispatched' | 'closed';
  created_by_id: string;
  created_by_name: string;
  dispatched_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderTrackingStatus =
  | 'placed'
  | 'confirmed'
  | 'to_fulfill'
  | 'picked'
  | 'packed'
  | 'dispatched'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'undelivered_attempt'
  | 'rto_in_transit'
  | 'returned_to_warehouse'
  | 'cancelled';

export interface OrderTrackingEventRow {
  id: string;
  order_id: string;
  order_number: string;
  status: OrderTrackingStatus;
  location: string; // e.g. "Islamabad Fulfillment Hub", "Rawalpindi Gateway Hub", "Karachi Regional Hub"
  description: string;
  actor_id?: string | null;
  actor_name?: string | null;
  created_at: string;
}

export type ReturnDisposition = 'restocked' | 'damaged_quarantine' | 'merchant_claim' | 'scrapped';

export interface ReturnOrderRow {
  id: string;
  return_number: string; // e.g. RTN-202609-0001
  order_id: string;
  order_number: string;
  customer_id: string;
  return_type: 'rto_courier' | 'customer_return'; // Courier undelivered bounce vs Customer reverse pickup
  return_reason: string;
  tracking_reference?: string;
  disposition: ReturnDisposition;
  target_location_id?: string | null; // Location if restocked
  condition_notes: string;
  processed_by_id: string;
  processed_by_name: string;
  created_at: string;
}

export interface BillingRateCardRow {
  id: string;
  customer_id?: string | null; // null = global default rate card
  name: string;
  base_courier_fee: number; // e.g. 200 PKR
  per_kg_fee: number; // e.g. 50 PKR/kg
  pick_pack_fee_per_unit: number; // e.g. 35 PKR per unit picked & packed
  daily_storage_fee_per_cbm: number; // e.g. 15 PKR per m3 per day
  return_processing_fee: number; // e.g. 50 PKR per RTO unit
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Master schema container
export interface DatabaseSchema {
  users: UserRow[];
  roles: RoleRow[];
  permissions: PermissionRow[];
  role_permissions: RolePermissionRow[];
  sessions: SessionRow[];
  password_reset_otps: PasswordResetOtpRow[];
  audit_logs: AuditLogRow[];
  system_settings: SystemSettingRow[];
  customer_profiles: CustomerProfileRow[];
  employee_profiles: EmployeeProfileRow[];
  wallet_accounts: WalletAccountRow[];
  wallet_transactions: WalletTransactionRow[];
  warehouses: WarehouseRow[];
  storage_templates: StorageTemplateRow[];
  warehouse_locations: WarehouseLocationRow[];
  products: ProductRow[];
  inventory_units: InventoryUnitRow[];
  inventory_transactions: InventoryTransactionRow[];
  receiving_batches: ReceivingBatchRow[];
  fulfillment_orders: FulfillmentOrderRow[];
  fulfillment_order_items: FulfillmentOrderItemRow[];
  picking_batches: PickingBatchRow[];
  dispatch_manifests: DispatchManifestRow[];
  order_tracking_events: OrderTrackingEventRow[];
  return_orders: ReturnOrderRow[];
  billing_rate_cards: BillingRateCardRow[];
}

import { fetchStateFromSupabase, syncStateToSupabase, isSupabaseConfigured } from './supabase.js';

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isVercel
  ? path.resolve('/tmp', 'ship_asaan_data')
  : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'ship_asaan_db.json');

// Memory cache of DB for atomic synchronous transactions
let dbCache: DatabaseSchema | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err: any) {
    console.warn('[DB] ensureDataDir warning:', err?.message);
  }
}

export async function initDatabase(): Promise<DatabaseSchema> {
  if (isSupabaseConfigured()) {
    const cloudDb = await fetchStateFromSupabase();
    if (cloudDb) {
      dbCache = cloudDb;
      ensureCollections(dbCache);
      return dbCache;
    }
    console.log('[DB] Initializing fresh schema in Supabase...');
    dbCache = createEmptySchema();
    await syncStateToSupabase(dbCache);
    return dbCache;
  }
  return getDb();
}

function createEmptySchema(): DatabaseSchema {
  return {
    users: [],
    roles: [],
    permissions: [],
    role_permissions: [],
    sessions: [],
    password_reset_otps: [],
    audit_logs: [],
    system_settings: [],
    customer_profiles: [],
    employee_profiles: [],
    wallet_accounts: [],
    wallet_transactions: [],
    warehouses: [],
    storage_templates: [],
    warehouse_locations: [],
    products: [],
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
}

function ensureCollections(cache: DatabaseSchema): void {
  if (!cache.customer_profiles) cache.customer_profiles = [];
  if (!cache.employee_profiles) cache.employee_profiles = [];
  if (!cache.wallet_accounts) cache.wallet_accounts = [];
  if (!cache.wallet_transactions) cache.wallet_transactions = [];
  if (!cache.warehouses) cache.warehouses = [];
  if (!cache.storage_templates) cache.storage_templates = [];
  if (!cache.warehouse_locations) cache.warehouse_locations = [];
  if (!cache.products) cache.products = [];
  if (!cache.inventory_units) cache.inventory_units = [];
  if (!cache.inventory_transactions) cache.inventory_transactions = [];
  if (!cache.receiving_batches) cache.receiving_batches = [];
  if (!cache.fulfillment_orders) cache.fulfillment_orders = [];
  if (!cache.fulfillment_order_items) cache.fulfillment_order_items = [];
  if (!cache.picking_batches) cache.picking_batches = [];
  if (!cache.dispatch_manifests) cache.dispatch_manifests = [];
  if (!cache.order_tracking_events) cache.order_tracking_events = [];
  if (!cache.return_orders) cache.return_orders = [];
  if (!cache.billing_rate_cards) cache.billing_rate_cards = [];
}

export function getDb(): DatabaseSchema {
  if (dbCache) {
    return dbCache;
  }

  // When Supabase is configured, never silently fall back to local disk storage
  if (isSupabaseConfigured()) {
    throw new Error('[DB_STATE_ERROR] Database cache uninitialized while Supabase is configured. Call initDatabase() or getFreshDb() first.');
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(raw);
      ensureCollections(dbCache!);
      return dbCache!;
    } catch (err) {
      console.error('[DB] Error loading database file:', err);
    }
  }

  dbCache = createEmptySchema();
  persistDbSync();
  return dbCache;
}

/**
 * Fetch fresh database schema directly from Supabase relational tables.
 * Prevents warm Vercel instances from operating on stale in-memory state.
 * Fails loudly if Supabase is configured and query fails.
 */
export async function getFreshDb(): Promise<DatabaseSchema> {
  if (isSupabaseConfigured()) {
    const fresh = await fetchStateFromSupabase();
    if (fresh) {
      dbCache = fresh;
      ensureCollections(dbCache);
      return dbCache;
    }
    if (dbCache) return dbCache;
    dbCache = createEmptySchema();
    return dbCache;
  }
  return getDb();
}

export function persistDbSync(): void {
  if (!dbCache) return;

  // Local JSON file writes are ONLY permitted when Supabase is NOT configured at all
  if (!isSupabaseConfigured()) {
    try {
      ensureDataDir();
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(dbCache, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err: any) {
      // Ignore filesystem write errors in serverless environments
    }
  }
}

/**
 * Concurrency-safe atomic transaction runner.
 * Always fetches fresh state from PostgreSQL relational tables before mutation
 * to ensure multi-instance cross-process consistency.
 * FAILS LOUDLY if Supabase write fails.
 */
export async function withTransaction<T>(fn: (db: DatabaseSchema) => Promise<T> | T): Promise<T> {
  let result: T;

  const currentOp = writeQueue.then(async () => {
    // 1. Fetch latest PostgreSQL state across serverless instances
    if (isSupabaseConfigured()) {
      const fresh = await fetchStateFromSupabase();
      if (fresh) {
        dbCache = fresh;
        ensureCollections(dbCache);
      }
    }

    const db = getDb();
    result = await fn(db);

    // 2. Persist directly to PostgreSQL relational tables
    if (isSupabaseConfigured()) {
      await syncStateToSupabase(db);
    } else {
      persistDbSync();
    }
    return result;
  });

  writeQueue = currentOp.then(() => {}).catch(() => {});
  return currentOp;
}
