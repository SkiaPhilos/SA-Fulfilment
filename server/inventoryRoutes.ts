/**
 * Inventory & Physical Units Router for Ship Asaan
 * Fine-grained RBAC, scan-to-place endpoints, and physical unit tracking.
 */

import { Router, Request, Response } from 'express';
import { inventoryService, InventoryError, ActorContext } from './inventoryService.js';
import { requireAuth, requirePermission } from './middleware.js';
import { getFreshDb, getDb } from './db.js';

export const inventoryRouter = Router();

// All inventory endpoints require a valid session
inventoryRouter.use(requireAuth);

function buildActorContext(req: Request): ActorContext {
  const user = req.user!;
  let customerProfileId: string | null = user.customer_profile_id || null;

  if (!customerProfileId && user.account_type === 'customer') {
    const db = getDb();
    const profile = db.customer_profiles.find((cp) => cp.user_id === user.id);
    customerProfileId = profile ? profile.id : null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.role_id,
    accountType: user.account_type,
    customerProfileId,
    permissions: user.permissions
  };
}

// -------------------------------------------------------------
// Products / SKU Catalog Endpoints
// -------------------------------------------------------------

/**
 * GET /api/inventory/products
 * List products with enriched inventory statistics
 */
inventoryRouter.get('/products', async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const { customerId, search, category, lowStockOnly, status } = req.query;

    const products = await inventoryService.listProducts(actor, {
      customerId: customerId as string,
      search: search as string,
      category: category as string,
      lowStockOnly: lowStockOnly === 'true',
      status: status as 'active' | 'archived'
    });

    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inventory/products
 * Create a new product / SKU
 */
inventoryRouter.post('/products', async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const {
      customerId,
      sku,
      name,
      description,
      category,
      barcode,
      dimensions,
      weight_kg,
      declared_value,
      low_stock_threshold
    } = req.body;

    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU and product name are mandatory.' });
    }

    if (actor.accountType === 'staff' && !customerId) {
      return res.status(400).json({ error: 'Customer / Merchant selection is required for staff creation.' });
    }

    const product = await inventoryService.createProduct(actor, {
      customerId: actor.accountType === 'customer' ? actor.customerProfileId! : customerId,
      sku,
      name,
      description,
      category,
      barcode,
      dimensions,
      weight_kg: Number(weight_kg) || 0,
      declared_value: Number(declared_value) || 0,
      low_stock_threshold: Number(low_stock_threshold) || 10
    });

    res.status(201).json({ product, message: `Product SKU ${product.sku} created successfully.` });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/inventory/products/:id
 * Update product details
 */
inventoryRouter.put('/products/:id', async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const product = await inventoryService.updateProduct(actor, req.params.id, req.body);
    res.json({ product, message: `Product ${product.sku} updated successfully.` });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Stock Receiving Endpoints (Intake & Unit Generation)
// -------------------------------------------------------------

/**
 * POST /api/inventory/receive
 * Receive a batch of stock and generate physical units
 */
inventoryRouter.post('/receive', requirePermission('inventory.receive'), async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const { warehouseId, customerId, carrier, trackingReference, items } = req.body;

    if (!warehouseId || !customerId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Warehouse ID, Customer ID, and items array are required.' });
    }

    const result = await inventoryService.receiveStock(actor, {
      warehouseId,
      customerId,
      carrier,
      trackingReference,
      items
    });

    res.status(201).json({
      batch: result.batch,
      unitsCreated: result.units.length,
      sampleUnits: result.units.slice(0, 10),
      message: `Intake batch ${result.batch.batch_number} successfully registered. Generated ${result.units.length} physical unit codes.`
    });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inventory/batches
 * List stock intake batches
 */
inventoryRouter.get('/batches', async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const batches = await inventoryService.listBatches(actor, req.query.customerId as string);
    res.json({ batches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Physical Inventory Units Endpoints
// -------------------------------------------------------------

/**
 * GET /api/inventory/units
 * List physical inventory units with pagination and search
 */
inventoryRouter.get('/units', async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const {
      customerId,
      productId,
      warehouseId,
      locationId,
      batchId,
      state,
      search,
      limit,
      offset
    } = req.query;

    const result = await inventoryService.listUnits(actor, {
      customerId: customerId as string,
      productId: productId as string,
      warehouseId: warehouseId as string,
      locationId: locationId as string,
      batchId: batchId as string,
      state: state as any,
      search: search as string,
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : 0
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inventory/stock-scan
 * Interactive Scan-to-Place Putaway into warehouse location
 */
inventoryRouter.post('/stock-scan', requirePermission('inventory.stock'), async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const { unitTrackingCode, locationCodeOrBarcode } = req.body;

    if (!unitTrackingCode || !locationCodeOrBarcode) {
      return res.status(400).json({ error: 'Both unitTrackingCode and locationCodeOrBarcode are required for scan putaway.' });
    }

    const result = await inventoryService.stockUnitScan(actor, {
      unitTrackingCode,
      locationCodeOrBarcode
    });

    res.json(result);
  } catch (err: any) {
    if (err instanceof InventoryError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inventory/move
 * Relocate unit between physical locations
 */
inventoryRouter.post('/move', requirePermission('inventory.move'), async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const { unitId, toLocationId, notes } = req.body;

    if (!unitId || !toLocationId) {
      return res.status(400).json({ error: 'unitId and toLocationId are required.' });
    }

    const result = await inventoryService.moveUnit(actor, { unitId, toLocationId, notes });
    res.json({
      ...result,
      message: `Unit ${result.unit.tracking_code} relocated to ${result.toLocation.code} successfully.`
    });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inventory/adjust
 * Adjust physical unit condition or state
 */
inventoryRouter.post('/adjust', requirePermission('inventory.adjust'), async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const { unitId, condition, state, notes } = req.body;

    if (!unitId || !notes) {
      return res.status(400).json({ error: 'unitId and mandatory audit note are required for adjustment.' });
    }

    const unit = await inventoryService.adjustUnit(actor, { unitId, condition, state, notes });
    res.json({ unit, message: `Unit ${unit.tracking_code} adjustment recorded.` });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inventory/ledger
 * View immutable inventory transaction ledger
 */
inventoryRouter.get('/ledger', async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const { customerId, unitId, productId, type, limit } = req.query;

    const ledger = await inventoryService.getLedger(actor, {
      customerId: customerId as string,
      unitId: unitId as string,
      productId: productId as string,
      type: type as any,
      limit: limit ? parseInt(limit as string, 10) : 100
    });

    res.json({ ledger });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inventory/labels
 * Batch fetch printable label metadata for units
 */
inventoryRouter.post('/labels', async (req: Request, res: Response) => {
  try {
    const { unitIds, batchId, productId } = req.body;
    const db = await getFreshDb();

    let targetUnits = db.inventory_units;
    if (batchId) {
      targetUnits = targetUnits.filter((u) => u.batch_id === batchId);
    } else if (productId) {
      targetUnits = targetUnits.filter((u) => u.product_id === productId && ['in_storage', 'awaiting_stocking'].includes(u.state));
    } else if (Array.isArray(unitIds) && unitIds.length > 0) {
      const idSet = new Set(unitIds);
      targetUnits = targetUnits.filter((u) => idSet.has(u.id) || idSet.has(u.tracking_code));
    } else {
      return res.status(400).json({ error: 'Either batchId, productId, or unitIds array must be provided.' });
    }

    const prodMap = new Map(db.products.map((p) => [p.id, p]));
    const custMap = new Map(db.customer_profiles.map((c) => [c.id, c]));

    const labels = targetUnits.map((u) => {
      const prod = prodMap.get(u.product_id);
      const cust = custMap.get(u.customer_id);

      return {
        unitId: u.id,
        trackingCode: u.tracking_code,
        productName: prod?.name || 'Item',
        productSku: prod?.sku || 'SKU',
        customerBrand: cust?.brand_name || 'Ship Asaan',
        receivedAt: u.received_at,
        condition: u.condition,
        barcodeValue: u.tracking_code,
        qrPayload: JSON.stringify({
          t: u.tracking_code,
          s: prod?.sku,
          b: u.batch_id
        })
      };
    });

    res.json({ labels });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
