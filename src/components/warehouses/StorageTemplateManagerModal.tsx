import React, { useState, useEffect } from 'react';
import { StorageTemplate, LocationType, api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Notice } from '../ui/Notice';
import { Badge } from '../ui/Badge';
import { Layers, Plus, Trash2, X, Check, Box } from 'lucide-react';

interface StorageTemplateManagerModalProps {
  onClose: () => void;
  onTemplateCreated?: () => void;
}

export const StorageTemplateManagerModal: React.FC<StorageTemplateManagerModalProps> = ({
  onClose,
  onTemplateCreated
}) => {
  const [templates, setTemplates] = useState<StorageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // New template form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('bin');
  const [description, setDescription] = useState('');
  const [lengthCm, setLengthCm] = useState('50');
  const [widthCm, setWidthCm] = useState('40');
  const [heightCm, setHeightCm] = useState('30');
  const [maxWeightKg, setMaxWeightKg] = useState('30');
  const [maxUnits, setMaxUnits] = useState('25');
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.getStorageTemplates();
      setTemplates(res.templates);
    } catch (err: any) {
      setError(err.message || 'Failed to load storage templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      const res = await api.createStorageTemplate({
        name: name.trim(),
        type,
        description: description.trim(),
        length_cm: Number(lengthCm),
        width_cm: Number(widthCm),
        height_cm: Number(heightCm),
        max_weight_kg: Number(maxWeightKg) || 0,
        max_units: Number(maxUnits) || 1
      });

      setNotice(res.message);
      setShowAddForm(false);
      setName('');
      setDescription('');
      fetchTemplates();
      if (onTemplateCreated) onTemplateCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create storage template.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this storage template?')) return;
    try {
      const res = await api.deleteStorageTemplate(id);
      setNotice(res.message);
      fetchTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to delete template.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Reusable Storage Unit Templates</h2>
              <p className="text-xs text-slate-500">Standardized physical specs (pallet footprint, shelf, tote bin)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice / Error */}
        {error && (
          <div className="p-4 pb-0 shrink-0">
            <Notice variant="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {notice && (
          <div className="p-4 pb-0 shrink-0">
            <Notice variant="success" message={notice} onDismiss={() => setNotice(null)} />
          </div>
        )}

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Configured Profiles ({templates.length})
            </span>
            {!showAddForm && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShowAddForm(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                New Template
              </Button>
            )}
          </div>

          {/* Add Form Drawer */}
          {showAddForm && (
            <form onSubmit={handleCreateTemplate} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-900">Define Storage Specification</span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <Input
                    label="Template Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Extra Deep Corrugated Bin"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Target Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as LocationType)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
                  >
                    <option value="bin">Bin</option>
                    <option value="shelf">Shelf</option>
                    <option value="rack">Rack</option>
                    <option value="bay">Pallet Bay</option>
                    <option value="aisle">Aisle</option>
                    <option value="zone">Zone</option>
                  </select>
                </div>
              </div>

              <Input
                label="Description / Storage Guidelines"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Recommended usage, packaging types, etc."
              />

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                <div>
                  <Input
                    label="Length (cm)"
                    type="number"
                    required
                    value={lengthCm}
                    onChange={(e) => setLengthCm(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    label="Width (cm)"
                    type="number"
                    required
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    label="Height (cm)"
                    type="number"
                    required
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    label="Max Weight (kg)"
                    type="number"
                    required
                    value={maxWeightKg}
                    onChange={(e) => setMaxWeightKg(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    label="Max SKU Units"
                    type="number"
                    required
                    value={maxUnits}
                    onChange={(e) => setMaxUnits(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  Save Specification
                </Button>
              </div>
            </form>
          )}

          {/* Templates List */}
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading storage specifications...</div>
          ) : templates.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
              No storage templates configured yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-3.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Box className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{tpl.name}</span>
                        <Badge variant="neutral">{tpl.type.toUpperCase()}</Badge>
                      </div>
                      {tpl.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{tpl.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 font-mono">
                        <span>Dims: {tpl.dimensions.length_cm}x{tpl.dimensions.width_cm}x{tpl.dimensions.height_cm} cm</span>
                        <span>•</span>
                        <span>Vol: {(tpl.capacity_volume_cm3 / 1000).toFixed(1)} L</span>
                        <span>•</span>
                        <span>Max: {tpl.max_weight_kg} kg ({tpl.max_units} units)</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Delete Template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end bg-slate-50/50 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
