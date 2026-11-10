import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { BannerModel } from '../../database/models/Banner';
import { AuditLogModel } from '../../database/models/AuditLog';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { isDatabaseConnected } from '../../database/connection';
import { escapeRegex } from '../../utils/regex';
import { isValidDestinationUrl, isValidImageUrl, parseOptionalDate } from '../../utils/url';

export const bannersRouter = Router();

function validateBannerMediaAndLinks(body: any): string | null {
  if (body?.background) {
    if (!isValidImageUrl(body.background.imageUrl)) return 'Invalid background image URL.';
    if (!isValidImageUrl(body.background.tabletImageUrl)) return 'Invalid tablet background image URL.';
    if (!isValidImageUrl(body.background.mobileImageUrl)) return 'Invalid mobile background image URL.';
  }
  if (Array.isArray(body?.layers)) {
    for (const layer of body.layers) {
      if (layer?.imageUrl && !isValidImageUrl(layer.imageUrl)) {
        return 'Invalid image URL in banner layer.';
      }
    }
  }
  if (Array.isArray(body?.buttons)) {
    for (const btn of body.buttons) {
      if (btn?.url && !isValidDestinationUrl(btn.url)) {
        return 'Button URL must be a relative path or valid http(s) URL.';
      }
    }
  }
  return null;
}

// GET /api/banners/public or /api/banners/active (Public active banners)
bannersRouter.get(['/public', '/active'], async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.json({ success: true, banners: [] });
    }

    const now = new Date();
    const query: any = {
      status: 'published',
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ],
    };

    if (req.query.placement) {
      query.placements = req.query.placement;
    }

    const banners = await BannerModel.find(query).sort({ priority: 1, createdAt: -1 }).lean();
    res.json({ success: true, banners });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/banners/placement/:placement (Public banners for a specific placement)
bannersRouter.get('/placement/:placement', async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.json({ success: true, banners: [] });
    }

    const now = new Date();
    const banners = await BannerModel.find({
      status: 'published',
      placements: req.params.placement,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ],
    })
      .sort({ priority: 1, createdAt: -1 })
      .lean();

    res.json({ success: true, banners });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/banners (Admin listing)
