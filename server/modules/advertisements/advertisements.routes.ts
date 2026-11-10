import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { AdvertisementModel } from '../../database/models/Advertisement';
import { AuditLogModel } from '../../database/models/AuditLog';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { isDatabaseConnected } from '../../database/connection';
import { escapeRegex } from '../../utils/regex';
import { isValidDestinationUrl, isValidImageUrl, parseOptionalDate } from '../../utils/url';

export const advertisementsRouter = Router();

function validateAdUrls(body: any): string | null {
  if (body?.mainImage && !isValidImageUrl(body.mainImage)) return 'Invalid main advertisement image URL.';
  if (body?.secondaryImage && !isValidImageUrl(body.secondaryImage)) return 'Invalid secondary image URL.';
  if (body?.backgroundImage && !isValidImageUrl(body.backgroundImage)) return 'Invalid background image URL.';
  if (body?.cta?.url && !isValidDestinationUrl(body.cta.url)) {
    return 'CTA URL must be a relative path or valid http(s) URL.';
  }
  return null;
}

// GET /api/advertisements/public or /api/advertisements/active (Public eligible advertisements)
advertisementsRouter.get(['/public', '/active'], async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.json({ success: true, advertisements: [] });
    }

    const now = new Date();
    const andClauses: any[] = [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ];
    if (req.query.device && req.query.device !== 'all') {
      andClauses.push({ $or: [{ deviceTargeting: 'all' }, { deviceTargeting: req.query.device }] });
    }

    const query: any = {
      status: 'published',
      $and: andClauses,
    };

    if (req.query.placement) {
      query.placements = req.query.placement;
    }

    const advertisements = await AdvertisementModel.find(query).sort({ priority: 1, createdAt: -1 }).lean();
    res.json({ success: true, advertisements });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/advertisements/placement/:placement (Public advertisements by placement)
