import {
  getDb,
  withTransaction,
  DatabaseSchema,
  FulfillmentOrderRow,
  FulfillmentOrderItemRow,
  InventoryUnitRow,
  InventoryTransactionRow,
  PickingBatchRow,
  WarehouseLocationRow,
  ProductRow
} from './db.js';
import { generateId } from './security.js';
import { logAudit } from './audit.js';

export class FulfillmentError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'FulfillmentError';
  }
}

export interface ActorContext {
  id: string;
  email: string;
  name: string;
  roleId: string;
  permissions: string[];
  accountType: 'employee' | 'customer' | 'staff';
  customerProfileId?: string | null;
}

export interface PickLocationGroup {
  locationId: string | null;
  locationCode: string;
  locationPath: string;
  warehouseId: string | null;
  items: Array<{
    productId: string;
    sku: string;
    productName: string;
    totalUnitsRequired: number;
    pickedUnitsCount: number;
    units: Array<{
      unitId: string;
      trackingCode: string;
      state: string;
      orderId: string;
      orderNumber: string;
      consigneeName: string;
    }>;
  }>;
}

export class FulfillmentService {
  /**
   * Helper: Generate sequential picking batch number (PICK-YYYYMM-XXXX)
   */
  private generateBatchNumber(db: DatabaseSchema): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `PICK-${yearMonth}-`;

    const existingThisMonth = db.picking_batches
      .filter(b => b.batch_number.startsWith(prefix))
      .map(b => {
        const numPart = b.batch_number.slice(prefix.length);
        const parsed = parseInt(numPart, 10);
        return isNaN(parsed) ? 0 : parsed;
      });

