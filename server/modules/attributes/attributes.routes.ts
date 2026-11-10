import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AttributeModel } from '../../database/models/Attribute';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';

export const attributesRouter = Router();

attributesRouter.use(requireDatabase);

const attributeValueSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  value: z.string().min(1, 'Value is required'),
  hexColor: z.string().optional(),
  description: z.string().optional(),
});

const attributeInputSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Valid slug is required'),
  type: z.enum(['color_swatch', 'size_selector', 'select', 'radio', 'text', 'number', 'boolean']),
  values: z.array(attributeValueSchema).default([]),
  categories: z.array(z.string()).default([]),
  isRequired: z.boolean().default(false),
  isFilterable: z.boolean().default(true),
  isVisibleOnPDP: z.boolean().default(true),
  displayOrder: z.number().default(0),
});

// GET /api/attributes (list, optionally filtered by category)
attributesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const category = (req.query.category as string || '').trim();
    const query: any = {};

    if (category && category !== 'all') {
      query.$or = [
        { categories: { $in: [category, 'all', '*'] } },
        { categories: { $size: 0 } }, // global attributes
      ];
    }

    const attributes = await AttributeModel.find(query).sort({ displayOrder: 1, name: 1 }).lean();
    res.json({ success: true, attributes });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attributes/:id
attributesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const query = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { slug: req.params.id.toLowerCase() };

    const attribute = await AttributeModel.findOne(query).lean();
    if (!attribute) {
      return res.status(404).json({ success: false, message: 'Attribute not found' });
    }
    res.json({ success: true, attribute });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attributes (Admin create)
attributesRouter.post(
  '/',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = attributeInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.format() });
      }

      const existing = await AttributeModel.findOne({ slug: parsed.data.slug.toLowerCase() });
      if (existing) {
        return res.status(409).json({ success: false, message: 'An attribute with this slug already exists.' });
      }

      const attribute = await AttributeModel.create(parsed.data);
      res.status(201).json({ success: true, message: 'Attribute created successfully', attribute });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/attributes/:id (Admin update)
attributesRouter.put(
  '/:id',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = attributeInputSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.format() });
      }

      const query = mongoose.Types.ObjectId.isValid(req.params.id)
        ? { _id: req.params.id }
        : { slug: req.params.id.toLowerCase() };

      const attribute = await AttributeModel.findOneAndUpdate(query, parsed.data, { new: true });
      if (!attribute) {
        return res.status(404).json({ success: false, message: 'Attribute not found' });
      }

      res.json({ success: true, message: 'Attribute updated successfully', attribute });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/attributes/:id (Admin delete)
attributesRouter.delete(
  '/:id',
  requireRole('super_admin', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query = mongoose.Types.ObjectId.isValid(req.params.id)
        ? { _id: req.params.id }
        : { slug: req.params.id.toLowerCase() };

      const attribute = await AttributeModel.findOneAndDelete(query);
      if (!attribute) {
        return res.status(404).json({ success: false, message: 'Attribute not found' });
      }

      res.json({ success: true, message: 'Attribute deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
