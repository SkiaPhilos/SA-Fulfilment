/**
 * Permission Catalog for Ship Asaan
 * Fine-grained access permissions across all operational modules.
 */

export interface PermissionDefinition {
  code: string;
  module: string;
  description: string;
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // Employees Module
  { code: 'employees.view', module: 'Employees', description: 'View employee records and rosters' },
  { code: 'employees.create', module: 'Employees', description: 'Create and invite new employees' },
  { code: 'employees.edit', module: 'Employees', description: 'Edit employee details and assignments' },
  { code: 'employees.documents', module: 'Employees', description: 'Upload and verify employee KYC/employment documents' },

  // Customers Module
  { code: 'customers.view', module: 'Customers', description: 'View client/customer accounts' },
  { code: 'customers.approve', module: 'Customers', description: 'Approve, reject, or suspend customer accounts' },
  { code: 'customers.edit', module: 'Customers', description: 'Edit customer profile and KYC' },
  { code: 'customers.kyc', module: 'Customers', description: 'Review confidential customer KYC documents' },

  // Warehouses Module
  { code: 'warehouses.view', module: 'Warehouses', description: 'View warehouse structures and location trees' },
  { code: 'warehouses.create', module: 'Warehouses', description: 'Create warehouses and physical locations' },
  { code: 'warehouses.edit', module: 'Warehouses', description: 'Modify warehouse configurations and storage templates' },

  // Inventory Module
  { code: 'inventory.view', module: 'Inventory', description: 'View inventory stocks, units, and availability' },
  { code: 'inventory.receive', module: 'Inventory', description: 'Receive new shipments and create inventory units' },
  { code: 'inventory.stock', module: 'Inventory', description: 'Perform scan-to-place putaway into storage locations' },
  { code: 'inventory.move', module: 'Inventory', description: 'Relocate inventory units between physical locations' },
  { code: 'inventory.adjust', module: 'Inventory', description: 'Perform manual inventory reconciliations and adjustments' },
  { code: 'inventory.export', module: 'Inventory', description: 'Export inventory datasets in CSV or PDF' },

  // Fulfillment Orders Module
  { code: 'orders.view', module: 'Fulfillment', description: 'View fulfill order queues and statuses' },
  { code: 'orders.create', module: 'Fulfillment', description: 'Create new fulfill orders manually or import via CSV' },
  { code: 'orders.confirm', module: 'Fulfillment', description: 'Acknowledge and confirm customer fulfill orders' },
  { code: 'orders.pick', module: 'Fulfillment', description: 'Allocate stock and scan items during picking' },
  { code: 'orders.pack', module: 'Fulfillment', description: 'Scan shipping package label to confirm Packed status' },
  { code: 'orders.cancel', module: 'Fulfillment', description: 'Cancel fulfill orders and release reserved stock' },
  { code: 'orders.export', module: 'Fulfillment', description: 'Export fulfillment order data and reports' },

  // Dispatch Manifests & Carrier Handover Module
  { code: 'manifests.view', module: 'Dispatch', description: 'View courier handover dispatch manifests' },
  { code: 'manifests.create', module: 'Dispatch', description: 'Create and print courier handover manifests' },
  { code: 'manifests.dispatch', module: 'Dispatch', description: 'Sign and dispatch carrier manifests' },

  // Returns & Reverse Logistics Module
  { code: 'returns.view', module: 'Returns', description: 'View return orders and reverse logistics items' },
  { code: 'returns.process', module: 'Returns', description: 'Receive, inspect and restock or quarantine returned units' },

  // Billing & Rate Cards Module
  { code: 'billing.view', module: 'Billing', description: 'View automated fulfillment and courier billing rates' },
  { code: 'billing.manage', module: 'Billing', description: 'Configure custom client rate cards and billing fees' },

  // Customer Wallet Module
  { code: 'wallet.view', module: 'Wallet', description: 'View customer wallet balances and ledger entries' },
  { code: 'wallet.credit', module: 'Wallet', description: 'Manually credit customer wallet with bank deposit reference' },
  { code: 'wallet.debit', module: 'Wallet', description: 'Perform manual debit or adjustment with mandatory audit note' },
  { code: 'wallet.export', module: 'Wallet', description: 'Export wallet transaction ledgers' },

  // Roles & Security Module
  { code: 'roles.view', module: 'Roles', description: 'View configured roles and their permissions' },
  { code: 'roles.manage', module: 'Roles', description: 'Create and edit custom roles and assign permissions' },
  { code: 'roles.assign', module: 'Roles', description: 'Assign roles to users without privilege escalation' },

  // System Module
  { code: 'system.audit', module: 'System', description: 'View full immutable system audit trails' },
  { code: 'system.settings', module: 'System', description: 'Configure system-wide operational preferences' }
];

export const SYSTEM_ROLE_ADMIN = 'role_administrator';
export const SYSTEM_ROLE_MANAGER = 'role_manager';
export const SYSTEM_ROLE_EMPLOYEE = 'role_employee';
export const SYSTEM_ROLE_CUSTOMER = 'role_customer';
