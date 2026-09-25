/**
 * Client API Connector for Ship Asaan
 * Fine-grained targeted requests, session management, and mutation hooks without polling.
 */

export interface CustomerProfile {
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

export interface EmployeeProfile {
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

export interface CompletenessSection {
  id: string;
  title: string;
  weight: number;
  completed: boolean;
  missingFields: string[];
}

export interface CompletenessReport {
  score: number;
  sections: CompletenessSection[];
  isComplete: boolean;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role_id: string;
  role_name: string;
  account_type: 'staff' | 'customer';
  status: string;
  permissions: string[];
  customer_profile?: CustomerProfile | null;
  employee_profile?: EmployeeProfile | null;
}

export interface AuthResponse {
  token: string;
  user: UserSession;
}

export interface AuditLogItem {
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

export interface SystemOverview {
  totalUsers: number;
  totalRoles: number;
  activeSessions: number;
  totalAuditLogs: number;
  serverTime: string;
}

export interface CustomerItem {
  profile: CustomerProfile;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    status: string;
    created_at: string;
  };
  completeness: CompletenessReport | null;
}

export interface EmployeeItem {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    status: string;
    role_id: string;
    role_name: string;
    created_at: string;
  };
  profile: EmployeeProfile | null;
  completeness: CompletenessReport | null;
}

export interface RoleItem {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  is_active: boolean;
  permissions: string[];
  assignedUserCount: number;
  created_at: string;
  updated_at: string;
}

export interface PermissionDefinition {
  code: string;
  module: string;
  description: string;
}

export interface WalletAccount {
  id: string;
  customer_profile_id: string;
  user_id: string;
  balance: number;
  currency: string;
  status: 'active' | 'frozen' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface WalletAccountWithCustomer extends WalletAccount {
  business_name: string;
  brand_name: string;
  city: string;
  phone: string;
  email: string;
  approval_status: string;
  last_transaction_at: string | null;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  customer_profile_id: string;
  type: 'CREDIT' | 'DEBIT' | 'ADJUSTMENT' | 'REVERSAL';
  amount: number;
  balance_before: number;
  balance_after: number;
  payment_method: string;
  reference_number?: string;
  notes: string;
  actor_id: string;
  actor_name: string;
  created_at: string;
  business_name?: string;
  brand_name?: string;
}

export interface WalletSummary {
  total_balance: number;
  active_wallets_count: number;
  recent_credits_30d: number;
  recent_debits_30d: number;
  total_accounts_count: number;
}

export interface DepositInstructions {
  bank_name: string;
  account_title: string;
  account_number: string;
  iban: string;
  branch: string;
  raast_id: string;
  instructions: string;
}

// Phase 4: Warehouse & Location Types
export type LocationType = 'zone' | 'aisle' | 'rack' | 'shelf' | 'bin' | 'bay';
export type LocationStatus = 'available' | 'full' | 'restricted' | 'damaged' | 'reserved';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  contact_person: string;
  contact_phone: string;
  status: 'active' | 'inactive' | 'maintenance';
  total_area_sqft: number;
  total_locations?: number;
  total_capacity_units?: number;
  occupied_units?: number;
  created_at: string;
  updated_at: string;
}

export interface StorageTemplate {
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

export interface WarehouseLocation {
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
  breadcrumbs?: { id: string; name: string; code: string; type: LocationType }[];
}

export interface LocationTreeNode extends WarehouseLocation {
  children: LocationTreeNode[];
  total_descendants: number;
}

export interface BulkLocationGenerationConfig {
  parent_id: string | null;
  type: LocationType;
  prefix: string;
  code_prefix: string;
  start_number: number;
  count: number;
  zero_pad: number;
  template_id?: string | null;
  dimensions?: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  max_weight_kg?: number;
  max_units?: number;
}

export interface LocationLabelData {
  location: WarehouseLocation;
  warehouse: Warehouse;
  qrDataUrl: string;
  barcodeString: string;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('ship_asaan_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('ship_asaan_token', token);
    } else {
      localStorage.removeItem('ship_asaan_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    const activeToken = this.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('ship_asaan_token') : null);
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Network request failed');
    }

    return data as T;
  }

