/**
 * Authoritative Fulfillment Order Service for Ship Asaan
 * Handles order intake, customer self-service, staff proxy creation,
 * multi-step CSV parsing/validation engine, and explicit confirmation queue.
 */

import {
  withTransaction,
  getFreshDb,
  FulfillmentOrderRow,
  FulfillmentOrderItemRow,
  FulfillmentOrderStatus,
  ProductRow,
  DatabaseSchema
} from './db.js';
import { generateId } from './security.js';
import { logAudit } from './audit.js';
import { upsertOrderRecord } from './domainDb.js';

export class OrderError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'OrderError';
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

export interface OrderItemInput {
  productId?: string;
  sku?: string;
  quantity: number;
  unitPrice?: number;
}

export interface CreateOrderInput {
  customerId?: string; // Required for staff, auto-derived for customer
  customerReference?: string;
  consigneeName: string;
  consigneePhone: string;
  consigneeEmail?: string;
  shippingAddress: string;
  city: string;
  province?: string;
  postalCode?: string;
  codAmount: number;
  paymentMethod?: 'cod' | 'prepaid';
  shippingNotes?: string;
  items: OrderItemInput[];
  autoConfirm?: boolean; // Allowed only for staff with orders.confirm
}

export interface OrderFilterOptions {
  status?: string;
  customerId?: string;
  search?: string;
  city?: string;
  paymentMethod?: 'cod' | 'prepaid';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface CsvOrderItemPreview {
  sku: string;
  productName: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  availableStock: number;
  isValid: boolean;
  error?: string;
}

export interface CsvOrderPreview {
  tempId: string;
  rowIndices: number[]; // 1-based original CSV row numbers
  customerReference?: string;
  consigneeName: string;
  consigneePhone: string;
  consigneeEmail?: string;
  shippingAddress: string;
  city: string;
  province?: string;
  postalCode?: string;
  codAmount: number;
  paymentMethod: 'cod' | 'prepaid';
  shippingNotes?: string;
  items: CsvOrderItemPreview[];
  totalPieces: number;
  totalDeclaredValue: number;
  isValid: boolean;
  errors: Array<{ field: string; message: string; hint: string }>;
  warnings: string[];
}

export interface CsvPreviewResult {
  summary: {
    totalRows: number;
    totalOrders: number;
    validOrdersCount: number;
    invalidOrdersCount: number;
    totalPieces: number;
    totalCodAmount: number;
  };
  customerId: string;
  customerName: string;
  orders: CsvOrderPreview[];
  canCommit: boolean;
}

class OrderService {
  /**
   * Helper: Generate authoritative sequential-style order numbers (e.g. ORD-202609-1082)
   */
  private generateOrderNumber(db: DatabaseSchema): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Count orders created this month
    const prefix = `ORD-${yearMonth}-`;
    const thisMonthOrders = db.fulfillment_orders.filter(o => o.order_number?.startsWith(prefix));
    const nextSeq = thisMonthOrders.length + 1;
    const seqStr = String(nextSeq).padStart(4, '0');
    
    let candidate = `${prefix}${seqStr}`;
    // If collision somehow occurs, append random hex
    if (db.fulfillment_orders.some(o => o.order_number === candidate)) {
      candidate = `${prefix}${seqStr}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    return candidate;
  }

  /**
   * Calculate stock adequacy for a product
   */
  public getProductStockSummary(db: DatabaseSchema, productId: string) {
    const inStorage = db.inventory_units.filter(
      u => u.product_id === productId && u.state === 'in_storage' && u.condition === 'good'
    ).length;

    const reserved = db.inventory_units.filter(
      u => u.product_id === productId && u.state === 'reserved'
    ).length;

    const awaitingStocking = db.inventory_units.filter(
      u => u.product_id === productId && u.state === 'awaiting_stocking'
    ).length;

    return {
      inStorage,
      reserved,
      awaitingStocking,
      availableToFulfill: inStorage
    };
  }

  /**
   * Create a single fulfillment order (Customer self-service or Staff proxy)
   */
  public async createOrder(actor: ActorContext, input: CreateOrderInput) {
    return withTransaction(async (db) => {
      // 1. Authorization check
      const isAdmin = actor.roleId === 'role_administrator';
      const canCreate = isAdmin || actor.permissions.includes('orders.create');
      if (!canCreate) {
        throw new OrderError('FORBIDDEN', 'You do not have permission to create fulfill orders.');
      }

      // 2. Resolve Customer Profile
      let targetCustomerId: string;
      if (actor.accountType === 'customer') {
        if (!actor.customerProfileId) {
          throw new OrderError('UNAUTHORIZED', 'Customer profile not found for this account.');
        }
        targetCustomerId = actor.customerProfileId;
      } else {
        if (!input.customerId) {
          throw new OrderError('VALIDATION_ERROR', 'Customer ID is required when staff creates an order.');
        }
        targetCustomerId = input.customerId;
      }

      // Check customer validity
      const customer = db.customer_profiles.find(cp => cp.id === targetCustomerId);
      if (!customer) {
        throw new OrderError('NOT_FOUND', 'Target customer profile not found.');
      }
      if (customer.approval_status !== 'approved') {
        throw new OrderError('CUSTOMER_NOT_APPROVED', `Customer account is ${customer.approval_status}. Only approved merchants can create fulfillment orders.`);
      }

      // 3. Validate Consignee fields
      const consigneeName = (input.consigneeName || '').trim();
      const consigneePhone = (input.consigneePhone || '').trim();
      const shippingAddress = (input.shippingAddress || '').trim();
      const city = (input.city || '').trim();

      if (!consigneeName) throw new OrderError('VALIDATION_ERROR', 'Consignee Name is required.');
      if (!consigneePhone) throw new OrderError('VALIDATION_ERROR', 'Consignee Phone number is required.');
      if (!shippingAddress) throw new OrderError('VALIDATION_ERROR', 'Shipping Address is required.');
      if (!city) throw new OrderError('VALIDATION_ERROR', 'Destination City is required.');

      // 4. Validate Line Items
      if (!input.items || input.items.length === 0) {
        throw new OrderError('VALIDATION_ERROR', 'At least one line item is required.');
      }

      const orderItemsToCreate: Array<{
        product: ProductRow;
        quantity: number;
        unitPrice: number;
      }> = [];

      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const qty = Math.floor(Number(item.quantity));
        if (isNaN(qty) || qty <= 0) {
          throw new OrderError('VALIDATION_ERROR', `Line item #${i + 1} has invalid quantity (${item.quantity}). Quantity must be at least 1.`);
        }

