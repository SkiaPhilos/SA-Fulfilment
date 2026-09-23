import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Package,
  Barcode,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Printer,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { api, PickingBatchDetails } from '../../lib/api';

interface PickingSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string | null;
  onBatchUpdated?: () => void;
  onOpenPrintSheet?: (details: PickingBatchDetails) => void;
}

export const PickingSessionModal: React.FC<PickingSessionModalProps> = ({
  isOpen,
  onClose,
  batchId,
  onBatchUpdated,
  onOpenPrintSheet
}) => {
  const [details, setDetails] = useState<PickingBatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [recentPicks, setRecentPicks] = useState<Array<{
    trackingCode: string;
    sku: string;
    productName: string;
    locationCode: string;
    orderNumber: string;
    timestamp: string;
  }>>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sound synthesis via Web Audio API
  const playSound = (type: 'success' | 'error' | 'complete') => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } else if (type === 'complete') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24); // G5
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.36); // C6
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.55);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // Audio not supported or blocked
    }
  };

  const loadDetails = async () => {
    if (!batchId) return;
    try {
      setLoading(true);
      const res = await api.getPickingBatchDetails(batchId);
      setDetails(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load picking batch details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && batchId) {
      loadDetails();
      setScanInput('');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, batchId]);

  useEffect(() => {
    if (isOpen && !loading) {
      inputRef.current?.focus();
    }
  }, [isOpen, loading]);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = scanInput.trim().toUpperCase();
    if (!raw || !batchId || isProcessing) return;

    try {
      setIsProcessing(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await api.pickUnitScan({
        unitTrackingCode: raw,
        batchId
      });

      playSound(res.result.batchCompleted ? 'complete' : 'success');

      setSuccessMsg(
        `Unit ${res.result.unit.tracking_code} (${res.result.unit.sku}) picked for ${res.result.order.order_number}!`
      );

      setRecentPicks(prev => [
        {
          trackingCode: res.result.unit.tracking_code,
          sku: res.result.unit.sku,
          productName: res.result.unit.product_name,
          locationCode: res.result.unit.location_code,
          orderNumber: res.result.order.order_number,
          timestamp: new Date().toLocaleTimeString('en-PK')
        },
        ...prev.slice(0, 19)
      ]);

      setScanInput('');

      // Refresh batch progress
      const updated = await api.getPickingBatchDetails(batchId);
      setDetails(updated);

      if (onBatchUpdated) {
        onBatchUpdated();
      }
    } catch (err: any) {
      playSound('error');
      setErrorMsg(err.message || 'Failed to pick unit');
      setScanInput('');
    } finally {
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  if (!isOpen) return null;

  const totalUnits = details?.totalUnits || 0;
  const pickedUnits = details?.pickedUnits || 0;
  const percentComplete = totalUnits > 0 ? Math.round((pickedUnits / totalUnits) * 100) : 0;
  const isComplete = details?.isComplete || (totalUnits > 0 && pickedUnits >= totalUnits);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Barcode className="w-5 h-5 text-indigo-600" />
          <span>Warehouse Picking Station: {details?.batch?.batch_number || 'Loading...'}</span>
        </div>
      }
      size="xl"
    >
      <div className="space-y-6">
        {loading ? (
          <div className="py-12 text-center text-gray-500">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-2"></div>
            <div>Loading picking batch details...</div>
          </div>
        ) : !details ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">
            Could not load picking batch details.
          </div>
        ) : (
          <>
            {/* Top Batch Header & Progress Bar */}
            <div className="bg-gray-900 text-white p-5 rounded-xl shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold font-mono tracking-wider">
                      {details.batch.batch_number}
                    </span>
                    <Badge
                      variant={isComplete ? 'success' : 'neutral'}
                      className="uppercase font-mono text-xs"
                    >
                      {isComplete ? 'Completed' : 'Active Picking'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {details.orders.length} Order(s) | {details.pickLocations.length} Storage Location(s)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {onOpenPrintSheet && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenPrintSheet(details)}
                      className="bg-gray-800 text-gray-200 hover:bg-gray-700 border-gray-700 flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Pick Sheet
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadDetails}
                    className="bg-gray-800 text-gray-200 hover:bg-gray-700 border-gray-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1 text-gray-300">
                  <span>Picking Progress</span>
                  <span className="font-mono">
                    {pickedUnits} / {totalUnits} units picked ({percentComplete}%)
                  </span>
                </div>
                <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden border border-gray-700">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isComplete ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Batch Complete Banner */}
            {isComplete && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-3 text-emerald-900 animate-fadeIn">
                <Sparkles className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-sm">Picking Batch Complete!</h4>
                  <p className="text-xs text-emerald-700">
                    All {totalUnits} units have been successfully scanned and picked. Orders are now ready at the Packing Station!
                  </p>
                </div>
              </div>
            )}

            {/* Interactive Scan Input Bar */}
            <div className="p-5 bg-indigo-50/60 border-2 border-indigo-200 rounded-xl">
              <form onSubmit={handleScanSubmit} className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <Barcode className="w-4 h-4 text-indigo-600" />
                    Scan Physical Unit Tracking Code
                  </label>
                  <span className="text-[11px] text-indigo-700">
                    USB Keyboard Wedge & Camera Ready (Auto-focus active)
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={scanInput}
                      onChange={e => setScanInput(e.target.value)}
                      placeholder="Scan unit label (e.g. UNIT-8A2F-9C1E)..."
                      disabled={isProcessing || isComplete}
                      className="w-full pl-3 pr-10 py-3 bg-white text-gray-900 font-mono text-base font-bold border-2 border-indigo-300 rounded-lg focus:border-indigo-600 focus:outline-hidden uppercase placeholder:normal-case placeholder:font-normal placeholder:text-gray-400"
                    />
                    {isProcessing && (
                      <div className="absolute right-3 top-3.5">
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!scanInput.trim() || isProcessing || isComplete}
                    className="px-6 py-3 font-semibold text-sm"
                  >
                    Confirm Pick
                  </Button>
                </div>
              </form>

              {/* Status Alerts */}
              {errorMsg && (
                <div className="mt-3 p-3 bg-red-100 border border-red-300 text-red-900 rounded-lg text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="mt-3 p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{successMsg}</span>
                </div>
              )}
            </div>

            {/* Split View: Warehouse Pick Path & Session Scan Log */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Location Path & Items (2 columns) */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Pick Path by Location ({details.pickLocations.length})
                </h4>

                <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
                  {details.pickLocations.map((loc, idx) => {
                    const locTotal = loc.items.reduce((acc, i) => acc + i.totalUnitsRequired, 0);
                    const locPicked = loc.items.reduce((acc, i) => acc + i.pickedUnitsCount, 0);
                    const locDone = locTotal > 0 && locPicked >= locTotal;

                    return (
                      <div
                        key={loc.locationId || idx}
                        className={`border rounded-lg overflow-hidden transition-all ${
                          locDone
                            ? 'bg-gray-50 border-gray-200 opacity-60'
                            : 'bg-white border-indigo-200 shadow-xs'
                        }`}
                      >
                        {/* Location Header */}
                        <div
                          className={`px-4 py-2 flex items-center justify-between text-xs ${
                            locDone ? 'bg-gray-200 text-gray-700' : 'bg-indigo-900 text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-mono font-bold">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            <span>{loc.locationCode}</span>
                            <span className="font-normal opacity-80">({loc.locationPath})</span>
                          </div>
                          <div className="font-mono">
                            {locPicked} / {locTotal} picked
                          </div>
                        </div>

                        {/* Items at location */}
                        <div className="p-3 divide-y divide-gray-100">
                          {loc.items.map((item, itemIdx) => (
                            <div
                              key={itemIdx}
                              className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                            >
                              <div>
                                <div className="font-mono font-bold text-gray-900">{item.sku}</div>
                                <div className="text-gray-600 text-[11px] truncate max-w-xs">
                                  {item.productName}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {item.units.map(u => (
                                    <span
                                      key={u.unitId}
                                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] border ${
                                        u.state === 'picked'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 line-through'
                                          : 'bg-indigo-50 text-indigo-900 border-indigo-200 font-bold'
                                      }`}
                                    >
                                      {u.trackingCode}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="font-mono font-bold text-sm text-gray-900">
                                  {item.pickedUnitsCount} / {item.totalUnitsRequired}
                                </span>
                                {item.pickedUnitsCount >= item.totalUnitsRequired && (
                                  <div className="text-[10px] font-bold text-emerald-600">
                                    COMPLETE
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Session Picks Log (1 column) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Session Activity Log ({recentPicks.length})
                </h4>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-[380px] overflow-y-auto">
                  {recentPicks.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">
                      <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      Ready to pick. Scanned units will stream here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentPicks.map((pick, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-white border border-emerald-200 rounded shadow-2xs text-xs"
                        >
                          <div className="flex items-center justify-between font-mono font-bold text-emerald-800">
                            <span>{pick.trackingCode}</span>
                            <span className="text-[10px] text-gray-400 font-normal">
                              {pick.timestamp}
                            </span>
                          </div>
                          <div className="text-gray-700 text-[11px] font-medium truncate">
                            {pick.sku} — {pick.productName}
                          </div>
                          <div className="text-[10px] text-gray-500 flex justify-between mt-0.5">
                            <span>Loc: {pick.locationCode}</span>
                            <span className="font-mono">{pick.orderNumber}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>
                Close Station
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
