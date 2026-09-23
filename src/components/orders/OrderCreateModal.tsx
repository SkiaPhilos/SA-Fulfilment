import React, { useState, useEffect } from 'react';
import { api, EnrichedProduct, CustomerProfile, UserSession } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Notice } from '../ui/Notice';
import {
  PackagePlus,
  Plus,
  Trash2,
  Boxes,
  MapPin,
  Banknote,
  AlertCircle,
  CheckCircle2,
  Building2
} from 'lucide-react';

interface OrderCreateModalProps {
  user: UserSession;
  onClose: () => void;
  onSuccess: (orderNumber: string) => void;
}

interface OrderItemState {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  availableStock: number;
}

const COMMON_PAKISTAN_CITIES = [
  'Islamabad',
  'Rawalpindi',
  'Lahore',
  'Karachi',
  'Peshawar',
  'Faisalabad',
  'Multan',
  'Gujranwala',
  'Sialkot',
  'Quetta',
  'Hyderabad',
  'Abbottabad',
  'Bahawalpur',
  'Sargodha',
  'Gujrat',
  'Mardan',
  'Sukkur'
];

export const OrderCreateModal: React.FC<OrderCreateModalProps> = ({
  user,
  onClose,
  onSuccess
}) => {
  const isCustomer = user.account_type === 'customer';
  const isAdmin = user.role_id === 'role_administrator';
  const canConfirm = isAdmin || user.permissions.includes('orders.confirm');

  // Customer selection (for staff)
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Products catalog for selected customer
  const [products, setProducts] = useState<EnrichedProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Consignee fields
  const [consigneeName, setConsigneeName] = useState('');
  const [consigneePhone, setConsigneePhone] = useState('');
  const [consigneeEmail, setConsigneeEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [city, setCity] = useState('Islamabad');
  const [customCity, setCustomCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Financial & Order Reference
  const [customerReference, setCustomerReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'prepaid'>('cod');
  const [codAmount, setCodAmount] = useState<string>('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [autoConfirm, setAutoConfirm] = useState(false);

  // Line Items
  const [items, setItems] = useState<OrderItemState[]>([]);

  // State & Loading
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load customer list if staff
  useEffect(() => {
    if (!isCustomer) {
      api.getCustomers()
        .then((res) => {
          const approved = res.customers
            .map((c) => c.profile)
            .filter((p): p is CustomerProfile => Boolean(p && p.approval_status === 'approved'));
          setCustomers(approved);
          if (approved.length > 0) {
            setSelectedCustomerId(approved[0].id);
          }
        })
        .catch((err) => console.error('Failed to load customers:', err));
    }
  }, [isCustomer]);

  // Load products when customer ID is known
  useEffect(() => {
    const custId = isCustomer ? undefined : selectedCustomerId;
    if (isCustomer || custId) {
      setLoadingProducts(true);
      api.getProducts({ customerId: custId, status: 'active' })
        .then((res) => {
          setProducts(res.products);
          // If items list is empty and products exist, initialize first item
          if (items.length === 0 && res.products.length > 0) {
            const first = res.products[0];
            setItems([
              {
                productId: first.id,
                sku: first.sku,
                name: first.name,
                quantity: 1,
                unitPrice: first.declared_value || 0,
                availableStock: first.in_storage_units || 0
              }
            ]);
          }
        })
        .catch((err) => console.error('Failed to load products:', err))
        .finally(() => setLoadingProducts(false));
    }
  }, [isCustomer, selectedCustomerId]);

  const handleAddItem = () => {
    if (products.length === 0) return;
    const first = products[0];
    setItems((prev) => [
      ...prev,
      {
        productId: first.id,
        sku: first.sku,
        name: first.name,
        quantity: 1,
        unitPrice: first.declared_value || 0,
        availableStock: first.in_storage_units || 0
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemProductChange = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              productId: prod.id,
              sku: prod.sku,
              name: prod.name,
              unitPrice: prod.declared_value || 0,
              availableStock: prod.in_storage_units || 0
            }
          : item
      )
    );
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    const validQty = Math.max(1, qty);
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity: validQty } : item))
    );
  };

  const handleItemPriceChange = (index: number, price: number) => {
    const validPrice = Math.max(0, price);
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, unitPrice: validPrice } : item))
    );
  };

  const totalPieces = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const activeCity = city === 'other' ? customCity.trim() : city;

    // Basic client validation
    if (!consigneeName.trim()) {
      setError('Consignee recipient name is required.');
      return;
    }
    if (!consigneePhone.trim() || consigneePhone.replace(/[^0-9]/g, '').length < 8) {
      setError('Please provide a valid recipient contact phone number.');
      return;
    }
    if (!shippingAddress.trim()) {
      setError('Delivery destination address is required.');
      return;
    }
    if (!activeCity) {
      setError('Destination city is required.');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one line item to the order.');
      return;
    }

    const codNum = paymentMethod === 'cod' ? parseFloat(codAmount) || 0 : 0;
    if (paymentMethod === 'cod' && codNum <= 0) {
      setError('Cash on Delivery (COD) amount must be greater than 0 PKR. If paid in advance, switch payment method to Prepaid.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createOrder({
        customerId: !isCustomer ? selectedCustomerId : undefined,
        customerReference: customerReference.trim() || undefined,
        consigneeName: consigneeName.trim(),
        consigneePhone: consigneePhone.trim(),
        consigneeEmail: consigneeEmail.trim() || undefined,
        shippingAddress: shippingAddress.trim(),
        city: activeCity,
        province: province.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        codAmount: codNum,
        paymentMethod,
        shippingNotes: shippingNotes.trim() || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice
        })),
        autoConfirm: !isCustomer && canConfirm && autoConfirm
      });

      onSuccess(res.order.order_number);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create fulfillment order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <PackagePlus className="w-5 h-5 text-emerald-700" />
          <span>Create Fulfillment Order</span>
        </div>
      }
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            {items.length} item{items.length === 1 ? '' : 's'} · {totalPieces} total pieces
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {submitting ? 'Creating Order...' : 'Create Order'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Notice variant="error" title="Validation Error">
            {error}
          </Notice>
        )}

        {/* Staff merchant picker */}
        {!isCustomer && (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Select Merchant Account *</span>
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              disabled={submitting}
              className="w-full text-xs py-2 px-3 border border-slate-300 rounded bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.brand_name || c.business_name} ({c.city})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Consignee Section */}
        <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <MapPin className="w-3.5 h-3.5 text-emerald-700" />
            <span>Consignee & Delivery Destination</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Recipient Full Name *
              </label>
              <Input
                placeholder="e.g. Muhammad Bilal"
                value={consigneeName}
                onChange={(e) => setConsigneeName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Mobile / Phone *
              </label>
              <Input
                placeholder="e.g. 0300 1234567"
                value={consigneePhone}
                onChange={(e) => setConsigneePhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Email Address (Optional)
              </label>
              <Input
                type="email"
                placeholder="customer@domain.com"
                value={consigneeEmail}
                onChange={(e) => setConsigneeEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Destination City *
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                {COMMON_PAKISTAN_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="other">Other City (Specify Below)</option>
              </select>
              {city === 'other' && (
                <div className="mt-2">
                  <Input
                    placeholder="Enter city name..."
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Complete Delivery Address *
            </label>
            <textarea
              placeholder="House/Flat #, Street #, Sector/Area, Landmark..."
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              rows={2}
              required
              className="w-full text-xs p-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Province / Region
              </label>
              <Input
                placeholder="e.g. Punjab, Sindh, KPK"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Postal / Zip Code
              </label>
              <Input
                placeholder="e.g. 44000"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Financial & Terms Section */}
        <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Banknote className="w-3.5 h-3.5 text-emerald-700" />
            <span>Financials & Order Reference</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'cod' | 'prepaid')}
                className="w-full text-xs py-2 px-3 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
              >
                <option value="cod">Cash on Delivery (COD)</option>
                <option value="prepaid">Prepaid (0 PKR COD)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                COD Collection Amount (PKR) {paymentMethod === 'cod' && '*'}
              </label>
              <Input
                type="number"
                placeholder="e.g. 2500"
                value={paymentMethod === 'prepaid' ? '0' : codAmount}
                onChange={(e) => setCodAmount(e.target.value)}
                disabled={paymentMethod === 'prepaid'}
                required={paymentMethod === 'cod'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Merchant Order Reference
              </label>
              <Input
                placeholder="e.g. #SHOPIFY-1029"
                value={customerReference}
                onChange={(e) => setCustomerReference(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Shipping Notes / Courier Instructions
            </label>
            <Input
              placeholder="e.g. Call before delivery, fragile item..."
              value={shippingNotes}
              onChange={(e) => setShippingNotes(e.target.value)}
            />
          </div>

          {!isCustomer && canConfirm && (
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <input
                type="checkbox"
                id="autoConfirm"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 border-slate-300"
              />
              <label htmlFor="autoConfirm" className="text-xs font-medium text-slate-700 cursor-pointer">
                Directly confirm order (bypass Confirmation Queue)
              </label>
            </div>
          )}
        </div>

        {/* Line Items Builder */}
        <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Boxes className="w-3.5 h-3.5 text-emerald-700" />
              <span>Order Line Items ({items.length})</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              disabled={products.length === 0}
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Another SKU
            </Button>
          </div>

          {loadingProducts ? (
            <div className="py-6 text-center text-xs text-slate-500">Loading catalog...</div>
          ) : products.length === 0 ? (
            <div className="p-4 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800">
              No active products found in this merchant&apos;s catalog. Please add SKUs in the Product Catalog before creating orders.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      SKU / Product
                    </label>
                    <select
                      value={item.productId}
                      onChange={(e) => handleItemProductChange(idx, e.target.value)}
                      className="w-full text-xs py-1.5 px-2.5 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name} ({p.in_storage_units || 0} in storage)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleItemQtyChange(idx, parseInt(e.target.value, 10) || 1)}
                      className="w-full text-xs py-1.5 px-2.5 border border-slate-300 rounded bg-white text-center font-bold text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="w-32">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Declared Price (PKR)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) => handleItemPriceChange(idx, parseFloat(e.target.value) || 0)}
                      className="w-full text-xs py-1.5 px-2.5 border border-slate-300 rounded bg-white text-right font-mono text-slate-800 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="w-32 text-right">
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Line Total</div>
                    <div className="text-xs font-bold font-mono text-slate-900 py-1.5">
                      PKR {(item.quantity * item.unitPrice).toLocaleString()}
                    </div>
                  </div>

                  {items.length > 1 && (
                    <div className="sm:pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Items Summary Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Total Declared Items Value:</span>
                <span className="font-bold font-mono text-slate-900 text-sm">
                  PKR {totalValue.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
