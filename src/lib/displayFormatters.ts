/**
 * Human-readable display formatters for Ship Asaan UI
 * Eliminates developer-facing keys, raw permission codes, and internal identifiers.
 */

const PERMISSION_LABEL_MAP: Record<string, string> = {
  'employees.view': 'View Employees',
  'employees.create': 'Create Employees',
  'employees.edit': 'Edit Employees',
  'employees.documents': 'Manage Employee Documents',

  'customers.view': 'View Customers',
  'customers.approve': 'Approve & Reject Customers',
  'customers.edit': 'Edit Customer Profiles',
  'customers.kyc': 'Review KYC Documents',

  'warehouses.view': 'View Warehouses',
  'warehouses.create': 'Create Warehouses',
  'warehouses.edit': 'Edit Warehouses',

  'inventory.view': 'View Inventory',
  'inventory.receive': 'Receive Shipments',
  'inventory.stock': 'Stock Putaway',
  'inventory.move': 'Move Inventory',
  'inventory.adjust': 'Adjust Inventory',
  'inventory.export': 'Export Inventory',

  'orders.view': 'View Orders',
  'orders.create': 'Create Orders',
  'orders.confirm': 'Confirm Orders',
  'orders.pick': 'Pick Order Items',
  'orders.pack': 'Pack Orders',
  'orders.cancel': 'Cancel Orders',
  'orders.export': 'Export Orders',

  'manifests.view': 'View Dispatch Manifests',
  'manifests.create': 'Create Handover Manifests',
  'manifests.dispatch': 'Dispatch Manifests',

  'returns.view': 'View Returns',
  'returns.process': 'Process Returns',

  'billing.view': 'View Billing Rates',
  'billing.manage': 'Manage Billing Rates',

  'wallet.view': 'View Wallet Ledgers',
  'wallet.credit': 'Credit Wallet',
  'wallet.debit': 'Debit Wallet',
  'wallet.export': 'Export Wallet Ledgers',

  'roles.view': 'View Roles',
  'roles.manage': 'Manage Roles',
  'roles.assign': 'Assign User Roles',

  'system.audit': 'View Audit Trails',
  'system.settings': 'Manage System Settings'
};

const ACTION_LABEL_MAP: Record<string, string> = {
  CUSTOMER_SELF_REGISTERED: 'Customer Registered',
  CUSTOMER_APPROVED: 'Customer Approved',
  CUSTOMER_REJECTED: 'Customer Rejected',
  AUTH_FAILED_LOGIN: 'Failed Login',
  AUTH_SUCCESS_LOGIN: 'Successful Login',
  SYSTEM_BOOTSTRAP: 'System Initialized',
  WALLET_CREDITED: 'Wallet Credited',
  WALLET_DEBITED: 'Wallet Debited',
  ORDER_CREATED: 'Order Created',
  ORDER_CONFIRMED: 'Order Confirmed',
  ORDER_PICKED: 'Order Picked',
  ORDER_PACKED: 'Order Packed',
  ORDER_CANCELLED: 'Order Cancelled',
  MANIFEST_CREATED: 'Dispatch Manifest Created',
  MANIFEST_DISPATCHED: 'Carrier Dispatched',
  INVENTORY_RECEIVED: 'Stock Received',
  INVENTORY_STOCKED: 'Stock Placed in Bin',
  INVENTORY_ADJUSTED: 'Stock Reconciled'
};

const ENTITY_LABEL_MAP: Record<string, string> = {
  CUSTOMER_PROFILE: 'Customer Profile',
  EMPLOYEE_PROFILE: 'Staff Profile',
  USER: 'User Account',
  WALLET_ACCOUNT: 'Wallet',
  WALLET_TRANSACTION: 'Wallet Ledger Entry',
  INVENTORY_UNIT: 'Inventory Unit',
  WAREHOUSE: 'Warehouse Facility',
  WAREHOUSE_LOCATION: 'Warehouse Bin/Location',
  FULFILLMENT_ORDER: 'Fulfillment Order',
  DISPATCH_MANIFEST: 'Dispatch Manifest',
  ROLE: 'Role & Permissions'
};

const ROLE_NAME_MAP: Record<string, string> = {
  role_administrator: 'Administrator',
  role_manager: 'Warehouse Manager',
  role_employee: 'Operations Staff',
  role_customer: 'Merchant Client'
};

/**
 * Convert technical permission code (e.g. 'employees.view') to natural English label ('View Employees')
 */
export function formatPermissionLabel(code: string): string {
  if (PERMISSION_LABEL_MAP[code]) {
    return PERMISSION_LABEL_MAP[code];
  }

  // Fallback: convert 'module.action' -> 'Action Module'
  const parts = code.split('.');
  if (parts.length === 2) {
    const module = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const action = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    return `${action} ${module}`;
  }

  return code;
}

/**
 * Convert uppercase action codes to professional human-readable action labels
 */
export function formatActionLabel(action: string): string {
  if (ACTION_LABEL_MAP[action]) {
    return ACTION_LABEL_MAP[action];
  }
  return action
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert entity types to human-readable labels
 */
export function formatEntityLabel(entityType: string): string {
  if (ENTITY_LABEL_MAP[entityType]) {
    return ENTITY_LABEL_MAP[entityType];
  }
  return entityType
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert role IDs to clear human-readable names
 */
export function formatRoleName(roleId: string, fallbackName?: string): string {
  if (ROLE_NAME_MAP[roleId]) {
    return ROLE_NAME_MAP[roleId];
  }
  return fallbackName || roleId;
}
