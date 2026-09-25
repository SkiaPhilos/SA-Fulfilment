/**
 * Fulfillment Orders REST Router for Ship Asaan
 * Fine-grained RBAC, order confirmation queue, and multi-step CSV engine.
 */

import { Router, Request, Response } from 'express';
import { orderService, OrderError, ActorContext } from './orderService.js';
import { requireAuth, requirePermission } from './middleware.js';
import { getDb } from './db.js';

export const orderRouter = Router();

// All order endpoints require active session
orderRouter.use(requireAuth);

function buildActorContext(req: Request): ActorContext {
  const user = req.user!;
  let customerProfileId: string | null = user.customer_profile_id || null;

  if (!customerProfileId && user.account_type === 'customer') {
    const db = getDb();
    const profile = db.customer_profiles.find(cp => cp.user_id === user.id);
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

/**
 * GET /api/orders
 * List orders with search, customer scope, status, and stock status
 */
orderRouter.get('/', async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const {
      status,
      customerId,
      search,
      city,
      paymentMethod,
      startDate,
      endDate,
      page,
      limit
    } = req.query;

    const result = await orderService.listOrders(actor, {
      status: status as string,
      customerId: customerId as string,
      search: search as string,
      city: city as string,
      paymentMethod: paymentMethod as 'cod' | 'prepaid',
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 50
    });

    res.json(result);
  } catch (err: any) {
    res.status(err instanceof OrderError ? 400 : 500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/export
 * Download CSV export of filtered orders
 */
orderRouter.get('/export', requirePermission('orders.export'), async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const {
      status,
      customerId,
      search,
      city,
      paymentMethod,
      startDate,
      endDate
    } = req.query;

    const csvData = await orderService.exportOrdersCsv(actor, {
      status: status as string,
      customerId: customerId as string,
      search: search as string,
      city: city as string,
      paymentMethod: paymentMethod as 'cod' | 'prepaid',
      startDate: startDate as string,
      endDate: endDate as string
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ship_asaan_orders_${timestamp}.csv"`);
    res.send(csvData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/:id
 * Retrieve comprehensive order details and line item stock availability
 */
orderRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const details = await orderService.getOrderDetails(actor, req.params.id);
    res.json(details);
  } catch (err: any) {
    const statusCode = err instanceof OrderError
      ? err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400
      : 500;
    res.status(statusCode).json({ error: err.message });
  }
});

/**
 * POST /api/orders
 * Create a new single fulfillment order (Customer or Staff)
 */
orderRouter.post('/', requirePermission('orders.create'), async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const result = await orderService.createOrder(actor, req.body);
    res.status(201).json(result);
  } catch (err: any) {
    const statusCode = err instanceof OrderError
      ? err.code === 'CUSTOMER_NOT_APPROVED' ? 403 : 400
      : 500;
    res.status(statusCode).json({ error: err.message });
  }
});

/**
 * POST /api/orders/csv/preview
 * Multi-step CSV Import: Step 1 & 2 - Parse & Validate CSV
 */
orderRouter.post('/csv/preview', requirePermission('orders.create'), async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const { csvContent, customerId } = req.body;

    if (!csvContent || typeof csvContent !== 'string') {
      res.status(400).json({ error: 'csvContent string is required.' });
      return;
    }

    const preview = await orderService.previewCsvImport(actor, csvContent, customerId);
    res.json(preview);
  } catch (err: any) {
    res.status(err instanceof OrderError ? 400 : 500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/csv/commit
 * Multi-step CSV Import: Step 3 - Commit Validated Orders
 */
orderRouter.post('/csv/commit', requirePermission('orders.create'), async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const { previewData, skipInvalid } = req.body;

    if (!previewData || !previewData.orders) {
      res.status(400).json({ error: 'previewData object from preview step is required.' });
      return;
    }

    const result = await orderService.commitCsvImport(actor, previewData, { skipInvalid });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(err instanceof OrderError ? 400 : 500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/:id/confirm
 * Explicit Confirmation Queue Action: placed -> confirmed
 */
orderRouter.post('/:id/confirm', requirePermission('orders.confirm'), async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const confirmedOrder = await orderService.confirmOrder(actor, req.params.id);
    res.json({ order: confirmedOrder });
  } catch (err: any) {
    const statusCode = err instanceof OrderError
      ? err.code === 'NOT_FOUND' ? 404 : 400
      : 500;
    res.status(statusCode).json({ error: err.message });
  }
});

/**
 * POST /api/orders/bulk-confirm
 * Bulk Confirmation of placed orders
 */
orderRouter.post('/bulk-confirm', requirePermission('orders.confirm'), async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({ error: 'orderIds array is required.' });
      return;
    }

    const result = await orderService.bulkConfirmOrders(actor, orderIds);
    res.json(result);
  } catch (err: any) {
    res.status(err instanceof OrderError ? 400 : 500).json({ error: err.message });
  }
});

/**
 * POST /api/orders/:id/cancel
 * Cancel order with mandatory reason
 */
orderRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const actor = buildActorContext(req);
    const { reason } = req.body;
    const cancelledOrder = await orderService.cancelOrder(actor, req.params.id, reason);
    res.json({ order: cancelledOrder });
  } catch (err: any) {
    const statusCode = err instanceof OrderError
      ? err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400
      : 500;
    res.status(statusCode).json({ error: err.message });
  }
});
