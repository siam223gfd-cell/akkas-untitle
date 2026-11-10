import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { OrderModel, OrderStatus, PaymentStatus } from '../../database/models/Order';
import { ProductModel } from '../../database/models/Product';
import { CouponModel } from '../../database/models/Coupon';
import { UserModel, IUserAddress } from '../../database/models/User';
import { AuthenticatedRequest, requireAuth, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { escapeRegex } from '../../utils/regex';
import { logAuditActivity } from '../../utils/auditLogger';
import { validateLocationHierarchy } from '../locations/locations.routes';
import {
  isValidBdPhone,
  normalizeBdPhone,
  isValidBdPostalCode,
  getEffectiveStoreSettings,
  calculateShippingFee,
  calculateTax,
  evaluateCoupon,
  canTransitionOrderStatus,
  createOrderReceiptToken,
  verifyOrderReceiptToken,
} from '../../utils/commerce';

export const ordersRouter = Router();

ordersRouter.use(requireDatabase);

const STAFF_ROLES = new Set([
  'super_admin',
  'admin',
  'order_manager',
  'inventory_manager',
  'catalog_manager',
  'customer_support',
  'finance',
]);

function isStaffRole(role?: string): boolean {
  return !!role && STAFF_ROLES.has(role);
}

const VALID_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
];

const VALID_PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];

// In-flight submission lock
const orderSubmissionLocks = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of orderSubmissionLocks.entries()) {
    if (now - timestamp > 60000) {
      orderSubmissionLocks.delete(key);
    }
  }
}, 120000).unref?.();

const checkoutOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().optional(),
        name: z.string().optional(),
        sku: z.string().optional(),
        price: z.number().optional(),
        quantity: z.number().int().min(1).max(100),
        options: z.record(z.string(), z.string()).optional(),
        variant: z.record(z.string(), z.string()).optional(),
        image: z.string().optional(),
      })
    )
    .min(1, 'At least one item is required in the cart to place an order'),
  shippingAddress: z.object({
    recipientName: z.string().trim().min(2, 'Recipient name is required'),
    phone: z.string().trim().min(6, 'Valid Bangladesh mobile number is required'),
    division: z.string().trim().min(2, 'Division is required'),
    divisionId: z.union([z.string(), z.number()]).optional(),
    district: z.string().trim().min(2, 'District is required'),
    districtId: z.union([z.string(), z.number()]).optional(),
    upazila: z.string().trim().min(2, 'Upazila/Thana is required'),
    upazilaId: z.union([z.string(), z.number()]).optional(),
    unionOrWard: z.string().optional(),
    unionId: z.union([z.string(), z.number()]).optional(),
    locality: z.string().optional(),
    house: z.string().optional(),
    road: z.string().optional(),
    postalCode: z.string().optional(),
    streetAddress: z.string().trim().min(3, 'Detailed delivery address is required'),
    deliveryInstructions: z.string().optional(),
    country: z.string().optional(),
  }),
  paymentMethod: z.enum(['cod', 'card', 'bkash', 'nagad']),
  couponCode: z.string().optional(),
  customerEmail: z.string().optional(),
  customerName: z.string().optional(),
  notes: z.string().optional(),
  saveAddressToAccount: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
});

const verifyPaymentSchema = z.object({
  transactionId: z.string().trim().min(4, 'Transaction ID must be at least 4 characters').max(100),
  payerPhone: z.string().trim().optional(),
  provider: z.string().trim().optional(),
  reference: z.string().trim().max(150).optional(),
  receiptToken: z.string().trim().optional(),
});

async function restoreOrderStock(
  items: { productId: string; variantId?: string; sku?: string; quantity: number }[]
): Promise<void> {
  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item.productId)) continue;
    if (item.variantId) {
      const mod = await ProductModel.updateOne(
        { _id: item.productId, 'variants.id': item.variantId },
        { $inc: { stock: item.quantity, 'variants.$.stock': item.quantity } }
      );
      if (mod.modifiedCount === 0) {
        await ProductModel.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
      }
    } else if (item.sku) {
      const mod = await ProductModel.updateOne(
        { _id: item.productId, 'variants.sku': item.sku },
        { $inc: { stock: item.quantity, 'variants.$.stock': item.quantity } }
      );
      if (mod.modifiedCount === 0) {
        await ProductModel.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
      }
    } else {
      await ProductModel.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
    }
  }
}

