import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CartItem, StoreSettings } from '../../types';

export interface AppliedCoupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discount: number;
  minOrderAmount?: number;
  maxDiscount?: number;
}

interface CartState {
  items: CartItem[];
  coupon: AppliedCoupon | null;
  isOpenDrawer: boolean;
}

function migrateLegacyCartItem(rawItem: CartItem): CartItem {
  const legacyMap: Record<
    string,
    { productId: string; name?: string; sku?: string; price?: number; originalPrice?: number }
  > = {
    'seed-airpods-pro-2': {
      productId: 'airpods-pro-2',
      sku: 'NOV-APP2-WHT',
      price: 24999,
      originalPrice: 36999,
    },
    'seed-samsung-galaxy-s25': {
      productId: 'samsung-galaxy-s25-ultra',
      name: 'Samsung Galaxy S25 Ultra 5G',
      sku: 'SG-S25U-001',
      price: 129999,
      originalPrice: 149999,
    },
    'seed-smart-watch-series-10': {
      productId: 'smart-watch-series-10',
      sku: 'NOV-SW10-46',
      price: 11999,
      originalPrice: 16999,
    },
  };

  const mapped = legacyMap[rawItem.productId];
  if (mapped) {
    return {
      ...rawItem,
      id: rawItem.variantId ? `${mapped.productId}-${rawItem.variantId}` : mapped.productId,
      productId: mapped.productId,
      name: mapped.name || rawItem.name,
      sku: mapped.sku || rawItem.sku,
      price: mapped.price ?? rawItem.price,
      originalPrice: mapped.originalPrice ?? rawItem.originalPrice,
      selected: rawItem.selected !== false,
    };
  }
  return {
    ...rawItem,
    selected: rawItem.selected !== false,
  };
}

const loadSavedCart = (): CartItem[] => {
  try {
    const raw = localStorage.getItem('novara_cart');
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const healed: CartItem[] = parsed.map((item: CartItem) => migrateLegacyCartItem(item));
        localStorage.setItem('novara_cart', JSON.stringify(healed));
        return healed;
      }
      return [];
    }
    return [];
  } catch {
    return [];
  }
};

const initialState: CartState = {
  items: loadSavedCart(),
  coupon: null,
  isOpenDrawer: false,
};

function persistCart(items: CartItem[]) {
  try {
    localStorage.setItem('novara_cart', JSON.stringify(items));
  } catch (e) {
    console.error(e);
  }
}

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    toggleItemSelection: (state, action: PayloadAction<string>) => {
      const item = state.items.find((i) => i.id === action.payload);
      if (item) {
        item.selected = item.selected === false ? true : false;
        persistCart(state.items);
      }
    },

    selectAllItems: (state, action: PayloadAction<boolean>) => {
      state.items.forEach((item) => {
        item.selected = action.payload;
      });
      persistCart(state.items);
    },

    addToCart: (
      state,
      action: PayloadAction<{
        productId: string;
        variantId?: string;
        name: string;
        subtitle?: string;
        sku: string;
        price: number;
        originalPrice?: number;
        quantity: number;
        image: string;
        options?: Record<string, string>;
        stock: number;
      }>
    ) => {
      const payload = action.payload;
      const incomingStock = Math.max(0, Number(payload.stock ?? 0));
      if (incomingStock <= 0) {
        return;
      }

      const itemId = payload.variantId ? `${payload.productId}-${payload.variantId}` : payload.productId;
      const existingIndex = state.items.findIndex((i) => i.id === itemId);
      const requestedQty = Math.max(1, Math.floor(Number(payload.quantity) || 1));

      if (existingIndex > -1) {
        const item = state.items[existingIndex];
        item.stock = incomingStock;
        item.price = payload.price;
        item.originalPrice = payload.originalPrice;
        item.image = payload.image || item.image;
        item.quantity = Math.min(incomingStock, item.quantity + requestedQty);
        item.selected = true;
      } else {
        state.items.push({
          id: itemId,
          productId: payload.productId,
          variantId: payload.variantId,
          name: payload.name,
          subtitle: payload.subtitle,
          sku: payload.sku,
          price: payload.price,
          originalPrice: payload.originalPrice,
          quantity: Math.min(incomingStock, requestedQty),
          image: payload.image,
          options: payload.options,
          stock: incomingStock,
          selected: true,
        });
      }

      persistCart(state.items);
    },

    updateQuantity: (state, action: PayloadAction<{ id: string; quantity: number }>) => {
      const { id, quantity } = action.payload;
      const item = state.items.find((i) => i.id === id);
      if (item) {
        if (item.stock <= 0 || quantity <= 0) {
          state.items = state.items.filter((i) => i.id !== id);
        } else {
          item.quantity = Math.min(item.stock, Math.max(1, quantity));
        }
      }
      persistCart(state.items);
    },

    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.id !== action.payload);
      persistCart(state.items);
    },

    removePurchasedItems: (state, action: PayloadAction<string[]>) => {
      const idSet = new Set(action.payload);
      state.items = state.items.filter((i) => !idSet.has(i.id));
      state.coupon = null;
      persistCart(state.items);
    },

    hydrateCartItems: (state, action: PayloadAction<CartItem[]>) => {
      const selectedMap = new Map(state.items.map((i) => [i.id, i.selected !== false]));
      const byPidMap = new Map(state.items.map((i) => [i.productId, i.selected !== false]));
      state.items = action.payload.map((item) => ({
        ...item,
        selected: selectedMap.get(item.id) ?? byPidMap.get(item.productId) ?? item.selected !== false,
      }));
      persistCart(state.items);
    },

    clearCart: (state) => {
      state.items = [];
      state.coupon = null;
      persistCart([]);
    },

    applyCoupon: (state, action: PayloadAction<AppliedCoupon>) => {
      state.coupon = action.payload;
    },

    removeCoupon: (state) => {
      state.coupon = null;
    },

    setCartDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.isOpenDrawer = action.payload;
    },
  },
});