        let product: ProductRow | undefined;
        if (item.productId) {
          product = db.products.find(p => p.id === item.productId && p.customer_id === targetCustomerId);
        } else if (item.sku) {
          const searchSku = item.sku.trim().toLowerCase();
          product = db.products.find(p => p.sku.toLowerCase() === searchSku && p.customer_id === targetCustomerId);
        }

        if (!product) {
          throw new OrderError('VALIDATION_ERROR', `Product specified in line item #${i + 1} not found or does not belong to this merchant.`);
        }

        if (product.status === 'archived') {
          throw new OrderError('VALIDATION_ERROR', `Product "${product.name}" (${product.sku}) is archived and cannot be ordered.`);
        }

        const unitPrice = item.unitPrice !== undefined && item.unitPrice >= 0 
          ? Number(item.unitPrice) 
          : Number(product.declared_value || 0);

        orderItemsToCreate.push({
          product,
          quantity: qty,
          unitPrice
        });
      }

      // 5. Determine Initial Status
      let initialStatus: FulfillmentOrderStatus = 'placed';
      let confirmedByUserId: string | undefined;
      let confirmedByName: string | undefined;
      let confirmedAt: string | undefined;

      const canConfirm = isAdmin || actor.permissions.includes('orders.confirm');
      if (input.autoConfirm && canConfirm && actor.accountType === 'staff') {
        initialStatus = 'confirmed';
        confirmedByUserId = actor.id;
        confirmedByName = actor.name;
        confirmedAt = new Date().toISOString();
      }

      const now = new Date().toISOString();
      const orderId = `order_${generateId()}`;
      const orderNumber = this.generateOrderNumber(db);

      const codAmount = Math.max(0, Number(input.codAmount || 0));
      const paymentMethod = input.paymentMethod || (codAmount > 0 ? 'cod' : 'prepaid');

      let declaredTotalValue = 0;
      for (const item of orderItemsToCreate) {
        declaredTotalValue += item.quantity * item.unitPrice;
      }

      // Create Order Record
      const newOrder: FulfillmentOrderRow = {
        id: orderId,
        order_number: orderNumber,
        customer_id: targetCustomerId,
        customer_reference: input.customerReference?.trim() || undefined,
        status: initialStatus,
        consignee_name: consigneeName,
        consignee_phone: consigneePhone,
        consignee_email: input.consigneeEmail?.trim() || undefined,
        shipping_address: shippingAddress,
        city: city,
        province: input.province?.trim() || undefined,
        postal_code: input.postalCode?.trim() || undefined,
        cod_amount: codAmount,
        payment_method: paymentMethod,
        declared_total_value: declaredTotalValue,
        shipping_notes: input.shippingNotes?.trim() || undefined,
        created_by_user_id: actor.id,
        created_by_name: actor.name,
        confirmed_by_user_id: confirmedByUserId,
        confirmed_by_name: confirmedByName,
        confirmed_at: confirmedAt,
        created_at: now,
        updated_at: now
      };

      db.fulfillment_orders.push(newOrder);
      upsertOrderRecord(newOrder).catch(e => console.warn('[ORDER] Upsert error:', e));

