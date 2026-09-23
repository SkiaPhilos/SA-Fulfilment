import React, { useState } from 'react';
import { CustomerItem, AuditLogItem, api } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Notice } from '../ui/Notice';
import {
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Landmark,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  ShieldCheck,
  Wallet,
  ArrowUpRight
} from 'lucide-react';

interface CustomerDetailModalProps {
  customer: CustomerItem;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  canApprove: boolean;
  canEdit: boolean;
}

export function CustomerDetailModal({
  customer,
  isOpen,
  onClose,
  onRefresh,
  canApprove,
  canEdit
}: CustomerDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'kyc' | 'bank' | 'audit'>('overview');
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Editable fields
  const [businessName, setBusinessName] = useState(customer.profile.business_name);
  const [brandName, setBrandName] = useState(customer.profile.brand_name);
  const [cnic, setCnic] = useState(customer.profile.cnic_or_ntn);
  const [phone, setPhone] = useState(customer.profile.phone || '');
  const [address, setAddress] = useState(customer.profile.address || '');
  const [city, setCity] = useState(customer.profile.city || '');
  const [bankName, setBankName] = useState(customer.profile.bank_name || '');
  const [bankTitle, setBankTitle] = useState(customer.profile.bank_account_title || '');
  const [bankIban, setBankIban] = useState(customer.profile.bank_iban || '');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  React.useEffect(() => {
    if (customer.profile.approval_status === 'approved') {
      api.getMyWallet(customer.profile.id)
        .then((res) => setWalletBalance(res.wallet.balance))
        .catch(() => setWalletBalance(null));
    }
  }, [customer.profile.id, customer.profile.approval_status]);

  const completeness = customer.completeness;

  const handleApprove = async () => {
    if (!window.confirm(`Approve merchant ${customer.profile.business_name}? They will immediately gain access to fulfillment order dispatch and wallet services.`)) {
      return;
    }
    setLoading(true);
    setActionError(null);
    try {
      await api.approveCustomer(customer.profile.id);
      setActionNotice('Customer account successfully approved.');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve customer.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    setLoading(true);
    setActionError(null);
    try {
      await api.rejectCustomer(customer.profile.id, rejectReason.trim());
      setActionNotice('Customer application marked as rejected.');
      setShowRejectForm(false);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject customer.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    const reason = window.prompt('Enter reason for account suspension:');
    if (!reason) return;
    setLoading(true);
    setActionError(null);
    try {
      await api.suspendCustomer(customer.profile.id, reason);
      setActionNotice('Customer account suspended.');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to suspend customer.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setActionError(null);
    try {
      await api.updateCustomerProfile(customer.profile.id, {
        business_name: businessName,
        brand_name: brandName,
        cnic_or_ntn: cnic,
        phone,
        address,
        city,
        bank_name: bankName,
        bank_account_title: bankTitle,
        bank_iban: bankIban
      });
      setActionNotice('Profile details saved successfully.');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to save customer profile.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success" dot>Approved</Badge>;
      case 'pending':
        return <Badge variant="warning" dot>Pending Review</Badge>;
      case 'rejected':
        return <Badge variant="danger" dot>Rejected</Badge>;
      case 'suspended':
        return <Badge variant="danger" dot>Suspended</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customer.profile.business_name}
      description={`Customer Account: ${customer.user.email} • ID: ${customer.profile.id}`}
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {canApprove && customer.profile.approval_status === 'pending' && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowRejectForm(true)}
                disabled={loading}
              >
                Reject Application
              </Button>
            )}
            {canApprove && customer.profile.approval_status === 'approved' && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleSuspend}
                disabled={loading}
              >
                Suspend Merchant
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {canApprove && customer.profile.approval_status !== 'approved' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleApprove}
                loading={loading}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Approve Merchant
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {actionError && <Notice variant="error" message={actionError} onDismiss={() => setActionError(null)} />}
        {actionNotice && <Notice variant="success" message={actionNotice} onDismiss={() => setActionNotice(null)} />}

        {/* Rejection Form Drawer/Panel */}
        {showRejectForm && (
          <form onSubmit={handleReject} className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-3 animate-in fade-in-0">
            <div className="flex items-center gap-2 text-rose-900 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>State Formal Reason for Application Rejection</span>
            </div>
            <Input
              label="Rejection Notice"
              required
              placeholder="e.g. Invalid tax NTN or mismatch between business registration address..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setShowRejectForm(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" type="submit" loading={loading}>
                Confirm Rejection
              </Button>
            </div>
          </form>
        )}

        {/* Top Badges & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            {getStatusBadge(customer.profile.approval_status)}
            <span className="text-xs text-slate-500 font-mono">
              Score: {customer.profile.completeness_score}% Complete
            </span>
          </div>

          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Overview & Health
            </button>
            <button
              onClick={() => setActiveTab('kyc')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'kyc'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              KYC & Business Details
            </button>
            <button
              onClick={() => setActiveTab('bank')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'bank'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Settlement Banking
            </button>
          </div>
        </div>

        {/* Tab 1: Overview & Completeness */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Completeness Bar */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs font-semibold text-slate-900">Profile Completeness Score</span>
                <span className="text-xs font-mono font-bold text-slate-800 tabular-nums">
                  {completeness?.score || customer.profile.completeness_score}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-3">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    (completeness?.score || 0) >= 80 ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${completeness?.score || customer.profile.completeness_score}%` }}
                />
              </div>

              {/* Modular Sections Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {completeness?.sections.map((section) => (
                  <div
                    key={section.id}
                    className={`p-2.5 rounded border ${
                      section.completed
                        ? 'bg-white border-slate-200 text-slate-700'
                        : 'bg-amber-50/50 border-amber-200/80 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{section.title}</span>
                      <span className="font-mono text-[11px] text-slate-400">+{section.weight}%</span>
                    </div>
                    {section.completed ? (
                      <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-3 h-3" /> Fully Verified
                      </span>
                    ) : (
                      <div className="text-[11px] text-amber-700 mt-1">
                        Missing: {section.missingFields.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Rejection / Suspension Notice if applicable */}
            {customer.profile.rejection_reason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800">
                <strong>Status Reason:</strong> {customer.profile.rejection_reason}
              </div>
            )}

            {/* Operational Wallet Card (if Approved) */}
            {customer.profile.approval_status === 'approved' && (
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-950">Authoritative Operational Wallet</div>
                    <div className="text-[11px] text-emerald-700">Pre-funded balance for fulfillment & shipping charges</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-emerald-800 uppercase tracking-wider font-semibold">Available Funds</div>
                  <div className="text-base font-bold font-mono text-emerald-950">
                    {walletBalance !== null ? `PKR ${walletBalance.toLocaleString('en-PK', { minimumFractionDigits: 2 })}` : 'Loading...'}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Facts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-md">
                <span className="text-slate-400 block text-[11px]">Primary Contact</span>
                <span className="font-semibold text-slate-900">{customer.user.name}</span>
                <span className="block font-mono text-slate-500 mt-0.5">{customer.user.email}</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-md">
                <span className="text-slate-400 block text-[11px]">Business City</span>
                <span className="font-semibold text-slate-900">{customer.profile.city}</span>
                <span className="block text-slate-500 mt-0.5 truncate">{customer.profile.address}</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-md">
                <span className="text-slate-400 block text-[11px]">Registration Date</span>
                <span className="font-semibold text-slate-900">
                  {new Date(customer.profile.created_at).toLocaleDateString()}
                </span>
                <span className="block text-slate-500 mt-0.5 font-mono text-[10px]">
                  {new Date(customer.profile.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: KYC & Business Details (Editable) */}
        {activeTab === 'kyc' && (
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Registered Business Name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                disabled={!canEdit}
                required
              />
              <Input
                label="Consumer Brand / Store Name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                disabled={!canEdit}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="CNIC or NTN Number"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                disabled={!canEdit}
                required
              />
              <Input
                label="Official Contact Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!canEdit}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Dispatch / Physical Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={!canEdit}
                  required
                />
              </div>
              <Input
                label="City Hub"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={!canEdit}
                required
              />
            </div>

            {canEdit && (
              <div className="flex justify-end pt-2">
                <Button variant="primary" size="sm" type="submit" loading={loading}>
                  Save Business KYC Details
                </Button>
              </div>
            )}
          </form>
        )}

        {/* Tab 3: Settlement Banking (Editable) */}
        {activeTab === 'bank' && (
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
              Settlement bank accounts are utilized for dispatch revenue payouts, COD balance disbursements, and billing reconciliations.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Bank Name"
                placeholder="e.g. Meezan Bank, Habib Bank Ltd..."
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="Bank Account Title"
                placeholder="Account Title matching business entity"
                value={bankTitle}
                onChange={(e) => setBankTitle(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <Input
              label="International Bank Account Number (IBAN)"
              placeholder="PK36MEZN0001234567890123"
              className="font-mono uppercase"
              value={bankIban}
              onChange={(e) => setBankIban(e.target.value)}
              disabled={!canEdit}
            />

            {canEdit && (
              <div className="flex justify-end pt-2">
                <Button variant="primary" size="sm" type="submit" loading={loading}>
                  Save Settlement Bank Account
                </Button>
              </div>
            )}
          </form>
        )}
      </div>
    </Modal>
  );
}
