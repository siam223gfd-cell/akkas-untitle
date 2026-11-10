import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { ProductModel } from '../../database/models/Product';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { escapeRegex } from '../../utils/regex';
import { logAuditActivity } from '../../utils/auditLogger';

export const productsRouter = Router();

// Apply requireDatabase to all product routes
productsRouter.use(requireDatabase);

const productVariantSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.number().nonnegative().optional(),
  originalPrice: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().default(0),
  options: z.record(z.string(), z.string()).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  image: z.string().optional(),
  barcode: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

const highlightSchema = z.object({
  label: z.string(),
  value: z.string(),
  icon: z.string().optional(),
});

const specificationSchema = z.object({
  label: z.string(),
  value: z.string(),
  group: z.string().optional(),
});

const faqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const productInputSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters'),
  subtitle: z.string().optional(),
  slug: z.string().min(2, 'Valid slug is required'),
  sku: z.string().min(2, 'SKU is required'),
  description: z.string().min(5, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  brand: z.string().min(1, 'Brand is required'),
  basePrice: z.number().positive('Base price must be greater than 0'),
  salePrice: z.number().positive('Sale price must be greater than 0'),
  stock: z.number().int().nonnegative('Stock cannot be negative'),
  images: z.array(z.string()).min(1, 'At least one image is required'),
  variants: z.array(productVariantSchema).optional(),
  highlights: z.array(highlightSchema).optional(),
  specificationsTable: z.array(specificationSchema).optional(),
  faqs: z.array(faqSchema).optional(),
  specifications: z.record(z.string(), z.string()).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  badge: z.string().optional(),
  warranty: z.string().optional(),
  deliveryEstimate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  banglaKeywords: z.array(z.string()).optional(),
  isTopSelling: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  isBestRated: z.boolean().optional(),
  isTrending: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
});

