import React, { useState, useEffect, useMemo } from 'react';
import {
  Warehouse,
  LocationTreeNode,
  WarehouseLocation,
  LocationType,
  api
} from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Notice } from '../ui/Notice';
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  Plus,
  Zap,
  Printer,
  Edit2,
  Trash2,
  Search,
  Box,
  Layers,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { LocationCreateModal } from './LocationCreateModal';
import { BulkLocationGeneratorModal } from './BulkLocationGeneratorModal';
import { LocationEditModal } from './LocationEditModal';
import { LocationLabelPrintModal } from './LocationLabelPrintModal';

interface LocationTreeViewProps {
  warehouse: Warehouse;
  onRefreshWarehouse?: () => void;
}

export const LocationTreeView: React.FC<LocationTreeViewProps> = ({
  warehouse,
  onRefreshWarehouse
}) => {
  const [tree, setTree] = useState<LocationTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // Modal dialog states
  const [createChildParent, setCreateChildParent] = useState<WarehouseLocation | null | undefined>(undefined);
  const [bulkGenParent, setBulkGenParent] = useState<WarehouseLocation | null | undefined>(undefined);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);
  const [printingLocationId, setPrintingLocationId] = useState<string | null>(null);

  const fetchTree = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getWarehouseTree(warehouse.id);
      setTree(res.tree);

      // Default: expand top 2 levels (zones and aisles) so operator gets an immediate visual map
      const initialExpanded = new Set<string>();
      res.tree.forEach((zone) => {
        initialExpanded.add(zone.id);
        zone.children.forEach((aisle) => {
          initialExpanded.add(aisle.id);
        });
      });
      setExpandedNodeIds(initialExpanded);
    } catch (err: any) {
      setError(err.message || 'Failed to load warehouse location tree.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, [warehouse.id]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    function collect(nodes: LocationTreeNode[]) {
      nodes.forEach((n) => {
        all.add(n.id);
        if (n.children?.length) collect(n.children);
      });
    }
    collect(tree);
    setExpandedNodeIds(all);
  };

  const collapseAll = () => {
    setExpandedNodeIds(new Set());
  };

  const handleDeleteLocation = async (loc: WarehouseLocation) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${loc.code} and ALL its sub-locations? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await api.deleteLocation(loc.id);
      setNotice(res.message);
      fetchTree();
      if (onRefreshWarehouse) onRefreshWarehouse();
    } catch (err: any) {
      setError(err.message || 'Failed to delete location.');
    }
  };

  // Status badge styling
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'full':
        return 'warning';
      case 'damaged':
        return 'danger';
      case 'restricted':
        return 'danger';
      case 'reserved':
        return 'info';
      default:
        return 'neutral';
    }
  };

  // Node type icon styling
  const getTypeColor = (type: LocationType) => {
    switch (type) {
      case 'zone':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'aisle':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'rack':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'shelf':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'bin':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'bay':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // Recursive tree filter
  const filterNode = (node: LocationTreeNode): LocationTreeNode | null => {
    const matchesSearch =
      !searchQuery ||
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.barcode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || node.type === typeFilter;

    // Filter children
    const filteredChildren: LocationTreeNode[] = [];
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const filteredChild = filterNode(child);
        if (filteredChild) {
          filteredChildren.push(filteredChild);
        }
      }
    }

    if (matchesSearch && matchesType) {
      return {
        ...node,
        children: filteredChildren
      };
    }

    if (filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren
      };
    }

    return null;
  };

  const filteredTree = useMemo(() => {
    if (!searchQuery && typeFilter === 'all') return tree;
    const res: LocationTreeNode[] = [];
    for (const root of tree) {
      const filtered = filterNode(root);
      if (filtered) res.push(filtered);
    }
    return res;
  }, [tree, searchQuery, typeFilter]);

  // Count total matching nodes
  const totalNodesCount = useMemo(() => {
    let count = 0;
    function countAll(nodes: LocationTreeNode[]) {
      nodes.forEach((n) => {
        count++;
        if (n.children?.length) countAll(n.children);
      });
    }
    countAll(filteredTree);
    return count;
  }, [filteredTree]);

  // Recursive Node Renderer Component
  const renderNode = (node: LocationTreeNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodeIds.has(node.id) || Boolean(searchQuery);

    const occupancyPercent = node.max_units > 0
      ? Math.round((node.occupied_units / node.max_units) * 100)
      : 0;

    return (
      <div key={node.id} className="relative group">
        <div
          className={`flex items-center justify-between py-2 px-3 hover:bg-slate-50 border-b border-slate-100 transition-colors ${
            depth === 0 ? 'bg-slate-50/70 font-semibold' : ''
          }`}
          style={{ paddingLeft: `${Math.max(depth * 24 + 12, 12)}px` }}
        >
          {/* Left: Expander + Code + Name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(node.id)}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-5 h-5 flex items-center justify-center text-slate-300 shrink-0 text-xs">•</span>
            )}

            {/* Type Tag */}
            <span
              className={`px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded border shrink-0 ${getTypeColor(
                node.type
              )}`}
            >
              {node.type}
            </span>

            {/* Code */}
            <span className="font-mono text-xs font-bold text-slate-900 shrink-0">
              {node.code}
            </span>

            {/* Name */}
            <span className="text-xs text-slate-600 truncate min-w-0">
              {node.name}
            </span>

            {/* Barcode Hint */}
            <span className="hidden sm:inline-block font-mono text-[10px] text-slate-400 truncate">
              ({node.barcode})
            </span>
          </div>

          {/* Right: Metrics & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Capacity / Occupancy Bar */}
            <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="text-[10px]">
                {node.occupied_units}/{node.max_units} u
              </span>
              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    occupancyPercent > 90
                      ? 'bg-rose-500'
                      : occupancyPercent > 60
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Dimensions */}
            <span className="hidden lg:inline-block text-[10px] font-mono text-slate-400">
              {node.dimensions.length_cm}x{node.dimensions.width_cm}x{node.dimensions.height_cm}cm
            </span>

            {/* Status Badge */}
            <Badge variant={getStatusBadgeVariant(node.status)}>
              {node.status}
            </Badge>

            {/* Action Buttons Toolbar */}
            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              {/* Add Child Node */}
              <button
                onClick={() => setCreateChildParent(node)}
                title="Add Sub-Location under this node"
                className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {/* Bulk Generator */}
              <button
                onClick={() => setBulkGenParent(node)}
                title="Bulk generate child series (e.g. Shelves S01-S06)"
                className="p-1 rounded text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>

              {/* Print Barcode Label */}
              <button
                onClick={() => setPrintingLocationId(node.id)}
                title="Generate printable 4x2 QR / Barcode label"
                className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>

              {/* Edit */}
              <button
                onClick={() => setEditingLocation(node)}
                title="Edit location properties"
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              {/* Delete */}
              <button
                onClick={() => handleDeleteLocation(node)}
                title="Delete location and descendants"
                className="p-1 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Nested Child Nodes */}
        {hasChildren && isExpanded && (
          <div className="border-l-2 border-slate-200 ml-4">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Notice / Errors */}
      {error && <Notice variant="error" message={error} onDismiss={() => setError(null)} />}
      {notice && <Notice variant="success" message={notice} onDismiss={() => setNotice(null)} />}

      {/* Action Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {warehouse.code}
              </span>
              <h2 className="text-base font-bold text-slate-900">{warehouse.name}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {warehouse.address}, {warehouse.city} • Total Active Nodes: {totalNodesCount}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateChildParent(null)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Zone
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setBulkGenParent(null)}
              icon={<Zap className="w-3.5 h-3.5" />}
            >
              Bulk Generator
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchTree}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code, name, or barcode..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-500">Filter Type:</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              <option value="all">All Types</option>
              <option value="zone">Zones</option>
              <option value="aisle">Aisles</option>
              <option value="rack">Racks</option>
              <option value="shelf">Shelves</option>
              <option value="bin">Bins</option>
              <option value="bay">Pallet Bays</option>
            </select>

            <button
              onClick={expandAll}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors"
            >
              Collapse
            </button>
          </div>
        </div>
      </div>

      {/* Tree Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading location tree...</div>
        ) : filteredTree.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>No warehouse locations match the filter criteria.</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTree.map((zoneNode) => renderNode(zoneNode, 0))}
          </div>
        )}
      </div>

      {/* Modals */}
      {createChildParent !== undefined && (
        <LocationCreateModal
          warehouse={warehouse}
          parentLocation={createChildParent}
          onClose={() => setCreateChildParent(undefined)}
          onSuccess={() => {
            setCreateChildParent(undefined);
            setNotice('Location created successfully.');
            fetchTree();
            if (onRefreshWarehouse) onRefreshWarehouse();
          }}
        />
      )}

      {bulkGenParent !== undefined && (
        <BulkLocationGeneratorModal
          warehouse={warehouse}
          parentLocation={bulkGenParent}
          onClose={() => setBulkGenParent(undefined)}
          onSuccess={(count) => {
            setBulkGenParent(undefined);
            setNotice(`Generated ${count} locations successfully.`);
            fetchTree();
            if (onRefreshWarehouse) onRefreshWarehouse();
          }}
        />
      )}

      {editingLocation && (
        <LocationEditModal
          location={editingLocation}
          onClose={() => setEditingLocation(null)}
          onSuccess={() => {
            setEditingLocation(null);
            setNotice('Location updated successfully.');
            fetchTree();
            if (onRefreshWarehouse) onRefreshWarehouse();
          }}
        />
      )}

      {printingLocationId && (
        <LocationLabelPrintModal
          locationId={printingLocationId}
          onClose={() => setPrintingLocationId(null)}
        />
      )}
    </div>
  );
};
