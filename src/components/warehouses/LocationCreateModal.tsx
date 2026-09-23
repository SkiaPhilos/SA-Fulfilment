import React, { useState, useEffect } from 'react';
import { Warehouse, WarehouseLocation, StorageTemplate, LocationType, api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Notice } from '../ui/Notice';
import { Plus, X, Layers, Check, FolderTree } from 'lucide-react';

interface LocationCreateModalProps {
  warehouse: Warehouse;
  parentLocation?: WarehouseLocation | null;
  onClose: () => void;
  onSuccess: (location: WarehouseLocation) => void;
}

export const LocationCreateModal: React.FC<LocationCreateModalProps> = ({
  warehouse,
  parentLocation,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<LocationType>(() => {
    if (!parentLocation) return 'zone';
    if (parentLocation.type === 'zone') return 'aisle';
    if (parentLocation.type === 'aisle') return 'rack';
    if (parentLocation.type === 'rack') return 'shelf';
    if (parentLocation.type === 'shelf') return 'bin';
    return 'bin';
  });

  const [templates, setTemplates] = useState<StorageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [lengthCm, setLengthCm] = useState('100');
  const [widthCm, setWidthCm] = useState('100');
  const [heightCm, setHeightCm] = useState('100');
  const [maxWeightKg, setMaxWeightKg] = useState('500');
  const [maxUnits, setMaxUnits] = useState('100');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getStorageTemplates()
      .then((res) => {
        setTemplates(res.templates);
        // Preselect matching template if any
        const match = res.templates.find((t) => t.type === type);
        if (match) {
          applyTemplate(match);
        }
      })
      .catch(() => {});
  }, [type]);

  const applyTemplate = (tpl: StorageTemplate) => {
    setSelectedTemplateId(tpl.id);
    setLengthCm(String(tpl.dimensions.length_cm));
    setWidthCm(String(tpl.dimensions.width_cm));
    setHeightCm(String(tpl.dimensions.height_cm));
    setMaxWeightKg(String(tpl.max_weight_kg));
    setMaxUnits(String(tpl.max_units));
  };

  const handleTemplateChange = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (!tplId) return;
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) {
      applyTemplate(tpl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.createLocation(warehouse.id, {
        parent_id: parentLocation ? parentLocation.id : null,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type,
        template_id: selectedTemplateId || null,
        dimensions: {
          length_cm: Number(lengthCm),
          width_cm: Number(widthCm),
          height_cm: Number(heightCm)
        },
        max_weight_kg: Number(maxWeightKg) || 0,
        max_units: Number(maxUnits) || 1,
        notes: notes.trim()
      });

      onSuccess(res.location);
    } catch (err: any) {
      setError(err.message || 'Failed to create location.');
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
              <FolderTree className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {parentLocation ? `Add Sub-Location to ${parentLocation.code}` : `Create Root Zone in ${warehouse.code}`}
              </h2>
              <p className="text-xs text-slate-500">
                {parentLocation ? `Parent: ${parentLocation.path}` : `Facility: ${warehouse.name}`}
              </p>
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Location Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as LocationType)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
              >
                <option value="zone">Zone (Area)</option>
                <option value="aisle">Aisle (Row)</option>
                <option value="rack">Rack (Bay Structure)</option>
                <option value="shelf">Shelf (Level)</option>
                <option value="bin">Bin (Picking Slot)</option>
                <option value="bay">Pallet Bay</option>
              </select>
            </div>

            <div>
              <Input
                label="Node Code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={parentLocation ? 'e.g. B01 or S02' : 'e.g. ZA'}
              />
            </div>

            <div>
              <Input
                label="Display Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bin 01"
              />
            </div>
          </div>

          {/* Quick Template Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Apply Physical Template (Optional)</span>
              <span className="text-[10px] text-slate-400 font-normal">Auto-populates dimensions</span>
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
            >
              <option value="">Manual Custom Dimensions</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type.toUpperCase()} - {t.dimensions.length_cm}x{t.dimensions.width_cm}x{t.dimensions.height_cm} cm)
                </option>
              ))}
            </select>
          </div>

          {/* Physical Dimensions */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
            <div>
              <Input
                label="L (cm)"
                type="number"
                required
                value={lengthCm}
                onChange={(e) => setLengthCm(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="W (cm)"
                type="number"
                required
                value={widthCm}
                onChange={(e) => setWidthCm(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="H (cm)"
                type="number"
                required
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Max (kg)"
                type="number"
                required
                value={maxWeightKg}
                onChange={(e) => setMaxWeightKg(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Max Units"
                type="number"
                required
                value={maxUnits}
                onChange={(e) => setMaxUnits(e.target.value)}
              />
            </div>
          </div>

          <Input
            label="Location Notes / Restrictions"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Fragile only, bottom shelf, forklift required"
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
              Create Location
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
