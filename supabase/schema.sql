-- ==============================================================================
-- SHIP ASAAN WMS & COURIER FULFILLMENT PLATFORM
-- SUPABASE POSTGRESQL PRODUCTION DATABASE SCHEMA & INITIAL SEED MIGRATION
-- ==============================================================================

-- Enable UUID extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. AUTHORITATIVE APPLICATION STATE SNAPSHOT TABLE (Dual-Sync Store)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ship_asaan_snapshots (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for security
ALTER TABLE public.ship_asaan_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (and anon access if using public key without auth headers)
CREATE POLICY "Allow all operations for authenticated service role"
ON public.ship_asaan_snapshots
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2. RELATIONAL DOMAIN ENTITIES
-- ------------------------------------------------------------------------------

-- Users & Authentication
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role_id TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('staff', 'customer')),
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'pending_approval', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Roles & Access Control (RBAC)
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_code TEXT NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_code)
);

-- Customer Profiles (Merchants)
CREATE TABLE IF NOT EXISTS public.customer_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    brand_name TEXT NOT NULL,
    cnic_or_ntn TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    bank_name TEXT,
    bank_account_title TEXT,
    bank_iban TEXT,
    approval_status TEXT NOT NULL CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
    rejection_reason TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    completeness_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Employee Profiles (Staff)
CREATE TABLE IF NOT EXISTS public.employee_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    designation TEXT NOT NULL,
    department TEXT NOT NULL,
    joining_date DATE NOT NULL,
    cnic TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    bank_name TEXT,
    bank_account_title TEXT,
    bank_iban TEXT,
    cv_uploaded BOOLEAN DEFAULT false,
    cnic_uploaded BOOLEAN DEFAULT false,
    completeness_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Financial Wallets & Ledger
CREATE TABLE IF NOT EXISTS public.wallet_accounts (
    id TEXT PRIMARY KEY,
    customer_profile_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    currency TEXT DEFAULT 'PKR' NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'frozen', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL REFERENCES public.wallet_accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT', 'ADJUSTMENT', 'REVERSAL')),
    amount NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT,
    description TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Warehouses & Storage Topology
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL,
    contact_phone TEXT,
    contact_name TEXT,
    total_locations INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.warehouse_locations (
    id TEXT PRIMARY KEY,
    warehouse_id TEXT NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    barcode TEXT UNIQUE NOT NULL,
    zone TEXT NOT NULL,
    aisle TEXT NOT NULL,
    rack TEXT NOT NULL,
    shelf TEXT NOT NULL,
    bin TEXT NOT NULL,
    type TEXT NOT NULL,
    max_weight_kg NUMERIC(8, 2) DEFAULT 50.00,
    max_volume_cbm NUMERIC(8, 4) DEFAULT 0.20,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Products & SKU Catalog
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    declared_value NUMERIC(10, 2) DEFAULT 0.00,
    weight_kg NUMERIC(8, 3) DEFAULT 0.250,
    length_cm NUMERIC(8, 2) DEFAULT 10.0,
    width_cm NUMERIC(8, 2) DEFAULT 10.0,
    height_cm NUMERIC(8, 2) DEFAULT 10.0,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Physical Inventory Units (Serialized Barcode Units)
CREATE TABLE IF NOT EXISTS public.inventory_units (
    id TEXT PRIMARY KEY,
    tracking_code TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,
    location_id TEXT REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    batch_id TEXT,
    state TEXT NOT NULL CHECK (state IN ('awaiting_stocking', 'in_storage', 'reserved', 'picking', 'picked', 'at_packing', 'packed', 'fulfilled', 'returned', 'damaged', 'lost')),
    condition TEXT DEFAULT 'good' NOT NULL CHECK (condition IN ('good', 'damaged')),
    notes TEXT,
    order_id TEXT,
    order_item_id TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    stocked_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Fulfillment Orders & Line Items
CREATE TABLE IF NOT EXISTS public.fulfillment_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL,
    consignee_name TEXT NOT NULL,
    consignee_phone TEXT NOT NULL,
    consignee_address TEXT NOT NULL,
    consignee_city TEXT NOT NULL,
    cod_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    status TEXT NOT NULL,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    courier_tracking_id TEXT,
    assigned_carrier TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Carrier Dispatch Manifests
CREATE TABLE IF NOT EXISTS public.dispatch_manifests (
    id TEXT PRIMARY KEY,
    manifest_number TEXT UNIQUE NOT NULL,
    carrier_name TEXT NOT NULL,
    driver_name TEXT,
    driver_phone TEXT,
    vehicle_number TEXT,
    total_orders INTEGER DEFAULT 0 NOT NULL,
    total_cod_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'signed_dispatched', 'closed')),
    created_by_name TEXT NOT NULL,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Audit Ledger
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    actor_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_units_tracking ON public.inventory_units(tracking_code);
CREATE INDEX IF NOT EXISTS idx_orders_number ON public.fulfillment_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_manifests_number ON public.dispatch_manifests(manifest_number);

-- Output success verification
SELECT 'Ship Asaan Supabase schema created successfully' AS status;
