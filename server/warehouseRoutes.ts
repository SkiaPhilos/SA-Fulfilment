import { Router, Request, Response } from 'express';
import { warehouseService } from './warehouseService.js';
import { requireAuth, requirePermission } from './middleware.js';

export const warehouseRouter = Router();

// Apply auth to all warehouse endpoints
warehouseRouter.use(requireAuth);

// ----------------------------------------------------
// Storage Templates Endpoints (Placed before parameterized :id)
// ----------------------------------------------------
warehouseRouter.get(
  '/templates',
  requirePermission('warehouses.view'),
  async (_req: Request, res: Response) => {
    try {
      const templates = await warehouseService.listStorageTemplates();
      res.json({ templates });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

warehouseRouter.post(
  '/templates',
  requirePermission('warehouses.edit'),
  async (req: Request, res: Response) => {
    try {
      const { name, type, description, length_cm, width_cm, height_cm, max_weight_kg, max_units } = req.body;
      if (!name || !type || !length_cm || !width_cm || !height_cm) {
        return res.status(400).json({ error: 'Name, type, and 3D dimensions (length, width, height) are required.' });
      }

      const actor = {
        id: (req as any).user.id,
        name: (req as any).user.name,
        email: (req as any).user.email
      };

      const template = await warehouseService.createStorageTemplate(
        {
          name,
          type,
          description,
          length_cm: Number(length_cm),
          width_cm: Number(width_cm),
          height_cm: Number(height_cm),
          max_weight_kg: Number(max_weight_kg) || 0,
          max_units: Number(max_units) || 1
        },
        actor
      );

      res.status(201).json({ template, message: 'Storage template created successfully.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

warehouseRouter.delete(
  '/templates/:id',
  requirePermission('warehouses.edit'),
  async (req: Request, res: Response) => {
    try {
      const actor = {
        id: (req as any).user.id,
        name: (req as any).user.name,
        email: (req as any).user.email
      };

      await warehouseService.deleteStorageTemplate(req.params.id, actor);
      res.json({ message: 'Storage template removed successfully.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ----------------------------------------------------
// Location Direct Endpoints (Placed before :id param routes)
// ----------------------------------------------------
warehouseRouter.get(
  '/locations/:id',
  requirePermission('warehouses.view'),
  async (req: Request, res: Response) => {
    try {
      const location = await warehouseService.getLocationById(req.params.id);
      if (!location) {
        return res.status(404).json({ error: 'Warehouse location not found.' });
      }
      res.json({ location });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

warehouseRouter.get(
  '/locations/:id/label',
  requirePermission('warehouses.view'),
  async (req: Request, res: Response) => {
    try {
      const labelData = await warehouseService.generateLocationLabelData(req.params.id);
      res.json(labelData);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  }
);

warehouseRouter.put(
  '/locations/:id',
  requirePermission('warehouses.edit'),
  async (req: Request, res: Response) => {
    try {
      const actor = {
        id: (req as any).user.id,
        name: (req as any).user.name,
        email: (req as any).user.email
      };

      const updated = await warehouseService.updateLocation(req.params.id, req.body, actor);
      res.json({ location: updated, message: 'Location updated successfully.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

warehouseRouter.delete(
  '/locations/:id',
  requirePermission('warehouses.edit'),
  async (req: Request, res: Response) => {
    try {
      const actor = {
        id: (req as any).user.id,
        name: (req as any).user.name,
        email: (req as any).user.email
      };

      const count = await warehouseService.deleteLocation(req.params.id, actor);
      res.json({ message: `Location and ${count - 1} descendant nodes deleted successfully.` });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ----------------------------------------------------
// Warehouses Endpoints
// ----------------------------------------------------
warehouseRouter.get(
  '/',
  requirePermission('warehouses.view'),
  async (_req: Request, res: Response) => {
    try {
      const warehouses = await warehouseService.listWarehouses();
      res.json({ warehouses });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

warehouseRouter.post(
  '/',
  requirePermission('warehouses.create'),
  async (req: Request, res: Response) => {
    try {
      const { code, name, city, address, contact_person, contact_phone, total_area_sqft } = req.body;
      if (!code || !name || !city || !address) {
        return res.status(400).json({ error: 'Warehouse code, name, city, and address are mandatory.' });
      }

      const actor = {
        id: (req as any).user.id,
        name: (req as any).user.name,
        email: (req as any).user.email
      };

      const warehouse = await warehouseService.createWarehouse(
        {
          code,
          name,
          city,
          address,
          contact_person: contact_person || '',
          contact_phone: contact_phone || '',
          total_area_sqft: Number(total_area_sqft) || 0
        },
        actor
      );

      res.status(201).json({ warehouse, message: 'Warehouse created successfully.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

warehouseRouter.get(
  '/:id',
  requirePermission('warehouses.view'),
  async (req: Request, res: Response) => {
    try {
      const warehouse = await warehouseService.getWarehouseById(req.params.id);
      if (!warehouse) {
        return res.status(404).json({ error: 'Warehouse not found.' });
      }
      res.json({ warehouse });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

warehouseRouter.put(
  '/:id',
  requirePermission('warehouses.edit'),
  async (req: Request, res: Response) => {
    try {
      const actor = {
        id: (req as any).user.id,
        name: (req as any).user.name,
        email: (req as any).user.email
      };

      const warehouse = await warehouseService.updateWarehouse(req.params.id, req.body, actor);
      res.json({ warehouse, message: 'Warehouse updated successfully.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ----------------------------------------------------
// Location Hierarchy & Operations for a Warehouse
// ----------------------------------------------------
warehouseRouter.get(
  '/:id/tree',
  requirePermission('warehouses.view'),
  async (req: Request, res: Response) => {
    try {
      const tree = await warehouseService.getLocationTree(req.params.id);
      res.json({ tree });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

warehouseRouter.post(
  '/:id/locations',
  requirePermission('warehouses.create'),
  async (req: Request, res: Response) => {
    try {
      const {
        parent_id,
        name,
        code,
        type,
        template_id,
        dimensions,
        max_weight_kg,
        max_units,
        notes
      } = req.body;

      if (!name || !code || !type) {
        return res.status(400).json({ error: 'Name, code, and location type are required.' });
      }

      const actor = {
        id: (req as any).user.id,
        name: (req as any).user.name,
        email: (req as any).user.email
      };

      const location = await warehouseService.createLocation(
        {
          warehouse_id: req.params.id,
          parent_id: parent_id || null,
          name,
          code,
          type,
          template_id,
          dimensions,
          max_weight_kg,
          max_units,
          notes
        },
        actor
      );

      res.status(201).json({ location, message: 'Location added to hierarchy.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

warehouseRouter.post(
  '/:id/locations/bulk',
  requirePermission('warehouses.create'),
  async (req: Request, res: Response) => {
    try {
      const {
        parent_id,
        type,
        prefix,
        code_prefix,
        start_number,
        count,
        zero_pad,
        template_id,
        dimensions,
        max_weight_kg,
        max_units
      } = req.body;

      if (!type || !prefix || !code_prefix || !count || count <= 0) {
        return res.status(400).json({
          error: 'Location type, display prefix, code prefix, and positive item count are required.'
        });
      }

      if (count > 200) {
        return res.status(400).json({ error: 'Bulk generation is limited to maximum 200 units per operation.' });
      }

      const actor = {
        id: (req as any).user.id,
        name: (req as any).user.name,
        email: (req as any).user.email
      };

      const locations = await warehouseService.bulkCreateLocations(
        req.params.id,
        {
          parent_id: parent_id || null,
          type,
          prefix,
          code_prefix,
          start_number: Number(start_number) || 1,
          count: Number(count),
          zero_pad: Number(zero_pad) || 2,
          template_id,
          dimensions,
          max_weight_kg,
          max_units
        },
        actor
      );

      res.status(201).json({
        locations,
        count: locations.length,
        message: `Successfully created ${locations.length} locations.`
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);
