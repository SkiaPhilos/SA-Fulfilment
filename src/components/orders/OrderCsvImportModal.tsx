import React, { useState, useEffect } from 'react';
import { api, CsvPreviewResult, CustomerProfile, UserSession } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Badge } from '../ui/Badge';
import {
  FileUp,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  Building2,
  Boxes,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface OrderCsvImportModalProps {
  user: UserSession;
  onClose: () => void;
  onSuccess: (importedCount: number) => void;
}

const SAMPLE_CSV = `customer_reference,consignee_name,consignee_phone,consignee_email,shipping_address,city,province,postal_code,cod_amount,payment_method,shipping_notes,sku,quantity,unit_price
ORD-101,Muhammad Bilal,03001234567,bilal@gmail.com,"House 12, Street 4, F-10/2",Islamabad,ICT,44000,2500,cod,Call before delivery,PAK-TEA-250G,2,1200
ORD-102,Fatima Zahra,03219876543,fatima@gmail.com,"Flat 304, Al-Raheem Heights, Gulberg III",Lahore,Punjab,54000,3400,cod,Leave at reception,LED-BULB-12W,3,800
ORD-103,Hamza Tariq,03335551212,hamza@live.com,"Plot 45-C, Phase 5, DHA",Karachi,Sindh,75500,0,prepaid,Prepaid gift delivery,COTTON-TSHIRT-L,1,2000`;

export const OrderCsvImportModal: React.FC<OrderCsvImportModalProps> = ({
  user,
  onClose,
  onSuccess
}) => {
  const isCustomer = user.account_type === 'customer';

  // Step state: 1 = upload, 2 = preview & validate, 3 = finished
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Merchant selection (if staff)
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // CSV content input
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);

  // Preview result
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Commit result
  const [commitResult, setCommitResult] = useState<{
    importedCount: number;
    skippedCount: number;
    createdOrderNumbers: string[];
  } | null>(null);

  // Load customer list if staff
  useEffect(() => {
    if (!isCustomer) {
      api.getCustomers()
        .then((res) => {
          const approved = res.customers
            .map((c) => c.profile)
            .filter((p): p is CustomerProfile => Boolean(p && p.approval_status === 'approved'));
          setCustomers(approved);
          if (approved.length > 0) {
            setSelectedCustomerId(approved[0].id);
          }
        })
        .catch((err) => console.error('Failed to load customers:', err));
    }
  }, [isCustomer]);

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ship_asaan_fulfill_orders_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!csvContent.trim()) {
      setError('Please provide or upload CSV content.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.previewOrdersCsv(
        csvContent,
        !isCustomer ? selectedCustomerId : undefined
      );
      setPreview(res);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to parse and validate CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.commitOrdersCsv(preview, skipInvalid);
      setCommitResult(res);
      setStep(3);
      onSuccess(res.importedCount);
    } catch (err: any) {
      setError(err.message || 'Failed to commit orders');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (tempId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [tempId]: !prev[tempId]
    }));
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
          <span>Fulfillment Orders Bulk CSV Import</span>
        </div>
      }
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {step === 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Back to File / Text
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step !== 3 && (
              <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
            )}

            {step === 1 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handlePreview}
                disabled={loading || !csvContent.trim()}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                {loading ? 'Validating CSV...' : 'Parse & Validate Data'}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            )}

            {step === 2 && preview && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleCommit}
                disabled={
                  loading ||
                  (!skipInvalid && preview.summary.invalidOrdersCount > 0) ||
                  preview.summary.validOrdersCount === 0
                }
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                {loading ? (
                  'Importing Orders...'
                ) : (
                  `Commit Import (${skipInvalid ? preview.summary.validOrdersCount : preview.summary.totalOrders} Orders)`
                )}
              </Button>
            )}

            {step === 3 && (
              <Button
                variant="primary"
                size="sm"
                onClick={onClose}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                Close & View Orders
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                step === 1
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              1
            </span>
            <span className={step === 1 ? 'font-bold text-slate-900' : 'text-slate-500'}>
              Upload / Paste CSV
            </span>
          </div>

          <div className="w-12 h-px bg-slate-300" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                step === 2
                  ? 'bg-emerald-700 text-white'
                  : step > 2
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              2
            </span>
            <span className={step === 2 ? 'font-bold text-slate-900' : 'text-slate-500'}>
              Validation & Table Preview
            </span>
          </div>

          <div className="w-12 h-px bg-slate-300" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                step === 3
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              3
            </span>
            <span className={step === 3 ? 'font-bold text-slate-900' : 'text-slate-500'}>
              Import Confirmation
            </span>
          </div>
        </div>

        {error && (
          <Notice variant="error" title="Import Error">
            {error}
          </Notice>
        )}

        {/* STEP 1: UPLOAD / PASTE */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Merchant selector if staff */}
            {!isCustomer && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Select Target Merchant Account *</span>
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full text-xs py-2 px-3 border border-slate-300 rounded bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.brand_name || c.business_name} ({c.city})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Orders will be mapped against this merchant&apos;s product SKU catalog.
                </p>
              </div>
            )}

            {/* Template Download Card */}
            <div className="flex items-center justify-between p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs">
              <div className="flex items-center gap-2 text-emerald-900">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <span className="font-semibold">Standard CSV Template:</span> Includes consignee, COD, destination, and SKU headers.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="text-emerald-800 border-emerald-300 hover:bg-emerald-100/60 shrink-0"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download Template CSV
              </Button>
            </div>

            {/* File Upload Drop Area */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-emerald-600 transition-colors bg-white">
              <FileUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-semibold text-slate-700">
                {fileName ? (
                  <span className="text-emerald-700 font-bold">{fileName}</span>
                ) : (
                  'Choose a CSV file or drag and drop here'
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Supports .csv or .tsv formatted order sheets
              </p>
              <label className="mt-3 inline-block">
                <span className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors border border-slate-300">
                  Browse File
                </span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Direct Paste Alternative */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Or Paste CSV Text Directly
                </label>
                <button
                  type="button"
                  onClick={() => setCsvContent(SAMPLE_CSV)}
                  className="text-xs text-emerald-700 hover:text-emerald-800 underline font-medium"
                >
                  Load Sample Data
                </button>
              </div>
              <textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="Paste CSV lines including header row..."
                rows={6}
                className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & VALIDATE */}
        {step === 2 && preview && (
          <div className="space-y-4">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-[10px] font-bold uppercase text-slate-500">Total Orders</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                  {preview.summary.totalOrders}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {preview.summary.totalPieces} total pieces
                </div>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
                <div className="text-[10px] font-bold uppercase text-emerald-700">Valid Orders</div>
                <div className="text-xl font-bold font-mono text-emerald-800 mt-0.5">
                  {preview.summary.validOrdersCount}
                </div>
                <div className="text-[10px] text-emerald-700 mt-0.5">Ready to import</div>
              </div>

              <div className={`rounded-lg p-3 border ${
                preview.summary.invalidOrdersCount > 0
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className={`text-[10px] font-bold uppercase ${
                  preview.summary.invalidOrdersCount > 0 ? 'text-rose-700' : 'text-slate-500'
                }`}>
                  Invalid Orders
                </div>
                <div className={`text-xl font-bold font-mono mt-0.5 ${
                  preview.summary.invalidOrdersCount > 0 ? 'text-rose-800' : 'text-slate-900'
                }`}>
                  {preview.summary.invalidOrdersCount}
                </div>
                <div className={`text-[10px] mt-0.5 ${
                  preview.summary.invalidOrdersCount > 0 ? 'text-rose-700' : 'text-slate-500'
                }`}>
                  {preview.summary.invalidOrdersCount > 0 ? 'Fix errors to import' : 'Zero errors'}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-[10px] font-bold uppercase text-slate-500">Total COD Amount</div>
                <div className="text-lg font-bold font-mono text-emerald-800 mt-0.5">
                  PKR {preview.summary.totalCodAmount.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Customer: {preview.customerName}</div>
              </div>
            </div>

            {/* Error / Warning Notice */}
            {preview.summary.invalidOrdersCount > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>{preview.summary.invalidOrdersCount} order(s)</strong> have validation errors (e.g. unknown SKUs or missing phone numbers).
                  </span>
                </div>

                {preview.summary.validOrdersCount > 0 && (
                  <div className="flex items-center gap-2 bg-white px-3 py-1 rounded border border-rose-200 text-rose-900 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      id="skipInvalid"
                      checked={skipInvalid}
                      onChange={(e) => setSkipInvalid(e.target.checked)}
                      className="rounded text-emerald-700 focus:ring-emerald-600"
                    />
                    <label htmlFor="skipInvalid" className="cursor-pointer">
                      Skip invalid and import {preview.summary.validOrdersCount} valid orders
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Orders Preview Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-[380px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[11px] font-semibold text-slate-600 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Line # / Ref</th>
                    <th className="py-2.5 px-3">Consignee & Phone</th>
                    <th className="py-2.5 px-3">Destination City</th>
                    <th className="py-2.5 px-3">SKU & Items</th>
                    <th className="py-2.5 px-3 text-right">COD (PKR)</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {preview.orders.map((ord) => {
                    const isExpanded = expandedOrders[ord.tempId];

                    return (
                      <React.Fragment key={ord.tempId}>
                        <tr className={ord.isValid ? 'hover:bg-slate-50/70' : 'bg-rose-50/40'}>
                          <td className="py-2.5 px-3">
                            {ord.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                {ord.errors.length} Error{ord.errors.length === 1 ? '' : 's'}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            <div className="font-bold text-slate-800">
                              {ord.customerReference || 'Row ' + ord.rowIndices.join(', ')}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              CSV Lines: {ord.rowIndices.join(', ')}
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{ord.consigneeName}</div>
                            <div className="text-slate-500 font-mono text-[11px]">{ord.consigneePhone}</div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-800">{ord.city}</div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                              {ord.shippingAddress}
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-mono text-slate-800 font-semibold">
                              {ord.items.map((i) => `${i.sku} (${i.quantity}x)`).join(', ')}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {ord.totalPieces} total pieces
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                            {ord.codAmount.toLocaleString()}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleExpand(ord.tempId)}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded"
                              title="Toggle details"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr className={ord.isValid ? 'bg-slate-50/90' : 'bg-rose-50/70'}>
                            <td colSpan={7} className="p-3 text-xs">
                              {/* Validation Errors */}
                              {ord.errors.length > 0 && (
                                <div className="space-y-1 mb-2">
                                  <div className="font-semibold text-rose-800 text-[11px] uppercase tracking-wider">
                                    Validation Errors:
                                  </div>
                                  {ord.errors.map((err, eIdx) => (
                                    <div
                                      key={eIdx}
                                      className="p-2 bg-white rounded border border-rose-200 text-rose-700 flex items-start gap-2"
                                    >
                                      <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-semibold">[{err.field}]</span> {err.message}
                                        <div className="text-[11px] text-slate-600 italic mt-0.5">
                                          💡 Correction Hint: {err.hint}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Inventory Warnings */}
                              {ord.warnings.length > 0 && (
                                <div className="space-y-1 mb-2">
                                  {ord.warnings.map((warn, wIdx) => (
                                    <div
                                      key={wIdx}
                                      className="p-1.5 bg-amber-50 rounded border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5"
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span>{warn}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Line items stock preview */}
                              <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                                <div className="font-semibold text-slate-700 text-[11px] uppercase">
                                  Grouped Items Breakdown:
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {ord.items.map((item, iIdx) => (
                                    <div
                                      key={iIdx}
                                      className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100"
                                    >
                                      <div>
                                        <span className="font-mono font-bold text-slate-900">{item.sku}</span>
                                        <span className="text-slate-500 ml-1.5">Qty: {item.quantity}</span>
                                      </div>
                                      <span className="text-[11px] text-slate-600 font-mono">
                                        In Storage: {item.availableStock}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 3: FINISHED / CONFIRMATION */}
        {step === 3 && commitResult && (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Bulk Import Completed Successfully
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                <strong>{commitResult.importedCount} fulfillment order(s)</strong> have been created in the <strong>Placed</strong> state and queued for staff confirmation.
              </p>
            </div>

            {commitResult.createdOrderNumbers.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-left max-h-36 overflow-y-auto">
                <div className="text-[11px] font-bold uppercase text-slate-500 mb-1.5">
                  Created Order Tracking Numbers:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {commitResult.createdOrderNumbers.map((num) => (
                    <span
                      key={num}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono text-xs font-semibold text-slate-800"
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
