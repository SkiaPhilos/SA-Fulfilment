import React, { useState, useEffect } from 'react';
import { api, BillingRateCard } from '../../lib/api';
import { Button } from '../ui/Button';
import {
  CreditCard,
  Edit2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Save,
  X,
  TrendingDown
} from 'lucide-react';

interface BillingRateCardsViewProps {
  canManage: boolean;
}

export const BillingRateCardsView: React.FC<BillingRateCardsViewProps> = ({ canManage }) => {
  const [rateCards, setRateCards] = useState<BillingRateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<BillingRateCard | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchRateCards = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getBillingRateCards();
      setRateCards(res.rateCards);
    } catch (err: any) {
      setError(err.message || 'Failed to load rate cards.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRateCards();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;

    try {
      setSaveLoading(true);
      await api.updateBillingRateCard(editingCard.id, {
        name: editingCard.name,
        base_courier_fee: editingCard.base_courier_fee,
        per_kg_fee: editingCard.per_kg_fee,
        pick_pack_fee_per_unit: editingCard.pick_pack_fee_per_unit,
        daily_storage_fee_per_cbm: editingCard.daily_storage_fee_per_cbm,
        return_processing_fee: editingCard.return_processing_fee,
        is_active: editingCard.is_active
      });
      setEditingCard(null);
      await fetchRateCards();
    } catch (err: any) {
      alert(err.message || 'Failed to update rate card.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Automated Fulfillment & Courier Tariff Rate Cards
          </h2>
          <p className="text-xs text-slate-500">
            Transparent fee engine for domestic courier delivery, pick/pack handling, and reverse logistics
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          Loading rate cards...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rateCards.map((card) => (
            <div
              key={card.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{card.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        card.is_active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {card.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {card.customer_id ? 'Client-Specific Custom Tariff' : 'Global Default Master Tariff'}
                  </div>
                </div>

                {canManage && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingCard({ ...card })}
                    className="text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Configure
                  </Button>
                )}
              </div>

              <div className="p-5 flex-1 divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">Domestic Base Courier Delivery</span>
                    <p className="text-[10px] text-slate-500">Standard domestic express parcel dispatch fee</p>
                  </div>
                  <span className="font-bold font-mono text-slate-900 text-sm">
                    PKR {card.base_courier_fee.toFixed(2)}
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">Additional Weight Rate</span>
                    <p className="text-[10px] text-slate-500">Applied per kg beyond standard initial threshold</p>
                  </div>
                  <span className="font-bold font-mono text-slate-900">
                    PKR {card.per_kg_fee.toFixed(2)} / kg
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">Pick, Pack & Barcode Verification</span>
                    <p className="text-[10px] text-slate-500">Physical unit pick-path, scan check, and packaging</p>
                  </div>
                  <span className="font-bold font-mono text-slate-900">
                    PKR {card.pick_pack_fee_per_unit.toFixed(2)} / unit
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">Reverse Logistics (RTO) Inspection</span>
                    <p className="text-[10px] text-slate-500">Physical return check, seal QC and shelf restocking</p>
                  </div>
                  <span className="font-bold font-mono text-slate-900">
                    PKR {card.return_processing_fee.toFixed(2)} / order
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">Daily Warehouse Volume Storage</span>
                    <p className="text-[10px] text-slate-500">Per cubic meter (CBM) allocated storage space</p>
                  </div>
                  <span className="font-bold font-mono text-slate-900">
                    PKR {card.daily_storage_fee_per_cbm.toFixed(2)} / m³ / day
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                <span>Auto-deducted directly from merchant wallet balance upon handover</span>
                <span>Rate ID: {card.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Edit Tariff Rate Card</h3>
              <button
                onClick={() => setEditingCard(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rate Card Title</label>
                <input
                  type="text"
                  value={editingCard.name}
                  onChange={(e) => setEditingCard({ ...editingCard, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Base Courier Fee (PKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCard.base_courier_fee}
                    onChange={(e) =>
                      setEditingCard({ ...editingCard, base_courier_fee: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pick/Pack Fee per Unit (PKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCard.pick_pack_fee_per_unit}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        pick_pack_fee_per_unit: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Additional Per-Kg Rate (PKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCard.per_kg_fee}
                    onChange={(e) =>
                      setEditingCard({ ...editingCard, per_kg_fee: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    RTO Inspection Fee (PKR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCard.return_processing_fee}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        return_processing_fee: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={editingCard.is_active}
                    onChange={(e) => setEditingCard({ ...editingCard, is_active: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">Tariff is Active & Enforced</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <Button variant="secondary" size="sm" type="button" onClick={() => setEditingCard(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={saveLoading}
                  className="bg-emerald-700 hover:bg-emerald-800"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {saveLoading ? 'Saving...' : 'Save Tariff Rates'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
