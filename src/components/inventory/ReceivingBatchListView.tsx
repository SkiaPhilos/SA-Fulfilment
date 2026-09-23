import React, { useState, useEffect } from 'react';
import {
  api,
  UserSession,
  ReceivingBatch,
  Warehouse,
  CustomerProfile
} from '../../lib/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Notice } from '../ui/Notice';
import { UnitLabelPrintModal } from './UnitLabelPrintModal';
import { StockingSessionModal } from './StockingSessionModal';
import {
  Inbox,
  Printer,
  Boxes,
  Search,
  RefreshCw,
  Copy,
  Check,
  Building,
  CheckCircle2,
  Clock,
  Truck
} from 'lucide-react';

interface ReceivingBatchListViewProps {
  user: UserSession;
  onOpenReceivingModal?: () => void;
}

export const ReceivingBatchListView: React.FC<ReceivingBatchListViewProps> = ({
  user,
  onOpenReceivingModal
}) => {
  const isCustomer = user.account_type === 'customer';
  const canStock = user.role_id === 'role_administrator' || user.permissions.includes('inventory.stock');

  const [batches, setBatches] = useState<ReceivingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);

  // Action Modals
  const [printBatchId, setPrintBatchId] = useState<string | null>(null);
  const [stockingBatchId, setStockingBatchId] = useState<string | null>(null);
  const [copiedBatch, setCopiedBatch] = useState<string | null>(null);

  const fetchBatches = () => {
    setLoading(true);
    setError(null);
    const customerIdFilter = isCustomer ? user.customer_profile?.id : (selectedCustomerId !== 'all' ? selectedCustomerId : undefined);

    api.getReceivingBatches(customerIdFilter)
      .then((res) => {
        setBatches(res.batches);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load receiving batches.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBatches();
  }, [selectedCustomerId]);

  useEffect(() => {
    api.getWarehouses()
      .then((res) => setWarehouses(res.warehouses))
      .catch((err) => console.error('Failed to load warehouses:', err));

    if (!isCustomer) {
      api.getCustomers()
        .then((res) => {
          const profiles = res.customers
            .map((c) => c.profile)
            .filter((p): p is CustomerProfile => Boolean(p));
          setCustomers(profiles);
        })
        .catch((err) => console.error('Failed to load customers:', err));
    }
  }, [isCustomer]);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedBatch(code);
    setTimeout(() => setCopiedBatch(null), 2000);
  };

  // Filter batches by search query and warehouse
  const filteredBatches = batches.filter((b) => {
    if (selectedWarehouseId !== 'all' && b.warehouse_id !== selectedWarehouseId) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = b.batch_number.toLowerCase().includes(q);
      const matchCarrier = b.carrier?.toLowerCase().includes(q);
      const matchRef = b.tracking_reference?.toLowerCase().includes(q);
      const matchCreator = b.created_by_name?.toLowerCase().includes(q);
      return matchNum || matchCarrier || matchRef || matchCreator;
    }
    return true;
  });

  const totalUnitsReceived = batches.reduce((acc, b) => acc + (b.total_units || 0), 0);
  const totalUnitsStocked = batches.reduce((acc, b) => acc + (b.stocked_units || 0), 0);
  const unitsAwaitingPutaway = totalUnitsReceived - totalUnitsStocked;

  const getStatusBadge = (batch: ReceivingBatch) => {
    const isComplete = batch.status === 'completed' || batch.stocked_units >= batch.total_units;
    const isPartial = batch.stocked_units > 0 && batch.stocked_units < batch.total_units;

    if (isComplete) {
      return <Badge variant="success">Fully Stocked</Badge>;
    }
    if (isPartial) {
      return <Badge variant="warning">Partially Stocked ({batch.stocked_units}/{batch.total_units})</Badge>;
    }
    return <Badge variant="neutral">Awaiting Putaway</Badge>;
  };

  const getWarehouseName = (id: string) => {
    const w = warehouses.find((item) => item.id === id);
    return w ? `${w.name} (${w.code})` : 'Warehouse';
  };

  const getCustomerName = (id: string) => {
    const c = customers.find((item) => item.id === id);
    return c ? c.brand_name : 'Merchant';
  };

  return (
    <div className="space-y-6">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Receiving Freight Batches</span>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-mono font-semibold px-2 py-0.5 rounded">
              {batches.length} Batches
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Historical freight intake logs. Reprint bulk barcode sheets for any batch at any time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenReceivingModal && canStock && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenReceivingModal}
              className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs"
            >
              <Inbox className="w-4 h-4" />
              <span>Receive New Freight Batch</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchBatches} loading={loading}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Intake Units</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-2">
            {totalUnitsReceived.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Across {batches.length} received consignments</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Awaiting Putaway</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-700 mt-2">
            {unitsAwaitingPutaway.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Units at receiving dock / staging area</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Putaway Completed</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-800 mt-2">
            {totalUnitsStocked.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totalUnitsReceived > 0
              ? `${Math.round((totalUnitsStocked / totalUnitsReceived) * 100)}% shelved in storage bins`
              : '0%'}
          </div>
        </div>
      </div>

      {error && (
        <Notice variant="error" title="Intake Batches Error">
          {error}
        </Notice>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Batch number, carrier, waybill..."
                className="w-full h-8 pl-8 pr-3 rounded border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Warehouse Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Facility / Warehouse</label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs text-slate-800"
            >
              <option value="all">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          {/* Customer Filter */}
          {!isCustomer && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Merchant</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs text-slate-800"
              >
                <option value="all">All Merchants</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.brand_name} ({c.business_name})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Intake Date</th>
                <th className="py-3 px-4">Facility</th>
                {!isCustomer && <th className="py-3 px-4">Merchant</th>}
                <th className="py-3 px-4">Carrier & Ref</th>
                <th className="py-3 px-4">Units Stocked / Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    {loading ? 'Loading receiving batches...' : 'No receiving batches found.'}
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => {
                  const percentStocked =
                    batch.total_units > 0
                      ? Math.round((batch.stocked_units / batch.total_units) * 100)
                      : 0;

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Batch Number */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{batch.batch_number}</span>
                          <button
                            onClick={() => handleCopy(batch.batch_number)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                            title="Copy batch number"
                          >
                            {copiedBatch === batch.batch_number ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal font-sans">
                          By: {batch.created_by_name}
                        </div>
                      </td>

                      {/* Intake Date */}
                      <td className="py-3 px-4 text-slate-700 font-mono text-[11px]">
                        <div>{new Date(batch.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(batch.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* Warehouse */}
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>{getWarehouseName(batch.warehouse_id)}</span>
                        </div>
                      </td>

                      {/* Merchant */}
                      {!isCustomer && (
                        <td className="py-3 px-4 text-slate-800 font-semibold">
                          {getCustomerName(batch.customer_id)}
                        </td>
                      )}

                      {/* Carrier & Tracking */}
                      <td className="py-3 px-4 text-slate-700">
                        {batch.carrier || batch.tracking_reference ? (
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1">
                              <Truck className="w-3 h-3 text-slate-400" />
                              <span>{batch.carrier || 'Freight Courier'}</span>
                            </div>
                            {batch.tracking_reference && (
                              <div className="text-[10px] font-mono text-slate-500">
                                Ref: {batch.tracking_reference}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Direct Dock Intake</span>
                        )}
                      </td>

                      {/* Units Progress */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {batch.stocked_units} / {batch.total_units}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            ({percentStocked}%)
                          </span>
                        </div>
                        <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              percentStocked >= 100
                                ? 'bg-emerald-600'
                                : percentStocked > 0
                                ? 'bg-amber-500'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${percentStocked}%` }}
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(batch)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Bulk Print Labels Action (Persistent!) */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPrintBatchId(batch.id)}
                            className="text-emerald-800 border-emerald-300 hover:bg-emerald-50 bg-white"
                            title="Print all barcode labels for this batch"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Print All Labels</span>
                          </Button>

                          {/* Putaway Action */}
                          {canStock && batch.stocked_units < batch.total_units && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setStockingBatchId(batch.id)}
                              className="text-slate-800 hover:bg-slate-200"
                              title="Shelve units into warehouse storage bins"
                            >
                              <Boxes className="w-3.5 h-3.5" />
                              <span>Putaway</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unit Label Print Modal */}
      {printBatchId && (
        <UnitLabelPrintModal
          batchId={printBatchId}
          onClose={() => setPrintBatchId(null)}
        />
      )}

      {/* Putaway Stocking Session Modal */}
      {stockingBatchId && (
        <StockingSessionModal
          user={user}
          initialBatchId={stockingBatchId}
          onClose={() => {
            setStockingBatchId(null);
            fetchBatches();
          }}
          onSuccess={() => {
            setStockingBatchId(null);
            fetchBatches();
          }}
        />
      )}
    </div>
  );
};
