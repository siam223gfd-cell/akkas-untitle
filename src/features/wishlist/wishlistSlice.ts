import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface WishlistItem {
  productId: string;
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  discountBadge?: string;
  image: string;
  rating?: number;
  reviewCount?: number | string;
  category?: string;
  inStock?: boolean;
}

interface WishlistState {
  items: WishlistItem[];
}

const STORAGE_KEY = 'aurelia_wishlist';

const DEFAULT_WISHLIST_ITEMS: WishlistItem[] = [
  {
    productId: 'airpods-pro-2',
    name: 'AirPods Pro 2',
    slug: 'airpods-pro-2',
    price: 24999,
    originalPrice: 36999,
    discountBadge: '-32%',
    image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=800&q=80',
    rating: 4.8,
    reviewCount: '12.5k reviews',
    category: 'Electronics',
    inStock: true,
  },
  {
    productId: 'smart-watch-series-10',
    name: 'Smart Watch Series 10',
    slug: 'smart-watch-series-10',
    price: 11999,
    originalPrice: 16999,
    discountBadge: '-29%',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
    rating: 4.7,
    reviewCount: '8.2k reviews',
    category: 'Electronics',
    inStock: true,
  },
  {
    productId: 'bluetooth-speaker-boom-360',
    name: 'Bluetooth Speaker Boom 360',
    slug: 'bluetooth-speaker-boom-360',
    price: 3999,
    originalPrice: 6499,
    discountBadge: '-38%',
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
    rating: 4.7,
    reviewCount: '11.2k reviews',
    category: 'Electronics',
    inStock: true,
  },
  {
    productId: 'urban-explorer-tech-backpack',
    name: 'Urban Explorer Tech Backpack',
    slug: 'urban-explorer-tech-backpack',
    price: 2999,
    originalPrice: 6499,
    discountBadge: '-54%',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
    rating: 4.6,
    reviewCount: '7.1k reviews',
    category: 'Computer & Accessories',
    inStock: true,
  },
];

function healWishlistItem(item: WishlistItem): WishlistItem {
  const legacyMap: Record<
    string,
    { productId: string; slug: string; name?: string; price?: number; originalPrice?: number }
  > = {
    'seed-airpods-pro-2': {
      productId: 'airpods-pro-2',
      slug: 'airpods-pro-2',
      price: 24999,
      originalPrice: 36999,
    },
    'seed-smart-watch-series-10': {
      productId: 'smart-watch-series-10',
      slug: 'smart-watch-series-10',
      price: 11999,
      originalPrice: 16999,
    },
    'seed-bluetooth-speaker': {
      productId: 'bluetooth-speaker-boom-360',
      slug: 'bluetooth-speaker-boom-360',
      name: 'Bluetooth Speaker Boom 360',
      price: 3999,
      originalPrice: 6499,
    },
    'seed-backpack-pro': {
      productId: 'urban-explorer-tech-backpack',
      slug: 'urban-explorer-tech-backpack',
      name: 'Urban Explorer Tech Backpack',
      price: 2999,
      originalPrice: 6499,
    },
  };

  const hit = legacyMap[item.productId];
  if (hit) {
    return {
      ...item,
      productId: hit.productId,
      slug: hit.slug,
      name: hit.name || item.name,
      price: hit.price ?? item.price,
      originalPrice: hit.originalPrice ?? item.originalPrice,
    };
  }
  return item;
}

const loadSavedWishlist = (): WishlistItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const healed = parsed.map(healWishlistItem);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(healed));
        return healed;
      }
      return [];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WISHLIST_ITEMS));
    return DEFAULT_WISHLIST_ITEMS;
  } catch {
    return DEFAULT_WISHLIST_ITEMS;
  }
};

const initialState: WishlistState = {
  items: loadSavedWishlist(),
};

function persistWishlist(items: WishlistItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error(e);
  }
}

export const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    addToWishlist: (state, action: PayloadAction<WishlistItem>) => {
      const exists = state.items.some(
        (i) => i.productId === action.payload.productId || (action.payload.slug && i.slug === action.payload.slug)
      );
      if (!exists) {
        state.items.push(action.payload);
        persistWishlist(state.items);
      }
    },

    removeFromWishlist: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.productId !== action.payload && i.slug !== action.payload);
      persistWishlist(state.items);
    },

    toggleWishlist: (state, action: PayloadAction<WishlistItem>) => {
      const index = state.items.findIndex(
        (i) => i.productId === action.payload.productId || (action.payload.slug && i.slug === action.payload.slug)
      );
      if (index > -1) {
        state.items.splice(index, 1);
      } else {
        state.items.push(action.payload);
      }
      persistWishlist(state.items);
    },

    clearWishlist: (state) => {
      state.items = [];
      persistWishlist([]);
    },

    setWishlistItems: (state, action: PayloadAction<WishlistItem[]>) => {
      state.items = action.payload;
      persistWishlist(state.items);
    },
  },
});

export const {
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  clearWishlist,
  setWishlistItems,
} = wishlistSlice.actions;

// Selectors
export const selectWishlistItems = (state: { wishlist: WishlistState }) => state.wishlist.items;
export const selectWishlistCount = (state: { wishlist: WishlistState }) => state.wishlist.items.length;
export const selectIsInWishlist = (productId: string, slug?: string) => (state: { wishlist: WishlistState }) =>
  state.wishlist.items.some((item) => item.productId === productId || (!!slug && item.slug === slug));

export default wishlistSlice.reducer;
