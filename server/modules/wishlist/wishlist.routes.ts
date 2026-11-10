import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { UserModel } from '../../database/models/User';
import { ProductModel } from '../../database/models/Product';
import { AuthenticatedRequest } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';

export const wishlistRouter = Router();

wishlistRouter.use(requireDatabase);

async function resolveProductByIdentifier(identifier: string) {
  if (!identifier || typeof identifier !== 'string') return null;
  const trimmed = identifier.trim();
  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    return ProductModel.findById(trimmed);
  }
  const cleanSlug = trimmed.startsWith('seed-') ? trimmed.slice(5) : trimmed;
  return ProductModel.findOne({
    $or: [
      { slug: trimmed.toLowerCase() },
      { slug: cleanSlug.toLowerCase() },
      { sku: trimmed.toUpperCase() },
    ],
  });
}

// GET /api/wishlist - Retrieve user's wishlist or validate list of IDs/slugs
wishlistRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user) {
      const user = await UserModel.findById(req.user.id).populate({
        path: 'wishlist',
        match: { status: { $ne: 'archived' } },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      return res.json({
        success: true,
        items: user.wishlist || [],
        count: user.wishlist?.length || 0,
      });
    }

    // For guest users passing ids/slugs: /api/wishlist?ids=id1,slug2
    const idsParam = req.query.ids as string;
    if (idsParam) {
      const rawTokens = idsParam
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      const objectIds = rawTokens.filter((id) => mongoose.Types.ObjectId.isValid(id));
      const slugs = rawTokens
        .filter((id) => !mongoose.Types.ObjectId.isValid(id))
        .map((id) => (id.startsWith('seed-') ? id.slice(5) : id).toLowerCase());

      const products = await ProductModel.find({
        status: { $ne: 'archived' },
        $or: [
          ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
          ...(slugs.length ? [{ slug: { $in: slugs } }] : []),
        ],
      }).lean();

      return res.json({
        success: true,
        items: products,
        count: products.length,
      });
    }

    res.json({ success: true, items: [], count: 0 });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch wishlist' });
  }
});

// POST /api/wishlist/toggle - Toggle product in wishlist
wishlistRouter.post('/toggle', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId } = req.body;
    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({ success: false, message: 'Product ID or slug is required' });
    }

    const product = await resolveProductByIdentifier(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (req.user) {
      const user = await UserModel.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (!user.wishlist) user.wishlist = [];

      const strId = product._id.toString();
      const existingIdx = user.wishlist.findIndex((id: any) => id.toString() === strId);

      let isWishlisted = false;
      if (existingIdx > -1) {
        user.wishlist.splice(existingIdx, 1);
        isWishlisted = false;
      } else {
        user.wishlist.push(product._id as any);
        isWishlisted = true;
      }

      await user.save();

      return res.json({
        success: true,
        isWishlisted,
        count: user.wishlist.length,
        product,
        message: isWishlisted ? 'Added to your wishlist' : 'Removed from your wishlist',
      });
    }

    // Guest response
    res.json({
      success: true,
      product,
      message: 'Product processed for wishlist',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to toggle wishlist' });
  }
});

// POST /api/wishlist/sync - Merge client wishlist items into authenticated user's database
wishlistRouter.post('/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required to sync wishlist' });
    }

    const { productIds } = req.body;
    if (!Array.isArray(productIds)) {
      return res.status(400).json({ success: false, message: 'productIds must be an array' });
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.wishlist) user.wishlist = [];

    const existingSet = new Set(user.wishlist.map((id: any) => id.toString()));
    for (const pid of productIds) {
      if (typeof pid !== 'string') continue;
      const resolved = await resolveProductByIdentifier(pid);
      if (resolved) {
        const resolvedStr = resolved._id.toString();
        if (!existingSet.has(resolvedStr)) {
          user.wishlist.push(resolved._id as any);
          existingSet.add(resolvedStr);
        }
      }
    }

    await user.save();

    const populatedUser = await UserModel.findById(req.user.id).populate({
      path: 'wishlist',
      match: { status: { $ne: 'archived' } },
    });

    res.json({
      success: true,
      items: populatedUser?.wishlist || [],
      count: populatedUser?.wishlist?.length || 0,
      message: 'Wishlist synchronized successfully',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to sync wishlist' });
  }
});

// DELETE /api/wishlist/:productId - Remove item from wishlist
wishlistRouter.delete('/:productId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId } = req.params;
    if (!req.user) {
      return res.json({ success: true, message: 'Removed from local wishlist' });
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const resolved = await resolveProductByIdentifier(productId);
    const targetId = resolved ? resolved._id.toString() : productId;

    if (user.wishlist) {
      user.wishlist = user.wishlist.filter((id: any) => id.toString() !== targetId && id.toString() !== productId);
      await user.save();
    }

    res.json({
      success: true,
      message: 'Removed from wishlist',
      count: user.wishlist?.length || 0,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to remove from wishlist' });
  }
});

// DELETE /api/wishlist - Clear entire wishlist
wishlistRouter.delete('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user) {
      const user = await UserModel.findById(req.user.id);
      if (user) {
        user.wishlist = [];
        await user.save();
      }
    }

    res.json({
      success: true,
      message: 'Wishlist cleared successfully',
      count: 0,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to clear wishlist' });
  }
});
