import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { DispatchManifestDetails } from '../../lib/api';
import { Button } from '../ui/Button';
import { Printer, X, Truck, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { printHtmlDocument } from '../../lib/printUtils';

interface DispatchManifestPrintModalProps {
  manifestDetails: DispatchManifestDetails;
  onClose: () => void;
  onSignAndDispatch?: () => void;
  canSignAndDispatch?: boolean;
}

export const DispatchManifestPrintModal: React.FC<DispatchManifestPrintModalProps> = ({
  manifestDetails,
  onClose,
  onSignAndDispatch,
  canSignAndDispatch
}) => {
  const { manifest, orders, summary } = manifestDetails;
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const printableAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, manifest.manifest_number, {
          format: 'CODE128',
          width: 1.8,
          height: 48,
          displayValue: true,
          font: 'monospace',
          fontSize: 13,
          margin: 0
        });
      } catch (e) {
        console.error('Barcode render error:', e);
      }
    }

    if (qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        JSON.stringify({
          manifest: manifest.manifest_number,
          carrier: manifest.carrier_name,
          orders: manifest.total_orders,
          cod: manifest.total_cod_amount
        }),
        { width: 80, margin: 0 }
      ).catch(e => console.error('QR code render error:', e));
    }
  }, [manifest]);

  const handlePrint = async () => {
    if (printableAreaRef.current) {
      await printHtmlDocument({
        title: `Carrier_Manifest_${manifest.manifest_number}`,
        html: printableAreaRef.current.innerHTML,
        pageSize: 'A4',
        orientation: 'portrait',
        customCss: `
          body { font-size: 11px; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
          th { background: #f8fafc; font-weight: 700; font-size: 10px; }
          .grid-cols-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
          .grid-cols-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        `
      });
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Modal Toolbar (hidden on print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Official Carrier Handover Manifest & Delivery Run-Sheet
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                {manifest.manifest_number} • {manifest.carrier_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canSignAndDispatch && manifest.status === 'draft' && onSignAndDispatch && (
              <Button
                variant="primary"
                size="sm"
                onClick={onSignAndDispatch}
                className="bg-emerald-700 hover:bg-emerald-800"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Sign & Dispatch Handover
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print Manifest (A4)
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Document */}
        <div ref={printableAreaRef} className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible text-slate-900 text-xs">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-slate-900 text-white font-black px-2 py-0.5 rounded text-sm tracking-wider">
                  SHIP ASAAN
                </span>
                <span className="font-semibold text-slate-800 text-sm">
                  CARRIER HANDOVER MANIFEST
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Central Fulfillment & Cross-Dock Hub • Islamabad / Rawalpindi
              </div>
              <div className="text-[10px] text-slate-400">
                Official Consignment Handoff & Courier Custody Transfer Document
              </div>
            </div>

            <div className="flex flex-col items-end">
              <svg ref={barcodeRef} className="h-12"></svg>
              <div className="text-[10px] font-mono text-slate-500 mt-1">
                Date: {new Date(manifest.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Meta Information Cards */}
          <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Carrier Service</div>
              <div className="text-sm font-bold text-slate-900">{manifest.carrier_name}</div>
              <div className="text-[11px] text-slate-600">
                Status:{' '}
                <span className={`font-semibold capitalize ${manifest.status === 'signed_dispatched' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {manifest.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Driver / Vehicle</div>
              <div className="text-xs font-semibold text-slate-800">
                {manifest.driver_name || 'Designated Courier Representative'}
              </div>
              <div className="text-[11px] text-slate-600">
                Phone: {manifest.driver_phone || 'N/A'} • Vehicle: {manifest.vehicle_number || 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Consignment Summary</div>
              <div className="text-xs font-semibold text-slate-800">
                Total Parcels: <span className="font-bold text-slate-900">{summary.total_orders}</span> (Pieces: {summary.total_pieces_count})
              </div>
              <div className="text-[11px] font-bold text-emerald-700">
                COD Remittance: PKR {summary.total_cod_amount.toLocaleString()} ({summary.cod_orders_count} COD / {summary.prepaid_orders_count} Prepaid)
              </div>
            </div>
          </div>

          {manifest.handover_notes && (
            <div className="mb-4 p-2 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[11px]">
              <span className="font-semibold">Handover Notes:</span> {manifest.handover_notes}
            </div>
          )}

          {/* Orders Table */}
          <table className="w-full text-left border-collapse border border-slate-300 mb-6">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 text-[10px] uppercase font-bold">
                <th className="py-2 px-2 border-r border-slate-300 w-8 text-center">#</th>
                <th className="py-2 px-2 border-r border-slate-300">Order / External Ref</th>
                <th className="py-2 px-2 border-r border-slate-300">Merchant Brand</th>
                <th className="py-2 px-2 border-r border-slate-300">Consignee & Destination</th>
                <th className="py-2 px-2 border-r border-slate-300 w-16 text-center">Pieces</th>
                <th className="py-2 px-2 border-r border-slate-300 w-24">Type</th>
                <th className="py-2 px-2 border-r border-slate-300 w-28 text-right">COD Amount</th>
                <th className="py-2 px-2 w-28 text-center">Receiver Tick</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-50 text-[11px]">
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono text-slate-500">
                    {ord.sequence}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 font-mono font-medium">
                    <div className="font-bold text-slate-900">{ord.order_number}</div>
                    {ord.customer_reference && ord.customer_reference !== '-' && (
                      <div className="text-[10px] text-slate-500">Ext: {ord.customer_reference}</div>
                    )}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-slate-700 font-medium">
                    {ord.customer_brand}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300">
                    <div className="font-semibold text-slate-900">{ord.consignee_name}</div>
                    <div className="text-[10px] text-slate-600 truncate max-w-xs">
                      {ord.city} • {ord.consignee_phone}
                    </div>
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-bold">
                    {ord.total_pieces}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 uppercase font-semibold text-[10px]">
                    <span className={ord.payment_method === 'cod' ? 'text-amber-800' : 'text-blue-800'}>
                      {ord.payment_method}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono font-bold">
                    {ord.payment_method === 'cod' ? `PKR ${ord.cod_amount.toLocaleString()}` : '0.00'}
                  </td>
                  <td className="py-1.5 px-2 text-center border-slate-300">
                    <div className="w-5 h-5 mx-auto border border-slate-400 rounded"></div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-[11px]">
                <td colSpan={4} className="py-2 px-2 text-right">
                  TOTALS:
                </td>
                <td className="py-2 px-2 text-center">{summary.total_pieces_count}</td>
                <td className="py-2 px-2">{summary.total_orders} Orders</td>
                <td className="py-2 px-2 text-right font-mono text-emerald-800 font-bold">
                  PKR {summary.total_cod_amount.toLocaleString()}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          {/* Legal Signatures Block */}
          <div className="mt-8 pt-4 border-t-2 border-slate-400 grid grid-cols-2 gap-8 text-[11px] text-slate-700">
            <div>
              <div className="font-bold uppercase text-slate-900 mb-1">
                Handed Over By (Warehouse Dispatch Officer):
              </div>
              <div className="border-b border-slate-400 h-10 mb-1"></div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Name: {manifest.created_by_name}</span>
                <span>Date: _______________</span>
              </div>
            </div>

            <div>
              <div className="font-bold uppercase text-slate-900 mb-1">
                Received In Good Condition By (Carrier Courier Driver):
              </div>
              <div className="border-b border-slate-400 h-10 mb-1"></div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Driver Name / Signature: ___________________</span>
                <span>CNIC: _______________</span>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-[10px] text-slate-400">
            Ship Asaan Logistics • Licensed & Authoritative Cloud Courier System • Generated {new Date().toISOString()}
          </div>
        </div>
      </div>
    </div>
  );
};
