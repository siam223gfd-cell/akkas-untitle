import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ReviewModel } from '../../database/models/Review';
import { OrderModel } from '../../database/models/Order';
import { ProductModel } from '../../database/models/Product';
import { AuthenticatedRequest, requireAuth, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { logAuditActivity } from '../../utils/auditLogger';

export const reviewsRouter = Router();

reviewsRouter.use(requireDatabase);

async function resolveProductAndKeys(identifier: string): Promise<{ product: any | null; matchKeys: string[] }> {
  const raw = String(identifier || '').trim();
  if (!raw) return { product: null, matchKeys: [] };

  const cleanSlug = raw.startsWith('seed-') ? raw.slice(5) : raw;
  let product: any = null;

  if (mongoose.Types.ObjectId.isValid(raw)) {
    product = await ProductModel.findById(raw).lean();
  } else {
    product = await ProductModel.findOne({
      $or: [
        { slug: raw.toLowerCase() },
        { slug: cleanSlug.toLowerCase() },
        { sku: raw.toUpperCase() },
      ],
    }).lean();
  }

  if (!product) {
    const fallback = Array.from(new Set([raw, cleanSlug, cleanSlug.toLowerCase()].filter(Boolean)));
    return { product: null, matchKeys: fallback };
  }

  const keys = Array.from(
    new Set([
      product._id.toString(),
      product.slug,
      `seed-${product.slug}`,
      raw,
    ].filter(Boolean))
  );
  return { product, matchKeys: keys };
}

async function recalculateProductRating(productIdentifier: string): Promise<void> {
  const { product, matchKeys } = await resolveProductAndKeys(productIdentifier);
  if (!product) return;

  const statsAgg = await ReviewModel.aggregate([
    { $match: { productId: { $in: matchKeys }, status: 'approved' } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  const count = statsAgg[0]?.count || 0;
  const rating = count > 0 ? Number(Number(statsAgg[0].avgRating).toFixed(1)) : 0;

  await ProductModel.findByIdAndUpdate(product._id, {
    rating,
    reviewCount: count,
  });
}

function isSafePhotoUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();
  if (/^\/(?!\/)/.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// GET /api/reviews (Public: approved reviews for a product or all approved)
reviewsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const query: any = { status: 'approved' };
    if (req.query.productId) {
      const { matchKeys } = await resolveProductAndKeys(String(req.query.productId));
      query.productId = { $in: matchKeys };
    }

    const [reviews, aggStats] = await Promise.all([
      ReviewModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ReviewModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
            sumRating: { $sum: '$rating' },
          },
        },
      ]),
    ]);

    const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalReviews = 0;
    let totalStars = 0;

    for (const bucket of aggStats) {
      const star = Number(bucket._id);
      if (star >= 1 && star <= 5) {
        ratingBreakdown[star] = bucket.count;
      }
      totalReviews += bucket.count;
      totalStars += bucket.sumRating || 0;
    }

    const averageRating = totalReviews > 0 ? Number((totalStars / totalReviews).toFixed(1)) : 0;

    res.json({
      success: true,
      reviews,
      stats: {
        totalReviews,
        averageRating,
        breakdown: ratingBreakdown,
      },
      pagination: {
        page,
        limit,
        total: totalReviews,
        totalPages: Math.ceil(totalReviews / limit) || 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/reviews (Customer submit review - requires auth & verifies purchase)
reviewsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId, rating, comment, photos } = req.body;
    const numericRating = Number(rating);
    const trimmedComment = typeof comment === 'string' ? comment.trim() : '';

    if (!productId || !Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: 'Valid product and rating between 1 and 5 are required.' });
    }
    if (trimmedComment.length < 3) {
      return res.status(400).json({ success: false, message: 'Review comment must be at least 3 characters.' });
    }

    const { product, matchKeys } = await resolveProductAndKeys(String(productId));
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const safePhotos = Array.isArray(photos)
      ? photos.filter((p) => isSafePhotoUrl(p)).slice(0, 6)
      : [];

    // Check if customer actually purchased this product in a confirmed/fulfilled order
    const hasOrdered = await OrderModel.findOne({
      customerId: req.user!.id,
      'items.productId': { $in: matchKeys },
      orderStatus: { $in: ['confirmed', 'processing', 'packed', 'shipped', 'delivered'] },
    }).lean();

    const newReview = await ReviewModel.create({
      productId: product.slug || product._id.toString(),
      userId: req.user!.id,
      userName: req.user!.name,
      rating: Math.round(numericRating),
      comment: trimmedComment,
      photos: safePhotos,
      isVerifiedPurchase: !!hasOrdered,
      status: 'approved',
    });

    await recalculateProductRating(product._id.toString());

    res.status(201).json({
      success: true,
      message: 'Thank you! Your review has been published.',
      review: newReview,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/reviews/:id/helpful (Increment helpful counter)
reviewsRouter.post('/:id/helpful', async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid review identifier.' });
    }
    const review = await ReviewModel.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpfulCount: 1 } },
      { new: true }
    );
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, helpfulCount: review.helpfulCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reviews/admin (Admin list all reviews for moderation)
reviewsRouter.get(
  '/admin',
  requireRole('super_admin', 'admin', 'customer_support'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviews = await ReviewModel.find().sort({ createdAt: -1 }).lean();
      res.json({ success: true, reviews });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/reviews/:id/status (Admin approve/reject)
reviewsRouter.patch(
  '/:id/status',
  requireRole('super_admin', 'admin', 'customer_support'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid review identifier.' });
      }
      const { status, reason } = req.body;
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be pending, approved, or rejected.' });
      }

      const review = await ReviewModel.findByIdAndUpdate(
        req.params.id,
        { status, rejectionReason: typeof reason === 'string' ? reason.trim() : undefined },
        { new: true }
      );
      if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

      await recalculateProductRating(review.productId);

      await logAuditActivity({
        action: status === 'approved' ? 'APPROVE_REVIEW' : 'REJECT_REVIEW',
        module: 'Reviews',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated'} review from "${review.userName}" (Rating: ${review.rating}★)`,
        recordId: review._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.json({ success: true, message: `Review ${status}`, review });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/reviews/:id (Admin delete review)
reviewsRouter.delete(
  '/:id',
  requireRole('super_admin', 'admin', 'customer_support'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid review identifier.' });
      }
      const review = await ReviewModel.findByIdAndDelete(req.params.id);
      if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

      await recalculateProductRating(review.productId);

      await logAuditActivity({
        action: 'DELETE_REVIEW',
        module: 'Reviews',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Deleted review from "${review.userName}" for product "${review.productId}"`,
        recordId: req.params.id,
        ipAddress: req.ip || '127.0.0.1',
      });

      res.json({ success: true, message: 'Review deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
