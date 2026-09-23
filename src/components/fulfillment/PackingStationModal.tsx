import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  PackageCheck,
  Barcode,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ShieldCheck,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { api } from '../../lib/api';

interface PackingStationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderPacked?: () => void;
}

export const PackingStationModal: React.FC<PackingStationModalProps> = ({
  isOpen,
  onClose,
  onOrderPacked
}) => {
  const [scanInput, setScanInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastPackedOrder, setLastPackedOrder] = useState<any | null>(null);
  const [packedSessionHistory, setPackedSessionHistory] = useState<Array<{
    orderNumber: string;
    customerBrand: string;
    consigneeName: string;
    city: string;
    codAmount: number;
    pieces: number;
    packedAt: string;
  }>>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Audio feedback synthesis
  const playSound = (type: 'success' | 'error') => {
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
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
        osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.22); // D6
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Audio not supported or blocked
    }
  };

  useEffect(() => {
    if (isOpen) {
      setScanInput('');
      setErrorMsg(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handlePackScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = scanInput.trim().toUpperCase();
    if (!barcode || isProcessing) return;

    try {
      setIsProcessing(true);
      setErrorMsg(null);

      const res = await api.packOrderScan(barcode);

      playSound('success');
      setLastPackedOrder(res.result.order);

      setPackedSessionHistory(prev => [
        {
          orderNumber: res.result.order.order_number,
          customerBrand: res.result.order.customer_brand,
          consigneeName: res.result.order.consignee_name,
          city: res.result.order.city,
          codAmount: res.result.order.cod_amount,
          pieces: res.result.order.total_pieces,
          packedAt: new Date().toLocaleTimeString('en-PK')
        },
        ...prev
      ]);

      setScanInput('');

      if (onOrderPacked) {
        onOrderPacked();
      }
    } catch (err: any) {
      playSound('error');
      setErrorMsg(err.message || 'Failed to pack order');
      setScanInput('');
    } finally {
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleResetSession = () => {
    setPackedSessionHistory([]);
    setLastPackedOrder(null);
    setErrorMsg(null);
    inputRef.current?.focus();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <PackageCheck className="w-5 h-5 text-emerald-600" />
          <span>Packing Station: Mandatory Scan-to-Pack Verification</span>
        </div>
      }
      size="xl"
    >
      <div className="space-y-6">
        {/* Compliance Notice Banner */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900">
            <span className="font-bold">Physical Verification Mandate: </span>
            Generating labels does not mark an order as packed. Scanning the order barcode here physically verifies that all ordered items have been picked and boxed into shipping parcels.
          </div>
        </div>

        {/* Big Interactive Scan Bar */}
        <div className="p-6 bg-gray-900 text-white rounded-xl shadow-md border border-gray-800">
          <form onSubmit={handlePackScan} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Barcode className="w-4 h-4" />
                Scan Order Barcode / Shipping Label
              </label>
              <span className="text-[11px] text-gray-400 font-mono">
                Hardware Scanner Ready (Auto-focus active)
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  placeholder="Scan Order # (e.g. ORD-202609-0001)..."
                  disabled={isProcessing}
                  className="w-full pl-4 pr-10 py-3.5 bg-gray-800 text-white font-mono text-lg font-bold border-2 border-emerald-500 rounded-lg focus:border-emerald-400 focus:outline-hidden uppercase placeholder:normal-case placeholder:font-normal placeholder:text-gray-500"
                />
                {isProcessing && (
                  <div className="absolute right-3 top-4">
                    <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={!scanInput.trim() || isProcessing}
                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm tracking-wide"
              >
                Verify & Pack
              </Button>
            </div>
          </form>

          {/* Validation Error Alert */}
          {errorMsg && (
            <div className="mt-4 p-4 bg-red-950/80 border-2 border-red-500 rounded-lg text-red-200 text-xs flex items-start gap-3 animate-shake">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <div className="font-bold text-sm text-red-100">Packing Blocked</div>
                <div className="mt-0.5">{errorMsg}</div>
              </div>
            </div>
          )}
        </div>

        {/* Last Verified & Packed Order Card */}
        {lastPackedOrder && (
          <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 rounded-xl shadow-xs animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm font-bold text-emerald-950 uppercase tracking-wide">
                  Order Verified & Marked as Packed!
                </h4>
              </div>
              <Badge variant="success" className="font-mono text-xs uppercase">
                {lastPackedOrder.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs">
              <div>
                <span className="text-gray-500 font-medium">Order Number:</span>
                <div className="text-base font-black font-mono text-gray-900 mt-0.5">
                  {lastPackedOrder.order_number}
                </div>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Consignee:</span>
                <div className="text-sm font-bold text-gray-900 mt-0.5">
                  {lastPackedOrder.consignee_name}
                </div>
                <div className="text-[11px] text-gray-600">{lastPackedOrder.consignee_phone}</div>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Destination:</span>
                <div className="text-sm font-bold text-gray-900 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {lastPackedOrder.city}
                </div>
                <div className="text-[10px] text-gray-500 truncate max-w-[150px]">
                  {lastPackedOrder.shipping_address}
                </div>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Financial & COD:</span>
                <div className="text-sm font-black text-gray-900 mt-0.5">
                  {lastPackedOrder.payment_method === 'cod'
                    ? `PKR ${lastPackedOrder.cod_amount.toLocaleString('en-PK')}`
                    : 'PREPAID'}
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold">
                  {lastPackedOrder.total_pieces} Piece(s) Verified
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session Packed Log Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Parcels Packed This Session ({packedSessionHistory.length})
            </h4>
            {packedSessionHistory.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetSession}
                className="text-xs flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Counter
              </Button>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white max-h-[220px] overflow-y-auto">
            {packedSessionHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No orders packed in this session yet. Ready for first scan!
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Order #</th>
                    <th className="py-2 px-3">Merchant</th>
                    <th className="py-2 px-3">Consignee</th>
                    <th className="py-2 px-3">Destination</th>
                    <th className="py-2 px-3 text-center">Pieces</th>
                    <th className="py-2 px-3 text-right">COD Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {packedSessionHistory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-400 font-mono text-[11px]">
                        {item.packedAt}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-indigo-700">
                        {item.orderNumber}
                      </td>
                      <td className="py-2 px-3 text-gray-600">{item.customerBrand}</td>
                      <td className="py-2 px-3 text-gray-900 font-semibold">{item.consigneeName}</td>
                      <td className="py-2 px-3 text-gray-700">{item.city}</td>
                      <td className="py-2 px-3 text-center font-bold text-gray-900">{item.pieces}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">
                        {item.codAmount > 0
                          ? `PKR ${item.codAmount.toLocaleString('en-PK')}`
                          : 'PREPAID'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-200 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close Packing Station
          </Button>
        </div>
      </div>
    </Modal>
  );
};
