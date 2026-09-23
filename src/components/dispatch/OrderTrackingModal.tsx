import React, { useEffect, useState } from 'react';
import { api, OrderTrackingHistory, OrderTrackingStatus } from '../../lib/api';
import { Button } from '../ui/Button';
import {
  X,
  MapPin,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  PlusCircle,
  ExternalLink
} from 'lucide-react';

interface OrderTrackingModalProps {
  orderIdentifier: string;
  isOpen: boolean;
  onClose: () => void;
  canAddEvent?: boolean;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  placed: <Package className="w-4 h-4 text-slate-500" />,
  confirmed: <CheckCircle2 className="w-4 h-4 text-blue-500" />,
  to_fulfill: <Package className="w-4 h-4 text-amber-500" />,
  picked: <Package className="w-4 h-4 text-indigo-500" />,
  packed: <Package className="w-4 h-4 text-purple-500" />,
  dispatched: <Truck className="w-4 h-4 text-emerald-600" />,
  in_transit: <Truck className="w-4 h-4 text-blue-600" />,
  out_for_delivery: <Truck className="w-4 h-4 text-amber-600" />,
  delivered: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  undelivered_attempt: <AlertTriangle className="w-4 h-4 text-rose-500" />,
  rto_in_transit: <RotateCcw className="w-4 h-4 text-rose-500" />,
  returned_to_warehouse: <RotateCcw className="w-4 h-4 text-rose-700" />,
  cancelled: <AlertTriangle className="w-4 h-4 text-slate-400" />
};

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  orderIdentifier,
  isOpen,
  onClose,
  canAddEvent
}) => {
  const [data, setData] = useState<OrderTrackingHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Event Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderTrackingStatus>('in_transit');
  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [postingEvent, setPostingEvent] = useState(false);

  const fetchTracking = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getOrderTracking(orderIdentifier);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load tracking data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderIdentifier) {
      fetchTracking();
    }
  }, [isOpen, orderIdentifier]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.trim() || !newDescription.trim()) return;

    try {
      setPostingEvent(true);
      await api.addTrackingEvent({
        orderId: data!.order.id,
        status: newStatus,
        location: newLocation.trim(),
        description: newDescription.trim()
      });
      setShowAddForm(false);
      setNewLocation('');
      setNewDescription('');
      await fetchTracking();
    } catch (err: any) {
      alert(err.message || 'Failed to add tracking event.');
    } finally {
      setPostingEvent(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Consignment Live Tracking & Audit Trail
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                {data?.order.order_number || orderIdentifier}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canAddEvent && !showAddForm && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddForm(true)}
                className="text-xs"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                Add Checkpoint
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-12 text-center text-xs text-slate-500">
              Retrieving carrier tracking events...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Order Meta Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Consignee</span>
                  <div className="font-semibold text-slate-900">{data.order.consignee_name}</div>
                  <div className="text-slate-500 text-[11px] truncate">{data.order.city}</div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Merchant</span>
                  <div className="font-semibold text-slate-900">{data.order.customer_brand}</div>
                  <div className="text-slate-500 text-[11px]">
                    Ext Ref: {data.order.customer_reference || '-'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Payment</span>
                  <div className="font-semibold text-slate-900 uppercase">
                    {data.order.payment_method}
                  </div>
                  <div className="text-emerald-700 font-mono font-bold text-[11px]">
                    {data.order.payment_method === 'cod'
                      ? `PKR ${data.order.cod_amount.toLocaleString()}`
                      : 'PAID'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Current State</span>
                  <div className="font-semibold capitalize text-emerald-800">
                    {data.order.status.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              {/* Add Checkpoint Form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddEvent}
                  className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-950">Add Physical Checkpoint Scan</span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-blue-600 hover:underline text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Checkpoint Status
                      </label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as OrderTrackingStatus)}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="in_transit">In Transit (Hub-to-Hub)</option>
                        <option value="out_for_delivery">Out for Delivery (Rider Dispatched)</option>
                        <option value="delivered">Delivered Successfully</option>
                        <option value="undelivered_attempt">Undelivered Attempt (Customer Unreachable)</option>
                        <option value="rto_in_transit">RTO In Transit (Returning)</option>
                        <option value="returned_to_warehouse">Returned to Hub</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Scan Location / City Hub
                      </label>
                      <input
                        type="text"
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        placeholder="e.g. Rawalpindi Regional Gateway"
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Event Description / Remark
                    </label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="e.g. Arrived at distribution facility. Bag seal verified."
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      type="submit"
                      disabled={postingEvent}
                      className="bg-blue-700 hover:bg-blue-800"
                    >
                      {postingEvent ? 'Recording...' : 'Commit Event'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Timeline Tree */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-4">
                  Consignment Milestone History ({data.timeline.length} events)
                </h3>

                <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
                  {data.timeline.map((evt, idx) => {
                    const isLatest = idx === data.timeline.length - 1;
                    return (
                      <div key={evt.id || idx} className="relative pl-6">
                        {/* Dot */}
                        <div
                          className={`absolute -left-[9px] top-0.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                            isLatest
                              ? 'border-emerald-600 text-emerald-600 ring-4 ring-emerald-50'
                              : 'border-slate-300 text-slate-400'
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              isLatest ? 'bg-emerald-600' : 'bg-slate-300'
                            }`}
                          />
                        </div>

                        {/* Event Details */}
                        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:border-slate-300 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="p-1 rounded-md bg-slate-100">
                                {STATUS_ICONS[evt.status] || <Package className="w-4 h-4" />}
                              </span>
                              <span className="font-bold text-slate-900 capitalize text-xs">
                                {evt.status.replace(/_/g, ' ')}
                              </span>
                            </div>

                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(evt.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600 mb-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{evt.location}</span>
                          </div>

                          <p className="text-xs text-slate-700">{evt.description}</p>

                          {evt.actor_name && (
                            <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                              Logged by: {evt.actor_name}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
