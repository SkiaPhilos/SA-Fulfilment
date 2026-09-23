import React, { useState, useEffect } from 'react';
import { api, FulfillmentOrder, FulfillmentOrderItem, UserSession } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Notice } from '../ui/Notice';
import {
  Package,
  MapPin,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Boxes,
  Copy,
  Check,
  AlertTriangle,
  User,
  Banknote,
  Truck
} from 'lucide-react';
import { OrderTrackingModal } from '../dispatch/OrderTrackingModal';

interface OrderDetailModalProps {
  orderId: string;
  user: UserSession;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  orderId,
  user,
  onClose,
  onOrderUpdated
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    order: FulfillmentOrder;
    customer: {
      id: string;
      business_name: string;
      brand_name: string;
      phone: string;
      city: string;
    } | null;
    items: FulfillmentOrderItem[];
    allocated_units: Array<{
      id: string;
      tracking_code: string;
      state: string;
      location_id: string | null;
    }>;
  } | null>(null);

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  const isAdmin = user.role_id === 'role_administrator';
  const canConfirm = isAdmin || user.permissions.includes('orders.confirm');
  const canCancel = isAdmin || user.permissions.includes('orders.cancel') || user.account_type === 'customer';

  const loadDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getOrderDetails(orderId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [orderId]);

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleConfirm = async () => {
    if (!data) return;
    setActionLoading(true);
    try {
      await api.confirmOrder(data.order.id);
      await loadDetails();
      onOrderUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!data || !cancelReason.trim()) return;
    setActionLoading(true);
    try {
      await api.cancelOrder(data.order.id, cancelReason);
      setShowCancelPrompt(false);
      setCancelReason('');
      await loadDetails();
      onOrderUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel order');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'placed':
        return <Badge variant="neutral" className="bg-sky-50 text-sky-700 border-sky-200">Placed / Pending Confirmation</Badge>;
      case 'confirmed':
        return <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200">Confirmed</Badge>;
      case 'to_fulfill':
        return <Badge variant="info" className="bg-indigo-50 text-indigo-700 border-indigo-200">Queued for Fulfillment</Badge>;
      case 'picked':
        return <Badge variant="neutral" className="bg-purple-50 text-purple-700 border-purple-200">Picked</Badge>;
      case 'packed':
        return <Badge variant="info" className="bg-teal-50 text-teal-700 border-teal-200">Packed</Badge>;
      case 'fulfilled':
        return <Badge variant="success" className="bg-green-100 text-green-800 border-green-300">Fulfilled & Dispatched</Badge>;
      case 'cancelled':
        return <Badge variant="danger" className="bg-rose-50 text-rose-700 border-rose-200">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-emerald-700" />
          <span>Fulfillment Order Details</span>
        </div>
      }
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {data && data.order.status === 'placed' && canCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelPrompt(true)}
                className="text-rose-700 border-rose-200 hover:bg-rose-50"
                disabled={actionLoading}
              >
                Cancel Order
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {data && data.order.status === 'placed' && canConfirm && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirm}
                disabled={actionLoading}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {actionLoading ? 'Confirming...' : 'Confirm Order'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading fulfillment order details...</p>
        </div>
      ) : error ? (
        <Notice variant="error" title="Error Loading Order">
          {error}
        </Notice>
      ) : data ? (
        <div className="space-y-6">
          {/* Header Summary */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-mono text-slate-900">{data.order.order_number}</span>
                {getStatusBadge(data.order.status)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTrackingModal(true)}
                  className="text-xs h-7 ml-2 text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  <Truck className="w-3.5 h-3.5 mr-1" />
                  Live Tracking
                </Button>
              </div>
              {data.order.customer_reference && (
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <span className="font-semibold text-slate-600">Merchant Reference:</span>
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {data.order.customer_reference}
                  </span>
                </div>
              )}
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500">
                Created: {new Date(data.order.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Created by: <span className="font-medium text-slate-700">{data.order.created_by_name}</span>
              </div>
            </div>
          </div>

          {/* Cancellation Notice if Cancelled */}
          {data.order.status === 'cancelled' && (
            <Notice variant="error" title="Order Cancelled">
              Cancelled on{' '}
              {data.order.cancelled_at
                ? new Date(data.order.cancelled_at).toLocaleString()
                : 'N/A'}{' '}
              by {data.order.cancelled_by_name || 'Staff'}.<br />
              <span className="font-semibold">Reason:</span> {data.order.cancellation_reason || 'No reason provided'}
            </Notice>
          )}

          {/* 2-Column Info: Consignee & Financials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Consignee Card */}
            <div className="border border-slate-200 rounded-lg p-4 bg-white">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Consignee & Delivery Destination</span>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">{data.order.consignee_name}</div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono font-medium">{data.order.consignee_phone}</span>
                  <button
                    onClick={() => handleCopyPhone(data.order.consignee_phone)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                    title="Copy phone number"
                  >
                    {copiedPhone ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>

                {data.order.consignee_email && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{data.order.consignee_email}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-500 font-medium">Delivery Address:</div>
                  <div className="text-xs text-slate-800 mt-0.5 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">
                    {data.order.shipping_address}
                  </div>
                  <div className="text-xs font-semibold text-slate-700 mt-1">
                    {data.order.city}
                    {data.order.province ? `, ${data.order.province}` : ''}
                    {data.order.postal_code ? ` - ${data.order.postal_code}` : ''}
                  </div>
                </div>

                {data.order.shipping_notes && (
                  <div className="pt-2 border-t border-slate-100 text-xs">
                    <span className="font-semibold text-slate-600">Shipping Notes:</span>
                    <p className="italic text-slate-500 mt-0.5">{data.order.shipping_notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Merchant & Financial Card */}
            <div className="border border-slate-200 rounded-lg p-4 bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  <Banknote className="w-3.5 h-3.5 text-slate-400" />
                  <span>Merchant & Financial Terms</span>
                </div>

                <div className="space-y-3">
                  {data.customer && (
                    <div>
                      <div className="text-xs text-slate-500">Merchant Account:</div>
                      <div className="text-sm font-bold text-slate-800">{data.customer.brand_name || data.customer.business_name}</div>
                      <div className="text-xs text-slate-500">{data.customer.city} · {data.customer.phone}</div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-500">Payment Method:</div>
                      <div className="text-xs font-bold text-slate-800 uppercase mt-0.5">
                        {data.order.payment_method === 'cod' ? 'Cash on Delivery (COD)' : 'Prepaid'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">COD Collection:</div>
                      <div className="text-sm font-bold font-mono text-emerald-800 mt-0.5">
                        PKR {data.order.cod_amount.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Total Declared Item Value:</span>
                      <span className="font-semibold font-mono text-slate-800">
                        PKR {data.order.declared_total_value.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirmation audit stamp */}
              {data.order.confirmed_at && (
                <div className="mt-4 pt-3 border-t border-slate-100 bg-emerald-50/50 p-2.5 rounded text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Confirmed on:</span>{' '}
                    {new Date(data.order.confirmed_at).toLocaleString()}
                    <div className="text-[11px] text-emerald-700">
                      Confirmed by {data.order.confirmed_by_name || 'Authorized Staff'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Ordered Line Items ({data.items.length})
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-600">
                Total Pieces: {data.items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/50">
                    <th className="py-2.5 px-4">SKU / Item</th>
                    <th className="py-2.5 px-4 text-center">Ordered Qty</th>
                    <th className="py-2.5 px-4 text-right">Unit Value</th>
                    <th className="py-2.5 px-4 text-right">Line Total</th>
                    <th className="py-2.5 px-4 text-center">Warehouse Availability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {data.items.map((item) => {
                    const available = item.stock_summary?.inStorage ?? 0;
                    const isSufficient = available >= item.quantity;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900">{item.sku}</div>
                          <div className="text-slate-600 text-[11px]">{item.product_name}</div>
                          {item.category && (
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                              {item.category}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          PKR {item.unit_price.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          PKR {item.total_price.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isSufficient ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {available} In Storage
                            </span>
                          ) : available > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Only {available} Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              0 In Storage
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cancellation Prompt Modal */}
          {showCancelPrompt && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Confirm Order Cancellation</span>
              </div>
              <p className="text-xs text-rose-700">
                Please provide an audit cancellation reason. This will cancel the order and release any reserved stock.
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (e.g. Customer requested cancellation, duplicate order)..."
                rows={2}
                className="w-full text-xs p-2.5 border border-rose-300 rounded focus:ring-1 focus:ring-rose-500 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelPrompt(false)}
                  disabled={actionLoading}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCancel}
                  disabled={actionLoading || !cancelReason.trim()}
                  className="bg-rose-700 hover:bg-rose-800 text-white"
                >
                  {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </Button>
              </div>
            </div>
          )}

          {showTrackingModal && data && (
            <OrderTrackingModal
              orderIdentifier={data.order.order_number}
              isOpen={true}
              onClose={() => setShowTrackingModal(false)}
              canAddEvent={isAdmin || user.permissions.includes('manifests.dispatch')}
            />
          )}
        </div>
      ) : null}
    </Modal>
  );
};
