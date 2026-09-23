/**
 * Authoritative Inventory & Physical Units Service for Ship Asaan
 * Strict multi-tenant isolation, physical scan-to-place truth, and immutable ledger journaling.
 */

import {
  withTransaction,
  getDb,
  ProductRow,
  InventoryUnitRow,
  InventoryTransactionRow,
  ReceivingBatchRow,
  WarehouseLocationRow,
  DatabaseSchema
} from './db.js';
import { generateId } from './security.js';
import { logAudit } from './audit.js';

export class InventoryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'InventoryError';
  }
}

export interface ActorContext {
  id: string;
  name: string;
  email: string;
  roleId: string;
  accountType: 'staff' | 'customer';
  customerProfileId?: string | null;
  permissions: string[];
}

export interface CreateProductInput {
  customerId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  barcode?: string;
  dimensions?: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  weight_kg?: number;
  declared_value?: number;
  low_stock_threshold?: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: string;
  barcode?: string;
  dimensions?: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  weight_kg?: number;
  declared_value?: number;
  low_stock_threshold?: number;
  status?: 'active' | 'archived';
}

export interface ReceiveStockInput {
  warehouseId: string;
  customerId: string;
  carrier?: string;
  trackingReference?: string;
  items: Array<{
    productId: string;
    quantity: number;
    condition?: 'good' | 'damaged';
    notes?: string;
  }>;
}

export interface StockScanInput {
  unitTrackingCode: string;
  locationCodeOrBarcode: string;
  expectedWarehouseId?: string;
}

export interface MoveUnitInput {
  unitId: string;
  toLocationId: string;
  notes?: string;
}

export interface AdjustUnitInput {
  unitId: string;
  condition?: 'good' | 'damaged';
  state?: InventoryUnitRow['state'];
  notes: string;
}

export interface EnrichedProduct extends ProductRow {
  customer_brand?: string;
  customer_name?: string;
  on_hand_units: number;
  in_storage_units: number;
  awaiting_stocking_units: number;
  reserved_units: number;
  damaged_units: number;
  is_low_stock: boolean;
}

export interface EnrichedInventoryUnit extends InventoryUnitRow {
  product_name: string;
  product_sku: string;
  customer_brand: string;
  location_name?: string;
  location_code?: string;
  location_path?: string;
  warehouse_name?: string;
}

