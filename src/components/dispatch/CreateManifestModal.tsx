import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { X, Truck, Calendar, User, Phone, FileText } from 'lucide-react';

interface CreateManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    carrierName: string;
    driverName?: string;
    driverPhone?: string;
    vehicleNumber?: string;
    handoverNotes?: string;
    orderIds: string[];
  }) => Promise<void>;
  packedOrders: Array<{
    id: string;
    order_number: string;
    customer_brand: string;
    consignee_name: string;
    city: string;
    cod_amount: number;
    payment_method: 'cod' | 'prepaid';
  }>;
}

const CARRIERS = [
  'TCS Express',
  'Leopard Courier',
  'Trax Logistics',
  'M&P Logistics',
  'Call Courier',
  'PostEx',
  'Rider Logistics',
  'Pakistan Post EMS',
  'In-House Courier Fleet'
];

export const CreateManifestModal: React.FC<CreateManifestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  packedOrders
}) => {
  const [carrierName, setCarrierName] = useState(CARRIERS[0]);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(packedOrders.map(o => o.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleOrder = (id: string) => {
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(selectedOrderIds.filter(i => i !== id));
    } else {
      setSelectedOrderIds([...selectedOrderIds, id]);
    }
  };

  const toggleAll = () => {
    if (selectedOrderIds.length === packedOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(packedOrders.map(o => o.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrierName.trim()) {
      setError('Please select or specify a carrier.');
      return;
    }
    if (selectedOrderIds.length === 0) {
      setError('Please select at least one packed order to include in the handover manifest.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        carrierName,
        driverName: driverName.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        vehicleNumber: vehicleNumber.trim() || undefined,
        handoverNotes: handoverNotes.trim() || undefined,
        orderIds: selectedOrderIds
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to generate manifest.');
    } finally {
      setLoading(false);
    }
  };

  const selectedOrders = packedOrders.filter(o => selectedOrderIds.includes(o.id));
  const totalCod = selectedOrders.reduce((sum, o) => sum + (o.payment_method === 'cod' ? o.cod_amount : 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Create Carrier Handover Manifest</h2>
              <p className="text-xs text-slate-500">
                Generate an official run-sheet voucher for third-party courier dispatch
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Courier / Carrier Name *
              </label>
              <select
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                required
              >
                {CARRIERS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Driver / Courier Rider Name
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. Muhammad Aslam"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Driver Contact Phone
              </label>
              <input
                type="text"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="0300-1234567"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vehicle Registration Number
              </label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="e.g. LEA-2024 / Van #4"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Handover Remarks / Seal Numbers
            </label>
            <textarea
              rows={2}
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              placeholder="e.g. Courier bag seal #99214 intact. Handover completed at Bay 3."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Packed Orders Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900">
                Select Packed Orders ({selectedOrderIds.length}/{packedOrders.length})
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-emerald-700 font-semibold hover:underline"
              >
                {selectedOrderIds.length === packedOrders.length ? 'Deselect All Orders' : 'Select All Orders'}
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
              {packedOrders.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  No orders currently in packed state available for dispatch.
                </div>
              ) : (
                packedOrders.map((ord) => (
                  <label
                    key={ord.id}
                    className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(ord.id)}
                      onChange={() => toggleOrder(ord.id)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-slate-900">{ord.order_number}</span>
                        <span className="text-slate-500 text-[11px] ml-2">({ord.customer_brand})</span>
                        <div className="text-[11px] text-slate-600 truncate">
                          {ord.consignee_name} • {ord.city}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-700">
                          {ord.payment_method === 'cod' ? `PKR ${ord.cod_amount.toLocaleString()}` : 'Prepaid'}
                        </span>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex justify-between items-center text-xs">
            <span className="text-emerald-900 font-medium">
              Consignment: <strong>{selectedOrderIds.length}</strong> orders
            </span>
            <span className="font-bold text-emerald-950 font-mono">
              Total COD Remittance: PKR {totalCod.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={loading || selectedOrderIds.length === 0}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              {loading ? 'Creating...' : 'Create Handover Manifest'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
