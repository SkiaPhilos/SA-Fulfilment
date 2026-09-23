import React, { useState, useEffect } from 'react';
import {
  api,
  UserSession,
  CustomerProfile,
  Warehouse,
  EnrichedProduct,
  ReceivingBatch
} from '../../lib/api';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import {
  Inbox,
  X,
  Plus,
  Trash2,
  Tag,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Printer
} from 'lucide-react';

interface StockReceivingModalProps {
  user: UserSession;
  onClose: () => void;
  onStockingRequested?: (batchId: string) => void;
  onPrintRequested?: (batchId: string) => void;
  onSuccess: () => void;
}

interface ItemLine {
  productId: string;
  quantity: string;
  condition: 'good' | 'damaged';
  notes: string;
}

export const StockReceivingModal: React.FC<StockReceivingModalProps> = ({
  user,
  onClose,
  onStockingRequested,
  onPrintRequested,
  onSuccess
}) => {
  const isCustomer = user.account_type === 'customer';

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    user.customer_profile?.id || ''
  );
  const [carrier, setCarrier] = useState('');
  const [trackingReference, setTrackingReference] = useState('');

  const [availableProducts, setAvailableProducts] = useState<EnrichedProduct[]>([]);
  const [lines, setLines] = useState<ItemLine[]>([
    { productId: '', quantity: '10', condition: 'good', notes: '' }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedBatch, setCompletedBatch] = useState<ReceivingBatch | null>(null);
  const [unitsCreatedCount, setUnitsCreatedCount] = useState(0);

  // Load warehouses & customers
  useEffect(() => {
    api.getWarehouses()
      .then((res) => {
        const active = res.warehouses.filter((w) => w.status === 'active');
        setWarehouses(active);
        if (active.length > 0) setSelectedWarehouseId(active[0].id);
      })
      .catch((err) => console.error('Failed to load warehouses:', err));

    if (!isCustomer) {
      api.getCustomers()
        .then((res) => {
          const approved = res.customers
            .map((c) => c.profile)
            .filter((p): p is CustomerProfile => Boolean(p && p.approval_status === 'approved'));
          setCustomers(approved);
          if (approved.length > 0 && !selectedCustomerId) {
            setSelectedCustomerId(approved[0].id);
          }
        })
        .catch((err) => console.error('Failed to load customers:', err));
    }
  }, [isCustomer]);

  // Load products for the selected customer
  useEffect(() => {
    const custId = isCustomer ? user.customer_profile?.id : selectedCustomerId;
    if (custId) {
      api.getProducts({ customerId: custId, status: 'active' })
        .then((res) => {
          setAvailableProducts(res.products);
          // Set default product for empty lines if available
          if (res.products.length > 0) {
            setLines((prev) =>
              prev.map((l) => (l.productId ? l : { ...l, productId: res.products[0].id }))
            );
          }
        })
        .catch((err) => console.error('Failed to load products for customer:', err));
    }
  }, [selectedCustomerId, isCustomer, user.customer_profile]);

  const addLine = () => {
    const defaultProdId = availableProducts.length > 0 ? availableProducts[0].id : '';
    setLines([...lines, { productId: defaultProdId, quantity: '10', condition: 'good', notes: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof ItemLine, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const totalCalculatedUnits = lines.reduce(
    (acc, l) => acc + (parseInt(l.quantity, 10) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const custId = isCustomer ? user.customer_profile?.id : selectedCustomerId;
    if (!selectedWarehouseId) {
      setError('Please select a receiving warehouse facility.');
      return;
    }
    if (!custId) {
      setError('Please select an active merchant.');
      return;
    }
    if (lines.length === 0 || totalCalculatedUnits <= 0) {
      setError('Please specify at least one valid line item with quantity > 0.');
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].productId) {
        setError(`Line #${i + 1} has no product SKU selected.`);
        return;
      }
      const qty = parseInt(lines[i].quantity, 10);
      if (!qty || qty <= 0) {
        setError(`Line #${i + 1} quantity must be a positive integer.`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await api.receiveStock({
        warehouseId: selectedWarehouseId,
        customerId: custId,
        carrier: carrier.trim() || undefined,
        trackingReference: trackingReference.trim() || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: parseInt(l.quantity, 10),
          condition: l.condition,
          notes: l.notes.trim() || undefined
        }))
      });

      setCompletedBatch(res.batch);
      setUnitsCreatedCount(res.unitsCreated);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to complete stock receiving.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl my-6 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-2xs">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Stock Receiving & Unit Intake</h2>
              <p className="text-xs text-slate-500">
                Receive physical freight shipment and generate unique unit tracking IDs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Screen after receiving */}
        {completedBatch ? (
          <div className="p-8 text-center space-y-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Batch {completedBatch.batch_number} Received!
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                Authoritatively generated <strong className="text-slate-900">{unitsCreatedCount}</strong> physical
                inventory units. All units are currently in <span className="font-mono font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">awaiting_stocking</span> state awaiting scan-to-place putaway.
              </p>
            </div>

            {/* Direct next actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onPrintRequested) onPrintRequested(completedBatch.id);
                }}
                className="flex items-center justify-center gap-2.5 p-3.5 rounded-lg border-2 border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 transition-colors text-xs font-semibold"
              >
                <Printer className="w-4 h-4 text-emerald-700" />
                <span>Print Barcode Labels</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onStockingRequested) onStockingRequested(completedBatch.id);
                }}
                className="flex items-center justify-center gap-2.5 p-3.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors text-xs font-semibold shadow-2xs"
              >
                <Boxes className="w-4 h-4" />
                <span>Start Putaway Session</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={onClose}>
                Done & Return to Catalog
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <Notice variant="error" title="Intake Error">
                {error}
              </Notice>
            )}

            {/* Logistics Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Destination Warehouse */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Warehouse <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 bg-white text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  required
                >
                  {warehouses.length === 0 && <option value="">No active warehouses found</option>}
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code}) — {w.city}
                    </option>
                  ))}
                </select>
              </div>

              {/* Merchant Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Merchant Account <span className="text-rose-500">*</span>
                </label>
                {!isCustomer ? (
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-slate-300 bg-white text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                    required
                  >
                    {customers.length === 0 && <option value="">No approved merchants</option>}
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.brand_name} ({c.business_name})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="h-9 px-3 rounded-md border border-slate-200 bg-slate-50 flex items-center text-xs font-medium text-slate-800">
                    {user.customer_profile?.brand_name}
                  </div>
                )}
              </div>
            </div>

            {/* Carrier & Tracking */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Carrier / Delivery Vehicle
                </label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g. In-house Van, TCS, Leopards, Vendor Drop-off"
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Carrier Tracking / Bilty / Ref #
                </label>
                <input
                  type="text"
                  value={trackingReference}
                  onChange={(e) => setTrackingReference(e.target.value)}
                  placeholder="e.g. BLTY-89412-ISB"
                  className="w-full h-9 px-3 rounded-md border border-slate-300 font-mono text-xs text-slate-900"
                />
              </div>
            </div>

            {/* SKU Lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Shipment Line Items
                </span>
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another SKU</span>
                </button>
              </div>

              {availableProducts.length === 0 ? (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                  No registered SKUs found for this merchant. Please register products in the SKU catalog before receiving stock.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                  {lines.map((line, idx) => (
                    <div key={idx} className="p-3 bg-white flex flex-col md:flex-row items-center gap-3">
                      {/* Product Selector */}
                      <div className="flex-1 w-full">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">
                          SKU / Item
                        </label>
                        <select
                          value={line.productId}
                          onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                          className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs text-slate-800 font-mono"
                          required
                        >
                          {availableProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} — {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="w-28 shrink-0">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                          className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs font-mono text-slate-900"
                          required
                        />
                      </div>

                      {/* Condition */}
                      <div className="w-32 shrink-0">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-0.5">
                          Condition
                        </label>
                        <select
                          value={line.condition}
                          onChange={(e) => updateLine(idx, 'condition', e.target.value as any)}
                          className="w-full h-8 px-2 rounded border border-slate-300 text-xs text-slate-800"
                        >
                          <option value="good">Good (Intact)</option>
                          <option value="damaged">Damaged in Transit</option>
                        </select>
                      </div>

                      {/* Delete action */}
                      <div className="pt-3 md:pt-4">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          disabled={lines.length === 1}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded disabled:opacity-20"
                          title="Remove Line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Intake Units Summary Bar */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Total Physical Units To Generate:</span>
              <span className="font-bold text-sm font-mono text-emerald-800">
                {totalCalculatedUnits} Individual Units
              </span>
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={availableProducts.length === 0 || totalCalculatedUnits === 0}
              >
                Register Intake & Generate Codes
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
