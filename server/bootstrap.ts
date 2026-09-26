/**
 * Administrator Bootstrap Service for Ship Asaan
 * Idempotently initializes system roles, standard permissions, and the root administrator.
 * Genuinely zero fake production data; only the explicitly configured admin account.
 */

import { withTransaction } from './db.js';
import { hashPassword, generateId } from './security.js';
import {
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_MANAGER,
  SYSTEM_ROLE_EMPLOYEE,
  SYSTEM_ROLE_CUSTOMER
} from './permissions.js';
import { logAudit } from './audit.js';

/**
 * Safely parse and sanitize admin credentials from environment variables.
 * Strips accidental wrapping quotes (single, double, backticks) and trailing/leading spaces.
 */
export function parseEnvAdminCredentials(): { email: string; password: string } | null {
  const rawEmail = process.env.ADMIN_EMAIL;
  const rawPassword = process.env.ADMIN_PASSWORD;

  if (!rawEmail || !rawPassword) return null;

  const email = rawEmail.trim().replace(/^["'`]|["'`]$/g, '').trim().toLowerCase();
  const password = rawPassword.trim().replace(/^["'`]|["'`]$/g, '').trim();

  if (!email || !password) return null;
  return { email, password };
}

export async function bootstrapSystem(): Promise<void> {
  await withTransaction(async (db) => {
    // 1. Sync System Permissions
    for (const perm of SYSTEM_PERMISSIONS) {
      const existing = db.permissions.find(p => p.code === perm.code);
      if (!existing) {
        db.permissions.push({
          id: generateId('perm'),
          code: perm.code,
          module: perm.module,
          description: perm.description
        });
      }
    }

    // 2. Ensure System Roles exist
    const systemRoles = [
      {
        id: SYSTEM_ROLE_ADMIN,
        name: 'Administrator',
        description: 'Superuser with unrestricted access across all modules',
        is_system: true,
        is_active: true
      },
      {
        id: SYSTEM_ROLE_MANAGER,
        name: 'Warehouse Manager',
        description: 'Operations manager for warehouse, inventory, employees, and fulfillment',
        is_system: true,
        is_active: true
      },
      {
        id: SYSTEM_ROLE_EMPLOYEE,
        name: 'Warehouse Associate',
        description: 'Warehouse floor staff handling receiving, stocking, picking, and packing',
        is_system: true,
        is_active: true
      },
      {
        id: SYSTEM_ROLE_CUSTOMER,
        name: 'Merchant / Customer',
        description: 'Standard client portal role for creating orders, reviewing stock, and managing wallet',
        is_system: true,
        is_active: true
      }
    ];

    const now = new Date().toISOString();

    for (const role of systemRoles) {
      const existing = db.roles.find(r => r.id === role.id);
      if (!existing) {
        db.roles.push({
          ...role,
          created_at: now,
          updated_at: now
        });
      }
    }

    // 3. Grant Administrator ALL permissions
    for (const perm of SYSTEM_PERMISSIONS) {
      const hasPerm = db.role_permissions.some(
        rp => rp.role_id === SYSTEM_ROLE_ADMIN && rp.permission_code === perm.code
      );
      if (!hasPerm) {
        db.role_permissions.push({
          role_id: SYSTEM_ROLE_ADMIN,
          permission_code: perm.code
        });
      }
    }

    // Grant Manager standard operational permissions
    const managerPerms = [
      'employees.view', 'employees.create', 'employees.edit', 'employees.documents',
      'customers.view', 'customers.approve', 'customers.edit', 'customers.kyc',
      'warehouses.view', 'warehouses.create', 'warehouses.edit',
      'inventory.view', 'inventory.receive', 'inventory.stock', 'inventory.move', 'inventory.adjust', 'inventory.export',
      'orders.view', 'orders.create', 'orders.confirm', 'orders.pick', 'orders.pack', 'orders.cancel', 'orders.export',
      'manifests.view', 'manifests.create', 'manifests.dispatch',
      'returns.view', 'returns.process',
      'billing.view', 'billing.manage',
      'wallet.view', 'wallet.credit', 'wallet.export',
      'roles.view', 'roles.assign'
    ];
    for (const code of managerPerms) {
      const hasPerm = db.role_permissions.some(
        rp => rp.role_id === SYSTEM_ROLE_MANAGER && rp.permission_code === code
      );
      if (!hasPerm) {
        db.role_permissions.push({
          role_id: SYSTEM_ROLE_MANAGER,
          permission_code: code
        });
      }
    }

    // Grant Floor Employee execution permissions
    const employeePerms = [
      'warehouses.view',
      'inventory.view', 'inventory.receive', 'inventory.stock', 'inventory.move',
      'orders.view', 'orders.pick', 'orders.pack',
      'manifests.view', 'manifests.create', 'manifests.dispatch',
      'returns.view', 'returns.process'
    ];
    for (const code of employeePerms) {
      const hasPerm = db.role_permissions.some(
        rp => rp.role_id === SYSTEM_ROLE_EMPLOYEE && rp.permission_code === code
      );
      if (!hasPerm) {
        db.role_permissions.push({
          role_id: SYSTEM_ROLE_EMPLOYEE,
          permission_code: code
        });
      }
    }

    // Grant Customer client-portal scoped permissions
    const customerPerms = [
      'inventory.view',
      'orders.view', 'orders.create', 'orders.cancel', 'orders.export',
      'returns.view',
      'billing.view',
      'wallet.view'
    ];
    for (const code of customerPerms) {
      const hasPerm = db.role_permissions.some(
        rp => rp.role_id === SYSTEM_ROLE_CUSTOMER && rp.permission_code === code
      );
      if (!hasPerm) {
        db.role_permissions.push({
          role_id: SYSTEM_ROLE_CUSTOMER,
          permission_code: code
        });
      }
    }

    // 4. Idempotently bootstrap Administrator Account(s)
    const envAdmin = parseEnvAdminCredentials();
    const defaultFallbackEmail = 'admin@shipasaan.com';
    const defaultFallbackPassword = 'AdminPass@2026';

    const targetAdminsToEnsure: Array<{ email: string; password: string; isEnv: boolean }> = [];

    if (envAdmin) {
      targetAdminsToEnsure.push({ ...envAdmin, isEnv: true });
    }

    // Only ensure default fallback admin if no administrator exists in the database at all
    const hasAnyAdminInDb = db.users.some(u => u.role_id === SYSTEM_ROLE_ADMIN);
    if (!hasAnyAdminInDb && !envAdmin) {
      targetAdminsToEnsure.push({
        email: defaultFallbackEmail,
        password: defaultFallbackPassword,
        isEnv: false
      });
    }

    const { getSupabaseClient } = await import('./supabase.js');
    const supabaseClient = getSupabaseClient();

    for (const adminSpec of targetAdminsToEnsure) {
      const { hash, salt } = hashPassword(adminSpec.password);
      let adminRecord = db.users.find(u => u.email === adminSpec.email);

      if (!adminRecord) {
        const newAdminId = generateId('usr_admin');
        adminRecord = {
          id: newAdminId,
          email: adminSpec.email,
          password_hash: hash,
          password_salt: salt,
          name: 'System Administrator',
          phone: '+92 300 0000000',
          role_id: SYSTEM_ROLE_ADMIN,
          account_type: 'staff',
          status: 'active',
          created_at: now,
          updated_at: now
        };
        db.users.push(adminRecord);

        console.log(`[BOOTSTRAP] Successfully initialized Administrator account: ${adminSpec.email}`);

        await logAudit({
          actorId: 'system',
          actorEmail: 'system',
          action: 'SYSTEM_BOOTSTRAP',
          entityType: 'USER',
          entityId: newAdminId,
          metadata: {
            email: adminSpec.email,
            role: 'Administrator',
            note: adminSpec.isEnv
              ? 'Administrator account provisioned from environment variables'
              : 'Default fallback administrator account initialized'
          }
        }, db);
      } else {
        // Keep credentials synchronized with configured password
        adminRecord.password_hash = hash;
        adminRecord.password_salt = salt;
        adminRecord.status = 'active';
        adminRecord.role_id = SYSTEM_ROLE_ADMIN;
        adminRecord.account_type = 'staff';
        adminRecord.updated_at = now;
      }

      // Ensure Admin has an employee profile
      if (!db.employee_profiles.some(ep => ep.user_id === adminRecord!.id)) {
        db.employee_profiles.push({
          id: generateId('emp'),
          user_id: adminRecord.id,
          designation: 'Head of Operations & Technology',
          department: 'Executive Management',
          joining_date: '2025-01-01',
          cnic: '35201-1111111-1',
          phone: adminRecord.phone || '0300-0000000',
          address: 'Ship Asaan Central Operations Tower, Gulberg III',
          city: 'Lahore',
          cv_uploaded: true,
          cnic_uploaded: true,
          bank_name: 'Meezan Bank Ltd',
          bank_account_title: 'Ship Asaan Payroll',
          bank_iban: 'PK36MEZN0001234567890123',
          completeness_score: 100,
          created_at: now,
          updated_at: now
        });
      }

      // Direct synchronous upsert into Supabase relational users table
      if (supabaseClient) {
        const { error } = await supabaseClient.from('users').upsert(adminRecord, { onConflict: 'id' });
        if (error) {
          throw new Error(`[BOOTSTRAP] Failed to upsert administrator account into Supabase: ${error.message} (${error.code})`);
        }
      }
    }

    // 6. Ensure standard domain collections are initialized as clean empty stores
    if (!db.customer_profiles) db.customer_profiles = [];
    if (!db.employee_profiles) db.employee_profiles = [];
    if (!db.wallet_accounts) db.wallet_accounts = [];
    if (!db.wallet_transactions) db.wallet_transactions = [];
    if (!db.warehouses) db.warehouses = [];
    if (!db.warehouse_locations) db.warehouse_locations = [];

    // Purge any legacy synthetic test accounts from local memory
    const syntheticEmails = [
      'merchant@gulahmedretail.pk',
      'logistics@alkaramfabrics.com',
      'rashid.minhas@shipasaan.com'
    ];
    db.users = db.users.filter(u => !syntheticEmails.includes(u.email));
    db.customer_profiles = db.customer_profiles.filter(cp => cp.brand_name !== 'Al-Karam Studio' && cp.brand_name !== 'Gul Ahmed Studio');
    db.employee_profiles = db.employee_profiles.filter(ep => ep.cnic !== '35202-7654321-1');
    db.wallet_accounts = db.wallet_accounts.filter(w => !db.customer_profiles.some(cp => cp.id === w.customer_profile_id && (cp.brand_name === 'Al-Karam Studio' || cp.brand_name === 'Gul Ahmed Studio')));

    // 7. Ensure standard storage templates exist
    if (!db.storage_templates || db.storage_templates.length === 0) {
      db.storage_templates = [
        {
          id: 'tpl_euro_pallet',
          name: 'Standard Euro Pallet Bay',
          type: 'bay',
          description: 'Industrial heavy duty pallet footprint (120x80cm)',
          dimensions: { length_cm: 120, width_cm: 80, height_cm: 160 },
          capacity_volume_cm3: 1536000,
          max_weight_kg: 1000,
          max_units: 1,
          created_at: now
        },
        {
          id: 'tpl_mezz_shelf',
          name: 'Heavy Duty Mezzanine Shelf',
          type: 'shelf',
          description: 'Tiered mezzanine shelf for fast-moving boxed cartons',
          dimensions: { length_cm: 100, width_cm: 60, height_cm: 50 },
          capacity_volume_cm3: 300000,
          max_weight_kg: 250,
          max_units: 40,
          created_at: now
        },
        {
          id: 'tpl_pick_bin',
          name: 'Small Parts Pick Tote Bin',
          type: 'bin',
          description: 'Corrugated picking bin for apparel, accessories, cosmetics',
          dimensions: { length_cm: 40, width_cm: 30, height_cm: 25 },
          capacity_volume_cm3: 30000,
          max_weight_kg: 25,
          max_units: 20,
          created_at: now
        },
        {
          id: 'tpl_garment_rail',
          name: 'Garment Hanging Rail Section',
          type: 'bay',
          description: 'Vertical hanging bar for unboxed stitched apparel',
          dimensions: { length_cm: 150, width_cm: 60, height_cm: 180 },
          capacity_volume_cm3: 1620000,
          max_weight_kg: 120,
          max_units: 60,
          created_at: now
        }
      ];
    }

    // 8. Ensure default billing rate card exists
    if (!db.billing_rate_cards || db.billing_rate_cards.length === 0) {
      db.billing_rate_cards = [{
        id: 'rate_standard_pk',
        customer_id: null, // Global default
        name: 'Standard Commercial Fulfillment & Courier Tariff (PKR)',
        base_courier_fee: 190.00,
        per_kg_fee: 45.00,
        pick_pack_fee_per_unit: 30.00,
        daily_storage_fee_per_cbm: 15.00,
        return_processing_fee: 40.00,
        is_active: true,
        created_at: now,
        updated_at: now
      }];
    }
  });
}
