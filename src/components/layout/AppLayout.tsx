import React, { useState, useEffect, useRef } from 'react';
import { UserSession } from '../../lib/api';
import { ShipAsaanLogo } from '../brand/ShipAsaanLogo';
import {
  Boxes,
  Warehouse,
  ClipboardList,
  Users,
  Building,
  Wallet,
  Shield,
  Activity,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Layers,
  Package,
  Truck,
  HelpCircle,
  Bell
} from 'lucide-react';

interface AppLayoutProps {
  user: UserSession;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export function AppLayout({ user, currentTab, onSelectTab, onLogout, children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdmin = user.role_id === 'role_administrator';
  const isCustomer = user.account_type === 'customer';
  const hasCustPerm = isAdmin || user.permissions.includes('customers.view');
  const hasEmpPerm = isAdmin || user.permissions.includes('employees.view');
  const hasRolePerm = isAdmin || user.permissions.includes('roles.view');
  const hasWalletPerm = isCustomer || isAdmin || user.permissions.includes('wallet.view');
  const hasWarehousePerm = isAdmin || user.permissions.includes('warehouses.view');
  const hasInventoryPerm = isCustomer || isAdmin || user.permissions.includes('inventory.view');
  const hasOrderPerm = isCustomer || isAdmin || user.permissions.includes('orders.view');
  const hasDispatchPerm = isCustomer || isAdmin || user.permissions.includes('manifests.view') || user.permissions.includes('returns.view');

  const operationsItems = [
    hasOrderPerm && {
      id: 'orders',
      label: 'Fulfillment Orders',
      icon: ClipboardList,
      desc: 'Pick, pack & shipment wave'
    },
    hasDispatchPerm && {
      id: 'dispatch',
      label: 'Carrier Dispatch & Returns',
      icon: Truck,
      desc: 'Handover manifests & live reverse'
    },
    hasInventoryPerm && {
      id: 'inventory',
      label: 'Inventory & Stock Units',
      icon: Package,
      desc: 'Barcode intake, SKU catalog & bins'
    },
    hasWarehousePerm && {
      id: 'warehouses',
      label: 'Facilities & Locations',
      icon: Warehouse,
      desc: 'Aisle, rack, shelf & bin taxonomy'
    }
  ].filter(Boolean) as { id: string; label: string; icon: any; desc: string }[];

  const financialItems = [
    hasWalletPerm && {
      id: 'wallet',
      label: isCustomer ? 'Billing & Operational Wallet' : 'Customer Wallets & Ledger',
      icon: Wallet,
      desc: 'Automated escrow, COD & top-ups'
    }
  ].filter(Boolean) as { id: string; label: string; icon: any; desc: string }[];

  const adminItems = [
    hasCustPerm && { id: 'customers', label: 'Merchant Accounts', icon: Building, desc: 'KYC verified shippers' },
    hasEmpPerm && { id: 'employees', label: 'Staff Workforce', icon: Users, desc: 'Warehouse operators & admins' },
    hasRolePerm && { id: 'roles', label: 'Roles & Permissions', icon: Shield, desc: 'Granular RBAC privileges' }
  ].filter(Boolean) as { id: string; label: string; icon: any; desc: string }[];

  const systemItems = [
    { id: 'foundation', label: 'System Infrastructure', icon: Layers, desc: 'Cache, database & health' },
    { id: 'audit', label: 'Audit Trail', icon: Activity, desc: 'Authoritative transaction ledger' },
    { id: 'design-system', label: 'Design System & UI Kit', icon: Boxes, desc: 'Design standards' }
  ];

  const getBreadcrumbTitle = () => {
    switch (currentTab) {
      case 'orders':
        return 'Fulfillment Orders & Wave Picking';
      case 'dispatch':
        return 'Carrier Dispatch Run-Sheets & Manifests';
      case 'inventory':
        return 'Inventory Management & Barcode Labeling';
      case 'warehouses':
        return 'Warehouse Facilities & Location Trees';
      case 'wallet':
        return isCustomer ? 'Merchant Wallet & Billing' : 'Wallets & Financial Ledger';
      case 'customers':
        return 'Merchants & Client Profiles';
      case 'employees':
        return 'Workforce & Operational Staff';
      case 'roles':
        return 'RBAC Roles & Privileges';
      case 'foundation':
        return 'System Infrastructure & Storage Engine';
      case 'audit':
        return 'Immutable Audit Ledger';
      case 'design-system':
        return 'Visual Language & UI Tokens';
      default:
        return 'Operations Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      {/* Top Header Bar */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        {/* Left: Hamburger + Brand Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <a href="#" className="flex items-center gap-3">
            <ShipAsaanLogo variant="full" size="md" />
          </a>

          {/* Environment/Network Badge */}
          <div className="hidden xl:flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-medium text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Fulfillment Hub Online</span>
          </div>
        </div>

        {/* Center: Active Context Breadcrumb */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Portal</span>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <span className="font-bold text-slate-900 text-sm">
            {getBreadcrumbTitle()}
          </span>
        </div>

        {/* Right: User Profile & Actions */}
        <div className="flex items-center gap-3">
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 py-1 px-2.5 rounded-lg hover:bg-slate-100 transition-colors text-left border border-transparent hover:border-slate-200"
              aria-expanded={userMenuOpen}
            >
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1">
                  <span>{user.name}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>
                <div className="text-[11px] text-slate-500">{user.role_name}</div>
              </div>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in-0 zoom-in-95">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900">{user.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">{user.email}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] text-emerald-800 bg-emerald-100 font-semibold px-2 py-0.5 rounded">
                      {user.role_name}
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">
                      {user.account_type}
                    </span>
                  </div>
                </div>

                <div className="px-2 pt-2">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-semibold text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out of Portal</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex w-full">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Navigation Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200/90 flex flex-col transform transition-transform duration-200 ease-in-out md:static md:translate-x-0 md:h-[calc(100vh-4rem)] md:sticky md:top-16 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Mobile Sidebar Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between md:hidden">
            <ShipAsaanLogo variant="full" size="sm" />
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-6">
            {/* Fulfillment Operations */}
            {operationsItems.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 mb-1.5">
                  Fulfillment Operations
                </div>
                <nav className="space-y-0.5">
                  {operationsItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-900 font-bold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="leading-tight">{item.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* Financials & Wallets */}
            {financialItems.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 mb-1.5">
                  Financials & Billing
                </div>
                <nav className="space-y-0.5">
                  {financialItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-900 font-bold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="leading-tight">{item.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* Organization & Access */}
            {adminItems.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 mb-1.5">
                  Workforce & Governance
                </div>
                <nav className="space-y-0.5">
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-900 font-bold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="leading-tight">{item.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* Platform & Audit */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 mb-1.5">
                Platform & Standards
              </div>
              <nav className="space-y-0.5">
                {systemItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-900 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          isActive
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="leading-tight">{item.label}</div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-medium">Ship Asaan WMS</span>
              <span className="font-mono text-[10px] text-slate-400">v2.4.0</span>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
