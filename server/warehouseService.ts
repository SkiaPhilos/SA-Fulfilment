import {
  getDb,
  withTransaction,
  WarehouseRow,
  StorageTemplateRow,
  WarehouseLocationRow,
  LocationType,
  LocationStatus
} from './db.js';
import { generateId } from './security.js';
import { logAudit } from './audit.js';
import QRCode from 'qrcode';

export interface LocationTreeNode extends WarehouseLocationRow {
  children: LocationTreeNode[];
  total_descendants: number;
}

export interface BulkLocationGenerationConfig {
  parent_id: string | null;
  type: LocationType;
  prefix: string; // e.g. 'Aisle ' or 'Rack ' or 'Bin '
  code_prefix: string; // e.g. 'A' or 'R' or 'B'
  start_number: number; // e.g. 1
  count: number; // e.g. 10 -> A01 to A10
  zero_pad: number; // e.g. 2 -> '01', '02'
  template_id?: string | null;
  dimensions?: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  max_weight_kg?: number;
  max_units?: number;
}

export const warehouseService = {
  // ----------------------------------------------------
  // Warehouse Infrastructure
  // ----------------------------------------------------
  async listWarehouses(): Promise<(WarehouseRow & { total_locations: number; total_capacity_units: number; occupied_units: number })[]> {
    const db = getDb();
    return db.warehouses.map((wh) => {
      const locs = db.warehouse_locations.filter((l) => l.warehouse_id === wh.id);
      const totalCapacity = locs.reduce((sum, l) => sum + (l.max_units || 0), 0);
      const occupied = locs.reduce((sum, l) => sum + (l.occupied_units || 0), 0);
      return {
        ...wh,
        total_locations: locs.length,
        total_capacity_units: totalCapacity,
        occupied_units: occupied
      };
    });
  },

  async getWarehouseById(id: string): Promise<WarehouseRow | null> {
    const db = getDb();
    return db.warehouses.find((w) => w.id === id) || null;
  },

  async createWarehouse(
    data: {
      code: string;
      name: string;
      city: string;
      address: string;
      contact_person: string;
      contact_phone: string;
      total_area_sqft: number;
    },
    actor: { id: string; name: string; email: string }
  ): Promise<WarehouseRow> {
    return withTransaction((db) => {
      const normalizedCode = data.code.trim().toUpperCase();
      const existing = db.warehouses.find((w) => w.code.toUpperCase() === normalizedCode);
      if (existing) {
        throw new Error(`Warehouse with code "${normalizedCode}" already exists.`);
      }

      const now = new Date().toISOString();
      const warehouse: WarehouseRow = {
        id: generateId('wh'),
        code: normalizedCode,
        name: data.name.trim(),
        city: data.city.trim(),
        address: data.address.trim(),
        contact_person: data.contact_person.trim(),
        contact_phone: data.contact_phone.trim(),
        status: 'active',
        total_area_sqft: Number(data.total_area_sqft) || 0,
        created_at: now,
        updated_at: now
      };

      db.warehouses.push(warehouse);

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'warehouse.create',
        entityType: 'warehouse',
        entityId: warehouse.id,
        metadata: {
          code: warehouse.code,
          name: warehouse.name,
          city: warehouse.city
        }
      });

      return warehouse;
    });
  },

  async updateWarehouse(
    id: string,
    data: Partial<Omit<WarehouseRow, 'id' | 'created_at'>>,
    actor: { id: string; name: string; email: string }
  ): Promise<WarehouseRow> {
    return withTransaction((db) => {
      const index = db.warehouses.findIndex((w) => w.id === id);
      if (index === -1) {
        throw new Error('Warehouse not found.');
      }

      const existing = db.warehouses[index];
      if (data.code && data.code.toUpperCase() !== existing.code) {
        const codeTaken = db.warehouses.some(
          (w) => w.id !== id && w.code.toUpperCase() === data.code!.toUpperCase()
        );
        if (codeTaken) {
          throw new Error(`Warehouse code "${data.code}" is already in use.`);
        }
      }

      const updated: WarehouseRow = {
        ...existing,
        ...data,
        code: data.code ? data.code.toUpperCase().trim() : existing.code,
        updated_at: new Date().toISOString()
      };

      db.warehouses[index] = updated;

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'warehouse.update',
        entityType: 'warehouse',
        entityId: id,
        metadata: { changes: data }
      });

      return updated;
    });
  },

  // ----------------------------------------------------
  // Storage Templates
  // ----------------------------------------------------
  async listStorageTemplates(): Promise<StorageTemplateRow[]> {
    const db = getDb();
    return [...db.storage_templates];
  },

  async createStorageTemplate(
    data: {
      name: string;
      type: LocationType;
      description?: string;
      length_cm: number;
      width_cm: number;
      height_cm: number;
      max_weight_kg: number;
      max_units: number;
    },
    actor: { id: string; name: string; email: string }
  ): Promise<StorageTemplateRow> {
    return withTransaction((db) => {
      const volume = Math.round(Number(data.length_cm) * Number(data.width_cm) * Number(data.height_cm));
      const template: StorageTemplateRow = {
        id: generateId('tpl'),
        name: data.name.trim(),
        type: data.type,
        description: data.description?.trim(),
        dimensions: {
          length_cm: Number(data.length_cm),
          width_cm: Number(data.width_cm),
          height_cm: Number(data.height_cm)
        },
        capacity_volume_cm3: volume,
        max_weight_kg: Number(data.max_weight_kg) || 0,
        max_units: Number(data.max_units) || 1,
        created_at: new Date().toISOString()
      };

      db.storage_templates.push(template);

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'storage_template.create',
        entityType: 'storage_template',
        entityId: template.id,
        metadata: { name: template.name, type: template.type }
      });

      return template;
    });
  },

  async deleteStorageTemplate(id: string, actor: { id: string; name: string; email: string }): Promise<void> {
    return withTransaction((db) => {
      const inUse = db.warehouse_locations.some((l) => l.template_id === id);
      if (inUse) {
        throw new Error('Cannot delete storage template because it is currently assigned to warehouse locations.');
      }

      const idx = db.storage_templates.findIndex((t) => t.id === id);
      if (idx === -1) {
        throw new Error('Storage template not found.');
      }

      const [removed] = db.storage_templates.splice(idx, 1);
      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'storage_template.delete',
        entityType: 'storage_template',
        entityId: id,
        metadata: { name: removed.name }
      });
    });
  },

  // ----------------------------------------------------
  // Location Hierarchy & Traversal
  // ----------------------------------------------------
  async getLocationTree(warehouseId: string): Promise<LocationTreeNode[]> {
    const db = getDb();
    const locations = db.warehouse_locations.filter((l) => l.warehouse_id === warehouseId);

    // Build children map
    const nodeMap = new Map<string, LocationTreeNode>();
    locations.forEach((loc) => {
      nodeMap.set(loc.id, {
        ...loc,
        children: [],
        total_descendants: 0
      });
    });

    const rootNodes: LocationTreeNode[] = [];

    nodeMap.forEach((node) => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        const parent = nodeMap.get(node.parent_id)!;
        parent.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    // Helper to calculate total descendants recursively
    function calculateDescendants(node: LocationTreeNode): number {
      let count = node.children.length;
      for (const child of node.children) {
        count += calculateDescendants(child);
      }
      node.total_descendants = count;
      // Sort children alphabetically by code
      node.children.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      return count;
    }

    rootNodes.forEach(calculateDescendants);
    rootNodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    return rootNodes;
  },

  async getLocationById(id: string): Promise<(WarehouseLocationRow & { breadcrumbs: { id: string; name: string; code: string; type: LocationType }[] }) | null> {
    const db = getDb();
    const loc = db.warehouse_locations.find((l) => l.id === id);
    if (!loc) return null;

    // Build breadcrumbs path
    const breadcrumbs: { id: string; name: string; code: string; type: LocationType }[] = [];
    let current: WarehouseLocationRow | undefined = loc;
    while (current) {
      breadcrumbs.unshift({
        id: current.id,
        name: current.name,
        code: current.code,
        type: current.type
      });
      current = current.parent_id ? db.warehouse_locations.find((l) => l.id === current!.parent_id) : undefined;
    }

    return {
      ...loc,
      breadcrumbs
    };
  },

  async createLocation(
    data: {
      warehouse_id: string;
      parent_id?: string | null;
      name: string;
      code: string;
      type: LocationType;
      template_id?: string | null;
      dimensions?: { length_cm: number; width_cm: number; height_cm: number };
      max_weight_kg?: number;
      max_units?: number;
      notes?: string;
    },
    actor: { id: string; name: string; email: string }
  ): Promise<WarehouseLocationRow> {
    return withTransaction((db) => {
      const wh = db.warehouses.find((w) => w.id === data.warehouse_id);
      if (!wh) {
        throw new Error('Associated warehouse not found.');
      }

      let parent: WarehouseLocationRow | null = null;
      if (data.parent_id) {
        parent = db.warehouse_locations.find((l) => l.id === data.parent_id) || null;
        if (!parent) {
          throw new Error('Parent location does not exist.');
        }
        if (parent.warehouse_id !== data.warehouse_id) {
          throw new Error('Parent location belongs to a different warehouse.');
        }
      }

      // Check code uniqueness inside warehouse
      const normalizedCode = data.code.trim().toUpperCase();
      const existing = db.warehouse_locations.find(
        (l) => l.warehouse_id === data.warehouse_id && l.code.toUpperCase() === normalizedCode
      );
      if (existing) {
        throw new Error(`Location code "${normalizedCode}" already exists in warehouse ${wh.code}.`);
      }

      // Resolve template defaults if provided
      let dims = data.dimensions || { length_cm: 100, width_cm: 100, height_cm: 100 };
      let maxWeight = data.max_weight_kg || 500;
      let maxUnits = data.max_units || 100;

      if (data.template_id) {
        const tpl = db.storage_templates.find((t) => t.id === data.template_id);
        if (tpl) {
          dims = tpl.dimensions;
          maxWeight = tpl.max_weight_kg;
          maxUnits = tpl.max_units;
        }
      }

      const volume = Math.round(dims.length_cm * dims.width_cm * dims.height_cm);
      const level = parent ? parent.level + 1 : 0;
      const pathStr = parent ? `${parent.path} / ${data.name.trim()}` : `${wh.code} / ${data.name.trim()}`;
      const barcode = `LOC-${wh.code}-${normalizedCode}`;
      const now = new Date().toISOString();

      const location: WarehouseLocationRow = {
        id: generateId('loc'),
        warehouse_id: data.warehouse_id,
        parent_id: data.parent_id || null,
        name: data.name.trim(),
        code: normalizedCode,
        barcode,
        type: data.type,
        path: pathStr,
        level,
        template_id: data.template_id || null,
        dimensions: dims,
        capacity_volume_cm3: volume,
        max_weight_kg: maxWeight,
        max_units: maxUnits,
        occupied_units: 0,
        status: 'available',
        notes: data.notes?.trim(),
        created_at: now,
        updated_at: now
      };

      db.warehouse_locations.push(location);

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'location.create',
        entityType: 'warehouse_location',
        entityId: location.id,
        metadata: {
          code: location.code,
          type: location.type,
          path: location.path,
          warehouse_id: location.warehouse_id
        }
      });

      return location;
    });
  },

  /**
   * Bulk generator: generates batches of aisles, racks, shelves, or bins
   */
  async bulkCreateLocations(
    warehouseId: string,
    config: BulkLocationGenerationConfig,
    actor: { id: string; name: string; email: string }
  ): Promise<WarehouseLocationRow[]> {
    return withTransaction((db) => {
      const wh = db.warehouses.find((w) => w.id === warehouseId);
      if (!wh) {
        throw new Error('Warehouse not found.');
      }

      let parent: WarehouseLocationRow | null = null;
      if (config.parent_id) {
        parent = db.warehouse_locations.find((l) => l.id === config.parent_id) || null;
        if (!parent) {
          throw new Error('Parent location not found.');
        }
      }

      // Check template
      let dims = config.dimensions || { length_cm: 100, width_cm: 100, height_cm: 100 };
      let maxWeight = config.max_weight_kg || 500;
      let maxUnits = config.max_units || 50;

      if (config.template_id) {
        const tpl = db.storage_templates.find((t) => t.id === config.template_id);
        if (tpl) {
          dims = tpl.dimensions;
          maxWeight = tpl.max_weight_kg;
          maxUnits = tpl.max_units;
        }
      }

      const volume = Math.round(dims.length_cm * dims.width_cm * dims.height_cm);
      const level = parent ? parent.level + 1 : 0;
      const now = new Date().toISOString();
      const createdLocations: WarehouseLocationRow[] = [];

      for (let i = 0; i < config.count; i++) {
        const num = config.start_number + i;
        const numStr = String(num).padStart(config.zero_pad, '0');
        const codeSuffix = `${config.code_prefix}${numStr}`;
        const locationCode = parent ? `${parent.code}-${codeSuffix}` : codeSuffix;
        const locationName = `${config.prefix}${numStr}`;
        const locationPath = parent ? `${parent.path} / ${locationName}` : `${wh.code} / ${locationName}`;
        const barcode = `LOC-${wh.code}-${locationCode}`;

        // Verify uniqueness
        const exists = db.warehouse_locations.some(
          (l) => l.warehouse_id === warehouseId && l.code.toUpperCase() === locationCode.toUpperCase()
        );
        if (exists) {
          continue; // Skip existing to prevent partial failure
        }

        const newLoc: WarehouseLocationRow = {
          id: generateId('loc'),
          warehouse_id: warehouseId,
          parent_id: config.parent_id || null,
          name: locationName,
          code: locationCode,
          barcode,
          type: config.type,
          path: locationPath,
          level,
          template_id: config.template_id || null,
          dimensions: dims,
          capacity_volume_cm3: volume,
          max_weight_kg: maxWeight,
          max_units: maxUnits,
          occupied_units: 0,
          status: 'available',
          created_at: now,
          updated_at: now
        };

        db.warehouse_locations.push(newLoc);
        createdLocations.push(newLoc);
      }

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'location.bulk_create',
        entityType: 'warehouse_location',
        entityId: warehouseId,
        metadata: {
          count: createdLocations.length,
          type: config.type,
          parent_id: config.parent_id
        }
      });

      return createdLocations;
    });
  },

  async updateLocation(
    id: string,
    data: {
      name?: string;
      status?: LocationStatus;
      notes?: string;
      max_units?: number;
      max_weight_kg?: number;
      dimensions?: { length_cm: number; width_cm: number; height_cm: number };
    },
    actor: { id: string; name: string; email: string }
  ): Promise<WarehouseLocationRow> {
    return withTransaction((db) => {
      const idx = db.warehouse_locations.findIndex((l) => l.id === id);
      if (idx === -1) {
        throw new Error('Location not found.');
      }

      const existing = db.warehouse_locations[idx];
      let volume = existing.capacity_volume_cm3;
      let dims = existing.dimensions;

      if (data.dimensions) {
        dims = data.dimensions;
        volume = Math.round(dims.length_cm * dims.width_cm * dims.height_cm);
      }

      const updated: WarehouseLocationRow = {
        ...existing,
        name: data.name !== undefined ? data.name.trim() : existing.name,
        status: data.status || existing.status,
        notes: data.notes !== undefined ? data.notes.trim() : existing.notes,
        max_units: data.max_units !== undefined ? Number(data.max_units) : existing.max_units,
        max_weight_kg: data.max_weight_kg !== undefined ? Number(data.max_weight_kg) : existing.max_weight_kg,
        dimensions: dims,
        capacity_volume_cm3: volume,
        updated_at: new Date().toISOString()
      };

      db.warehouse_locations[idx] = updated;

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'location.update',
        entityType: 'warehouse_location',
        entityId: id,
        metadata: { changes: data }
      });

      return updated;
    });
  },

  async deleteLocation(id: string, actor: { id: string; name: string; email: string }): Promise<number> {
    return withTransaction((db) => {
      const target = db.warehouse_locations.find((l) => l.id === id);
      if (!target) {
        throw new Error('Location not found.');
      }

      // Collect all descendants recursively
      const idsToDelete = new Set<string>([id]);
      let added = true;
      while (added) {
        added = false;
        db.warehouse_locations.forEach((l) => {
          if (l.parent_id && idsToDelete.has(l.parent_id) && !idsToDelete.has(l.id)) {
            idsToDelete.add(l.id);
            added = true;
          }
        });
      }

      // Check if any location has occupied units
      const occupied = db.warehouse_locations.filter((l) => idsToDelete.has(l.id) && l.occupied_units > 0);
      if (occupied.length > 0) {
        throw new Error(`Cannot delete location tree. ${occupied.length} locations currently store inventory.`);
      }

      const beforeCount = db.warehouse_locations.length;
      db.warehouse_locations = db.warehouse_locations.filter((l) => !idsToDelete.has(l.id));
      const deletedCount = beforeCount - db.warehouse_locations.length;

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'location.delete',
        entityType: 'warehouse_location',
        entityId: id,
        metadata: {
          code: target.code,
          deleted_locations_count: deletedCount
        }
      });

      return deletedCount;
    });
  },

  // ----------------------------------------------------
  // Barcode & QR Label Generation
  // ----------------------------------------------------
  async generateLocationLabelData(locationId: string): Promise<{
    location: WarehouseLocationRow;
    warehouse: WarehouseRow;
    qrDataUrl: string;
    barcodeString: string;
  }> {
    const db = getDb();
    const location = db.warehouse_locations.find((l) => l.id === locationId);
    if (!location) {
      throw new Error('Location not found.');
    }

    const warehouse = db.warehouses.find((w) => w.id === location.warehouse_id);
    if (!warehouse) {
      throw new Error('Warehouse not found.');
    }

    // Generate high-resolution 2D QR Code data URL containing the machine-readable payload
    const qrPayload = JSON.stringify({
      schema: 'ship_asaan_loc_v1',
      loc_id: location.id,
      wh_code: warehouse.code,
      code: location.code,
      barcode: location.barcode,
      type: location.type
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 256,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    return {
      location,
      warehouse,
      qrDataUrl,
      barcodeString: location.barcode
    };
  }
};
