import React, { useState } from 'react';
import { UserSession } from '../../lib/api';
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
  ArrowUpRight
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

  const isAdmin = user.role_id === 'role_administrator';
  const isCustomer = user.account_type === 'customer';
  const hasCustPerm = isAdmin || user.permissions.includes('customers.view');
  const hasEmpPerm = isAdmin || user.permissions.includes('employees.view');
  const hasRolePerm = isAdmin || user.permissions.includes('roles.view');
  const hasWalletPerm = isCustomer || isAdmin || user.permissions.includes('wallet.view');
  const hasWarehousePerm = isAdmin || user.permissions.includes('warehouses.view');

  const financialItems = [
    hasWalletPerm && {
      id: 'wallet',
      label: isCustomer ? 'Billing & Operational Wallet' : 'Customer Wallets & Ledger',
      icon: Wallet
    }
  ].filter(Boolean) as { id: string; label: string; icon: any }[];

  const warehouseItems = [
    hasWarehousePerm && {
      id: 'warehouses',
      label: 'Warehouses & Locations',
      icon: Warehouse
    }
  ].filter(Boolean) as { id: string; label: string; icon: any }[];

  const orgItems = [
    hasCustPerm && { id: 'customers', label: 'Merchants & Customers', icon: Building },
    hasEmpPerm && { id: 'employees', label: 'Staff Personnel', icon: Users },
    hasRolePerm && { id: 'roles', label: 'Roles & Permissions', icon: Shield }
  ].filter(Boolean) as { id: string; label: string; icon: any }[];

  const systemItems = [
    { id: 'foundation', label: 'System Infrastructure', icon: Layers },
    { id: 'audit', label: 'Audit Trail', icon: Activity },
    { id: 'design-system', label: 'Design System & UI Kit', icon: Boxes }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      {/* 3-Zone Top Navigation Contract */}
      <header className="h-14 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        {/* Zone 1: Single text element Brand Wordmark */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <a href="#" className="flex items-center gap-2.5 text-slate-900 group">
            <div className="w-7 h-7 rounded bg-emerald-700 text-white font-bold text-xs flex items-center justify-center tracking-wider shadow-2xs">
              SA
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Ship Asaan
            </span>
          </a>
        </div>

        {/* Zone 2: Clean breadcrumb / status pathway */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
          <span className="text-slate-400">Operations</span>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <span className="font-medium text-slate-800 capitalize">
            {currentTab === 'warehouses' && 'Warehouse Facilities & Location Trees'}
            {currentTab === 'wallet' && (isCustomer ? 'Billing & Operational Wallet' : 'Customer Wallets & Financial Ledger')}
            {currentTab === 'customers' && 'Merchants & Client KYC Verification'}
            {currentTab === 'employees' && 'Workforce & Operational Staff Roster'}
            {currentTab === 'roles' && 'Granular RBAC & Privilege Containment'}
            {currentTab === 'foundation' && 'Infrastructure & Nodes'}
            {currentTab === 'audit' && 'Authoritative Audit Ledger'}
            {currentTab === 'design-system' && 'Visual Language & Component Standards'}
          </span>
        </div>

        {/* Zone 3: Primary user action & account menu */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 py-1 px-2 rounded-md hover:bg-slate-100 transition-colors text-left"
              aria-expanded={userMenuOpen}
            >
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center border border-slate-300">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-800 leading-tight flex items-center gap-1">
                  <span>{user.name}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>
                <div className="text-[11px] text-slate-500 capitalize">{user.role_name}</div>
              </div>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 z-40 animate-in fade-in-0 zoom-in-95">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <div className="text-xs font-semibold text-slate-900">{user.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">{user.email}</div>
                  <div className="mt-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block font-medium">
                    {user.role_name}
                  </div>
                </div>

                <div className="px-1 pt-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-md transition-colors font-medium text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out of Portal</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Navigation Sidebar */}
        <aside
          className={`fixed inset-y-14 left-0 z-20 w-64 bg-white border-r border-slate-200/90 p-4 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:inset-auto md:z-auto ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="space-y-6">
            {/* Financials & Wallets Section */}
            {financialItems.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
                  Financials & Ledger
                </div>
                <nav className="space-y-1">
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
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                          isActive
                            ? 'bg-emerald-50/80 text-emerald-800 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* Warehouse & Fulfillment Infrastructure */}
            {warehouseItems.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
                  Fulfillment Infrastructure
                </div>
                <nav className="space-y-1">
                  {warehouseItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                          isActive
                            ? 'bg-emerald-50/80 text-emerald-800 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* Identity & Access Section */}
            {orgItems.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
                  Identity & Workforce
                </div>
                <nav className="space-y-1">
                  {orgItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                          isActive
                            ? 'bg-emerald-50/80 text-emerald-800 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* Core Infrastructure Section */}
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
                Operational Foundation
              </div>
              <nav className="space-y-1">
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
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                        isActive
                          ? 'bg-emerald-50/80 text-emerald-800 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        {/* Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
