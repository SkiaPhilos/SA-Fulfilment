import React, { useState, useEffect } from 'react';
import {
  api,
  UserSession,
  EnrichedProduct,
  CustomerProfile
} from '../../lib/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Notice } from '../ui/Notice';
import { ProductCreateModal } from './ProductCreateModal';
import { StockReceivingModal } from './StockReceivingModal';
import { StockingSessionModal } from './StockingSessionModal';
import { UnitLabelPrintModal } from './UnitLabelPrintModal';
import {
  Package,
  Plus,
  Inbox,
  Scan,
  Search,
  Filter,
  AlertTriangle,
  RefreshCw,
  Tag,
  Boxes,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Printer
} from 'lucide-react';

interface ProductListViewProps {
  user: UserSession;
  onNavigateToUnits?: () => void;
}

export const ProductListView: React.FC<ProductListViewProps> = ({
  user,
  onNavigateToUnits
}) => {
  const isCustomer = user.account_type === 'customer';
  const canReceive = user.role_id === 'role_administrator' || user.permissions.includes('inventory.receive');
  const canStock = user.role_id === 'role_administrator' || user.permissions.includes('inventory.stock');

  const [products, setProducts] = useState<EnrichedProduct[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showStockingModal, setShowStockingModal] = useState(false);
  const [printBatchId, setPrintBatchId] = useState<string | null>(null);
  const [printProductId, setPrintProductId] = useState<string | null>(null);

  const fetchProducts = () => {
    setLoading(true);
    api.getProducts({
      search: search.trim() || undefined,
      category: selectedCategory === 'all' ? undefined : selectedCategory,
      customerId: !isCustomer && selectedCustomerId !== 'all' ? selectedCustomerId : undefined,
      lowStockOnly: lowStockOnly || undefined
    })
      .then((res) => {
        setProducts(res.products);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch products.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, selectedCustomerId, lowStockOnly]);

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

  // Aggregate Metrics
  const totalSkus = products.length;
  const totalInStorage = products.reduce((acc, p) => acc + p.in_storage_units, 0);
  const totalAwaiting = products.reduce((acc, p) => acc + p.awaiting_stocking_units, 0);
  const lowStockCount = products.filter((p) => p.is_low_stock).length;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Product & SKU Inventory Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Master SKU specifications, volumetric attributes, and real-time physical availability
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canStock && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStockingModal(true)}
              className="text-emerald-800 border-emerald-300 hover:bg-emerald-50"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Putaway Session</span>
            </Button>
          )}

          {canReceive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReceiveModal(true)}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Receive Stock</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New SKU</span>
          </Button>
        </div>
      </div>

      {error && <Notice variant="error" title="Error">{error}</Notice>}

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total SKUs
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{totalSkus}</div>
          <div className="text-[11px] text-slate-400 mt-1">Catalog items registered</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
            <span>Available In Storage</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-800 mt-1 font-mono">{totalInStorage}</div>
          <div className="text-[11px] text-slate-400 mt-1">Placed in verified locations</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center justify-between">
            <span>Awaiting Putaway</span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-800 mt-1 font-mono">{totalAwaiting}</div>
          <div className="text-[11px] text-slate-400 mt-1">Intake received at staging</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider flex items-center justify-between">
            <span>Low Stock Alerts</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-1 font-mono">{lowStockCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Under reorder threshold</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
                placeholder="SKU, Product Title..."
                className="w-full h-8 pl-8 pr-3 rounded border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs text-slate-800"
            >
              <option value="all">All Categories</option>
              <option value="General Merchandise">General Merchandise</option>
              <option value="Apparel & Fashion">Apparel & Fashion</option>
              <option value="Health & Beauty">Health & Beauty</option>
              <option value="Consumer Electronics">Consumer Electronics</option>
              <option value="Home & Kitchen">Home & Kitchen</option>
              <option value="Personal Care">Personal Care</option>
            </select>
          </div>

          {/* Merchant (Staff only) */}
          {!isCustomer && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Merchant</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs text-slate-800"
              >
                <option value="all">All Merchants</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.brand_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Low Stock Toggle */}
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 border-slate-300"
              />
              <span>Low Stock Alerts Only ({lowStockCount})</span>
            </label>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Displaying <strong className="text-slate-800">{products.length}</strong> catalog SKUs
          </span>
          <Button variant="outline" size="sm" onClick={fetchProducts} loading={loading}>
            <RefreshCw className="w-3 h-3" />
            <span>Sync</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">SKU / Code</th>
                <th className="py-2.5 px-4">Product Details</th>
                {!isCustomer && <th className="py-2.5 px-4">Merchant</th>}
                <th className="py-2.5 px-4 text-center">In Storage</th>
                <th className="py-2.5 px-4 text-center">Awaiting Putaway</th>
                <th className="py-2.5 px-4 text-center">Damaged</th>
                <th className="py-2.5 px-4">Volumetric & Value</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={!isCustomer ? 9 : 8} className="py-12 text-center text-xs text-slate-400">
                    {loading ? 'Loading catalog...' : 'No products found. Click "New SKU" to create your first product.'}
                  </td>
                </tr>
              ) : (
                products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* SKU */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      <div>{prod.sku}</div>
                      {prod.barcode && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          UPC: {prod.barcode}
                        </div>
                      )}
                    </td>

                    {/* Title & Category */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{prod.name}</div>
                      <div className="text-[11px] text-slate-500">{prod.category}</div>
                    </td>

                    {/* Merchant */}
                    {!isCustomer && (
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {prod.customer_brand}
                      </td>
                    )}

                    {/* In Storage */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-bold text-sm text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {prod.in_storage_units}
                      </span>
                    </td>

                    {/* Awaiting Putaway */}
                    <td className="py-3 px-4 text-center">
                      {prod.awaiting_stocking_units > 0 ? (
                        <span className="font-mono font-semibold text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {prod.awaiting_stocking_units}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">0</span>
                      )}
                    </td>

                    {/* Damaged */}
                    <td className="py-3 px-4 text-center">
                      {prod.damaged_units > 0 ? (
                        <span className="font-mono font-semibold text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                          {prod.damaged_units}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">0</span>
                      )}
                    </td>

                    {/* Dimensions & Value */}
                    <td className="py-3 px-4 text-[11px] text-slate-600 font-mono">
                      <div>
                        {prod.dimensions.length_cm}×{prod.dimensions.width_cm}×{prod.dimensions.height_cm} cm
                      </div>
                      <div className="text-slate-400">
                        {prod.weight_kg} kg • Rs. {prod.declared_value.toLocaleString()}
                      </div>
                    </td>

                    {/* Status & Low Stock Alert */}
                    <td className="py-3 px-4">
                      {prod.is_low_stock ? (
                        <Badge variant="danger" dot>
                          Low Stock ({prod.in_storage_units}/{prod.low_stock_threshold})
                        </Badge>
                      ) : (
                        <Badge variant="success" dot>
                          In Stock
                        </Badge>
                      )}
                    </td>

                    {/* Actions: Print SKU Labels */}
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPrintProductId(prod.id)}
                        disabled={prod.in_storage_units === 0 && prod.awaiting_stocking_units === 0}
                        className="text-emerald-800 border-emerald-300 hover:bg-emerald-50 bg-white"
                        title="Print barcode labels for active units of this product"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Print Labels</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <ProductCreateModal
          user={user}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchProducts();
          }}
        />
      )}

      {showReceiveModal && (
        <StockReceivingModal
          user={user}
          onClose={() => setShowReceiveModal(false)}
          onPrintRequested={(bId) => setPrintBatchId(bId)}
          onStockingRequested={() => setShowStockingModal(true)}
          onSuccess={() => fetchProducts()}
        />
      )}

      {showStockingModal && (
        <StockingSessionModal
          user={user}
          onClose={() => setShowStockingModal(false)}
          onSuccess={() => fetchProducts()}
        />
      )}

      {printBatchId && (
        <UnitLabelPrintModal
          batchId={printBatchId}
          onClose={() => setPrintBatchId(null)}
        />
      )}

      {printProductId && (
        <UnitLabelPrintModal
          productId={printProductId}
          onClose={() => setPrintProductId(null)}
        />
      )}
    </div>
  );
};
