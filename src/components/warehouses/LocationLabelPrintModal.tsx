import React, { useEffect, useRef, useState } from 'react';
import { LocationLabelData, api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Printer, X, Copy, Check, QrCode } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { printHtmlDocument, generateBarcodeSvgString } from '../../lib/printUtils';

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
  const [printing, setPrinting] = useState(false);
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
          height: 50,
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

  const handlePrint = async () => {
    if (!data) return;
    setPrinting(true);
    try {
      const barcodeSvg = generateBarcodeSvgString(data.barcodeString, {
        height: 48,
        width: 1.8,
        displayValue: true,
        fontSize: 11
      });

      const html = `
        <div class="location-label">
          <div class="loc-header">
            <div>
              <div class="warehouse-name">${data.warehouse.name} (${data.warehouse.code})</div>
              <div class="loc-code">${data.location.code}</div>
            </div>
            <div class="type-box">
              <div class="loc-type">${data.location.type.toUpperCase()}</div>
              <div class="loc-lvl">LVL ${data.location.level}</div>
            </div>
          </div>

          <div class="loc-mid">
            <div class="qr-box">
              <img src="${data.qrDataUrl}" width="80" height="80" alt="QR" />
            </div>
            <div class="path-box">
              <div class="path-title">HIERARCHY PATH</div>
              <div class="path-text">${data.location.path}</div>
              <div class="meta-row">
                <span>DIMS: ${data.location.dimensions.length_cm}×${data.location.dimensions.width_cm}×${data.location.dimensions.height_cm}cm</span>
                <span>MAX: ${data.location.max_weight_kg}kg / ${data.location.max_units} units</span>
              </div>
            </div>
          </div>

          <div class="barcode-box">
            ${barcodeSvg}
          </div>
        </div>
      `;

      const customCss = `
        .location-label {
          width: 4in;
          height: 2.2in;
          box-sizing: border-box;
          padding: 0.12in 0.15in;
          border: 1px solid #000;
          background: #fff;
          color: #000;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .loc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #000;
          padding-bottom: 2px;
        }
        .warehouse-name {
          font-size: 8px;
          font-weight: 800;
          color: #555;
          text-transform: uppercase;
        }
        .loc-code {
          font-size: 16px;
          font-family: monospace;
          font-weight: 900;
          letter-spacing: -0.5px;
        }
        .type-box {
          text-align: right;
        }
        .loc-type {
          background: #000;
          color: #fff;
          font-size: 8px;
          font-weight: 800;
          padding: 2px 4px;
          border-radius: 2px;
          display: inline-block;
        }
        .loc-lvl {
          font-size: 8px;
          font-family: monospace;
          color: #555;
          margin-top: 1px;
        }
        .loc-mid {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 3px 0;
          border-bottom: 1px solid #ddd;
        }
        .qr-box {
          border: 1px solid #ccc;
          padding: 1px;
          border-radius: 2px;
          line-height: 0;
        }
        .path-box {
          flex: 1;
        }
        .path-title {
          font-size: 7.5px;
          font-weight: 800;
          color: #666;
        }
        .path-text {
          font-size: 9.5px;
          font-weight: 700;
          line-height: 1.25;
        }
        .meta-row {
          font-family: monospace;
          font-size: 7.5px;
          color: #555;
          margin-top: 3px;
          display: flex;
          gap: 8px;
        }
        .barcode-box {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .barcode-box svg {
          max-width: 100%;
          height: auto;
        }
      `;

      await printHtmlDocument({
        title: `Location_${data.location.code}`,
        html,
        pageSize: '4in 2in',
        orientation: 'portrait',
        customCss
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Warehouse Location Label</h2>
              <p className="text-xs text-slate-500">Scan-ready 4" × 2" thermal bin & rack standard</p>
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
          <div className="p-4">
            <Notice variant="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Rendering high-resolution vector codes...
          </div>
        ) : data ? (
          <div className="p-6 space-y-4">
            {/* The Actual Physical Label (Preview) */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 bg-white text-slate-900 shadow-xs relative">
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
                      <span>
                        {data.location.dimensions.length_cm}×{data.location.dimensions.width_cm}×{data.location.dimensions.height_cm} cm
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Max Load</span>
                      <span>
                        {data.location.max_weight_kg} kg / {data.location.max_units} units
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Section: 1D Code 128 Barcode for handheld laser scanners */}
              <div className="pt-3 text-center flex flex-col items-center justify-center">
                <svg ref={barcodeSvgRef} className="max-w-full" />
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
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
                  disabled={printing}
                  loading={printing}
                  icon={<Printer className="w-4 h-4" />}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white"
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