function buildOrderAdminFilter(queryParams: Record<string, any>): any {
  const filter: any = {};
  if (queryParams.status && queryParams.status !== 'all') {
    filter.orderStatus = queryParams.status;
  }
  if (queryParams.paymentStatus && queryParams.paymentStatus !== 'all') {
    filter.paymentStatus = queryParams.paymentStatus;
  }
  if (queryParams.paymentMethod && queryParams.paymentMethod !== 'all') {
    filter.paymentMethod = queryParams.paymentMethod;
  }
  if (queryParams.startDate || queryParams.endDate) {
    filter.createdAt = {};
    if (queryParams.startDate) {
      const d = new Date(String(queryParams.startDate));
      if (!Number.isNaN(d.getTime())) filter.createdAt.$gte = d;
    }
    if (queryParams.endDate) {
      const d = new Date(String(queryParams.endDate));
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = d;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }
  if (queryParams.search && String(queryParams.search).trim()) {
    const clean = escapeRegex(String(queryParams.search).trim());
    const regex = new RegExp(clean, 'i');
    filter.$or = [
      { orderNumber: regex },
      { customerName: regex },
      { customerEmail: regex },
      { customerPhone: regex },
      { 'shippingAddress.district': regex },
      { 'shippingAddress.upazila': regex },
      { 'paymentDetails.transactionId': regex },
    ];
  }
  return filter;
}

// POST /api/orders (Create order - supports both authenticated users and guests)
ordersRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const parse = checkoutOrderSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      message: parse.error.issues[0]?.message || 'Invalid checkout payload.',
      errors: parse.error.format(),
    });
  }

  const {
    items: cartItems,
    shippingAddress,
    paymentMethod,
    couponCode,
    saveAddressToAccount,
    idempotencyKey,
  } = parse.data;

  // Validate BD mobile phone and optional 4-digit postal code
  if (!isValidBdPhone(shippingAddress.phone)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid 11-digit Bangladesh mobile number (e.g. 01712345678).',
    });
  }

  if (shippingAddress.postalCode && shippingAddress.postalCode.trim() && !isValidBdPostalCode(shippingAddress.postalCode)) {
    return res.status(400).json({
      success: false,
      message: 'Postal code must be a valid 4-digit Bangladesh postal code.',
    });
  }

  const rawGuestEmail = (parse.data.customerEmail || (typeof req.body.email === 'string' ? req.body.email : '') || '').trim();
  if (!req.user && rawGuestEmail && !z.string().email().safeParse(rawGuestEmail).success) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid customer email address.',
    });
  }

  // Strict Bangladesh administrative hierarchy validation using bd-divisions-to-unions
  const geoValidation = validateLocationHierarchy(
    shippingAddress.divisionId !== undefined ? shippingAddress.divisionId : shippingAddress.division,
    shippingAddress.districtId !== undefined ? shippingAddress.districtId : shippingAddress.district,
    shippingAddress.upazilaId !== undefined ? shippingAddress.upazilaId : shippingAddress.upazila,
    shippingAddress.unionId !== undefined ? shippingAddress.unionId : shippingAddress.unionOrWard
  );

  if (!geoValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: geoValidation.message || 'Invalid Bangladesh delivery location combination.',
    });
  }

  const cleanIdempotencyKey = idempotencyKey?.trim() || undefined;
  const lockKey = cleanIdempotencyKey
    ? `idem:${cleanIdempotencyKey}`
    : `${req.user ? req.user.id : req.ip}:${normalizeBdPhone(shippingAddress.phone)}`;

  const now = Date.now();
  const existingLock = orderSubmissionLocks.get(lockKey);
  if (existingLock && now - existingLock < 30000) {
    return res.status(429).json({
      success: false,
      message: 'Your order request is currently being processed. Please avoid duplicate submissions.',
    });
  }
  orderSubmissionLocks.set(lockKey, now);

  const decrementedItems: { productId: string; variantId?: string; quantity: number }[] = [];
  let reservedCouponId: string | null = null;

  const rollbackReservations = async () => {
    for (const dec of decrementedItems) {
      if (dec.variantId) {
        const mod = await ProductModel.updateOne(
          { _id: dec.productId, 'variants.id': dec.variantId },
          { $inc: { stock: dec.quantity, 'variants.$.stock': dec.quantity } }
        );
        if (mod.modifiedCount === 0) {
          await ProductModel.updateOne({ _id: dec.productId }, { $inc: { stock: dec.quantity } });
        }
      } else {
        await ProductModel.updateOne({ _id: dec.productId }, { $inc: { stock: dec.quantity } });
      }
    }
    if (reservedCouponId) {
      await CouponModel.updateOne(
        { _id: reservedCouponId, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } }
      );
      reservedCouponId = null;
    }
  };

  try {
    // Idempotent duplicate check
    if (cleanIdempotencyKey) {
      const existingOrder = await OrderModel.findOne({ idempotencyKey: cleanIdempotencyKey }).lean();
      if (existingOrder) {
        return res.status(200).json({
          success: true,
          deduplicated: true,
          message: 'Order already placed for this checkout session.',
          order: existingOrder,
          receiptToken: createOrderReceiptToken(
            (existingOrder as any)._id.toString(),
            existingOrder.orderNumber
          ),
        });
      }
    }

    // Check store settings & enabled payment methods
    const settings = await getEffectiveStoreSettings();
    if (settings.paymentMethods?.[paymentMethod] === false) {
      return res.status(400).json({
        success: false,
        message: `Payment method "${paymentMethod.toUpperCase()}" is currently disabled.`,
      });
    }

    // Resolve every item strictly against active catalog products in MongoDB (no client price passthrough)
    let subtotal = 0;
    const resolvedItems: {
      productId: string;
      slug: string;
      rawInputId: string;
      variantId?: string;
      name: string;
      sku: string;
      price: number;
      quantity: number;
      image: string;
      options: Record<string, string>;
    }[] = [];

    const aggregatedQtyMap = new Map<string, number>();
    const parentQtyMap = new Map<string, number>();

    for (const item of cartItems) {
      let product: any = null;
      if (mongoose.Types.ObjectId.isValid(item.productId)) {
        product = await ProductModel.findById(item.productId).lean();
      } else {
        const cleanSlugOrSku = item.productId.replace(/^seed-/, '').trim();
        product = await ProductModel.findOne({
          $or: [
            { slug: item.productId.toLowerCase().trim() },
            { sku: item.productId.toUpperCase().trim() },
            { slug: cleanSlugOrSku.toLowerCase() },
            { sku: cleanSlugOrSku.toUpperCase() },
          ],
        }).lean();
      }

      if (!product || product.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: `Product "${item.name || item.productId}" is not available for purchase.`,
        });
      }

      let unitPrice = Number(product.salePrice ?? product.basePrice ?? 0);
      let availableStock = Number(product.stock ?? 0);
      let sku = product.sku;
      let itemName = product.name;
      let resolvedVariantId: string | undefined = undefined;
      let resolvedOptions: Record<string, string> = { ...(item.options || item.variant || {}) };
      let itemImage = product.images?.[0] || '';

      const requestedOptions = item.variant && Object.keys(item.variant).length ? item.variant : item.options;
      const hasVariantCriteria = Boolean(
        item.variantId ||
          (item.sku && item.sku !== product.sku) ||
          (requestedOptions && Object.keys(requestedOptions).length > 0)
      );

      if (hasVariantCriteria) {
        const variantsList: any[] = Array.isArray(product.variants) ? product.variants : [];
        const variant = variantsList.find((v: any) => {
          if (item.variantId && v.id === item.variantId) return true;
          if (item.sku && item.sku !== product.sku && v.sku === item.sku) return true;
          if (
            requestedOptions &&
            Object.keys(requestedOptions).length > 0 &&
            v.options &&
            Object.entries(requestedOptions).every(([k, val]) => v.options?.[k] === val)
          ) {
            return true;
          }
          return false;
        });

        if (item.variantId || (requestedOptions && Object.keys(requestedOptions).length > 0)) {
          if (!variant || variant.isActive === false) {
            return res.status(400).json({
              success: false,
              message: `Selected variant for "${product.name}" is unavailable or out of stock.`,
            });
          }
        }

        if (variant) {
          if (variant.isActive === false) {
            return res.status(400).json({
              success: false,
              message: `Selected variant "${variant.name}" for "${product.name}" is no longer available.`,
            });
          }
          if (typeof variant.price === 'number' && variant.price >= 0) {
            unitPrice = variant.price;
          }
          availableStock = Number(variant.stock ?? 0);
          sku = variant.sku || product.sku;
          itemName = `${product.name} (${variant.name})`;
          resolvedVariantId = variant.id;
          resolvedOptions = { ...(variant.options || {}), ...(resolvedOptions || {}) };
          if (variant.image) itemImage = variant.image;
        }
      }

      const pidStr = product._id.toString();
      const qtyKey = `${pidStr}::${resolvedVariantId || 'base'}`;
      const cumulativeQty = (aggregatedQtyMap.get(qtyKey) || 0) + item.quantity;
      aggregatedQtyMap.set(qtyKey, cumulativeQty);

      const parentCumulativeQty = (parentQtyMap.get(pidStr) || 0) + item.quantity;
      parentQtyMap.set(pidStr, parentCumulativeQty);

      if (availableStock < cumulativeQty || product.stock < parentCumulativeQty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${itemName}". Only ${Math.max(0, Math.min(availableStock, product.stock))} unit(s) remaining.`,
        });
      }

      subtotal += unitPrice * item.quantity;

      resolvedItems.push({
        productId: product._id.toString(),
        slug: product.slug,
        rawInputId: item.productId,
        variantId: resolvedVariantId,
        name: itemName,
        sku,
        price: unitPrice,
        quantity: item.quantity,
        image: itemImage,
        options: resolvedOptions,
      });
    }

    // Validate & atomically reserve coupon if supplied
    let discount = 0;
    let validCouponCode = '';
    if (couponCode && couponCode.trim()) {
      const normalizedCode = couponCode.toUpperCase().trim();
      const coupon = await CouponModel.findOne({ code: normalizedCode }).lean();
      const evaluation = evaluateCoupon(coupon as any, subtotal);
      if (!evaluation.valid || !coupon) {
        return res.status(400).json({
          success: false,
          message: evaluation.message || 'Invalid or expired coupon code.',
        });
      }

      const updatedCoupon = await CouponModel.findOneAndUpdate(
        {
          _id: (coupon as any)._id,
          isActive: true,
          $or: [
            { usageLimit: { $exists: false } },
            { usageLimit: { $lte: 0 } },
            { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
          ],
        },
        { $inc: { usedCount: 1 } },
        { new: true }
      );

      if (!updatedCoupon) {
        return res.status(409).json({
          success: false,
          message: 'This coupon has reached its maximum usage limit or is inactive.',
        });
      }

      reservedCouponId = (coupon as any)._id.toString();
      discount = evaluation.discount;
      validCouponCode = updatedCoupon.code;
    }

    // Dynamic shipping & tax from store settings
    const shippingFee = calculateShippingFee(
      subtotal,
      {
        division: geoValidation.divisionTitle || shippingAddress.division,
        divisionId: geoValidation.divisionId ?? shippingAddress.divisionId,
      },
      settings
    );
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = calculateTax(taxableAmount, settings.taxRate);
    const total = Math.max(0, taxableAmount + shippingFee + tax);

    // Atomic conditional stock decrement with rollback on failure
    for (const item of resolvedItems) {
      let mod: { modifiedCount: number };
      if (item.variantId) {
        mod = await ProductModel.updateOne(
          {
            _id: item.productId,
            status: 'active',
            stock: { $gte: item.quantity },
            variants: {
              $elemMatch: {
                id: item.variantId,
                isActive: { $ne: false },
                stock: { $gte: item.quantity },
              },
            },
          },
          {
            $inc: {
              stock: -item.quantity,
              'variants.$.stock': -item.quantity,
            },
          }
        );
      } else {
        mod = await ProductModel.updateOne(
          {
            _id: item.productId,
            status: 'active',
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } }
        );
      }

      if (mod.modifiedCount !== 1) {
        await rollbackReservations();
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for "${item.name}". Please adjust quantities and try again.`,
        });
      }

      decrementedItems.push({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const customerId = req.user ? req.user.id : `guest_${Date.now()}`;
    const customerName = req.user ? req.user.name : shippingAddress.recipientName;
    const customerEmail = req.user
      ? req.user.email
      : rawGuestEmail || 'guest@aurelia.com';

    const addressSnapshot = {
      recipientName: shippingAddress.recipientName,
      phone: shippingAddress.phone,
      division: geoValidation.divisionTitle || shippingAddress.division,
      divisionId: geoValidation.divisionId ?? shippingAddress.divisionId,
      district: geoValidation.districtTitle || shippingAddress.district,
      districtId: geoValidation.districtId ?? shippingAddress.districtId,
      upazila: geoValidation.upazilaTitle || shippingAddress.upazila,
      upazilaId: geoValidation.upazilaId ?? shippingAddress.upazilaId,
      unionOrWard: geoValidation.unionTitle || shippingAddress.unionOrWard || '',
      unionId: geoValidation.unionId ?? shippingAddress.unionId,
      locality: shippingAddress.locality || '',
      house: shippingAddress.house || '',
      road: shippingAddress.road || '',
      postalCode: shippingAddress.postalCode || '',
      streetAddress: shippingAddress.streetAddress,
      deliveryInstructions: shippingAddress.deliveryInstructions || parse.data.notes || '',
    };

    const orderItemsPayload = resolvedItems.map(({ slug: _s, rawInputId: _r, ...rest }) => rest);

    let newOrder: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `NOV-${dateStr}-${randomSuffix}`;
      try {
        newOrder = await OrderModel.create({
          orderNumber,
          ...(cleanIdempotencyKey ? { idempotencyKey: cleanIdempotencyKey } : {}),
          customerId,
          customerName,
          customerEmail,
          customerPhone: shippingAddress.phone,
          items: orderItemsPayload,
          shippingAddress: addressSnapshot,
          pricing: {
            subtotal,
            discount,
            shippingFee,
            tax,
            total,
            couponCode: validCouponCode || undefined,
          },
          paymentMethod,
          paymentStatus: 'pending',
          orderStatus: 'pending',
          timeline: [
            {
              status: 'pending',
              timestamp: new Date(),
              note: parse.data.notes
                ? `Order placed via ${paymentMethod.toUpperCase()} — ${parse.data.notes}`
                : `Order placed via ${paymentMethod.toUpperCase()}`,
              actor: customerName,
            },
          ],
        });
        break;
      } catch (createErr: any) {
        if (createErr?.code === 11000 && cleanIdempotencyKey && createErr?.keyPattern?.idempotencyKey) {
          await rollbackReservations();
          const existingOrder = await OrderModel.findOne({ idempotencyKey: cleanIdempotencyKey }).lean();
          if (existingOrder) {
            return res.status(200).json({
              success: true,
              deduplicated: true,
              message: 'Order already placed for this checkout session.',
              order: existingOrder,
              receiptToken: createOrderReceiptToken(
                (existingOrder as any)._id.toString(),
                existingOrder.orderNumber
              ),
            });
          }
        }
        if (createErr?.code === 11000 && createErr?.keyPattern?.orderNumber && attempt < 2) {
          continue;
        }
        await rollbackReservations();
        throw createErr;
      }
    }

    // Authenticated customer: remove only purchased items from cart & deduplicate saved address
    let updatedUserAddresses: IUserAddress[] | undefined = undefined;
    if (req.user) {
      try {
        const user = await UserModel.findById(req.user.id);
        if (user) {
          if (Array.isArray(user.cart) && user.cart.length > 0) {
            user.cart = user.cart.filter((c: any) => {
              const cid = String(c.productId || '').trim();
              const cvar = String(c.variantId || '');
              return !resolvedItems.some((item) => {
                const idMatch =
                  cid === item.productId ||
                  cid === item.slug ||
                  cid === item.rawInputId ||
                  cid === `seed-${item.slug}`;
                const varMatch = (cvar || '') === (item.variantId || '');
                return idMatch && varMatch;
              });
            });
          }

          const userAddressList: IUserAddress[] = user.addresses || [];
          const normalizedTargetPhone = normalizeBdPhone(addressSnapshot.phone);
          const existingIdx = userAddressList.findIndex(
            (a) =>
              normalizeBdPhone(a.phone) === normalizedTargetPhone &&
              a.district.toLowerCase().trim() === addressSnapshot.district.toLowerCase().trim() &&
              a.upazila.toLowerCase().trim() === addressSnapshot.upazila.toLowerCase().trim() &&
              a.streetAddress.toLowerCase().trim() === addressSnapshot.streetAddress.toLowerCase().trim()
          );

          if (existingIdx !== -1) {
            const target = userAddressList[existingIdx];
            target.recipientName = addressSnapshot.recipientName;
            target.divisionId = addressSnapshot.divisionId;
            target.districtId = addressSnapshot.districtId;
            target.upazilaId = addressSnapshot.upazilaId;
            target.unionId = addressSnapshot.unionId;
            target.unionOrWard = addressSnapshot.unionOrWard;
            target.locality = addressSnapshot.locality;
            target.house = addressSnapshot.house;
            target.road = addressSnapshot.road;
            target.postalCode = addressSnapshot.postalCode;
            target.deliveryInstructions = addressSnapshot.deliveryInstructions;
            await user.save();
          } else if (userAddressList.length === 0 || saveAddressToAccount !== false) {
            const isFirst = userAddressList.length === 0;
            userAddressList.push({
              recipientName: addressSnapshot.recipientName,
              phone: addressSnapshot.phone,
              division: addressSnapshot.division,
              divisionId: addressSnapshot.divisionId,
              district: addressSnapshot.district,
              districtId: addressSnapshot.districtId,
              upazila: addressSnapshot.upazila,
              upazilaId: addressSnapshot.upazilaId,
              unionOrWard: addressSnapshot.unionOrWard,
              unionId: addressSnapshot.unionId,
              locality: addressSnapshot.locality,
              house: addressSnapshot.house,
              road: addressSnapshot.road,
              postalCode: addressSnapshot.postalCode,
              streetAddress: addressSnapshot.streetAddress,
              deliveryInstructions: addressSnapshot.deliveryInstructions,
              label: isFirst ? 'Primary' : 'Saved Address',
              isDefault: isFirst,
            });
            user.addresses = userAddressList;
            await user.save();
          }
          updatedUserAddresses = user.addresses;
        }
      } catch (saveErr) {
        console.error('Failed to sync post-order user cart/address:', saveErr);
      }
    }

    const receiptToken = createOrderReceiptToken(newOrder._id.toString(), newOrder.orderNumber);

    res.status(201).json({
      success: true,
      message: 'Order created successfully!',
      order: newOrder,
      receiptToken,
      userAddresses: updatedUserAddresses,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to place order.' });
  } finally {
    orderSubmissionLocks.delete(lockKey);
  }
});

// POST /api/orders/:id/verify-payment (Verify digital/card transaction ID)
ordersRouter.post('/:id/verify-payment', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = verifyPaymentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        message: parse.error.issues[0]?.message || 'Invalid payment verification payload.',
        errors: parse.error.format(),
      });
    }

    const { transactionId, payerPhone, provider, reference, receiptToken } = parse.data;
    if (payerPhone && !isValidBdPhone(payerPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Payer mobile number must be a valid 11-digit Bangladesh number.',
      });
    }

    const idParam = req.params.id;
    const orderFilter = mongoose.Types.ObjectId.isValid(idParam)
      ? { _id: idParam }
      : { orderNumber: idParam.toUpperCase() };

    const order = await OrderModel.findOne(orderFilter).lean() as any;
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const tokenCandidate =
      receiptToken || (req.query.token as string) || (req.headers['x-receipt-token'] as string);
    const hasStaff = req.user && isStaffRole(req.user.role);
    const isOwner = req.user && order.customerId === req.user.id;
    const hasValidToken = verifyOrderReceiptToken(tokenCandidate, order._id.toString(), order.orderNumber);

    if (!hasStaff && !isOwner && !hasValidToken) {
      return res.status(req.user ? 403 : 401).json({
        success: false,
        message: 'Unauthorized payment verification request.',
      });
    }

    if (order.paymentMethod === 'cod') {
      return res.status(400).json({
        success: false,
        message: 'Cash on Delivery orders cannot be verified via online transaction.',
      });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment has already been verified for this order.',
      });
    }

    if (order.orderStatus === 'cancelled' || order.orderStatus === 'returned') {
      return res.status(400).json({
        success: false,
        message: `Cannot verify payment for a ${order.orderStatus} order.`,
      });
    }

    const cleanTxId = transactionId.trim();
    const dup = await OrderModel.findOne({
      'paymentDetails.transactionId': cleanTxId,
      _id: { $ne: order._id },
    }).lean();

    if (dup) {
      return res.status(409).json({
        success: false,
        message: 'This transaction ID has already been linked to another order.',
      });
    }

    const nextStatus: OrderStatus = order.orderStatus === 'pending' ? 'confirmed' : order.orderStatus;
    const actorName = req.user ? req.user.name : order.customerName;

    const updatedOrder = await OrderModel.findOneAndUpdate(
      {
        _id: order._id,
        paymentStatus: { $ne: 'paid' },
        orderStatus: { $nin: ['cancelled', 'returned'] },
      },
      {
        $set: {
          paymentStatus: 'paid',
          orderStatus: nextStatus,
          paymentDetails: {
            transactionId: cleanTxId,
            provider: provider || order.paymentMethod.toUpperCase(),
            reference: reference || '',
            payerPhone: payerPhone || order.customerPhone,
            verifiedAmount: order.pricing?.total || 0,
            verifiedAt: new Date(),
            verifiedBy: actorName,
          },
        },
        $push: {
          timeline: {
            status: nextStatus,
            timestamp: new Date(),
            note: `Payment verified via ${(provider || order.paymentMethod).toUpperCase()} (TxID: ${cleanTxId})`,
            actor: actorName,
          },
        },
      },
      { new: true }
    ).lean() as any;

    if (!updatedOrder) {
      return res.status(409).json({
        success: false,
        message: 'Order payment state changed concurrently. Please refresh and inspect the order.',
      });
    }

    res.json({
      success: true,
      message: 'Payment verified and order confirmed!',
      order: updatedOrder,
      receiptToken: createOrderReceiptToken(updatedOrder._id.toString(), updatedOrder.orderNumber),
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This transaction ID has already been linked to another order.',
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/stats (Admin / Finance order status & revenue KPI aggregation — MUST be before /:idOrNumber)
ordersRouter.get(
  '/stats',
  requireRole('super_admin', 'admin', 'order_manager', 'finance'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const baseFilter = buildOrderAdminFilter({ ...req.query, status: 'all' });

      const [orderStatusBuckets, paymentStatusBuckets, revenueAgg] = await Promise.all([
        OrderModel.aggregate([
          { $match: baseFilter },
          { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
        ]),
        OrderModel.aggregate([
          { $match: baseFilter },
          { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
        ]),
        OrderModel.aggregate([
          { $match: baseFilter },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalRevenue: {
                $sum: {
                  $cond: [
                    { $in: ['$orderStatus', ['cancelled', 'returned']] },
                    0,
                    { $ifNull: ['$pricing.total', 0] },
                  ],
                },
              },
              paidRevenue: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$paymentStatus', 'paid'] },
                        { $not: [{ $in: ['$orderStatus', ['cancelled', 'returned']] }] },
                      ],
                    },
                    { $ifNull: ['$pricing.total', 0] },
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

      const orderStatuses: Record<OrderStatus, number> = {
        pending: 0,
        confirmed: 0,
        processing: 0,
        packed: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        returned: 0,
      };
      for (const b of orderStatusBuckets) {
        if (b._id && b._id in orderStatuses) {
          orderStatuses[b._id as OrderStatus] = b.count;
        }
      }

      const paymentStatuses: Record<PaymentStatus, number> = {
        pending: 0,
        paid: 0,
        failed: 0,
        refunded: 0,
      };
      for (const b of paymentStatusBuckets) {
        if (b._id && b._id in paymentStatuses) {
          paymentStatuses[b._id as PaymentStatus] = b.count;
        }
      }

      const summary = revenueAgg[0] || { totalOrders: 0, totalRevenue: 0, paidRevenue: 0 };

      res.json({
        success: true,
        stats: {
          totalOrders: summary.totalOrders,
          totalRevenue: summary.totalRevenue,
          paidRevenue: summary.paidRevenue,
          orderStatuses,
          paymentStatuses,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/orders/my-orders (Customer orders with pagination, filter & search)
ordersRouter.get('/my-orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
    const skip = (page - 1) * limit;

    const query: any = { customerId: req.user!.id };
    if (req.query.status && req.query.status !== 'all') {
      query.orderStatus = String(req.query.status);
    }
    if (req.query.search && String(req.query.search).trim()) {
      const regex = new RegExp(escapeRegex(String(req.query.search).trim()), 'i');
      query.$or = [
        { orderNumber: regex },
        { 'items.name': regex },
        { 'shippingAddress.district': regex },
        { 'shippingAddress.upazila': regex },
      ];
    }

    const [orders, total] = await Promise.all([
      OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      OrderModel.countDocuments(query),
    ]);

    const ordersWithTokens = orders.map((order: any) => ({
      ...order,
      receiptToken: createOrderReceiptToken(order._id.toString(), order.orderNumber),
    }));

    res.json({
      success: true,
      orders: ordersWithTokens,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/:idOrNumber (Single order details - supports owner, staff, or signed receiptToken for guests)
ordersRouter.get('/:idOrNumber', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idOrNumber } = req.params;
    let order: any = await OrderModel.findOne({ orderNumber: idOrNumber.toUpperCase() }).lean();
    if (!order && mongoose.Types.ObjectId.isValid(idParamSafe(idOrNumber))) {
      order = await OrderModel.findById(idOrNumber).lean();
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const tokenCandidate =
      (req.query.token as string) || (req.headers['x-receipt-token'] as string);
    const hasStaff = req.user && isStaffRole(req.user.role);
    const isOwner = req.user && order.customerId === req.user.id;
    const hasValidToken = verifyOrderReceiptToken(
      tokenCandidate,
      order._id.toString(),
      order.orderNumber
    );

    if (!hasStaff && !isOwner && !hasValidToken) {
      return res.status(req.user ? 403 : 401).json({
        success: false,
        message: req.user
          ? 'Access denied.'
          : 'Please sign in or use a valid order receipt link to view this order.',
      });
    }

    res.json({
      success: true,
      order,
      receiptToken: createOrderReceiptToken(order._id.toString(), order.orderNumber),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function idParamSafe(v: string): string {
  return typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v) ? v : '';
}

// POST /api/orders/:id/cancel (Atomic cancellation + stock restoration + auto-refund for paid orders)
ordersRouter.post('/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const idFilter = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { orderNumber: req.params.id.toUpperCase() };

    const existing = await OrderModel.findOne(idFilter).lean() as any;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (existing.customerId !== req.user!.id && !isStaffRole(req.user!.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const reason = (req.body?.reason as string)?.trim() || 'Order cancelled by customer';

    // Atomic conditional transition: only succeeds once from pending or confirmed
    const preUpdateDoc = await OrderModel.findOneAndUpdate(
      {
        _id: existing._id,
        orderStatus: { $in: ['pending', 'confirmed'] },
      },
      {
        $set: { orderStatus: 'cancelled' },
        $push: {
          timeline: {
            status: 'cancelled',
            timestamp: new Date(),
            note: existing.paymentStatus === 'paid' ? `${reason} (Auto-marked refunded)` : reason,
            actor: req.user!.name,
          },
        },
      },
      { new: false }
    ).lean() as any;

    if (!preUpdateDoc) {
      const latest = await OrderModel.findById(existing._id).select('orderStatus').lean() as any;
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in status "${latest?.orderStatus || existing.orderStatus}". Please contact support.`,
      });
    }

    if (preUpdateDoc.paymentStatus === 'paid') {
      await OrderModel.updateOne(
        { _id: existing._id, orderStatus: 'cancelled', paymentStatus: 'paid' },
        { $set: { paymentStatus: 'refunded' } }
      );
    }

    await restoreOrderStock(preUpdateDoc.items || []);

    const finalOrder = await OrderModel.findById(existing._id).lean();
    res.json({ success: true, message: 'Order successfully cancelled', order: finalOrder });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders (Admin list all orders with filtering, search & sort)
