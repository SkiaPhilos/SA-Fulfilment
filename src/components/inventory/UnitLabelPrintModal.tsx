import React, { useEffect, useRef, useState } from 'react';
import { UnitLabelData, api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import {
  Printer,
  X,
  Tag,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Layers
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { printHtmlDocument, generateBarcodeSvgString } from '../../lib/printUtils';

interface UnitLabelPrintModalProps {
  unitIds?: string[];
  batchId?: string;
  productId?: string;
  onClose: () => void;
}

export const UnitLabelPrintModal: React.FC<UnitLabelPrintModalProps> = ({
  unitIds,
  batchId,
  productId,
  onClose
}) => {
  const [labels, setLabels] = useState<UnitLabelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  const previewSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    api.getUnitLabels({ unitIds, batchId, productId })
      .then(async (res) => {
        if (!mounted) return;
        setLabels(res.labels);

        // Pre-generate QR codes for each label
        const urls: Record<string, string> = {};
        for (const lbl of res.labels) {
          try {
            urls[lbl.unitId] = await QRCode.toDataURL(lbl.qrPayload, {
              margin: 1,
              width: 130,
              errorCorrectionLevel: 'M'
            });
          } catch (e) {
            console.error('QR code generation failed for unit:', lbl.trackingCode, e);
          }
        }
        if (mounted) {
          setQrDataUrls(urls);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to fetch unit labels.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [unitIds, batchId]);

  // Render barcode in preview whenever currentIndex or labels change
  useEffect(() => {
    if (labels.length === 0 || !labels[currentIndex] || !previewSvgRef.current) return;
    const current = labels[currentIndex];
    try {
      JsBarcode(previewSvgRef.current, current.barcodeValue, {
        format: 'CODE128',
        lineColor: '#000000',
        width: 1.8,
        height: 48,
        displayValue: true,
        font: 'monospace',
        fontSize: 11,
        textMargin: 3,
        margin: 0
      });
    } catch (err) {
      console.error('Preview barcode error:', err);
    }
  }, [labels, currentIndex]);

  /**
   * Generates clean, printer-ready HTML markup for an array of UnitLabelData
   */
  const buildPrintHtml = (targetLabels: UnitLabelData[]) => {
    return targetLabels
      .map((lbl, idx) => {
        const barcodeSvg = generateBarcodeSvgString(lbl.barcodeValue, {
          height: 44,
          width: 1.7,
          displayValue: true,
          fontSize: 10
        });
        const qrUrl = qrDataUrls[lbl.unitId] || '';
        const isLast = idx === targetLabels.length - 1;

        return `
          <div class="label-container ${!isLast ? 'page-break' : ''}">
            <div class="header">
              <div class="brand-left">
                <span class="logo-title">SHIP ASAAN</span>
                <span class="divider">|</span>
                <span class="merchant-name">${lbl.customerBrand || 'FULFILLMENT'}</span>
              </div>
              <div class="condition-badge">${lbl.condition.toUpperCase()}</div>
            </div>

            <div class="item-details">
              <div class="sku-code">${lbl.productSku}</div>
              <div class="product-title">${lbl.productName}</div>
            </div>

            <div class="codes-row">
              <div class="barcode-wrapper">
                ${barcodeSvg}
              </div>
              ${
                qrUrl
                  ? `<div class="qr-wrapper"><img src="${qrUrl}" alt="QR" width="56" height="56" /></div>`
                  : ''
              }
            </div>

            <div class="footer">
              <span>RCVD: ${new Date(lbl.receivedAt).toLocaleDateString()}</span>
              <span class="tracking-id">${lbl.trackingCode}</span>
            </div>
          </div>
        `;
      })
      .join('');
  };

  const labelCustomCss = `
    .label-container {
      width: 4in;
      height: 2.1in;
      box-sizing: border-box;
      padding: 0.12in 0.15in;
      border: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      margin: 0 auto;
      background: #ffffff;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #0f172a;
      padding-bottom: 3px;
    }
    .brand-left {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .logo-title {
      font-size: 11px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .divider {
      color: #94a3b8;
      font-size: 10px;
    }
    .merchant-name {
      font-size: 10px;
      font-weight: 700;
      color: #1e293b;
      text-transform: uppercase;
      max-width: 170px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .condition-badge {
      font-size: 9px;
      font-family: monospace;
      font-weight: 700;
      border: 1px solid #0f172a;
      padding: 1px 4px;
      border-radius: 2px;
    }
    .item-details {
      margin: 3px 0;
    }
    .sku-code {
      font-family: monospace;
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.2px;
    }
    .product-title {
      font-size: 10px;
      color: #334155;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 1px;
    }
    .codes-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
      padding-top: 3px;
      gap: 8px;
    }
    .barcode-wrapper {
      flex: 1;
      display: flex;
      justify-content: center;
      max-width: 250px;
    }
    .barcode-wrapper svg {
      max-width: 100%;
      height: auto;
    }
    .qr-wrapper {
      border: 1px solid #cbd5e1;
      padding: 1px;
      border-radius: 2px;
      line-height: 0;
    }
    .footer {
      border-top: 1px solid #0f172a;
      padding-top: 2px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: monospace;
      font-size: 8.5px;
      color: #475569;
    }
    .tracking-id {
      font-weight: 800;
      color: #0f172a;
    }
  `;

  /**
   * Print all labels in batch
   */
  const handlePrintAll = async () => {
    if (labels.length === 0) return;
    setPrinting(true);
    try {
      const html = buildPrintHtml(labels);
      await printHtmlDocument({
        title: `ShipAsaan_Unit_Labels_${labels.length}Units`,
        html,
        pageSize: '4in 2in',
        orientation: 'portrait',
        customCss: labelCustomCss
      });
    } finally {
      setPrinting(false);
    }
  };

  /**
   * Print only the currently viewed label
   */
  const handlePrintSingle = async () => {
    if (!currentLabel) return;
    setPrinting(true);
    try {
      const html = buildPrintHtml([currentLabel]);
      await printHtmlDocument({
        title: `ShipAsaan_Unit_${currentLabel.trackingCode}`,
        html,
        pageSize: '4in 2in',
        orientation: 'portrait',
        customCss: labelCustomCss
      });
    } finally {
      setPrinting(false);
    }
  };

  const currentLabel = labels[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-2xs">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Print Stock Barcode Labels {labels.length > 0 && `(${labels.length} Total Units)`}
              </h2>
              <p className="text-xs text-slate-500">
                Standard 4" × 2" thermal unit tracking labels with scannable Code128 and QR
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrintAll}
              disabled={labels.length === 0 || loading || printing}
              loading={printing}
              className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print All Labels ({labels.length})</span>
            </Button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {loading && (
            <div className="py-16 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-xs font-medium text-slate-600">
                Generating Code128 barcodes and cryptographic QR tokens...
              </div>
            </div>
          )}

          {error && (
            <Notice variant="error" title="Label Generation Error">
              {error}
            </Notice>
          )}

          {!loading && !error && labels.length === 0 && (
            <Notice variant="info" title="No Units Available">
              No physical inventory units found for the requested criteria.
            </Notice>
          )}

          {!loading && labels.length > 0 && currentLabel && (
            <div className="space-y-4">
              {/* Pagination & Counter Bar */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Previewing:</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
                    Unit {currentIndex + 1} of {labels.length}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    ({currentLabel.trackingCode})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="p-1 px-2 text-xs font-medium rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Prev</span>
                  </button>
                  <button
                    onClick={() => setCurrentIndex((prev) => Math.min(labels.length - 1, prev + 1))}
                    disabled={currentIndex === labels.length - 1}
                    className="p-1 px-2 text-xs font-medium rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrintSingle}
                    disabled={printing}
                    className="ml-2 text-slate-700 hover:text-slate-900 border-slate-300"
                  >
                    <Printer className="w-3 h-3 text-slate-500" />
                    <span>Print This Label</span>
                  </Button>
                </div>
              </div>

              {/* High-Fidelity 4x2 Thermal Label Card Preview */}
              <div className="border-2 border-dashed border-slate-300 p-6 rounded-xl bg-slate-50/70 flex justify-center">
                <div className="w-[384px] bg-white border border-slate-900 p-4 shadow-md rounded-sm flex flex-col justify-between">
                  {/* Top brand header */}
                  <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs tracking-tight text-slate-900">
                        SHIP ASAAN
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-[11px] font-bold text-slate-800 uppercase truncate max-w-[150px]">
                        {currentLabel.customerBrand || 'FULFILLMENT'}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-slate-800 text-slate-900 font-bold uppercase">
                      {currentLabel.condition}
                    </span>
                  </div>

                  {/* SKU & Title */}
                  <div className="mb-2">
                    <div className="text-sm font-extrabold font-mono tracking-tight text-slate-900">
                      {currentLabel.productSku}
                    </div>
                    <div className="text-xs text-slate-700 truncate font-semibold mt-0.5">
                      {currentLabel.productName}
                    </div>
                  </div>

                  {/* Barcode & QR Code Layout */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
                    <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
                      <svg ref={previewSvgRef} className="max-w-[210px] w-full" />
                    </div>

                    {qrDataUrls[currentLabel.unitId] && (
                      <div className="border border-slate-300 p-0.5 rounded bg-white shrink-0">
                        <img
                          src={qrDataUrls[currentLabel.unitId]}
                          alt="Unit QR Code"
                          className="w-14 h-14 object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Bottom Footer Info */}
                  <div className="mt-2 pt-1 border-t border-slate-900 flex items-center justify-between text-[9px] text-slate-600 font-mono font-medium">
                    <span>RCVD: {new Date(currentLabel.receivedAt).toLocaleDateString()}</span>
                    <span className="font-bold text-slate-900">{currentLabel.trackingCode}</span>
                  </div>
                </div>
              </div>

              {/* Print Info Banner */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Thermal Printer Ready: </span>
                  Clicking <strong>"Print All Labels"</strong> directly streams clean 4" × 2" pages to your thermal or label printer without dialog clipping or page bleeding.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-mono">
            {labels.length > 0 && `${labels.length} labels queued`}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrintAll}
              disabled={labels.length === 0 || loading || printing}
              loading={printing}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print All ({labels.length})</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
