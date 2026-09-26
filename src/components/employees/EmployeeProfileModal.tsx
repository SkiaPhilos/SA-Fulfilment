import React, { useState, useEffect } from 'react';
import { EmployeeItem, RoleItem, api } from '../../lib/api';
import { formatRoleName } from '../../lib/displayFormatters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Notice } from '../ui/Notice';
import {
  User,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Landmark,
  ShieldAlert,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText
} from 'lucide-react';

interface EmployeeProfileModalProps {
  employee: EmployeeItem;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  canEdit: boolean;
}

export function EmployeeProfileModal({
  employee,
  isOpen,
  onClose,
  onRefresh,
  canEdit
}: EmployeeProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'employment' | 'payroll' | 'docs'>('overview');
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState(employee.user.name);
  const [phone, setPhone] = useState(employee.profile?.phone || employee.user.phone || '');
  const [roleId, setRoleId] = useState(employee.user.role_id);
  const [designation, setDesignation] = useState(employee.profile?.designation || '');
  const [department, setDepartment] = useState(employee.profile?.department || 'Warehousing & Operations');
  const [joiningDate, setJoiningDate] = useState(employee.profile?.joining_date || '');
  const [cnic, setCnic] = useState(employee.profile?.cnic || '');
  const [address, setAddress] = useState(employee.profile?.address || '');
  const [city, setCity] = useState(employee.profile?.city || '');
  const [bankName, setBankName] = useState(employee.profile?.bank_name || '');
  const [bankTitle, setBankTitle] = useState(employee.profile?.bank_account_title || '');
  const [bankIban, setBankIban] = useState(employee.profile?.bank_iban || '');
  const [cvUploaded, setCvUploaded] = useState(employee.profile?.cv_uploaded || false);
  const [cnicUploaded, setCnicUploaded] = useState(employee.profile?.cnic_uploaded || false);

  const completeness = employee.completeness;

  useEffect(() => {
    if (isOpen) {
      api.getRoles().then(res => {
        setRoles(res.roles.filter(r => r.id !== 'role_customer'));
      }).catch(console.error);
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      await api.updateEmployeeProfile(employee.user.id, {
        name,
        phone,
        role_id: roleId,
        designation,
        department,
        joining_date: joiningDate,
        cnic,
        address,
        city,
        bank_name: bankName,
        bank_account_title: bankTitle,
        bank_iban: bankIban,
        cv_uploaded: cvUploaded,
        cnic_uploaded: cnicUploaded
      });
      setNotice('Employee profile and documentation records updated.');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update employee profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = employee.user.status === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`Set employee account status to ${newStatus}?`)) return;

    setLoading(true);
    try {
      await api.toggleEmployeeStatus(employee.user.id, newStatus);
      setNotice(`Employee marked as ${newStatus}.`);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={employee.user.name}
      description={`${employee.profile?.designation || 'Staff'} • ${employee.profile?.department || 'Operations'} • Email: ${employee.user.email}`}
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {canEdit && (
              <Button
                variant={employee.user.status === 'active' ? 'outline' : 'primary'}
                size="sm"
                onClick={handleToggleStatus}
                disabled={loading}
              >
                {employee.user.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {canEdit && (
              <Button variant="primary" size="sm" onClick={handleSave} loading={loading}>
                Save Changes
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Notice variant="error" message={error} onDismiss={() => setError(null)} />}
        {notice && <Notice variant="success" message={notice} onDismiss={() => setNotice(null)} />}

        {/* Top Badges & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Badge variant={employee.user.status === 'active' ? 'success' : 'neutral'} dot>
              {employee.user.status === 'active' ? 'Active Staff' : 'Inactive'}
            </Badge>
            <Badge variant="neutral">{formatRoleName(employee.user.role_id, employee.user.role_name)}</Badge>
            <span className="text-xs text-slate-500 font-mono">
              Score: {employee.profile?.completeness_score || 0}% Complete
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
              onClick={() => setActiveTab('employment')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'employment'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Employment & Role
            </button>
            <button
              onClick={() => setActiveTab('payroll')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'payroll'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Payroll Banking
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'docs'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Document Verification
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
                  {completeness?.score || employee.profile?.completeness_score || 0}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-3">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    (completeness?.score || 0) >= 80 ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${completeness?.score || employee.profile?.completeness_score || 0}%` }}
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

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-md">
                <span className="text-slate-400 block text-[11px]">Designation</span>
                <span className="font-semibold text-slate-900">{employee.profile?.designation || 'Not Set'}</span>
                <span className="block text-slate-500 mt-0.5">{employee.profile?.department || 'Operations'}</span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-md">
                <span className="text-slate-400 block text-[11px]">Joined Date</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {employee.profile?.joining_date || 'N/A'}
                </span>
                <span className="block text-slate-500 mt-0.5">Verified HR Record</span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-md">
                <span className="text-slate-400 block text-[11px]">Identity Documents</span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={employee.profile?.cv_uploaded ? 'success' : 'neutral'}>
                    CV {employee.profile?.cv_uploaded ? '✓' : '✗'}
                  </Badge>
                  <Badge variant={employee.profile?.cnic_uploaded ? 'success' : 'neutral'}>
                    CNIC {employee.profile?.cnic_uploaded ? '✓' : '✗'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Employment & Role */}
        {activeTab === 'employment' && (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                required
              />
              <Input
                label="Direct Mobile Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Job Designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                disabled={!canEdit}
                required
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 focus:outline-none"
                >
                  <option value="Warehousing & Operations">Warehousing & Operations</option>
                  <option value="Fulfillment & Dispatch">Fulfillment & Dispatch</option>
                  <option value="Inbound Logistics & Putaway">Inbound Logistics & Putaway</option>
                  <option value="Finance & Accounts">Finance & Accounts</option>
                  <option value="Customer Support">Customer Support</option>
                  <option value="Executive Management">Executive Management</option>
                </select>
              </div>

              <Input
                label="Joining Date"
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                disabled={!canEdit}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Operational Role Assignment
                </label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 focus:outline-none"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {formatRoleName(r.id, r.name)} ({r.permissions.length} permissions)
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">Privilege containment enforced server-side.</p>
              </div>

              <Input
                label="National CNIC Number"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Residential Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <Input
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </form>
        )}

        {/* Tab 3: Payroll Banking */}
        {activeTab === 'payroll' && (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
              Salary and payroll disbursements are routed to the employee's verified commercial bank account.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Salary Bank Name"
                placeholder="e.g. Bank Alfalah, Standard Chartered..."
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="Account Title"
                placeholder="Exact account holder title"
                value={bankTitle}
                onChange={(e) => setBankTitle(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <Input
              label="Salary IBAN (24 Characters)"
              placeholder="PK36ALFH0001234567890123"
              className="font-mono uppercase"
              value={bankIban}
              onChange={(e) => setBankIban(e.target.value)}
              disabled={!canEdit}
            />
          </form>
        )}

        {/* Tab 4: Document Verification Checklist */}
        {activeTab === 'docs' && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
              Human Resources document compliance verification. Mark items as received and verified against physical records.
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center ${
                    cvUploaded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">Signed Curriculum Vitae (CV) / Resume</div>
                    <div className="text-[11px] text-slate-500">Professional background, previous logistics experience</div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cvUploaded}
                    onChange={(e) => setCvUploaded(e.target.checked)}
                    disabled={!canEdit}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center ${
                    cnicUploaded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">NADRA National Identity Card (CNIC) Copy</div>
                    <div className="text-[11px] text-slate-500">Government identity verification and biometric clearance</div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cnicUploaded}
                    onChange={(e) => setCnicUploaded(e.target.checked)}
                    disabled={!canEdit}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
