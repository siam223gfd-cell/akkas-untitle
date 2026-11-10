import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { CategoryModel } from '../../database/models/Category';
import { ProductModel } from '../../database/models/Product';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { logAuditActivity } from '../../utils/auditLogger';

export const categoriesRouter = Router();

// Apply requireDatabase to categories endpoints
categoriesRouter.use(requireDatabase);

// GET /api/categories
categoriesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await CategoryModel.find().sort({ order: 1, name: 1 }).lean();

    // Dynamically compute itemCount from live active products
    const counts = await ProductModel.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const countMap: Record<string, number> = {};
    counts.forEach((c) => {
      if (typeof c._id === 'string' && c._id.trim()) {
        countMap[c._id.trim().toLowerCase()] = c.count;
      }
    });

    const enriched = categories.map((cat) => {
      const byName = cat.name ? countMap[cat.name.trim().toLowerCase()] : undefined;
      const bySlug = cat.slug ? countMap[cat.slug.trim().toLowerCase()] : undefined;
      return {
        ...cat,
        liveCount: byName ?? bySlug ?? 0,
      };
    });

    res.json({ success: true, categories: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/categories (Admin)
categoriesRouter.post(
  '/',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, slug, icon, image, description, order, featured } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Category name is required.' });
      }
      const cleanName = name.trim();
      const cleanSlug =
        (typeof slug === 'string' && slug.trim() ? slug.trim() : cleanName)
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '') || `category-${Date.now()}`;

      const category = await CategoryModel.create({
        name: cleanName,
        slug: cleanSlug,
        icon: typeof icon === 'string' ? icon.trim() : undefined,
        image: typeof image === 'string' ? image.trim() : undefined,
        description: typeof description === 'string' ? description.trim() : undefined,
        order: Number.isFinite(Number(order)) ? Number(order) : 0,
        featured: featured !== undefined ? Boolean(featured) : true,
      });

      await logAuditActivity({
        action: 'CREATE_CATEGORY',
        module: 'Categories',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Created new product category "${category.name}" (Slug: ${category.slug})`,
        recordId: category._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.status(201).json({ success: true, category });
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ success: false, message: 'A category with this slug already exists.' });
      }
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/categories/:id (Admin)
categoriesRouter.put(
  '/:id',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query = mongoose.Types.ObjectId.isValid(req.params.id)
        ? { _id: req.params.id }
        : { slug: req.params.id.toLowerCase() };

      const updates: any = {};
      if (typeof req.body.name === 'string' && req.body.name.trim()) updates.name = req.body.name.trim();
      if (typeof req.body.slug === 'string' && req.body.slug.trim()) {
        updates.slug = req.body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
      }
      if (typeof req.body.icon === 'string') updates.icon = req.body.icon.trim();
      if (typeof req.body.image === 'string') updates.image = req.body.image.trim();
      if (typeof req.body.description === 'string') updates.description = req.body.description.trim();
      if (req.body.order !== undefined && Number.isFinite(Number(req.body.order))) updates.order = Number(req.body.order);
      if (typeof req.body.featured === 'boolean') updates.featured = req.body.featured;

      const category = await CategoryModel.findOneAndUpdate(query, updates, { new: true, runValidators: true });
      if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

      await logAuditActivity({
        action: 'UPDATE_CATEGORY',
        module: 'Categories',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Updated category "${category.name}"`,
        recordId: category._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.json({ success: true, category });
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ success: false, message: 'A category with this slug already exists.' });
      }
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/categories/:id (Admin with dependent products validation)
categoriesRouter.delete(
  '/:id',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query = mongoose.Types.ObjectId.isValid(req.params.id)
        ? { _id: req.params.id }
        : { slug: req.params.id.toLowerCase() };

      const category = await CategoryModel.findOne(query);
      if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

      // Check dependent products
      const dependentCount = await ProductModel.countDocuments({
        $or: [{ category: category.name }, { category: category.slug }],
      });

      if (dependentCount > 0 && !req.query.force) {
        return res.status(400).json({
          success: false,
          code: 'DEPENDENT_PRODUCTS_EXIST',
          message: `Cannot delete category "${category.name}" because it has ${dependentCount} associated product(s). Please reassign or delete those products first.`,
        });
      }

      await CategoryModel.findByIdAndDelete(category._id);

      await logAuditActivity({
        action: 'DELETE_CATEGORY',
        module: 'Categories',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Deleted category "${category.name}" (Slug: ${category.slug})`,
        recordId: category._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.json({ success: true, message: 'Category deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
