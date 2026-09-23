import React, { useState, useEffect, useRef } from 'react';
import {
  api,
  UserSession,
  Warehouse,
  WarehouseLocation,
  InventoryUnit,
  ReceivingBatch
} from '../../lib/api';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import {
  Boxes,
  X,
  Scan,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Camera
} from 'lucide-react';

interface StockingSessionModalProps {
  user: UserSession;
  initialBatchId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PlacedUnitRecord {
  unitId: string;
  trackingCode: string;
  locationCode: string;
  timestamp: string;
}

export const StockingSessionModal: React.FC<StockingSessionModalProps> = ({
  user,
  initialBatchId,
  onClose,
  onSuccess
}) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);

  // Active Destination Location
  const [activeLocation, setActiveLocation] = useState<WarehouseLocation | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [isChangingLocation, setIsChangingLocation] = useState(false);

  // Unit Scanner Input
  const [unitScanInput, setUnitScanInput] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  // Session Activity State
  const [placedUnits, setPlacedUnits] = useState<PlacedUnitRecord[]>([]);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [lastSuccessMessage, setLastSuccessMessage] = useState<string | null>(null);

  // Camera scanner toggle state
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const unitInputRef = useRef<HTMLInputElement | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);

  // Play subtle feedback chime via Web Audio API (100% reliable, zero external assets)
  const playAudioFeedback = (success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      // Audio autoplay restrictions or headless fallback
    }
  };

  // Load warehouses & initial locations
  useEffect(() => {
    api.getWarehouses()
      .then((res) => {
        const active = res.warehouses.filter((w) => w.status === 'active');
        setWarehouses(active);
        if (active.length > 0) {
          setSelectedWarehouseId(active[0].id);
        }
      })
      .catch((err) => console.error('Failed to load warehouses:', err));
  }, []);

  // Fetch warehouse location tree
  useEffect(() => {
    if (!selectedWarehouseId) return;
    api.getWarehouseTree(selectedWarehouseId)
      .then((res) => {
        // Flatten tree nodes to selectable storage locations (racks, shelves, bins)
        const flatList: WarehouseLocation[] = [];
        const traverse = (node: any) => {
          flatList.push(node);
          if (node.children && Array.isArray(node.children)) {
            node.children.forEach(traverse);
          }
        };
        res.tree.forEach(traverse);
        setLocations(flatList);

        // Auto-select first available bin if none active
        if (!activeLocation) {
          const firstAvailable = flatList.find(
            (l) => l.status === 'available' && ['shelf', 'bin', 'rack'].includes(l.type)
          );
          if (firstAvailable) {
            setActiveLocation(firstAvailable);
          }
        }
      })
      .catch((err) => console.error('Failed to load warehouse locations:', err));
  }, [selectedWarehouseId]);

  // Focus scan input automatically
  useEffect(() => {
    if (activeLocation && !isChangingLocation) {
      setTimeout(() => {
        unitInputRef.current?.focus();
      }, 100);
    }
  }, [activeLocation, isChangingLocation]);

  // Handle Location selection or scan
  const handleSetLocation = (location: WarehouseLocation) => {
    setActiveLocation(location);
    setIsChangingLocation(false);
    setLocationInput('');
    setSessionError(null);
    setLastSuccessMessage(`Active destination changed to ${location.code}`);
    setTimeout(() => unitInputRef.current?.focus(), 100);
  };

  const handleLocationBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationInput.trim()) return;
    const clean = locationInput.trim().toUpperCase();

    const matched = locations.find(
      (l) => l.code.toUpperCase() === clean || l.barcode.toUpperCase() === clean || l.id === clean
    );

    if (matched) {
      handleSetLocation(matched);
    } else {
      setSessionError(`Location with barcode/code '${locationInput}' was not found in this facility.`);
      playAudioFeedback(false);
    }
  };

  // Handle Scan-to-Place Putaway of Physical Unit
  const handleUnitScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUnit = unitScanInput.trim().toUpperCase();
    if (!cleanUnit) return;
    if (!activeLocation) {
      setSessionError('Please select a destination storage location first.');
      playAudioFeedback(false);
      return;
    }

    setSessionError(null);
    setLastSuccessMessage(null);
    setIsProcessingScan(true);

    try {
      const res = await api.stockScanUnit({
        unitTrackingCode: cleanUnit,
        locationCodeOrBarcode: activeLocation.code
      });

      // Scan successful!
      playAudioFeedback(true);
      setLastSuccessMessage(res.message);

      // Record in session
      setPlacedUnits((prev) => [
        {
          unitId: res.unit.id,
          trackingCode: res.unit.tracking_code,
          locationCode: activeLocation.code,
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev
      ]);

      // Update active location capacity counter
      setActiveLocation((prev) =>
        prev
          ? {
              ...prev,
              occupied_units: prev.occupied_units + 1,
              status:
                prev.max_units > 0 && prev.occupied_units + 1 >= prev.max_units
                  ? 'full'
                  : prev.status
            }
          : prev
      );

      // Reset scan input & refocus
      setUnitScanInput('');
      onSuccess();
    } catch (err: any) {
      playAudioFeedback(false);
      setSessionError(err.message || 'Scan putaway failed.');
    } finally {
      setIsProcessingScan(false);
      setTimeout(() => unitInputRef.current?.focus(), 50);
    }
  };

  const capacityPct = activeLocation && activeLocation.max_units > 0
    ? Math.min(100, Math.round((activeLocation.occupied_units / activeLocation.max_units) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl my-6 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-2xs">
              <Scan className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Putaway Station: Scan-to-Place
              </h2>
              <p className="text-xs text-slate-500">
                Scan physical unit barcode to place into warehouse storage location
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Warehouse Facility Selector */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Active Facility:</span>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="h-8 px-2.5 rounded border border-slate-300 bg-white text-xs font-medium text-slate-800"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.city})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Session Units: <strong className="text-emerald-700">{placedUnits.length}</strong>
            </span>
          </div>

          {/* Active Destination Location Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Target Destination Location</span>
                </div>

                {activeLocation ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                      {activeLocation.code}
                    </span>
                    <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {activeLocation.type}
                    </span>
                    <span className="text-xs text-slate-500 truncate max-w-[200px]">
                      {activeLocation.path}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-rose-600 font-semibold">
                    No destination location selected
                  </span>
                )}
              </div>

              {/* Capacity indicator & Switch Button */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {activeLocation && activeLocation.max_units > 0 && (
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500 font-mono">
                      Capacity: <strong>{activeLocation.occupied_units}</strong> / {activeLocation.max_units}
                    </div>
                    <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full transition-all ${
                          capacityPct >= 90 ? 'bg-rose-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${capacityPct}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangingLocation(!isChangingLocation)}
                >
                  {isChangingLocation ? 'Done' : 'Switch Location'}
                </Button>
              </div>
            </div>

            {/* Quick Switch Location Subpanel */}
            {isChangingLocation && (
              <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in-50">
                <form onSubmit={handleLocationBarcodeSubmit} className="flex gap-2 mb-3">
                  <input
                    ref={locationInputRef}
                    type="text"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    placeholder="Scan location barcode (e.g. WH01-RK-A-01)..."
                    className="flex-1 h-8 px-3 rounded border border-slate-300 font-mono text-xs text-slate-900"
                    autoFocus
                  />
                  <Button type="submit" variant="primary" size="sm">
                    Select
                  </Button>
                </form>

                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 bg-white">
                  {locations.length === 0 && (
                    <div className="p-3 text-xs text-slate-400 text-center">No locations found.</div>
                  )}
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleSetLocation(loc)}
                      className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-slate-50 ${
                        activeLocation?.id === loc.id ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{loc.code}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{loc.type}</span>
                        <span className="text-[11px] text-slate-500 truncate max-w-xs">{loc.path}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {loc.occupied_units}/{loc.max_units || '∞'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Feedback Messages */}
          {sessionError && (
            <Notice variant="error" title="Putaway Error">
              {sessionError}
            </Notice>
          )}

          {lastSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800 font-medium animate-in fade-in-50">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{lastSuccessMessage}</span>
            </div>
          )}

          {/* Main Unit Scanner Wedge Box */}
          <div className="border-2 border-emerald-600/60 rounded-xl p-5 bg-emerald-50/20 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Scan className="w-4 h-4 text-emerald-700" />
                <span>Scan Physical Item Label</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Ready for USB Hardware Wedge or Manual Input
              </span>
            </div>

            <form onSubmit={handleUnitScanSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={unitInputRef}
                  type="text"
                  value={unitScanInput}
                  onChange={(e) => setUnitScanInput(e.target.value.toUpperCase())}
                  placeholder="Scan unit label barcode (e.g. UNIT-E8B2-9F1C)..."
                  className="w-full h-11 pl-4 pr-10 rounded-lg border-2 border-slate-300 font-mono text-sm tracking-wider uppercase text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 bg-white"
                  disabled={isProcessingScan || !activeLocation}
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={isProcessingScan}
                disabled={!unitScanInput.trim() || !activeLocation}
              >
                Place Unit
              </Button>
            </form>

            <p className="text-[11px] text-slate-500 mt-2">
              Barcode scanners configured as keyboard wedge will auto-submit upon scanning.
            </p>
          </div>

          {/* Live Placed Units in Current Session */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Placed In This Session ({placedUnits.length})
              </span>
            </div>

            {placedUnits.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 rounded-lg text-xs text-slate-400">
                No units scanned yet in this active session. Scan a unit barcode to put away.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                {placedUnits.map((u, idx) => (
                  <div key={idx} className="px-4 py-2 text-xs flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-mono font-bold text-slate-900">{u.trackingCode}</span>
                      <span className="text-slate-400 font-mono">→</span>
                      <span className="font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
                        {u.locationCode}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">{u.timestamp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Total placed today: <strong>{placedUnits.length} units</strong>
            </span>
            <Button variant="primary" onClick={onClose}>
              Complete Session
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