bannersRouter.get(
  '/',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { search, status, placement, sort = 'priority' } = req.query;
      const query: any = {};

      if (status && status !== 'all') {
        query.status = status;
      }
      if (placement && placement !== 'all') {
        query.placements = placement;
      }
      if (search && String(search).trim()) {
        const safe = new RegExp(escapeRegex(String(search).trim()), 'i');
        query.$or = [{ name: safe }, { slug: safe }];
      }

      let sortOptions: any = { priority: 1, updatedAt: -1 };
      if (sort === 'newest') sortOptions = { createdAt: -1 };
      if (sort === 'name') sortOptions = { name: 1 };

      const banners = await BannerModel.find(query).sort(sortOptions).lean();

      const totalCount = await BannerModel.countDocuments();
      const publishedCount = await BannerModel.countDocuments({ status: 'published' });
      const draftCount = await BannerModel.countDocuments({ status: 'draft' });
      const scheduledCount = await BannerModel.countDocuments({
        status: 'published',
        startDate: { $gt: new Date() },
      });

      res.json({
        success: true,
        banners,
        stats: {
          total: totalCount,
          published: publishedCount,
          draft: draftCount,
          scheduled: scheduledCount,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/banners/:id (Admin get single banner)
bannersRouter.get(
  '/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid banner identifier.' });
      }
      const banner = await BannerModel.findById(req.params.id);
      if (!banner) {
        return res.status(404).json({ success: false, message: 'Banner not found' });
      }
      res.json({ success: true, banner });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/banners (Admin create banner)
bannersRouter.post(
  '/',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, slug } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Banner name is required.' });
      }

      const mediaErr = validateBannerMediaAndLinks(req.body);
      if (mediaErr) {
        return res.status(400).json({ success: false, message: mediaErr });
      }

      const startParsed = parseOptionalDate(req.body.startDate);
      const endParsed = parseOptionalDate(req.body.endDate);
      if (startParsed.invalid || endParsed.invalid) {
        return res.status(400).json({ success: false, message: 'Invalid startDate or endDate provided.' });
      }
      if (startParsed.date && endParsed.date && startParsed.date > endParsed.date) {
        return res.status(400).json({ success: false, message: 'Start date must be before or equal to end date.' });
      }

      const status = ['draft', 'published', 'archived'].includes(req.body.status) ? req.body.status : 'published';

      let finalSlug = (typeof slug === 'string' && slug.trim() ? slug.trim() : name.trim())
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/^-+|-+$/g, '') || `banner-${Date.now()}`;
      const existingSlug = await BannerModel.findOne({ slug: finalSlug });
      if (existingSlug) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
      }

      const newBanner = new BannerModel({
        name: name.trim(),
        slug: finalSlug,
        status,
        placements: Array.isArray(req.body.placements) ? req.body.placements : undefined,
        priority: typeof req.body.priority === 'number' ? req.body.priority : undefined,
        startDate: startParsed.date,
        endDate: endParsed.date,
        background: req.body.background,
        layout: req.body.layout,
        layers: Array.isArray(req.body.layers) ? req.body.layers : undefined,
        buttons: Array.isArray(req.body.buttons) ? req.body.buttons : undefined,
        responsive: req.body.responsive,
      });

      await newBanner.save();

      await AuditLogModel.create({
        action: 'CREATE_BANNER',
        module: 'Dynamic Banner Builder',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Created new banner "${newBanner.name}" (Slug: ${newBanner.slug})`,
      });

      res.status(201).json({ success: true, message: 'Banner created successfully!', banner: newBanner });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/banners/:id (Admin update banner)
bannersRouter.put(
  '/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid banner identifier.' });
      }
      const banner = await BannerModel.findById(req.params.id);
      if (!banner) {
        return res.status(404).json({ success: false, message: 'Banner not found' });
      }

      const mediaErr = validateBannerMediaAndLinks(req.body);
      if (mediaErr) {
        return res.status(400).json({ success: false, message: mediaErr });
      }

      if (typeof req.body.name === 'string' && req.body.name.trim()) banner.name = req.body.name.trim();
      if (req.body.status !== undefined) {
        if (!['draft', 'published', 'archived'].includes(req.body.status)) {
          return res.status(400).json({ success: false, message: 'Invalid banner status.' });
        }
        banner.status = req.body.status;
      }
      if (Array.isArray(req.body.placements)) banner.placements = req.body.placements;
      if (typeof req.body.priority === 'number' && Number.isFinite(req.body.priority)) {
        banner.priority = req.body.priority;
      }

      if ('startDate' in req.body) {
        const startParsed = parseOptionalDate(req.body.startDate);
        if (startParsed.invalid) return res.status(400).json({ success: false, message: 'Invalid startDate.' });
        banner.startDate = startParsed.date as any;
      }
      if ('endDate' in req.body) {
        const endParsed = parseOptionalDate(req.body.endDate);
        if (endParsed.invalid) return res.status(400).json({ success: false, message: 'Invalid endDate.' });
        banner.endDate = endParsed.date as any;
      }
      if (banner.startDate && banner.endDate && new Date(banner.startDate) > new Date(banner.endDate)) {
        return res.status(400).json({ success: false, message: 'Start date must be before or equal to end date.' });
      }

      if (req.body.background) banner.background = req.body.background;
      if (req.body.layout) banner.layout = req.body.layout;
      if (Array.isArray(req.body.layers)) banner.layers = req.body.layers;
      if (Array.isArray(req.body.buttons)) banner.buttons = req.body.buttons;
      if (req.body.responsive) banner.responsive = req.body.responsive;

      await banner.save();

      await AuditLogModel.create({
        action: 'UPDATE_BANNER',
        module: 'Dynamic Banner Builder',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Updated banner "${banner.name}"`,
      });

      res.json({ success: true, message: 'Banner updated successfully!', banner });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/banners/:id/status (Admin toggle status)
bannersRouter.patch(
  '/:id/status',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid banner identifier.' });
      }
      const { status } = req.body;
      if (!['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }

      const banner = await BannerModel.findByIdAndUpdate(req.params.id, { status }, { new: true });
      if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

      res.json({ success: true, message: `Banner status set to ${status}`, banner });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/banners/:id/duplicate (Admin duplicate banner)
bannersRouter.post(
  '/:id/duplicate',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid banner identifier.' });
      }
      const banner = await BannerModel.findById(req.params.id).lean();
      if (!banner) return res.status(404).json({ success: false, message: 'Source banner not found' });

      const rand = Math.floor(100 + Math.random() * 900);
      delete (banner as any)._id;
      delete (banner as any).createdAt;
      delete (banner as any).updatedAt;

      const duplicatedBanner = new BannerModel({
        ...banner,
        name: `${banner.name} (Copy)`,
        slug: `${banner.slug}-copy-${rand}`,
        status: 'draft',
      });

      await duplicatedBanner.save();

      await AuditLogModel.create({
        action: 'DUPLICATE_BANNER',
        module: 'Dynamic Banner Builder',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Duplicated banner "${banner.name}" to "${duplicatedBanner.name}"`,
      });

      res.status(201).json({ success: true, message: 'Banner duplicated as draft!', banner: duplicatedBanner });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/banners/:id (Admin delete banner)
bannersRouter.delete(
  '/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid banner identifier.' });
      }
      const banner = await BannerModel.findByIdAndDelete(req.params.id);
      if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

      await AuditLogModel.create({
        action: 'DELETE_BANNER',
        module: 'Dynamic Banner Builder',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Deleted banner "${banner.name}"`,
      });

      res.json({ success: true, message: 'Banner deleted successfully!' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
