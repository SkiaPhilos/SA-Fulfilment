import React, { useState } from 'react';
import { api, WalletAccountWithCustomer } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface TopUpModalProps {
  customer: WalletAccountWithCustomer | null;
  allCustomers?: WalletAccountWithCustomer[];
  onClose: () => void;
  onSuccess: () => void;
}

export const TopUpModal: React.FC<TopUpModalProps> = ({
  customer,
  allCustomers = [],
  onClose,
  onSuccess
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customer?.customer_profile_id || (allCustomers[0]?.customer_profile_id || '')
  );
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeCustomer = customer || allCustomers.find(c => c.customer_profile_id === selectedCustomerId);
  const numericAmount = parseFloat(amount) || 0;
  const currentBalance = activeCustomer?.balance || 0;
  const projectedBalance = currentBalance + numericAmount;

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

    if (!notes.trim()) {
      setError('Please provide verification details or deposit notes.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.creditWallet({
        customer_profile_id: selectedCustomerId,
        amount: numericAmount,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim() || undefined,
        notes: notes.trim()
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to credit wallet account.');
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
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Manual Wallet Top-Up</h2>
              <p className="text-xs text-slate-500">Credit merchant balance with verified bank transfer</p>
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
                    {c.business_name} ({c.brand_name}) - Current: PKR {c.balance.toLocaleString()}
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
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Current Balance</div>
                <div className="text-sm font-bold font-mono text-slate-800">
                  PKR {customer.balance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Credit Amount (PKR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">PKR</span>
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-12 font-mono text-sm font-bold text-slate-900"
                required
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Channel <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                <option value="bank_transfer">Bank IBFT (Meezan)</option>
                <option value="raast">Raast Instant Transfer</option>
                <option value="cash">Direct Cash / Branch Deposit</option>
                <option value="internal_credit">Operations Credit Waiver</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank Reference / STAN #
              </label>
              <Input
                type="text"
                placeholder="e.g. FT260901923"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Notes & Verification Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deposit Verification & Audit Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Verified against Meezan Bank statement timestamped 22:15, verified by Operations"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-md border border-slate-300 p-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              required
            />
          </div>

          {/* Projected Balance Breakdown Card */}
          {numericAmount > 0 && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200/80 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Current Balance:</span>
                <span className="font-mono">PKR {currentBalance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-semibold">
                <span>Credit Amount:</span>
                <span className="font-mono">+ PKR {numericAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-1.5 border-t border-emerald-200 flex justify-between font-bold text-emerald-950">
                <span>Projected New Balance:</span>
                <span className="font-mono text-sm">PKR {projectedBalance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading} className="gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Post Credit</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
