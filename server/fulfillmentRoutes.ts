import { Router, Request, Response } from 'express';
import { requireAuth } from './middleware.js';
import { fulfillmentService, FulfillmentError, ActorContext } from './fulfillmentService.js';
import { getDb } from './db.js';

export const fulfillmentRouter = Router();

// All fulfillment routes require authentication
fulfillmentRouter.use(requireAuth);

function extractActor(req: Request): ActorContext {
  const user = req.user!;
  let customerProfileId: string | null = user.customer_profile_id || null;

  if (!customerProfileId && user.account_type === 'customer') {
    const db = getDb();
    const profile = db.customer_profiles.find(cp => cp.user_id === user.id);
    customerProfileId = profile ? profile.id : null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleId: user.role_id,
    permissions: user.permissions || [],
    accountType: user.account_type,
    customerProfileId
  };
}

/**
 * 7.1: POST /api/fulfillment/prepare
 * Allocate physical stock and transition confirmed orders to 'to_fulfill'
 */
fulfillmentRouter.post('/prepare', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds must be a non-empty array of order IDs.' });
    }

    const result = await fulfillmentService.prepareFulfillment(actor, orderIds);
    return res.json({
      success: true,
      message: `Prepared ${result.preparedCount} order(s) for fulfillment.`,
      result
    });
  } catch (err: any) {
    if (err instanceof FulfillmentError) {
      const status = err.code === 'FORBIDDEN' ? 403 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Fulfillment] Error preparing fulfillment:', err);
    return res.status(500).json({ error: 'Internal server error while preparing fulfillment.' });
  }
});

/**
 * 7.3: POST /api/fulfillment/batches
 * Create a new Picking Batch for to_fulfill orders
 */
fulfillmentRouter.post('/batches', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds must be a non-empty array.' });
    }

    const batch = await fulfillmentService.createPickingBatch(actor, orderIds);
    return res.status(201).json({
      success: true,
      message: `Picking batch ${batch.batch_number} created successfully.`,
      batch
    });
  } catch (err: any) {
    if (err instanceof FulfillmentError) {
      const status = err.code === 'FORBIDDEN' ? 403 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Fulfillment] Error creating picking batch:', err);
    return res.status(500).json({ error: 'Failed to create picking batch.' });
  }
});

/**
 * GET /api/fulfillment/batches
 * List picking batches
 */
fulfillmentRouter.get('/batches', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const batches = await fulfillmentService.listPickingBatches(actor);
    return res.json({ batches });
  } catch (err: any) {
    console.error('[Fulfillment] Error listing picking batches:', err);
    return res.status(500).json({ error: 'Failed to list picking batches.' });
  }
});

/**
 * 7.4: GET /api/fulfillment/batches/:id
 * Get picking batch details and location-sorted pick sheet
 */
fulfillmentRouter.get('/batches/:id', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const details = await fulfillmentService.getPickingBatchDetails(actor, req.params.id);
    return res.json(details);
  } catch (err: any) {
    if (err instanceof FulfillmentError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Fulfillment] Error getting batch details:', err);
    return res.status(500).json({ error: 'Failed to get picking batch details.' });
  }
});

/**
 * 7.3: POST /api/fulfillment/pick-scan
 * Interactive scan-out of a physical inventory unit out of shelf storage
 */
fulfillmentRouter.post('/pick-scan', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const { unitTrackingCode, batchId, orderId } = req.body;

    if (!unitTrackingCode) {
      return res.status(400).json({ error: 'unitTrackingCode is required.' });
    }

    const result = await fulfillmentService.pickUnitScan(actor, {
      unitTrackingCode,
      batchId,
      orderId
    });

    return res.json({
      success: true,
      message: `Unit ${result.unit.tracking_code} (${result.unit.sku}) picked successfully.`,
      result
    });
  } catch (err: any) {
    if (err instanceof FulfillmentError) {
      const status = err.code === 'FORBIDDEN' ? 403 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Fulfillment] Error during unit pick scan:', err);
    return res.status(500).json({ error: 'Failed to process pick scan.' });
  }
});

/**
 * 7.6: POST /api/fulfillment/pack-scan
 * Mandatory Scan-to-Pack Station: scan order/package barcode to verify & pack
 */
fulfillmentRouter.post('/pack-scan', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const { orderBarcode } = req.body;

    if (!orderBarcode) {
      return res.status(400).json({ error: 'orderBarcode is required.' });
    }

    const result = await fulfillmentService.packOrderScan(actor, orderBarcode);
    return res.json({
      success: true,
      message: `Order ${result.order.order_number} verified and marked as Packed.`,
      result
    });
  } catch (err: any) {
    if (err instanceof FulfillmentError) {
      const status = err.code === 'FORBIDDEN' ? 403 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Fulfillment] Error during pack scan:', err);
    return res.status(500).json({ error: 'Failed to process pack scan.' });
  }
});

/**
 * 7.7: POST /api/fulfillment/dispatch
 * Dispatch packed orders to carrier ('fulfilled' status)
 */
fulfillmentRouter.post('/dispatch', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds must be a non-empty array.' });
    }

    const result = await fulfillmentService.dispatchOrders(actor, orderIds);
    return res.json({
      success: true,
      message: `Dispatched ${result.dispatchedCount} order(s).`,
      result
    });
  } catch (err: any) {
    if (err instanceof FulfillmentError) {
      const status = err.code === 'FORBIDDEN' ? 403 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Fulfillment] Error dispatching orders:', err);
    return res.status(500).json({ error: 'Failed to dispatch orders.' });
  }
});

/**
 * 7.5: POST /api/fulfillment/shipping-labels
 * Get shipping label metadata for 4x6 / 4x2 thermal printing
 */
fulfillmentRouter.post('/shipping-labels', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds must be a non-empty array.' });
    }

    const labels = await fulfillmentService.getShippingLabelsData(actor, orderIds);
    return res.json({ labels });
  } catch (err: any) {
    if (err instanceof FulfillmentError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Fulfillment] Error fetching shipping labels:', err);
    return res.status(500).json({ error: 'Failed to fetch shipping labels.' });
  }
});
