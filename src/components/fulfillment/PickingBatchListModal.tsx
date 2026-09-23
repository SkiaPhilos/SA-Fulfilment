import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Boxes,
  Barcode,
  Printer,
  RotateCcw,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { api, PickingBatch, PickingBatchDetails } from '../../lib/api';

interface PickingBatchListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPickingStation: (batchId: string) => void;
  onOpenPrintSheet: (details: PickingBatchDetails) => void;
}

export const PickingBatchListModal: React.FC<PickingBatchListModalProps> = ({
  isOpen,
  onClose,
  onOpenPickingStation,
  onOpenPrintSheet
}) => {
  const [batches, setBatches] = useState<PickingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPickingBatches();
      setBatches(res.batches);
    } catch (err: any) {
      setError(err.message || 'Failed to load picking batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBatches();
    }
  }, [isOpen]);

  const handlePrintSheet = async (batchId: string) => {
    try {
      const details = await api.getPickingBatchDetails(batchId);
      onOpenPrintSheet(details);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch batch details for printing');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5 text-indigo-600" />
          <span>Warehouse Picking Batches</span>
        </div>
      }
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              Active & Completed Picking Sessions
            </h4>
            <p className="text-xs text-gray-500">
              Manage multi-order picking waves, open interactive scan-out stations, or print location-ordered manifests.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={loadBatches} className="flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-2"></div>
            <div>Loading picking batches...</div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        ) : batches.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <div className="text-sm font-semibold text-gray-700">No Picking Batches Found</div>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Select orders in "To Fulfill" state from the Orders table and click "Create Picking Batch" to start a new picking wave.
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[460px] overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Batch Number</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Orders</th>
                  <th className="py-3 px-4 text-center">Progress</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {batches.map(batch => {
                  const isDone = batch.status === 'completed';
                  const percent = batch.total_units_count > 0
                    ? Math.round((batch.picked_units_count / batch.total_units_count) * 100)
                    : 0;

                  return (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        {batch.batch_number}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={isDone ? 'success' : 'neutral'}
                          className="uppercase font-mono text-[10px]"
                        >
                          {isDone ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Completed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Active
                            </span>
                          )}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {batch.order_ids.length} order(s)
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-20 bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${isDone ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="font-mono text-gray-700 text-[11px]">
                            {batch.picked_units_count}/{batch.total_units_count}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{batch.created_by_name}</td>
                      <td className="py-3 px-4 text-gray-500 text-[11px]">
                        {new Date(batch.created_at).toLocaleDateString('en-PK')}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handlePrintSheet(batch.id)}
                          className="text-xs"
                          title="Print location-sorted picking manifest"
                        >
                          <Printer className="w-3 h-3 mr-1" />
                          Sheet
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            onClose();
                            onOpenPickingStation(batch.id);
                          }}
                          className="text-xs"
                        >
                          <Barcode className="w-3 h-3 mr-1" />
                          {isDone ? 'Review' : 'Pick Station'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-3 border-t border-gray-200 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
