import React, { useState, useEffect } from 'react';
import { api, UserSession, InventoryTransaction } from '../../lib/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Notice } from '../ui/Notice';
import { Activity, RefreshCw, Search, ArrowRight, ShieldCheck } from 'lucide-react';

interface InventoryLedgerViewProps {
  user: UserSession;
}

export const InventoryLedgerView: React.FC<InventoryLedgerViewProps> = ({ user }) => {
  const [ledger, setLedger] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const fetchLedger = () => {
    setLoading(true);
    api.getInventoryLedger({
      type: selectedType === 'all' ? undefined : selectedType,
      limit: 100
    })
      .then((res) => {
        setLedger(res.ledger);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch inventory transaction ledger.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLedger();
  }, [selectedType]);

  const filteredLedger = ledger.filter((tx) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      tx.tracking_code.toLowerCase().includes(q) ||
      tx.actor_name.toLowerCase().includes(q) ||
      tx.notes.toLowerCase().includes(q)
    );
  });

  const getTypeBadge = (type: InventoryTransaction['type']) => {
    switch (type) {
      case 'RECEIVE':
        return <Badge variant="info">Stock Received</Badge>;
      case 'STOCK':
        return <Badge variant="success">Putaway Stocked</Badge>;
      case 'MOVE':
        return <Badge variant="warning">Location Moved</Badge>;
      case 'DAMAGE':
        return <Badge variant="danger">Marked Damaged</Badge>;
      case 'ADJUST':
        return <Badge variant="neutral">Stock Adjusted</Badge>;
      case 'PICK':
        return <Badge variant="info">Item Picked</Badge>;
      case 'PACK':
        return <Badge variant="neutral">Order Packed</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Inventory Movement & Physical Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographically auditable and immutable physical unit touches
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLedger} loading={loading}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Ledger</span>
          </Button>
        </div>
      </div>

      {error && <Notice variant="error" title="Error">{error}</Notice>}

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-600">Event Type:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-8 px-2.5 rounded border border-slate-300 text-xs text-slate-800 bg-white"
          >
            <option value="all">All Events</option>
            <option value="RECEIVE">RECEIVE (Intake)</option>
            <option value="STOCK">STOCK (Scan Putaway)</option>
            <option value="MOVE">MOVE (Relocation)</option>
            <option value="DAMAGE">DAMAGE</option>
            <option value="ADJUST">ADJUST (Correction)</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracking code, actor..."
            className="w-full h-8 pl-8 pr-3 rounded border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Event Type</th>
                <th className="py-2.5 px-4">Unit Tracking Code</th>
                <th className="py-2.5 px-4">State Transition</th>
                <th className="py-2.5 px-4">Operator / Actor</th>
                <th className="py-2.5 px-4">Operational Journal Note</th>
                <th className="py-2.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                    {loading ? 'Loading ledger entries...' : 'No inventory transactions recorded yet.'}
                  </td>
                </tr>
              ) : (
                filteredLedger.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Event Type */}
                    <td className="py-3 px-4">
                      {getTypeBadge(tx.type)}
                    </td>

                    {/* Unit Code */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {tx.tracking_code}
                    </td>

                    {/* State Transition */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-slate-500">{tx.from_state}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-emerald-800 font-semibold">{tx.to_state}</span>
                      </div>
                    </td>

                    {/* Actor */}
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {tx.actor_name}
                    </td>

                    {/* Operational Notes */}
                    <td className="py-3 px-4 text-slate-600 text-[11px] max-w-sm truncate">
                      {tx.notes}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
