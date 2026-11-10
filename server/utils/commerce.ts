import crypto from 'crypto';
import { config } from '../config/env';
import { isDatabaseConnected } from '../database/connection';
import { CMSConfigModel } from '../database/models/CMS';
import type { OrderStatus } from '../database/models/Order';

export const BD_MOBILE_REGEX = /^(?:\+?88)?(01[3-9]\d{8})$/;
export const BD_POSTAL_CODE_REGEX = /^\d{4}$/;

export function sanitizePhoneDigits(phone: string): string {
  return phone.replace(/[\s\-().]/g, '').trim();
}

export function isValidBdPhone(phone?: string | null): boolean {
  if (!phone || typeof phone !== 'string') return false;
  return BD_MOBILE_REGEX.test(sanitizePhoneDigits(phone));
}

export function normalizeBdPhone(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '';
  const compact = sanitizePhoneDigits(phone);
  const match = compact.match(BD_MOBILE_REGEX);
  return match ? match[1] : compact;
}

export function isValidBdPostalCode(postalCode?: string | null): boolean {
  if (!postalCode || typeof postalCode !== 'string') return false;
  return BD_POSTAL_CODE_REGEX.test(postalCode.trim());
}

export interface StoreSettingsValues {
  storeName: string;
  tagline: string;
  supportPhone: string;
  supportEmail: string;
  currencySymbol: string;
  currencyCode: string;
  freeShippingThreshold: number;
  shippingDhaka: number;
  shippingOutsideDhaka: number;
  taxRate: number;
  paymentMethods: {
    cod: boolean;
    bkash: boolean;
    nagad: boolean;
    card: boolean;
  };
  socialLinks: {
    facebook: string;
    youtube: string;
    instagram: string;
    twitter: string;
    linkedin: string;
  };
  notifications: {
    newOrderEmail: boolean;
    lowStockAlert: boolean;
  };
}

export const DEFAULT_STORE_SETTINGS: StoreSettingsValues = {
  storeName: 'Aurelia',
  tagline: 'Shop Smart, Live Better',
  supportPhone: '+880 1234 567890',
  supportEmail: 'support@aurelia.com',
  currencySymbol: '৳',
  currencyCode: 'BDT',
  freeShippingThreshold: 1000,
  shippingDhaka: 60,
  shippingOutsideDhaka: 120,
  taxRate: 0,
  paymentMethods: {
    cod: true,
    bkash: true,
    nagad: true,
    card: true,
  },
  socialLinks: {
    facebook: 'https://facebook.com',
    youtube: 'https://youtube.com',
    instagram: 'https://instagram.com',
    twitter: 'https://twitter.com',
    linkedin: 'https://linkedin.com',
  },
  notifications: {
    newOrderEmail: true,
    lowStockAlert: true,
  },
};

