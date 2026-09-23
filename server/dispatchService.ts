/**
 * Phase 8: Authoritative Carrier Dispatch, Real-Time Tracking, Returns & Automated Billing Service
 * Handles:
 *  - Carrier Dispatch Handover Manifests (Printable legal handoff with driver signature line)
 *  - Real-Time Checkpoint Tracking Timeline (with carrier simulation or manual checkpoint scan)
 *  - Reverse Logistics & Returns Processing (RTO / Customer Return with restock into bin or quarantine)
 *  - Automated Fulfillment Billing Engine (Calculates courier fee + pick/pack fee, debits customer wallet with immutable ledger)
 */

import {
  withTransaction,
  getDb,
  FulfillmentOrderRow,
  InventoryUnitRow,
  InventoryTransactionRow,
  DispatchManifestRow,
  OrderTrackingEventRow,
  ReturnOrderRow,
  BillingRateCardRow,
  WalletTransactionRow
} from './db.js';
import { generateId } from './security.js';
import { logAudit } from './audit.js';
import { debitWallet, creditWallet, roundToTwoDecimals } from './walletService.js';
import { ActorContext } from './fulfillmentService.js';

export class DispatchError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'DispatchError';
  }
}

export interface CreateManifestInput {
  carrierName: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  handoverNotes?: string;
  orderIds: string[];
}

export interface ProcessReturnInput {
  orderId: string;
  returnType: 'rto_courier' | 'customer_return';
  returnReason: string;
  trackingReference?: string;
  disposition: 'restocked' | 'damaged_quarantine' | 'merchant_claim' | 'scrapped';
  targetLocationId?: string; // Bin/location if restocked
  conditionNotes: string;
}

export interface TrackingEventInput {
  orderId: string;
  status: OrderTrackingEventRow['status'];
  location: string;
  description: string;
}

