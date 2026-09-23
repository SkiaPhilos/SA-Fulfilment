import React, { useState } from 'react';
import { UserSession, CustomerProfile, api } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Notice } from '../ui/Notice';
import {
  Clock,
  CheckCircle2,
  Building,
  Mail,
  Phone,
  MapPin,
  FileText,
  LogOut,
  RefreshCw,
  Landmark
} from 'lucide-react';

interface CustomerPendingViewProps {
  user: UserSession;
  onLogout: () => void;
  onRefresh: () => void;
}

export function CustomerPendingView({ user, onLogout, onRefresh }: CustomerPendingViewProps) {
  const profile = user.customer_profile;
  const [editingBank, setEditingBank] = useState(false);
  const [bankName, setBankName] = useState(profile?.bank_name || '');
  const [bankTitle, setBankTitle] = useState(profile?.bank_account_title || '');
  const [bankIban, setBankIban] = useState(profile?.bank_iban || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      await api.updateCustomerProfile(profile.id, {
        bank_name: bankName,
        bank_account_title: bankTitle,
        bank_iban: bankIban
      });
      setMessage('Settlement banking details recorded. This accelerates the verification process.');
      setEditingBank(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update bank details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl w-full space-y-6">
        {/* Header Branding */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-emerald-700 text-white font-bold text-xs flex items-center justify-center tracking-wider">
              SA
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight">Ship Asaan</span>
              <span className="text-xs text-slate-500 block">Merchant Operations & Onboarding</span>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={onLogout} icon={<LogOut className="w-3.5 h-3.5" />}>
            Sign Out
          </Button>
        </div>

        {/* Primary Status Card */}
        <Card>
          <CardHeader className="bg-amber-50/60 border-b border-amber-100/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Merchant Account Under Operational Review</CardTitle>
                  <Badge variant="warning" dot>Pending Approval</Badge>
                </div>
                <CardDescription>
                  Your business account registration has been submitted and is currently being verified by the Ship Asaan compliance desk.
                </CardDescription>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={onRefresh} icon={<RefreshCw className="w-3.5 h-3.5" />}>
              Refresh
            </Button>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {message && <Notice variant="success" message={message} onDismiss={() => setMessage(null)} />}

            {/* Stepper */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">1. Account Created</div>
                  <div className="text-[11px] text-slate-500">Credentials active</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div>
                  <div className="text-xs font-semibold text-amber-900">2. KYC & Compliance</div>
                  <div className="text-[11px] text-amber-700 font-medium">In Queue (24-48h)</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">3. Node Allocation</div>
                  <div className="text-[11px] text-slate-400">Warehouse activation</div>
                </div>
              </div>
            </div>

            {/* Application Summary */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Submitted Merchant Profile
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Building className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Legal Entity: <strong className="text-slate-900">{profile?.business_name || 'N/A'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Building className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Brand / Store: <strong className="text-slate-900">{profile?.brand_name || 'N/A'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Tax / CNIC: <span className="font-mono text-slate-900">{profile?.cnic_or_ntn || 'N/A'}</span></span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Registered Email: <span className="font-mono text-slate-900">{user.email}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Contact Mobile: <span className="font-mono text-slate-900">{profile?.phone || user.phone || 'N/A'}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Operations Hub: <span className="text-slate-900">{profile?.city || 'N/A'}</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Settlement Banking Details */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-slate-500" />
                  <h4 className="text-xs font-semibold text-slate-800">Settlement Bank Account (Optional for Expedited Review)</h4>
                </div>
                {!editingBank && (
                  <Button variant="outline" size="sm" onClick={() => setEditingBank(true)}>
                    {profile?.bank_iban ? 'Edit Bank Details' : 'Add Bank Account'}
                  </Button>
                )}
              </div>

              {editingBank ? (
                <form onSubmit={handleSaveBank} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Bank Name"
                      placeholder="e.g. Meezan Bank, HBL..."
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      required
                    />
                    <Input
                      label="Account Title"
                      placeholder="Exact title matching legal business"
                      value={bankTitle}
                      onChange={(e) => setBankTitle(e.target.value)}
                      required
                    />
                  </div>

                  <Input
                    label="Settlement IBAN (24 Characters)"
                    placeholder="PK36MEZN0001234567890123"
                    className="font-mono uppercase"
                    value={bankIban}
                    onChange={(e) => setBankIban(e.target.value)}
                    required
                  />

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" type="button" onClick={() => setEditingBank(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit" loading={saving}>
                      Save Bank Profile
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="p-3 bg-slate-50/50 rounded-md border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  {profile?.bank_iban ? (
                    <div>
                      <span className="font-semibold text-slate-900">{profile.bank_name}</span> &bull; {profile.bank_account_title}
                      <div className="font-mono text-slate-500 text-[11px] mt-0.5">{profile.bank_iban}</div>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No settlement bank attached yet. Adding it speeds up financial ledger activation.</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter>
            <span>Questions regarding onboarding status? Contact: <a href="mailto:support@shipasaan.com" className="text-emerald-700 underline font-medium">support@shipasaan.com</a></span>
            <span className="font-mono text-[11px] text-slate-400">Desk ID: SA-KYC-QUEUE</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
