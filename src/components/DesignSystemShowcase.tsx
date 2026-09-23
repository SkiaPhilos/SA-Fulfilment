import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table';
import { Modal } from './ui/Modal';
import { EmptyState } from './ui/EmptyState';
import { Notice } from './ui/Notice';
import { Skeleton } from './ui/Skeleton';
import {
  Boxes,
  Plus,
  Trash2,
  Download,
  Search,
  Filter,
  Package,
  Layers,
  Check,
  AlertTriangle
} from 'lucide-react';

export function DesignSystemShowcase() {
  const [modalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [filterQuery, setFilterQuery] = useState('');

  // Sample data demonstrating dense, scannable tabular figures
  const sampleRows = [
    { code: 'LOC-KHI-A01-R02', type: 'Storage Rack', zone: 'Karachi Central Hub', capacity: 250, occupied: 184, status: 'success', statusLabel: 'Available' },
    { code: 'LOC-LHR-B03-R01', type: 'High-Density Bin', zone: 'Lahore South Facility', capacity: 100, occupied: 98, status: 'warning', statusLabel: 'Near Capacity' },
    { code: 'LOC-ISB-C01-P04', type: 'Pallet Position', zone: 'Islamabad Express Staging', capacity: 50, occupied: 50, status: 'danger', statusLabel: 'Full' },
    { code: 'LOC-FSD-D02-R01', type: 'Staging Floor', zone: 'Faisalabad Sort Center', capacity: 400, occupied: 0, status: 'neutral', statusLabel: 'Inactive' }
  ];

  return (
    <div className="space-y-8 max-w-6xl pb-12">
      {/* Introduction Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Ship Asaan Design System & Visual Foundation
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
          The operational design system governing all fulfillment, inventory, warehouse, and financial modules. Built with clean surfaces, crisp typography, accessible status tokens, and dense data legibility.
        </p>
      </div>

      {/* 1. Page Backgrounds, Surfaces & Cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          1. Surfaces, Cards & Depth
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Standard Operational Card</CardTitle>
                <CardDescription>Single-elevation surface with hairline border</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600 leading-relaxed">
                Flat, high-contrast surface (<span className="font-mono text-slate-900">#FFFFFF</span>) over calm neutral canvas (<span className="font-mono text-slate-900">#F8FAFC</span>). Zero nested cards within cards.
              </p>
            </CardContent>
            <CardFooter>
              <span className="text-slate-400 font-mono text-[11px]">Surface: 100% white</span>
              <Badge variant="neutral">Elevation 0</Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Capacity Metric Surface</CardTitle>
                <CardDescription>Real-time physical capacity indicators</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">74.2%</span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">1,840 / 2,480 units</span>
              </div>
              <div className="w-full bg-slate-100 rounded h-2 overflow-hidden">
                <div className="bg-emerald-600 h-2 rounded transition-all" style={{ width: '74.2%' }} />
              </div>
            </CardContent>
            <CardFooter>
              <span className="text-slate-500">Warehouse Rack Health</span>
              <Badge variant="success" dot>Nominal</Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Action & Interactive Panel</CardTitle>
                <CardDescription>Explicit functional trigger targets</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Interactive dialog triggers and operations controllers maintain high touch-targets (minimum 36px).
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setModalOpen(true)}
              >
                Launch Verification Modal
              </Button>
            </CardContent>
            <CardFooter>
              <span className="text-slate-400">Modal Standard</span>
              <span className="text-[11px] text-emerald-700 font-medium">Accessible ESC + Focus</span>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* 2. Typography & Hierarchy */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          2. Typography Scale & Tabular Discipline
        </h2>
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2 border-b border-slate-100 items-baseline">
              <span className="text-xs text-slate-400 font-mono">Display Heading 1 (24px / 700)</span>
              <span className="md:col-span-3 text-2xl font-bold tracking-tight text-slate-900">
                Ship Asaan Fulfillment Management
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2 border-b border-slate-100 items-baseline">
              <span className="text-xs text-slate-400 font-mono">Section Heading 2 (16px / 600)</span>
              <span className="md:col-span-3 text-base font-semibold tracking-tight text-slate-900">
                Inbound Receiving & Putaway Queue
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2 border-b border-slate-100 items-baseline">
              <span className="text-xs text-slate-400 font-mono">Body Prose (13px / 400)</span>
              <span className="md:col-span-3 text-xs text-slate-600 leading-relaxed">
                Physical inventory units require explicit barcode verification before assignment to warehouse rack locations. Software enforces actual floor truth without speculative auto-placement.
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2 items-baseline">
              <span className="text-xs text-slate-400 font-mono">Tabular Numerals (12px / 500)</span>
              <div className="md:col-span-3 font-mono text-xs text-slate-800 space-x-4 tabular-nums">
                <span>PKR 1,450,200.00</span>
                <span>SKU-ELEC-4091-WH</span>
                <span>2026-09-22 19:35:10</span>
                <span>QTY: 1,420 PCS</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Buttons & Interactive Controls */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          3. Button Variants & Interaction States
        </h2>
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
                Primary Action (Emerald)
              </Button>
              <Button variant="secondary">
                Secondary Dark
              </Button>
              <Button variant="outline" icon={<Download className="w-4 h-4" />}>
                Outline Neutral
              </Button>
              <Button variant="ghost">
                Ghost Action
              </Button>
              <Button variant="danger" icon={<Trash2 className="w-4 h-4" />}>
                Destructive Action
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
              <Button size="sm" variant="primary">Small (32px)</Button>
              <Button size="md" variant="primary">Medium (36px)</Button>
              <Button size="lg" variant="primary">Large (40px)</Button>
              <Button size="md" variant="primary" loading>Loading State</Button>
              <Button size="md" variant="outline" disabled>Disabled State</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. Form Controls */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          4. Form Inputs, Validation & Feedback
        </h2>
        <Card>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Standard Text Input"
              placeholder="e.g. Warehouse Rack 01"
              helperText="Descriptive name for physical location"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />

            <Input
              label="Search Affordance"
              placeholder="Search by SKU, tracking #, customer..."
              prefixIcon={<Search className="w-4 h-4" />}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />

            <Input
              label="Input with Error Feedback"
              placeholder="Invalid input example"
              value="invalid_sku_identifier"
              error="SKU must follow standard format: SKU-CAT-XXXX"
              onChange={() => {}}
            />
          </CardContent>
        </Card>
      </section>

      {/* 5. Status Indicators (Anti-Pill & WCAG AA) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          5. Status Indicators & Metadata Tokens
        </h2>
        <Card>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="success" dot>Active / Ready</Badge>
              <Badge variant="warning" dot>Pending Approval</Badge>
              <Badge variant="danger" dot>Suspended / Discrepancy</Badge>
              <Badge variant="info">Inbound Staged</Badge>
              <Badge variant="neutral">Draft / Inactive</Badge>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Zero static pill enclosures. Subdued rectangular geometry with explicit WCAG AA color pairs and accessible semantic dot signals.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 6. High-Density Tables */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            6. High-Density Data Grid
          </h2>
          <span className="text-xs text-slate-400 font-mono">4 Records Loaded</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location Identifier</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Warehouse Zone</TableHead>
              <TableHead className="text-right">Max Capacity</TableHead>
              <TableHead className="text-right">Units Occupied</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleRows.map((row) => (
              <TableRow key={row.code}>
                <TableCell className="font-mono font-medium text-slate-900">{row.code}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell className="text-slate-600">{row.zone}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.capacity}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{row.occupied}</TableCell>
                <TableCell>
                  <Badge variant={row.status as any} dot>
                    {row.statusLabel}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* 7. Notices & Alerts */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          7. Contextual Notice Banners
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Notice
            variant="success"
            title="Authoritative Database Node Verified"
            message="Relational data files synchronized with atomic disk flushes."
          />
          <Notice
            variant="warning"
            title="Scan-to-Place Verification Required"
            message="Item SKU-9401 must be scanned into physical location before order picking."
          />
          <Notice
            variant="error"
            title="Transaction Rejection Prevented"
            message="Customer wallet balance (PKR 0) insufficient for fulfillment dispatch fees."
          />
          <Notice
            variant="info"
            title="KYC Document Verification Status"
            message="Reviewing business registration and tax documents in compliance queue."
          />
        </div>
      </section>

      {/* 8. Empty States & Skeletons */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          8. Empty State & Skeleton Loading
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <EmptyState
              title="No Inbound Shipments in Transit"
              description="When suppliers dispatch inventory batches to your warehouse nodes, shipment tracking numbers will display here."
              actionLabel="Create Inbound Batch"
              onAction={() => alert('Sample empty state action invoked.')}
            />
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Skeleton Placeholder Preview</CardTitle>
                <CardDescription>Geometry-aligned during data fetches</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="pt-2 flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Interactive Modal Demo */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Location Verification Confirmation"
        description="Review physical storage details before locking bin capacity."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                alert('Verification confirmed!');
                setModalOpen(false);
              }}
            >
              Confirm Location
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            You are verifying warehouse location <strong className="text-slate-900 font-mono">LOC-KHI-A01-R02</strong>. Once confirmed, stock labels for this rack location will be eligible for physical barcode printing.
          </p>
          <div className="bg-slate-50 p-3 rounded-md border border-slate-200 font-mono text-[11px] space-y-1">
            <div>Zone: Karachi Central Hub (Zone A)</div>
            <div>Aisle: 01 &bull; Rack: 02 &bull; Tier: 03</div>
            <div>Max Weight Rating: 1,500 KG</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
