import React, { useState, useEffect } from 'react';
import { api, UserSession, CustomerProfile } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Notice } from '../ui/Notice';
import { Package, X, AlertCircle, Sparkles } from 'lucide-react';

interface ProductCreateModalProps {
  user: UserSession;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  'General Merchandise',
  'Apparel & Fashion',
  'Health & Beauty',
  'Consumer Electronics',
  'Home & Kitchen',
  'Personal Care',
  'Food & Beverages',
  'Footwear & Bags',
  'Books & Stationery'
];

export const ProductCreateModal: React.FC<ProductCreateModalProps> = ({
  user,
  onClose,
  onSuccess
}) => {
  const isCustomer = user.account_type === 'customer';

  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    user.customer_profile?.id || ''
  );
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General Merchandise');
  const [description, setDescription] = useState('');
  const [barcode, setBarcode] = useState('');
  const [lengthCm, setLengthCm] = useState('15');
  const [widthCm, setWidthCm] = useState('10');
  const [heightCm, setHeightCm] = useState('5');
  const [weightKg, setWeightKg] = useState('0.5');
  const [declaredValue, setDeclaredValue] = useState('1500');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        .catch((err) => {
          console.error('Failed to load customers for product creation:', err);
        });
    }
  }, [isCustomer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanSku = sku.trim().toUpperCase();
    if (!cleanSku || cleanSku.length < 2) {
      setError('SKU is required and must be at least 2 characters.');
      return;
    }

    if (!name.trim()) {
      setError('Product title / name is required.');
      return;
    }

    const targetCustomer = isCustomer ? user.customer_profile?.id : selectedCustomerId;
    if (!targetCustomer) {
      setError('Please select an approved merchant for this product.');
      return;
    }

    setLoading(true);
    try {
      await api.createProduct({
        customerId: targetCustomer,
        sku: cleanSku,
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        barcode: barcode.trim() || undefined,
        dimensions: {
          length_cm: parseFloat(lengthCm) || 0,
          width_cm: parseFloat(widthCm) || 0,
          height_cm: parseFloat(heightCm) || 0
        },
        weight_kg: parseFloat(weightKg) || 0,
        declared_value: parseFloat(declaredValue) || 0,
        low_stock_threshold: parseInt(lowStockThreshold, 10) || 10
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-2xs">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Register Product / SKU</h2>
              <p className="text-xs text-slate-500">Add an authoritative SKU item into the merchant catalog</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <Notice variant="error" title="Validation Failed">
              {error}
            </Notice>
          )}

          {/* Merchant Assignment */}
          {!isCustomer ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Merchant / Customer Account <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-300 bg-white text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                required
              >
                {customers.length === 0 && <option value="">No approved merchants available</option>}
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.brand_name} ({c.business_name}) — NTN/CNIC: {c.cnic_or_ntn}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 text-xs text-emerald-900 flex items-center justify-between">
              <div>
                <span className="font-semibold">Merchant:</span> {user.customer_profile?.brand_name}
              </div>
              <span className="text-[11px] text-emerald-700 font-mono">Scoped to your account</span>
            </div>
          )}

          {/* SKU & Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stock Keeping Unit (SKU) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="e.g. SA-SHIRT-BLK-L"
                className="w-full h-9 px-3 rounded-md border border-slate-300 font-mono uppercase text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">Unique internal stock code for barcode identification.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Title / Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Classic Oxford Cotton Shirt - Black / L"
                className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                required
              />
            </div>
          </div>

          {/* Category & Manufacturer Barcode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-300 bg-white text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer Barcode (UPC / EAN)</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="e.g. 8964000123456"
                className="w-full h-9 px-3 rounded-md border border-slate-300 font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Handling Notes</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Packaging details, fragile handling, or color/size variations..."
              className="w-full p-2.5 rounded-md border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
            />
          </div>

          {/* Dimensions & Weight */}
          <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-2.5">
              Physical Dimensions & Weight (for volumetric capacity calculations)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Length (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={lengthCm}
                  onChange={(e) => setLengthCm(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Width (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Height (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Declared Value & Low Stock Threshold */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Declared Value (PKR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">Rs.</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={declaredValue}
                  onChange={(e) => setDeclaredValue(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-md border border-slate-300 text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Used for transit insurance and inventory valuation.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Low Stock Threshold (Units)
              </label>
              <input
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
              />
              <p className="text-[11px] text-slate-400 mt-1">Triggers low inventory operational warning flags.</p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              Register SKU
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
