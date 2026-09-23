import React, { useState } from 'react';
import { api, WalletAccountWithCustomer } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, ArrowDownRight, AlertTriangle, AlertCircle } from 'lucide-react';

interface DebitModalProps {
  customer: WalletAccountWithCustomer | null;
  allCustomers?: WalletAccountWithCustomer[];
  onClose: () => void;
  onSuccess: () => void;
}

export const DebitModal: React.FC<DebitModalProps> = ({
  customer,
  allCustomers = [],
  onClose,
  onSuccess
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customer?.customer_profile_id || (allCustomers[0]?.customer_profile_id || '')
  );
  const [mode, setMode] = useState<'debit' | 'adjustment'>('debit');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('fulfillment_fee');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [allowNegative, setAllowNegative] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeCustomer = customer || allCustomers.find(c => c.customer_profile_id === selectedCustomerId);
  const numericAmount = parseFloat(amount) || 0;
  const currentBalance = activeCustomer?.balance || 0;
  const projectedBalance = currentBalance - numericAmount;
  const isInsufficient = projectedBalance < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setError('Please select a customer account.');
      return;
    }

    if (numericAmount <= 0) {
      setError('Please enter a positive amount greater than zero.');
      return;
    }

    if (!notes.trim() || notes.trim().length < 5) {
      setError('Please provide a mandatory justification / reason (min 5 characters).');
      return;
    }

    if (isInsufficient && !allowNegative) {
      setError(`Cannot debit more than the current available balance (PKR ${currentBalance.toLocaleString()}) without explicit negative override approval.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'debit') {
        await api.debitWallet({
          customer_profile_id: selectedCustomerId,
          amount: numericAmount,
          payment_method: category,
          reference_number: referenceNumber.trim() || undefined,
          notes: notes.trim(),
          allow_negative: allowNegative
        });
      } else {
        // Direct adjustment (negative delta)
        await api.adjustWallet({
          customer_profile_id: selectedCustomerId,
          amount_delta: -numericAmount,
          reason: notes.trim(),
          reference_number: referenceNumber.trim() || undefined
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process debit transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in-0">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-left">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Post Wallet Debit / Charge</h2>
              <p className="text-xs text-slate-500">Deduct fees or adjust merchant operational balance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('debit')}
              className={`flex-1 py-1.5 rounded-md transition-all ${
                mode === 'debit'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Operational Service Charge
            </button>
            <button
              type="button"
              onClick={() => setMode('adjustment')}
              className={`flex-1 py-1.5 rounded-md transition-all ${
                mode === 'adjustment'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Manual Accounting Adjustment
            </button>
          </div>

          {/* Customer Selection if not pre-bound */}
          {!customer && allCustomers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Merchant Customer <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                required
              >
                {allCustomers.map((c) => (
                  <option key={c.customer_profile_id} value={c.customer_profile_id}>
                    {c.business_name} ({c.brand_name}) - Balance: PKR {c.balance.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {customer && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">{customer.business_name}</div>
                <div className="text-[11px] text-slate-500">{customer.brand_name} · {customer.city}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Available Balance</div>
                <div className="text-sm font-bold font-mono text-slate-800">
                  PKR {customer.balance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Debit Amount (PKR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">PKR</span>
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="2500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-12 font-mono text-sm font-bold text-slate-900"
                required
              />
            </div>
          </div>

          {/* Category / Charge Reason */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Charge Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="fulfillment_fee">Order Fulfillment Handling</option>
                <option value="storage_fee">Monthly Warehouse Storage</option>
                <option value="adjustment">Dispute Settlement / Correction</option>
                <option value="cash">Withdrawal / Settlement Payout</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Related Reference #
              </label>
              <Input
                type="text"
                placeholder="e.g. INV-2026-081"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Notes & Justification */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mandatory Audit Reason & Details <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Deducted for 50 order packings in batch #B-902 + packaging supplies"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-md border border-slate-300 p-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              required
            />
          </div>

          {/* Warning if insufficient funds */}
          {isInsufficient && numericAmount > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Requested debit exceeds customer balance!</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Debiting PKR {numericAmount.toLocaleString()} will cause the account balance to fall below zero to{' '}
                <span className="font-mono font-bold text-rose-700">PKR {projectedBalance.toLocaleString()}</span>.
              </p>
              <label className="flex items-center gap-2 pt-1 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowNegative}
                  onChange={(e) => setAllowNegative(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span>Authorize negative balance credit facility</span>
              </label>
            </div>
          )}

          {/* Projected Balance Breakdown Card */}
          {numericAmount > 0 && !isInsufficient && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Current Balance:</span>
                <span className="font-mono">PKR {currentBalance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-rose-700 font-semibold">
                <span>Debit Amount:</span>
                <span className="font-mono">- PKR {numericAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Remaining Balance:</span>
                <span className="font-mono text-sm">PKR {projectedBalance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={loading}
              disabled={isInsufficient && !allowNegative}
              className="gap-1.5"
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Confirm & Post Debit</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
