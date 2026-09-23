import React, { useRef, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Printer, MapPin, Package, CheckSquare } from 'lucide-react';
import { PickingBatchDetails } from '../../lib/api';
import JsBarcode from 'jsbarcode';

interface WarehousePickingSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: PickingBatchDetails | null;
}

export const WarehousePickingSheetModal: React.FC<WarehousePickingSheetModalProps> = ({
  isOpen,
  onClose,
  details
}) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (isOpen && details?.batch?.batch_number && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, details.batch.batch_number, {
          format: 'CODE128',
          width: 1.8,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 4
        });
      } catch (err) {
        console.error('Failed to generate batch barcode', err);
      }
    }
  }, [isOpen, details]);

  if (!details) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-600" />
          <span>Warehouse Picking Manifest: {details.batch.batch_number}</span>
        </div>
      }
      size="xl"
    >
      <div className="space-y-6">
        {/* Print Controls Bar (hidden during print) */}
        <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-lg print:hidden">
          <div>
            <h4 className="text-sm font-semibold text-indigo-900">Printable Picking Manifest</h4>
            <p className="text-xs text-indigo-700">
              Formatted for standard A4 and clipboard clipping. Items are sorted sequentially by warehouse rack and bin path.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" onClick={handlePrint} className="flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Print Manifest
            </Button>
          </div>
        </div>

        {/* The Printable Manifest Document */}
        <div className="p-6 bg-white border border-gray-300 rounded-lg shadow-sm print:border-none print:shadow-none print:p-0">
          {/* Header */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-black tracking-wider text-gray-900">SHIP ASAAN</span>
                <span className="text-xs px-2 py-0.5 font-bold uppercase tracking-wider bg-gray-900 text-white rounded">
                  Logistics WMS
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-800 uppercase">Warehouse Picking Sheet</h2>
              <p className="text-xs text-gray-500 mt-1">
                Generated: {new Date(details.batch.created_at).toLocaleString('en-PK')} | Operator: {details.batch.created_by_name}
              </p>
            </div>
            <div className="text-right">
              <svg ref={barcodeRef} className="inline-block" />
              <div className="text-xs font-mono text-gray-600 mt-1 font-semibold">
                Status: <span className="uppercase">{details.batch.status}</span>
              </div>
            </div>
          </div>

          {/* Key Metrics Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6 text-center border border-gray-200 rounded-md p-3 bg-gray-50">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase">Total Orders</div>
              <div className="text-lg font-bold text-gray-900">{details.orders.length}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase">Storage Locations</div>
              <div className="text-lg font-bold text-gray-900">{details.pickLocations.length}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase">Total Units to Pick</div>
              <div className="text-lg font-bold text-indigo-700">{details.totalUnits}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase">Picked So Far</div>
              <div className="text-lg font-bold text-emerald-700">
                {details.pickedUnits} / {details.totalUnits}
              </div>
            </div>
          </div>

          {/* Orders Included in this Batch */}
          <div className="mb-6">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Orders in This Batch ({details.orders.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {details.orders.map(order => (
                <div key={order.id} className="p-2 border border-gray-200 rounded bg-white">
                  <div className="font-mono font-bold text-gray-900">{order.order_number}</div>
                  <div className="text-gray-700 font-medium truncate">{order.consignee_name}</div>
                  <div className="text-gray-500 flex justify-between">
                    <span>{order.city}</span>
                    <span className="font-semibold">{order.total_pieces} pcs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Location-Sorted Pick List */}
          <div>
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
              Location-Optimized Pick Path
            </h3>

            <div className="space-y-6">
              {details.pickLocations.map((loc, idx) => (
                <div key={loc.locationId || idx} className="border border-gray-300 rounded-md overflow-hidden">
                  {/* Location Header */}
                  <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-400" />
                      <span className="font-mono font-bold tracking-wider text-sm">{loc.locationCode}</span>
                      <span className="text-xs text-gray-300 font-normal">({loc.locationPath})</span>
                    </div>
                    <Badge variant="neutral" className="text-xs bg-gray-700 text-gray-200 border-none">
                      Stop #{idx + 1}
                    </Badge>
                  </div>

                  {/* Items at this Location */}
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 text-gray-600 border-b border-gray-300">
                      <tr>
                        <th className="py-2 px-3 w-12 text-center">Check</th>
                        <th className="py-2 px-3 font-semibold">SKU / Product</th>
                        <th className="py-2 px-3 font-semibold text-center w-20">Qty</th>
                        <th className="py-2 px-3 font-semibold">Unit Tracking IDs to Pick</th>
                        <th className="py-2 px-3 font-semibold">Destination Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loc.items.map((item, itemIdx) => (
                        <tr key={itemIdx} className="hover:bg-gray-50">
                          <td className="py-2 px-3 text-center">
                            <div className="w-5 h-5 border-2 border-gray-400 rounded inline-block"></div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-mono font-bold text-gray-900">{item.sku}</div>
                            <div className="text-gray-600 truncate max-w-xs">{item.productName}</div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-sm font-bold text-gray-900">{item.totalUnitsRequired}</span>
                            {item.pickedUnitsCount > 0 && (
                              <div className="text-[10px] text-emerald-600">
                                ({item.pickedUnitsCount} picked)
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1">
                              {item.units.map(u => (
                                <span
                                  key={u.unitId}
                                  className={`px-1.5 py-0.5 rounded font-mono text-[11px] border ${
                                    u.state === 'picked'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 line-through'
                                      : 'bg-gray-100 text-gray-800 border-gray-300'
                                  }`}
                                >
                                  {u.trackingCode}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono text-gray-700">
                            {item.units.map(u => (
                              <div key={u.unitId} className="text-[11px] truncate">
                                {u.orderNumber} ({u.consigneeName})
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>

          {/* Sign-off Footer */}
          <div className="mt-8 pt-4 border-t-2 border-gray-300 grid grid-cols-2 gap-8 text-xs text-gray-600">
            <div>
              <span className="font-semibold">Picker Name / Signature:</span> __________________________
            </div>
            <div className="text-right">
              <span className="font-semibold">Date & Time Completed:</span> __________________________
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
