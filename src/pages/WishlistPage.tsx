import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  removeFromWishlist,
  clearWishlist,
  setWishlistItems,
  selectWishlistItems,
  selectWishlistCount,
  WishlistItem,
} from '../features/wishlist/wishlistSlice';
import { addToCart } from '../features/cart/cartSlice';
import { addToast } from '../features/ui/uiSlice';
import { apiRequest } from '../services/api';
import { Product } from '../types';
import { ConfirmDialog } from '../components/admin/common/modal';
import {
  Heart,
  ShoppingCart,
  Trash2,
  Star,
  ArrowRight,
  Gift,
  ShoppingBag,
  Package,
} from 'lucide-react';

function mapProductToWishlistItem(prod: Product): WishlistItem {
  const hasDiscount = prod.basePrice > prod.salePrice;
  const pct = hasDiscount ? Math.round(((prod.basePrice - prod.salePrice) / prod.basePrice) * 100) : 0;
  return {
    productId: prod._id,
    name: prod.name,
    slug: prod.slug,
    price: prod.salePrice,
    originalPrice: hasDiscount ? prod.basePrice : undefined,
    discountBadge: pct > 0 ? `-${pct}%` : prod.badge,
    image: prod.images?.[0] || '',
    rating: prod.rating || 0,
    reviewCount:
      prod.reviewCount >= 1000
        ? `${(prod.reviewCount / 1000).toFixed(1)}k reviews`
        : `${prod.reviewCount || 0} reviews`,
    category: prod.category,
    inStock: (prod.stock ?? 0) > 0,
  };
}

