import React, { useState } from 'react';
import { UserSession } from '../../lib/api';
import { ProductListView } from './ProductListView';
import { InventoryUnitListView } from './InventoryUnitListView';
import { ReceivingBatchListView } from './ReceivingBatchListView';
import { InventoryLedgerView } from './InventoryLedgerView';
import { StockingSessionModal } from './StockingSessionModal';
import { StockReceivingModal } from './StockReceivingModal';
import { Package, Boxes, Activity, Scan, Inbox } from 'lucide-react';
import { Button } from '../ui/Button';

interface InventoryManagementViewProps {
  user: UserSession;
}

export const InventoryManagementView: React.FC<InventoryManagementViewProps> = ({ user }) => {
  const [subTab, setSubTab] = useState<'products' | 'units' | 'batches' | 'ledger'>('products');
  const [showPutawayStation, setShowPutawayStation] = useState(false);
  const [showReceivingModal, setShowReceivingModal] = useState(false);

  const canStock = user.role_id === 'role_administrator' || user.permissions.includes('inventory.stock');

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs for Inventory Domain */}
      <div className="bg-white border-b border-slate-200 -mx-4 -mt-4 px-4 sm:px-6 pt-4 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-6 overflow-x-auto">
          <button
            onClick={() => setSubTab('products')}
            className={`flex items-center gap-2 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              subTab === 'products'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Product & SKU Catalog</span>
          </button>

          <button
            onClick={() => setSubTab('units')}
            className={`flex items-center gap-2 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              subTab === 'units'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Physical Units Tracking</span>
          </button>

          <button
            onClick={() => setSubTab('batches')}
            className={`flex items-center gap-2 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              subTab === 'batches'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Receiving Freight Batches</span>
          </button>

          <button
            onClick={() => setSubTab('ledger')}
            className={`flex items-center gap-2 pb-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              subTab === 'ledger'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Inventory Movement Ledger</span>
          </button>
        </div>

        {canStock && (
          <div className="pb-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReceivingModal(true)}
              className="text-slate-700 border-slate-300 hover:bg-slate-50"
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Receive Freight</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPutawayStation(true)}
              className="text-emerald-800 border-emerald-300 hover:bg-emerald-50"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Open Putaway Station</span>
            </Button>
          </div>
        )}
      </div>

      {/* Render selected view */}
      {subTab === 'products' && (
        <ProductListView
          user={user}
          onNavigateToUnits={() => setSubTab('units')}
        />
      )}

      {subTab === 'units' && <InventoryUnitListView user={user} />}

      {subTab === 'batches' && (
        <ReceivingBatchListView
          user={user}
          onOpenReceivingModal={() => setShowReceivingModal(true)}
        />
      )}

      {subTab === 'ledger' && <InventoryLedgerView user={user} />}

      {/* Putaway Scan Modal */}
      {showPutawayStation && (
        <StockingSessionModal
          user={user}
          onClose={() => setShowPutawayStation(false)}
          onSuccess={() => {}}
        />
      )}

      {/* Stock Receiving Modal */}
      {showReceivingModal && (
        <StockReceivingModal
          user={user}
          onClose={() => setShowReceivingModal(false)}
          onSuccess={() => {
            setShowReceivingModal(false);
            setSubTab('batches');
          }}
        />
      )}
    </div>
  );
};