export const dispatchService = {
  /**
   * 8.1: Create Carrier Handover Manifest
   * Validates that all selected orders are in 'packed' or 'fulfilled' status
   */
  async createManifest(actor: ActorContext, input: CreateManifestInput) {
    if (!actor.permissions.includes('manifests.create') && actor.roleId !== 'role_administrator') {
      throw new DispatchError('FORBIDDEN', 'Insufficient permissions to create dispatch manifests.');
    }

    if (!input.carrierName || input.carrierName.trim().length === 0) {
      throw new DispatchError('INVALID_INPUT', 'Carrier name is required.');
    }

    if (!Array.isArray(input.orderIds) || input.orderIds.length === 0) {
      throw new DispatchError('INVALID_INPUT', 'At least one order must be included in the handover manifest.');
    }

    return withTransaction(async (db) => {
      const now = new Date().toISOString();
      const validOrders: FulfillmentOrderRow[] = [];
      let totalCod = 0;

      for (const orderId of input.orderIds) {
        const order = db.fulfillment_orders.find(o => o.id === orderId);
        if (!order) {
          throw new DispatchError('NOT_FOUND', `Order ID '${orderId}' not found.`);
        }

        // Allow packed or already fulfilled
        if (order.status !== 'packed' && order.status !== 'fulfilled') {
          throw new DispatchError(
            'INVALID_STATUS',
            `Order ${order.order_number} is in '${order.status}' status. Only 'packed' or 'fulfilled' orders can be manifested.`
          );
        }

        validOrders.push(order);
        totalCod += (order.payment_method === 'cod' ? order.cod_amount : 0);
      }

      // Generate sequential manifest number
      const datePrefix = now.slice(0, 7).replace('-', '');
      const count = db.dispatch_manifests.length + 1;
      const manifestNumber = `MNF-${datePrefix}-${String(count).padStart(4, '0')}`;

      const manifest: DispatchManifestRow = {
        id: generateId('mnf'),
        manifest_number: manifestNumber,
        carrier_name: input.carrierName.trim(),
        driver_name: input.driverName?.trim() || undefined,
        driver_phone: input.driverPhone?.trim() || undefined,
        vehicle_number: input.vehicleNumber?.trim() || undefined,
        handover_notes: input.handoverNotes?.trim() || undefined,
        order_ids: validOrders.map(o => o.id),
        total_orders: validOrders.length,
        total_cod_amount: roundToTwoDecimals(totalCod),
        status: 'draft',
        created_by_id: actor.id,
        created_by_name: actor.name,
        dispatched_at: null,
        created_at: now,
        updated_at: now
      };

      db.dispatch_manifests.push(manifest);

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'DISPATCH_MANIFEST_CREATED',
        entityType: 'dispatch_manifest',
        entityId: manifest.id,
        metadata: {
          manifestNumber: manifest.manifest_number,
          carrier: manifest.carrier_name,
          orderCount: manifest.total_orders,
          totalCod: manifest.total_cod_amount
        }
      });

      return manifest;
    });
  },

  /**
   * 8.2: Sign & Dispatch Carrier Manifest
   * Transitions manifest to 'signed_dispatched', marks all orders as 'fulfilled',
   * generates initial carrier tracking event, and automates wallet fee billing deduction.
   */
  async signAndDispatchManifest(actor: ActorContext, manifestId: string) {
    if (!actor.permissions.includes('manifests.dispatch') && actor.roleId !== 'role_administrator') {
      throw new DispatchError('FORBIDDEN', 'Insufficient permissions to sign and dispatch manifests.');
    }

    return withTransaction(async (db) => {
      const manifest = db.dispatch_manifests.find(m => m.id === manifestId);
      if (!manifest) {
        throw new DispatchError('NOT_FOUND', `Manifest '${manifestId}' not found.`);
      }

      if (manifest.status === 'signed_dispatched' || manifest.status === 'closed') {
        throw new DispatchError('ALREADY_DISPATCHED', `Manifest is already ${manifest.status}.`);
      }

      const now = new Date().toISOString();
      manifest.status = 'signed_dispatched';
      manifest.dispatched_at = now;
      manifest.updated_at = now;

      // Rate card for automated billing
      const defaultRateCard = db.billing_rate_cards.find(r => r.is_active && r.customer_id === null) || {
        base_courier_fee: 190.0,
        per_kg_fee: 45.0,
        pick_pack_fee_per_unit: 30.0,
        daily_storage_fee_per_cbm: 15.0,
        return_processing_fee: 40.0
      };

      const processedOrders: Array<{ orderNumber: string; billedAmount: number; trackingEventId: string }> = [];

      for (const orderId of manifest.order_ids) {
        const order = db.fulfillment_orders.find(o => o.id === orderId);
        if (!order) continue;

        const prevStatus = order.status;
        order.status = 'fulfilled';
        order.updated_at = now;

        // Transition units to 'fulfilled'
        const linkedUnits = db.inventory_units.filter(u => u.order_id === order.id);
        for (const unit of linkedUnits) {
          const prevUnitState = unit.state;
          unit.state = 'fulfilled';
          unit.updated_at = now;

          db.inventory_transactions.push({
            id: generateId('itx'),
            unit_id: unit.id,
            tracking_code: unit.tracking_code,
            product_id: unit.product_id,
            customer_id: unit.customer_id,
            type: 'FULFILL',
            from_location_id: null,
            to_location_id: null,
            from_state: prevUnitState,
            to_state: 'fulfilled',
            actor_id: actor.id,
            actor_name: actor.name,
            notes: `Handed over to carrier ${manifest.carrier_name} on manifest ${manifest.manifest_number}`,
            created_at: now
          });
        }

        // Add Dispatched Tracking Event
        const trackingEvent: OrderTrackingEventRow = {
          id: generateId('trk'),
          order_id: order.id,
          order_number: order.order_number,
          status: 'dispatched',
          location: 'Ship Asaan Central Fulfillment Gateway Hub, Islamabad',
          description: `Consignment sealed and handed over to ${manifest.carrier_name} under Manifest ${manifest.manifest_number}. Carrier Driver: ${manifest.driver_name || 'Designated Driver'}.`,
          actor_id: actor.id,
          actor_name: actor.name,
          created_at: now
        };
        db.order_tracking_events.push(trackingEvent);

        // 8.4: Automated Billing Deduction from Customer Wallet
        // Calculate fee: base courier fee + (units * pick_pack_fee)
        const orderItems = db.fulfillment_order_items.filter(i => i.order_id === order.id);
        const totalPieces = orderItems.reduce((sum, item) => sum + item.quantity, 0);

        const customerRateCard = db.billing_rate_cards.find(
          r => r.is_active && r.customer_id === order.customer_id
        ) || defaultRateCard;

        const pickPackFee = totalPieces * customerRateCard.pick_pack_fee_per_unit;
        const courierFee = customerRateCard.base_courier_fee;
        const totalFee = roundToTwoDecimals(courierFee + pickPackFee);

        // Check customer wallet
        let wallet = db.wallet_accounts.find(w => w.customer_profile_id === order.customer_id);
        if (!wallet) {
          const cust = db.customer_profiles.find(cp => cp.id === order.customer_id);
          wallet = {
            id: generateId('wal'),
            customer_profile_id: order.customer_id,
            user_id: cust ? cust.user_id : 'usr_auto',
            balance: 0.0,
            currency: 'PKR',
            status: 'active',
            created_at: now,
            updated_at: now
          };
          db.wallet_accounts.push(wallet);
        }

        const balBefore = wallet.balance;
        const balAfter = roundToTwoDecimals(balBefore - totalFee);
        wallet.balance = balAfter;
        wallet.updated_at = now;

        const walletTx: WalletTransactionRow = {
          id: generateId('txn'),
          wallet_id: wallet.id,
          customer_profile_id: order.customer_id,
          type: 'DEBIT',
          amount: totalFee,
          balance_before: balBefore,
          balance_after: balAfter,
          payment_method: 'fulfillment_fee',
          reference_number: order.order_number,
          notes: `Automated fulfillment & courier handover fee: Courier base PKR ${courierFee} + Pick/Pack (${totalPieces} pcs @ PKR ${customerRateCard.pick_pack_fee_per_unit}) PKR ${pickPackFee}. Manifest: ${manifest.manifest_number}`,
          actor_id: actor.id,
          actor_name: actor.name,
          created_at: now
        };
        db.wallet_transactions.push(walletTx);

        processedOrders.push({
          orderNumber: order.order_number,
          billedAmount: totalFee,
          trackingEventId: trackingEvent.id
        });
      }

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'DISPATCH_MANIFEST_SIGNED',
        entityType: 'dispatch_manifest',
        entityId: manifest.id,
        metadata: {
          manifestNumber: manifest.manifest_number,
          carrier: manifest.carrier_name,
          dispatchedOrdersCount: processedOrders.length
        }
      });

      return {
        manifest,
        processedOrders
      };
    });
  },

  /**
   * List dispatch manifests with filtering
   */
  async listManifests(actor: ActorContext) {
    const db = getDb();
    let manifests = [...db.dispatch_manifests];

    // If customer, only see manifests containing their orders
    if (actor.accountType === 'customer' && actor.customerProfileId) {
      const myOrderIds = new Set(
        db.fulfillment_orders
          .filter(o => o.customer_id === actor.customerProfileId)
          .map(o => o.id)
      );
      manifests = manifests.filter(m => m.order_ids.some(id => myOrderIds.has(id)));
    }

    manifests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return manifests.map(m => {
      const orders = db.fulfillment_orders.filter(o => m.order_ids.includes(o.id));
      return {
        ...m,
        orders: orders.map(o => {
          const cust = db.customer_profiles.find(c => c.id === o.customer_id);
          return {
            id: o.id,
            order_number: o.order_number,
            consignee_name: o.consignee_name,
            consignee_phone: o.consignee_phone,
            shipping_address: o.shipping_address,
            city: o.city,
            cod_amount: o.cod_amount,
            payment_method: o.payment_method,
            status: o.status,
            customer_brand: cust?.brand_name || cust?.business_name || 'Merchant'
          };
        })
      };
    });
  },

  /**
   * Get single manifest details for printable handover voucher
   */
  async getManifestDetails(manifestId: string) {
    const db = getDb();
    const manifest = db.dispatch_manifests.find(m => m.id === manifestId);
    if (!manifest) {
      throw new DispatchError('NOT_FOUND', `Manifest '${manifestId}' not found.`);
    }

    const orders = db.fulfillment_orders.filter(o => manifest.order_ids.includes(o.id));
    const detailedOrders = orders.map((o, idx) => {
      const cust = db.customer_profiles.find(c => c.id === o.customer_id);
      const items = db.fulfillment_order_items.filter(i => i.order_id === o.id);
      const totalPieces = items.reduce((s, i) => s + i.quantity, 0);

      return {
        sequence: idx + 1,
        id: o.id,
        order_number: o.order_number,
        customer_reference: o.customer_reference || '-',
        customer_brand: cust?.brand_name || cust?.business_name || 'Merchant',
        consignee_name: o.consignee_name,
        consignee_phone: o.consignee_phone,
        city: o.city,
        shipping_address: o.shipping_address,
        payment_method: o.payment_method,
        cod_amount: o.cod_amount,
        total_pieces: totalPieces,
        shipping_notes: o.shipping_notes || '',
        status: o.status
      };
    });

    return {
      manifest,
      orders: detailedOrders,
      summary: {
        total_orders: manifest.total_orders,
        total_cod_amount: manifest.total_cod_amount,
        cod_orders_count: orders.filter(o => o.payment_method === 'cod').length,
        prepaid_orders_count: orders.filter(o => o.payment_method === 'prepaid').length,
        total_pieces_count: detailedOrders.reduce((sum, o) => sum + o.total_pieces, 0)
      }
    };
  },

  /**
   * 8.3: Add Tracking Event Checkpoint
   */
  async addTrackingEvent(actor: ActorContext, input: TrackingEventInput) {
    return withTransaction(async (db) => {
      const order = db.fulfillment_orders.find(o => o.id === input.orderId || o.order_number === input.orderId);
      if (!order) {
        throw new DispatchError('NOT_FOUND', `Order '${input.orderId}' not found.`);
      }

      const now = new Date().toISOString();
      const event: OrderTrackingEventRow = {
        id: generateId('trk'),
        order_id: order.id,
        order_number: order.order_number,
        status: input.status,
        location: input.location.trim(),
        description: input.description.trim(),
        actor_id: actor.id,
        actor_name: actor.name,
        created_at: now
      };

      db.order_tracking_events.push(event);

      // If status implies terminal or delivery update order status accordingly
      if (input.status === 'delivered') {
        // order delivered, no status change needed if fulfilled, but log audit
        logAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'ORDER_DELIVERED',
          entityType: 'fulfillment_order',
          entityId: order.id,
          metadata: { orderNumber: order.order_number, location: input.location }
        });
      }

      return event;
    });
  },

  /**
   * Get Tracking Timeline for an order
   */
  async getOrderTracking(orderIdentifier: string) {
    const db = getDb();
    const order = db.fulfillment_orders.find(
      o => o.id === orderIdentifier || o.order_number === orderIdentifier
    );
    if (!order) {
      throw new DispatchError('NOT_FOUND', `Order '${orderIdentifier}' not found.`);
    }

    const events = db.order_tracking_events
      .filter(e => e.order_id === order.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // If no explicit events yet, synthesize foundational timeline based on order status
    const timeline = [...events];
    if (timeline.length === 0) {
      timeline.push({
        id: 'trk_init',
        order_id: order.id,
        order_number: order.order_number,
        status: 'placed',
        location: 'Merchant Storefront / Client Portal',
        description: `Order registered in Ship Asaan fulfillment network.`,
        created_at: order.created_at
      });

      if (order.confirmed_at) {
        timeline.push({
          id: 'trk_conf',
          order_id: order.id,
          order_number: order.order_number,
          status: 'confirmed',
          location: 'Ship Asaan Operations Desk',
          description: `Order acknowledged and queued for stock allocation.`,
          created_at: order.confirmed_at
        });
      }
    }

    const customer = db.customer_profiles.find(c => c.id === order.customer_id);
    const items = db.fulfillment_order_items.filter(i => i.order_id === order.id);

    return {
      order: {
        id: order.id,
        order_number: order.order_number,
        customer_reference: order.customer_reference,
        status: order.status,
        consignee_name: order.consignee_name,
        city: order.city,
        shipping_address: order.shipping_address,
        cod_amount: order.cod_amount,
        payment_method: order.payment_method,
        created_at: order.created_at,
        customer_brand: customer?.brand_name || customer?.business_name || 'Merchant'
      },
      items,
      timeline
    };
  },

  /**
   * 8.4: Reverse Logistics & Returns Processing (RTO & Customer Returns)
   * Restocks good units back into shelf bins or routes damaged units to quarantine.
   */
  async processReturn(actor: ActorContext, input: ProcessReturnInput) {
    if (!actor.permissions.includes('returns.process') && actor.roleId !== 'role_administrator') {
      throw new DispatchError('FORBIDDEN', 'Insufficient permissions to process returns.');
    }

    return withTransaction(async (db) => {
      const order = db.fulfillment_orders.find(o => o.id === input.orderId || o.order_number === input.orderId);
      if (!order) {
        throw new DispatchError('NOT_FOUND', `Order '${input.orderId}' not found.`);
      }

      const now = new Date().toISOString();
      const count = db.return_orders.length + 1;
      const datePrefix = now.slice(0, 7).replace('-', '');
      const returnNumber = `RTN-${datePrefix}-${String(count).padStart(4, '0')}`;

      // Validate target location if restocked
      let targetLocationName = 'Quarantine Area';
      if (input.disposition === 'restocked') {
        if (!input.targetLocationId) {
          throw new DispatchError('LOCATION_REQUIRED', 'Restocking a returned unit requires specifying a warehouse target location ID.');
        }
        const loc = db.warehouse_locations.find(l => l.id === input.targetLocationId);
        if (!loc) {
          throw new DispatchError('LOCATION_NOT_FOUND', `Warehouse location '${input.targetLocationId}' does not exist.`);
        }
        targetLocationName = `${loc.name} (${loc.code})`;
      }

      // Record return order
      const returnOrder: ReturnOrderRow = {
        id: generateId('rtn'),
        return_number: returnNumber,
        order_id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        return_type: input.returnType,
        return_reason: input.returnReason.trim(),
        tracking_reference: input.trackingReference?.trim() || undefined,
        disposition: input.disposition,
        target_location_id: input.targetLocationId || null,
        condition_notes: input.conditionNotes.trim(),
        processed_by_id: actor.id,
        processed_by_name: actor.name,
        created_at: now
      };
      db.return_orders.push(returnOrder);

      // Reconcile physical inventory units
      const linkedUnits = db.inventory_units.filter(u => u.order_id === order.id);
      for (const unit of linkedUnits) {
        const prevUnitState = unit.state;
        const prevLoc = unit.location_id;

        if (input.disposition === 'restocked') {
          unit.state = 'in_storage';
          unit.location_id = input.targetLocationId!;
          unit.condition = 'good';
          unit.order_id = null; // Detach from order to allow re-allocation
          unit.order_item_id = null;
          unit.updated_at = now;

          // Increment location count
          const loc = db.warehouse_locations.find(l => l.id === input.targetLocationId);
          if (loc) {
            loc.occupied_units = (loc.occupied_units || 0) + 1;
            loc.updated_at = now;
          }

          db.inventory_transactions.push({
            id: generateId('itx'),
            unit_id: unit.id,
            tracking_code: unit.tracking_code,
            product_id: unit.product_id,
            customer_id: unit.customer_id,
            type: 'RETURN',
            from_location_id: prevLoc,
            to_location_id: input.targetLocationId!,
            from_state: prevUnitState,
            to_state: 'in_storage',
            actor_id: actor.id,
            actor_name: actor.name,
            notes: `Return ${returnNumber} processed: Inspected good condition and restocked into location ${targetLocationName}.`,
            created_at: now
          });
        } else {
          // Quarantine, claim, or scrap
          unit.state = input.disposition === 'damaged_quarantine' ? 'damaged' : 'returned';
          unit.condition = 'damaged';
          unit.location_id = null;
          unit.updated_at = now;

          db.inventory_transactions.push({
            id: generateId('itx'),
            unit_id: unit.id,
            tracking_code: unit.tracking_code,
            product_id: unit.product_id,
            customer_id: unit.customer_id,
            type: 'DAMAGE',
            from_location_id: prevLoc,
            to_location_id: null,
            from_state: prevUnitState,
            to_state: unit.state,
            actor_id: actor.id,
            actor_name: actor.name,
            notes: `Return ${returnNumber} disposition: ${input.disposition}. Condition: ${input.conditionNotes}`,
            created_at: now
          });
        }
      }

      // Add Return Tracking Event
      db.order_tracking_events.push({
        id: generateId('trk'),
        order_id: order.id,
        order_number: order.order_number,
        status: 'returned_to_warehouse',
        location: 'Ship Asaan Returns & Reverse Inspection Bay, Islamabad Hub',
        description: `Shipment returned under Return #${returnNumber} (${input.returnType.toUpperCase()}). Disposition: ${input.disposition}. Notes: ${input.conditionNotes}.`,
        actor_id: actor.id,
        actor_name: actor.name,
        created_at: now
      });

      // Automated return processing fee deduction (if configured)
      const defaultRateCard = db.billing_rate_cards.find(r => r.is_active && r.customer_id === null);
      const rtoFee = defaultRateCard?.return_processing_fee || 40.0;

      let wallet = db.wallet_accounts.find(w => w.customer_profile_id === order.customer_id);
      if (wallet && rtoFee > 0) {
        const balBefore = wallet.balance;
        const balAfter = roundToTwoDecimals(balBefore - rtoFee);
        wallet.balance = balAfter;
        wallet.updated_at = now;

        db.wallet_transactions.push({
          id: generateId('txn'),
          wallet_id: wallet.id,
          customer_profile_id: order.customer_id,
          type: 'DEBIT',
          amount: rtoFee,
          balance_before: balBefore,
          balance_after: balAfter,
          payment_method: 'storage_fee',
          reference_number: returnNumber,
          notes: `Reverse logistics & return inspection fee for ${order.order_number} (${returnNumber})`,
          actor_id: actor.id,
          actor_name: actor.name,
          created_at: now
        });
      }

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'ORDER_RETURN_PROCESSED',
        entityType: 'return_order',
        entityId: returnOrder.id,
        metadata: {
          returnNumber,
          orderNumber: order.order_number,
          disposition: input.disposition,
          unitsReconciled: linkedUnits.length
        }
      });

      return {
        returnOrder,
        unitsReconciledCount: linkedUnits.length,
        targetLocationName
      };
    });
  },

  /**
   * List return orders
   */
  async listReturns(actor: ActorContext) {
    const db = getDb();
    let returns = [...db.return_orders];

    if (actor.accountType === 'customer' && actor.customerProfileId) {
      returns = returns.filter(r => r.customer_id === actor.customerProfileId);
    }

    returns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return returns.map(r => {
      const cust = db.customer_profiles.find(c => c.id === r.customer_id);
      const order = db.fulfillment_orders.find(o => o.id === r.order_id);
      const loc = r.target_location_id ? db.warehouse_locations.find(l => l.id === r.target_location_id) : null;

      return {
        ...r,
        customer_brand: cust?.brand_name || cust?.business_name || 'Merchant',
        consignee_name: order?.consignee_name || '-',
        city: order?.city || '-',
        target_location_name: loc ? `${loc.name} (${loc.code})` : null
      };
    });
  },

  /**
   * 8.5: Billing Rate Cards Management
   */
  async listRateCards(actor: ActorContext) {
    const db = getDb();
    if (actor.accountType === 'customer' && actor.customerProfileId) {
      // Customer sees applicable rate card
      return db.billing_rate_cards.filter(
        r => r.is_active && (r.customer_id === actor.customerProfileId || r.customer_id === null)
      );
    }
    return db.billing_rate_cards;
  },

  async updateRateCard(actor: ActorContext, id: string, updates: Partial<BillingRateCardRow>) {
    if (!actor.permissions.includes('billing.manage') && actor.roleId !== 'role_administrator') {
      throw new DispatchError('FORBIDDEN', 'Insufficient permissions to update billing rate cards.');
    }

    return withTransaction(async (db) => {
      const rateCard = db.billing_rate_cards.find(r => r.id === id);
      if (!rateCard) {
        throw new DispatchError('NOT_FOUND', `Rate card '${id}' not found.`);
      }

      if (updates.name !== undefined) rateCard.name = updates.name.trim();
      if (updates.base_courier_fee !== undefined) rateCard.base_courier_fee = Number(updates.base_courier_fee);
      if (updates.per_kg_fee !== undefined) rateCard.per_kg_fee = Number(updates.per_kg_fee);
      if (updates.pick_pack_fee_per_unit !== undefined) rateCard.pick_pack_fee_per_unit = Number(updates.pick_pack_fee_per_unit);
      if (updates.daily_storage_fee_per_cbm !== undefined) rateCard.daily_storage_fee_per_cbm = Number(updates.daily_storage_fee_per_cbm);
      if (updates.return_processing_fee !== undefined) rateCard.return_processing_fee = Number(updates.return_processing_fee);
      if (updates.is_active !== undefined) rateCard.is_active = Boolean(updates.is_active);

      rateCard.updated_at = new Date().toISOString();

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'RATE_CARD_UPDATED',
        entityType: 'billing_rate_card',
        entityId: rateCard.id,
        metadata: { name: rateCard.name }
      });

      return rateCard;
    });
  }
};
