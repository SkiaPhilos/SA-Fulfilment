import { useState, useEffect, useCallback } from 'react';
import { api, UserSession } from './lib/api';
import { AppLayout } from './components/layout/AppLayout';
import { AuthScreen } from './components/AuthScreen';
import { CustomerPendingView } from './components/customers/CustomerPendingView';
import { CustomerListView } from './components/customers/CustomerListView';
import { EmployeeListView } from './components/employees/EmployeeListView';
import { RoleManagementView } from './components/roles/RoleManagementView';
import { StaffWalletManagementView } from './components/wallet/StaffWalletManagementView';
import { CustomerWalletView } from './components/wallet/CustomerWalletView';
import { WarehouseListView } from './components/warehouses/WarehouseListView';
import { InventoryManagementView } from './components/inventory/InventoryManagementView';
import { FulfillmentOrderListView } from './components/orders/FulfillmentOrderListView';
import { DispatchDashboardView } from './components/dispatch/DispatchDashboardView';
import { SystemFoundationView } from './components/SystemFoundationView';

export default function App() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<string>('customers');

  const checkSession = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.getCurrentUser();
      setUser(res.user);
      if (res.user.account_type === 'customer') {
        setCurrentTab('wallet');
      } else if (res.user.role_id === 'role_administrator' || res.user.permissions.includes('customers.view')) {
        setCurrentTab('customers');
      } else {
        setCurrentTab('foundation');
      }
    } catch (err) {
      console.warn('Session verification failed:', err);
      api.setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-600 font-sans">
        <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin mb-3"></div>
        <div className="text-xs font-mono tracking-wider text-slate-500">Connecting to Ship Asaan Node...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onSuccess={(data) => {
          setUser(data.user);
          if (data.user.account_type === 'customer') {
            setCurrentTab('wallet');
          } else if (data.user.role_id === 'role_administrator' || data.user.permissions.includes('customers.view')) {
            setCurrentTab('customers');
          } else {
            setCurrentTab('foundation');
          }
        }}
      />
    );
  }

  // Pending Approval Customer Experience
  if (
    user.account_type === 'customer' &&
    (user.status === 'pending_approval' || user.customer_profile?.approval_status === 'pending')
  ) {
    return (
      <CustomerPendingView
        user={user}
        onLogout={handleLogout}
        onRefresh={checkSession}
      />
    );
  }

  return (
    <AppLayout
      user={user}
      currentTab={currentTab}
      onSelectTab={(tab) => setCurrentTab(tab)}
      onLogout={handleLogout}
    >
      {currentTab === 'wallet' && (
        user.account_type === 'customer'
          ? <CustomerWalletView user={user} />
          : <StaffWalletManagementView user={user} />
      )}
      {currentTab === 'orders' && <FulfillmentOrderListView user={user} />}
      {currentTab === 'dispatch' && <DispatchDashboardView user={user} />}
      {currentTab === 'inventory' && <InventoryManagementView user={user} />}
      {currentTab === 'warehouses' && <WarehouseListView />}
      {currentTab === 'customers' && <CustomerListView user={user} />}
      {currentTab === 'employees' && <EmployeeListView user={user} />}
      {currentTab === 'roles' && <RoleManagementView user={user} />}
      {currentTab === 'foundation' && <SystemFoundationView user={user} />}
      {currentTab === 'audit' && <SystemFoundationView user={user} />}
    </AppLayout>
  );
}
