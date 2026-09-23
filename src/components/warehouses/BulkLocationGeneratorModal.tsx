import React, { useState, useEffect } from 'react';
import { Warehouse, WarehouseLocation, StorageTemplate, LocationType, api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Notice } from '../ui/Notice';
import { Zap, X, Check, Eye } from 'lucide-react';

interface BulkLocationGeneratorModalProps {
  warehouse: Warehouse;
  parentLocation?: WarehouseLocation | null;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const BulkLocationGeneratorModal: React.FC<BulkLocationGeneratorModalProps> = ({
  warehouse,
  parentLocation,
  onClose,
  onSuccess
}) => {
  const [type, setType] = useState<LocationType>(() => {
    if (!parentLocation) return 'aisle';
    if (parentLocation.type === 'zone') return 'aisle';
    if (parentLocation.type === 'aisle') return 'rack';
    if (parentLocation.type === 'rack') return 'shelf';
    if (parentLocation.type === 'shelf') return 'bin';
    return 'bin';
  });

  const [prefix, setPrefix] = useState('Bin ');
  const [codePrefix, setCodePrefix] = useState('B');
  const [startNumber, setStartNumber] = useState('1');
  const [count, setCount] = useState('10');
  const [zeroPad, setZeroPad] = useState('2');

  const [templates, setTemplates] = useState<StorageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [lengthCm, setLengthCm] = useState('40');
  const [widthCm, setWidthCm] = useState('30');
  const [heightCm, setHeightCm] = useState('25');
  const [maxWeightKg, setMaxWeightKg] = useState('25');
  const [maxUnits, setMaxUnits] = useState('20');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Set smart defaults based on type
    if (type === 'aisle') {
      setPrefix('Aisle ');
      setCodePrefix('A');
    } else if (type === 'rack') {
      setPrefix('Rack ');
      setCodePrefix('R');
    } else if (type === 'shelf') {
      setPrefix('Shelf ');
      setCodePrefix('S');
    } else if (type === 'bin') {
      setPrefix('Bin ');
      setCodePrefix('B');
    } else if (type === 'bay') {
      setPrefix('Pallet Bay ');
      setCodePrefix('P');
    }
  }, [type]);

  useEffect(() => {
    api.getStorageTemplates()
      .then((res) => {
        setTemplates(res.templates);
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

  // Generate live preview items
  const previewItems: { name: string; code: string; barcode: string }[] = [];
  const parsedCount = Math.min(Number(count) || 0, 50); // limit preview to 50
  const parsedStart = Number(startNumber) || 1;
  const pad = Number(zeroPad) || 2;

  for (let i = 0; i < Math.min(parsedCount, 6); i++) {
    const num = parsedStart + i;
    const numStr = String(num).padStart(pad, '0');
    const codeSuffix = `${codePrefix.toUpperCase()}${numStr}`;
    const fullCode = parentLocation ? `${parentLocation.code}-${codeSuffix}` : codeSuffix;
    const fullName = `${prefix}${numStr}`;
    const fullBarcode = `LOC-${warehouse.code}-${fullCode}`;
    previewItems.push({ name: fullName, code: fullCode, barcode: fullBarcode });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.bulkCreateLocations(warehouse.id, {
        parent_id: parentLocation ? parentLocation.id : null,
        type,
        prefix,
        code_prefix: codePrefix.toUpperCase(),
        start_number: Number(startNumber),
        count: Number(count),
        zero_pad: Number(zeroPad),
        template_id: selectedTemplateId || null,
        dimensions: {
          length_cm: Number(lengthCm),
          width_cm: Number(widthCm),
          height_cm: Number(heightCm)
        },
        max_weight_kg: Number(maxWeightKg) || 0,
        max_units: Number(maxUnits) || 1
      });

      onSuccess(res.count);
    } catch (err: any) {
      setError(err.message || 'Failed to bulk-generate locations.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Bulk Location Series Generator</h2>
              <p className="text-xs text-slate-500">
                {parentLocation ? `Generating inside: ${parentLocation.path}` : `Generating root series in ${warehouse.code}`}
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
          <div className="p-4 pb-0 shrink-0">
            <Notice variant="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Target Node Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as LocationType)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
              >
                <option value="aisle">Aisles (A01...)</option>
                <option value="rack">Racks (R01...)</option>
                <option value="shelf">Shelves (S01...)</option>
                <option value="bin">Bins (B01...)</option>
                <option value="bay">Pallet Bays (P01...)</option>
              </select>
            </div>

            <div>
              <Input
                label="Name Prefix"
                required
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. Bin "
              />
            </div>

            <div>
              <Input
                label="Code Prefix"
                required
                value={codePrefix}
                onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
                placeholder="e.g. B"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Input
                label="Start Number"
                type="number"
                required
                value={startNumber}
                onChange={(e) => setStartNumber(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Number of Nodes"
                type="number"
                required
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Zero Padding
              </label>
              <select
                value={zeroPad}
                onChange={(e) => setZeroPad(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
              >
                <option value="1">No padding (1, 2, 3)</option>
                <option value="2">2 digits (01, 02, 03)</option>
                <option value="3">3 digits (001, 002, 003)</option>
              </select>
            </div>
          </div>

          {/* Template Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Storage Template Profile
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-white"
            >
              <option value="">Custom Dimensions</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.dimensions.length_cm}x{t.dimensions.width_cm}x{t.dimensions.height_cm} cm)
                </option>
              ))}
            </select>
          </div>

          {/* Dimensions */}
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

          {/* Live Preview Panel */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>Live Generated Output Preview (First {previewItems.length} of {count})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              {previewItems.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-white border border-slate-200 rounded flex items-center justify-between text-[11px]"
                >
                  <span className="font-semibold text-slate-800">{p.name}</span>
                  <span className="font-mono text-emerald-800 bg-emerald-50 px-1 rounded border border-emerald-200">
                    {p.code}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
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
              Generate {count} Locations
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