export const {
  toggleItemSelection,
  selectAllItems,
  addToCart,
  updateQuantity,
  removeFromCart,
  removePurchasedItems,
  hydrateCartItems,
  clearCart,
  applyCoupon,
  removeCoupon,
  setCartDrawerOpen,
} = cartSlice.actions;

// Helpers
function computeCouponDiscount(subtotal: number, coupon: AppliedCoupon | null): number {
  if (!coupon || subtotal <= 0) return 0;
  if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) return 0;
  let d = 0;
  if (coupon.discountType === 'percentage') {
    d = Math.round((subtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscount && coupon.maxDiscount > 0 && d > coupon.maxDiscount) {
      d = coupon.maxDiscount;
    }
  } else {
    d = Math.round(coupon.discountValue);
  }
  return Math.max(0, Math.min(subtotal, d));
}

function isDhakaRegion(division?: string, divisionId?: string | number): boolean {
  if (divisionId !== undefined && divisionId !== null && String(divisionId).trim() === '30') {
    return true;
  }
  const normalized = (division || '').trim().toLowerCase();
  return normalized === 'dhaka' || normalized === 'ঢাকা';
}

function computeShipping(
  subtotal: number,
  division: string = 'Dhaka',
  divisionId?: string | number,
  settings?: Partial<StoreSettings>
): number {
  if (subtotal <= 0) return 0;
  const freeThreshold = settings?.freeShippingThreshold ?? 1000;
  const dhakaFee = settings?.shippingDhaka ?? 60;
  const outsideFee = settings?.shippingOutsideDhaka ?? 120;
  if (freeThreshold > 0 && subtotal >= freeThreshold) return 0;
  return isDhakaRegion(division, divisionId) ? dhakaFee : outsideFee;
}

function computeTax(taxable: number, taxRate: number = 0): number {
  if (taxable <= 0 || taxRate <= 0) return 0;
  return Math.round((taxable * Math.min(100, Math.max(0, taxRate))) / 100);
}

// Selectors
export const selectCartUniqueLinesCount = (state: { cart: CartState }) => state.cart.items.length;

export const selectCartSubtotal = (state: { cart: CartState }) =>
  state.cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0);

export const selectSelectedCartSubtotal = (state: { cart: CartState }) =>
  state.cart.items
    .filter((item) => item.selected !== false)
    .reduce((acc, item) => acc + item.price * item.quantity, 0);

export const selectCartDiscount = (state: { cart: CartState }) =>
  computeCouponDiscount(selectCartSubtotal(state), state.cart.coupon);

export const selectSelectedCartDiscount = (state: { cart: CartState }) =>
  computeCouponDiscount(selectSelectedCartSubtotal(state), state.cart.coupon);

export const selectCartShippingFee = (
  state: { cart: CartState },
  division: string = 'Dhaka',
  divisionId?: string | number,
  settings?: Partial<StoreSettings>
) => computeShipping(selectCartSubtotal(state), division, divisionId, settings);

export const selectSelectedCartShippingFee = (
  state: { cart: CartState },
  division: string = 'Dhaka',
  divisionId?: string | number,
  settings?: Partial<StoreSettings>
) => computeShipping(selectSelectedCartSubtotal(state), division, divisionId, settings);

export const selectSelectedCartTax = (state: { cart: CartState }, settings?: Partial<StoreSettings>) => {
  const subtotal = selectSelectedCartSubtotal(state);
  const discount = selectSelectedCartDiscount(state);
  return computeTax(Math.max(0, subtotal - discount), settings?.taxRate ?? 0);
};

export const selectCartTotal = (
  state: { cart: CartState },
  division: string = 'Dhaka',
  divisionId?: string | number,
  settings?: Partial<StoreSettings>
) => {
  const subtotal = selectCartSubtotal(state);
  if (subtotal === 0) return 0;
  const discount = selectCartDiscount(state);
  const shipping = computeShipping(subtotal, division, divisionId, settings);
  const tax = computeTax(Math.max(0, subtotal - discount), settings?.taxRate ?? 0);
  return Math.max(0, subtotal - discount + shipping + tax);
};

export const selectSelectedCartTotal = (
  state: { cart: CartState },
  division: string = 'Dhaka',
  divisionId?: string | number,
  settings?: Partial<StoreSettings>
) => {
  const subtotal = selectSelectedCartSubtotal(state);
  if (subtotal === 0) return 0;
  const discount = selectSelectedCartDiscount(state);
  const shipping = computeShipping(subtotal, division, divisionId, settings);
  const tax = computeTax(Math.max(0, subtotal - discount), settings?.taxRate ?? 0);
  return Math.max(0, subtotal - discount + shipping + tax);
};

export default cartSlice.reducer;
