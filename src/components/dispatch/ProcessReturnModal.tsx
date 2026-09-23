import React, { useState, useEffect } from 'react';
import { api, ReturnOrder } from '../../lib/api';
import { Button } from '../ui/Button';
import {
  X,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Archive,
  ArrowRight
} from 'lucide-react';

interface ReturnLocationOption {
  id: string;
  name: string;
  code: string;
  type: string;
  path?: string;
}

interface ProcessReturnModalProps {
  orderId?: string;
  orderNumber?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (returnOrder: ReturnOrder) => void;
}

export const ProcessReturnModal: React.FC<ProcessReturnModalProps> = ({
  orderId,
  orderNumber,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [orderQuery, setOrderQuery] = useState(orderNumber || orderId || '');
  const [returnType, setReturnType] = useState<'rto_courier' | 'customer_return'>('rto_courier');
  const [returnReason, setReturnReason] = useState('Customer refused delivery at doorstep');
  const [trackingReference, setTrackingReference] = useState('');
  const [disposition, setDisposition] = useState<'restocked' | 'damaged_quarantine' | 'merchant_claim' | 'scrapped'>('restocked');
  const [targetLocationId, setTargetLocationId] = useState('');
  const [conditionNotes, setConditionNotes] = useState('Packaging intact, factory seals unbroken, product inspected.');

  const [locations, setLocations] = useState<ReturnLocationOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (orderNumber || orderId) {
        setOrderQuery(orderNumber || orderId || '');
      }
      loadLocations();
    }
  }, [isOpen, orderNumber, orderId]);

  const loadLocations = async () => {
    try {
      setLoadingLocations(true);
      const res = await api.getWarehouses();
      if (res.warehouses.length > 0) {
        const whId = res.warehouses[0].id;
        const treeRes = await api.getWarehouseTree(whId);

        // Flatten tree to find bins and shelves
        const flatLocations: ReturnLocationOption[] = [];
        const traverse = (nodes: any[]) => {
          for (const node of nodes) {
            flatLocations.push({
              id: node.id,
              name: node.name,
              code: node.code,
              type: node.type,
              path: node.path
            });
            if (node.children && node.children.length > 0) {
              traverse(node.children);
            }
          }
        };
        traverse(treeRes.tree);

        // Filter for bin/shelf locations
        const bins = flatLocations.filter(l => l.type === 'bin' || l.type === 'shelf');
        const finalLocs = bins.length > 0 ? bins : flatLocations;
        setLocations(finalLocs);
        if (finalLocs.length > 0 && !targetLocationId) {
          setTargetLocationId(finalLocs[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load warehouse locations:', e);
    } finally {
      setLoadingLocations(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderQuery.trim()) {
      setError('Please provide an order number or ID.');
      return;
    }
    if (disposition === 'restocked' && !targetLocationId) {
      setError('Please select a storage bin location to restock the returned items into.');
      return;
    }
    if (!conditionNotes.trim()) {
      setError('Condition notes are required for quality inspection audit.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await api.processReturn({
        orderId: orderQuery.trim(),
        returnType,
        returnReason: returnReason.trim(),
        trackingReference: trackingReference.trim() || undefined,
        disposition,
        targetLocationId: disposition === 'restocked' ? targetLocationId : undefined,
        conditionNotes: conditionNotes.trim()
      });

      onSuccess(res.result.returnOrder);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process return.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-sm">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Reverse Logistics: Receive & Inspect Return
              </h2>
              <p className="text-xs text-slate-500">
                Process RTO courier bounce or customer RMA with atomic stock reconciliation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Order Number or Order ID *
              </label>
              <input
                type="text"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="e.g. ORD-202609-0001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Return Type *
              </label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-rose-500"
              >
                <option value="rto_courier">RTO Courier Bounce (Undelivered / Refused)</option>
                <option value="customer_return">Customer Reverse RMA Return</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Primary Reason *
              </label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g. Customer refused delivery / Consignee phone switched off"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Courier Reverse Tracking Number
              </label>
              <input
                type="text"
                value={trackingReference}
                onChange={(e) => setTrackingReference(e.target.value)}
                placeholder="e.g. TCS-RTN-991208"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Disposition Decision Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <label className="block font-bold text-slate-900">
              Quality Inspection & Disposition Outcome *
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  disposition === 'restocked'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-bold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="disposition"
                  value="restocked"
                  checked={disposition === 'restocked'}
                  onChange={() => setDisposition('restocked')}
                  className="mt-0.5 text-emerald-600"
                />
                <div>
                  <div className="font-semibold text-xs">Restock into Inventory</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Item good condition, returns immediately to saleable available stock.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  disposition === 'damaged_quarantine'
                    ? 'border-rose-500 bg-rose-50/70 text-rose-950 font-bold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="disposition"
                  value="damaged_quarantine"
                  checked={disposition === 'damaged_quarantine'}
                  onChange={() => setDisposition('damaged_quarantine')}
                  className="mt-0.5 text-rose-600"
                />
                <div>
                  <div className="font-semibold text-xs">Damaged Quarantine</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Transit damage or broken seal. Excluded from saleable stock.
                  </div>
                </div>
              </label>
            </div>

            {disposition === 'restocked' && (
              <div className="pt-2 border-t border-slate-200">
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Restock Warehouse Location / Bin *
                </label>
                <select
                  value={targetLocationId}
                  onChange={(e) => setTargetLocationId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code}) - {loc.path || 'Warehouse Bay'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Inspection Findings & Seal Condition Notes *
            </label>
            <textarea
              rows={2}
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              placeholder="e.g. Outer cardboard box unopened, sealed, no defects found. Restocked into bin B01."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
              required
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
            <span className="font-bold">Automated Reversal & Billing:</span> Units are unlinked from the
            order and restored to saleable inventory or quarantined. A reverse logistics inspection fee (PKR 40) is posted to customer wallet.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={submitting}
              className="bg-rose-700 hover:bg-rose-800"
            >
              {submitting ? 'Processing...' : 'Complete Reverse Inspection'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