// Generate unique tracking code e.g. UNIT-E8B2-9F1C
function generateTrackingCode(existingCodes: Set<string>): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 avoiding easily confused chars
  for (let attempt = 0; attempt < 50; attempt++) {
    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `UNIT-${part1}-${part2}`;
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  return `UNIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export const inventoryService = {
  /**
   * Create a new Product / SKU in the catalog
   */
  async createProduct(actor: ActorContext, input: CreateProductInput): Promise<ProductRow> {
    return withTransaction((db) => {
      // Customer isolation check
      let targetCustomerId = input.customerId;
      if (actor.accountType === 'customer') {
        if (!actor.customerProfileId) {
          throw new InventoryError('FORBIDDEN', 'Customer profile not established.');
        }
        targetCustomerId = actor.customerProfileId;
      }

      const customer = db.customer_profiles.find((c) => c.id === targetCustomerId);
      if (!customer) {
        throw new InventoryError('NOT_FOUND', 'Target customer profile does not exist.');
      }

      // SKU normalization and duplicate check
      const normalizedSku = input.sku.trim().toUpperCase();
      if (!normalizedSku || normalizedSku.length < 2) {
        throw new InventoryError('INVALID_INPUT', 'SKU must be at least 2 characters.');
      }

      const existingSku = db.products.find(
        (p) => p.customer_id === targetCustomerId && p.sku.toUpperCase() === normalizedSku
      );
      if (existingSku) {
        throw new InventoryError('DUPLICATE_SKU', `SKU '${normalizedSku}' already exists for this merchant.`);
      }

      const now = new Date().toISOString();
      const product: ProductRow = {
        id: generateId('prod'),
        customer_id: targetCustomerId,
        sku: normalizedSku,
        name: input.name.trim(),
        description: input.description?.trim(),
        category: input.category?.trim() || 'General Merchandise',
        barcode: input.barcode?.trim(),
        dimensions: {
          length_cm: Math.max(0, Number(input.dimensions?.length_cm) || 0),
          width_cm: Math.max(0, Number(input.dimensions?.width_cm) || 0),
          height_cm: Math.max(0, Number(input.dimensions?.height_cm) || 0)
        },
        weight_kg: Math.max(0, Number(input.weight_kg) || 0),
        declared_value: Math.max(0, Number(input.declared_value) || 0),
        low_stock_threshold: Math.max(0, Number(input.low_stock_threshold ?? 10)),
        status: 'active',
        created_at: now,
        updated_at: now
      };

      db.products.push(product);

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'PRODUCT_CREATED',
        entityType: 'PRODUCT',
        entityId: product.id,
        metadata: {
          sku: product.sku,
          name: product.name,
          customerId: product.customer_id,
          customerBrand: customer.brand_name
        }
      });

      return product;
    });
  },

  /**
   * Update Product metadata
   */
  async updateProduct(actor: ActorContext, productId: string, input: UpdateProductInput): Promise<ProductRow> {
    return withTransaction((db) => {
      const product = db.products.find((p) => p.id === productId);
      if (!product) {
        throw new InventoryError('NOT_FOUND', 'Product not found.');
      }

      // Check customer isolation
      if (actor.accountType === 'customer' && product.customer_id !== actor.customerProfileId) {
        throw new InventoryError('FORBIDDEN', 'Access denied to this product.');
      }

      if (input.name !== undefined) product.name = input.name.trim();
      if (input.description !== undefined) product.description = input.description.trim();
      if (input.category !== undefined) product.category = input.category.trim();
      if (input.barcode !== undefined) product.barcode = input.barcode.trim();
      if (input.dimensions !== undefined) {
        product.dimensions = {
          length_cm: Math.max(0, Number(input.dimensions.length_cm) || 0),
          width_cm: Math.max(0, Number(input.dimensions.width_cm) || 0),
          height_cm: Math.max(0, Number(input.dimensions.height_cm) || 0)
        };
      }
      if (input.weight_kg !== undefined) product.weight_kg = Math.max(0, Number(input.weight_kg));
      if (input.declared_value !== undefined) product.declared_value = Math.max(0, Number(input.declared_value));
      if (input.low_stock_threshold !== undefined) product.low_stock_threshold = Math.max(0, Number(input.low_stock_threshold));
      if (input.status !== undefined) product.status = input.status;

      product.updated_at = new Date().toISOString();

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'PRODUCT_UPDATED',
        entityType: 'PRODUCT',
        entityId: product.id,
        metadata: { sku: product.sku, changes: input }
      });

      return product;
    });
  },

  /**
   * List Products with real-time computed inventory metrics
   */
  async listProducts(
    actor: ActorContext,
    filters?: {
      customerId?: string;
      search?: string;
      category?: string;
      lowStockOnly?: boolean;
      status?: 'active' | 'archived';
    }
  ): Promise<EnrichedProduct[]> {
    const db = getDb();

    let targetCustomerId = filters?.customerId;
    if (actor.accountType === 'customer') {
      targetCustomerId = actor.customerProfileId || 'none';
    }

    const customerMap = new Map(db.customer_profiles.map((c) => [c.id, c]));

    // Precalculate counts per product
    const countsMap = new Map<
      string,
      { onHand: number; inStorage: number; awaiting: number; reserved: number; damaged: number }
    >();

    for (const unit of db.inventory_units) {
      if (!countsMap.has(unit.product_id)) {
        countsMap.set(unit.product_id, { onHand: 0, inStorage: 0, awaiting: 0, reserved: 0, damaged: 0 });
      }
      const entry = countsMap.get(unit.product_id)!;
      if (unit.condition === 'damaged' || unit.state === 'damaged') {
        entry.damaged++;
      } else {
        if (unit.state === 'in_storage') entry.inStorage++;
        if (unit.state === 'awaiting_stocking') entry.awaiting++;
        if (unit.state === 'reserved') entry.reserved++;
      }
      if (['awaiting_stocking', 'in_storage', 'reserved'].includes(unit.state)) {
        entry.onHand++;
      }
    }

    const filtered = db.products.filter((p) => {
      if (targetCustomerId && p.customer_id !== targetCustomerId) return false;
      if (filters?.status && p.status !== filters.status) return false;
      if (filters?.category && p.category?.toLowerCase() !== filters.category.toLowerCase()) return false;

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchName = p.name.toLowerCase().includes(q);
        const matchBarcode = p.barcode?.toLowerCase().includes(q);
        if (!matchSku && !matchName && !matchBarcode) return false;
      }

      return true;
    });

    const enriched: EnrichedProduct[] = filtered.map((p) => {
      const counts = countsMap.get(p.id) || { onHand: 0, inStorage: 0, awaiting: 0, reserved: 0, damaged: 0 };
      const cust = customerMap.get(p.customer_id);
      const isLowStock = counts.inStorage <= p.low_stock_threshold;

      return {
        ...p,
        customer_brand: cust?.brand_name || 'Unknown',
        customer_name: cust?.business_name || 'Unknown',
        on_hand_units: counts.onHand,
        in_storage_units: counts.inStorage,
        awaiting_stocking_units: counts.awaiting,
        reserved_units: counts.reserved,
        damaged_units: counts.damaged,
        is_low_stock: isLowStock
      };
    });

    if (filters?.lowStockOnly) {
      return enriched.filter((p) => p.is_low_stock);
    }

    return enriched;
  },

  /**
   * Receive Stock Batch - intake items and generate individual physical UNIT-XXXX codes
   */
  async receiveStock(actor: ActorContext, input: ReceiveStockInput): Promise<{
    batch: ReceivingBatchRow;
    units: InventoryUnitRow[];
  }> {
    return withTransaction((db) => {
      // 1. Verify warehouse
      const warehouse = db.warehouses.find((w) => w.id === input.warehouseId);
      if (!warehouse) {
        throw new InventoryError('NOT_FOUND', 'Target warehouse does not exist.');
      }
      if (warehouse.status !== 'active') {
        throw new InventoryError('INVALID_STATE', `Warehouse is ${warehouse.status}. Stock receiving suspended.`);
      }

      // 2. Verify customer
      let targetCustomerId = input.customerId;
      if (actor.accountType === 'customer') {
        targetCustomerId = actor.customerProfileId || '';
      }
      const customer = db.customer_profiles.find((c) => c.id === targetCustomerId);
      if (!customer) {
        throw new InventoryError('NOT_FOUND', 'Customer profile not found.');
      }

      // 3. Validate items
      if (!input.items || input.items.length === 0) {
        throw new InventoryError('INVALID_INPUT', 'At least one item line must be provided for receiving.');
      }

      let totalUnits = 0;
      for (const item of input.items) {
        const qty = Number(item.quantity);
        if (!qty || qty <= 0 || !Number.isInteger(qty)) {
          throw new InventoryError('INVALID_INPUT', 'Quantity must be a positive integer.');
        }
        totalUnits += qty;

        const product = db.products.find((p) => p.id === item.productId && p.customer_id === targetCustomerId);
        if (!product) {
          throw new InventoryError('NOT_FOUND', `Product ID '${item.productId}' not found for customer '${customer.brand_name}'.`);
        }
      }

      if (totalUnits > 1000) {
        throw new InventoryError('LIMIT_EXCEEDED', 'Maximum 1,000 units can be received in a single batch.');
      }

      const now = new Date().toISOString();
      const datePart = now.slice(0, 10).replace(/-/g, '');
      const batchSeq = (db.receiving_batches.length + 1).toString().padStart(4, '0');
      const batchNumber = `RCV-${datePart}-${batchSeq}`;

      const batch: ReceivingBatchRow = {
        id: generateId('rcv'),
        batch_number: batchNumber,
        customer_id: targetCustomerId,
        warehouse_id: warehouse.id,
        carrier: input.carrier?.trim(),
        tracking_reference: input.trackingReference?.trim(),
        total_units: totalUnits,
        stocked_units: 0,
        status: 'received',
        created_by_id: actor.id,
        created_by_name: actor.name,
        created_at: now
      };

      db.receiving_batches.push(batch);

      // 4. Generate physical inventory units & immutable transaction ledger entries
      const existingCodes = new Set(db.inventory_units.map((u) => u.tracking_code));
      const createdUnits: InventoryUnitRow[] = [];

      for (const item of input.items) {
        const product = db.products.find((p) => p.id === item.productId)!;
        const condition = item.condition || 'good';

        for (let i = 0; i < item.quantity; i++) {
          const trackingCode = generateTrackingCode(existingCodes);
          existingCodes.add(trackingCode);

          const unit: InventoryUnitRow = {
            id: generateId('unit'),
            tracking_code: trackingCode,
            product_id: product.id,
            customer_id: targetCustomerId,
            location_id: null,
            warehouse_id: warehouse.id,
            batch_id: batch.id,
            state: condition === 'damaged' ? 'damaged' : 'awaiting_stocking',
            condition: condition,
            notes: item.notes?.trim(),
            received_at: now,
            stocked_at: null,
            updated_at: now
          };

          db.inventory_units.push(unit);
          createdUnits.push(unit);

          const ledgerEntry: InventoryTransactionRow = {
            id: generateId('itx'),
            unit_id: unit.id,
            tracking_code: unit.tracking_code,
            product_id: product.id,
            customer_id: targetCustomerId,
            type: 'RECEIVE',
            from_location_id: null,
            to_location_id: null,
            from_state: 'none',
            to_state: unit.state,
            actor_id: actor.id,
            actor_name: actor.name,
            notes: `Received via intake batch ${batchNumber}. Initial condition: ${condition}.`,
            created_at: now
          };

          db.inventory_transactions.push(ledgerEntry);
        }
      }

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'STOCK_RECEIVED',
        entityType: 'RECEIVING_BATCH',
        entityId: batch.id,
        metadata: {
          batchNumber: batch.batch_number,
          warehouseName: warehouse.name,
          customerBrand: customer.brand_name,
          totalUnits: batch.total_units,
          lineItemCount: input.items.length
        }
      });

      return { batch, units: createdUnits };
    });
  },

  /**
   * Scan-to-Place Putaway: Stock a single physical unit into a verified warehouse location
   */
  async stockUnitScan(actor: ActorContext, input: StockScanInput): Promise<{
    unit: InventoryUnitRow;
    location: WarehouseLocationRow;
    batch?: ReceivingBatchRow;
    message: string;
  }> {
    return withTransaction((db) => {
      const cleanTracking = input.unitTrackingCode.trim().toUpperCase();
      const cleanLocInput = input.locationCodeOrBarcode.trim();

      // 1. Locate physical unit
      const unit = db.inventory_units.find(
        (u) => u.tracking_code.toUpperCase() === cleanTracking || u.id === input.unitTrackingCode
      );
      if (!unit) {
        throw new InventoryError('UNIT_NOT_FOUND', `Inventory Unit '${cleanTracking}' was not found in the system.`);
      }

      // 2. Validate unit state
      if (unit.state === 'in_storage') {
        const currentLoc = db.warehouse_locations.find((l) => l.id === unit.location_id);
        throw new InventoryError(
          'ALREADY_STOCKED',
          `Unit ${unit.tracking_code} is already placed at location '${currentLoc?.code || unit.location_id}'. Use Move Unit workflow to relocate.`
        );
      }

      if (unit.state !== 'awaiting_stocking') {
        throw new InventoryError(
          'INVALID_STATE',
          `Unit ${unit.tracking_code} is currently in state '${unit.state.toUpperCase()}' and cannot be placed into storage.`
        );
      }

      if (unit.condition === 'damaged') {
        throw new InventoryError('DAMAGED_UNIT', `Unit ${unit.tracking_code} is marked damaged and cannot be placed into standard storage.`);
      }

      // 3. Locate target destination location
      const location = db.warehouse_locations.find(
        (l) =>
          l.code.toUpperCase() === cleanLocInput.toUpperCase() ||
          l.barcode.toUpperCase() === cleanLocInput.toUpperCase() ||
          l.id === cleanLocInput
      );
      if (!location) {
        throw new InventoryError('LOCATION_NOT_FOUND', `Location '${cleanLocInput}' does not exist.`);
      }

      // 4. Validate location & warehouse status
      if (location.status === 'damaged' || location.status === 'restricted') {
        throw new InventoryError('LOCATION_UNAVAILABLE', `Location '${location.code}' is currently marked ${location.status.toUpperCase()}.`);
      }

      const warehouse = db.warehouses.find((w) => w.id === location.warehouse_id);
      if (!warehouse || warehouse.status !== 'active') {
        throw new InventoryError('WAREHOUSE_INACTIVE', 'Destination warehouse is currently inactive.');
      }

      // 5. Enforce location physical capacity constraints
      const currentUnitsInLoc = db.inventory_units.filter(
        (u) => u.location_id === location.id && u.state === 'in_storage'
      ).length;

      if (location.max_units > 0 && currentUnitsInLoc >= location.max_units) {
        throw new InventoryError(
          'CAPACITY_EXCEEDED',
          `Location '${location.code}' has reached maximum capacity (${currentUnitsInLoc}/${location.max_units} units). Please select another storage bin.`
        );
      }

      // 6. Execute atomic stock placement
      const now = new Date().toISOString();
      unit.state = 'in_storage';
      unit.location_id = location.id;
      unit.warehouse_id = location.warehouse_id;
      unit.stocked_at = now;
      unit.updated_at = now;

      // Update location occupied counter
      location.occupied_units = currentUnitsInLoc + 1;
      if (location.max_units > 0 && location.occupied_units >= location.max_units) {
        location.status = 'full';
      }
      location.updated_at = now;

      // 7. Write immutable transaction ledger
      const product = db.products.find((p) => p.id === unit.product_id);
      const ledgerEntry: InventoryTransactionRow = {
        id: generateId('itx'),
        unit_id: unit.id,
        tracking_code: unit.tracking_code,
        product_id: unit.product_id,
        customer_id: unit.customer_id,
        type: 'STOCK',
        from_location_id: null,
        to_location_id: location.id,
        from_state: 'awaiting_stocking',
        to_state: 'in_storage',
        actor_id: actor.id,
        actor_name: actor.name,
        notes: `Scan-to-place putaway into storage location ${location.code} (${location.path}).`,
        created_at: now
      };
      db.inventory_transactions.push(ledgerEntry);

      // 8. Update batch progress if associated
      const batch = db.receiving_batches.find((b) => b.id === unit.batch_id);
      if (batch) {
        batch.stocked_units = (batch.stocked_units || 0) + 1;
        if (batch.stocked_units >= batch.total_units) {
          batch.status = 'completed';
        } else {
          batch.status = 'partially_stocked';
        }
      }

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'UNIT_STOCKED',
        entityType: 'INVENTORY_UNIT',
        entityId: unit.id,
        metadata: {
          trackingCode: unit.tracking_code,
          productSku: product?.sku,
          locationCode: location.code,
          locationPath: location.path
        }
      });

      return {
        unit,
        location,
        batch,
        message: `Successfully placed ${unit.tracking_code} into ${location.code}`
      };
    });
  },

  /**
   * Relocate physical unit between warehouse locations
   */
  async moveUnit(actor: ActorContext, input: MoveUnitInput): Promise<{
    unit: InventoryUnitRow;
    fromLocation?: WarehouseLocationRow;
    toLocation: WarehouseLocationRow;
  }> {
    return withTransaction((db) => {
      const unit = db.inventory_units.find((u) => u.id === input.unitId);
      if (!unit) {
        throw new InventoryError('NOT_FOUND', 'Inventory Unit not found.');
      }

      if (unit.state !== 'in_storage') {
        throw new InventoryError('INVALID_STATE', `Only units in 'in_storage' state can be relocated (currently: ${unit.state}).`);
      }

      const toLocation = db.warehouse_locations.find((l) => l.id === input.toLocationId);
      if (!toLocation) {
        throw new InventoryError('NOT_FOUND', 'Destination location not found.');
      }

      if (toLocation.id === unit.location_id) {
        throw new InventoryError('SAME_LOCATION', 'Unit is already at this location.');
      }

      // Check destination capacity
      const currentUnitsInDest = db.inventory_units.filter(
        (u) => u.location_id === toLocation.id && u.state === 'in_storage'
      ).length;

      if (toLocation.max_units > 0 && currentUnitsInDest >= toLocation.max_units) {
        throw new InventoryError('CAPACITY_EXCEEDED', `Destination location '${toLocation.code}' is at capacity.`);
      }

      const fromLocation = db.warehouse_locations.find((l) => l.id === unit.location_id);
      const now = new Date().toISOString();

      unit.location_id = toLocation.id;
      unit.warehouse_id = toLocation.warehouse_id;
      unit.updated_at = now;

      // Update counters
      if (fromLocation) {
        fromLocation.occupied_units = Math.max(0, fromLocation.occupied_units - 1);
        if (fromLocation.status === 'full' && fromLocation.occupied_units < fromLocation.max_units) {
          fromLocation.status = 'available';
        }
      }

      toLocation.occupied_units = currentUnitsInDest + 1;
      if (toLocation.max_units > 0 && toLocation.occupied_units >= toLocation.max_units) {
        toLocation.status = 'full';
      }

      // Immutable ledger
      const ledgerEntry: InventoryTransactionRow = {
        id: generateId('itx'),
        unit_id: unit.id,
        tracking_code: unit.tracking_code,
        product_id: unit.product_id,
        customer_id: unit.customer_id,
        type: 'MOVE',
        from_location_id: fromLocation?.id || null,
        to_location_id: toLocation.id,
        from_state: 'in_storage',
        to_state: 'in_storage',
        actor_id: actor.id,
        actor_name: actor.name,
        notes: input.notes?.trim() || `Relocated from ${fromLocation?.code || 'unknown'} to ${toLocation.code}.`,
        created_at: now
      };
      db.inventory_transactions.push(ledgerEntry);

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'UNIT_RELOCATED',
        entityType: 'INVENTORY_UNIT',
        entityId: unit.id,
        metadata: {
          trackingCode: unit.tracking_code,
          fromLocation: fromLocation?.code,
          toLocation: toLocation.code
        }
      });

      return { unit, fromLocation, toLocation };
    });
  },

  /**
   * Adjust unit condition or state (damage, manual correction)
   */
  async adjustUnit(actor: ActorContext, input: AdjustUnitInput): Promise<InventoryUnitRow> {
    return withTransaction((db) => {
      const unit = db.inventory_units.find((u) => u.id === input.unitId);
      if (!unit) {
        throw new InventoryError('NOT_FOUND', 'Inventory Unit not found.');
      }

      const oldState = unit.state;
      const oldCondition = unit.condition;
      const now = new Date().toISOString();

      if (input.condition) unit.condition = input.condition;
      if (input.state) unit.state = input.state;
      unit.updated_at = now;

      // If marked damaged or lost, decrement location occupancy
      if (['damaged', 'lost'].includes(unit.state) && oldState === 'in_storage' && unit.location_id) {
        const loc = db.warehouse_locations.find((l) => l.id === unit.location_id);
        if (loc) {
          loc.occupied_units = Math.max(0, loc.occupied_units - 1);
          if (loc.status === 'full' && loc.occupied_units < loc.max_units) {
            loc.status = 'available';
          }
        }
      }

      const txType: InventoryTransactionRow['type'] = input.condition === 'damaged' ? 'DAMAGE' : 'ADJUST';

      const ledgerEntry: InventoryTransactionRow = {
        id: generateId('itx'),
        unit_id: unit.id,
        tracking_code: unit.tracking_code,
        product_id: unit.product_id,
        customer_id: unit.customer_id,
        type: txType,
        from_location_id: unit.location_id,
        to_location_id: unit.location_id,
        from_state: oldState,
        to_state: unit.state,
        actor_id: actor.id,
        actor_name: actor.name,
        notes: input.notes.trim() || `Condition adjusted from ${oldCondition} to ${unit.condition}.`,
        created_at: now
      };
      db.inventory_transactions.push(ledgerEntry);

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'UNIT_ADJUSTED',
        entityType: 'INVENTORY_UNIT',
        entityId: unit.id,
        metadata: {
          trackingCode: unit.tracking_code,
          oldCondition,
          newCondition: unit.condition,
          oldState,
          newState: unit.state,
          notes: input.notes
        }
      });

      return unit;
    });
  },

  /**
   * List Inventory Units with full relational enrichment
   */
  async listUnits(
    actor: ActorContext,
    filters?: {
      customerId?: string;
      productId?: string;
      warehouseId?: string;
      locationId?: string;
      batchId?: string;
      state?: InventoryUnitRow['state'];
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    units: EnrichedInventoryUnit[];
    total: number;
  }> {
    const db = getDb();

    let targetCustomerId = filters?.customerId;
    if (actor.accountType === 'customer') {
      targetCustomerId = actor.customerProfileId || 'none';
    }

    const prodMap = new Map(db.products.map((p) => [p.id, p]));
    const custMap = new Map(db.customer_profiles.map((c) => [c.id, c]));
    const locMap = new Map(db.warehouse_locations.map((l) => [l.id, l]));
    const whMap = new Map(db.warehouses.map((w) => [w.id, w]));

    const filtered = db.inventory_units.filter((u) => {
      if (targetCustomerId && u.customer_id !== targetCustomerId) return false;
      if (filters?.productId && u.product_id !== filters.productId) return false;
      if (filters?.warehouseId && u.warehouse_id !== filters.warehouseId) return false;
      if (filters?.locationId && u.location_id !== filters.locationId) return false;
      if (filters?.batchId && u.batch_id !== filters.batchId) return false;
      if (filters?.state && u.state !== filters.state) return false;

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matchTracking = u.tracking_code.toLowerCase().includes(q);
        const prod = prodMap.get(u.product_id);
        const matchSku = prod?.sku.toLowerCase().includes(q);
        const matchProdName = prod?.name.toLowerCase().includes(q);
        const loc = u.location_id ? locMap.get(u.location_id) : null;
        const matchLoc = loc?.code.toLowerCase().includes(q);
        if (!matchTracking && !matchSku && !matchProdName && !matchLoc) return false;
      }

      return true;
    });

    const total = filtered.length;
    const offset = Math.max(0, filters?.offset || 0);
    const limit = Math.min(200, Math.max(1, filters?.limit || 100));
    const paginated = filtered.slice(offset, offset + limit);

    const enriched: EnrichedInventoryUnit[] = paginated.map((u) => {
      const prod = prodMap.get(u.product_id);
      const cust = custMap.get(u.customer_id);
      const loc = u.location_id ? locMap.get(u.location_id) : undefined;
      const wh = u.warehouse_id ? whMap.get(u.warehouse_id) : undefined;

      return {
        ...u,
        product_name: prod?.name || 'Unknown SKU',
        product_sku: prod?.sku || 'UNKNOWN',
        customer_brand: cust?.brand_name || 'Unknown',
        location_name: loc?.name,
        location_code: loc?.code,
        location_path: loc?.path,
        warehouse_name: wh?.name
      };
    });

    return { units: enriched, total };
  },

  /**
   * List Receiving Batches
   */
  async listBatches(actor: ActorContext, customerId?: string): Promise<ReceivingBatchRow[]> {
    const db = getDb();
    let targetCustomerId = customerId;
    if (actor.accountType === 'customer') {
      targetCustomerId = actor.customerProfileId || 'none';
    }

    return db.receiving_batches
      .filter((b) => !targetCustomerId || b.customer_id === targetCustomerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Get Inventory Transaction Ledger
   */
  async getLedger(
    actor: ActorContext,
    filters?: {
      customerId?: string;
      unitId?: string;
      productId?: string;
      type?: InventoryTransactionRow['type'];
      limit?: number;
    }
  ): Promise<InventoryTransactionRow[]> {
    const db = getDb();
    let targetCustomerId = filters?.customerId;
    if (actor.accountType === 'customer') {
      targetCustomerId = actor.customerProfileId || 'none';
    }

    const filtered = db.inventory_transactions.filter((tx) => {
      if (targetCustomerId && tx.customer_id !== targetCustomerId) return false;
      if (filters?.unitId && tx.unit_id !== filters.unitId) return false;
      if (filters?.productId && tx.product_id !== filters.productId) return false;
      if (filters?.type && tx.type !== filters.type) return false;
      return true;
    });

    return filtered
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, filters?.limit || 100);
  }
};
