/**
 * Phase 8: Dispatch Manifests, Tracking, Returns & Automated Billing API Routes
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from './middleware.js';
import { dispatchService, DispatchError } from './dispatchService.js';
import { ActorContext } from './fulfillmentService.js';
import { getDb } from './db.js';

export const dispatchRouter = Router();

dispatchRouter.use(requireAuth);

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
 * 8.1: POST /api/dispatch/manifests
 * Create a new courier handover manifest for packed orders
 */
dispatchRouter.post('/manifests', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const { carrierName, driverName, driverPhone, vehicleNumber, handoverNotes, orderIds } = req.body;

    const manifest = await dispatchService.createManifest(actor, {
      carrierName,
      driverName,
      driverPhone,
      vehicleNumber,
      handoverNotes,
      orderIds
    });

    return res.status(201).json({
      success: true,
      message: `Carrier handover manifest ${manifest.manifest_number} created with ${manifest.total_orders} order(s).`,
      manifest
    });
  } catch (err: any) {
    if (err instanceof DispatchError) {
      const status = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Dispatch] Error creating manifest:', err);
    return res.status(500).json({ error: 'Failed to create dispatch manifest.' });
  }
});

/**
 * 8.2: POST /api/dispatch/manifests/:id/sign
 * Sign & dispatch manifest, marks orders as fulfilled, automates wallet billing deductions
 */
dispatchRouter.post('/manifests/:id/sign', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const result = await dispatchService.signAndDispatchManifest(actor, req.params.id);

    return res.json({
      success: true,
      message: `Manifest ${result.manifest.manifest_number} signed & dispatched. Orders marked as Fulfilled and billing debits posted.`,
      result
    });
  } catch (err: any) {
    if (err instanceof DispatchError) {
      const status = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Dispatch] Error signing manifest:', err);
    return res.status(500).json({ error: 'Failed to sign and dispatch manifest.' });
  }
});

/**
 * GET /api/dispatch/manifests
 * List all manifests
 */
dispatchRouter.get('/manifests', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const manifests = await dispatchService.listManifests(actor);
    return res.json({ manifests });
  } catch (err: any) {
    console.error('[Dispatch] Error listing manifests:', err);
    return res.status(500).json({ error: 'Failed to list dispatch manifests.' });
  }
});

/**
 * GET /api/dispatch/manifests/:id
 * Get single manifest details for printable handover voucher
 */
dispatchRouter.get('/manifests/:id', async (req: Request, res: Response) => {
  try {
    const details = await dispatchService.getManifestDetails(req.params.id);
    return res.json(details);
  } catch (err: any) {
    if (err instanceof DispatchError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Dispatch] Error getting manifest details:', err);
    return res.status(500).json({ error: 'Failed to get manifest details.' });
  }
});

/**
 * 8.3: POST /api/dispatch/tracking
 * Add tracking checkpoint event
 */
dispatchRouter.post('/tracking', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const { orderId, status, location, description } = req.body;

    const event = await dispatchService.addTrackingEvent(actor, {
      orderId,
      status,
      location,
      description
    });

    return res.status(201).json({
      success: true,
      message: 'Tracking event recorded.',
      event
    });
  } catch (err: any) {
    if (err instanceof DispatchError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Dispatch] Error adding tracking event:', err);
    return res.status(500).json({ error: 'Failed to record tracking event.' });
  }
});

/**
 * GET /api/dispatch/tracking/:orderIdentifier
 * Get complete order tracking history
 */
dispatchRouter.get('/tracking/:orderIdentifier', async (req: Request, res: Response) => {
  try {
    const tracking = await dispatchService.getOrderTracking(req.params.orderIdentifier);
    return res.json(tracking);
  } catch (err: any) {
    if (err instanceof DispatchError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Dispatch] Error retrieving tracking:', err);
    return res.status(500).json({ error: 'Failed to retrieve tracking details.' });
  }
});

/**
 * 8.4: POST /api/dispatch/returns
 * Process a returned order (RTO or Customer Return) with restock or quarantine
 */
dispatchRouter.post('/returns', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const {
      orderId,
      returnType,
      returnReason,
      trackingReference,
      disposition,
      targetLocationId,
      conditionNotes
    } = req.body;

    const result = await dispatchService.processReturn(actor, {
      orderId,
      returnType,
      returnReason,
      trackingReference,
      disposition,
      targetLocationId,
      conditionNotes
    });

    return res.status(201).json({
      success: true,
      message: `Return ${result.returnOrder.return_number} processed. Reconciled ${result.unitsReconciledCount} unit(s) with disposition '${result.returnOrder.disposition}'.`,
      result
    });
  } catch (err: any) {
    if (err instanceof DispatchError) {
      const status = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Dispatch] Error processing return:', err);
    return res.status(500).json({ error: 'Failed to process return order.' });
  }
});

/**
 * GET /api/dispatch/returns
 * List return orders
 */
dispatchRouter.get('/returns', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const returns = await dispatchService.listReturns(actor);
    return res.json({ returns });
  } catch (err: any) {
    console.error('[Dispatch] Error listing returns:', err);
    return res.status(500).json({ error: 'Failed to list return orders.' });
  }
});

/**
 * 8.5: GET /api/dispatch/rate-cards
 * List billing rate cards
 */
dispatchRouter.get('/rate-cards', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const rateCards = await dispatchService.listRateCards(actor);
    return res.json({ rateCards });
  } catch (err: any) {
    console.error('[Dispatch] Error listing rate cards:', err);
    return res.status(500).json({ error: 'Failed to list rate cards.' });
  }
});

/**
 * PUT /api/dispatch/rate-cards/:id
 * Update billing rate card parameters
 */
dispatchRouter.put('/rate-cards/:id', async (req: Request, res: Response) => {
  try {
    const actor = extractActor(req);
    const rateCard = await dispatchService.updateRateCard(actor, req.params.id, req.body);
    return res.json({
      success: true,
      message: `Rate card '${rateCard.name}' updated successfully.`,
      rateCard
    });
  } catch (err: any) {
    if (err instanceof DispatchError) {
      const status = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Dispatch] Error updating rate card:', err);
    return res.status(500).json({ error: 'Failed to update rate card.' });
  }
});
