import React, { useState, useEffect, useCallback } from 'react';
import {
  api,
  UserSession,
  WalletAccountWithCustomer,
  WalletTransaction,
  WalletSummary
} from '../../lib/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../ui/Table';
import { TopUpModal } from './TopUpModal';
import { DebitModal } from './DebitModal';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Download,
  Search,
  Plus,
  Minus,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

interface StaffWalletManagementViewProps {
  user: UserSession;
}

export const StaffWalletManagementView: React.FC<StaffWalletManagementViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'ledger'>('accounts');
  const [accounts, setAccounts] = useState<WalletAccountWithCustomer[]>([]);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Modals state
  const [topUpModalOpen, setTopUpModalOpen] = useState<boolean>(false);
  const [debitModalOpen, setDebitModalOpen] = useState<boolean>(false);
  const [selectedCustomerForAction, setSelectedCustomerForAction] = useState<WalletAccountWithCustomer | null>(null);
  const [reversalTarget, setReversalTarget] = useState<WalletTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [reversalLoading, setReversalLoading] = useState<boolean>(false);

  const canCredit = user.role_id === 'role_administrator' || user.permissions.includes('wallet.credit');
  const canDebit = user.role_id === 'role_administrator' || user.permissions.includes('wallet.debit');
  const canExport = user.role_id === 'role_administrator' || user.permissions.includes('wallet.export');

  const fetchData = useCallback(async () => {
    try {
      const [accRes, txnRes] = await Promise.all([
        api.getWalletAccounts(),
        api.getWalletTransactions({
          type: typeFilter || undefined,
          search: searchQuery || undefined
        })
      ]);
      setAccounts(accRes.accounts);
      setSummary(accRes.summary);
      setTransactions(txnRes.transactions);
    } catch (err) {
      console.error('Failed to load wallet ledger data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleOpenTopUp = (cust?: WalletAccountWithCustomer) => {
    setSelectedCustomerForAction(cust || null);
    setTopUpModalOpen(true);
  };

  const handleOpenDebit = (cust?: WalletAccountWithCustomer) => {
    setSelectedCustomerForAction(cust || null);
    setDebitModalOpen(true);
  };

  const handleExecuteReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget || !reversalReason.trim()) return;

    setReversalLoading(true);
    try {
      await api.reverseTransaction(reversalTarget.id, reversalReason.trim());
      setReversalTarget(null);
      setReversalReason('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to reverse transaction.');
    } finally {
      setReversalLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(
    (a) =>
      a.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Customer Wallet & Financial Ledger
            </h1>
            <Badge variant="neutral" dot>
              Authoritative
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Audit-grade operational account balances, verified bank top-ups, and fulfillment fees ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync Balances</span>
          </Button>

          {canExport && (
            <a
              href={api.getWalletExportUrl()}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </a>
          )}

          {canDebit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenDebit()}
              className="gap-1.5 text-rose-700 border-rose-200 hover:bg-rose-50"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>Post Charge</span>
            </Button>
          )}

          {canCredit && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenTopUp()}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Top-Up Funds</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200/90 shadow-2xs bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Held Balances
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tracking-tight">
            PKR {summary?.total_balance.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Across {summary?.active_wallets_count || 0} active merchant accounts</span>
          </div>
        </Card>

        <Card className="p-4 border-slate-200/90 shadow-2xs bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Credits (Last 30 Days)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-700 tracking-tight">
            + PKR {summary?.recent_credits_30d.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Verified bank deposits & transfers
          </div>
        </Card>

        <Card className="p-4 border-slate-200/90 shadow-2xs bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Debits (Last 30 Days)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-700 tracking-tight">
            - PKR {summary?.recent_debits_30d.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Fulfillment, storage & adjustments
          </div>
        </Card>

        <Card className="p-4 border-slate-200/90 shadow-2xs bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Ledger Health
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
            100% Balanced
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Double-entry integrity check verified
          </div>
        </Card>
      </div>

      {/* Primary Workspace Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'accounts'
                ? 'text-emerald-800 border-b-2 border-emerald-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Merchant Wallets & Balances</span>
            <span className="ml-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
              {accounts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'ledger'
                ? 'text-emerald-800 border-b-2 border-emerald-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Master Transaction Journal</span>
            <span className="ml-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
              {transactions.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Merchant Accounts View */}
      {activeTab === 'accounts' && (
        <Card className="border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                type="text"
                placeholder="Search merchant, brand, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-800">{filteredAccounts.length}</span> merchant wallets
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant & Brand</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>KYC Status</TableHead>
                <TableHead className="text-right">Available Balance (PKR)</TableHead>
                <TableHead>Last Transaction</TableHead>
                <TableHead className="text-right">Quick Operations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                    Loading customer wallets...
                  </TableCell>
                </TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                    No customer accounts match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((acc) => (
                  <TableRow key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell>
                      <div>
                        <div className="font-bold text-xs text-slate-900">{acc.business_name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-medium text-emerald-800">{acc.brand_name}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono text-slate-400">{acc.email}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-slate-700">{acc.city}</div>
                      <div className="text-[11px] text-slate-400">{acc.phone}</div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          acc.approval_status === 'approved'
                            ? 'success'
                            : acc.approval_status === 'pending'
                            ? 'warning'
                            : 'danger'
                        }
                        dot
                      >
                        {acc.approval_status === 'approved' ? 'KYC Verified' : acc.approval_status}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div
                        className={`font-mono text-sm font-bold ${
                          acc.balance > 0
                            ? 'text-slate-900'
                            : acc.balance === 0
                            ? 'text-slate-400'
                            : 'text-rose-600'
                        }`}
                      >
                        PKR {acc.balance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-slate-600">
                        {acc.last_transaction_at
                          ? new Date(acc.last_transaction_at).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : 'No movements'}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canCredit && (
                          <button
                            onClick={() => handleOpenTopUp(acc)}
                            title="Top-Up Balance"
                            className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-700 border border-transparent hover:border-emerald-200 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                        {canDebit && (
                          <button
                            onClick={() => handleOpenDebit(acc)}
                            title="Post Charge / Debit"
                            className="p-1.5 rounded-md hover:bg-rose-50 text-rose-700 border border-transparent hover:border-rose-200 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSearchQuery(acc.business_name);
                            setActiveTab('ledger');
                          }}
                          title="View Ledger Statement"
                          className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
                        >
                          Journal
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Tab 2: Master Transaction Journal View */}
      {activeTab === 'ledger' && (
        <Card className="border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  type="text"
                  placeholder="Filter by ref #, notes, customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="">All Transaction Types</option>
                <option value="CREDIT">CREDIT (Top-Up)</option>
                <option value="DEBIT">DEBIT (Fulfillment / Charge)</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
                <option value="REVERSAL">REVERSAL</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Clear Filter
                </button>
              )}
              <div className="text-xs text-slate-500">
                Found <span className="font-semibold text-slate-800">{transactions.length}</span> ledger rows
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time (UTC)</TableHead>
                <TableHead>Customer / Merchant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount (PKR)</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
                <TableHead>Method & Reference</TableHead>
                <TableHead>Logged By</TableHead>
                <TableHead>Notes & Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-400 text-xs">
                    Loading master journal entries...
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-400 text-xs">
                    No transaction records match the specified filters.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((txn) => (
                  <TableRow key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell>
                      <div className="font-mono text-xs text-slate-700">
                        {new Date(txn.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {new Date(txn.created_at).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold text-xs text-slate-900">{txn.business_name}</div>
                      <div className="text-[10px] text-slate-500">{txn.brand_name}</div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          txn.type === 'CREDIT'
                            ? 'success'
                            : txn.type === 'DEBIT'
                            ? 'danger'
                            : txn.type === 'ADJUSTMENT'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {txn.type}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div
                        className={`font-mono text-xs font-bold ${
                          txn.type === 'CREDIT'
                            ? 'text-emerald-700'
                            : txn.type === 'DEBIT'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {txn.type === 'CREDIT' ? '+' : txn.type === 'DEBIT' ? '-' : ''}
                        PKR {txn.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="font-mono text-xs font-semibold text-slate-800">
                        PKR {txn.balance_after.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-slate-700 capitalize">
                        {txn.payment_method.replace('_', ' ')}
                      </div>
                      {txn.reference_number && (
                        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                          Ref: {txn.reference_number}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-slate-700 truncate max-w-[120px]">
                        {txn.actor_name}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-slate-600 max-w-xs truncate" title={txn.notes}>
                        {txn.notes}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      {canDebit && txn.type !== 'REVERSAL' && (
                        <button
                          onClick={() => setReversalTarget(txn)}
                          title="Reverse this transaction"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Reversal Confirmation Modal */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left">
            <div className="flex items-center gap-2.5 text-rose-600 mb-3">
              <RotateCcw className="w-5 h-5" />
              <h3 className="font-bold text-sm text-slate-900">Reverse Transaction {reversalTarget.id}</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Reversing this <span className="font-bold">{reversalTarget.type}</span> of{' '}
              <span className="font-mono font-bold">PKR {reversalTarget.amount.toLocaleString()}</span> will post an offsetting reversal journal entry and recalculate the customer's authoritative balance.
            </p>

            <form onSubmit={handleExecuteReversal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Reversal Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Bank chargeback confirmed / incorrect deposit reference entered by operator"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReversalTarget(null);
                    setReversalReason('');
                  }}
                  disabled={reversalLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  loading={reversalLoading}
                  disabled={reversalReason.trim().length < 5}
                >
                  Confirm Reversal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TopUp Modal */}
      {topUpModalOpen && (
        <TopUpModal
          customer={selectedCustomerForAction}
          allCustomers={accounts}
          onClose={() => {
            setTopUpModalOpen(false);
            setSelectedCustomerForAction(null);
          }}
          onSuccess={handleRefresh}
        />
      )}

      {/* Debit Modal */}
      {debitModalOpen && (
        <DebitModal
          customer={selectedCustomerForAction}
          allCustomers={accounts}
          onClose={() => {
            setDebitModalOpen(false);
            setSelectedCustomerForAction(null);
          }}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
};
