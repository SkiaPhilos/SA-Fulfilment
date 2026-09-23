import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Printer, Tag, CheckCircle2, PackageCheck } from 'lucide-react';
import { ShippingLabelData } from '../../lib/api';
import QRCode from 'qrcode';
import { printHtmlDocument, generateBarcodeSvgString } from '../../lib/printUtils';

interface ShippingLabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  labels: ShippingLabelData[];
}

export const ShippingLabelPrintModal: React.FC<ShippingLabelPrintModalProps> = ({
  isOpen,
  onClose,
  labels
}) => {
  const [printing, setPrinting] = useState(false);
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!labels || labels.length === 0) return;

    let active = true;
    const generateQrs = async () => {
      const mapping: Record<string, string> = {};
      for (const lbl of labels) {
        try {
          const qrPayload = JSON.stringify({
            order: lbl.orderNumber,
            ref: lbl.customerReference,
            cod: lbl.codAmount,
            consignee: lbl.consigneeName,
            phone: lbl.consigneePhone,
            city: lbl.city
          });
          mapping[lbl.orderId] = await QRCode.toDataURL(qrPayload, {
            width: 140,
            margin: 1,
            errorCorrectionLevel: 'M'
          });
        } catch (e) {
          console.error('QR generation error for order:', lbl.orderNumber, e);
        }
      }
      if (active) setQrUrls(mapping);
    };

    generateQrs();
    return () => {
      active = false;
    };
  }, [labels]);

  if (!isOpen || !labels || labels.length === 0) return null;

  const buildPrintHtml = () => {
    return labels
      .map((label, idx) => {
        const isCod = label.paymentMethod === 'cod' && label.codAmount > 0;
        const barcodeSvg = generateBarcodeSvgString(label.orderNumber, {
          height: 48,
          width: 2.0,
          displayValue: true,
          fontSize: 13
        });
        const qrImg = qrUrls[label.orderId];
        const isLast = idx === labels.length - 1;

        const itemsRows = label.items
          .map(
            (item) => `
            <div class="item-row">
              <span class="item-desc"><strong>${item.sku}</strong> — ${item.name}</span>
              <span class="item-qty">x${item.quantity}</span>
            </div>
          `
          )
          .join('');

        return `
          <div class="shipping-label ${!isLast ? 'page-break' : ''}">
            <!-- Top Header -->
            <div class="top-header">
              <div class="brand-badge">
                <span class="brand-name">SHIP ASAAN</span>
                <span class="service-tag">EXPRESS COURIER</span>
              </div>
              <div class="dest-hub-top">
                <div class="city-name">${label.city.toUpperCase()}</div>
                <div class="service-type">STANDARD 24-48H</div>
              </div>
            </div>

            <!-- Shipper & Destination Grid -->
            <div class="shipper-dest-grid">
              <div class="shipper-col">
                <div class="section-label">SHIPPER / MERCHANT</div>
                <div class="shipper-name">${label.shipper.brandName || label.shipper.businessName}</div>
                <div class="shipper-city">${label.shipper.city || ''} ${label.shipper.phone ? `· ${label.shipper.phone}` : ''}</div>
                ${label.customerReference ? `<div class="ref-num">REF: <strong>${label.customerReference}</strong></div>` : ''}
              </div>
              <div class="hub-box">
                <div class="section-label">DESTINATION HUB</div>
                <div class="hub-city">${label.city.toUpperCase()}</div>
                <div class="hub-province">${label.province || 'PK'}</div>
              </div>
            </div>

            <!-- Consignee Recipient Section -->
            <div class="consignee-section">
              <div class="section-label">DELIVER TO (CONSIGNEE)</div>
              <div class="consignee-name">${label.consigneeName}</div>
              <div class="consignee-address">${label.shippingAddress}</div>
              <div class="consignee-phone-row">
                <div><span>TEL: </span><strong class="phone-number">${label.consigneePhone}</strong></div>
                ${label.postalCode ? `<div>POSTAL: <strong>${label.postalCode}</strong></div>` : ''}
              </div>
            </div>

            <!-- Barcode & QR Row -->
            <div class="codes-section">
              <div class="barcode-box">
                ${barcodeSvg}
              </div>
              ${qrImg ? `<div class="qr-box"><img src="${qrImg}" width="68" height="68" alt="QR" /></div>` : ''}
            </div>

            <!-- Financials / COD and Pieces -->
            <div class="financials-grid">
              <div class="cod-box ${isCod ? 'cod-active' : 'prepaid-active'}">
                <div class="payment-title">PAYMENT METHOD</div>
                ${
                  isCod
                    ? `
                  <div class="cod-label">CASH ON DELIVERY (COD)</div>
                  <div class="cod-amount">PKR ${label.codAmount.toLocaleString('en-PK')}</div>
                `
                    : `
                  <div class="prepaid-label">PREPAID / WALLET PAID</div>
                  <div class="prepaid-sub">DO NOT COLLECT CASH</div>
                `
                }
              </div>
              <div class="pieces-box">
                <div>
                  <div class="section-label">TOTAL PIECES</div>
                  <div class="pieces-count">${label.totalPieces} PIECE(S)</div>
                </div>
                <div class="booking-date">BOOKED: ${new Date(label.createdAt).toLocaleDateString('en-PK')}</div>
              </div>
            </div>

            <!-- Manifest Breakdown of Items -->
            <div class="contents-section">
              <div class="contents-header">PACKAGE MANIFEST CONTENT (${label.items.length} SKUs):</div>
              <div class="items-list">${itemsRows}</div>
              ${label.shippingNotes ? `<div class="shipping-notes"><strong>NOTES:</strong> ${label.shippingNotes}</div>` : ''}
            </div>

            <!-- Legal Footer -->
            <div class="label-footer">
              <span>SHIP ASAAN FULFILLMENT NETWORK</span>
              <span>SCANNABLE PARCEL WAYBILL</span>
            </div>
          </div>
        `;
      })
      .join('');
  };

  const thermalShippingCss = `
    .shipping-label {
      width: 4in;
      height: 6in;
      box-sizing: border-box;
      padding: 0.18in 0.2in;
      margin: 0 auto;
      border: 2px solid #000000;
      background: #ffffff;
      color: #000000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    .top-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #000;
      padding-bottom: 5px;
    }
    .brand-badge {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .brand-name {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .service-tag {
      font-size: 9px;
      background: #000;
      color: #fff;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 2px;
    }
    .dest-hub-top {
      text-align: right;
    }
    .dest-hub-top .city-name {
      font-size: 14px;
      font-weight: 900;
    }
    .dest-hub-top .service-type {
      font-size: 8px;
      font-weight: 600;
      color: #555;
    }
    .shipper-dest-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 8px;
      border-bottom: 2px solid #000;
      padding: 6px 0;
    }
    .section-label {
      font-size: 8px;
      font-weight: 800;
      color: #555;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .shipper-name {
      font-size: 12px;
      font-weight: 800;
    }
    .shipper-city {
      font-size: 9.5px;
      color: #444;
    }
    .ref-num {
      font-size: 9.5px;
      font-family: monospace;
      margin-top: 3px;
    }
    .hub-box {
      border-left: 1px solid #999;
      padding-left: 8px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .hub-city {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .hub-province {
      font-size: 10px;
      font-weight: 600;
    }
    .consignee-section {
      border-bottom: 2px solid #000;
      padding: 6px 0;
    }
    .consignee-name {
      font-size: 14px;
      font-weight: 900;
      margin-bottom: 3px;
    }
    .consignee-address {
      font-size: 11px;
      line-height: 1.35;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .consignee-phone-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
    }
    .phone-number {
      font-size: 13px;
      font-family: monospace;
    }
    .codes-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #000;
      padding: 6px 0;
      gap: 8px;
    }
    .barcode-box {
      flex: 1;
      display: flex;
      justify-content: center;
    }
    .barcode-box svg {
      max-width: 100%;
      height: auto;
    }
    .qr-box {
      border: 1px solid #ccc;
      padding: 2px;
      border-radius: 2px;
      line-height: 0;
    }
    .financials-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      border-bottom: 2px solid #000;
      padding: 6px 0;
    }
    .cod-box {
      border: 2px solid #000;
      border-radius: 4px;
      padding: 4px;
      text-align: center;
    }
    .payment-title {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .cod-label {
      font-size: 9px;
      font-weight: 800;
      color: #990000;
    }
    .cod-amount {
      font-size: 16px;
      font-weight: 900;
      color: #990000;
    }
    .prepaid-label {
      font-size: 13px;
      font-weight: 900;
      color: #047857;
      margin-top: 2px;
    }
    .prepaid-sub {
      font-size: 8.5px;
      font-weight: 700;
      color: #047857;
    }
    .pieces-box {
      border: 1px solid #bbb;
      border-radius: 4px;
      padding: 4px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .pieces-count {
      font-size: 13px;
      font-weight: 900;
    }
    .booking-date {
      font-size: 8px;
      color: #666;
    }
    .contents-section {
      padding: 4px 0;
      font-size: 9px;
    }
    .contents-header {
      font-weight: 800;
      color: #444;
      margin-bottom: 2px;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dotted #ccc;
      padding: 1.5px 0;
    }
    .item-desc {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 280px;
    }
    .item-qty {
      font-weight: 800;
    }
    .shipping-notes {
      margin-top: 3px;
      padding: 2px 4px;
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 2px;
      font-size: 8.5px;
    }
    .label-footer {
      border-top: 1px solid #999;
      padding-top: 2px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5px;
      color: #666;
      font-family: monospace;
    }
  `;

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const html = buildPrintHtml();
      await printHtmlDocument({
        title: `ShipAsaan_Thermal_Labels_${labels.length}Orders`,
        html,
        pageSize: '4in 6in',
        orientation: 'portrait',
        customCss: thermalShippingCss
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-emerald-700" />
          <span>Print Thermal Shipping Labels ({labels.length})</span>
        </div>
      }
      size="xl"
    >
      <div className="space-y-5">
        {/* Action Header */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Courier Thermal Shipping Labels Ready</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-semibold px-2 py-0.5 rounded">
                4" × 6" Standard
              </span>
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Formatted for thermal label printers (Zebra, TSC, Rollo, Xprinter) with automatic pagination and scannable Code128 parcel barcodes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              disabled={printing}
              loading={printing}
              className="bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print All Labels ({labels.length})</span>
            </Button>
          </div>
        </div>

        {/* Printable Labels List (Scrollable On-Screen Preview) */}
        <div className="max-h-[65vh] overflow-y-auto p-4 bg-slate-100/70 rounded-lg space-y-6 flex flex-col items-center">
          {labels.map((lbl) => {
            const isCod = lbl.paymentMethod === 'cod' && lbl.codAmount > 0;
            const barcodeSvg = generateBarcodeSvgString(lbl.orderNumber, {
              height: 48,
              width: 1.9,
              displayValue: true,
              fontSize: 12
            });

            return (
              <div
                key={lbl.orderId}
                className="w-full max-w-[390px] bg-white border-2 border-slate-900 rounded-sm p-4 text-slate-900 text-xs shadow-md"
              >
                {/* Top Courier Bar */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm tracking-wider uppercase text-slate-900">
                      SHIP ASAAN
                    </span>
                    <span className="text-[9px] bg-slate-900 text-white px-1.5 py-0.5 font-bold uppercase rounded-xs">
                      Courier
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                      {lbl.city.toUpperCase()}
                    </span>
                    <div className="text-[9px] text-slate-500 font-medium">Standard 24-48h</div>
                  </div>
                </div>

                {/* Shipper & Consignee */}
                <div className="grid grid-cols-2 gap-2 border-b-2 border-slate-900 pb-2 mb-2">
                  <div className="border-r border-slate-300 pr-2">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Shipper</div>
                    <div className="font-bold text-slate-900 truncate">
                      {lbl.shipper.brandName || lbl.shipper.businessName}
                    </div>
                    <div className="text-[10px] text-slate-600">{lbl.shipper.city}</div>
                    {lbl.customerReference && (
                      <div className="text-[10px] font-mono text-slate-800 mt-1">
                        Ref: <span className="font-semibold">{lbl.customerReference}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center bg-slate-50 p-1.5 rounded border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">
                      Destination Hub
                    </span>
                    <span className="text-sm font-black text-slate-900 uppercase">
                      {lbl.city}
                    </span>
                    {lbl.province && (
                      <span className="text-[9px] font-medium text-slate-600">
                        {lbl.province}
                      </span>
                    )}
                  </div>
                </div>

                {/* Consignee */}
                <div className="border-b-2 border-slate-900 pb-2 mb-2">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">Consignee</div>
                  <div className="text-sm font-black text-slate-900">{lbl.consigneeName}</div>
                  <div className="text-xs text-slate-800 leading-snug my-1">
                    {lbl.shippingAddress}
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <div>
                      <span className="font-bold text-slate-600">Tel: </span>
                      <span className="font-bold font-mono text-slate-900">{lbl.consigneePhone}</span>
                    </div>
                    {lbl.postalCode && (
                      <span className="font-mono text-slate-600 text-[11px]">
                        {lbl.postalCode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Scannable Barcode SVG */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-2 gap-2">
                  <div
                    className="flex-1 flex justify-center overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                  />
                  {qrUrls[lbl.orderId] && (
                    <div className="border border-slate-300 p-0.5 rounded shrink-0">
                      <img
                        src={qrUrls[lbl.orderId]}
                        alt="QR"
                        className="w-14 h-14 object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* Financials & COD */}
                <div className="grid grid-cols-2 gap-2 border-b-2 border-slate-900 pb-2 mb-2">
                  <div
                    className={`p-2 rounded border-2 text-center ${
                      isCod
                        ? 'bg-rose-50 border-rose-600 text-rose-900'
                        : 'bg-emerald-50 border-emerald-600 text-emerald-900'
                    }`}
                  >
                    <div className="text-[9px] font-bold uppercase">Payment Method</div>
                    {isCod ? (
                      <>
                        <div className="text-[9px] font-bold text-rose-700 uppercase">COD</div>
                        <div className="text-sm font-black text-rose-800">
                          PKR {lbl.codAmount.toLocaleString('en-PK')}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs font-black uppercase text-emerald-700 mt-0.5">
                          PREPAID
                        </div>
                        <div className="text-[9px] text-emerald-800 font-medium">
                          Do Not Collect Cash
                        </div>
                      </>
                    )}
                  </div>

                  <div className="p-2 bg-slate-50 border border-slate-300 rounded flex flex-col justify-around text-center">
                    <div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase">Pieces</div>
                      <div className="text-xs font-black text-slate-900">
                        {lbl.totalPieces} Unit(s)
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono">
                      {new Date(lbl.createdAt).toLocaleDateString('en-PK')}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="text-[10px] text-slate-700">
                  <div className="font-bold text-slate-600 uppercase mb-0.5">Contents:</div>
                  <div className="divide-y divide-slate-200">
                    {lbl.items.map((item, i) => (
                      <div key={i} className="flex justify-between py-0.5">
                        <span className="truncate max-w-[260px]">
                          <strong className="font-mono text-slate-900">{item.sku}</strong> —{' '}
                          {item.name}
                        </span>
                        <span className="font-bold text-slate-900">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
