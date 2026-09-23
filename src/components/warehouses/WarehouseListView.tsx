import React, { useState, useEffect } from 'react';
import { Warehouse, api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Notice } from '../ui/Notice';
import {
  Building2,
  FolderTree,
  Layers,
  Plus,
  MapPin,
  Phone,
  User,
  ExternalLink,
  RefreshCw,
  Box,
  HardDrive
} from 'lucide-react';
import { WarehouseCreateModal } from './WarehouseCreateModal';
import { LocationTreeView } from './LocationTreeView';
import { StorageTemplateManagerModal } from './StorageTemplateManagerModal';

export const WarehouseListView: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'hubs' | 'tree' | 'templates'>('hubs');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals
  const [showCreateWarehouse, setShowCreateWarehouse] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getWarehouses();
      setWarehouses(res.warehouses);
      if (res.warehouses.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(res.warehouses[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load warehouses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0];

  // Aggregated system metrics
  const totalLocations = warehouses.reduce((sum, w) => sum + (w.total_locations || 0), 0);
  const totalCapacity = warehouses.reduce((sum, w) => sum + (w.total_capacity_units || 0), 0);
  const totalOccupied = warehouses.reduce((sum, w) => sum + (w.occupied_units || 0), 0);
  const overallOccupancyPct = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Warehouse Infrastructure</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical fulfillment facilities, location trees, storage templates, and thermal barcode labels
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateManager(true)}
            icon={<Layers className="w-4 h-4 text-slate-500" />}
          >
            Storage Templates
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setShowCreateWarehouse(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Register Facility
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchWarehouses}
            icon={<RefreshCw className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Notifications */}
      {error && <Notice variant="error" message={error} onDismiss={() => setError(null)} />}
      {notice && <Notice variant="success" message={notice} onDismiss={() => setNotice(null)} />}

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Facilities</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {warehouses.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Multi-city fulfillment network</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Indexed Locations</span>
            <FolderTree className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {totalLocations.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Zones, Aisles, Racks, Shelves, Bins</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Max System Capacity</span>
            <HardDrive className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {totalCapacity.toLocaleString()} <span className="text-xs font-normal text-slate-400">units</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Calculated unit slot headroom</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Storage Occupancy</span>
            <Box className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-2">
            {overallOccupancyPct}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{totalOccupied} units stored</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('hubs')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'hubs'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Facilities & Hubs ({warehouses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tree')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'tree'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Location Tree Explorer</span>
          </button>
        </div>

        {/* Warehouse Selector for Tree View */}
        {activeTab === 'tree' && warehouses.length > 1 && (
          <div className="flex items-center gap-2 pb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Selected Facility:</span>
            <select
              value={selectedWarehouseId || ''}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab 1: Facilities & Hubs Overview */}
      {activeTab === 'hubs' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading facilities...</div>
          ) : warehouses.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-xl space-y-3">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
              <div>No warehouses configured yet.</div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShowCreateWarehouse(true)}
              >
                Register First Facility
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {warehouses.map((wh) => (
                <div
                  key={wh.id}
                  className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {wh.code}
                          </span>
                          <Badge variant="success">Active</Badge>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1.5">{wh.name}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase block font-semibold">Floor Area</span>
                        <span className="text-xs font-bold font-mono text-slate-700">
                          {wh.total_area_sqft ? `${wh.total_area_sqft.toLocaleString()} sq ft` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Address & Contact Info */}
                    <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{wh.address}, {wh.city}</span>
                      </div>
                      {wh.contact_person && (
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Manager: {wh.contact_person}</span>
                        </div>
                      )}
                      {wh.contact_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono">{wh.contact_phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-[10px] text-slate-400 block uppercase">Locations</span>
                        <span className="text-xs font-bold font-mono text-slate-900 mt-0.5 block">
                          {wh.total_locations || 0}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-[10px] text-slate-400 block uppercase">Max Capacity</span>
                        <span className="text-xs font-bold font-mono text-slate-900 mt-0.5 block">
                          {(wh.total_capacity_units || 0).toLocaleString()} u
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-[10px] text-slate-400 block uppercase">Occupied</span>
                        <span className="text-xs font-bold font-mono text-slate-900 mt-0.5 block">
                          {wh.occupied_units || 0} u
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Created: {new Date(wh.created_at).toLocaleDateString()}
                    </span>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedWarehouseId(wh.id);
                        setActiveTab('tree');
                      }}
                      icon={<ExternalLink className="w-3.5 h-3.5" />}
                    >
                      Explore Hierarchy Tree
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Location Tree Explorer */}
      {activeTab === 'tree' && selectedWarehouse && (
        <LocationTreeView
          warehouse={selectedWarehouse}
          onRefreshWarehouse={fetchWarehouses}
        />
      )}

      {/* Create Warehouse Modal */}
      {showCreateWarehouse && (
        <WarehouseCreateModal
          onClose={() => setShowCreateWarehouse(false)}
          onSuccess={(created) => {
            setShowCreateWarehouse(false);
            setNotice(`Warehouse ${created.code} registered successfully.`);
            fetchWarehouses();
            setSelectedWarehouseId(created.id);
          }}
        />
      )}

      {/* Storage Template Manager Modal */}
      {showTemplateManager && (
        <StorageTemplateManagerModal
          onClose={() => setShowTemplateManager(false)}
        />
      )}
    </div>
  );
};
