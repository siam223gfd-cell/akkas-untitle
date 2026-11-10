import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CMSConfigModel, IHeroSlide, IBannerItem } from '../../database/models/CMS';
import { NewsletterModel } from '../../database/models/Newsletter';
import { AuditLogModel } from '../../database/models/AuditLog';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { isDatabaseConnected } from '../../database/connection';
import { DEFAULT_STORE_SETTINGS, mergeStoreSettings } from '../../utils/commerce';
import { isValidDestinationUrl, isValidImageUrl } from '../../utils/url';

export const cmsRouter = Router();

const storeSettingsPatchSchema = z.object({
  storeName: z.string().min(1).optional(),
  tagline: z.string().optional(),
  supportPhone: z.string().optional(),
  supportEmail: z.string().email().optional().or(z.literal('')),
  currencySymbol: z.string().min(1).optional(),
  currencyCode: z.string().min(1).optional(),
  freeShippingThreshold: z.number().min(0).optional(),
  shippingDhaka: z.number().min(0).optional(),
  shippingOutsideDhaka: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  paymentMethods: z
    .object({
      cod: z.boolean().optional(),
      bkash: z.boolean().optional(),
      nagad: z.boolean().optional(),
      card: z.boolean().optional(),
    })
    .optional(),
  socialLinks: z
    .object({
      facebook: z.string().optional(),
      youtube: z.string().optional(),
      instagram: z.string().optional(),
      twitter: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .optional(),
  notifications: z
    .object({
      newOrderEmail: z.boolean().optional(),
      lowStockAlert: z.boolean().optional(),
    })
    .optional(),
});

// GET /api/cms/config (Public homepage CMS configuration - graceful default if unconfigured)
cmsRouter.get('/config', async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.json({
        success: true,
        config: {
          heroTitle: 'Upgrade Your Life with',
          heroHighlight: 'Aurelia',
          heroSubtitle: 'Premium Quality. Unbeatable Prices. Fast delivery across Bangladesh.',
          heroBadge: 'Limited Time Offer ⚡',
          heroCtaText: 'Shop Now',
          heroCtaLink: '/shop',
          announcementText: 'Free Shipping on Orders Over ৳1,000 · 30 Days Easy Return · Secure Payment',
          announcementPhone: '+880 1234 567890',
          announcementEmail: 'support@aurelia.com',
          heroSlides: [
            {
              id: 'slide-1',
              badge: 'Limited Time Offer ⚡',
              title: 'Upgrade Your Life with',
              highlight: 'Aurelia',
              subtitle: 'Premium Quality. Unbeatable Prices. Fast delivery across Bangladesh.',
              discountBadge: 'Up to 50% OFF',
              ctaText: 'Shop Now',
              ctaLink: '/shop',
              desktopImage: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=600&q=80',
              order: 1,
              isEnabled: true,
            },
          ],
          banners: [
            {
              id: 'banner-summer-sale',
              title: 'Big Summer Sale',
              subtitle: 'Up to 70% OFF',
              tagline: "Don't Miss Out On Hot Electronics & Lifestyle!",
              ctaText: 'Shop the Sale',
              ctaLink: '/shop?sort=discount',
              imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=400&q=80',
              position: 'split_left',
              order: 1,
              isEnabled: true,
            },
            {
              id: 'banner-next-gen-tech',
              title: 'Next-Gen Tech',
              subtitle: 'Smarter. Faster. Better.',
              tagline: 'Exclusive discounts on ultrabooks & iPads',
              ctaText: 'Explore Tech',
              ctaLink: '/shop?category=electronics',
              imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&q=80',
              position: 'split_right',
              order: 2,
              isEnabled: true,
            },
            {
              id: 'banner-live-smarter',
              title: 'Live Smarter with Aurelia',
              subtitle: 'Discover the latest trends, unbeatable deals, and a better shopping experience curated for Bangladesh.',
              ctaText: 'Shop Now',
              ctaLink: '/shop',
              imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80',
              position: 'mid_banner',
              order: 3,
              isEnabled: true,
            },
          ],
          settings: mergeStoreSettings(DEFAULT_STORE_SETTINGS),
        },
      });
    }

    let configDoc = await CMSConfigModel.findOne().lean();
    if (!configDoc) {
      const created = await CMSConfigModel.create({});
      configDoc = created.toObject();
    }
    const normalizedConfig = {
      ...configDoc,
      settings: mergeStoreSettings((configDoc as any).settings),
    };
    res.json({ success: true, config: normalizedConfig });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/cms/config (Admin update homepage & promo ads)
cmsRouter.put(
  '/config',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        heroTitle,
        heroHighlight,
        heroSubtitle,
        heroBadge,
        heroCtaText,
        heroCtaLink,
        announcementText,
        announcementPhone,
        announcementEmail,
        sections,
        promotionalPlacement,
      } = req.body;

      if (heroCtaLink !== undefined && !isValidDestinationUrl(heroCtaLink)) {
        return res.status(400).json({ success: false, message: 'Invalid hero CTA link.' });
      }
      if (promotionalPlacement) {
        if (!isValidImageUrl(promotionalPlacement.imageUrl)) {
          return res.status(400).json({ success: false, message: 'Invalid promotional placement image URL.' });
        }
        if (!isValidDestinationUrl(promotionalPlacement.destinationUrl)) {
          return res.status(400).json({ success: false, message: 'Invalid promotional placement destination URL.' });
        }
      }

      let config = await CMSConfigModel.findOne();
      if (!config) config = new CMSConfigModel({});

      if (typeof heroTitle === 'string') config.heroTitle = heroTitle;
      if (typeof heroHighlight === 'string') config.heroHighlight = heroHighlight;
      if (typeof heroSubtitle === 'string') config.heroSubtitle = heroSubtitle;
      if (typeof heroBadge === 'string') config.heroBadge = heroBadge;
      if (typeof heroCtaText === 'string') config.heroCtaText = heroCtaText;
      if (typeof heroCtaLink === 'string') config.heroCtaLink = heroCtaLink.trim();
      if (typeof announcementText === 'string') config.announcementText = announcementText;
      if (typeof announcementPhone === 'string') config.announcementPhone = announcementPhone;
      if (typeof announcementEmail === 'string') config.announcementEmail = announcementEmail;
      if (Array.isArray(sections)) config.sections = sections;
      if (promotionalPlacement && typeof promotionalPlacement === 'object') {
        config.promotionalPlacement = {
          ...(config.promotionalPlacement as any),
          isEnabled: Boolean(promotionalPlacement.isEnabled),
          title: typeof promotionalPlacement.title === 'string' ? promotionalPlacement.title : config.promotionalPlacement?.title,
          subtitle: typeof promotionalPlacement.subtitle === 'string' ? promotionalPlacement.subtitle : config.promotionalPlacement?.subtitle,
          imageUrl: typeof promotionalPlacement.imageUrl === 'string' ? promotionalPlacement.imageUrl.trim() : config.promotionalPlacement?.imageUrl,
          destinationUrl: typeof promotionalPlacement.destinationUrl === 'string' ? promotionalPlacement.destinationUrl.trim() : config.promotionalPlacement?.destinationUrl,
          ctaText: typeof promotionalPlacement.ctaText === 'string' ? promotionalPlacement.ctaText : config.promotionalPlacement?.ctaText,
          startDate: promotionalPlacement.startDate || undefined,
          endDate: promotionalPlacement.endDate || undefined,
        };
      }

      await config.save();

      await AuditLogModel.create({
        action: 'UPDATE_HOMEPAGE_CONFIG',
        module: 'Website Content',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: 'Updated global homepage & announcement configurations',
      });

      res.json({ success: true, message: 'Homepage CMS settings saved!', config });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// HERO SLIDERS MANAGEMENT
cmsRouter.post(
  '/slides',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      let config = await CMSConfigModel.findOne();
      if (!config) config = await CMSConfigModel.create({});

      const newSlide: IHeroSlide = {
        id: `slide-${Date.now()}`,
        badge: req.body.badge || 'Limited Time Offer ⚡',
        title: req.body.title || 'Upgrade Your Life with',
        highlight: req.body.highlight || 'Aurelia',
        subtitle: req.body.subtitle || '',
        discountBadge: req.body.discountBadge || 'Up to 50% OFF',
        ctaText: req.body.ctaText || 'Shop Now',
        ctaLink: req.body.ctaLink || '/shop',
        desktopImage: req.body.desktopImage || 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=600&q=80',
        mobileImage: req.body.mobileImage || '',
        order: Number(req.body.order) || config.heroSlides.length + 1,
        isEnabled: req.body.isEnabled !== false,
      };

      config.heroSlides.push(newSlide);
      await config.save();

      await AuditLogModel.create({
        action: 'CREATE_HERO_SLIDE',
        module: 'Hero Slider',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Added new hero slide "${newSlide.title} ${newSlide.highlight}"`,
      });

      res.status(201).json({ success: true, message: 'Slide added successfully', slide: newSlide, heroSlides: config.heroSlides });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

cmsRouter.put(
  '/slides/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await CMSConfigModel.findOne();
      if (!config) return res.status(404).json({ success: false, message: 'CMS config not found' });

      const slideIndex = config.heroSlides.findIndex((s: any) => s.id === req.params.id || s._id?.toString() === req.params.id);
      if (slideIndex === -1) return res.status(404).json({ success: false, message: 'Slide not found' });

      Object.assign(config.heroSlides[slideIndex], req.body);
      await config.save();

      res.json({ success: true, message: 'Slide updated successfully', heroSlides: config.heroSlides });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

cmsRouter.delete(
  '/slides/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await CMSConfigModel.findOne();
      if (!config) return res.status(404).json({ success: false, message: 'CMS config not found' });

      config.heroSlides = config.heroSlides.filter((s: any) => s.id !== req.params.id && s._id?.toString() !== req.params.id);
      await config.save();

      res.json({ success: true, message: 'Slide removed', heroSlides: config.heroSlides });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PROMOTIONAL BANNERS MANAGEMENT
cmsRouter.post(
  '/banners',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      let config = await CMSConfigModel.findOne();
      if (!config) config = await CMSConfigModel.create({});

      const newBanner: IBannerItem = {
        id: `banner-${Date.now()}`,
        title: req.body.title || 'New Promotional Campaign',
        subtitle: req.body.subtitle || '',
        tagline: req.body.tagline || '',
        discountTag: req.body.discountTag || '',
        ctaText: req.body.ctaText || 'Explore Deals',
        ctaLink: req.body.ctaLink || '/shop',
        imageUrl: req.body.imageUrl || 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=400&q=80',
        position: req.body.position || 'split_left',
        order: Number(req.body.order) || config.banners.length + 1,
        isEnabled: req.body.isEnabled !== false,
      };

      config.banners.push(newBanner);
      await config.save();

      await AuditLogModel.create({
        action: 'CREATE_PROMO_BANNER',
        module: 'Banners',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Created new banner "${newBanner.title}"`,
      });

      res.status(201).json({ success: true, message: 'Banner added successfully', banner: newBanner, banners: config.banners });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

cmsRouter.put(
  '/banners/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await CMSConfigModel.findOne();
      if (!config) return res.status(404).json({ success: false, message: 'CMS config not found' });

      const bannerIndex = config.banners.findIndex((b: any) => b.id === req.params.id || b._id?.toString() === req.params.id);
      if (bannerIndex === -1) return res.status(404).json({ success: false, message: 'Banner not found' });

      Object.assign(config.banners[bannerIndex], req.body);
      await config.save();

      res.json({ success: true, message: 'Banner updated successfully', banners: config.banners });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

cmsRouter.delete(
  '/banners/:id',
  requireDatabase,
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await CMSConfigModel.findOne();
      if (!config) return res.status(404).json({ success: false, message: 'CMS config not found' });

      config.banners = config.banners.filter((b: any) => b.id !== req.params.id && b._id?.toString() !== req.params.id);
      await config.save();

      res.json({ success: true, message: 'Banner removed', banners: config.banners });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// STORE SETTINGS MANAGEMENT (General, Shipping, Payment, Tax)
cmsRouter.put(
  '/settings',
  requireDatabase,
  requireRole('super_admin', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = storeSettingsPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid store settings payload. Numeric fees must be non-negative and VAT tax rate must be 0–100%.',
          errors: parsed.error.format(),
        });
      }

      let config = await CMSConfigModel.findOne();
      if (!config) config = await CMSConfigModel.create({});

      const currentSettings =
        config.settings && typeof (config.settings as any).toObject === 'function'
          ? (config.settings as any).toObject()
          : config.settings || {};

      const merged = mergeStoreSettings({
        ...currentSettings,
        ...parsed.data,
        paymentMethods: {
          ...(currentSettings.paymentMethods || {}),
          ...(parsed.data.paymentMethods || {}),
        },
        socialLinks: {
          ...(currentSettings.socialLinks || {}),
          ...(parsed.data.socialLinks || {}),
        },
        notifications: {
          ...(currentSettings.notifications || {}),
          ...(parsed.data.notifications || {}),
        },
      });

      config.settings = merged;
      config.markModified('settings');
      await config.save();

      await AuditLogModel.create({
        action: 'UPDATE_STORE_SETTINGS',
        module: 'Settings',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: 'Updated store general settings, shipping rates, and payment methods',
      });

      res.json({ success: true, message: 'Store settings updated successfully', settings: mergeStoreSettings((config.settings as any).toObject ? (config.settings as any).toObject() : config.settings) });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/cms/newsletter (Public newsletter subscription)
cmsRouter.post('/newsletter', requireDatabase, async (req: Request, res: Response) => {
  try {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!z.string().email().safeParse(rawEmail).success) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const existing = await NewsletterModel.findOne({ email: rawEmail });
    if (existing) {
      return res.json({ success: true, message: 'You are already subscribed to our newsletter!' });
    }

    await NewsletterModel.create({ email: rawEmail });
    res.json({ success: true, message: 'Thank you for subscribing! Check your inbox for exclusive updates.' });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.json({ success: true, message: 'You are already subscribed to our newsletter!' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});