// GET /api/products/suggestions?q=... (Autocomplete, limit max 8 with relevance ranking)
productsRouter.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const rawQ = typeof req.query.q === 'string' ? req.query.q : '';
    const q = rawQ.trim();
    if (!q || q.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    // Limit query length to prevent abusive regex workloads
    const sanitizedQuery = q.slice(0, 100);
    const safeRegex = new RegExp(escapeRegex(sanitizedQuery), 'i');

    const products = await ProductModel.find({
      status: 'active',
      $or: [
        { name: safeRegex },
        { brand: safeRegex },
        { category: safeRegex },
        { sku: safeRegex },
        { banglaKeywords: { $in: [safeRegex] } },
      ],
    })
      .select('name slug salePrice basePrice images category brand stock rating reviewCount badge')
      .limit(16)
      .lean();

    const lowerQ = sanitizedQuery.toLowerCase();

    // Compute relevance rank for each product
    const ranked = products
      .map((p) => {
        const lowerName = (p.name || '').toLowerCase();
        const lowerBrand = (p.brand || '').toLowerCase();
        const lowerCat = (p.category || '').toLowerCase();
        const lowerSku = (p.sku || '').toLowerCase();

        let rank = 100;
        if (lowerName === lowerQ) {
          rank = 1; // Exact name match
        } else if (lowerName.startsWith(lowerQ)) {
          rank = 2; // Name prefix match
        } else if (lowerName.includes(lowerQ)) {
          rank = 3; // Name partial match
        } else if (lowerBrand === lowerQ || lowerBrand.startsWith(lowerQ)) {
          rank = 4; // Brand match
        } else if (lowerCat === lowerQ || lowerCat.startsWith(lowerQ)) {
          rank = 5; // Category match
        } else if (lowerSku.includes(lowerQ)) {
          rank = 6; // SKU match
        } else {
          rank = 7; // Description or keyword match
        }

        return {
          product: p,
          rank,
        };
      })
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return (b.product.reviewCount || 0) - (a.product.reviewCount || 0);
      })
      .slice(0, 8);

    const formatted = ranked.map(({ product: p }) => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.salePrice,
      originalPrice: p.basePrice > p.salePrice ? p.basePrice : undefined,
      image: p.images?.[0] || '',
      category: p.category,
      brand: p.brand,
      stock: p.stock ?? 0,
      inStock: (p.stock ?? 0) > 0,
      rating: p.rating,
      badge: p.badge,
    }));

    res.json({ success: true, suggestions: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/trending
productsRouter.get('/trending', async (req: Request, res: Response) => {
  try {
    const topSelling = await ProductModel.find({ status: 'active' })
      .select('name slug salePrice basePrice images category brand stock rating reviewCount badge isTopSelling')
      .sort({ isTopSelling: -1, reviewCount: -1 })
      .limit(12)
      .lean();
    const newArrivals = await ProductModel.find({ status: 'active' })
      .select('name slug salePrice basePrice images category brand stock rating reviewCount badge isNewArrival createdAt')
      .sort({ isNewArrival: -1, createdAt: -1 })
      .limit(12)
      .lean();
    const bestRated = await ProductModel.find({ status: 'active' })
      .select('name slug salePrice basePrice images category brand stock rating reviewCount badge isBestRated')
      .sort({ isBestRated: -1, rating: -1 })
      .limit(12)
      .lean();

    res.json({
      success: true,
      data: {
        topSelling,
        newArrivals,
        bestRated,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const STAFF_PRODUCT_ROLES = new Set([
  'super_admin',
  'admin',
  'catalog_manager',
  'inventory_manager',
  'order_manager',
  'customer_support',
  'finance',
]);

const PRODUCT_LISTING_PROJECTION =
  '_id name subtitle slug sku brand category basePrice salePrice stock rating reviewCount isTrending isTopSelling isNewArrival isBestRated isFeatured badge status createdAt images';

const ALLOWED_SORT_OPTIONS = new Set([
  'newest',
  'price_asc',
  'price_desc',
  'rating',
  'popular',
  'discount',
]);

function encodeCursor(data: { id: string; v?: any; v2?: any }): string {
  try {
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  } catch {
    return '';
  }
}

function decodeCursor(cursorStr?: any): { id: string; v?: any; v2?: any } | null {
  if (!cursorStr || typeof cursorStr !== 'string') return null;
  try {
    const raw = Buffer.from(cursorStr, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.id === 'string' && mongoose.Types.ObjectId.isValid(parsed.id)) {
      return parsed;
    }
  } catch {
    // Malformed cursor
  }
  return null;
}

// GET /api/products (filter, search, sort, bounded 20-product pagination, keyset cursor)
productsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isStaff = !!(req.user && STAFF_PRODUCT_ROLES.has(req.user.role));
    const requestedStatus = String(req.query.status || '').toLowerCase().trim();

    // Public catalog browsing enforces a strict maximum batch size of 20 items
    const parsedLimit = parseInt(req.query.limit as string, 10);
    const limit = isStaff && requestedStatus === 'all'
      ? Math.min(100, Math.max(1, parsedLimit || 20))
      : Math.min(20, Math.max(1, parsedLimit || 20));

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const skip = (page - 1) * limit;

    const query: any = {};

    if (isStaff && requestedStatus === 'all') {
      // Return all product statuses for admin catalog
    } else if (isStaff && ['active', 'draft', 'archived'].includes(requestedStatus)) {
      query.status = requestedStatus;
    } else {
      query.status = 'active';
    }

    // Category filter
    const rawCategory = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    if (rawCategory && rawCategory !== 'all') {
      query.category = new RegExp(`^${escapeRegex(rawCategory)}$`, 'i');
    }

    // Brand filter
    const rawBrand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
    if (rawBrand && rawBrand !== 'all') {
      query.brand = new RegExp(`^${escapeRegex(rawBrand)}$`, 'i');
    }

    // Price range filter
    const minPriceNum = req.query.minPrice !== undefined ? Number(req.query.minPrice) : NaN;
    const maxPriceNum = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : NaN;
    if (Number.isFinite(minPriceNum) || Number.isFinite(maxPriceNum)) {
      query.salePrice = {};
      if (Number.isFinite(minPriceNum) && minPriceNum >= 0) query.salePrice.$gte = minPriceNum;
      if (Number.isFinite(maxPriceNum) && maxPriceNum >= 0) query.salePrice.$lte = maxPriceNum;
      if (Object.keys(query.salePrice).length === 0) delete query.salePrice;
    }

    // Rating filter
    const minRatingNum = req.query.minRating !== undefined ? Number(req.query.minRating) : NaN;
    if (Number.isFinite(minRatingNum) && minRatingNum >= 0 && minRatingNum <= 5) {
      query.rating = { $gte: minRatingNum };
    }

    // Search query with cross-lingual Bangla/English support
    const rawSearch = typeof req.query.q === 'string' ? req.query.q : '';
    const search = rawSearch.trim().slice(0, 100);
    if (search) {
      const safeRegex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { name: safeRegex },
        { brand: safeRegex },
        { category: safeRegex },
        { sku: safeRegex },
        { banglaKeywords: { $in: [safeRegex] } },
      ];
    }

    // Validated sorting
    const rawSort = String(req.query.sort || 'newest').toLowerCase();
    const sortParam = ALLOWED_SORT_OPTIONS.has(rawSort) ? rawSort : 'newest';

    const cursorData = decodeCursor(req.query.cursor);

    let products: any[] = [];
    let total = 0;

    if (sortParam === 'discount') {
      const aggPipeline: any[] = [
        { $match: query },
        {
          $addFields: {
            _discountRatio: {
              $cond: [
                { $and: [{ $gt: ['$basePrice', 0] }, { $gt: ['$basePrice', '$salePrice'] }] },
                { $divide: [{ $subtract: ['$basePrice', '$salePrice'] }, '$basePrice'] },
                0,
              ],
            },
          },
        },
      ];

      if (cursorData && typeof cursorData.v === 'number') {
        const cursorId = new mongoose.Types.ObjectId(cursorData.id);
        aggPipeline.push({
          $match: {
            $or: [
              { _discountRatio: { $lt: cursorData.v } },
              { _discountRatio: cursorData.v, _id: { $lt: cursorId } },
            ],
          },
        });
      } else if (skip > 0) {
        aggPipeline.push({ $skip: skip });
      }

      aggPipeline.push(
        { $sort: { _discountRatio: -1, createdAt: -1, _id: -1 } },
        { $limit: limit },
        {
          $project: {
            name: 1,
            subtitle: 1,
            slug: 1,
            sku: 1,
            brand: 1,
            category: 1,
            basePrice: 1,
            salePrice: 1,
            stock: 1,
            rating: 1,
            reviewCount: 1,
            isTrending: 1,
            isTopSelling: 1,
            isNewArrival: 1,
            isBestRated: 1,
            isFeatured: 1,
            badge: 1,
            status: 1,
            createdAt: 1,
            images: 1,
            _discountRatio: 1,
          },
        }
      );

      const [aggProducts, totalCount] = await Promise.all([
        ProductModel.aggregate(aggPipeline),
        ProductModel.countDocuments(query),
      ]);
      products = aggProducts;
      total = totalCount;
    } else {
      let sortOptions: any = { createdAt: -1, _id: -1 };
      let cursorCondition: any = null;

      if (cursorData) {
        const cursorId = new mongoose.Types.ObjectId(cursorData.id);
        switch (sortParam) {
          case 'price_asc':
            if (typeof cursorData.v === 'number') {
              cursorCondition = {
                $or: [
                  { salePrice: { $gt: cursorData.v } },
                  { salePrice: cursorData.v, _id: { $gt: cursorId } },
                ],
              };
            }
            break;
          case 'price_desc':
            if (typeof cursorData.v === 'number') {
              cursorCondition = {
                $or: [
                  { salePrice: { $lt: cursorData.v } },
                  { salePrice: cursorData.v, _id: { $lt: cursorId } },
                ],
              };
            }
            break;
          case 'rating':
            if (typeof cursorData.v === 'number') {
              const rCount = typeof cursorData.v2 === 'number' ? cursorData.v2 : 0;
              cursorCondition = {
                $or: [
                  { rating: { $lt: cursorData.v } },
                  { rating: cursorData.v, reviewCount: { $lt: rCount } },
                  { rating: cursorData.v, reviewCount: rCount, _id: { $lt: cursorId } },
                ],
              };
            }
            break;
          case 'popular':
            if (typeof cursorData.v === 'number') {
              const rRating = typeof cursorData.v2 === 'number' ? cursorData.v2 : 0;
              cursorCondition = {
                $or: [
                  { reviewCount: { $lt: cursorData.v } },
                  { reviewCount: cursorData.v, rating: { $lt: rRating } },
                  { reviewCount: cursorData.v, rating: rRating, _id: { $lt: cursorId } },
                ],
              };
            }
            break;
          case 'newest':
          default:
            if (cursorData.v) {
              const cursorDate = new Date(cursorData.v);
              cursorCondition = {
                $or: [
                  { createdAt: { $lt: cursorDate } },
                  { createdAt: cursorDate, _id: { $lt: cursorId } },
                ],
              };
            }
            break;
        }
      }

      switch (sortParam) {
        case 'price_asc':
          sortOptions = { salePrice: 1, _id: 1 };
          break;
        case 'price_desc':
          sortOptions = { salePrice: -1, _id: -1 };
          break;
        case 'rating':
          sortOptions = { rating: -1, reviewCount: -1, _id: -1 };
          break;
        case 'popular':
          sortOptions = { reviewCount: -1, rating: -1, _id: -1 };
          break;
        case 'newest':
        default:
          sortOptions = { createdAt: -1, _id: -1 };
          break;
      }

      const activeQuery = cursorCondition ? { ...query, ...cursorCondition } : query;

      let dbQuery = ProductModel.find(activeQuery)
        .select(PRODUCT_LISTING_PROJECTION)
        .sort(sortOptions)
        .limit(limit);

      if (!cursorCondition && skip > 0) {
        dbQuery = dbQuery.skip(skip);
      }

      const [retrievedProducts, totalCount] = await Promise.all([
        dbQuery.lean(),
        ProductModel.countDocuments(query),
      ]);

      products = retrievedProducts;
      total = totalCount;
    }

    const hasMore = products.length === limit;
    let nextCursor: string | null = null;

    if (hasMore && products.length > 0) {
      const lastProduct = products[products.length - 1];
      const lastId = lastProduct._id.toString();

      let v: any = undefined;
      let v2: any = undefined;

      switch (sortParam) {
        case 'price_asc':
        case 'price_desc':
          v = lastProduct.salePrice;
          break;
        case 'rating':
          v = lastProduct.rating;
          v2 = lastProduct.reviewCount;
          break;
        case 'popular':
          v = lastProduct.reviewCount;
          v2 = lastProduct.rating;
          break;
        case 'discount':
          v = lastProduct._discountRatio;
          break;
        case 'newest':
        default:
          v = lastProduct.createdAt instanceof Date ? lastProduct.createdAt.toISOString() : lastProduct.createdAt;
          break;
      }

      nextCursor = encodeCursor({ id: lastId, v, v2 });
    }

    // Available brands list for filters
    const availableBrands = await ProductModel.distinct('brand', { status: 'active' });

    res.json({
      success: true,
      products,
      hasMore,
      nextCursor,
      limit,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore,
        nextCursor,
      },
      availableBrands,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/:slugOrId
productsRouter.get('/:slugOrId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slugOrId } = req.params;
    const targetSlug = slugOrId.toLowerCase();
    const isStaff = !!(req.user && STAFF_PRODUCT_ROLES.has(req.user.role));

    let product = await ProductModel.findOne({ slug: targetSlug }).lean();
    if (!product && (targetSlug === 'samsung-galaxy-s25' || targetSlug === 'samsung-galaxy-s25-ultra')) {
      product = await ProductModel.findOne({
        slug: { $in: ['samsung-galaxy-s25-ultra', 'samsung-galaxy-s25'] },
      }).lean();
    }
    if (!product && mongoose.Types.ObjectId.isValid(slugOrId)) {
      product = await ProductModel.findById(slugOrId).lean();
    }

    if (!product || (product.status !== 'active' && !isStaff)) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Also fetch related products in the same category, or fallback to trending active products
    let related = await ProductModel.find({
      category: product.category,
      _id: { $ne: product._id },
      status: 'active',
    })
      .select(PRODUCT_LISTING_PROJECTION)
      .limit(4)
      .lean();

    if (related.length < 4) {
      const additional = await ProductModel.find({
        _id: { $nin: [product._id, ...related.map((r) => r._id)] },
        status: 'active',
      })
        .select(PRODUCT_LISTING_PROJECTION)
        .limit(4 - related.length)
        .lean();
      related = [...related, ...additional];
    }

    res.json({ success: true, product, related });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products (Admin create)
productsRouter.post(
  '/',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = productInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.format() });
      }

      const product = await ProductModel.create(parsed.data);

      await logAuditActivity({
        action: 'CREATE_PRODUCT',
        module: 'Products',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Created new catalog product "${product.name}" (SKU: ${product.sku}, Price: ৳${product.salePrice})`,
        recordId: product._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.status(201).json({ success: true, message: 'Product created successfully', product });
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ success: false, message: 'A product with this slug or SKU already exists.' });
      }
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/products/:id (Admin update)
productsRouter.put(
  '/:id',
  requireRole('super_admin', 'admin', 'catalog_manager', 'inventory_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = productInputSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.format() });
      }

      const query = mongoose.Types.ObjectId.isValid(req.params.id)
        ? { _id: req.params.id }
        : { slug: req.params.id.toLowerCase() };

      const product = await ProductModel.findOneAndUpdate(query, parsed.data, { new: true, runValidators: true });
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

      await logAuditActivity({
        action: 'UPDATE_PRODUCT',
        module: 'Products',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Updated product "${product.name}" (SKU: ${product.sku})`,
        recordId: product._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.json({ success: true, message: 'Product updated successfully', product });
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ success: false, message: 'A product with this slug or SKU already exists.' });
      }
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

// POST /api/products/:id/duplicate (Admin duplicate product)
productsRouter.post(
  '/:id/duplicate',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query = mongoose.Types.ObjectId.isValid(req.params.id)
        ? { _id: req.params.id }
        : { slug: req.params.id.toLowerCase() };

      const original = await ProductModel.findOne(query).lean();
      if (!original) return res.status(404).json({ success: false, message: 'Original product not found' });

      const rand = Math.floor(100 + Math.random() * 900);
      const duplicateData: any = {
        ...original,
        _id: new mongoose.Types.ObjectId(),
        name: `${original.name} (Copy)`,
        slug: `${original.slug}-copy-${rand}`,
        sku: `${original.sku}-CPY${rand}`,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      delete duplicateData.__v;

      const duplicateProduct = await ProductModel.create(duplicateData);

      await logAuditActivity({
        action: 'DUPLICATE_PRODUCT',
        module: 'Products',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Duplicated product "${original.name}" into "${duplicateProduct.name}" (SKU: ${duplicateProduct.sku})`,
        recordId: duplicateProduct._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.status(201).json({ success: true, message: 'Product duplicated successfully', product: duplicateProduct });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/products/:id (Admin delete/archive)
productsRouter.delete(
  '/:id',
  requireRole('super_admin', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query = mongoose.Types.ObjectId.isValid(req.params.id)
        ? { _id: req.params.id }
        : { slug: req.params.id.toLowerCase() };

      const product = await ProductModel.findOneAndDelete(query);
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

      await logAuditActivity({
        action: 'DELETE_PRODUCT',
        module: 'Products',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Deleted product "${product.name}" (SKU: ${product.sku})`,
        recordId: product._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