    const maxNum = existingThisMonth.length > 0 ? Math.max(...existingThisMonth) : 0;
    const nextSeq = String(maxNum + 1).padStart(4, '0');
    return `${prefix}${nextSeq}`;
  }

  /**
   * 7.1 & 7.2: Prepare Fulfillment for Confirmed Orders & Reserve Physical Units
   * Concurrency-safe atomic reservation preventing double-allocation.
   */
  public async prepareFulfillment(actor: ActorContext, orderIds: string[]) {
    return withTransaction(async (db) => {
      const isAdmin = actor.roleId === 'role_administrator';
      const canFulfill = isAdmin || actor.permissions.includes('orders.pick') || actor.permissions.includes('orders.create');
      if (!canFulfill) {
        throw new FulfillmentError('FORBIDDEN', 'You do not have permission to prepare fulfillment orders.');
      }

      if (orderIds.length === 0) {
        throw new FulfillmentError('VALIDATION_ERROR', 'No order IDs provided for fulfillment preparation.');
      }

      const preparedOrders: string[] = [];
      const failedOrders: Array<{ orderId: string; orderNumber: string; reason: string }> = [];
      const totalUnitsReserved = { count: 0 };
      const now = new Date().toISOString();

      for (const orderId of orderIds) {
        const order = db.fulfillment_orders.find(o => o.id === orderId);
        if (!order) {
          failedOrders.push({ orderId, orderNumber: 'Unknown', reason: 'Order record not found.' });
          continue;
        }

        if (order.status !== 'confirmed') {
          failedOrders.push({
            orderId,
            orderNumber: order.order_number,
            reason: `Order is in "${order.status}" status. Only "confirmed" orders can be prepared for fulfillment.`
          });
          continue;
        }

        const items = db.fulfillment_order_items.filter(item => item.order_id === order.id);
        if (items.length === 0) {
          failedOrders.push({
            orderId,
            orderNumber: order.order_number,
            reason: 'Order contains no line items.'
          });
          continue;
        }

        // Verify stock availability across all line items BEFORE making changes
        let hasSufficientStock = true;
        let shortageReason = '';
        const unitsToReservePerItem: Array<{
          item: FulfillmentOrderItemRow;
          units: InventoryUnitRow[];
        }> = [];

        for (const item of items) {
          // Find available units: in_storage, good condition, same customer, same product, unassigned
          const candidateUnits = db.inventory_units.filter(
            u =>
              u.customer_id === order.customer_id &&
              u.product_id === item.product_id &&
              u.state === 'in_storage' &&
              u.condition === 'good' &&
              (!u.order_id || u.order_id === order.id)
          );

          if (candidateUnits.length < item.quantity) {
            hasSufficientStock = false;
            shortageReason = `Insufficient in-storage units for SKU "${item.sku}". Required: ${item.quantity}, In Storage: ${candidateUnits.length}.`;
            break;
          }

          unitsToReservePerItem.push({
            item,
            units: candidateUnits.slice(0, item.quantity)
          });
        }

        if (!hasSufficientStock) {
          failedOrders.push({
            orderId,
            orderNumber: order.order_number,
            reason: shortageReason
          });
          continue;
        }

        // Execute reservation for this order
        for (const { item, units } of unitsToReservePerItem) {
          for (const unit of units) {
            const prevState = unit.state;
            unit.state = 'reserved';
            unit.order_id = order.id;
            unit.order_item_id = item.id;
            unit.updated_at = now;

            // Log immutable inventory transaction
            const tx: InventoryTransactionRow = {
              id: generateId('itx'),
              unit_id: unit.id,
              tracking_code: unit.tracking_code,
              product_id: unit.product_id,
              customer_id: unit.customer_id,
              type: 'RESERVE',
              from_location_id: unit.location_id,
              to_location_id: unit.location_id,
              from_state: prevState,
              to_state: 'reserved',
              actor_id: actor.id,
              actor_name: actor.name,
              notes: `Reserved for order ${order.order_number}`,
              created_at: now
            };
            db.inventory_transactions.push(tx);
            totalUnitsReserved.count++;
          }
        }

        // Transition order status to to_fulfill
        order.status = 'to_fulfill';
        order.updated_at = now;
        preparedOrders.push(order.order_number);

        logAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'ORDER_PREPARED_FOR_FULFILLMENT',
          entityType: 'fulfillment_order',
          entityId: order.id,
          metadata: {
            orderNumber: order.order_number,
            customerId: order.customer_id,
            piecesReserved: items.reduce((acc, i) => acc + i.quantity, 0)
          }
        });
      }

      return {
        preparedCount: preparedOrders.length,
        preparedOrderNumbers: preparedOrders,
        failedCount: failedOrders.length,
        failedOrders,
        totalUnitsReserved: totalUnitsReserved.count
      };
    });
  }

  /**
   * 7.3 & 7.4: Create a Picking Batch for To-Fulfill Orders
   */
  public async createPickingBatch(actor: ActorContext, orderIds: string[]) {
    return withTransaction(async (db) => {
      const isAdmin = actor.roleId === 'role_administrator';
      const canPick = isAdmin || actor.permissions.includes('orders.pick');
      if (!canPick) {
        throw new FulfillmentError('FORBIDDEN', 'You do not have permission to create picking batches.');
      }

      if (orderIds.length === 0) {
        throw new FulfillmentError('VALIDATION_ERROR', 'No orders specified for picking batch.');
      }

      // Verify all orders are in 'to_fulfill' status
      const validOrders = db.fulfillment_orders.filter(
        o => orderIds.includes(o.id) && o.status === 'to_fulfill'
      );

      if (validOrders.length === 0) {
        throw new FulfillmentError(
          'INVALID_ORDERS',
          'None of the selected orders are in "to_fulfill" status ready for picking.'
        );
      }

      // Count reserved units for these orders
      const reservedUnits = db.inventory_units.filter(
        u => u.order_id && validOrders.some(o => o.id === u.order_id) && ['reserved', 'picked'].includes(u.state)
      );

      const batchNumber = this.generateBatchNumber(db);
      const now = new Date().toISOString();

      const newBatch: PickingBatchRow = {
        id: generateId('pick'),
        batch_number: batchNumber,
        status: 'active',
        order_ids: validOrders.map(o => o.id),
        total_units_count: reservedUnits.length,
        picked_units_count: reservedUnits.filter(u => u.state === 'picked').length,
        created_by_user_id: actor.id,
        created_by_name: actor.name,
        created_at: now,
        completed_at: null
      };

      db.picking_batches.push(newBatch);

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'PICKING_BATCH_CREATED',
        entityType: 'picking_batch',
        entityId: newBatch.id,
        metadata: {
          batchNumber,
          ordersCount: validOrders.length,
          totalUnits: reservedUnits.length
        }
      });

      return newBatch;
    });
  }

  /**
   * Get picking batch details with location-optimized pick sheet
   */
  public async getPickingBatchDetails(actor: ActorContext, batchId: string) {
    const db = getDb();
    const batch = db.picking_batches.find(b => b.id === batchId);
    if (!batch) {
      throw new FulfillmentError('NOT_FOUND', 'Picking batch not found.');
    }

    const orders = db.fulfillment_orders.filter(o => batch.order_ids.includes(o.id));
    const reservedUnits = db.inventory_units.filter(
      u => u.order_id && batch.order_ids.includes(u.order_id) && ['reserved', 'picked'].includes(u.state)
    );

    // Group units by warehouse location for location-optimized walking path
    const locationMap = new Map<string, PickLocationGroup>();

    for (const unit of reservedUnits) {
      const locId = unit.location_id || 'unassigned';
      const loc = unit.location_id ? db.warehouse_locations.find(l => l.id === unit.location_id) : null;
      const product = db.products.find(p => p.id === unit.product_id);
      const order = orders.find(o => o.id === unit.order_id);

      if (!locationMap.has(locId)) {
        locationMap.set(locId, {
          locationId: unit.location_id,
          locationCode: loc ? loc.code : 'UNASSIGNED STORAGE',
          locationPath: loc ? loc.path : 'Unassigned / Floor',
          warehouseId: unit.warehouse_id,
          items: []
        });
      }

      const locGroup = locationMap.get(locId)!;
      let itemGroup = locGroup.items.find(i => i.productId === unit.product_id);
      if (!itemGroup) {
        itemGroup = {
          productId: unit.product_id,
          sku: product ? product.sku : 'UNKNOWN-SKU',
          productName: product ? product.name : 'Unknown Product',
          totalUnitsRequired: 0,
          pickedUnitsCount: 0,
          units: []
        };
        locGroup.items.push(itemGroup);
      }

      itemGroup.totalUnitsRequired++;
      if (unit.state === 'picked') {
        itemGroup.pickedUnitsCount++;
      }

      itemGroup.units.push({
        unitId: unit.id,
        trackingCode: unit.tracking_code,
        state: unit.state,
        orderId: unit.order_id || '',
        orderNumber: order ? order.order_number : '',
        consigneeName: order ? order.consignee_name : ''
      });
    }

    // Sort locations alphabetically by path for optimal walking route
    const sortedLocations = Array.from(locationMap.values()).sort((a, b) =>
      a.locationPath.localeCompare(b.locationPath)
    );

    const isComplete = batch.status === 'completed' || (reservedUnits.length > 0 && reservedUnits.every(u => u.state === 'picked'));

    return {
      batch,
      orders: orders.map(o => ({
        id: o.id,
        order_number: o.order_number,
        customer_reference: o.customer_reference,
        consignee_name: o.consignee_name,
        city: o.city,
        status: o.status,
        total_pieces: db.fulfillment_order_items.filter(i => i.order_id === o.id).reduce((s, i) => s + i.quantity, 0)
      })),
      pickLocations: sortedLocations,
      totalUnits: reservedUnits.length,
      pickedUnits: reservedUnits.filter(u => u.state === 'picked').length,
      isComplete
    };
  }

  /**
   * List picking batches
   */
  public async listPickingBatches(actor: ActorContext) {
    const db = getDb();
    const batches = [...db.picking_batches].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return batches;
  }

  /**
   * 7.3: Interactive Scan-out Picking Verification
   * Operator scans physical unit tracking code out of storage shelf into 'picked' state.
   */
  public async pickUnitScan(
    actor: ActorContext,
    params: {
      unitTrackingCode: string;
      batchId?: string;
      orderId?: string;
    }
  ) {
    return withTransaction(async (db) => {
      const isAdmin = actor.roleId === 'role_administrator';
      const canPick = isAdmin || actor.permissions.includes('orders.pick');
      if (!canPick) {
        throw new FulfillmentError('FORBIDDEN', 'You do not have permission to pick inventory units.');
      }

      const rawCode = (params.unitTrackingCode || '').trim().toUpperCase();
      if (!rawCode) {
        throw new FulfillmentError('VALIDATION_ERROR', 'Please scan or enter a unit tracking code.');
      }

      // Find unit by tracking code
      const unit = db.inventory_units.find(
        u => u.tracking_code.toUpperCase() === rawCode || u.id === rawCode
      );

      if (!unit) {
        throw new FulfillmentError('UNIT_NOT_FOUND', `Physical unit "${rawCode}" does not exist in the warehouse.`);
      }

      // Duplicate pick protection
      if (unit.state === 'picked') {
        throw new FulfillmentError(
          'ALREADY_PICKED',
          `Unit ${unit.tracking_code} has already been picked.`
        );
      }

      if (['packed', 'fulfilled'].includes(unit.state)) {
        throw new FulfillmentError(
          'INVALID_STATE',
          `Unit ${unit.tracking_code} is already ${unit.state}.`
        );
      }

      if (unit.state !== 'reserved') {
        throw new FulfillmentError(
          'NOT_RESERVED',
          `Unit ${unit.tracking_code} is in "${unit.state}" state (not reserved for fulfillment).`
        );
      }

      if (!unit.order_id) {
        throw new FulfillmentError('NO_ORDER', `Unit ${unit.tracking_code} has no associated fulfillment order.`);
      }

      // If batch context is provided, verify order is part of this batch
      if (params.batchId) {
        const batch = db.picking_batches.find(b => b.id === params.batchId);
        if (batch && !batch.order_ids.includes(unit.order_id)) {
          throw new FulfillmentError(
            'CROSS_BATCH_MISMATCH',
            `Unit ${unit.tracking_code} belongs to order not included in active Picking Batch ${batch.batch_number}.`
          );
        }
      }

      // If specific order context is provided, verify match
      if (params.orderId && unit.order_id !== params.orderId) {
        throw new FulfillmentError(
          'CROSS_ORDER_MISMATCH',
          `Unit ${unit.tracking_code} does not belong to the selected order.`
        );
      }

      const order = db.fulfillment_orders.find(o => o.id === unit.order_id);
      if (!order) {
        throw new FulfillmentError('ORDER_NOT_FOUND', 'Associated order not found.');
      }

      const product = db.products.find(p => p.id === unit.product_id);
      const originLocation = unit.location_id ? db.warehouse_locations.find(l => l.id === unit.location_id) : null;
      const now = new Date().toISOString();

      // Free occupied capacity from location as item physically leaves shelf
      if (originLocation && originLocation.occupied_units > 0) {
        originLocation.occupied_units = Math.max(0, originLocation.occupied_units - 1);
        if (originLocation.status === 'full') {
          originLocation.status = 'available';
        }
        originLocation.updated_at = now;
      }

      // Transition unit state to 'picked'
      const prevState = unit.state;
      unit.state = 'picked';
      unit.updated_at = now;

      // Log immutable inventory transaction
      const itx: InventoryTransactionRow = {
        id: generateId('itx'),
        unit_id: unit.id,
        tracking_code: unit.tracking_code,
        product_id: unit.product_id,
        customer_id: unit.customer_id,
        type: 'PICK',
        from_location_id: unit.location_id,
        to_location_id: null,
        from_state: prevState,
        to_state: 'picked',
        actor_id: actor.id,
        actor_name: actor.name,
        notes: `Picked for order ${order.order_number} from location ${originLocation?.code || 'storage'}`,
        created_at: now
      };
      db.inventory_transactions.push(itx);

      // Check if all units for this order are now picked
      const orderUnits = db.inventory_units.filter(u => u.order_id === order.id);
      const allOrderUnitsPicked = orderUnits.length > 0 && orderUnits.every(u => u.state === 'picked');

      if (allOrderUnitsPicked && order.status === 'to_fulfill') {
        order.status = 'picked';
        order.updated_at = now;

        logAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'ORDER_PICKED',
          entityType: 'fulfillment_order',
          entityId: order.id,
          metadata: {
            orderNumber: order.order_number,
            pickedPieces: orderUnits.length
          }
        });
      }

      // Check batch completion if batchId provided
      let batchCompleted = false;
      if (params.batchId) {
        const batch = db.picking_batches.find(b => b.id === params.batchId);
        if (batch) {
          const batchUnits = db.inventory_units.filter(
            u => u.order_id && batch.order_ids.includes(u.order_id)
          );
          batch.picked_units_count = batchUnits.filter(u => u.state === 'picked').length;
          if (batchUnits.length > 0 && batchUnits.every(u => u.state === 'picked')) {
            batch.status = 'completed';
            batch.completed_at = now;
            batchCompleted = true;
          }
        }
      }

      return {
        unit: {
          id: unit.id,
          tracking_code: unit.tracking_code,
          state: unit.state,
          product_name: product?.name || 'Unknown',
          sku: product?.sku || 'UNKNOWN',
          location_code: originLocation?.code || 'None'
        },
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          consignee_name: order.consignee_name,
          isOrderFullyPicked: allOrderUnitsPicked
        },
        batchCompleted
      };
    });
  }

  /**
   * 7.6: Packing Station (Scan-to-Pack)
   * Mandatory Scan: Label generation does NOT mark packed.
   * Scanning package/order label at packing station verifies and marks Packed.
   */
  public async packOrderScan(actor: ActorContext, orderBarcode: string) {
    return withTransaction(async (db) => {
      const isAdmin = actor.roleId === 'role_administrator';
      const canPack = isAdmin || actor.permissions.includes('orders.pack');
      if (!canPack) {
        throw new FulfillmentError('FORBIDDEN', 'You do not have permission to operate the Packing Station.');
      }

      const rawBarcode = (orderBarcode || '').trim().toUpperCase();
      if (!rawBarcode) {
        throw new FulfillmentError('VALIDATION_ERROR', 'Please scan or enter an Order Barcode or Order Number.');
      }

      // Find order by order_number or id
      const order = db.fulfillment_orders.find(
        o => o.order_number.toUpperCase() === rawBarcode || o.id === rawBarcode
      );

      if (!order) {
        throw new FulfillmentError(
          'ORDER_NOT_FOUND',
          `Order with barcode "${rawBarcode}" was not found in the system.`
        );
      }

      // Check current state
      if (order.status === 'packed') {
        throw new FulfillmentError('ALREADY_PACKED', `Order ${order.order_number} is ALREADY marked as Packed.`);
      }

      if (order.status === 'fulfilled') {
        throw new FulfillmentError('ALREADY_FULFILLED', `Order ${order.order_number} has already been dispatched.`);
      }

      if (order.status === 'cancelled') {
        throw new FulfillmentError('ORDER_CANCELLED', `Order ${order.order_number} is cancelled and cannot be packed.`);
      }

      // Find all linked inventory units for this order
      const linkedUnits = db.inventory_units.filter(u => u.order_id === order.id);

      // Verify that all line item quantities match linked units and all linked units are in 'picked' state
      const unpickedUnits = linkedUnits.filter(u => u.state !== 'picked');
      if (unpickedUnits.length > 0 || linkedUnits.length === 0) {
        throw new FulfillmentError(
          'ITEMS_NOT_PICKED',
          `Cannot pack order ${order.order_number}! ${unpickedUnits.length} of ${linkedUnits.length} physical item(s) have NOT been picked from warehouse storage yet.`
        );
      }

      const now = new Date().toISOString();

      // Transition order status to 'packed'
      order.status = 'packed';
      order.updated_at = now;

      // Transition each inventory unit to 'packed'
      for (const unit of linkedUnits) {
        const prevState = unit.state;
        unit.state = 'packed';
        unit.updated_at = now;

        const itx: InventoryTransactionRow = {
          id: generateId('itx'),
          unit_id: unit.id,
          tracking_code: unit.tracking_code,
          product_id: unit.product_id,
          customer_id: unit.customer_id,
          type: 'PACK',
          from_location_id: null,
          to_location_id: null,
          from_state: prevState,
          to_state: 'packed',
          actor_id: actor.id,
          actor_name: actor.name,
          notes: `Packed at packing station for order ${order.order_number}`,
          created_at: now
        };
        db.inventory_transactions.push(itx);
      }

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'ORDER_PACKED',
        entityType: 'fulfillment_order',
        entityId: order.id,
        metadata: {
          orderNumber: order.order_number,
          piecesPacked: linkedUnits.length,
          consigneeName: order.consignee_name,
          codAmount: order.cod_amount
        }
      });

      const customer = db.customer_profiles.find(c => c.id === order.customer_id);

      return {
        order: {
          id: order.id,
          order_number: order.order_number,
          customer_reference: order.customer_reference,
          consignee_name: order.consignee_name,
          consignee_phone: order.consignee_phone,
          city: order.city,
          shipping_address: order.shipping_address,
          cod_amount: order.cod_amount,
          payment_method: order.payment_method,
          total_pieces: db.fulfillment_order_items.filter(i => i.order_id === order.id).reduce((s, i) => s + i.quantity, 0),
          status: order.status,
          customer_brand: customer?.brand_name || customer?.business_name || 'Merchant'
        },
        packedUnitsCount: linkedUnits.length,
        packedAt: now
      };
    });
  }

  /**
   * 7.7: Handover / Dispatch Orders to Carrier ('Fulfilled' state)
   */
  public async dispatchOrders(actor: ActorContext, orderIds: string[]) {
    return withTransaction(async (db) => {
      const isAdmin = actor.roleId === 'role_administrator';
      const canDispatch = isAdmin || actor.permissions.includes('orders.pack') || actor.permissions.includes('orders.create');
      if (!canDispatch) {
        throw new FulfillmentError('FORBIDDEN', 'You do not have permission to dispatch orders.');
      }

      if (orderIds.length === 0) {
        throw new FulfillmentError('VALIDATION_ERROR', 'No orders selected for dispatch.');
      }

      const dispatchedOrders: string[] = [];
      const failedOrders: Array<{ orderId: string; reason: string }> = [];
      const now = new Date().toISOString();

      for (const orderId of orderIds) {
        const order = db.fulfillment_orders.find(o => o.id === orderId);
        if (!order) {
          failedOrders.push({ orderId, reason: 'Order not found.' });
          continue;
        }

        if (order.status !== 'packed') {
          failedOrders.push({
            orderId,
            reason: `Order ${order.order_number} is in "${order.status}" status (must be "packed" before dispatch).`
          });
          continue;
        }

        order.status = 'fulfilled';
        order.updated_at = now;
        dispatchedOrders.push(order.order_number);

        const linkedUnits = db.inventory_units.filter(u => u.order_id === order.id);
        for (const unit of linkedUnits) {
          const prevState = unit.state;
          unit.state = 'fulfilled';
          unit.updated_at = now;

          const itx: InventoryTransactionRow = {
            id: generateId('itx'),
            unit_id: unit.id,
            tracking_code: unit.tracking_code,
            product_id: unit.product_id,
            customer_id: unit.customer_id,
            type: 'FULFILL',
            from_location_id: null,
            to_location_id: null,
            from_state: prevState,
            to_state: 'fulfilled',
            actor_id: actor.id,
            actor_name: actor.name,
            notes: `Dispatched & fulfilled for carrier delivery: ${order.order_number}`,
            created_at: now
          };
          db.inventory_transactions.push(itx);
        }

        logAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'ORDER_DISPATCHED',
          entityType: 'fulfillment_order',
          entityId: order.id,
          metadata: {
            orderNumber: order.order_number,
            consigneeName: order.consignee_name,
            codAmount: order.cod_amount
          }
        });
      }

      return {
        dispatchedCount: dispatchedOrders.length,
        dispatchedOrders,
        failedCount: failedOrders.length,
        failedOrders
      };
    });
  }

  /**
   * 7.5: Shipping Labels Data Generation for Thermal 4x6 / 4x2 Printing
   */
  public async getShippingLabelsData(actor: ActorContext, orderIds: string[]) {
    const db = getDb();

    let orders = db.fulfillment_orders.filter(o => orderIds.includes(o.id));
    if (actor.accountType === 'customer') {
      orders = orders.filter(o => o.customer_id === actor.customerProfileId);
    }

    if (orders.length === 0) {
      throw new FulfillmentError('NOT_FOUND', 'No matching orders found.');
    }

    return orders.map(ord => {
      const customer = db.customer_profiles.find(c => c.id === ord.customer_id);
      const items = db.fulfillment_order_items.filter(i => i.order_id === ord.id);

      return {
        orderId: ord.id,
        orderNumber: ord.order_number,
        customerReference: ord.customer_reference || '',
        consigneeName: ord.consignee_name,
        consigneePhone: ord.consignee_phone,
        consigneeEmail: ord.consignee_email || '',
        shippingAddress: ord.shipping_address,
        city: ord.city,
        province: ord.province || '',
        postalCode: ord.postal_code || '',
        codAmount: ord.cod_amount,
        paymentMethod: ord.payment_method,
        totalPieces: items.reduce((s, i) => s + i.quantity, 0),
        shippingNotes: ord.shipping_notes || '',
        shipper: {
          brandName: customer?.brand_name || customer?.business_name || 'Ship Asaan Merchant',
          businessName: customer?.business_name || 'Fulfillment Partner',
          city: customer?.city || 'Pakistan',
          phone: customer?.phone || ''
        },
        items: items.map(i => ({
          sku: i.sku,
          name: i.product_name,
          quantity: i.quantity
        })),
        createdAt: ord.created_at
      };
    });
  }
}

export const fulfillmentService = new FulfillmentService();
