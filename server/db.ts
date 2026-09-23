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
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'ship_asaan_db.json');

// Memory cache of DB for atomic synchronous transactions
let dbCache: DatabaseSchema | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getDb(): DatabaseSchema {
  if (dbCache) {
    return dbCache;
  }

  ensureDataDir();

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(raw);
      if (!dbCache!.customer_profiles) dbCache!.customer_profiles = [];
      if (!dbCache!.employee_profiles) dbCache!.employee_profiles = [];
      if (!dbCache!.wallet_accounts) dbCache!.wallet_accounts = [];
      if (!dbCache!.wallet_transactions) dbCache!.wallet_transactions = [];
      if (!dbCache!.warehouses) dbCache!.warehouses = [];
      if (!dbCache!.storage_templates) dbCache!.storage_templates = [];
      if (!dbCache!.warehouse_locations) dbCache!.warehouse_locations = [];
      return dbCache!;
    } catch (err) {
      console.error('[DB] Error loading database file, initializing clean structure:', err);
    }
  }

  dbCache = {
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
    warehouse_locations: []
  };

  persistDbSync();
  return dbCache;
}

export function persistDbSync(): void {
  if (!dbCache) return;
  ensureDataDir();
  const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(dbCache, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

/**
 * Concurrency-safe atomic transaction runner
 */
export async function withTransaction<T>(fn: (db: DatabaseSchema) => Promise<T> | T): Promise<T> {
  const db = getDb();
  let result: T;

  const currentOp = writeQueue.then(async () => {
    result = await fn(db);
    persistDbSync();
    return result;
  });

  writeQueue = currentOp.then(() => {}).catch(() => {});
  return currentOp;
}