  // Authentication Endpoints
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(res.token);
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.request<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getCurrentUser(): Promise<{ user: UserSession }> {
    return this.request<{ user: UserSession }>('/api/auth/me');
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; devOtpHint?: string }> {
    return this.request<{ success: boolean; message: string; devOtpHint?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword })
    });
  }

  // System & Audit
  async getSystemOverview(): Promise<SystemOverview> {
    return this.request<SystemOverview>('/api/system/overview');
  }

  async getAuditLogs(): Promise<{ logs: AuditLogItem[] }> {
    return this.request<{ logs: AuditLogItem[] }>('/api/system/audit-logs');
  }

  // Customers
  async registerCustomer(data: {
    email: string;
    password: string;
    name: string;
    business_name: string;
    brand_name?: string;
    cnic_or_ntn: string;
    phone: string;
    address: string;
    city: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/customers/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getCustomers(params?: { status?: string; search?: string }): Promise<{ customers: CustomerItem[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ customers: CustomerItem[] }>(`/api/customers${qs}`);
  }

  async getCustomer(id: string): Promise<{ customer: CustomerItem & { auditLogs: AuditLogItem[] } }> {
    return this.request<{ customer: CustomerItem & { auditLogs: AuditLogItem[] } }>(`/api/customers/${id}`);
  }

  async approveCustomer(id: string): Promise<{ success: boolean; message: string; profile: CustomerProfile }> {
    return this.request<{ success: boolean; message: string; profile: CustomerProfile }>(`/api/customers/${id}/approve`, {
      method: 'POST'
    });
  }

  async rejectCustomer(id: string, reason: string): Promise<{ success: boolean; message: string; profile: CustomerProfile }> {
    return this.request<{ success: boolean; message: string; profile: CustomerProfile }>(`/api/customers/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async suspendCustomer(id: string, reason: string): Promise<{ success: boolean; message: string; profile: CustomerProfile }> {
    return this.request<{ success: boolean; message: string; profile: CustomerProfile }>(`/api/customers/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async updateCustomerProfile(id: string, data: Partial<CustomerProfile>): Promise<{ success: boolean; profile: CustomerProfile; completeness: CompletenessReport }> {
    return this.request<{ success: boolean; profile: CustomerProfile; completeness: CompletenessReport }>(`/api/customers/${id}/profile`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Employees
  async getEmployees(params?: { department?: string; status?: string; search?: string }): Promise<{ employees: EmployeeItem[] }> {
    const query = new URLSearchParams();
    if (params?.department) query.set('department', params.department);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ employees: EmployeeItem[] }>(`/api/employees${qs}`);
  }

  async createEmployee(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role_id?: string;
    designation: string;
    department: string;
    joining_date?: string;
    cnic?: string;
    address?: string;
    city?: string;
  }): Promise<{ success: boolean; message: string; employee: EmployeeItem }> {
    return this.request<{ success: boolean; message: string; employee: EmployeeItem }>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getEmployee(id: string): Promise<{ employee: EmployeeItem }> {
    return this.request<{ employee: EmployeeItem }>(`/api/employees/${id}`);
  }

  async updateEmployeeProfile(id: string, data: any): Promise<{ success: boolean; employee: EmployeeItem }> {
    return this.request<{ success: boolean; employee: EmployeeItem }>(`/api/employees/${id}/profile`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async toggleEmployeeStatus(id: string, status: 'active' | 'inactive' | 'suspended'): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/employees/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // Roles & Permissions
  async getRoles(): Promise<{ roles: RoleItem[] }> {
    return this.request<{ roles: RoleItem[] }>('/api/roles');
  }

  async getPermissions(): Promise<{ permissions: PermissionDefinition[]; grouped: Record<string, PermissionDefinition[]> }> {
    return this.request<{ permissions: PermissionDefinition[]; grouped: Record<string, PermissionDefinition[]> }>('/api/roles/permissions');
  }

  async createRole(data: { name: string; description: string; permissions: string[] }): Promise<{ success: boolean; message: string; role: RoleItem }> {
    return this.request<{ success: boolean; message: string; role: RoleItem }>('/api/roles', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateRole(id: string, data: { name?: string; description?: string; permissions?: string[] }): Promise<{ success: boolean; role: RoleItem }> {
    return this.request<{ success: boolean; role: RoleItem }>(`/api/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteRole(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/roles/${id}`, {
      method: 'DELETE'
    });
  }

  // Customer Wallet & Financial Ledger
  async getMyWallet(customerProfileId?: string): Promise<{
    wallet: WalletAccount;
    customer: { id: string; business_name: string; brand_name: string; approval_status: string };
    deposit_instructions: DepositInstructions;
    statistics: { total_credited: number; total_debited: number; transaction_count: number };
    transactions: WalletTransaction[];
  }> {
    const qs = customerProfileId ? `?customer_profile_id=${encodeURIComponent(customerProfileId)}` : '';
    return this.request(`/api/wallet/my-wallet${qs}`);
  }

  async getWalletInstructions(): Promise<{ instructions: DepositInstructions }> {
    return this.request('/api/wallet/instructions');
  }

  async getWalletAccounts(): Promise<{
    accounts: WalletAccountWithCustomer[];
    summary: WalletSummary;
  }> {
    return this.request('/api/wallet/accounts');
  }

  async getWalletTransactions(params?: {
    customer_profile_id?: string;
    type?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    transactions: WalletTransaction[];
    total_count: number;
  }> {
    const query = new URLSearchParams();
    if (params?.customer_profile_id) query.append('customer_profile_id', params.customer_profile_id);
    if (params?.type) query.append('type', params.type);
    if (params?.search) query.append('search', params.search);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/wallet/transactions${qs}`);
  }

  async creditWallet(data: {
    customer_profile_id: string;
    amount: number;
    payment_method: string;
    reference_number?: string;
    notes: string;
  }): Promise<{ message: string; wallet: WalletAccount; transaction: WalletTransaction }> {
    return this.request('/api/wallet/credit', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async debitWallet(data: {
    customer_profile_id: string;
    amount: number;
    payment_method: string;
    reference_number?: string;
    notes: string;
    allow_negative?: boolean;
  }): Promise<{ message: string; wallet: WalletAccount; transaction: WalletTransaction }> {
    return this.request('/api/wallet/debit', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async adjustWallet(data: {
    customer_profile_id: string;
    amount_delta: number;
    reason: string;
    reference_number?: string;
  }): Promise<{ message: string; wallet: WalletAccount; transaction: WalletTransaction }> {
    return this.request('/api/wallet/adjust', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async reverseTransaction(
    transactionId: string,
    reason: string
  ): Promise<{ message: string; wallet: WalletAccount; reversal: WalletTransaction }> {
    return this.request(`/api/wallet/reverse/${transactionId}`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  getWalletExportUrl(customerProfileId?: string): string {
    const token = this.getToken();
    const base = `/api/wallet/export`;
    const params = new URLSearchParams();
    if (customerProfileId) params.append('customer_profile_id', customerProfileId);
    if (token) params.append('token', token);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return `${base}${qs}`;
  }

  // ----------------------------------------------------
  // Phase 4: Warehouse Infrastructure & Locations
  // ----------------------------------------------------
  async getWarehouses(): Promise<{ warehouses: Warehouse[] }> {
    return this.request('/api/warehouses');
  }

  async getWarehouse(id: string): Promise<{ warehouse: Warehouse }> {
    return this.request(`/api/warehouses/${id}`);
  }

  async createWarehouse(data: {
    code: string;
    name: string;
    city: string;
    address: string;
    contact_person?: string;
    contact_phone?: string;
    total_area_sqft?: number;
  }): Promise<{ warehouse: Warehouse; message: string }> {
    return this.request('/api/warehouses', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateWarehouse(
    id: string,
    data: Partial<Warehouse>
  ): Promise<{ warehouse: Warehouse; message: string }> {
    return this.request(`/api/warehouses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async getWarehouseTree(warehouseId: string): Promise<{ tree: LocationTreeNode[] }> {
    return this.request(`/api/warehouses/${warehouseId}/tree`);
  }

  async getLocation(id: string): Promise<{ location: WarehouseLocation }> {
    return this.request(`/api/warehouses/locations/${id}`);
  }

  async createLocation(
    warehouseId: string,
    data: {
      parent_id?: string | null;
      name: string;
      code: string;
      type: LocationType;
      template_id?: string | null;
      dimensions?: { length_cm: number; width_cm: number; height_cm: number };
      max_weight_kg?: number;
      max_units?: number;
      notes?: string;
    }
  ): Promise<{ location: WarehouseLocation; message: string }> {
    return this.request(`/api/warehouses/${warehouseId}/locations`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async bulkCreateLocations(
    warehouseId: string,
    config: BulkLocationGenerationConfig
  ): Promise<{ locations: WarehouseLocation[]; count: number; message: string }> {
    return this.request(`/api/warehouses/${warehouseId}/locations/bulk`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  async updateLocation(
    id: string,
    data: {
      name?: string;
      status?: LocationStatus;
      notes?: string;
      max_units?: number;
      max_weight_kg?: number;
      dimensions?: { length_cm: number; width_cm: number; height_cm: number };
    }
  ): Promise<{ location: WarehouseLocation; message: string }> {
    return this.request(`/api/warehouses/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteLocation(id: string): Promise<{ message: string }> {
    return this.request(`/api/warehouses/locations/${id}`, {
      method: 'DELETE'
    });
  }

  async getLocationLabel(id: string): Promise<LocationLabelData> {
    return this.request(`/api/warehouses/locations/${id}/label`);
  }

  async getStorageTemplates(): Promise<{ templates: StorageTemplate[] }> {
    return this.request('/api/warehouses/templates');
  }

  async createStorageTemplate(data: {
    name: string;
    type: LocationType;
    description?: string;
    length_cm: number;
    width_cm: number;
    height_cm: number;
    max_weight_kg?: number;
    max_units?: number;
  }): Promise<{ template: StorageTemplate; message: string }> {
    return this.request('/api/warehouses/templates', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async deleteStorageTemplate(id: string): Promise<{ message: string }> {
    return this.request(`/api/warehouses/templates/${id}`, {
      method: 'DELETE'
    });
  }

  // -----------------------------------------------------------
  // Phase 5: Products, Inventory Units & Physical Ledger
  // -----------------------------------------------------------

  async getProducts(params?: {
    customerId?: string;
    search?: string;
    category?: string;
    lowStockOnly?: boolean;
    status?: 'active' | 'archived';
  }): Promise<{ products: EnrichedProduct[] }> {
    const q = new URLSearchParams();
    if (params?.customerId) q.set('customerId', params.customerId);
    if (params?.search) q.set('search', params.search);
    if (params?.category) q.set('category', params.category);
    if (params?.lowStockOnly) q.set('lowStockOnly', 'true');
    if (params?.status) q.set('status', params.status);

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return this.request(`/api/inventory/products${queryStr}`);
  }

  async createProduct(data: {
    customerId?: string;
    sku: string;
    name: string;
    description?: string;
    category?: string;
    barcode?: string;
    dimensions?: { length_cm: number; width_cm: number; height_cm: number };
    weight_kg?: number;
    declared_value?: number;
    low_stock_threshold?: number;
  }): Promise<{ product: Product; message: string }> {
    return this.request('/api/inventory/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateProduct(
    id: string,
    data: {
      name?: string;
      description?: string;
      category?: string;
      barcode?: string;
      dimensions?: { length_cm: number; width_cm: number; height_cm: number };
      weight_kg?: number;
      declared_value?: number;
      low_stock_threshold?: number;
      status?: 'active' | 'archived';
    }
  ): Promise<{ product: Product; message: string }> {
    return this.request(`/api/inventory/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async receiveStock(data: {
    warehouseId: string;
    customerId: string;
    carrier?: string;
    trackingReference?: string;
    items: Array<{
      productId: string;
      quantity: number;
      condition?: 'good' | 'damaged';
      notes?: string;
    }>;
  }): Promise<{
    batch: ReceivingBatch;
    unitsCreated: number;
    sampleUnits: InventoryUnit[];
    message: string;
  }> {
    return this.request('/api/inventory/receive', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getReceivingBatches(customerId?: string): Promise<{ batches: ReceivingBatch[] }> {
    const q = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
    return this.request(`/api/inventory/batches${q}`);
  }

  async getInventoryUnits(params?: {
    customerId?: string;
    productId?: string;
    warehouseId?: string;
    locationId?: string;
    batchId?: string;
    state?: InventoryUnitState;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ units: EnrichedInventoryUnit[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.customerId) q.set('customerId', params.customerId);
    if (params?.productId) q.set('productId', params.productId);
    if (params?.warehouseId) q.set('warehouseId', params.warehouseId);
    if (params?.locationId) q.set('locationId', params.locationId);
    if (params?.batchId) q.set('batchId', params.batchId);
    if (params?.state) q.set('state', params.state);
    if (params?.search) q.set('search', params.search);
    if (params?.limit) q.set('limit', params.limit.toString());
    if (params?.offset) q.set('offset', params.offset.toString());

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return this.request(`/api/inventory/units${queryStr}`);
  }

  async stockScanUnit(data: {
    unitTrackingCode: string;
    locationCodeOrBarcode: string;
  }): Promise<{
    unit: InventoryUnit;
    location: WarehouseLocation;
    batch?: ReceivingBatch;
    message: string;
  }> {
    return this.request('/api/inventory/stock-scan', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async moveUnit(data: {
    unitId: string;
    toLocationId: string;
    notes?: string;
  }): Promise<{
    unit: InventoryUnit;
    fromLocation?: WarehouseLocation;
    toLocation: WarehouseLocation;
    message: string;
  }> {
    return this.request('/api/inventory/move', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async adjustUnit(data: {
    unitId: string;
    condition?: 'good' | 'damaged';
    state?: InventoryUnitState;
    notes: string;
  }): Promise<{ unit: InventoryUnit; message: string }> {
    return this.request('/api/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getInventoryLedger(params?: {
    customerId?: string;
    unitId?: string;
    productId?: string;
    type?: string;
    limit?: number;
  }): Promise<{ ledger: InventoryTransaction[] }> {
    const q = new URLSearchParams();
    if (params?.customerId) q.set('customerId', params.customerId);
    if (params?.unitId) q.set('unitId', params.unitId);
    if (params?.productId) q.set('productId', params.productId);
    if (params?.type) q.set('type', params.type);
    if (params?.limit) q.set('limit', params.limit.toString());

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return this.request(`/api/inventory/ledger${queryStr}`);
  }

  async getUnitLabels(data: {
    unitIds?: string[];
    batchId?: string;
    productId?: string;
  }): Promise<{ labels: UnitLabelData[] }> {
    return this.request('/api/inventory/labels', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // -------------------------------------------------------------
  // Phase 6: Fulfillment Orders & CSV Engine
  // -------------------------------------------------------------

  async getOrders(params?: {
    status?: string;
    customerId?: string;
    search?: string;
    city?: string;
    paymentMethod?: 'cod' | 'prepaid';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    orders: FulfillmentOrder[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.customerId) q.set('customerId', params.customerId);
    if (params?.search) q.set('search', params.search);
    if (params?.city) q.set('city', params.city);
    if (params?.paymentMethod) q.set('paymentMethod', params.paymentMethod);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.page) q.set('page', params.page.toString());
    if (params?.limit) q.set('limit', params.limit.toString());

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return this.request(`/api/orders${queryStr}`);
  }

  async getOrderDetails(id: string): Promise<{
    order: FulfillmentOrder;
    customer: {
      id: string;
      business_name: string;
      brand_name: string;
      phone: string;
      city: string;
    } | null;
    items: FulfillmentOrderItem[];
    allocated_units: Array<{
      id: string;
      tracking_code: string;
      state: string;
      location_id: string | null;
    }>;
  }> {
    return this.request(`/api/orders/${id}`);
  }

  async createOrder(data: {
    customerId?: string;
    customerReference?: string;
    consigneeName: string;
    consigneePhone: string;
    consigneeEmail?: string;
    shippingAddress: string;
    city: string;
    province?: string;
    postalCode?: string;
    codAmount: number;
    paymentMethod?: 'cod' | 'prepaid';
    shippingNotes?: string;
    items: Array<{
      productId?: string;
      sku?: string;
      quantity: number;
      unitPrice?: number;
    }>;
    autoConfirm?: boolean;
  }): Promise<{ order: FulfillmentOrder; itemsCount: number }> {
    return this.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async previewOrdersCsv(csvContent: string, customerId?: string): Promise<CsvPreviewResult> {
    return this.request('/api/orders/csv/preview', {
      method: 'POST',
      body: JSON.stringify({ csvContent, customerId })
    });
  }

  async commitOrdersCsv(
    previewData: CsvPreviewResult,
    skipInvalid: boolean = false
  ): Promise<{
    importedCount: number;
    skippedCount: number;
    createdOrderNumbers: string[];
  }> {
    return this.request('/api/orders/csv/commit', {
      method: 'POST',
      body: JSON.stringify({ previewData, skipInvalid })
    });
  }

  async confirmOrder(id: string): Promise<{ order: FulfillmentOrder }> {
    return this.request(`/api/orders/${id}/confirm`, {
      method: 'POST'
    });
  }

  async bulkConfirmOrders(orderIds: string[]): Promise<{
    confirmedCount: number;
    failedCount: number;
    failed: Array<{ orderId: string; reason: string }>;
  }> {
    return this.request('/api/orders/bulk-confirm', {
      method: 'POST',
      body: JSON.stringify({ orderIds })
    });
  }

  async cancelOrder(id: string, reason: string): Promise<{ order: FulfillmentOrder }> {
    return this.request(`/api/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async exportOrdersCsv(params?: {
    status?: string;
    customerId?: string;
    search?: string;
    city?: string;
    paymentMethod?: 'cod' | 'prepaid';
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.customerId) q.set('customerId', params.customerId);
    if (params?.search) q.set('search', params.search);
    if (params?.city) q.set('city', params.city);
    if (params?.paymentMethod) q.set('paymentMethod', params.paymentMethod);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);

    const queryStr = q.toString() ? `?${q.toString()}` : '';
    const res = await fetch(`/api/orders/export${queryStr}`, {
      headers: {
        Authorization: `Bearer ${this.token || localStorage.getItem('ship_asaan_token') || ''}`
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(err.error || 'Failed to export orders');
    }

    return res.blob();
  }

  // -------------------------------------------------------------
  // Phase 7: Warehouse Fulfillment, Picking & Scan-to-Pack
  // -------------------------------------------------------------

  async prepareFulfillment(orderIds: string[]): Promise<{
    success: boolean;
    message: string;
    result: {
      preparedCount: number;
      preparedOrderNumbers: string[];
      failedCount: number;
      failedOrders: Array<{ orderId: string; orderNumber: string; reason: string }>;
      totalUnitsReserved: number;
    };
  }> {
    return this.request('/api/fulfillment/prepare', {
      method: 'POST',
      body: JSON.stringify({ orderIds })
    });
  }

  async createPickingBatch(orderIds: string[]): Promise<{
    success: boolean;
    message: string;
    batch: PickingBatch;
  }> {
    return this.request('/api/fulfillment/batches', {
      method: 'POST',
      body: JSON.stringify({ orderIds })
    });
  }

  async getPickingBatches(): Promise<{ batches: PickingBatch[] }> {
    return this.request('/api/fulfillment/batches');
  }

  async getPickingBatchDetails(batchId: string): Promise<PickingBatchDetails> {
    return this.request(`/api/fulfillment/batches/${batchId}`);
  }

  async pickUnitScan(params: {
    unitTrackingCode: string;
    batchId?: string;
    orderId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    result: {
      unit: {
        id: string;
        tracking_code: string;
        state: string;
        product_name: string;
        sku: string;
        location_code: string;
      };
      order: {
        id: string;
        order_number: string;
        status: string;
        consignee_name: string;
        isOrderFullyPicked: boolean;
      };
      batchCompleted: boolean;
    };
  }> {
    return this.request('/api/fulfillment/pick-scan', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async packOrderScan(orderBarcode: string): Promise<{
    success: boolean;
    message: string;
    result: {
      order: {
        id: string;
        order_number: string;
        customer_reference?: string;
        consignee_name: string;
        consignee_phone: string;
        city: string;
        shipping_address: string;
        cod_amount: number;
        payment_method: 'cod' | 'prepaid';
        total_pieces: number;
        status: string;
        customer_brand: string;
      };
      packedUnitsCount: number;
      packedAt: string;
    };
  }> {
    return this.request('/api/fulfillment/pack-scan', {
      method: 'POST',
      body: JSON.stringify({ orderBarcode })
    });
  }

  async dispatchOrders(orderIds: string[]): Promise<{
    success: boolean;
    message: string;
    result: {
      dispatchedCount: number;
      dispatchedOrders: string[];
      failedCount: number;
      failedOrders: Array<{ orderId: string; reason: string }>;
    };
  }> {
    return this.request('/api/fulfillment/dispatch', {
      method: 'POST',
      body: JSON.stringify({ orderIds })
    });
  }

  async getShippingLabels(orderIds: string[]): Promise<{ labels: ShippingLabelData[] }> {
    return this.request('/api/fulfillment/shipping-labels', {
      method: 'POST',
      body: JSON.stringify({ orderIds })
    });
  }

  // -------------------------------------------------------------
  // Phase 8: Carrier Dispatch, Tracking, Returns & Automated Billing
  // -------------------------------------------------------------

  async createDispatchManifest(data: {
    carrierName: string;
    driverName?: string;
    driverPhone?: string;
    vehicleNumber?: string;
    handoverNotes?: string;
    orderIds: string[];
  }): Promise<{ success: boolean; message: string; manifest: DispatchManifest }> {
    return this.request('/api/dispatch/manifests', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async signAndDispatchManifest(manifestId: string): Promise<{
    success: boolean;
    message: string;
    result: {
      manifest: DispatchManifest;
      processedOrders: Array<{ orderNumber: string; billedAmount: number; trackingEventId: string }>;
    };
  }> {
    return this.request(`/api/dispatch/manifests/${manifestId}/sign`, {
      method: 'POST'
    });
  }

  async getDispatchManifests(): Promise<{ manifests: DispatchManifestWithOrders[] }> {
    return this.request('/api/dispatch/manifests');
  }

  async getDispatchManifestDetails(id: string): Promise<DispatchManifestDetails> {
    return this.request(`/api/dispatch/manifests/${id}`);
  }

  async addTrackingEvent(data: {
    orderId: string;
    status: OrderTrackingStatus;
    location: string;
    description: string;
  }): Promise<{ success: boolean; message: string; event: OrderTrackingEvent }> {
    return this.request('/api/dispatch/tracking', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getOrderTracking(orderIdentifier: string): Promise<OrderTrackingHistory> {
    return this.request(`/api/dispatch/tracking/${orderIdentifier}`);
  }

  async processReturn(data: {
    orderId: string;
    returnType: 'rto_courier' | 'customer_return';
    returnReason: string;
    trackingReference?: string;
    disposition: 'restocked' | 'damaged_quarantine' | 'merchant_claim' | 'scrapped';
    targetLocationId?: string;
    conditionNotes: string;
  }): Promise<{
    success: boolean;
    message: string;
    result: {
      returnOrder: ReturnOrder;
      unitsReconciledCount: number;
      targetLocationName: string;
    };
  }> {
    return this.request('/api/dispatch/returns', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getReturnOrders(): Promise<{ returns: ReturnOrderEnriched[] }> {
    return this.request('/api/dispatch/returns');
  }

  async getBillingRateCards(): Promise<{ rateCards: BillingRateCard[] }> {
    return this.request('/api/dispatch/rate-cards');
  }

  async updateBillingRateCard(
    id: string,
    updates: Partial<BillingRateCard>
  ): Promise<{ success: boolean; message: string; rateCard: BillingRateCard }> {
    return this.request(`/api/dispatch/rate-cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }
}

// Phase 8 Interfaces
export interface DispatchManifest {
  id: string;
  manifest_number: string;
  carrier_name: string;
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

export interface DispatchManifestWithOrders extends DispatchManifest {
  orders: Array<{
    id: string;
    order_number: string;
    consignee_name: string;
    consignee_phone: string;
    shipping_address: string;
    city: string;
    cod_amount: number;
    payment_method: 'cod' | 'prepaid';
    status: string;
    customer_brand: string;
  }>;
}

export interface DispatchManifestDetails {
  manifest: DispatchManifest;
  orders: Array<{
    sequence: number;
    id: string;
    order_number: string;
    customer_reference: string;
    customer_brand: string;
    consignee_name: string;
    consignee_phone: string;
    city: string;
    shipping_address: string;
    payment_method: 'cod' | 'prepaid';
    cod_amount: number;
    total_pieces: number;
    shipping_notes: string;
    status: string;
  }>;
  summary: {
    total_orders: number;
    total_cod_amount: number;
    cod_orders_count: number;
    prepaid_orders_count: number;
    total_pieces_count: number;
  };
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

export interface OrderTrackingEvent {
  id: string;
  order_id: string;
  order_number: string;
  status: OrderTrackingStatus;
  location: string;
  description: string;
  actor_id?: string | null;
  actor_name?: string | null;
  created_at: string;
}

export interface OrderTrackingHistory {
  order: {
    id: string;
    order_number: string;
    customer_reference?: string;
    status: string;
    consignee_name: string;
    city: string;
    shipping_address: string;
    cod_amount: number;
    payment_method: 'cod' | 'prepaid';
    created_at: string;
    customer_brand: string;
  };
  items: FulfillmentOrderItem[];
  timeline: OrderTrackingEvent[];
}

export interface ReturnOrder {
  id: string;
  return_number: string;
  order_id: string;
  order_number: string;
  customer_id: string;
  return_type: 'rto_courier' | 'customer_return';
  return_reason: string;
  tracking_reference?: string;
  disposition: 'restocked' | 'damaged_quarantine' | 'merchant_claim' | 'scrapped';
  target_location_id?: string | null;
  condition_notes: string;
  processed_by_id: string;
  processed_by_name: string;
  created_at: string;
}

export interface ReturnOrderEnriched extends ReturnOrder {
  customer_brand: string;
  consignee_name: string;
  city: string;
  target_location_name: string | null;
}

export interface BillingRateCard {
  id: string;
  customer_id?: string | null;
  name: string;
  base_courier_fee: number;
  per_kg_fee: number;
  pick_pack_fee_per_unit: number;
  daily_storage_fee_per_cbm: number;
  return_processing_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Phase 7 Interfaces
export interface PickingBatch {
  id: string;
  batch_number: string;
  status: 'active' | 'completed' | 'cancelled';
  order_ids: string[];
  total_units_count: number;
  picked_units_count: number;
  created_by_user_id: string;
  created_by_name: string;
  created_at: string;
  completed_at?: string | null;
}

export interface PickingBatchDetails {
  batch: PickingBatch;
  orders: Array<{
    id: string;
    order_number: string;
    customer_reference?: string;
    consignee_name: string;
    city: string;
    status: string;
    total_pieces: number;
  }>;
  pickLocations: Array<{
    locationId: string | null;
    locationCode: string;
    locationPath: string;
    warehouseId: string | null;
    items: Array<{
      productId: string;
      sku: string;
      productName: string;
      totalUnitsRequired: number;
      pickedUnitsCount: number;
      units: Array<{
        unitId: string;
        trackingCode: string;
        state: string;
        orderId: string;
        orderNumber: string;
        consigneeName: string;
      }>;
    }>;
  }>;
  totalUnits: number;
  pickedUnits: number;
  isComplete: boolean;
}

export interface ShippingLabelData {
  orderId: string;
  orderNumber: string;
  customerReference: string;
  consigneeName: string;
  consigneePhone: string;
  consigneeEmail: string;
  shippingAddress: string;
  city: string;
  province: string;
  postalCode: string;
  codAmount: number;
  paymentMethod: 'cod' | 'prepaid';
  totalPieces: number;
  shippingNotes: string;
  shipper: {
    brandName: string;
    businessName: string;
    city: string;
    phone: string;
  };
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
  }>;
  createdAt: string;
}

// Phase 5 Interfaces
export interface Product {
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

export interface EnrichedProduct extends Product {
  customer_brand?: string;
  customer_name?: string;
  on_hand_units: number;
  in_storage_units: number;
  awaiting_stocking_units: number;
  reserved_units: number;
  damaged_units: number;
  is_low_stock: boolean;
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

export interface InventoryUnit {
  id: string;
  tracking_code: string;
  product_id: string;
  customer_id: string;
  location_id: string | null;
  warehouse_id: string | null;
  batch_id: string;
  state: InventoryUnitState;
  condition: 'good' | 'damaged';
  notes?: string;
  received_at: string;
  stocked_at?: string | null;
  updated_at: string;
}

export interface EnrichedInventoryUnit extends InventoryUnit {
  product_name: string;
  product_sku: string;
  customer_brand: string;
  location_name?: string;
  location_code?: string;
  location_path?: string;
  warehouse_name?: string;
}

export interface ReceivingBatch {
  id: string;
  batch_number: string;
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

export interface InventoryTransaction {
  id: string;
  unit_id: string;
  tracking_code: string;
  product_id: string;
  customer_id: string;
  type: 'RECEIVE' | 'STOCK' | 'MOVE' | 'RESERVE' | 'PICK' | 'PACK' | 'FULFILL' | 'RETURN' | 'DAMAGE' | 'LOSS' | 'ADJUST';
  from_location_id: string | null;
  to_location_id: string | null;
  from_state: string;
  to_state: string;
  actor_id: string;
  actor_name: string;
  notes: string;
  created_at: string;
}

export interface UnitLabelData {
  unitId: string;
  trackingCode: string;
  productName: string;
  productSku: string;
  customerBrand: string;
  receivedAt: string;
  condition: string;
  barcodeValue: string;
  qrPayload: string;
}

// Phase 6: Fulfillment Orders Interfaces
export type FulfillmentOrderStatus =
  | 'placed'
  | 'confirmed'
  | 'to_fulfill'
  | 'picked'
  | 'packed'
  | 'fulfilled'
  | 'cancelled';

export interface FulfillmentOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_reference?: string;
  customer_brand?: string;
  customer_business_name?: string;
  status: FulfillmentOrderStatus;
  consignee_name: string;
  consignee_phone: string;
  consignee_email?: string;
  shipping_address: string;
  city: string;
  province?: string;
  postal_code?: string;
  cod_amount: number;
  payment_method: 'cod' | 'prepaid';
  declared_total_value: number;
  shipping_notes?: string;
  items_count?: number;
  total_pieces?: number;
  items_preview?: string;
  stock_adequacy?: 'sufficient' | 'partial' | 'out_of_stock';
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

export interface FulfillmentOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
  barcode?: string;
  weight_kg?: number;
  dimensions?: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  stock_summary?: {
    inStorage: number;
    reserved: number;
    awaitingStocking: number;
    availableToFulfill: number;
  };
  stock_sufficient?: boolean;
  created_at: string;
}

export interface CsvOrderItemPreview {
  sku: string;
  productName: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  availableStock: number;
  isValid: boolean;
  error?: string;
}

export interface CsvOrderPreview {
  tempId: string;
  rowIndices: number[];
  customerReference?: string;
  consigneeName: string;
  consigneePhone: string;
  consigneeEmail?: string;
  shippingAddress: string;
  city: string;
  province?: string;
  postalCode?: string;
  codAmount: number;
  paymentMethod: 'cod' | 'prepaid';
  shippingNotes?: string;
  items: CsvOrderItemPreview[];
  totalPieces: number;
  totalDeclaredValue: number;
  isValid: boolean;
  errors: Array<{ field: string; message: string; hint: string }>;
  warnings: string[];
}

export interface CsvPreviewResult {
  summary: {
    totalRows: number;
    totalOrders: number;
    validOrdersCount: number;
    invalidOrdersCount: number;
    totalPieces: number;
    totalCodAmount: number;
  };
  customerId: string;
  customerName: string;
  orders: CsvOrderPreview[];
  canCommit: boolean;
}

export const api = new ApiClient();
