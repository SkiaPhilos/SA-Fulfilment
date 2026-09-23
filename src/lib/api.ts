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

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
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
}

export const api = new ApiClient();