advertisementsRouter.get('/placement/:placement', async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.json({ success: true, advertisements: [] });
    }

    const now = new Date();
    const andClauses: any[] = [
      { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
    ];
    if (req.query.device && req.query.device !== 'all') {
      andClauses.push({ $or: [{ deviceTargeting: 'all' }, { deviceTargeting: req.query.device }] });
    }

    const query: any = {
      status: 'published',
      placements: req.params.placement,
      $and: andClauses,
    };

    const advertisements = await AdvertisementModel.find(query).sort({ priority: 1, createdAt: -1 }).lean();
    res.json({ success: true, advertisements });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/advertisements/:id/impression (Public track impression)
advertisementsRouter.post('/:id/impression', async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) return res.json({ success: true });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid advertisement identifier.' });
    }
    await AdvertisementModel.findByIdAndUpdate(req.params.id, { $inc: { impressions: 1 } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/advertisements/:id/click (Public track CTA click)
advertisementsRouter.post('/:id/click', async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) return res.json({ success: true });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid advertisement identifier.' });
    }
    await AdvertisementModel.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/advertisements (Admin list with stats & filtering)
advertisementsRouter.get(
  '/',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { search, status, placement, deviceTargeting } = req.query;
      const query: any = {};

      if (status && status !== 'all') query.status = status;
      if (placement && placement !== 'all') query.placements = placement;
      if (deviceTargeting && deviceTargeting !== 'all') query.deviceTargeting = deviceTargeting;
      if (search && String(search).trim()) {
        const safe = new RegExp(escapeRegex(String(search).trim()), 'i');
        query.$or = [{ name: safe }, { title: safe }];
      }

      const advertisements = await AdvertisementModel.find(query).sort({ priority: 1, createdAt: -1 }).lean();

      const now = new Date();
      const totalCount = await AdvertisementModel.countDocuments();
      const activeCount = await AdvertisementModel.countDocuments({
        status: 'published',
        $and: [
          { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
          { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
        ],
      });
      const expiredCount = await AdvertisementModel.countDocuments({
        status: 'published',
        endDate: { $lt: now },
      });

      const agg = await AdvertisementModel.aggregate([
        { $group: { _id: null, totalImpressions: { $sum: '$impressions' }, totalClicks: { $sum: '$clicks' } } },
      ]);

      res.json({
        success: true,
        advertisements,
        stats: {
          total: totalCount,
          active: activeCount,
          expired: expiredCount,
          totalImpressions: agg[0]?.totalImpressions || 0,
          totalClicks: agg[0]?.totalClicks || 0,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/advertisements/:id (Admin get single ad)
advertisementsRouter.get(
  '/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid advertisement identifier.' });
      }
      const ad = await AdvertisementModel.findById(req.params.id);
      if (!ad) return res.status(404).json({ success: false, message: 'Advertisement not found' });
      res.json({ success: true, advertisement: ad });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/advertisements (Admin create ad)
advertisementsRouter.post(
  '/',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, title, mainImage } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Ad internal name is required' });
      }
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ success: false, message: 'Ad title is required' });
      }
      if (!mainImage || typeof mainImage !== 'string' || !mainImage.trim()) {
        return res.status(400).json({ success: false, message: 'Main advertisement image is required' });
      }

      const urlErr = validateAdUrls(req.body);
      if (urlErr) return res.status(400).json({ success: false, message: urlErr });

      const startParsed = parseOptionalDate(req.body.startDate);
      const endParsed = parseOptionalDate(req.body.endDate);
      if (startParsed.invalid || endParsed.invalid) {
        return res.status(400).json({ success: false, message: 'Invalid startDate or endDate provided.' });
      }
      if (startParsed.date && endParsed.date && startParsed.date > endParsed.date) {
        return res.status(400).json({ success: false, message: 'Start date must be before or equal to end date.' });
      }

      const newAd = new AdvertisementModel({
        name: name.trim(),
        title: title.trim(),
        subtitle: typeof req.body.subtitle === 'string' ? req.body.subtitle.trim() : '',
        description: typeof req.body.description === 'string' ? req.body.description.trim() : '',
        promoBadge: typeof req.body.promoBadge === 'string' ? req.body.promoBadge.trim() : '',
        mainImage: mainImage.trim(),
        secondaryImage: typeof req.body.secondaryImage === 'string' ? req.body.secondaryImage.trim() : '',
        backgroundImage: typeof req.body.backgroundImage === 'string' ? req.body.backgroundImage.trim() : '',
        backgroundColor: typeof req.body.backgroundColor === 'string' ? req.body.backgroundColor : '#020617',
        gradient: typeof req.body.gradient === 'string' ? req.body.gradient : undefined,
        textColor: typeof req.body.textColor === 'string' ? req.body.textColor : '#ffffff',
        cta: req.body.cta,
        closeButton: req.body.closeButton,
        placements: Array.isArray(req.body.placements) ? req.body.placements : undefined,
        deviceTargeting: ['all', 'desktop_only', 'mobile_only', 'tablet_only'].includes(req.body.deviceTargeting)
          ? req.body.deviceTargeting
          : 'all',
        priority: typeof req.body.priority === 'number' ? req.body.priority : 1,
        status: ['draft', 'published', 'archived'].includes(req.body.status) ? req.body.status : 'published',
        startDate: startParsed.date,
        endDate: endParsed.date,
      });

      await newAd.save();

      await AuditLogModel.create({
        action: 'CREATE_ADVERTISEMENT',
        module: 'Advertisement Management',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Created advertisement "${newAd.name}" (Title: ${newAd.title})`,
      });

      res.status(201).json({ success: true, message: 'Advertisement created successfully!', advertisement: newAd });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/advertisements/:id (Admin update ad)
advertisementsRouter.put(
  '/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid advertisement identifier.' });
      }
      const ad = await AdvertisementModel.findById(req.params.id);
      if (!ad) return res.status(404).json({ success: false, message: 'Advertisement not found' });

      const urlErr = validateAdUrls(req.body);
      if (urlErr) return res.status(400).json({ success: false, message: urlErr });

      if (typeof req.body.name === 'string' && req.body.name.trim()) ad.name = req.body.name.trim();
      if (typeof req.body.title === 'string' && req.body.title.trim()) ad.title = req.body.title.trim();
      if (typeof req.body.subtitle === 'string') ad.subtitle = req.body.subtitle.trim();
      if (typeof req.body.description === 'string') ad.description = req.body.description.trim();
      if (typeof req.body.promoBadge === 'string') ad.promoBadge = req.body.promoBadge.trim();
      if (typeof req.body.mainImage === 'string' && req.body.mainImage.trim()) ad.mainImage = req.body.mainImage.trim();
      if (typeof req.body.secondaryImage === 'string') ad.secondaryImage = req.body.secondaryImage.trim();
      if (typeof req.body.backgroundImage === 'string') ad.backgroundImage = req.body.backgroundImage.trim();
      if (typeof req.body.backgroundColor === 'string') ad.backgroundColor = req.body.backgroundColor;
      if (typeof req.body.gradient === 'string') ad.gradient = req.body.gradient;
      if (typeof req.body.textColor === 'string') ad.textColor = req.body.textColor;
      if (req.body.cta) ad.cta = req.body.cta;
      if (req.body.closeButton) ad.closeButton = req.body.closeButton;
      if (Array.isArray(req.body.placements)) ad.placements = req.body.placements;
      if (['all', 'desktop_only', 'mobile_only', 'tablet_only'].includes(req.body.deviceTargeting)) {
        ad.deviceTargeting = req.body.deviceTargeting;
      }
      if (typeof req.body.priority === 'number' && Number.isFinite(req.body.priority)) {
        ad.priority = req.body.priority;
      }
      if (req.body.status !== undefined) {
        if (!['draft', 'published', 'archived'].includes(req.body.status)) {
          return res.status(400).json({ success: false, message: 'Invalid status' });
        }
        ad.status = req.body.status;
      }

      if ('startDate' in req.body) {
        const startParsed = parseOptionalDate(req.body.startDate);
        if (startParsed.invalid) return res.status(400).json({ success: false, message: 'Invalid startDate.' });
        ad.startDate = startParsed.date as any;
      }
      if ('endDate' in req.body) {
        const endParsed = parseOptionalDate(req.body.endDate);
        if (endParsed.invalid) return res.status(400).json({ success: false, message: 'Invalid endDate.' });
        ad.endDate = endParsed.date as any;
      }
      if (ad.startDate && ad.endDate && new Date(ad.startDate) > new Date(ad.endDate)) {
        return res.status(400).json({ success: false, message: 'Start date must be before or equal to end date.' });
      }

      await ad.save();

      await AuditLogModel.create({
        action: 'UPDATE_ADVERTISEMENT',
        module: 'Advertisement Management',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Updated advertisement "${ad.name}"`,
      });

      res.json({ success: true, message: 'Advertisement updated successfully!', advertisement: ad });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/advertisements/:id/status (Admin toggle status)
advertisementsRouter.patch(
  '/:id/status',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid advertisement identifier.' });
      }
      const { status } = req.body;
      if (!['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }

      const ad = await AdvertisementModel.findByIdAndUpdate(req.params.id, { status }, { new: true });
      if (!ad) return res.status(404).json({ success: false, message: 'Advertisement not found' });

      res.json({ success: true, message: `Advertisement status changed to ${status}`, advertisement: ad });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/advertisements/:id/duplicate (Admin duplicate ad)
advertisementsRouter.post(
  '/:id/duplicate',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid advertisement identifier.' });
      }
      const ad = await AdvertisementModel.findById(req.params.id).lean();
      if (!ad) return res.status(404).json({ success: false, message: 'Source ad not found' });

      delete (ad as any)._id;
      delete (ad as any).createdAt;
      delete (ad as any).updatedAt;
      ad.impressions = 0;
      ad.clicks = 0;

      const duplicatedAd = new AdvertisementModel({
        ...ad,
        name: `${ad.name} (Copy)`,
        title: `${ad.title} (Copy)`,
        status: 'draft',
      });

      await duplicatedAd.save();

      res.status(201).json({ success: true, message: 'Advertisement duplicated as draft!', advertisement: duplicatedAd });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/advertisements/:id (Admin delete ad)
advertisementsRouter.delete(
  '/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid advertisement identifier.' });
      }
      const ad = await AdvertisementModel.findByIdAndDelete(req.params.id);
      if (!ad) return res.status(404).json({ success: false, message: 'Advertisement not found' });

      await AuditLogModel.create({
        action: 'DELETE_ADVERTISEMENT',
        module: 'Advertisement Management',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Deleted advertisement "${ad.name}"`,
      });

      res.json({ success: true, message: 'Advertisement deleted successfully!' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