ordersRouter.get(
  '/',
  requireRole('super_admin', 'admin', 'order_manager', 'finance'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const skip = (page - 1) * limit;

      const query = buildOrderAdminFilter(req.query as Record<string, any>);
      const sortParam = String(req.query.sort || 'newest');
      const sortSpec: Record<string, 1 | -1> =
        sortParam === 'oldest'
          ? { createdAt: 1 }
          : sortParam === 'amount_desc'
          ? { 'pricing.total': -1, createdAt: -1 }
          : sortParam === 'amount_asc'
          ? { 'pricing.total': 1, createdAt: -1 }
          : { createdAt: -1 };

      const [orders, total] = await Promise.all([
        OrderModel.find(query).sort(sortSpec).skip(skip).limit(limit).lean(),
        OrderModel.countDocuments(query),
      ]);

      res.json({
        success: true,
        orders,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/orders/:id/status (Admin update status with strict state machine & safe atomic stock restore)
ordersRouter.patch(
  '/:id/status',
  requireRole('super_admin', 'admin', 'order_manager'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, note, paymentStatus } = req.body as {
        status?: OrderStatus;
        note?: string;
        paymentStatus?: PaymentStatus;
      };

      if (status && !VALID_ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid order status "${status}".` });
      }
      if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
        return res.status(400).json({ success: false, message: `Invalid payment status "${paymentStatus}".` });
      }

      const idFilter = mongoose.Types.ObjectId.isValid(req.params.id)
        ? { _id: req.params.id }
        : { orderNumber: req.params.id.toUpperCase() };

      const existing = await OrderModel.findOne(idFilter).lean() as any;
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (status && !canTransitionOrderStatus(existing.orderStatus, status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid order status transition from "${existing.orderStatus}" to "${status}".`,
        });
      }

      const nextStatus: OrderStatus = status || existing.orderStatus;
      const isCancelling =
        status === 'cancelled' && existing.orderStatus !== 'cancelled' && existing.orderStatus !== 'returned';

      const setFields: any = {};
      if (status) {
        setFields.orderStatus = status;
      }
      if (paymentStatus) {
        setFields.paymentStatus = paymentStatus;
      } else if (isCancelling && existing.paymentStatus === 'paid') {
        setFields.paymentStatus = 'refunded';
      }

      if (note && note.trim()) {
        const cleanedNote = `[${new Date().toLocaleDateString()}] ${note.trim()}`;
        setFields.staffNotes = existing.staffNotes ? `${existing.staffNotes}\n${cleanedNote}` : cleanedNote;
      }

      const updateQuery: any = {};
      if (Object.keys(setFields).length > 0) {
        updateQuery.$set = setFields;
      }
      if (status) {
        updateQuery.$push = {
          timeline: {
            status: nextStatus,
            timestamp: new Date(),
            note: note?.trim() || `Status updated to ${nextStatus}`,
            actor: req.user!.name,
          },
        };
      }

      // Guard status update with current orderStatus to guarantee stock restoration cannot run twice concurrently
      const guardFilter: any = { _id: existing._id };
      if (status) {
        guardFilter.orderStatus = existing.orderStatus;
      }

      const updatedOrder = await OrderModel.findOneAndUpdate(guardFilter, updateQuery, { new: true }).lean() as any;
      if (!updatedOrder) {
        return res.status(409).json({
          success: false,
          message: 'Order status was modified concurrently. Please refresh and try again.',
        });
      }

      if (isCancelling) {
        await restoreOrderStock(existing.items || []);
      }

      await logAuditActivity({
        action: 'UPDATE_ORDER_STATUS',
        module: 'Orders & Fulfillment',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Updated order #${updatedOrder.orderNumber} status to "${updatedOrder.orderStatus}" (Payment: ${updatedOrder.paymentStatus})`,
        recordId: updatedOrder._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
        metadata: {
          orderNumber: updatedOrder.orderNumber,
          newStatus: updatedOrder.orderStatus,
          paymentStatus: updatedOrder.paymentStatus,
          total: updatedOrder.pricing?.total,
          customerName: updatedOrder.customerName,
        },
      });

      res.json({ success: true, message: 'Order status updated', order: updatedOrder });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);
