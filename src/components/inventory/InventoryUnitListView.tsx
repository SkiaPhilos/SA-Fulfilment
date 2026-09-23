import React, { useState, useEffect } from 'react';
import {
  api,
  UserSession,
  EnrichedInventoryUnit,
  Warehouse,
  CustomerProfile,
  WarehouseLocation,
  InventoryUnitState
} from '../../lib/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Notice } from '../ui/Notice';
import { UnitLabelPrintModal } from './UnitLabelPrintModal';
import {
  Tag,
  Search,
  Filter,
  ArrowRight,
  Printer,
  Move,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Building,
  MapPin,
  X
} from 'lucide-react';

interface InventoryUnitListViewProps {
  user: UserSession;
}

export const InventoryUnitListView: React.FC<InventoryUnitListViewProps> = ({ user }) => {
  const isCustomer = user.account_type === 'customer';
  const canMove = user.role_id === 'role_administrator' || user.permissions.includes('inventory.move');
  const canAdjust = user.role_id === 'role_administrator' || user.permissions.includes('inventory.adjust');

  const [units, setUnits] = useState<EnrichedInventoryUnit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);

  // Action Modals
  const [printUnitIds, setPrintUnitIds] = useState<string[] | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [relocateUnit, setRelocateUnit] = useState<EnrichedInventoryUnit | null>(null);
  const [adjustUnit, setAdjustUnit] = useState<EnrichedInventoryUnit | null>(null);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const toggleSelectAll = () => {
    if (selectedUnitIds.length === units.length) {
      setSelectedUnitIds([]);
    } else {
      setSelectedUnitIds(units.map((u) => u.id));
    }
  };

  const toggleSelectUnit = (id: string) => {
    setSelectedUnitIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const fetchUnits = () => {
    setLoading(true);
    api.getInventoryUnits({
      search: search.trim() || undefined,
      state: selectedState === 'all' ? undefined : (selectedState as InventoryUnitState),
      warehouseId: selectedWarehouseId === 'all' ? undefined : selectedWarehouseId,
      customerId: !isCustomer && selectedCustomerId !== 'all' ? selectedCustomerId : undefined,
      limit: 100
    })
      .then((res) => {
        setUnits(res.units);
        setTotal(res.total);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch inventory units.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUnits();
  }, [selectedState, selectedWarehouseId, selectedCustomerId]);

  useEffect(() => {
    api.getWarehouses()
      .then((res) => setWarehouses(res.warehouses))
      .catch((err) => console.error('Failed to load warehouses:', err));

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

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getStateBadge = (state: InventoryUnitState) => {
    switch (state) {
      case 'in_storage':
        return <Badge variant="success">In Storage</Badge>;
      case 'awaiting_stocking':
        return <Badge variant="warning">Awaiting Putaway</Badge>;
      case 'reserved':
        return <Badge variant="info">Reserved</Badge>;
      case 'picked':
        return <Badge variant="info">Picked</Badge>;
      case 'packed':
        return <Badge variant="neutral">Packed</Badge>;
      case 'fulfilled':
        return <Badge variant="success">Fulfilled</Badge>;
      case 'damaged':
        return <Badge variant="danger">Damaged</Badge>;
      case 'lost':
        return <Badge variant="danger">Lost</Badge>;
      default:
        return <Badge variant="neutral">{state}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Physical Inventory Units
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Every received piece has an immutable unique identity code (UNIT-XXXX)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {units.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrintUnitIds(units.map((u) => u.id))}
              className="text-emerald-800 border-emerald-300 hover:bg-emerald-50 bg-white"
              title="Print barcode labels for all units currently matching filter"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-700" />
              <span>Print Filtered Labels ({units.length})</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchUnits} loading={loading}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {error && (
        <Notice variant="error" title="Error">
          {error}
        </Notice>
      )}

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
                onKeyDown={(e) => e.key === 'Enter' && fetchUnits()}
                placeholder="Unit Code, SKU, Title..."
                className="w-full h-8 pl-8 pr-3 rounded border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600"
              />
            </div>
          </div>

          {/* State Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Unit State</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs text-slate-800"
            >
              <option value="all">All States</option>
              <option value="in_storage">In Storage</option>
              <option value="awaiting_stocking">Awaiting Putaway</option>
              <option value="reserved">Reserved</option>
              <option value="picked">Picked</option>
              <option value="packed">Packed</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>

          {/* Warehouse Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Warehouse</label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-xs text-slate-800"
            >
              <option value="all">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          {/* Merchant Filter (Staff only) */}
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
        </div>
      </div>

      {/* Selected Units Bulk Action Banner */}
      {selectedUnitIds.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-700 font-bold" />
            <span>
              <strong>{selectedUnitIds.length} unit(s)</strong> selected out of {units.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedUnitIds([])}
              className="text-slate-700 border-slate-300 bg-white"
            >
              Deselect All
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPrintUnitIds(selectedUnitIds)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              <span>Print Barcode Labels ({selectedUnitIds.length})</span>
            </Button>
          </div>
        </div>
      )}

      {/* Units Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{units.length}</strong> of{' '}
            <strong className="text-slate-800">{total}</strong> total units
          </span>
          <span className="text-[11px] text-slate-400">Scan-verified storage assignments</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="w-10 py-2.5 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={units.length > 0 && selectedUnitIds.length === units.length}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    title="Select/Deselect All Units"
                  />
                </th>
                <th className="py-2.5 px-4">Tracking Code</th>
                <th className="py-2.5 px-4">SKU & Title</th>
                {!isCustomer && <th className="py-2.5 px-4">Merchant</th>}
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4">State</th>
                <th className="py-2.5 px-4">Condition</th>
                <th className="py-2.5 px-4">Intake Date</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.length === 0 ? (
                <tr>
                  <td colSpan={!isCustomer ? 9 : 8} className="py-12 text-center text-xs text-slate-400">
                    {loading ? 'Loading inventory units...' : 'No physical units match the selected filters.'}
                  </td>
                </tr>
              ) : (
                units.map((unit) => (
                  <tr key={unit.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Checkbox */}
                    <td className="w-10 py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedUnitIds.includes(unit.id)}
                        onChange={() => toggleSelectUnit(unit.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    {/* Tracking Code */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{unit.tracking_code}</span>
                        <button
                          onClick={() => handleCopy(unit.tracking_code)}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                          title="Copy tracking code"
                        >
                          {copiedCode === unit.tracking_code ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* SKU & Title */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-slate-900">{unit.product_sku}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{unit.product_name}</div>
                    </td>

                    {/* Merchant Brand */}
                    {!isCustomer && (
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {unit.customer_brand}
                      </td>
                    )}

                    {/* Location */}
                    <td className="py-3 px-4">
                      {unit.location_code ? (
                        <div>
                          <span className="font-mono font-semibold text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {unit.location_code}
                          </span>
                          <div className="text-[10px] text-slate-400 truncate max-w-[160px] mt-0.5">
                            {unit.location_path}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono">
                          Staging / Dock
                        </span>
                      )}
                    </td>

                    {/* State */}
                    <td className="py-3 px-4">
                      {getStateBadge(unit.state)}
                    </td>

                    {/* Condition */}
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                          unit.condition === 'damaged'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {unit.condition}
                      </span>
                    </td>

                    {/* Received Date */}
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(unit.received_at).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPrintUnitIds([unit.id])}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                          title="Print Barcode Label"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {canMove && unit.state === 'in_storage' && (
                          <button
                            onClick={() => setRelocateUnit(unit)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                            title="Relocate Unit"
                          >
                            <Move className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canAdjust && (
                          <button
                            onClick={() => setAdjustUnit(unit)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded"
                            title="Adjust Unit Condition"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Barcode Modal */}
      {printUnitIds && (
        <UnitLabelPrintModal
          unitIds={printUnitIds}
          onClose={() => setPrintUnitIds(null)}
        />
      )}

      {/* Relocate Unit Modal */}
      {relocateUnit && (
        <RelocateUnitModal
          unit={relocateUnit}
          onClose={() => setRelocateUnit(null)}
          onSuccess={() => {
            setRelocateUnit(null);
            fetchUnits();
          }}
        />
      )}

      {/* Adjust Unit Modal */}
      {adjustUnit && (
        <AdjustUnitModal
          unit={adjustUnit}
          onClose={() => setAdjustUnit(null)}
          onSuccess={() => {
            setAdjustUnit(null);
            fetchUnits();
          }}
        />
      )}
    </div>
  );
};

interface RelocateUnitModalProps {
  unit: EnrichedInventoryUnit;
  onClose: () => void;
  onSuccess: () => void;
}

const RelocateUnitModal: React.FC<RelocateUnitModalProps> = ({ unit, onClose, onSuccess }) => {
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [targetLocationId, setTargetLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (unit.warehouse_id) {
      api.getWarehouseTree(unit.warehouse_id)
        .then((res) => {
          const flatList: WarehouseLocation[] = [];
          const traverse = (node: any) => {
            flatList.push(node);
            if (node.children) node.children.forEach(traverse);
          };
          res.tree.forEach(traverse);
          const available = flatList.filter(
            (l) => l.id !== unit.location_id && ['shelf', 'bin', 'rack'].includes(l.type)
          );
          setLocations(available);
          if (available.length > 0) setTargetLocationId(available[0].id);
        })
        .catch((err) => console.error('Failed to load locations for relocate:', err));
    }
  }, [unit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLocationId) {
      setError('Please select a destination storage location.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.moveUnit({
        unitId: unit.id,
        toLocationId: targetLocationId,
        notes: notes.trim() || undefined
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to relocate unit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-semibold text-slate-900">Relocate Physical Unit</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <Notice variant="error" title="Relocation Error">{error}</Notice>}

          <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
            <div>Unit Code: <strong className="font-mono">{unit.tracking_code}</strong></div>
            <div>Current Location: <strong className="font-mono">{unit.location_code || 'None'}</strong></div>
            <div>SKU: <span className="font-mono">{unit.product_sku}</span></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Destination Location
            </label>
            <select
              value={targetLocationId}
              onChange={(e) => setTargetLocationId(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs font-mono text-slate-900 bg-white"
              required
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} ({loc.type}) — {loc.occupied_units}/{loc.max_units || '∞'} units
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Relocation Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Rack consolidation, space optimization..."
              className="w-full p-2.5 rounded-md border border-slate-300 text-xs text-slate-900"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={loading}>
              Move Unit
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AdjustUnitModalProps {
  unit: EnrichedInventoryUnit;
  onClose: () => void;
  onSuccess: () => void;
}

const AdjustUnitModal: React.FC<AdjustUnitModalProps> = ({ unit, onClose, onSuccess }) => {
  const [condition, setCondition] = useState<'good' | 'damaged'>(unit.condition);
  const [state, setState] = useState<InventoryUnitState>(unit.state);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError('An audit note is required for condition adjustments.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.adjustUnit({
        unitId: unit.id,
        condition,
        state,
        notes: notes.trim()
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to record adjustment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <h3 className="text-sm font-semibold text-slate-900">Adjust Unit Condition</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <Notice variant="error" title="Adjustment Error">{error}</Notice>}

          <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
            <div>Unit Code: <strong className="font-mono">{unit.tracking_code}</strong></div>
            <div>SKU: <span className="font-mono">{unit.product_sku}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs bg-white"
              >
                <option value="good">Good (Intact)</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value as any)}
                className="w-full h-8 px-2.5 rounded border border-slate-300 text-xs bg-white"
              >
                <option value="in_storage">In Storage</option>
                <option value="awaiting_stocking">Awaiting Putaway</option>
                <option value="damaged">Damaged</option>
                <option value="lost">Lost / Missing</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Audit Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="State reason for condition/status change..."
              className="w-full p-2.5 rounded-md border border-slate-300 text-xs text-slate-900"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={loading}>
              Save Adjustment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
