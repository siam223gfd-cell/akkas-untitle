import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { CouponModel } from '../../database/models/Coupon';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { logAuditActivity } from '../../utils/auditLogger';
import { evaluateCoupon } from '../../utils/commerce';

export const couponsRouter = Router();

couponsRouter.use(requireDatabase);

const couponInputSchema = z
  .object({
    code: z.string().min(2, 'Coupon code must be at least 2 characters').max(40),
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.number().min(0, 'Discount value must be non-negative'),
    minOrderAmount: z.number().min(0).optional().default(0),
    maxDiscount: z.number().min(0).optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date(),
    usageLimit: z.number().int().min(1).optional().default(1000),
    isActive: z.boolean().optional().default(true),
  })
  .refine(
    (data) => data.discountType !== 'percentage' || data.discountValue <= 100,
    { message: 'Percentage discount cannot exceed 100%', path: ['discountValue'] }
  )
  .refine(
    (data) => !data.validFrom || data.validFrom <= data.validUntil,
    { message: 'validFrom must be before validUntil', path: ['validUntil'] }
  );

// POST /api/coupons/validate (Public / Customer)
couponsRouter.post('/validate', async (req: Request, res: Response) => {
  try {
    const { code, subtotal } = req.body;
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const normalizedCode = code.toUpperCase().trim();
    const coupon = await CouponModel.findOne({ code: normalizedCode }).lean();

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or expired coupon code.' });
    }

    const orderSubtotal = Math.max(0, Number(subtotal) || 0);
    const evaluation = evaluateCoupon(coupon as any, orderSubtotal);

    if (!evaluation.valid) {
      const status = !coupon.isActive || (coupon.validUntil && new Date(coupon.validUntil) < new Date()) ? 404 : 400;
      return res.status(status).json({
        success: false,
        message: evaluation.message,
      });
    }

    res.json({
      success: true,
      message: evaluation.message,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscount: coupon.maxDiscount,
        discount: evaluation.discount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/coupons (Admin list)
couponsRouter.get(
  '/',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const coupons = await CouponModel.find().sort({ createdAt: -1 }).lean();
      res.json({ success: true, coupons });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/coupons (Admin create)
couponsRouter.post(
  '/',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = couponInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message || 'Invalid coupon payload',
          errors: parsed.error.format(),
        });
      }

      const coupon = await CouponModel.create({
        ...parsed.data,
        code: parsed.data.code.toUpperCase().trim(),
      });

      await logAuditActivity({
        action: 'CREATE_COUPON',
        module: 'Promotions & Coupons',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Created promotional coupon "${coupon.code}" (${coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `৳${coupon.discountValue}`} discount)`,
        recordId: coupon._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.status(201).json({ success: true, message: 'Coupon created successfully', coupon });
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ success: false, message: 'A coupon with this code already exists.' });
      }
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/coupons/:id (Admin update)
couponsRouter.put(
  '/:id',
  requireRole('super_admin', 'admin', 'catalog_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid coupon identifier.' });
      }
      const parsed = couponInputSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message || 'Invalid coupon update payload',
          errors: parsed.error.format(),
        });
      }

      const updates: any = { ...parsed.data };
      if (updates.code) updates.code = updates.code.toUpperCase().trim();

      const coupon = await CouponModel.findByIdAndUpdate(req.params.id, updates, { new: true });
      if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

      await logAuditActivity({
        action: 'UPDATE_COUPON',
        module: 'Promotions & Coupons',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Updated promotional coupon "${coupon.code}"`,
        recordId: coupon._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.json({ success: true, message: 'Coupon updated successfully', coupon });
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ success: false, message: 'A coupon with this code already exists.' });
      }
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

// DELETE /api/coupons/:id (Admin delete)
couponsRouter.delete(
  '/:id',
  requireRole('super_admin', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid coupon identifier.' });
      }
      const coupon = await CouponModel.findByIdAndDelete(req.params.id);
      if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

      await logAuditActivity({
        action: 'DELETE_COUPON',
        module: 'Promotions & Coupons',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Deleted promotional coupon "${coupon.code}"`,
        recordId: req.params.id,
        ipAddress: req.ip || '127.0.0.1',
      });

      res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
