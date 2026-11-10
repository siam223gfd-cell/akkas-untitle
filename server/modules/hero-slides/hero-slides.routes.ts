import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { HeroSlideModel } from '../../database/models/HeroSlide';
import { AuditLogModel } from '../../database/models/AuditLog';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { isDatabaseConnected } from '../../database/connection';

export const heroSlidesRouter = Router();

function isValidDestinationUrl(raw?: string): boolean {
  if (!raw || !raw.trim()) return true;
  const trimmed = raw.trim();
  if (/^\/(?!\/)/.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidImageUrl(raw?: string): boolean {
  if (!raw || !raw.trim()) return true;
  const trimmed = raw.trim();
  if (/^\/(?!\/)/.test(trimmed)) return true;
  if (/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseOptionalDate(val: unknown): { date: Date | null; invalid: boolean } {
  if (val === undefined || val === null || val === '') {
    return { date: null, invalid: false };
  }
  const d = new Date(String(val));
  if (Number.isNaN(d.getTime())) {
    return { date: null, invalid: true };
  }
  return { date: d, invalid: false };
}

// GET /api/hero-slides/public or /api/hero-slides/active (Public active slides)
heroSlidesRouter.get(['/public', '/active'], async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.json({ success: true, slides: [] });
    }

    const now = new Date();
    const slides = await HeroSlideModel.find({
      isActive: true,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ],
    })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    res.json({ success: true, slides });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/hero-slides (Admin list)
heroSlidesRouter.get(
  '/',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const slides = await HeroSlideModel.find().sort({ order: 1, createdAt: 1 }).lean();
      res.json({ success: true, slides, total: slides.length });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/hero-slides/reorder (Bulk reorder — MUST be before /:id parameterized routes)
heroSlidesRouter.patch(
  '/reorder',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Expected non-empty array of items for reorder.' });
      }

      for (const item of items) {
        if (!item || !mongoose.Types.ObjectId.isValid(String(item.id)) || !Number.isFinite(Number(item.order))) {
          return res.status(400).json({ success: false, message: 'Each reorder item requires a valid slide id and numeric order.' });
        }
      }

      await Promise.all(
        items.map((item) =>
          HeroSlideModel.findByIdAndUpdate(item.id, { order: Math.max(1, Math.round(Number(item.order))) })
        )
      );

      const slides = await HeroSlideModel.find().sort({ order: 1, createdAt: 1 }).lean();
      res.json({ success: true, message: 'Slide order updated successfully', slides });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/hero-slides/:id (Admin get single slide)
heroSlidesRouter.get(
  '/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid slide identifier.' });
      }
      const slide = await HeroSlideModel.findById(req.params.id);
      if (!slide) return res.status(404).json({ success: false, message: 'Slide not found' });
      res.json({ success: true, slide });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/hero-slides (Admin create slide)
heroSlidesRouter.post(
  '/',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, secondaryCtaUrl } = req.body;
      const rawImage = req.body.image !== undefined && req.body.image !== '' ? req.body.image : req.body.desktopImage;
      const mobileImage = typeof req.body.mobileImage === 'string' ? req.body.mobileImage.trim() : '';
      const rawLink = req.body.link !== undefined ? req.body.link : req.body.destinationUrl;
      const rawOrder = req.body.displayOrder !== undefined ? req.body.displayOrder : req.body.order;

      if (!rawImage || typeof rawImage !== 'string' || !rawImage.trim()) {
        return res.status(400).json({ success: false, message: 'Slide image is required.' });
      }
      if (!isValidImageUrl(rawImage) || !isValidImageUrl(mobileImage)) {
        return res.status(400).json({ success: false, message: 'Invalid or unsafe slide image URL provided.' });
      }
      if (rawLink && !isValidDestinationUrl(rawLink)) {
        return res.status(400).json({
          success: false,
          message: 'Destination URL must be a relative path (e.g. /shop) or a valid http(s) URL.',
        });
      }
      if (secondaryCtaUrl && !isValidDestinationUrl(secondaryCtaUrl)) {
        return res.status(400).json({
          success: false,
          message: 'Secondary CTA URL must be a relative path (e.g. /shop) or a valid http(s) URL.',
        });
      }

      if (req.body.target !== undefined && !['_self', '_blank'].includes(req.body.target)) {
        return res.status(400).json({ success: false, message: 'Target must be _self or _blank.' });
      }

      const startParsed = parseOptionalDate(req.body.startDate);
      const endParsed = parseOptionalDate(req.body.endDate);
      if (startParsed.invalid || endParsed.invalid) {
        return res.status(400).json({ success: false, message: 'Invalid startDate or endDate provided.' });
      }
      if (startParsed.date && endParsed.date && startParsed.date > endParsed.date) {
        return res.status(400).json({ success: false, message: 'Start date must be before or equal to end date.' });
      }

      const count = await HeroSlideModel.countDocuments();
      const parsedOrder = Number.isFinite(Number(rawOrder)) && Number(rawOrder) > 0 ? Math.round(Number(rawOrder)) : count + 1;
      const sanitizedLink = typeof rawLink === 'string' ? rawLink.trim() : '';

      const newSlide = new HeroSlideModel({
        title: typeof title === 'string' ? title.trim() : '',
        subtitle: typeof req.body.subtitle === 'string' ? req.body.subtitle.trim() : '',
        badge: typeof req.body.badge === 'string' ? req.body.badge.trim() : '',
        image: rawImage.trim(),
        desktopImage: rawImage.trim(),
        mobileImage,
        link: sanitizedLink,
        destinationUrl: sanitizedLink,
        ctaText: typeof req.body.ctaText === 'string' ? req.body.ctaText.trim() : '',
        secondaryCtaText: typeof req.body.secondaryCtaText === 'string' ? req.body.secondaryCtaText.trim() : '',
        secondaryCtaUrl: typeof secondaryCtaUrl === 'string' ? secondaryCtaUrl.trim() : '',
        target: req.body.target === '_blank' ? '_blank' : '_self',
        order: parsedOrder,
        displayOrder: parsedOrder,
        isActive: req.body.isActive !== false,
        startDate: startParsed.date,
        endDate: endParsed.date,
      });

      await newSlide.save();

      await AuditLogModel.create({
        action: 'CREATE_HERO_IMAGE_SLIDE',
        module: 'Hero Image Slider',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Created hero slide "${newSlide.title || '(Banner Image)'}"`,
      });

      res.status(201).json({ success: true, message: 'Slide created successfully!', slide: newSlide });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/hero-slides/:id (Admin update slide)
heroSlidesRouter.put(
  '/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid slide identifier.' });
      }
      const slide = await HeroSlideModel.findById(req.params.id);
      if (!slide) return res.status(404).json({ success: false, message: 'Slide not found' });

      if (typeof req.body.title === 'string') slide.title = req.body.title.trim();
      if (typeof req.body.subtitle === 'string') slide.subtitle = req.body.subtitle.trim();
      if (typeof req.body.badge === 'string') slide.badge = req.body.badge.trim();

      const incomingImage = req.body.image !== undefined && req.body.image !== '' ? req.body.image : req.body.desktopImage;
      if (incomingImage !== undefined) {
        if (typeof incomingImage !== 'string' || !incomingImage.trim()) {
          return res.status(400).json({ success: false, message: 'Desktop slide image cannot be empty.' });
        }
        if (!isValidImageUrl(incomingImage)) {
          return res.status(400).json({ success: false, message: 'Invalid or unsafe desktop image URL provided.' });
        }
        slide.desktopImage = incomingImage.trim();
        slide.image = incomingImage.trim();
      }

      if (typeof req.body.mobileImage === 'string') {
        if (!isValidImageUrl(req.body.mobileImage)) {
          return res.status(400).json({ success: false, message: 'Invalid or unsafe mobile image URL provided.' });
        }
        slide.mobileImage = req.body.mobileImage.trim();
      }

      const incomingLink = req.body.link !== undefined ? req.body.link : req.body.destinationUrl;
      if (incomingLink !== undefined) {
        if (typeof incomingLink === 'string') {
          if (incomingLink.trim() && !isValidDestinationUrl(incomingLink)) {
            return res.status(400).json({
              success: false,
              message: 'Destination URL must be a relative path (e.g. /shop) or a valid http(s) URL.',
            });
          }
          slide.destinationUrl = incomingLink.trim();
          slide.link = incomingLink.trim();
        }
      }

      if (typeof req.body.ctaText === 'string') slide.ctaText = req.body.ctaText.trim();
      if (typeof req.body.secondaryCtaText === 'string') slide.secondaryCtaText = req.body.secondaryCtaText.trim();

      if (typeof req.body.secondaryCtaUrl === 'string') {
        if (req.body.secondaryCtaUrl.trim() && !isValidDestinationUrl(req.body.secondaryCtaUrl)) {
          return res.status(400).json({
            success: false,
            message: 'Secondary CTA URL must be a relative path (e.g. /shop) or a valid http(s) URL.',
          });
        }
        slide.secondaryCtaUrl = req.body.secondaryCtaUrl.trim();
      }

      if (req.body.target !== undefined) {
        if (!['_self', '_blank'].includes(req.body.target)) {
          return res.status(400).json({ success: false, message: 'Target must be _self or _blank.' });
        }
        slide.target = req.body.target;
      }

      const incomingOrder = req.body.displayOrder !== undefined ? req.body.displayOrder : req.body.order;
      if (incomingOrder !== undefined && Number.isFinite(Number(incomingOrder))) {
        const parsedOrder = Math.max(1, Math.round(Number(incomingOrder)));
        slide.order = parsedOrder;
        slide.displayOrder = parsedOrder;
      }
      if (typeof req.body.isActive === 'boolean') slide.isActive = req.body.isActive;

      if ('startDate' in req.body) {
        const startParsed = parseOptionalDate(req.body.startDate);
        if (startParsed.invalid) {
          return res.status(400).json({ success: false, message: 'Invalid startDate format.' });
        }
        slide.startDate = startParsed.date as any;
      }
      if ('endDate' in req.body) {
        const endParsed = parseOptionalDate(req.body.endDate);
        if (endParsed.invalid) {
          return res.status(400).json({ success: false, message: 'Invalid endDate format.' });
        }
        slide.endDate = endParsed.date as any;
      }

      if (slide.startDate && slide.endDate && new Date(slide.startDate) > new Date(slide.endDate)) {
        return res.status(400).json({ success: false, message: 'Start date must be before or equal to end date.' });
      }

      await slide.save();

      await AuditLogModel.create({
        action: 'UPDATE_HERO_IMAGE_SLIDE',
        module: 'Hero Image Slider',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Updated hero slide "${slide.title || '(Banner Image)'}"`,
      });

      res.json({ success: true, message: 'Slide updated successfully!', slide });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/hero-slides/:id/status and /api/hero-slides/:id/toggle-status (Toggle active)
heroSlidesRouter.patch(
  ['/:id/status', '/:id/toggle-status'],
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid slide identifier.' });
      }
      const slide = await HeroSlideModel.findById(req.params.id);
      if (!slide) return res.status(404).json({ success: false, message: 'Slide not found' });

      slide.isActive = req.body.isActive !== undefined ? !!req.body.isActive : !slide.isActive;
      await slide.save();

      res.json({
        success: true,
        message: `Slide is now ${slide.isActive ? 'active' : 'inactive'}`,
        slide,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/hero-slides/:id (Delete slide)
heroSlidesRouter.delete(
  '/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid slide identifier.' });
      }
      const slide = await HeroSlideModel.findByIdAndDelete(req.params.id);
      if (!slide) return res.status(404).json({ success: false, message: 'Slide not found' });

      await AuditLogModel.create({
        action: 'DELETE_HERO_IMAGE_SLIDE',
        module: 'Hero Image Slider',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Deleted hero slide "${slide.title || '(Banner Image)'}"`,
      });

      res.json({ success: true, message: 'Slide deleted successfully!' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
