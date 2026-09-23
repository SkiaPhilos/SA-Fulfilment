import React, { useEffect, useRef, useState } from 'react';
import { LocationLabelData, api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Printer, X, Copy, Check, QrCode, Tag, ArrowRight } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface LocationLabelPrintModalProps {
  locationId: string;
  onClose: () => void;
}

export const LocationLabelPrintModal: React.FC<LocationLabelPrintModalProps> = ({
  locationId,
  onClose
}) => {
  const [data, setData] = useState<LocationLabelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let mounted = true;
    api.getLocationLabel(locationId)
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to generate location label.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [locationId]);

  useEffect(() => {
    if (data && barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, data.barcodeString, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 1.8,
          height: 52,
          displayValue: true,
          font: 'monospace',
          fontSize: 12,
          textMargin: 4,
          margin: 0
        });
      } catch (err) {
        console.error('Barcode rendering error:', err);
      }
    }
  }, [data]);

  const handleCopyBarcode = () => {
    if (data) {
      navigator.clipboard.writeText(data.barcodeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header (Hidden on print) */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Warehouse Location Label</h2>
              <p className="text-xs text-slate-500">Scan-ready 4x2" thermal label standard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-4 print:hidden">
            <Notice variant="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 print:hidden">
            Rendering high-resolution vector codes...
          </div>
        ) : data ? (
          <div className="p-6">
            {/* The Actual Physical Label (Print Target) */}
            <div
              id="printable-location-label"
              className="border-2 border-dashed border-slate-300 rounded-lg p-5 bg-white text-slate-900 shadow-xs relative print:border-none print:shadow-none print:p-0"
            >
              {/* Header: Facility & Type */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2 mb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    {data.warehouse.name} ({data.warehouse.code})
                  </span>
                  <span className="text-xl font-black font-mono tracking-tight text-slate-950 block mt-0.5">
                    {data.location.code}
                  </span>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 bg-slate-900 text-white font-bold font-mono text-[10px] rounded uppercase">
                    {data.location.type}
                  </span>
                  <span className="block text-[10px] text-slate-500 font-mono mt-1">
                    Lvl {data.location.level}
                  </span>
                </div>
              </div>

              {/* Middle Section: QR Code + Canonical Hierarchy Path */}
              <div className="flex items-center gap-4 py-2 border-b border-slate-200">
                <div className="shrink-0 p-1 bg-white border border-slate-200 rounded">
                  <img
                    src={data.qrDataUrl}
                    alt={`QR Code for ${data.location.code}`}
                    className="w-24 h-24 object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Full Hierarchy Path
                  </div>
                  <div className="text-xs font-semibold text-slate-800 leading-snug mt-1 break-words">
                    {data.location.path}
                  </div>

                  {/* Physical Capacity Metadata */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] font-mono text-slate-600 bg-slate-50 p-2 rounded">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Dims (LxWxH)</span>
                      <span>{data.location.dimensions.length_cm}x{data.location.dimensions.width_cm}x{data.location.dimensions.height_cm} cm</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Max Load</span>
                      <span>{data.location.max_weight_kg} kg / {data.location.max_units} units</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Section: 1D Code 128 Barcode for handheld laser scanners */}
              <div className="pt-3 text-center flex flex-col items-center justify-center">
                <svg ref={barcodeSvgRef} className="max-w-full" />
              </div>
            </div>

            {/* Quick Action Buttons (Hidden on print) */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyBarcode}
                icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copied ? 'Copied Barcode' : 'Copy Barcode'}
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Done
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handlePrint}
                  icon={<Printer className="w-4 h-4" />}
                >
                  Print Label
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
