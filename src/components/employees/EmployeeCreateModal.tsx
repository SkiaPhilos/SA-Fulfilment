import React, { useState, useEffect } from 'react';
import { api, RoleItem, EmployeeItem } from '../../lib/api';
import { formatRoleName } from '../../lib/displayFormatters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Notice } from '../ui/Notice';
import { User, Mail, Lock, Phone, Briefcase, Calendar, FileText, MapPin, Shield } from 'lucide-react';

interface EmployeeCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEmployee: EmployeeItem) => void;
}

export function EmployeeCreateModal({ isOpen, onClose, onSuccess }: EmployeeCreateModalProps) {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('Warehousing & Operations');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [cnic, setCnic] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [roleId, setRoleId] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.getRoles().then(res => {
        // Exclude customer role from employee assignment
        const staffRoles = res.roles.filter(r => r.id !== 'role_customer');
        setRoles(staffRoles);
        if (staffRoles.length > 0 && !roleId) {
          const defaultRole = staffRoles.find(r => r.id === 'role_employee') || staffRoles[0];
          setRoleId(defaultRole.id);
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.createEmployee({
        name,
        email,
        password,
        phone,
        role_id: roleId,
        designation,
        department,
        joining_date: joiningDate,
        cnic,
        address,
        city
      });
      onSuccess(res.employee);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create employee account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Onboard New Operations Employee"
      description="Create staff credentials, assign operational permissions, and initialize employment records."
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={loading}
            icon={<User className="w-3.5 h-3.5" />}
          >
            Create Staff Account
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Notice variant="error" message={error} onDismiss={() => setError(null)} />}

        {/* Section 1: Account Credentials */}
        <div className="space-y-3">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            1. Staff Identity & Access Credentials
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Legal Name"
              required
              placeholder="e.g. Asad Ullah Khan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              prefixIcon={<User className="w-4 h-4" />}
            />
            <Input
              label="Corporate Email Address"
              type="email"
              required
              placeholder="asad@shipasaan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              prefixIcon={<Mail className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Temporary Password"
              type="password"
              required
              minLength={8}
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              prefixIcon={<Lock className="w-4 h-4" />}
              helperText="Employee will use this for first sign in."
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Assigned Operational Role <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 focus:outline-none"
                  required
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {formatRoleName(r.id, r.name)} ({r.permissions.length} permissions)
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Enforces privilege containment check.</p>
            </div>
          </div>
        </div>

        {/* Section 2: Employment Details */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            2. Department & Designation
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Job Designation"
              required
              placeholder="e.g. Warehouse Inbound Lead"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              prefixIcon={<Briefcase className="w-4 h-4" />}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Department <span className="text-rose-500">*</span>
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 focus:outline-none"
                required
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
              required
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              prefixIcon={<Calendar className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Section 3: Identity & Contact */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            3. Contact & Identification
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="National CNIC Number"
              placeholder="35202-9876543-1"
              value={cnic}
              onChange={(e) => setCnic(e.target.value)}
              prefixIcon={<FileText className="w-4 h-4" />}
            />
            <Input
              label="Direct Mobile Phone"
              placeholder="0312-3456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              prefixIcon={<Phone className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Residential Address"
                placeholder="House #, Street, Area"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                prefixIcon={<MapPin className="w-4 h-4" />}
              />
            </div>
            <Input
              label="City"
              placeholder="Karachi, Lahore..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
              prefixIcon={<MapPin className="w-4 h-4" />}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