export const WishlistPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const wishlistItems = useAppSelector(selectWishlistItems);
  const wishlistCount = useAppSelector(selectWishlistCount);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (isAuthenticated) {
      apiRequest('/wishlist').then((res) => {
        if (!cancelled && res.success && Array.isArray(res.items)) {
          dispatch(setWishlistItems(res.items.map(mapProductToWishlistItem)));
        }
      });
    } else if (wishlistItems.length > 0) {
      const ids = wishlistItems.map((i) => i.productId || i.slug).filter(Boolean).join(',');
      if (ids) {
        apiRequest(`/wishlist?ids=${encodeURIComponent(ids)}`).then((res) => {
          if (!cancelled && res.success && Array.isArray(res.items) && res.items.length > 0) {
            dispatch(setWishlistItems(res.items.map(mapProductToWishlistItem)));
          }
        });
      }
    }
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, dispatch]);

  const handleAddToCart = async (item: WishlistItem) => {
    if (item.inStock === false) return;
    const res = await apiRequest(`/products/${encodeURIComponent(item.slug || item.productId)}`);
    if (!res.success || !res.product) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Product Unavailable',
          message: 'This product is no longer available in our catalog.',
        })
      );
      return;
    }
    const prod: Product = res.product;
    if ((prod.stock ?? 0) <= 0) {
      dispatch(
        addToast({
          type: 'warning',
          title: 'Out of Stock',
          message: `${prod.name} is currently out of stock.`,
        })
      );
      return;
    }
    dispatch(
      addToCart({
        productId: prod._id,
        name: prod.name,
        subtitle: prod.subtitle || prod.category || '',
        sku: prod.sku || '',
        price: prod.salePrice,
        originalPrice: prod.basePrice > prod.salePrice ? prod.basePrice : undefined,
        quantity: 1,
        image: prod.images?.[0] || item.image || '',
        stock: prod.stock,
      })
    );
    dispatch(
      addToast({
        type: 'success',
        title: 'Added to Cart',
        message: `${prod.name} has been added to your shopping cart.`,
      })
    );
  };

  const handleRemoveItem = (item: WishlistItem) => {
    dispatch(removeFromWishlist(item.productId));
    if (isAuthenticated) {
      apiRequest(`/wishlist/${encodeURIComponent(item.productId)}`, { method: 'DELETE' }).catch(() => {});
    }
    dispatch(
      addToast({
        type: 'info',
        title: 'Removed from Wishlist',
        message: `${item.name} was removed from your wishlist.`,
      })
    );
  };

  const confirmClearAll = () => {
    dispatch(clearWishlist());
    if (isAuthenticated) {
      apiRequest('/wishlist', { method: 'DELETE' }).catch(() => {});
    }
    setIsClearConfirmOpen(false);
    dispatch(
      addToast({
        type: 'info',
        title: 'Wishlist Cleared',
        message: 'All items have been removed from your wishlist.',
      })
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-20">
      {/* 1. Dynamic Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#032e6a] via-[#0947a1] to-[#1264df] text-white py-12 sm:py-16">
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-400 blur-3xl"></div>
          <div className="absolute top-1/2 right-10 w-96 h-96 rounded-full bg-cyan-300 blur-3xl"></div>
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 1200 300">
            <path d="M0,150 C300,250 800,50 1200,180 L1200,300 L0,300 Z" fill="rgba(255,255,255,0.06)" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-6 sm:px-12 relative z-0 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-500/25 border border-cyan-300/40 text-cyan-200 text-xs font-semibold shadow-inner">
              <span>Save Your Favorite Items</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mt-3">
              My <span className="text-cyan-300">Wishlist</span>
            </h1>

            <p className="text-base sm:text-lg text-blue-100 font-normal mt-2 leading-relaxed">
              Keep track of the products you love.
            </p>
          </div>

          <div className="relative shrink-0 flex items-center justify-center">
            <div className="relative w-64 sm:w-80 h-44 flex items-center justify-center">
              <div className="absolute -bottom-2 inset-x-8 h-10 bg-blue-400/20 rounded-full blur-xl"></div>

              <div className="relative z-10 w-16 h-16 bg-white rounded-2xl shadow-2xl flex items-center justify-center -mr-4 -mt-6 border border-blue-50 transform -rotate-6">
                <Heart className="w-9 h-9 text-blue-600 fill-blue-600" />
                <div className="absolute -bottom-1.5 right-4 w-3 h-3 bg-white transform rotate-45"></div>
              </div>

              <div className="relative z-20 w-24 h-32 bg-gradient-to-b from-sky-400 to-blue-600 rounded-2xl shadow-2xl flex flex-col items-center justify-center border border-white/20">
                <div className="w-10 h-7 border-3 border-white/90 rounded-t-full -mt-12 mb-1"></div>
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
                  <Heart className="w-5 h-5 text-blue-600 fill-blue-600" />
                </div>
              </div>

              <div className="relative z-30 w-20 h-20 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-2xl shadow-2xl border-2 border-white -ml-4 mt-6 flex items-center justify-center">
                <div className="absolute inset-x-0 h-3 bg-white/80 top-1/2 -translate-y-1/2"></div>
                <div className="absolute inset-y-0 w-3 bg-white/80 left-1/2 -translate-x-1/2"></div>
                <Gift className="w-8 h-8 text-white z-10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Wishlist Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Heart className="w-5 h-5 text-blue-600 fill-blue-600 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
              My Wishlist{' '}
              <span className="font-semibold text-slate-500 text-base sm:text-lg">
                ({wishlistCount} {wishlistCount === 1 ? 'Item' : 'Items'})
              </span>
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsClearConfirmOpen(true)}
            disabled={wishlistCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-rose-600 rounded-xl text-xs font-bold transition-colors shadow-2xs disabled:opacity-40 disabled:pointer-events-none cursor-pointer self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Wishlist</span>
          </button>
        </div>

        {wishlistCount > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {wishlistItems.map((item) => (
              <div
                key={item.productId}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 hover:shadow-lg transition-all p-4 flex flex-col justify-between group"
              >
                <div className="relative">
                  {item.discountBadge && (
                    <span className="absolute top-0 left-0 bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                      {item.discountBadge}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item)}
                    title="Remove from wishlist"
                    className="absolute top-0 right-0 w-8 h-8 rounded-full border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                  >
                    <Heart className="w-4 h-4 fill-blue-600 text-blue-600" />
                  </button>

                  <Link
                    to={`/product/${item.slug || item.productId}`}
                    className="w-full h-44 flex items-center justify-center my-4 p-2"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Package className="w-12 h-12 text-slate-300" />
                    )}
                  </Link>
                </div>

                <div className="space-y-2">
                  <Link
                    to={`/product/${item.slug || item.productId}`}
                    className="font-black text-slate-900 hover:text-blue-600 text-base text-center truncate block transition-colors"
                  >
                    {item.name}
                  </Link>

                  <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < Math.round(item.rating ?? 0)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-extrabold text-slate-700">{(item.rating ?? 0).toFixed(1)}</span>
                    {item.reviewCount !== undefined && (
                      <span className="text-[11px] text-slate-400">({item.reviewCount})</span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-center gap-2 pt-1">
                    <span className="font-black text-lg text-blue-700 tabular-nums">
                      ৳{item.price.toLocaleString()}
                    </span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-xs text-slate-400 line-through tabular-nums">
                        ৳{item.originalPrice.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      disabled={item.inStock === false}
                      onClick={() => handleAddToCart(item)}
                      className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>{item.inStock === false ? 'Out of Stock' : 'Add to Cart'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item)}
                      title="Remove"
                      className="w-10 h-10 border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* 3. Empty / Explore State Banner */}
        <div className="bg-gradient-to-r from-blue-50/70 via-slate-50 to-blue-50/70 border border-blue-100 rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-5 flex justify-between items-center px-12">
            <ShoppingBag className="w-48 h-48 -ml-12" />
            <ShoppingBag className="w-48 h-48 -mr-12" />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left relative z-10">
            <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center text-blue-600 shrink-0 border border-blue-100">
              <Heart className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {wishlistCount === 0 ? 'Your wishlist is empty!' : 'Want to discover more products?'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md">
                Start adding products to your wishlist and keep track of your favorite items anytime.
              </p>
            </div>
          </div>

          <div className="relative z-10 shrink-0">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all"
            >
              <span>Explore Products</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={confirmClearAll}
        title="Clear Entire Wishlist?"
        message="All saved favorite products in your wishlist will be removed."
        confirmLabel="Clear Wishlist"
        variant="danger"
      />
    </div>
  );
};
