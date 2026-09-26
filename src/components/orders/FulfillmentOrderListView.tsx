import React, { useState, useEffect } from 'react';
import {
  api,
  FulfillmentOrder,
  CustomerProfile,
  UserSession,
  PickingBatchDetails,
  ShippingLabelData
} from '../../lib/api';
import { OrderCreateModal } from './OrderCreateModal';
import { OrderCsvImportModal } from './OrderCsvImportModal';
import { OrderDetailModal } from './OrderDetailModal';
import { WarehousePickingSheetModal } from '../fulfillment/WarehousePickingSheetModal';
import { ShippingLabelPrintModal } from '../fulfillment/ShippingLabelPrintModal';
import { PickingSessionModal } from '../fulfillment/PickingSessionModal';
import { PackingStationModal } from '../fulfillment/PackingStationModal';
import { PickingBatchListModal } from '../fulfillment/PickingBatchListModal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Notice } from '../ui/Notice';
import {
  Package,
  PackagePlus,
  FileSpreadsheet,
  Download,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Boxes,
  Truck,
  Check,
  ChevronRight,
  Eye,
  XCircle,
  PackageCheck,
  Tag,
  Printer
} from 'lucide-react';

interface FulfillmentOrderListViewProps {
  user: UserSession;
}

export const FulfillmentOrderListView: React.FC<FulfillmentOrderListViewProps> = ({ user }) => {
  const isCustomer = user.account_type === 'customer';
  const isAdmin = user.role_id === 'role_administrator';
  const canCreate = isAdmin || user.permissions.includes('orders.create');
  const canConfirm = isAdmin || user.permissions.includes('orders.confirm');
  const canExport = isAdmin || user.permissions.includes('orders.export');
  const canPick = isAdmin || user.permissions.includes('orders.pick');
  const canPack = isAdmin || user.permissions.includes('orders.pack');

  // Active status filter tab
  const [activeTab, setActiveTab] = useState<
    'all' | 'placed' | 'confirmed' | 'to_fulfill' | 'picked' | 'packed' | 'fulfilled' | 'cancelled'
  >('all');

  // Customer filter for staff
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  // Orders data
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected orders for bulk action
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<string | null>(null);

  // Phase 7 Modals
  const [showPackingStation, setShowPackingStation] = useState(false);
  const [showBatchesModal, setShowBatchesModal] = useState(false);
  const [activePickingBatchId, setActivePickingBatchId] = useState<string | null>(null);
  const [pickingSheetDetails, setPickingSheetDetails] = useState<PickingBatchDetails | null>(null);
  const [shippingLabelsData, setShippingLabelsData] = useState<ShippingLabelData[] | null>(null);

  // Notification Banner
  const [notice, setNotice] = useState<{
    variant: 'success' | 'info' | 'error';
    title: string;
    message: string;
  } | null>(null);

  // Load customer accounts for staff dropdown
  useEffect(() => {
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

  // Load orders
  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getOrders({
        status: activeTab === 'all' ? undefined : activeTab,
        customerId: !isCustomer && selectedCustomerId !== 'all' ? selectedCustomerId : undefined,
        search: searchQuery.trim() || undefined,
        city: cityFilter.trim() || undefined,
        page,
        limit: 50
      });

      setOrders(res.orders);
      setTotalPages(res.totalPages);
      setTotalCount(res.totalCount);
      setSelectedOrderIds([]);
    } catch (err: any) {
      setError(err.message || 'Failed to load fulfillment orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [activeTab, selectedCustomerId, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadOrders();
  };

  // Bulk confirmation action
  const handleBulkConfirm = async () => {
    if (selectedOrderIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const res = await api.bulkConfirmOrders(selectedOrderIds);
      setNotice({
        variant: 'success',
        title: 'Bulk Confirmation Complete',
        message: `Successfully confirmed ${res.confirmedCount} order(s). They are now ready for fulfillment stock allocation.`
      });
      setSelectedOrderIds([]);
      loadOrders();
    } catch (err: any) {
      setNotice({
        variant: 'error',
        title: 'Bulk Confirmation Failed',
        message: err.message || 'Failed to confirm selected orders'
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Quick single confirm action
  const handleSingleConfirm = async (orderId: string, orderNumber: string) => {
    try {
      await api.confirmOrder(orderId);
      setNotice({
        variant: 'success',
        title: 'Order Confirmed',
        message: `Order ${orderNumber} confirmed successfully.`
      });
      loadOrders();
    } catch (err: any) {
      setNotice({
        variant: 'error',
        title: 'Confirmation Failed',
        message: err.message || 'Failed to confirm order'
      });
    }
  };

  // 7.1 & 7.2: Prepare Fulfillment (Reserve physical units)
  const handlePrepareFulfillment = async (targetOrderIds?: string[]) => {
    const ids = targetOrderIds || selectedOrderIds;
    if (ids.length === 0) return;

    setBulkActionLoading(true);
    try {
      const res = await api.prepareFulfillment(ids);
      if (res.result.failedCount > 0 && res.result.preparedCount === 0) {
        setNotice({
          variant: 'error',
          title: 'Stock Allocation Failed',
          message: res.result.failedOrders.map(f => `${f.orderNumber}: ${f.reason}`).join(' | ')
        });
      } else {
        setNotice({
          variant: 'success',
          title: 'Fulfillment Stock Reserved',
          message: `Successfully reserved ${res.result.totalUnitsReserved} physical unit(s) across ${res.result.preparedCount} order(s). Moved to "To Fulfill" state.`
        });
      }
      setSelectedOrderIds([]);
      loadOrders();
    } catch (err: any) {
      setNotice({
        variant: 'error',
        title: 'Preparation Error',
        message: err.message || 'Failed to prepare fulfillment'
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // 7.3: Create Picking Batch for selected 'to_fulfill' orders
  const handleCreatePickingBatch = async () => {
    if (selectedOrderIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const res = await api.createPickingBatch(selectedOrderIds);
      setNotice({
        variant: 'success',
        title: 'Picking Batch Created',
        message: `Picking wave ${res.batch.batch_number} created with ${res.batch.total_units_count} units. Launching Picking Station...`
      });
      setSelectedOrderIds([]);
      loadOrders();
      // Automatically launch the picking station for this batch
      setActivePickingBatchId(res.batch.id);
    } catch (err: any) {
      setNotice({
        variant: 'error',
        title: 'Failed to Create Picking Batch',
        message: err.message || 'Could not create picking batch'
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // 7.5: Print Shipping Labels
  const handlePrintShippingLabels = async (targetOrderIds?: string[]) => {
    const ids = targetOrderIds || selectedOrderIds;
    if (ids.length === 0) return;

    try {
      const res = await api.getShippingLabels(ids);
      setShippingLabelsData(res.labels);
    } catch (err: any) {
      setNotice({
        variant: 'error',
        title: 'Failed to Generate Labels',
        message: err.message || 'Error fetching shipping label metadata'
      });
    }
  };

  // 7.7: Dispatch Packed Orders to Carrier
  const handleDispatchOrders = async (targetOrderIds?: string[]) => {
    const ids = targetOrderIds || selectedOrderIds;
    if (ids.length === 0) return;

    setBulkActionLoading(true);
    try {
      const res = await api.dispatchOrders(ids);
      setNotice({
        variant: 'success',
        title: 'Orders Dispatched',
        message: `Successfully marked ${res.result.dispatchedCount} order(s) as Fulfilled & Handed over to Carrier.`
      });
      setSelectedOrderIds([]);
      loadOrders();
    } catch (err: any) {
      setNotice({
        variant: 'error',
        title: 'Dispatch Failed',
        message: err.message || 'Could not dispatch orders'
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Export orders to CSV
  const handleExportCsv = async () => {
    try {
      const blob = await api.exportOrdersCsv({
        status: activeTab === 'all' ? undefined : activeTab,
        customerId: !isCustomer && selectedCustomerId !== 'all' ? selectedCustomerId : undefined,
        search: searchQuery.trim() || undefined,
        city: cityFilter.trim() || undefined
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ship_asaan_orders_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Selected orders inspection for context-aware bulk actions
  const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
  const hasPlacedSelected = selectedOrders.some(o => o.status === 'placed');
  const hasConfirmedSelected = selectedOrders.some(o => o.status === 'confirmed');
  const hasToFulfillSelected = selectedOrders.some(o => o.status === 'to_fulfill');
  const hasPickedSelected = selectedOrders.some(o => o.status === 'picked');
  const hasPackedSelected = selectedOrders.some(o => o.status === 'packed');

  const placedCount = orders.filter((o) => o.status === 'placed').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'placed':
        return <Badge variant="neutral" className="bg-sky-50 text-sky-700 border-sky-200">Placed</Badge>;
      case 'confirmed':
        return <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200">Confirmed</Badge>;
      case 'to_fulfill':
        return <Badge variant="info" className="bg-indigo-50 text-indigo-700 border-indigo-200">To Fulfill</Badge>;
      case 'picked':
        return <Badge variant="neutral" className="bg-purple-50 text-purple-700 border-purple-200">Picked</Badge>;
      case 'packed':
        return <Badge variant="info" className="bg-teal-50 text-teal-700 border-teal-200">Packed</Badge>;
      case 'fulfilled':
        return <Badge variant="success" className="bg-green-100 text-green-800 border-green-300">Fulfilled</Badge>;
      case 'cancelled':
        return <Badge variant="danger" className="bg-rose-50 text-rose-700 border-rose-200">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      {notice && (
        <Notice
          variant={notice.variant}
          title={notice.title}
          onDismiss={() => setNotice(null)}
        >
          {notice.message}
        </Notice>
      )}

      {/* Domain Navigation & Action Controls */}
      <div className="bg-white border-b border-slate-200 -mx-4 -mt-4 px-4 sm:px-6 pt-4 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-5 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('all'); setPage(1); }}
            className={`flex items-center gap-1.5 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'all'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>All Orders</span>
          </button>

          <button
            onClick={() => { setActiveTab('placed'); setPage(1); }}
            className={`flex items-center gap-1.5 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'placed'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 text-sky-600" />
            <span>Confirmation Queue</span>
            {placedCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                {placedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('confirmed'); setPage(1); }}
            className={`flex items-center gap-1.5 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'confirmed'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Confirmed</span>
          </button>

          <button
            onClick={() => { setActiveTab('to_fulfill'); setPage(1); }}
            className={`flex items-center gap-1.5 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'to_fulfill'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4 text-indigo-600" />
            <span>To Fulfill</span>
          </button>

          <button
            onClick={() => { setActiveTab('picked'); setPage(1); }}
            className={`flex items-center gap-1.5 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'picked'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4 text-purple-600" />
            <span>Picked</span>
          </button>

          <button
            onClick={() => { setActiveTab('packed'); setPage(1); }}
            className={`flex items-center gap-1.5 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'packed'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PackageCheck className="w-4 h-4 text-teal-600" />
            <span>Packed</span>
          </button>

          <button
            onClick={() => { setActiveTab('fulfilled'); setPage(1); }}
            className={`flex items-center gap-1.5 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'fulfilled'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4 text-green-600" />
            <span>Dispatched</span>
          </button>

          <button
            onClick={() => { setActiveTab('cancelled'); setPage(1); }}
            className={`flex items-center gap-1.5 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'cancelled'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <XCircle className="w-4 h-4 text-rose-500" />
            <span>Cancelled</span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 pb-3">
          {!isCustomer && canPick && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBatchesModal(true)}
              className="text-indigo-800 border-indigo-300 hover:bg-indigo-50"
            >
              <Boxes className="w-3.5 h-3.5 mr-1" />
              <span>Picking Waves</span>
            </Button>
          )}

          {!isCustomer && canPack && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPackingStation(true)}
              className="text-emerald-800 border-emerald-300 hover:bg-emerald-50 font-semibold"
            >
              <PackageCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              <span>Scan-to-Pack</span>
            </Button>
          )}

          {canExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={orders.length === 0}
              className="text-slate-700 border-slate-300 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              <span>Export CSV</span>
            </Button>
          )}

          {canCreate && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCsvImportModal(true)}
                className="text-emerald-800 border-emerald-300 hover:bg-emerald-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                <span>Import CSV</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <PackagePlus className="w-3.5 h-3.5 mr-1" />
                <span>Create Order</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Order #, Consignee Name, Phone, City, or Ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter city (e.g. Lahore)..."
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            onBlur={loadOrders}
            className="text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-600 w-36"
          />

          {!isCustomer && customers.length > 0 && (
            <select
              value={selectedCustomerId}
              onChange={(e) => { setSelectedCustomerId(e.target.value); setPage(1); }}
              className="text-xs px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
            >
              <option value="all">All Merchants</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.brand_name || c.business_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Dynamic Context-Aware Bulk Action Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-950 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-700" />
            <span>
              <strong>{selectedOrderIds.length} order(s)</strong> selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedOrderIds([])}
              className="text-gray-700 border-gray-300 bg-white"
            >
              Deselect All Orders
            </Button>

            {/* If Placed orders are selected */}
            {hasPlacedSelected && canConfirm && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleBulkConfirm}
                disabled={bulkActionLoading}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                {bulkActionLoading ? 'Confirming...' : `Bulk Confirm (${selectedOrderIds.length})`}
              </Button>
            )}

            {/* If Confirmed orders are selected -> 7.1 & 7.2 Reserve Stock */}
            {hasConfirmedSelected && canPick && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handlePrepareFulfillment()}
                disabled={bulkActionLoading}
                className="bg-indigo-700 hover:bg-indigo-800 text-white"
              >
                <Boxes className="w-3.5 h-3.5 mr-1" />
                {bulkActionLoading ? 'Reserving...' : `Prepare Fulfillment & Reserve Stock`}
              </Button>
            )}

            {/* If To-Fulfill orders are selected -> 7.3 Create Picking Batch */}
            {hasToFulfillSelected && canPick && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreatePickingBatch}
                disabled={bulkActionLoading}
                className="bg-purple-700 hover:bg-purple-800 text-white"
              >
                <Boxes className="w-3.5 h-3.5 mr-1" />
                {bulkActionLoading ? 'Creating Wave...' : `Create Picking Wave`}
              </Button>
            )}

            {/* If Packed orders are selected -> 7.7 Dispatch */}
            {hasPackedSelected && canPack && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDispatchOrders()}
                disabled={bulkActionLoading}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                <Truck className="w-3.5 h-3.5 mr-1" />
                {bulkActionLoading ? 'Dispatching...' : `Dispatch to Carrier`}
              </Button>
            )}

            {/* Shipping Labels Print (available for confirmed, to_fulfill, picked, packed) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePrintShippingLabels()}
              className="text-slate-800 border-slate-300 bg-white"
            >
              <Tag className="w-3.5 h-3.5 mr-1 text-slate-600" />
              <span>Print Shipping Labels</span>
            </Button>
          </div>
        </div>
      )}

      {/* Orders Operational Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading fulfillment orders...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <Notice variant="error" title="Failed to load orders">
              {error}
            </Notice>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">No Fulfill Orders Found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery || cityFilter || activeTab !== 'all'
                  ? 'No orders match your filter criteria. Try clearing search or switching status.'
                  : 'Start by creating a single order or importing orders via bulk CSV sheet.'}
              </p>
            </div>
            {canCreate && (
              <div className="pt-2 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCsvImportModal(true)}
                  className="text-emerald-800 border-emerald-300"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                  Import CSV
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  <PackagePlus className="w-3.5 h-3.5 mr-1" />
                  Create Order
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/70">
                  <th className="py-3 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.length > 0 && selectedOrderIds.length === orders.length}
                      onChange={toggleSelectAll}
                      className="rounded text-emerald-700 focus:ring-emerald-600"
                    />
                  </th>
                  <th className="py-3 px-3">Order Number / Ref</th>
                  <th className="py-3 px-3">Date</th>
                  {!isCustomer && <th className="py-3 px-3">Merchant</th>}
                  <th className="py-3 px-3">Consignee & Destination</th>
                  <th className="py-3 px-3">Ordered Items</th>
                  <th className="py-3 px-3 text-right">COD (PKR)</th>
                  <th className="py-3 px-3 text-center">Stock Adequacy</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {orders.map((ord) => {
                  const isSelected = selectedOrderIds.includes(ord.id);

                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(ord.id)}
                          className="rounded text-emerald-700 focus:ring-emerald-600"
                        />
                      </td>

                      <td className="py-3 px-3 font-mono">
                        <button
                          onClick={() => setSelectedOrderForDetail(ord.id)}
                          className="font-bold text-slate-900 hover:text-emerald-700 transition-colors flex items-center gap-1 text-left"
                        >
                          <span>{ord.order_number}</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </button>
                        {ord.customer_reference && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Ref: {ord.customer_reference}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(ord.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                        <div className="text-[10px] text-slate-400">
                          {new Date(ord.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {!isCustomer && (
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800">
                            {ord.customer_brand || 'Unknown'}
                          </div>
                        </td>
                      )}

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{ord.consignee_name}</div>
                        <div className="text-[11px] text-slate-600 font-medium">{ord.city}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{ord.consignee_phone}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono text-slate-800 text-[11px] font-semibold max-w-[180px] truncate" title={ord.items_preview}>
                          {ord.items_preview || 'No items'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {ord.total_pieces} total pieces ({ord.items_count} SKUs)
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono">
                        <div className="font-bold text-slate-900">
                          {ord.cod_amount > 0 ? `PKR ${ord.cod_amount.toLocaleString()}` : '0 (Prepaid)'}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase">
                          {ord.payment_method}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {ord.stock_adequacy === 'sufficient' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            In Storage
                          </span>
                        ) : ord.stock_adequacy === 'partial' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Partial Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Out of Stock
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {getStatusBadge(ord.status)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Detail Drawer */}
                          <button
                            onClick={() => setSelectedOrderForDetail(ord.id)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                            title="View Full Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Print Label Shortcut */}
                          <button
                            onClick={() => handlePrintShippingLabels([ord.id])}
                            className="p-1 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                            title="Print Courier Shipping Label"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Placed: Confirm */}
                          {ord.status === 'placed' && canConfirm && (
                            <button
                              onClick={() => handleSingleConfirm(ord.id, ord.order_number)}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200 text-[11px] font-semibold transition-colors flex items-center gap-1"
                              title="Confirm Order"
                            >
                              <Check className="w-3 h-3" />
                              <span>Confirm</span>
                            </button>
                          )}

                          {/* Confirmed: Prepare Fulfillment */}
                          {ord.status === 'confirmed' && canPick && (
                            <button
                              onClick={() => handlePrepareFulfillment([ord.id])}
                              className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200 text-[11px] font-semibold transition-colors flex items-center gap-1"
                              title="Reserve Inventory & Prepare Fulfillment"
                            >
                              <Boxes className="w-3 h-3" />
                              <span>Prepare</span>
                            </button>
                          )}

                          {/* Picked: Scan to Pack */}
                          {ord.status === 'picked' && canPack && (
                            <button
                              onClick={() => setShowPackingStation(true)}
                              className="px-2 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded border border-teal-200 text-[11px] font-semibold transition-colors flex items-center gap-1"
                              title="Open Packing Station"
                            >
                              <PackageCheck className="w-3 h-3" />
                              <span>Pack</span>
                            </button>
                          )}

                          {/* Packed: Dispatch */}
                          {ord.status === 'packed' && canPack && (
                            <button
                              onClick={() => handleDispatchOrders([ord.id])}
                              className="px-2 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded border border-emerald-300 text-[11px] font-semibold transition-colors flex items-center gap-1"
                              title="Dispatch to Carrier"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Dispatch</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {orders.length} of {totalCount} orders
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="font-semibold text-slate-700">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <OrderCreateModal
          user={user}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(orderNumber) => {
            setNotice({
              variant: 'success',
              title: 'Order Created Successfully',
              message: `Order ${orderNumber} has been recorded in Placed state and sent to Confirmation Queue.`
            });
            loadOrders();
          }}
        />
      )}

      {/* CSV Import Modal */}
      {showCsvImportModal && (
        <OrderCsvImportModal
          user={user}
          onClose={() => setShowCsvImportModal(false)}
          onSuccess={(importedCount) => {
            setNotice({
              variant: 'success',
              title: 'Bulk Import Finished',
              message: `Successfully imported ${importedCount} orders. Review and confirm them below.`
            });
            loadOrders();
          }}
        />
      )}

      {/* Order Detail Modal */}
      {selectedOrderForDetail && (
        <OrderDetailModal
          orderId={selectedOrderForDetail}
          user={user}
          onClose={() => setSelectedOrderForDetail(null)}
          onOrderUpdated={loadOrders}
        />
      )}

      {/* Phase 7: Packing Station (Scan-to-Pack) */}
      {showPackingStation && (
        <PackingStationModal
          isOpen={showPackingStation}
          onClose={() => setShowPackingStation(false)}
          onOrderPacked={loadOrders}
        />
      )}

      {/* Phase 7: Picking Batches List Modal */}
      {showBatchesModal && (
        <PickingBatchListModal
          isOpen={showBatchesModal}
          onClose={() => setShowBatchesModal(false)}
          onOpenPickingStation={(batchId) => {
            setShowBatchesModal(false);
            setActivePickingBatchId(batchId);
          }}
          onOpenPrintSheet={(details) => {
            setPickingSheetDetails(details);
          }}
        />
      )}

      {/* Phase 7: Interactive Picking Session Modal */}
      {activePickingBatchId && (
        <PickingSessionModal
          isOpen={Boolean(activePickingBatchId)}
          onClose={() => setActivePickingBatchId(null)}
          batchId={activePickingBatchId}
          onBatchUpdated={loadOrders}
          onOpenPrintSheet={(details) => setPickingSheetDetails(details)}
        />
      )}

      {/* Phase 7: Warehouse Picking Sheet Modal */}
      {pickingSheetDetails && (
        <WarehousePickingSheetModal
          isOpen={Boolean(pickingSheetDetails)}
          onClose={() => setPickingSheetDetails(null)}
          details={pickingSheetDetails}
        />
      )}

      {/* Phase 7: Shipping Label Print Modal */}
      {shippingLabelsData && (
        <ShippingLabelPrintModal
          isOpen={Boolean(shippingLabelsData)}
          onClose={() => setShippingLabelsData(null)}
          labels={shippingLabelsData}
        />
      )}
    </div>
  );
};
