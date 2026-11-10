import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ProductModel } from '../../database/models/Product';
import { CouponModel } from '../../database/models/Coupon';
import { UserModel } from '../../database/models/User';
import { AuthenticatedRequest } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import {
  calculateShippingFee,
  calculateTax,
  evaluateCoupon,
  getEffectiveStoreSettings,
} from '../../utils/commerce';

export const cartRouter = Router();

cartRouter.use(requireDatabase);

// POST /api/cart/validate - Re-validate cart items against live database prices, variants, coupons, settings, and stock
cartRouter.post('/validate', async (req: Request, res: Response) => {
  try {
    const { items, division = 'Dhaka', divisionId, couponCode } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array is required' });
    }

    const settings = await getEffectiveStoreSettings();
    const validatedItems = [];
    let subtotal = 0;
    const errors: string[] = [];
    const parentRemainingMap = new Map<string, number>();

    for (const item of items) {
      if (!item?.productId) continue;

      const lookupId = String(item.productId).trim();
      const strippedSlug = lookupId.startsWith('seed-') ? lookupId.slice(5) : lookupId;

      let product = null;
      if (mongoose.Types.ObjectId.isValid(lookupId)) {
        product = await ProductModel.findById(lookupId).lean();
      } else {
        product = await ProductModel.findOne({
          $or: [
            { slug: lookupId.toLowerCase() },
            { slug: strippedSlug.toLowerCase() },
            { sku: lookupId.toUpperCase() },
          ],
        }).lean();
      }

      if (!product || product.status !== 'active') {
        errors.push(`Product "${item.name || item.productId}" is no longer available.`);
        continue;
      }

      let price = Number(product.salePrice);
      let stock = Number(product.stock ?? 0);
      let sku = product.sku;
      let name = product.name;
      let image = product.images?.[0] || '';
      let resolvedVariantId: string | undefined = undefined;
      let resolvedOptions = item.options;

      if (item.variantId) {
        const variant = (product.variants || []).find(
          (v: any) => v.id === item.variantId && v.isActive !== false
        );
        if (!variant) {
          errors.push(`Selected variant for "${product.name}" is unavailable or inactive.`);
          continue;
        }
        if (variant.price !== undefined && variant.price > 0) price = Number(variant.price);
        stock = Math.min(Number(product.stock ?? 0), Number(variant.stock ?? 0));
        sku = variant.sku;
        name = `${product.name} (${variant.name})`;
        if (variant.image) image = variant.image;
        resolvedVariantId = variant.id;
        if (!resolvedOptions && variant.options) {
          resolvedOptions =
            variant.options instanceof Map
              ? Object.fromEntries(variant.options)
              : variant.options;
        }
      }

      const pidStr = product._id.toString();
      const remainingParentStock = parentRemainingMap.has(pidStr)
        ? parentRemainingMap.get(pidStr)!
        : Number(product.stock ?? 0);
      const effectiveStock = Math.max(0, Math.min(stock, remainingParentStock));

      if (effectiveStock <= 0) {
        errors.push(`"${name}" is currently out of stock.`);
        continue;
      }

      let quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      if (quantity > effectiveStock) {
        errors.push(`Adjusted quantity for "${name}" to maximum available stock (${effectiveStock}).`);
        quantity = effectiveStock;
      }

      parentRemainingMap.set(pidStr, Math.max(0, remainingParentStock - quantity));

      const isSelected = item.selected !== false;
      const itemTotal = price * quantity;
      if (isSelected) {
        subtotal += itemTotal;
      }

      validatedItems.push({
        id: resolvedVariantId ? `${product._id.toString()}-${resolvedVariantId}` : product._id.toString(),
        productId: product._id.toString(),
        variantId: resolvedVariantId,
        name,
        sku,
        price,
        originalPrice: product.basePrice > price ? product.basePrice : undefined,
        quantity,
        stock: effectiveStock,
        image,
        options: resolvedOptions,
        itemTotal,
        selected: isSelected,
      });
    }

    let discount = 0;
    let appliedCoupon: string | undefined = undefined;
    let couponError: string | undefined = undefined;
    if (subtotal > 0 && couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      const couponDoc = await CouponModel.findOne({ code: couponCode.toUpperCase().trim() }).lean();
      const couponResult = evaluateCoupon(couponDoc as any, subtotal);
      if (couponResult.valid) {
        discount = couponResult.discount;
        appliedCoupon = (couponDoc as any).code;
      } else {
        couponError = couponResult.message;
        errors.push(couponResult.message);
      }
    }

    const shippingFee = subtotal > 0 ? calculateShippingFee(subtotal, { division, divisionId }, settings) : 0;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = subtotal > 0 ? calculateTax(taxableAmount, settings.taxRate) : 0;
    const total = Math.max(0, taxableAmount + shippingFee + tax);

    res.json({
      success: true,
      items: validatedItems,
      subtotal,
      discount,
      couponCode: appliedCoupon,
      couponError,
      shippingFee,
      freeShippingThreshold: settings.freeShippingThreshold,
      isFreeShipping: subtotal > 0 && shippingFee === 0,
      tax,
      taxRate: settings.taxRate,
      total,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Cart validation failed' });
  }
});

// POST /api/cart/sync - Persist cart items for authenticated user
cartRouter.post('/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.json({ success: true, message: 'Guest cart retained on client' });
    }

    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array is required' });
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.cart = items
      .filter((i) => i && i.productId)
      .map((i) => ({
        productId: String(i.productId),
        variantId: i.variantId ? String(i.variantId) : undefined,
        quantity: Math.max(1, parseInt(i.quantity, 10) || 1),
        options: i.options && typeof i.options === 'object' ? i.options : undefined,
      }));

    await user.save();

    res.json({
      success: true,
      message: 'Cart synchronized with user account',
      cart: user.cart,
      cartCount: user.cart.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to sync cart' });
  }
});

// GET /api/cart - Retrieve authenticated user's cart from database
cartRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.json({ success: true, cart: [], items: [] });
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      cart: user.cart || [],
      items: user.cart || [],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch cart' });
  }
});