      // Create Line Items Records
      for (const item of orderItemsToCreate) {
        const lineItemId = `item_${generateId()}`;
        const newLineItem: FulfillmentOrderItemRow = {
          id: lineItemId,
          order_id: orderId,
          product_id: item.product.id,
          sku: item.product.sku,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.quantity * item.unitPrice,
          created_at: now
        };
        db.fulfillment_order_items.push(newLineItem);
      }

      // Log system audit
      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'ORDER_CREATED',
        entityType: 'fulfillment_order',
        entityId: orderId,
        metadata: {
          orderNumber,
          customerId: targetCustomerId,
          status: initialStatus,
          itemCount: orderItemsToCreate.length,
          totalPieces: orderItemsToCreate.reduce((sum, i) => sum + i.quantity, 0),
          codAmount
        }
      });

      return {
        order: newOrder,
        itemsCount: orderItemsToCreate.length
      };
    });
  }

  /**
   * Multi-Step CSV Parser & Validator
   * Parses CSV input, normalizes columns, aggregates multi-item orders, and checks SKUs & stock
   */
  public async previewCsvImport(
    actor: ActorContext,
    csvContent: string,
    customerIdOverride?: string
  ): Promise<CsvPreviewResult> {
    const db = await getFreshDb();

    // 1. Resolve Customer
    let targetCustomerId: string;
    if (actor.accountType === 'customer') {
      if (!actor.customerProfileId) {
        throw new OrderError('UNAUTHORIZED', 'Customer profile not found for this user.');
      }
      targetCustomerId = actor.customerProfileId;
    } else {
      if (!customerIdOverride) {
        throw new OrderError('VALIDATION_ERROR', 'Target customer must be selected for staff CSV import.');
      }
      targetCustomerId = customerIdOverride;
    }

    const customer = db.customer_profiles.find(c => c.id === targetCustomerId);
    if (!customer) {
      throw new OrderError('NOT_FOUND', 'Target customer profile not found.');
    }
    if (customer.approval_status !== 'approved') {
      throw new OrderError('CUSTOMER_NOT_APPROVED', 'Customer account must be approved to import orders.');
    }

    // 2. Fetch customer's active products map
    const customerProducts = db.products.filter(p => p.customer_id === targetCustomerId);
    const skuMap = new Map<string, ProductRow>();
    for (const p of customerProducts) {
      skuMap.set(p.sku.toLowerCase().trim(), p);
    }

    // 3. Parse CSV rows
    const lines = csvContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length < 2) {
      throw new OrderError('INVALID_CSV', 'CSV file must contain a header row and at least one data row.');
    }

    // Simple robust CSV line splitter taking quotes into account
    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let insideQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          insideQuotes = !insideQuotes;
        } else if ((char === ',' || char === '\t') && !insideQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const headerRow = parseCsvLine(lines[0]);
    const headers = headerRow.map(h => h.toLowerCase().replace(/[\s_-]+/g, ''));

    // Map column aliases
    const findColIndex = (...aliases: string[]) => {
      for (const alias of aliases) {
        const idx = headers.findIndex(h => h === alias || h.includes(alias));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const colRef = findColIndex('customerreference', 'orderid', 'ordernumber', 'referencenumber', 'ref', 'order');
    const colName = findColIndex('consigneename', 'customername', 'recipientname', 'receivername', 'consignee', 'name');
    const colPhone = findColIndex('consigneephone', 'phone', 'contact', 'mobile', 'cell', 'tele');
    const colEmail = findColIndex('consigneeemail', 'email');
    const colAddress = findColIndex('shippingaddress', 'deliveryaddress', 'address', 'street');
    const colCity = findColIndex('city', 'destinationcity', 'town');
    const colProvince = findColIndex('province', 'state');
    const colPostal = findColIndex('postalcode', 'zipcode', 'zip', 'postal');
    const colCod = findColIndex('codamount', 'cod', 'cashondelivery', 'orderamount', 'amount', 'total');
    const colPayment = findColIndex('paymentmethod', 'payment', 'type');
    const colNotes = findColIndex('shippingnotes', 'instructions', 'remarks', 'notes', 'comment');
    const colSku = findColIndex('sku', 'productsku', 'itemcode', 'itemsku', 'productcode');
    const colQty = findColIndex('quantity', 'qty', 'pieces', 'count', 'units');
    const colPrice = findColIndex('unitprice', 'price', 'declaredvalue', 'rate');

    if (colName === -1 || colPhone === -1 || colAddress === -1 || colCity === -1 || colSku === -1) {
      const missing = [];
      if (colName === -1) missing.push('Consignee Name');
      if (colPhone === -1) missing.push('Phone');
      if (colAddress === -1) missing.push('Shipping Address');
      if (colCity === -1) missing.push('City');
      if (colSku === -1) missing.push('SKU');
      throw new OrderError(
        'MISSING_REQUIRED_HEADERS',
        `CSV is missing mandatory columns: ${missing.join(', ')}. Please verify the header row.`
      );
    }

    // 4. Process and group data rows
    interface RawRowData {
      rowNumber: number;
      ref: string;
      name: string;
      phone: string;
      email?: string;
      address: string;
      city: string;
      province?: string;
      postal?: string;
      cod: number;
      payment: 'cod' | 'prepaid';
      notes?: string;
      sku: string;
      qty: number;
      price?: number;
    }

    const rawRows: RawRowData[] = [];
    for (let r = 1; r < lines.length; r++) {
      const cols = parseCsvLine(lines[r]);
      if (cols.length === 0 || cols.every(c => !c)) continue; // skip blank line

      const ref = colRef !== -1 ? cols[colRef] || '' : '';
      const name = cols[colName] || '';
      const phone = cols[colPhone] || '';
      const email = colEmail !== -1 ? cols[colEmail] : undefined;
      const address = cols[colAddress] || '';
      const city = cols[colCity] || '';
      const province = colProvince !== -1 ? cols[colProvince] : undefined;
      const postal = colPostal !== -1 ? cols[colPostal] : undefined;
      
      const rawCod = colCod !== -1 ? cols[colCod] : '0';
      const codNum = parseFloat(rawCod.replace(/[^0-9.-]+/g, '')) || 0;
      
      const rawPayment = colPayment !== -1 ? cols[colPayment]?.toLowerCase() : '';
      const payment: 'cod' | 'prepaid' = rawPayment.includes('prepaid') ? 'prepaid' : 'cod';

      const notes = colNotes !== -1 ? cols[colNotes] : undefined;
      const sku = cols[colSku] || '';
      const rawQty = colQty !== -1 ? cols[colQty] : '1';
      const qty = parseInt(rawQty.replace(/[^0-9]+/g, ''), 10) || 1;

      const rawPrice = colPrice !== -1 ? cols[colPrice] : undefined;
      const price = rawPrice ? parseFloat(rawPrice.replace(/[^0-9.-]+/g, '')) : undefined;

      rawRows.push({
        rowNumber: r + 1,
        ref,
        name,
        phone,
        email,
        address,
        city,
        province,
        postal,
        cod: codNum,
        payment,
        notes,
        sku,
        qty,
        price
      });
    }

    // 5. Group by customer reference if present, otherwise row by row
    const orderGroups: Map<string, RawRowData[]> = new Map();

    rawRows.forEach((row, idx) => {
      let groupKey: string;
      if (row.ref && row.ref.trim().length > 0) {
        // Group by customerReference
        groupKey = `ref_${row.ref.trim().toLowerCase()}`;
      } else {
        // Standalone order per row
        groupKey = `row_${idx}`;
      }

      if (!orderGroups.has(groupKey)) {
        orderGroups.set(groupKey, []);
      }
      orderGroups.get(groupKey)!.push(row);
    });

    // 6. Validate each order group
    const parsedOrders: CsvOrderPreview[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let totalPieces = 0;
    let totalCod = 0;

    orderGroups.forEach((rows, groupKey) => {
      const primaryRow = rows[0];
      const errors: Array<{ field: string; message: string; hint: string }> = [];
      const warnings: string[] = [];

      // Consignee validations
      if (!primaryRow.name || primaryRow.name.trim().length < 2) {
        errors.push({
          field: 'consignee_name',
          message: 'Recipient name is missing or too short',
          hint: 'Provide full recipient name (e.g. "Ahmed Khan")'
        });
      }

      if (!primaryRow.phone || primaryRow.phone.replace(/[^0-9]/g, '').length < 8) {
        errors.push({
          field: 'consignee_phone',
          message: 'Invalid phone number format',
          hint: 'Provide Pakistani mobile number (e.g. 03001234567)'
        });
      }

      if (!primaryRow.address || primaryRow.address.trim().length < 5) {
        errors.push({
          field: 'shipping_address',
          message: 'Delivery address is incomplete or too short',
          hint: 'Provide house, street, area, and landmark'
        });
      }

      if (!primaryRow.city || primaryRow.city.trim().length < 2) {
        errors.push({
          field: 'city',
          message: 'Destination city is missing',
          hint: 'Provide valid city name (e.g. Lahore, Karachi, Islamabad)'
        });
      }

      if (primaryRow.cod < 0) {
        errors.push({
          field: 'cod_amount',
          message: 'COD amount cannot be negative',
          hint: 'Enter 0 for prepaid orders, or positive PKR amount'
        });
      }

      // Validate items in this group
      const previewItems: CsvOrderItemPreview[] = [];
      let orderPieces = 0;
      let orderDeclaredTotal = 0;

      for (const itemRow of rows) {
        const skuKey = itemRow.sku.trim().toLowerCase();
        const product = skuMap.get(skuKey);

        let itemValid = true;
        let itemError: string | undefined;

        if (!itemRow.sku || itemRow.sku.trim().length === 0) {
          itemValid = false;
          itemError = `Missing SKU in row ${itemRow.rowNumber}`;
          errors.push({
            field: 'sku',
            message: `Empty SKU on line ${itemRow.rowNumber}`,
            hint: 'Ensure SKU column is filled with an existing product code'
          });
        } else if (!product) {
          itemValid = false;
          itemError = `SKU "${itemRow.sku}" not found for this merchant`;
          errors.push({
            field: 'sku',
            message: `SKU "${itemRow.sku}" does not exist in your catalog`,
            hint: 'Register this SKU in Product Catalog first or correct spelling'
          });
        }

        if (itemRow.qty <= 0) {
          itemValid = false;
          itemError = `Quantity must be >= 1`;
          errors.push({
            field: 'quantity',
            message: `Invalid quantity "${itemRow.qty}" on line ${itemRow.rowNumber}`,
            hint: 'Quantity must be at least 1 piece'
          });
        }

        const stockSummary = product ? this.getProductStockSummary(db, product.id) : { availableToFulfill: 0 };
        const unitPrice = itemRow.price !== undefined && itemRow.price >= 0
          ? itemRow.price
          : (product ? Number(product.declared_value || 0) : 0);

        if (product && stockSummary.availableToFulfill < itemRow.qty) {
          warnings.push(
            `SKU ${product.sku}: Ordered ${itemRow.qty}, but currently only ${stockSummary.availableToFulfill} unit(s) are In Storage.`
          );
        }

        previewItems.push({
          sku: product ? product.sku : itemRow.sku,
          productName: product ? product.name : 'Unknown Product',
          productId: product ? product.id : '',
          quantity: itemRow.qty,
          unitPrice,
          availableStock: stockSummary.availableToFulfill,
          isValid: itemValid,
          error: itemError
        });

        orderPieces += itemRow.qty;
        orderDeclaredTotal += itemRow.qty * unitPrice;
      }

      const isValid = errors.length === 0 && previewItems.every(i => i.isValid);

      if (isValid) {
        validCount++;
        totalPieces += orderPieces;
        totalCod += primaryRow.cod;
      } else {
        invalidCount++;
      }

      parsedOrders.push({
        tempId: `tmp_${groupKey}`,
        rowIndices: rows.map(r => r.rowNumber),
        customerReference: primaryRow.ref ? primaryRow.ref.trim() : undefined,
        consigneeName: primaryRow.name.trim(),
        consigneePhone: primaryRow.phone.trim(),
        consigneeEmail: primaryRow.email ? primaryRow.email.trim() : undefined,
        shippingAddress: primaryRow.address.trim(),
        city: primaryRow.city.trim(),
        province: primaryRow.province ? primaryRow.province.trim() : undefined,
        postalCode: primaryRow.postal ? primaryRow.postal.trim() : undefined,
        codAmount: primaryRow.cod,
        paymentMethod: primaryRow.payment,
        shippingNotes: primaryRow.notes ? primaryRow.notes.trim() : undefined,
        items: previewItems,
        totalPieces: orderPieces,
        totalDeclaredValue: orderDeclaredTotal,
        isValid,
        errors,
        warnings
      });
    });

    return {
      summary: {
        totalRows: rawRows.length,
        totalOrders: parsedOrders.length,
        validOrdersCount: validCount,
        invalidOrdersCount: invalidCount,
        totalPieces,
        totalCodAmount: totalCod
      },
      customerId: targetCustomerId,
      customerName: customer.brand_name || customer.business_name,
      orders: parsedOrders,
      canCommit: validCount > 0
    };
  }

  /**
   * Commit Valid CSV Orders to Database
   */
  public async commitCsvImport(
    actor: ActorContext,
    previewData: CsvPreviewResult,
    options: { skipInvalid?: boolean } = {}
  ) {
    return withTransaction(async (db) => {
      const isAdmin = actor.roleId === 'role_administrator';
      const canCreate = isAdmin || actor.permissions.includes('orders.create');
      if (!canCreate) {
        throw new OrderError('FORBIDDEN', 'You do not have permission to import fulfill orders.');
      }

      const targetCustomerId = previewData.customerId;
      const customer = db.customer_profiles.find(c => c.id === targetCustomerId);
      if (!customer || customer.approval_status !== 'approved') {
        throw new OrderError('CUSTOMER_NOT_APPROVED', 'Customer account is not approved.');
      }

      // Filter orders to commit
      const ordersToCommit = previewData.orders.filter(o => o.isValid);
      if (ordersToCommit.length === 0) {
        throw new OrderError('NO_VALID_ORDERS', 'There are no valid orders to import.');
      }

      if (!options.skipInvalid && previewData.summary.invalidOrdersCount > 0) {
        throw new OrderError(
          'CONTAINS_ERRORS',
          `Cannot import: ${previewData.summary.invalidOrdersCount} order(s) contain validation errors. Please correct them or check "Skip invalid orders".`
        );
      }

      const now = new Date().toISOString();
      const createdOrderNumbers: string[] = [];
      let totalPiecesImported = 0;

      for (const orderData of ordersToCommit) {
        const orderId = `order_${generateId()}`;
        const orderNumber = this.generateOrderNumber(db);

        const newOrder: FulfillmentOrderRow = {
          id: orderId,
          order_number: orderNumber,
          customer_id: targetCustomerId,
          customer_reference: orderData.customerReference,
          status: 'placed',
          consignee_name: orderData.consigneeName,
          consignee_phone: orderData.consigneePhone,
          consignee_email: orderData.consigneeEmail,
          shipping_address: orderData.shippingAddress,
          city: orderData.city,
          province: orderData.province,
          postal_code: orderData.postalCode,
          cod_amount: orderData.codAmount,
          payment_method: orderData.paymentMethod,
          declared_total_value: orderData.totalDeclaredValue,
          shipping_notes: orderData.shippingNotes,
          created_by_user_id: actor.id,
          created_by_name: actor.name,
          created_at: now,
          updated_at: now
        };

        db.fulfillment_orders.push(newOrder);
        createdOrderNumbers.push(orderNumber);
        upsertOrderRecord(newOrder).catch(e => console.warn('[ORDER] Upsert error:', e));

        for (const itemData of orderData.items) {
          const lineItemId = `item_${generateId()}`;
          const newLineItem: FulfillmentOrderItemRow = {
            id: lineItemId,
            order_id: orderId,
            product_id: itemData.productId,
            sku: itemData.sku,
            product_name: itemData.productName,
            quantity: itemData.quantity,
            unit_price: itemData.unitPrice,
            total_price: itemData.quantity * itemData.unitPrice,
            created_at: now
          };
          db.fulfillment_order_items.push(newLineItem);
          totalPiecesImported += itemData.quantity;
        }
      }

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'ORDER_BULK_CSV_IMPORTED',
        entityType: 'fulfillment_order',
        entityId: null,
        metadata: {
          customerId: targetCustomerId,
          importedOrdersCount: ordersToCommit.length,
          totalPiecesImported,
          createdOrderNumbers
        }
      });

      return {
        importedCount: ordersToCommit.length,
        skippedCount: previewData.summary.invalidOrdersCount,
        createdOrderNumbers
      };
    });
  }

  /**
   * Explicit Confirmation: Transitions order from `placed` to `confirmed`
   * Dedicated confirmation queue requirement from PROJECT_VISION.md
   */
  public async confirmOrder(actor: ActorContext, orderId: string) {
    return withTransaction(async (db) => {
      const isAdmin = actor.roleId === 'role_administrator';
      const canConfirm = isAdmin || actor.permissions.includes('orders.confirm');
      if (!canConfirm) {
        throw new OrderError('FORBIDDEN', 'You do not have permission to confirm fulfillment orders.');
      }

      const order = db.fulfillment_orders.find(o => o.id === orderId);
      if (!order) {
        throw new OrderError('NOT_FOUND', 'Order not found.');
      }

      if (order.status !== 'placed') {
        throw new OrderError(
          'INVALID_STATE',
          `Cannot confirm order with status "${order.status}". Only orders in "placed" status can be confirmed.`
        );
      }

      const now = new Date().toISOString();
      order.status = 'confirmed';
      order.confirmed_by_user_id = actor.id;
      order.confirmed_by_name = actor.name;
      order.confirmed_at = now;
      order.updated_at = now;
      upsertOrderRecord(order).catch(e => console.warn('[ORDER] Upsert error:', e));

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'ORDER_CONFIRMED',
        entityType: 'fulfillment_order',
        entityId: orderId,
        metadata: {
          orderNumber: order.order_number,
          customerId: order.customer_id,
          confirmedBy: actor.name
        }
      });

      return order;
    });
  }

  /**
   * Bulk Confirm Orders in Queue
   */
  public async bulkConfirmOrders(actor: ActorContext, orderIds: string[]) {
    return withTransaction(async (db) => {
      const isAdmin = actor.roleId === 'role_administrator';
      const canConfirm = isAdmin || actor.permissions.includes('orders.confirm');
      if (!canConfirm) {
        throw new OrderError('FORBIDDEN', 'You do not have permission to confirm fulfillment orders.');
      }

      const now = new Date().toISOString();
      let confirmedCount = 0;
      const failed: Array<{ orderId: string; reason: string }> = [];

      for (const orderId of orderIds) {
        const order = db.fulfillment_orders.find(o => o.id === orderId);
        if (!order) {
          failed.push({ orderId, reason: 'Order not found' });
          continue;
        }

        if (order.status !== 'placed') {
          failed.push({ orderId, reason: `Invalid status: ${order.status}` });
          continue;
        }

        order.status = 'confirmed';
        order.confirmed_by_user_id = actor.id;
        order.confirmed_by_name = actor.name;
        order.confirmed_at = now;
        order.updated_at = now;
        confirmedCount++;
        upsertOrderRecord(order).catch(e => console.warn('[ORDER] Upsert error:', e));
      }

      if (confirmedCount > 0) {
        logAudit({
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'ORDER_BULK_CONFIRMED',
          entityType: 'fulfillment_order',
          entityId: null,
          metadata: {
            confirmedCount,
            attemptedCount: orderIds.length
          }
        });
      }

      return {
        confirmedCount,
        failedCount: failed.length,
        failed
      };
    });
  }

  /**
   * Cancel an order (with mandatory cancellation reason)
   */
  public async cancelOrder(actor: ActorContext, orderId: string, reason: string) {
    return withTransaction(async (db) => {
      const order = db.fulfillment_orders.find(o => o.id === orderId);
      if (!order) {
        throw new OrderError('NOT_FOUND', 'Order not found.');
      }

      // Check permission: Staff with orders.cancel or Customer cancelling their own placed order
      const isAdmin = actor.roleId === 'role_administrator';
      const hasCancelPerm = isAdmin || actor.permissions.includes('orders.cancel');
      const isOwner = actor.accountType === 'customer' && order.customer_id === actor.customerProfileId;

      if (!hasCancelPerm && !(isOwner && order.status === 'placed')) {
        throw new OrderError('FORBIDDEN', 'You do not have permission to cancel this order.');
      }

      if (['picked', 'packed', 'fulfilled'].includes(order.status)) {
        throw new OrderError(
          'INVALID_STATE',
          `Cannot cancel order in "${order.status}" status. Physical fulfillment has already progressed.`
        );
      }

      if (order.status === 'cancelled') {
        throw new OrderError('ALREADY_CANCELLED', 'This order is already cancelled.');
      }

      const trimReason = (reason || '').trim();
      if (!trimReason) {
        throw new OrderError('VALIDATION_ERROR', 'A cancellation reason is required.');
      }

      const now = new Date().toISOString();
      order.status = 'cancelled';
      order.cancelled_by_user_id = actor.id;
      order.cancelled_by_name = actor.name;
      order.cancelled_at = now;
      order.cancellation_reason = trimReason;
      order.updated_at = now;
      upsertOrderRecord(order).catch(e => console.warn('[ORDER] Upsert error:', e));

      // In case any inventory units were allocated or reserved, release them
      const linkedUnits = db.inventory_units.filter(u => u.order_id === orderId);
      for (const unit of linkedUnits) {
        unit.order_id = null;
        unit.order_item_id = null;
        if (unit.state === 'reserved') {
          unit.state = 'in_storage';
          unit.updated_at = now;
        }
      }

      logAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'ORDER_CANCELLED',
        entityType: 'fulfillment_order',
        entityId: orderId,
        metadata: {
          orderNumber: order.order_number,
          reason: trimReason,
          cancelledBy: actor.name
        }
      });

      return order;
    });
  }

  /**
   * List fulfillment orders with rich filtering & stock status indicators
   */
  public async listOrders(actor: ActorContext, filters: OrderFilterOptions = {}) {
    const db = await getFreshDb();

    let orders = [...db.fulfillment_orders];

    // Customer multi-tenant isolation
    if (actor.accountType === 'customer') {
      const custId = actor.customerProfileId;
      orders = orders.filter(o => o.customer_id === custId);
    } else if (filters.customerId) {
      orders = orders.filter(o => o.customer_id === filters.customerId);
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      orders = orders.filter(o => o.status === filters.status);
    }

    // City filter
    if (filters.city) {
      const cityLower = filters.city.toLowerCase().trim();
      orders = orders.filter(o => o.city?.toLowerCase().includes(cityLower));
    }

    // Payment method filter
    if (filters.paymentMethod) {
      orders = orders.filter(o => o.payment_method === filters.paymentMethod);
    }

    // Date range filter
    if (filters.startDate) {
      orders = orders.filter(o => o.created_at >= filters.startDate!);
    }
    if (filters.endDate) {
      orders = orders.filter(o => o.created_at <= filters.endDate!);
    }

    // Free text search (order_number, consignee_name, consignee_phone, customer_reference, city)
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      orders = orders.filter(o =>
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_reference?.toLowerCase().includes(q) ||
        o.consignee_name?.toLowerCase().includes(q) ||
        o.consignee_phone?.toLowerCase().includes(q) ||
        o.city?.toLowerCase().includes(q)
      );
    }

    // Sort by created_at DESC
    orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Enrich with Customer profile and items summary
    const customerMap = new Map(db.customer_profiles.map(cp => [cp.id, cp]));
    const itemsByOrderId = new Map<string, FulfillmentOrderItemRow[]>();
    for (const item of db.fulfillment_order_items) {
      if (!itemsByOrderId.has(item.order_id)) {
        itemsByOrderId.set(item.order_id, []);
      }
      itemsByOrderId.get(item.order_id)!.push(item);
    }

    const enrichedOrders = orders.map(order => {
      const customer = customerMap.get(order.customer_id);
      const items = itemsByOrderId.get(order.id) || [];
      const totalPieces = items.reduce((sum, i) => sum + i.quantity, 0);

      // Check stock adequacy for each line item
      let isStockSufficient = true;
      let hasAnyStock = false;

      for (const item of items) {
        const inStorage = db.inventory_units.filter(
          u => u.product_id === item.product_id && u.state === 'in_storage' && u.condition === 'good'
        ).length;
        if (inStorage < item.quantity) {
          isStockSufficient = false;
        }
        if (inStorage > 0) {
          hasAnyStock = true;
        }
      }

      const stockStatus = isStockSufficient
        ? 'sufficient'
        : hasAnyStock
        ? 'partial'
        : 'out_of_stock';

      return {
        ...order,
        customer_brand: customer?.brand_name || customer?.business_name || 'Unknown Merchant',
        customer_business_name: customer?.business_name || 'Unknown',
        items_count: items.length,
        total_pieces: totalPieces,
        items_preview: items.map(i => `${i.sku} (${i.quantity}x)`).join(', '),
        stock_adequacy: stockStatus
      };
    });

    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, filters.limit || 50);
    const totalCount = enrichedOrders.length;
    const paginatedOrders = enrichedOrders.slice((page - 1) * limit, page * limit);

    return {
      orders: paginatedOrders,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  /**
   * Get complete details of a single order
   */
  public async getOrderDetails(actor: ActorContext, orderId: string) {
    const db = await getFreshDb();
    const order = db.fulfillment_orders.find(o => o.id === orderId);
    if (!order) {
      throw new OrderError('NOT_FOUND', 'Order not found.');
    }

    if (actor.accountType === 'customer' && order.customer_id !== actor.customerProfileId) {
      throw new OrderError('FORBIDDEN', 'Access denied to this order.');
    }

    const customer = db.customer_profiles.find(cp => cp.id === order.customer_id);
    const lineItems = db.fulfillment_order_items.filter(item => item.order_id === order.id);

    // Enrich line items with live stock and product details
    const enrichedItems = lineItems.map(item => {
      const product = db.products.find(p => p.id === item.product_id);
      const stockSummary = this.getProductStockSummary(db, item.product_id);
      return {
        ...item,
        category: product?.category,
        barcode: product?.barcode,
        weight_kg: product?.weight_kg,
        dimensions: product?.dimensions,
        stock_summary: stockSummary,
        stock_sufficient: stockSummary.inStorage >= item.quantity
      };
    });

    // Check if any physical inventory units are currently allocated/associated with this order
    const allocatedUnits = db.inventory_units.filter(u => u.order_id === order.id);

    return {
      order,
      customer: customer ? {
        id: customer.id,
        business_name: customer.business_name,
        brand_name: customer.brand_name,
        phone: customer.phone,
        city: customer.city
      } : null,
      items: enrichedItems,
      allocated_units: allocatedUnits.map(u => ({
        id: u.id,
        tracking_code: u.tracking_code,
        state: u.state,
        location_id: u.location_id
      }))
    };
  }

  /**
   * Filter-aware CSV export of orders
   */
  public async exportOrdersCsv(actor: ActorContext, filters: OrderFilterOptions = {}): Promise<string> {
    const result = await this.listOrders(actor, { ...filters, limit: 10000 });
    const orders = result.orders;

    const headers = [
      'Order Number',
      'Merchant Ref',
      'Merchant Brand',
      'Status',
      'Consignee Name',
      'Consignee Phone',
      'Consignee Email',
      'Shipping Address',
      'City',
      'Province',
      'Postal Code',
      'COD Amount (PKR)',
      'Payment Method',
      'Declared Value (PKR)',
      'Total Pieces',
      'Items Summary',
      'Stock Adequacy',
      'Shipping Notes',
      'Created At',
      'Confirmed At'
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = [headers.join(',')];

    for (const ord of orders) {
      rows.push([
        escapeCsv(ord.order_number),
        escapeCsv(ord.customer_reference || ''),
        escapeCsv(ord.customer_brand),
        escapeCsv(ord.status),
        escapeCsv(ord.consignee_name),
        escapeCsv(ord.consignee_phone),
        escapeCsv(ord.consignee_email || ''),
        escapeCsv(ord.shipping_address),
        escapeCsv(ord.city),
        escapeCsv(ord.province || ''),
        escapeCsv(ord.postal_code || ''),
        ord.cod_amount,
        escapeCsv(ord.payment_method),
        ord.declared_total_value,
        ord.total_pieces,
        escapeCsv(ord.items_preview),
        escapeCsv(ord.stock_adequacy),
        escapeCsv(ord.shipping_notes || ''),
        escapeCsv(ord.created_at),
        escapeCsv(ord.confirmed_at || '')
      ].join(','));
    }

    return rows.join('\r\n');
  }
}

export const orderService = new OrderService();