export function mergeStoreSettings(raw?: Partial<StoreSettingsValues> | null): StoreSettingsValues {
  const s: any = raw || {};
  const toNonNegNumber = (val: unknown, fallback: number): number => {
    const n = Number(val);
    return val !== undefined && val !== null && val !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const taxRateRaw = toNonNegNumber(s.taxRate, DEFAULT_STORE_SETTINGS.taxRate);
  const taxRate = Math.min(100, Math.max(0, taxRateRaw));

  return {
    storeName: typeof s.storeName === 'string' && s.storeName.trim() ? s.storeName.trim() : DEFAULT_STORE_SETTINGS.storeName,
    tagline: typeof s.tagline === 'string' ? s.tagline : DEFAULT_STORE_SETTINGS.tagline,
    supportPhone: typeof s.supportPhone === 'string' ? s.supportPhone : DEFAULT_STORE_SETTINGS.supportPhone,
    supportEmail: typeof s.supportEmail === 'string' ? s.supportEmail : DEFAULT_STORE_SETTINGS.supportEmail,
    currencySymbol: typeof s.currencySymbol === 'string' && s.currencySymbol.trim() ? s.currencySymbol.trim() : DEFAULT_STORE_SETTINGS.currencySymbol,
    currencyCode: typeof s.currencyCode === 'string' && s.currencyCode.trim() ? s.currencyCode.trim() : DEFAULT_STORE_SETTINGS.currencyCode,
    freeShippingThreshold: toNonNegNumber(s.freeShippingThreshold, DEFAULT_STORE_SETTINGS.freeShippingThreshold),
    shippingDhaka: toNonNegNumber(s.shippingDhaka, DEFAULT_STORE_SETTINGS.shippingDhaka),
    shippingOutsideDhaka: toNonNegNumber(s.shippingOutsideDhaka, DEFAULT_STORE_SETTINGS.shippingOutsideDhaka),
    taxRate,
    paymentMethods: {
      cod: s.paymentMethods?.cod ?? DEFAULT_STORE_SETTINGS.paymentMethods.cod,
      bkash: s.paymentMethods?.bkash ?? DEFAULT_STORE_SETTINGS.paymentMethods.bkash,
      nagad: s.paymentMethods?.nagad ?? DEFAULT_STORE_SETTINGS.paymentMethods.nagad,
      card: s.paymentMethods?.card ?? DEFAULT_STORE_SETTINGS.paymentMethods.card,
    },
    socialLinks: {
      facebook: s.socialLinks?.facebook ?? DEFAULT_STORE_SETTINGS.socialLinks.facebook,
      youtube: s.socialLinks?.youtube ?? DEFAULT_STORE_SETTINGS.socialLinks.youtube,
      instagram: s.socialLinks?.instagram ?? DEFAULT_STORE_SETTINGS.socialLinks.instagram,
      twitter: s.socialLinks?.twitter ?? DEFAULT_STORE_SETTINGS.socialLinks.twitter,
      linkedin: s.socialLinks?.linkedin ?? DEFAULT_STORE_SETTINGS.socialLinks.linkedin,
    },
    notifications: {
      newOrderEmail: s.notifications?.newOrderEmail ?? DEFAULT_STORE_SETTINGS.notifications.newOrderEmail,
      lowStockAlert: s.notifications?.lowStockAlert ?? DEFAULT_STORE_SETTINGS.notifications.lowStockAlert,
    },
  };
}

export async function getEffectiveStoreSettings(): Promise<StoreSettingsValues> {
  if (!isDatabaseConnected()) {
    return mergeStoreSettings(DEFAULT_STORE_SETTINGS);
  }
  const doc = await CMSConfigModel.findOne().select('settings').lean();
  return mergeStoreSettings((doc as any)?.settings);
}

export function isDhakaLocation(division?: string | null, divisionId?: string | number | null): boolean {
  if (divisionId !== undefined && divisionId !== null && String(divisionId).trim() === '30') {
    return true;
  }
  const normalized = String(division || '').trim().toLowerCase();
  return normalized === 'dhaka' || normalized === 'ঢাকা';
}

export function calculateShippingFee(
  subtotal: number,
  location: { division?: string | null; divisionId?: string | number | null },
  settings: Pick<StoreSettingsValues, 'freeShippingThreshold' | 'shippingDhaka' | 'shippingOutsideDhaka'> = DEFAULT_STORE_SETTINGS
): number {
  if (subtotal <= 0) return 0;
  if (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold) {
    return 0;
  }
  return isDhakaLocation(location.division, location.divisionId)
    ? settings.shippingDhaka
    : settings.shippingOutsideDhaka;
}

export function calculateTax(taxableAmount: number, taxRate: number = 0): number {
  if (taxableAmount <= 0 || taxRate <= 0) return 0;
  return Math.round((taxableAmount * Math.min(100, Math.max(0, taxRate))) / 100);
}

export interface CouponCandidate {
  code?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  validFrom?: Date | string;
  validUntil?: Date | string;
  usageLimit?: number;
  usedCount?: number;
  isActive?: boolean;
}

export interface CouponEvaluationResult {
  valid: boolean;
  discount: number;
  message: string;
}

export function evaluateCoupon(
  coupon: CouponCandidate | null | undefined,
  subtotal: number,
  now: Date = new Date()
): CouponEvaluationResult {
  if (!coupon || coupon.isActive === false) {
    return { valid: false, discount: 0, message: 'Invalid or expired coupon code.' };
  }

  if (coupon.validFrom) {
    const start = new Date(coupon.validFrom);
    if (!Number.isNaN(start.getTime()) && start.getTime() > now.getTime()) {
      return { valid: false, discount: 0, message: 'This coupon is not active yet.' };
    }
  }

  if (coupon.validUntil) {
    const end = new Date(coupon.validUntil);
    if (!Number.isNaN(end.getTime()) && end.getTime() < now.getTime()) {
      return { valid: false, discount: 0, message: 'This coupon has expired.' };
    }
  }

  const limit = Number(coupon.usageLimit ?? 0);
  const used = Number(coupon.usedCount ?? 0);
  if (limit > 0 && used >= limit) {
    return { valid: false, discount: 0, message: 'This coupon has reached its maximum usage limit.' };
  }

  const minOrder = Number(coupon.minOrderAmount ?? 0);
  if (subtotal < minOrder) {
    return {
      valid: false,
      discount: 0,
      message: `Minimum order amount of ৳${minOrder.toLocaleString()} required for this coupon.`,
    };
  }

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = Math.round((subtotal * Number(coupon.discountValue || 0)) / 100);
    if (coupon.maxDiscount && coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
      discount = Number(coupon.maxDiscount);
    }
  } else {
    discount = Math.round(Number(coupon.discountValue || 0));
  }

  discount = Math.max(0, Math.min(discount, Math.max(0, subtotal)));
  return {
    valid: true,
    discount,
    message: `Coupon applied! You saved ৳${discount.toLocaleString()}`,
  };
}

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'packed', 'shipped', 'cancelled'],
  processing: ['packed', 'shipped', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return (ORDER_STATUS_TRANSITIONS[from] || []).includes(to);
}

export function createOrderReceiptToken(orderId: string, orderNumber: string): string {
  const payload = `${String(orderId)}:${String(orderNumber).toUpperCase()}`;
  return crypto.createHmac('sha256', config.jwtSecret).update(payload).digest('hex');
}

export function verifyOrderReceiptToken(
  token: string | undefined | null,
  orderId: string,
  orderNumber: string
): boolean {
  if (!token || typeof token !== 'string') return false;
  const expected = createOrderReceiptToken(orderId, orderNumber);
  const actualBuf = Buffer.from(token.trim(), 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}
