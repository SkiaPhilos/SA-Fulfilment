import React, { useState, useEffect, useCallback } from 'react';
import {
  api,
  UserSession,
  WalletAccount,
  WalletTransaction,
  DepositInstructions
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
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Copy,
  Check,
  Building2,
  HelpCircle,
  RefreshCw,
  Search,
  Receipt
} from 'lucide-react';

interface CustomerWalletViewProps {
  user: UserSession;
}

export const CustomerWalletView: React.FC<CustomerWalletViewProps> = ({ user }) => {
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [instructions, setInstructions] = useState<DepositInstructions | null>(null);
  const [stats, setStats] = useState<{ total_credited: number; total_debited: number; transaction_count: number } | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await api.getMyWallet();
      setWallet(res.wallet);
      setInstructions(res.deposit_instructions);
      setStats(res.statistics);
      setTransactions(res.transactions);
    } catch (err) {
      console.error('Failed to load merchant wallet:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWallet();
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredTransactions = transactions.filter((t) => {
    if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (t.reference_number && t.reference_number.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        t.payment_method.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Billing & Operational Wallet
            </h1>
            <Badge variant="success" dot>
              Active
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pre-funded operational account for fulfillment services, inventory warehousing, and packaging
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
            <span>Sync Balance</span>
          </Button>

          <a
            href={api.getWalletExportUrl()}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download Statement (CSV)</span>
          </a>
        </div>
      </div>

      {/* Primary Financial Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Balance Highlight Card */}
        <div className="lg:col-span-2 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 shadow-md border border-slate-700/80 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
                  Current Operational Balance
                </span>
              </div>
              <span className="text-xs font-mono bg-slate-800 text-emerald-400 px-2.5 py-1 rounded-full border border-slate-700">
                PKR · Sovereign Fiat
              </span>
            </div>

            <div className="mt-4">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
                PKR {wallet?.balance.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Authoritative funds available immediately for pick, pack, and courier dispatch operations
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700/60 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Total Deposits</span>
              <span className="font-mono font-bold text-emerald-400 mt-0.5 block">
                + PKR {stats?.total_credited.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Fulfillment Charges</span>
              <span className="font-mono font-bold text-rose-400 mt-0.5 block">
                - PKR {stats?.total_debited.toLocaleString('en-PK', { minimumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Account ID</span>
              <span className="font-mono text-slate-300 text-[11px] truncate block mt-0.5">
                {wallet?.id || 'wal_loading'}
              </span>
            </div>
          </div>
        </div>

        {/* Deposit Quick-Reference Card */}
        <Card className="p-5 border-slate-200/90 shadow-2xs bg-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-3">
              <Building2 className="w-4 h-4 text-emerald-700" />
              <span>Official Deposit Bank Info</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[11px] text-slate-500">Bank & Title</div>
                <div className="font-semibold text-slate-800">{instructions?.bank_name}</div>
                <div className="text-slate-600 text-[11px]">{instructions?.account_title}</div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">IBAN Number</div>
                <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded border border-slate-200 mt-0.5">
                  <span className="font-mono font-semibold text-slate-900 text-[11px] truncate mr-1">
                    {instructions?.iban}
                  </span>
                  <button
                    onClick={() => instructions?.iban && handleCopy(instructions.iban, 'iban')}
                    className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60 transition-colors"
                    title="Copy IBAN"
                  >
                    {copiedKey === 'iban' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">Raast Instant ID</div>
                <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded border border-slate-200 mt-0.5">
                  <span className="font-mono font-semibold text-slate-900 text-[11px]">
                    {instructions?.raast_id}
                  </span>
                  <button
                    onClick={() => instructions?.raast_id && handleCopy(instructions.raast_id, 'raast')}
                    className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-slate-200/60 transition-colors"
                    title="Copy Raast ID"
                  >
                    {copiedKey === 'raast' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-1.5 text-[11px] text-slate-500">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>After transferring funds, email reference ID to <strong className="text-slate-700">billing@shipasaan.com</strong> to verify credit.</span>
          </div>
        </Card>
      </div>

      {/* Transaction Statement / Ledger Section */}
      <Card className="border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                type="text"
                placeholder="Search reference # or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                onClick={() => setTypeFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setTypeFilter('CREDIT')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  typeFilter === 'CREDIT' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Deposits
              </button>
              <button
                onClick={() => setTypeFilter('DEBIT')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  typeFilter === 'DEBIT' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Charges
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-800">{filteredTransactions.length}</span> movements
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount (PKR)</TableHead>
              <TableHead className="text-right">Balance After</TableHead>
              <TableHead>Method & Reference</TableHead>
              <TableHead>Description / Audit Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                  Loading statement records...
                </TableCell>
              </TableRow>
            ) : filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                  No transaction records found.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((txn) => (
                <TableRow key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell>
                    <div className="font-mono text-xs text-slate-800">
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
                    <Badge
                      variant={
                        txn.type === 'CREDIT'
                          ? 'success'
                          : txn.type === 'DEBIT'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {txn.type === 'CREDIT' ? 'Top-Up' : txn.type === 'DEBIT' ? 'Service Fee' : txn.type}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <div
                      className={`font-mono text-xs font-bold ${
                        txn.type === 'CREDIT' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {txn.type === 'CREDIT' ? '+' : '-'} PKR{' '}
                      {txn.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="font-mono text-xs font-semibold text-slate-800">
                      PKR {txn.balance_after.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs text-slate-800 capitalize">
                      {txn.payment_method.replace('_', ' ')}
                    </div>
                    {txn.reference_number && (
                      <div className="font-mono text-[10px] text-slate-400 truncate max-w-[160px]">
                        Ref: {txn.reference_number}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="text-xs text-slate-600 max-w-sm truncate" title={txn.notes}>
                      {txn.notes}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
