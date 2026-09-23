import React, { useState } from 'react';
import { WarehouseLocation, LocationStatus, api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Notice } from '../ui/Notice';
import { Edit2, X, Check } from 'lucide-react';

interface LocationEditModalProps {
  location: WarehouseLocation;
  onClose: () => void;
  onSuccess: (updated: WarehouseLocation) => void;
}

export const LocationEditModal: React.FC<LocationEditModalProps> = ({
  location,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState(location.name);
  const [status, setStatus] = useState<LocationStatus>(location.status);
  const [notes, setNotes] = useState(location.notes || '');
  const [lengthCm, setLengthCm] = useState(String(location.dimensions.length_cm));
  const [widthCm, setWidthCm] = useState(String(location.dimensions.width_cm));
  const [heightCm, setHeightCm] = useState(String(location.dimensions.height_cm));
  const [maxWeightKg, setMaxWeightKg] = useState(String(location.max_weight_kg));
  const [maxUnits, setMaxUnits] = useState(String(location.max_units));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.updateLocation(location.id, {
        name: name.trim(),
        status,
        notes: notes.trim(),
        dimensions: {
          length_cm: Number(lengthCm),
          width_cm: Number(widthCm),
          height_cm: Number(heightCm)
        },
        max_weight_kg: Number(maxWeightKg) || 0,
        max_units: Number(maxUnits) || 1
      });

      onSuccess(res.location);
    } catch (err: any) {
      setError(err.message || 'Failed to update location.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Edit Location: {location.code}</h2>
              <p className="text-xs text-slate-500 font-mono">{location.barcode}</p>
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
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Display Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Operating Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LocationStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
              >
                <option value="available">Available (Active)</option>
                <option value="full">Full (At Max Capacity)</option>
                <option value="restricted">Restricted / Quarantine</option>
                <option value="damaged">Damaged / Maintenance</option>
                <option value="reserved">Reserved for Key Merchant</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <Input
              label="L (cm)"
              type="number"
              value={lengthCm}
              onChange={(e) => setLengthCm(e.target.value)}
            />
            <Input
              label="W (cm)"
              type="number"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
            />
            <Input
              label="H (cm)"
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max Weight (kg)"
              type="number"
              value={maxWeightKg}
              onChange={(e) => setMaxWeightKg(e.target.value)}
            />
            <Input
              label="Max Unit Capacity"
              type="number"
              value={maxUnits}
              onChange={(e) => setMaxUnits(e.target.value)}
            />
          </div>

          <Input
            label="Location Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Operational notes or hazard warnings"
          />

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
              Update Location
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
