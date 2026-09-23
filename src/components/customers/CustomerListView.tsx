import { useState, useEffect } from 'react';
import { CustomerItem, UserSession, api } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { CustomerDetailModal } from './CustomerDetailModal';
import {
  Users,
  Search,
  RefreshCw,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';

interface CustomerListViewProps {
  user: UserSession;
}

export function CustomerListView({ user }: CustomerListViewProps) {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'suspended'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);

  const canApprove = user.role_id === 'role_administrator' || user.permissions.includes('customers.approve');
  const canEdit = user.role_id === 'role_administrator' || user.permissions.includes('customers.edit');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.getCustomers();
      setCustomers(res.customers);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter((c) => {
    if (statusFilter !== 'all' && c.profile.approval_status !== statusFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matches =
        c.profile.business_name.toLowerCase().includes(q) ||
        c.profile.brand_name.toLowerCase().includes(q) ||
        c.profile.city.toLowerCase().includes(q) ||
        c.profile.cnic_or_ntn.toLowerCase().includes(q) ||
        c.user.name.toLowerCase().includes(q) ||
        c.user.email.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  const pendingCount = customers.filter(c => c.profile.approval_status === 'pending').length;
  const approvedCount = customers.filter(c => c.profile.approval_status === 'approved').length;
  const suspendedCount = customers.filter(c => c.profile.approval_status === 'suspended' || c.profile.approval_status === 'rejected').length;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success" dot>Approved</Badge>;
      case 'pending':
        return <Badge variant="warning" dot>Pending Review</Badge>;
      case 'rejected':
      case 'suspended':
        return <Badge variant="danger" dot>Suspended</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Customer Accounts & Merchant KYC
            </h1>
            <Badge variant="neutral">{customers.length} Registered</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative merchant directory, compliance onboarding queues, and profile completeness audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCustomers}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync Directory
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-lg text-xs font-medium text-slate-600">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            All Merchants ({customers.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              statusFilter === 'pending'
                ? 'bg-white text-amber-900 shadow-2xs font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pending Review ({pendingCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              statusFilter === 'approved'
                ? 'bg-white text-emerald-900 shadow-2xs font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Approved ({approvedCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('suspended')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              statusFilter === 'suspended'
                ? 'bg-white text-rose-900 shadow-2xs font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Suspended ({suspendedCount})
          </button>
        </div>

        {/* Live Search */}
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by business, email, city..."
            prefixIcon={<Search className="w-4 h-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table */}
      <Card>
        {loading && customers.length === 0 ? (
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            title="No Customers Found"
            description={
              search
                ? `No merchant accounts matched search query "${search}".`
                : statusFilter !== 'all'
                ? `No merchants currently in '${statusFilter}' status.`
                : 'No customer accounts registered in the database yet.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="border-0 shadow-none">
              <TableHeader>
                <TableRow>
                  <TableHead>Legal Entity & Brand</TableHead>
                  <TableHead>Primary Contact</TableHead>
                  <TableHead>Operating Hub</TableHead>
                  <TableHead>Tax / CNIC</TableHead>
                  <TableHead>Completeness</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((cust) => (
                  <TableRow key={cust.profile.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{cust.profile.business_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Brand: {cust.profile.brand_name}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-slate-800 font-medium">{cust.user.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{cust.user.email}</div>
                    </TableCell>

                    <TableCell>
                      <span className="text-slate-700">{cust.profile.city}</span>
                      <span className="block text-[11px] text-slate-400 font-mono truncate max-w-[120px]">
                        {cust.profile.phone}
                      </span>
                    </TableCell>

                    <TableCell className="font-mono text-slate-600 text-[11px]">
                      {cust.profile.cnic_or_ntn}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              cust.profile.completeness_score >= 80 ? 'bg-emerald-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${cust.profile.completeness_score}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                          {cust.profile.completeness_score}%
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {renderStatusBadge(cust.profile.approval_status)}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCustomer(cust)}
                        icon={<ExternalLink className="w-3 h-3" />}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Customer Detail & KYC Review Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          isOpen={true}
          onClose={() => setSelectedCustomer(null)}
          onRefresh={() => {
            fetchCustomers();
            setSelectedCustomer(null);
          }}
          canApprove={canApprove}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
