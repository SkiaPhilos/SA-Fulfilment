import React, { useState, useEffect, useRef } from 'react';
import { UserSession } from '../../lib/api';
import { formatRoleName } from '../../lib/displayFormatters';
import { ShipAsaanLogo } from '../brand/ShipAsaanLogo';
import {
  Warehouse,
  ClipboardList,
  Users,
  Building,
  Wallet,
  Shield,
  Activity,
  LogOut,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Layers,
  Package,
  Truck,
  Pin,
  PinOff
} from 'lucide-react';

interface AppLayoutProps {
  user: UserSession;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
}

interface NavGroup {
  id: string;
  label: string;
  icon: any;
  items: NavItem[];
}

export function AppLayout({ user, currentTab, onSelectTab, onLogout, children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userMenuHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Pinned vs Unpinned navigation state (persisted in localStorage)
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('ship_asaan_nav_pinned');
      return stored !== 'false';
    } catch {
      return true;
    }
  });

  const togglePinned = () => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ship_asaan_nav_pinned', String(next));
      } catch {
        // Ignore local storage error
      }
      return next;
    });
  };

  // Close menus on outside click and Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        setMobileMenuOpen(false);
        if (!isPinned) {
          setIsSidebarHovered(false);
          setHoveredGroup(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPinned]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (sidebarHoverTimeoutRef.current) clearTimeout(sidebarHoverTimeoutRef.current);
      if (userMenuHoverTimeoutRef.current) clearTimeout(userMenuHoverTimeoutRef.current);
    };
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

  // Navigation Groups Definition
  const operationsItems: NavItem[] = [
    hasOrderPerm && { id: 'orders', label: 'Fulfillment Orders', icon: ClipboardList },
    hasDispatchPerm && { id: 'dispatch', label: 'Carrier Dispatch & Returns', icon: Truck },
    hasInventoryPerm && { id: 'inventory', label: 'Inventory & Stock Units', icon: Package },
    hasWarehousePerm && { id: 'warehouses', label: 'Facilities & Locations', icon: Warehouse }
  ].filter(Boolean) as NavItem[];

  const financialItems: NavItem[] = [
    hasWalletPerm && {
      id: 'wallet',
      label: isCustomer ? 'Billing & Operational Wallet' : 'Customer Wallets & Ledger',
      icon: Wallet
    }
  ].filter(Boolean) as NavItem[];

  const governanceItems: NavItem[] = [
    hasCustPerm && { id: 'customers', label: 'Merchant Accounts', icon: Building },
    hasEmpPerm && { id: 'employees', label: 'Staff Workforce', icon: Users },
    hasRolePerm && { id: 'roles', label: 'Roles & Permissions', icon: Shield }
  ].filter(Boolean) as NavItem[];

  const systemItems: NavItem[] = [
    { id: 'foundation', label: 'System Infrastructure', icon: Layers },
    { id: 'audit', label: 'Audit Trail', icon: Activity }
  ];

  const navGroups: NavGroup[] = [
    operationsItems.length > 0 && {
      id: 'operations',
      label: 'Fulfillment Operations',
      icon: Package,
      items: operationsItems
    },
    financialItems.length > 0 && {
      id: 'financials',
      label: 'Financials & Billing',
      icon: Wallet,
      items: financialItems
    },
    governanceItems.length > 0 && {
      id: 'governance',
      label: 'Workforce & Governance',
      icon: Users,
      items: governanceItems
    },
    // Strictly omit "Platform & Standards" for customer accounts
    !isCustomer && systemItems.length > 0 && {
      id: 'system',
      label: 'Platform & Standards',
      icon: Layers,
      items: systemItems
    }
  ].filter(Boolean) as NavGroup[];

  // Group expansion state (persisted toggle state; opens by default for active tab)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    return {
      operations: true,
      financials: true,
      governance: true,
      system: true
    };
  });

  // Keep group containing current active tab open
  useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some(i => i.id === currentTab)) {
        setExpandedGroups(prev => ({
          ...prev,
          [group.id]: true
        }));
        break;
      }
    }
  }, [currentTab]);

  const toggleGroup = (groupId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Dropdown hover handlers (open on hover regardless of pinning)
  const handleGroupMouseEnter = (groupId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredGroup(groupId);
  };

  const handleGroupMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredGroup(null);
    }, 180);
  };

  // Main sidebar hover handlers (for auto-expansion when unpinned)
  const handleSidebarMouseEnter = () => {
    if (sidebarHoverTimeoutRef.current) {
      clearTimeout(sidebarHoverTimeoutRef.current);
      sidebarHoverTimeoutRef.current = null;
    }
    setIsSidebarHovered(true);
  };

  const handleSidebarMouseLeave = () => {
    if (sidebarHoverTimeoutRef.current) {
      clearTimeout(sidebarHoverTimeoutRef.current);
    }
    sidebarHoverTimeoutRef.current = setTimeout(() => {
      setIsSidebarHovered(false);
      setHoveredGroup(null);
    }, 220);
  };

  // User menu hover handlers
  const handleUserMenuEnter = () => {
    if (userMenuHoverTimeoutRef.current) {
      clearTimeout(userMenuHoverTimeoutRef.current);
      userMenuHoverTimeoutRef.current = null;
    }
    setUserMenuOpen(true);
  };

  const handleUserMenuLeave = () => {
    if (userMenuHoverTimeoutRef.current) {
      clearTimeout(userMenuHoverTimeoutRef.current);
    }
    userMenuHoverTimeoutRef.current = setTimeout(() => {
      setUserMenuOpen(false);
    }, 180);
  };

  // Effective sidebar open state (pinned or hovered)
  const isSidebarOpen = isPinned || isSidebarHovered;

  const getBreadcrumbTitle = () => {
    switch (currentTab) {
      case 'orders':
        return 'Fulfillment Orders';
      case 'dispatch':
        return 'Carrier Dispatch & Returns';
      case 'inventory':
        return 'Inventory & Stock Units';
      case 'warehouses':
        return 'Facilities & Locations';
      case 'wallet':
        return isCustomer ? 'Billing & Operational Wallet' : 'Customer Wallets & Ledger';
      case 'customers':
        return 'Merchant Accounts';
      case 'employees':
        return 'Staff Workforce';
      case 'roles':
        return 'Roles & Permissions';
      case 'foundation':
        return 'System Infrastructure';
      case 'audit':
        return 'Audit Trail';
      default:
        return 'Operations Portal';
    }
  };

  // Reusable Nav Content renderer for both desktop and mobile
  const renderNavList = (isCompact: boolean) => {
    return (
      <div className="space-y-3">
        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const hasActiveChild = group.items.some(i => i.id === currentTab);
          const isGroupHovered = hoveredGroup === group.id;
          // Open if pinned open in state OR hovered (regardless of pinning)
          const isGroupExpanded = (expandedGroups[group.id] ?? false) || isGroupHovered;

          // If in compact rail mode (unpinned & not hovered)
          if (isCompact) {
            return (
              <div
                key={group.id}
                className="relative flex flex-col items-center"
                onMouseEnter={() => {
                  handleSidebarMouseEnter();
                  handleGroupMouseEnter(group.id);
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    handleSidebarMouseEnter();
                    handleGroupMouseEnter(group.id);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${
                    hasActiveChild
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs font-bold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title={group.label}
                  aria-label={group.label}
                >
                  <GroupIcon className="w-4 h-4" />
                  {hasActiveChild && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-white" />
                  )}
                </button>
              </div>
            );
          }

          // Full Expanded Mode (Mobile, Pinned desktop, or Desktop hover-expanded)
          return (
            <div
              key={group.id}
              className={`rounded-xl transition-colors duration-150 p-1 ${
                isGroupHovered ? 'bg-slate-100/60 ring-1 ring-slate-200/80' : 'hover:bg-slate-50/70'
              }`}
              onMouseEnter={() => handleGroupMouseEnter(group.id)}
              onMouseLeave={handleGroupMouseLeave}
            >
              {/* Group Header: Click toggles pin/lock, hover opens dropdown */}
              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 hover:bg-white/80 transition-colors group">
                <button
                  type="button"
                  onClick={(e) => toggleGroup(group.id, e)}
                  className="flex-1 flex items-center gap-2.5 truncate text-left focus:outline-none"
                  aria-expanded={isGroupExpanded}
                  title={group.label}
                >
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                      hasActiveChild
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                    }`}
                  >
                    <GroupIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">{group.label}</span>
                </button>

                <div className="flex items-center gap-0.5 shrink-0 ml-1">
                  {/* Pin / Unpin Icon Only for Dropdown Group */}
                  <button
                    type="button"
                    onClick={(e) => toggleGroup(group.id, e)}
                    aria-label={expandedGroups[group.id] ? 'Unpin' : 'Pin'}
                    title={expandedGroups[group.id] ? 'Unpin' : 'Pin'}
                    className={`p-1 rounded-md transition-colors ${
                      expandedGroups[group.id]
                        ? 'text-emerald-700 hover:bg-emerald-100'
                        : 'text-slate-300 hover:text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    {expandedGroups[group.id] ? (
                      <Pin className="w-3.5 h-3.5 fill-emerald-600 text-emerald-700" />
                    ) : (
                      <PinOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => toggleGroup(group.id, e)}
                    aria-label="Toggle group"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isGroupExpanded ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Submenu Dropdown Items */}
              {isGroupExpanded && (
                <div className="mt-1 space-y-0.5 pl-1.5 animate-in fade-in-0 duration-150">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(item.id);
                          setMobileMenuOpen(false);
                          if (!isPinned) {
                            setIsSidebarHovered(false);
                            setHoveredGroup(null);
                          }
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left group ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200/70 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                          }`}
                        >
                          <ItemIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      {/* Top Header Bar */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        {/* Left: Mobile Toggle + Brand Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-3">
            <ShipAsaanLogo variant="full" size="md" />
          </div>

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

        {/* Right: User Profile & Actions with Hover Dropdown */}
        <div className="flex items-center gap-3">
          <div
            className="relative"
            ref={userMenuRef}
            onMouseEnter={handleUserMenuEnter}
            onMouseLeave={handleUserMenuLeave}
          >
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 py-1 px-2.5 rounded-lg hover:bg-slate-100 transition-colors text-left border border-transparent hover:border-slate-200"
              aria-expanded={userMenuOpen}
              aria-label="User profile menu"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1">
                  <span>{user.name}</span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : 'rotate-0'}`} />
                </div>
                <div className="text-[11px] text-slate-500">{formatRoleName(user.role_id, user.role_name)}</div>
              </div>
            </button>

            {userMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in-0 zoom-in-95"
                onMouseEnter={handleUserMenuEnter}
                onMouseLeave={handleUserMenuLeave}
              >
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900">{user.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">{user.email}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] text-emerald-800 bg-emerald-100 font-semibold px-2 py-0.5 rounded">
                      {formatRoleName(user.role_id, user.role_name)}
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

        {/* Mobile Navigation Drawer */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200/90 flex flex-col w-64 transform transition-transform duration-200 ease-in-out md:hidden ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Navigation
            </span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {renderNavList(false)}
          </div>
          <div className="p-3 border-t border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-medium">Ship Asaan WMS</span>
              <span className="font-mono text-[10px] text-slate-400">v2.4.0</span>
            </div>
          </div>
        </aside>

        {/* Desktop Sidebar Layout Container:
            Maintains the layout space (w-64 when pinned, w-16 when unpinned) so main content never janks on hover expansion */}
        <div
          className={`relative shrink-0 hidden md:block transition-all duration-200 ease-in-out ${
            isPinned ? 'w-64' : 'w-16'
          }`}
        >
          {/* Desktop Navigation Sidebar (expands on hover when unpinned as an elevated overlay, or stays docked when pinned) */}
          <aside
            onMouseEnter={handleSidebarMouseEnter}
            onMouseLeave={handleSidebarMouseLeave}
            className={`sticky top-16 h-[calc(100vh-4rem)] bg-white border-r border-slate-200/90 flex flex-col transition-all duration-200 ease-in-out z-40 ${
              isPinned
                ? 'w-64 shadow-none'
                : isSidebarOpen
                ? 'w-64 shadow-2xl ring-1 ring-slate-900/10'
                : 'w-16 shadow-none'
            }`}
          >
            {/* Desktop Sidebar Header */}
            <div className={`p-3 border-b border-slate-100 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
              {isSidebarOpen ? (
                <>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Navigation
                  </span>
                  {/* Pin / Unpin Button - Icon Only */}
                  <button
                    type="button"
                    onClick={togglePinned}
                    aria-label={isPinned ? 'Unpin' : 'Pin'}
                    title={isPinned ? 'Unpin' : 'Pin'}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isPinned
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100'
                        : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {isPinned ? (
                      <Pin className="w-4 h-4 fill-emerald-600 text-emerald-700" />
                    ) : (
                      <PinOff className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </>
              ) : (
                /* Compact Rail Header: Quick Pin button - Icon Only */
                <button
                  type="button"
                  onClick={togglePinned}
                  aria-label="Pin"
                  title="Pin"
                  className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <PinOff className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Navigation Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5">
              {renderNavList(!isSidebarOpen)}
            </div>

            {/* Desktop Sidebar Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50/50">
              {isSidebarOpen ? (
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">Ship Asaan WMS</span>
                  <span className="font-mono text-[10px] text-slate-400">v2.4.0</span>
                </div>
              ) : (
                <div className="flex justify-center" aria-label="Ship Asaan WMS v2.4.0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Main Content Viewport: Reclaimed space applied */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-6 xl:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
