import React, { useState, useEffect } from 'react';
import {
  api,
  UserSession,
  DispatchManifestWithOrders,
  DispatchManifestDetails,
  ReturnOrderEnriched,
  ReturnOrder
} from '../../lib/api';
import { Button } from '../ui/Button';
import { CreateManifestModal } from './CreateManifestModal';
import { DispatchManifestPrintModal } from './DispatchManifestPrintModal';
import { OrderTrackingModal } from './OrderTrackingModal';
import { ProcessReturnModal } from './ProcessReturnModal';
import { BillingRateCardsView } from './BillingRateCardsView';
import {
  Truck,
  FileText,
  Printer,
  RotateCcw,
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Eye,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';

interface DispatchDashboardViewProps {
  user: UserSession;
}

export const DispatchDashboardView: React.FC<DispatchDashboardViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'manifests' | 'returns' | 'billing'>('manifests');

  // Manifests State
  const [manifests, setManifests] = useState<DispatchManifestWithOrders[]>([]);
  const [loadingManifests, setLoadingManifests] = useState(false);
  const [manifestSearch, setManifestSearch] = useState('');
  const [isCreateManifestOpen, setIsCreateManifestOpen] = useState(false);
  const [selectedManifestDetails, setSelectedManifestDetails] = useState<DispatchManifestDetails | null>(null);

  // Packed Orders eligible for new manifests
  const [packedOrders, setPackedOrders] = useState<any[]>([]);

  // Returns State
  const [returns, setReturns] = useState<ReturnOrderEnriched[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [returnSearch, setReturnSearch] = useState('');
  const [isProcessReturnOpen, setIsProcessReturnOpen] = useState(false);

  // Tracking Modal State
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<string | null>(null);

  // Notifications
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const hasPerm = (code: string) => {
    if (user?.role_id === 'role_administrator') return true;
    return user?.permissions?.includes(code) || false;
  };

  const canCreateManifest = hasPerm('manifests.create');
  const canDispatchManifest = hasPerm('manifests.dispatch');
  const canProcessReturn = hasPerm('returns.process');
  const canManageBilling = hasPerm('billing.manage');

  const fetchManifests = async () => {
    try {
      setLoadingManifests(true);
      const res = await api.getDispatchManifests();
      setManifests(res.manifests);
    } catch (err: any) {
      console.error('Failed to load manifests:', err);
    } finally {
      setLoadingManifests(false);
    }
  };

  const fetchReturns = async () => {
    try {
      setLoadingReturns(true);
      const res = await api.getReturnOrders();
      setReturns(res.returns);
    } catch (err: any) {
      console.error('Failed to load returns:', err);
    } finally {
      setLoadingReturns(false);
    }
  };

  const fetchPackedOrders = async () => {
    try {
      const res = await api.getOrders({ status: 'packed', limit: 200 });
      setPackedOrders(
        res.orders.map(o => ({
          id: o.id,
          order_number: o.order_number,
          customer_brand: (o as any).customer_brand || 'Merchant',
          consignee_name: o.consignee_name,
          city: o.city,
          cod_amount: o.cod_amount,
          payment_method: o.payment_method
        }))
      );
    } catch (err) {
      console.error('Failed to load packed orders for manifests:', err);
    }
  };

  useEffect(() => {
    fetchManifests();
    fetchReturns();
    fetchPackedOrders();
  }, []);

  const handleOpenPrintModal = async (manifestId: string) => {
    try {
      const details = await api.getDispatchManifestDetails(manifestId);
      setSelectedManifestDetails(details);
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'Failed to load manifest details.' });
    }
  };

  const handleSignAndDispatch = async (manifestId: string) => {
    try {
      const res = await api.signAndDispatchManifest(manifestId);
      setAlertMsg({
        type: 'success',
        text: `Manifest successfully signed and dispatched! Orders marked as fulfilled and billing deducted.`
      });
      if (selectedManifestDetails && selectedManifestDetails.manifest.id === manifestId) {
        selectedManifestDetails.manifest.status = 'signed_dispatched';
      }
      await fetchManifests();
      await fetchPackedOrders();
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'Failed to sign and dispatch manifest.' });
    }
  };

  const handleCreateManifestSubmit = async (data: any) => {
    const res = await api.createDispatchManifest(data);
    setAlertMsg({
      type: 'success',
      text: `Manifest ${res.manifest.manifest_number} created with ${res.manifest.total_orders} orders!`
    });
    await fetchManifests();
    await fetchPackedOrders();
    // Prompt print view right away
    handleOpenPrintModal(res.manifest.id);
  };

  const filteredManifests = manifests.filter(m => {
    const q = manifestSearch.toLowerCase();
    return (
      m.manifest_number.toLowerCase().includes(q) ||
      m.carrier_name.toLowerCase().includes(q) ||
      (m.driver_name && m.driver_name.toLowerCase().includes(q))
    );
  });

  const filteredReturns = returns.filter(r => {
    const q = returnSearch.toLowerCase();
    return (
      r.return_number.toLowerCase().includes(q) ||
      r.order_number.toLowerCase().includes(q) ||
      r.customer_brand.toLowerCase().includes(q) ||
      r.return_reason.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-700" />
            Carrier Dispatch, Tracking & Reverse Logistics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Phase 8 • Handover manifests, real-time tracking, reverse RTO QC inspection & automated wallet billing
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canProcessReturn && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsProcessReturnOpen(true)}
              className="text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1 text-rose-600" />
              Receive Return / RTO
            </Button>
          )}

          {canCreateManifest && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateManifestOpen(true)}
              className="text-xs bg-emerald-700 hover:bg-emerald-800"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Create Courier Manifest ({packedOrders.length} Ready)
            </Button>
          )}
        </div>
      </div>

      {alertMsg && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{alertMsg.text}</span>
          <button onClick={() => setAlertMsg(null)} className="font-bold underline text-[11px] ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('manifests')}
          className={`pb-3 px-3 text-xs font-bold transition-all relative ${
            activeTab === 'manifests'
              ? 'text-emerald-700 border-b-2 border-emerald-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            <span>Courier Handover Manifests</span>
            <span className="ml-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-700 font-mono">
              {manifests.length}
            </span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('returns')}
          className={`pb-3 px-3 text-xs font-bold transition-all relative ${
            activeTab === 'returns'
              ? 'text-emerald-700 border-b-2 border-emerald-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <span>Reverse Logistics & Returns (RTO)</span>
            <span className="ml-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-700 font-mono">
              {returns.length}
            </span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('billing')}
          className={`pb-3 px-3 text-xs font-bold transition-all relative ${
            activeTab === 'billing'
              ? 'text-emerald-700 border-b-2 border-emerald-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span>Automated Billing & Rate Cards</span>
          </div>
        </button>
      </div>

      {/* TAB 1: CARRIER HANDOVER MANIFESTS */}
      {activeTab === 'manifests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={manifestSearch}
                onChange={(e) => setManifestSearch(e.target.value)}
                placeholder="Search by manifest #, carrier, driver..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <Button variant="secondary" size="sm" onClick={fetchManifests} className="text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Manifest #</th>
                    <th className="py-3 px-4">Carrier Service</th>
                    <th className="py-3 px-4">Driver / Vehicle</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-right">COD Remittance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingManifests ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        Loading manifests...
                      </td>
                    </tr>
                  ) : filteredManifests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No dispatch manifests found. Packed orders ready for handover can be grouped into a new manifest.
                      </td>
                    </tr>
                  ) : (
                    filteredManifests.map((mnf) => (
                      <tr key={mnf.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {mnf.manifest_number}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {mnf.carrier_name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{mnf.driver_name || 'Designated Driver'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {mnf.vehicle_number || mnf.driver_phone || 'No vehicle/phone'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-900">
                          {mnf.total_orders}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          PKR {mnf.total_cod_amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              mnf.status === 'signed_dispatched'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {mnf.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                          {new Date(mnf.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenPrintModal(mnf.id)}
                            className="text-xs h-7 px-2"
                            title="Print Handover Voucher"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            Print
                          </Button>
                          {canDispatchManifest && mnf.status === 'draft' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSignAndDispatch(mnf.id)}
                              className="text-xs h-7 px-2 bg-emerald-700 hover:bg-emerald-800"
                              title="Sign & Dispatch"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                              Dispatch
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REVERSE LOGISTICS & RETURNS */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={returnSearch}
                onChange={(e) => setReturnSearch(e.target.value)}
                placeholder="Search returns by #, order #, merchant, reason..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <Button variant="secondary" size="sm" onClick={fetchReturns} className="text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Return #</th>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Merchant Brand</th>
                    <th className="py-3 px-4">Consignee</th>
                    <th className="py-3 px-4">Type & Reason</th>
                    <th className="py-3 px-4">Disposition</th>
                    <th className="py-3 px-4">Target Location</th>
                    <th className="py-3 px-4">Inspected Date</th>
                    <th className="py-3 px-4 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingReturns ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        Loading reverse returns...
                      </td>
                    </tr>
                  ) : filteredReturns.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        No return records registered. Use "Receive Return / RTO" to log a reverse shipment.
                      </td>
                    </tr>
                  ) : (
                    filteredReturns.map((rtn) => (
                      <tr key={rtn.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-rose-700">
                          {rtn.return_number}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          <button
                            onClick={() => setSelectedTrackingOrder(rtn.order_number)}
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <span>{rtn.order_number}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {rtn.customer_brand}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{rtn.consignee_name}</div>
                          <div className="text-[10px] text-slate-400">{rtn.city}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 uppercase text-[10px]">
                            {rtn.return_type.replace('_', ' ')}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {rtn.return_reason}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              rtn.disposition === 'restocked'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {rtn.disposition.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                          {rtn.target_location_name || 'Quarantine / Damaged Bay'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px] font-mono">
                          {new Date(rtn.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedTrackingOrder(rtn.order_number)}
                            className="text-xs h-7 px-2"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Track
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATED BILLING & RATE CARDS */}
      {activeTab === 'billing' && (
        <BillingRateCardsView canManage={canManageBilling} />
      )}

      {/* Create Manifest Modal */}
      <CreateManifestModal
        isOpen={isCreateManifestOpen}
        onClose={() => setIsCreateManifestOpen(false)}
        onSubmit={handleCreateManifestSubmit}
        packedOrders={packedOrders}
      />

      {/* Print Manifest Voucher Modal */}
      {selectedManifestDetails && (
        <DispatchManifestPrintModal
          manifestDetails={selectedManifestDetails}
          onClose={() => setSelectedManifestDetails(null)}
          onSignAndDispatch={() => handleSignAndDispatch(selectedManifestDetails.manifest.id)}
          canSignAndDispatch={canDispatchManifest}
        />
      )}

      {/* Receive Return / RTO Modal */}
      <ProcessReturnModal
        isOpen={isProcessReturnOpen}
        onClose={() => setIsProcessReturnOpen(false)}
        onSuccess={(returnOrder) => {
          setAlertMsg({
            type: 'success',
            text: `Return ${returnOrder.return_number} successfully inspected and processed!`
          });
          fetchReturns();
        }}
      />

      {/* Live Checkpoint Tracking Modal */}
      {selectedTrackingOrder && (
        <OrderTrackingModal
          orderIdentifier={selectedTrackingOrder}
          isOpen={true}
          onClose={() => setSelectedTrackingOrder(null)}
          canAddEvent={canDispatchManifest}
        />
      )}
    </div>
  );
};
