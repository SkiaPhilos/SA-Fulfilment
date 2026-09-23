import React, { useState } from 'react';
import { Warehouse, api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Notice } from '../ui/Notice';
import { Building2, X, MapPin, User, Phone, Check } from 'lucide-react';

interface WarehouseCreateModalProps {
  onClose: () => void;
  onSuccess: (warehouse: Warehouse) => void;
}

export const WarehouseCreateModal: React.FC<WarehouseCreateModalProps> = ({ onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('Islamabad');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [totalAreaSqft, setTotalAreaSqft] = useState('20000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.createWarehouse({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        city: city.trim(),
        address: address.trim(),
        contact_person: contactPerson.trim(),
        contact_phone: contactPhone.trim(),
        total_area_sqft: Number(totalAreaSqft) || 0
      });
      onSuccess(res.warehouse);
    } catch (err: any) {
      setError(err.message || 'Failed to create warehouse.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Register Warehouse Facility</h2>
              <p className="text-xs text-slate-500">Configure a physical hub or fulfillment cross-dock facility</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-4 pb-0">
            <Notice variant="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Input
                label="Facility Code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. KHI-01"
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Facility Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Karachi Port Fulfillment Hub"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                City / Region <span className="text-rose-500">*</span>
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
              >
                <option value="Islamabad">Islamabad</option>
                <option value="Rawalpindi">Rawalpindi</option>
                <option value="Lahore">Lahore</option>
                <option value="Karachi">Karachi</option>
                <option value="Faisalabad">Faisalabad</option>
                <option value="Multan">Multan</option>
                <option value="Peshawar">Peshawar</option>
                <option value="Sialkot">Sialkot</option>
              </select>
            </div>
            <div>
              <Input
                label="Covered Floor Area (Sq Ft)"
                type="number"
                value={totalAreaSqft}
                onChange={(e) => setTotalAreaSqft(e.target.value)}
                placeholder="25000"
              />
            </div>
          </div>

          <Input
            label="Physical Street Address"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Plot / Street / Industrial Estate address"
            prefixIcon={<MapPin className="w-4 h-4 text-slate-400" />}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Facility Manager / In-Charge"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. Asim Raza"
              prefixIcon={<User className="w-4 h-4 text-slate-400" />}
            />
            <Input
              label="Contact Phone / Hotline"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="e.g. +92 51 0000000"
              prefixIcon={<Phone className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={loading}
              icon={<Check className="w-4 h-4" />}
            >
              Register Facility
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
