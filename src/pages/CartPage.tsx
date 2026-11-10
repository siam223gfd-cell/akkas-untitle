import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  removeFromCart,
  updateQuantity,
  clearCart,
  toggleItemSelection,
  selectAllItems,
  addToCart,
  applyCoupon,
  removeCoupon,
  hydrateCartItems,
  selectSelectedCartSubtotal,
  selectSelectedCartDiscount,
  selectSelectedCartShippingFee,
  selectSelectedCartTax,
  selectSelectedCartTotal,
} from '../features/cart/cartSlice';
import { addToast } from '../features/ui/uiSlice';
import { apiRequest } from '../services/api';
import { Product, StoreSettings } from '../types';
import { ConfirmDialog } from '../components/admin/common/modal';
import {
  ShoppingCart,
  Trash2,
  Lock,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Check,
  Info,
  ShoppingBag,
  Star,
  Tag,
  X,
  AlertCircle,
  Package,
} from 'lucide-react';

interface RecommendedProduct {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  sku: string;
  price: number;
  originalPrice?: number;
  discountBadge?: string;
  rating: number;
  reviewsCount: string;
  image: string;
  stock: number;
}

function mapProductToRecommended(prod: Product): RecommendedProduct {
  const hasDiscount = prod.basePrice > prod.salePrice;
  const pct = hasDiscount ? Math.round(((prod.basePrice - prod.salePrice) / prod.basePrice) * 100) : 0;
  return {
    id: prod._id,
    slug: prod.slug,
    name: prod.name,
    subtitle: prod.subtitle || prod.category || 'Official Store',
    sku: prod.sku,
    price: prod.salePrice,
    originalPrice: hasDiscount ? prod.basePrice : undefined,
    discountBadge: pct > 0 ? `-${pct}%` : prod.badge,
    rating: prod.rating || 0,
    reviewsCount:
      prod.reviewCount >= 1000
        ? `${(prod.reviewCount / 1000).toFixed(1)}k reviews`
        : `${prod.reviewCount || 0} reviews`,
    image: prod.images?.[0] || '',
    stock: prod.stock ?? 0,
  };
}

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector((state) => state.cart.items);
  const appliedCoupon = useAppSelector((state) => state.cart.coupon);

  const [storeSettings, setStoreSettings] = useState<StoreSettings | undefined>(undefined);
  const [recommended, setRecommended] = useState<RecommendedProduct[]>([]);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const [couponInput, setCouponInput] = useState(appliedCoupon?.code || '');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const selectedItems = cartItems.filter((item) => item.selected !== false);
  const selectedSubtotal = useAppSelector(selectSelectedCartSubtotal);
  const selectedDiscount = useAppSelector(selectSelectedCartDiscount);
  const selectedShippingFee = useAppSelector((state) =>
    selectSelectedCartShippingFee(state, 'Dhaka', '30', storeSettings)
  );
  const selectedTax = useAppSelector((state) => selectSelectedCartTax(state, storeSettings));
  const selectedTotal = useAppSelector((state) =>
    selectSelectedCartTotal(state, 'Dhaka', '30', storeSettings)
  );

  const [activeSlide, setActiveSlide] = useState(1);

  const allSelected = cartItems.length > 0 && cartItems.every((item) => item.selected !== false);
  const freeThreshold = storeSettings?.freeShippingThreshold ?? 1000;

  useEffect(() => {
    apiRequest('/cms/config').then((res) => {
      if (res.success && res.config?.settings) {
        setStoreSettings(res.config.settings);
      }
    });

    apiRequest('/products?limit=5').then((res) => {
      if (res.success && Array.isArray(res.products) && res.products.length > 0) {
        setRecommended(res.products.slice(0, 5).map(mapProductToRecommended));
      }
    });
  }, []);

  // Re-validate cart items against live DB prices & stock on initial mount or item-id changes
  const cartIdsKey = cartItems.map((i) => `${i.productId}:${i.variantId || ''}:${i.quantity}`).join('|');
  useEffect(() => {
    if (cartItems.length === 0) {
      setValidationWarnings([]);
      return;
    }

    let cancelled = false;
    apiRequest('/cart/validate', {
      method: 'POST',
      body: JSON.stringify({
        items: cartItems.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          name: i.name,
          quantity: i.quantity,
          options: i.options,
          selected: i.selected !== false,
        })),
        division: 'Dhaka',
        divisionId: '30',
        couponCode: appliedCoupon?.code,
      }),
    }).then((res) => {
      if (cancelled || !res.success || !Array.isArray(res.items)) return;

      if (Array.isArray(res.errors) && res.errors.length > 0) {
        setValidationWarnings(res.errors);
      } else {
        setValidationWarnings([]);
      }

      if (res.items.length === 0) {
        if (cartItems.length > 0) {
          dispatch(hydrateCartItems([]));
        }
        return;
      }

      const merged = res.items.map((srv: any) => {
        const prev = cartItems.find(
          (c) =>
            c.productId === srv.productId && (c.variantId || '') === (srv.variantId || '')
        );
        return {
          id: srv.id,
          productId: srv.productId,
          variantId: srv.variantId,
          name: srv.name,
          subtitle: prev?.subtitle,
          sku: srv.sku,
          price: srv.price,
          originalPrice: srv.originalPrice,
          quantity: srv.quantity,
          image: srv.image || prev?.image || '',
          options: srv.options || prev?.options,
          stock: srv.stock,
          selected: prev ? prev.selected !== false : srv.selected !== false,
        };
      });

      const hasDiff =
        merged.length !== cartItems.length ||
        merged.some((m: any, idx: number) => {
          const cur = cartItems[idx];
          return (
            !cur ||
            cur.id !== m.id ||
            cur.productId !== m.productId ||
            cur.name !== m.name ||
            cur.sku !== m.sku ||
            cur.price !== m.price ||
            cur.stock !== m.stock ||
            cur.quantity !== m.quantity
          );
        });
      if (hasDiff) {
        dispatch(hydrateCartItems(merged));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cartIdsKey]);

  const handleToggleSelectAll = () => {
    dispatch(selectAllItems(!allSelected));
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    if (selectedSubtotal <= 0) {
      setCouponError('Select at least one item before applying a coupon.');
      return;
    }

    setCouponError('');
    setIsApplyingCoupon(true);
    const res = await apiRequest('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal: selectedSubtotal }),
    });
    setIsApplyingCoupon(false);

    if (res.success && res.coupon) {
      dispatch(applyCoupon(res.coupon));
      setCouponInput(res.coupon.code);
      dispatch(
        addToast({
          type: 'success',
          title: 'Coupon Applied',
          message: `Code ${res.coupon.code} saved ৳${res.coupon.discount.toLocaleString()}!`,
        })
      );
    } else {
      setCouponError(res.message || 'Invalid or expired coupon code.');
    }
  };

  const handleRemoveCoupon = () => {
    dispatch(removeCoupon());
    setCouponInput('');
    setCouponError('');
  };

  const handleProceedToCheckout = () => {
    if (cartItems.length === 0) {
      dispatch(
        addToast({
          type: 'warning',
          title: 'Cart is empty',
          message: 'Add items to your cart before proceeding to checkout.',
        })
      );
      return;
    }
    if (selectedItems.length === 0) {
      dispatch(
        addToast({
          type: 'warning',
          title: 'No items selected',
          message: 'Please select at least one item in your cart to checkout.',
        })
      );
      return;
    }
    navigate('/checkout');
  };

  const handleAddRecommended = (prod: RecommendedProduct) => {
    if (prod.stock <= 0) return;
    dispatch(
      addToCart({
        productId: prod.id,
        name: prod.name,
        subtitle: prod.subtitle,
        sku: prod.sku,
        price: prod.price,
        originalPrice: prod.originalPrice,
        quantity: 1,
        image: prod.image,
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

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-16">
      {/* 1. Dynamic Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#032d69] via-[#0b48a3] to-[#1264df] text-white py-10 sm:py-14">
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-400 blur-3xl"></div>
          <div className="absolute top-1/2 right-10 w-96 h-96 rounded-full bg-cyan-300 blur-3xl"></div>
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 1200 300">
            <path d="M0,150 C300,250 800,50 1200,180 L1200,300 L0,300 Z" fill="rgba(255,255,255,0.05)" />
            <path d="M0,80 C400,20 700,200 1200,60 L1200,0 L0,0 Z" fill="rgba(255,255,255,0.03)" />
          </svg>
        </div>

        <button
          type="button"
          onClick={() => setActiveSlide((prev) => (prev > 0 ? prev - 1 : 3))}
          aria-label="Previous slide"
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all z-10 backdrop-blur-xs"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setActiveSlide((prev) => (prev < 3 ? prev + 1 : 0))}
          aria-label="Next slide"
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all z-10 backdrop-blur-xs"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="max-w-7xl mx-auto px-6 sm:px-12 relative z-0 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/25 border border-cyan-300/40 text-cyan-200 text-xs font-semibold shadow-inner">
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Your Shopping Cart</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mt-3">
              Review Your Cart
            </h1>

            <p className="text-sm sm:text-base text-blue-100/90 font-normal mt-2 leading-relaxed">
              Make sure everything is perfect before checkout.
            </p>

            <div className="flex items-center justify-center md:justify-start gap-2 mt-6">
              {[0, 1, 2, 3].map((dot) => (
                <button
                  key={dot}
                  type="button"
                  onClick={() => setActiveSlide(dot)}
                  aria-label={`Slide ${dot + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    dot === activeSlide ? 'w-6 bg-white shadow-xs' : 'w-2 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="relative shrink-0 flex items-center justify-center">
            <div className="relative w-64 sm:w-80 h-48 sm:h-56 flex items-center justify-center">
              <div className="absolute inset-x-4 bottom-2 h-16 bg-blue-400/20 rounded-full blur-xl"></div>

              <div className="absolute -top-2 right-4 bg-white text-slate-800 px-4 py-2 rounded-2xl shadow-xl shadow-blue-950/20 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 animate-bounce z-20 border border-blue-100">
                <span className="text-blue-600">Happy</span>
                <span>Shopping!</span>
                <div className="absolute -bottom-2 left-6 w-3 h-3 bg-white transform rotate-45 border-r border-b border-blue-100"></div>
              </div>

              <div className="relative z-10 flex flex-col items-center">
                <div className="relative">
                  <div className="w-44 sm:w-52 h-28 border-4 border-slate-200/90 rounded-2xl bg-gradient-to-tr from-white/10 to-white/30 backdrop-blur-md shadow-2xl relative flex items-center justify-center">
                    <div className="absolute inset-2 border-2 border-dashed border-white/40 rounded-xl"></div>
                    <ShoppingCart className="w-16 h-16 text-white drop-shadow-md opacity-90" />
                  </div>
                  <div className="flex justify-between px-6 -mt-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-blue-600 shadow-md flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-blue-600 shadow-md flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {validationWarnings.length > 0 && (
          <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Catalog Availability Notice</span>
            </div>
            {validationWarnings.map((w, idx) => (
              <p key={idx} className="pl-6">{w}</p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Cart Items */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="bg-gradient-to-r from-[#032e6a] via-[#083e8c] to-[#0d50b8] px-4 sm:px-6 py-3.5 sm:py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    title="Select all items"
                    className="w-5 h-5 rounded-md border border-white/60 flex items-center justify-center transition-colors bg-white/10 hover:bg-white/20 shrink-0 cursor-pointer"
                  >
                    {allSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                  <div className="flex items-center gap-2 min-w-0">
                    <ShoppingCart className="w-5 h-5 text-blue-200 shrink-0" />
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                      Your Cart{' '}
                      <span className="font-normal text-blue-200 text-xs sm:text-sm">
                        ({selectedItems.length}/{cartItems.length} selected)
                      </span>
                    </h2>
                  </div>
                </div>

                <div className="text-left sm:text-right flex items-center sm:block gap-2 border-t sm:border-t-0 border-white/10 pt-1.5 sm:pt-0">
                  <span className="text-xs sm:text-sm text-blue-200 font-medium">Selected Subtotal:</span>
                  <span className="text-base sm:text-xl font-black text-amber-400 tabular-nums">
                    ৳{selectedSubtotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {cartItems.length === 0 ? (
                <div className="p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Your cart is currently empty</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Check out our trending products below and start shopping with exclusive discounts.
                  </p>
                  <Link
                    to="/shop"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
                  >
                    Browse Catalog
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cartItems.map((item) => {
                    const isSelected = item.selected !== false;
                    const itemTotal = item.price * item.quantity;

                    return (
                      <div
                        key={item.id}
                        className={`p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                          isSelected ? 'bg-white' : 'bg-slate-50/70 opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => dispatch(toggleItemSelection(item.id))}
                            aria-label={`Select ${item.name}`}
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'border-2 border-slate-300 hover:border-blue-500 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>

                          <div className="w-20 h-20 rounded-xl bg-slate-50 border border-slate-100 p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-contain hover:scale-105 transition-transform"
                              />
                            ) : (
                              <Package className="w-7 h-7 text-slate-300" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                                {item.name}
                              </h3>
                              <CheckCircle2 className="w-4 h-4 text-blue-600 fill-blue-50 shrink-0" />
                            </div>

                            {item.subtitle && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{item.subtitle}</p>
                            )}

                            {item.options && Object.keys(item.options).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(item.options).map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700"
                                  >
                                    {k}: {v}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-2 mt-2">
                              <span className="font-extrabold text-sm text-slate-900 tabular-nums">
                                ৳{item.price.toLocaleString()}
                              </span>
                              {item.originalPrice && item.originalPrice > item.price && (
                                <span className="text-[11px] text-slate-400 line-through tabular-nums">
                                  ৳{item.originalPrice.toLocaleString()}
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  item.stock > 0
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                    : 'bg-rose-50 text-rose-600 border-rose-200'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    item.stock > 0 ? 'bg-emerald-500' : 'bg-rose-500'
                                  }`}
                                ></span>
                                {item.stock > 0 ? `In Stock (${item.stock})` : 'Out of Stock'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="flex items-center border border-slate-200 rounded-xl bg-white shadow-2xs overflow-hidden">
                            <button
                              type="button"
                              onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity - 1 }))}
                              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors font-bold text-sm"
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="w-9 text-center text-xs font-bold text-slate-900 tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity + 1 }))}
                              disabled={item.quantity >= item.stock}
                              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors font-bold text-sm"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>

                          <div className="min-w-[90px] text-right font-black text-slate-900 text-base sm:text-lg tabular-nums">
                            ৳{itemTotal.toLocaleString()}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              dispatch(removeFromCart(item.id));
                              dispatch(
                                addToast({
                                  type: 'info',
                                  title: 'Item Removed',
                                  message: `${item.name} was removed from your cart.`,
                                })
                              );
                            }}
                            aria-label={`Remove ${item.name}`}
                            className="w-9 h-9 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-colors shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setIsClearConfirmOpen(true)}
                  disabled={cartItems.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-rose-600 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Cart
                </button>

                <Link
                  to="/shop"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5 sticky top-24">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Order Summary</h2>
              </div>

              {/* Coupon Box */}
              <div className="space-y-2">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="flex items-center gap-2 font-bold text-emerald-800">
                      <Tag className="w-3.5 h-3.5" />
                      <span>{appliedCoupon.code}</span>
                      <span className="text-emerald-600 font-semibold">
                        (-৳{selectedDiscount.toLocaleString()})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-slate-500 hover:text-rose-600 p-0.5"
                      title="Remove coupon"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        if (couponError) setCouponError('');
                      }}
                      placeholder="Promo code (e.g. NOVARA10)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                    <button
                      type="submit"
                      disabled={isApplyingCoupon || selectedSubtotal === 0}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      {isApplyingCoupon ? '...' : 'Apply'}
                    </button>
                  </form>
                )}
                {couponError && <p className="text-[11px] font-semibold text-rose-600">{couponError}</p>}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Selected Subtotal ({selectedItems.length} lines)</span>
                  <span className="font-extrabold text-slate-900 tabular-nums">
                    ৳{selectedSubtotal.toLocaleString()}
                  </span>
                </div>

                {selectedDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 font-semibold">
                    <span>Discount ({appliedCoupon?.code})</span>
                    <span className="tabular-nums">-৳{selectedDiscount.toLocaleString()}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      Est. Shipping (Dhaka)
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <span className="font-extrabold text-slate-900 tabular-nums">
                      ৳{selectedShippingFee.toLocaleString()}
                    </span>
                  </div>
                  {selectedSubtotal > 0 && selectedShippingFee === 0 ? (
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>
                        {freeThreshold > 0
                          ? `Free Shipping Unlocked (≥ ৳${freeThreshold.toLocaleString()})`
                          : 'Free Shipping Applied'}
                      </span>
                    </div>
                  ) : selectedSubtotal > 0 && freeThreshold > selectedSubtotal ? (
                    <p className="text-[11px] text-slate-500">
                      Add ৳{(freeThreshold - selectedSubtotal).toLocaleString()} more for free shipping.
                    </p>
                  ) : null}
                </div>

                {selectedTax > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Estimated VAT ({storeSettings?.taxRate ?? 0}%)</span>
                    <span className="font-extrabold text-slate-900 tabular-nums">
                      ৳{selectedTax.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-base">Total Amount</span>
                  <span className="font-black text-2xl text-slate-900 tabular-nums">
                    ৳{selectedTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {cartItems.length > 0 && selectedItems.length === 0 && (
                <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Select at least one cart item above to proceed to checkout.
                </p>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  disabled={selectedItems.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </button>

                <div className="text-center text-xs text-slate-400 font-medium">or</div>

                <Link
                  to="/shop"
                  className="w-full border border-slate-200 hover:bg-slate-50 active:scale-[0.99] text-slate-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
                >
                  <ShoppingBag className="w-4 h-4 text-slate-600" />
                  <span>Continue Shopping</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Recommended Products */}
        {recommended.length > 0 && (
          <section className="mt-14 pt-8 border-t border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full inline-block"></span>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">You May Also Like</h2>
              </div>
              <Link
                to="/shop"
                className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                <span>View More</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
              {recommended.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-white rounded-2xl border border-slate-200/80 hover:border-blue-400/50 hover:shadow-md transition-all p-4 flex flex-col justify-between group"
                >
                  <div className="relative">
                    {prod.discountBadge && (
                      <span className="absolute top-0 left-0 bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                        {prod.discountBadge}
                      </span>
                    )}

                    <Link to={`/product/${prod.slug}`} className="w-full h-36 flex items-center justify-center my-3 p-2">
                      {prod.image ? (
                        <img
                          src={prod.image}
                          alt={prod.name}
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Package className="w-10 h-10 text-slate-300" />
                      )}
                    </Link>
                  </div>

                  <div>
                    <Link
                      to={`/product/${prod.slug}`}
                      className="font-bold text-slate-900 hover:text-blue-600 text-sm truncate block transition-colors"
                    >
                      {prod.name}
                    </Link>

                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                      <Star
                        className={`w-3 h-3 ${
                          prod.rating > 0 ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                        }`}
                      />
                      <span className="font-bold text-slate-700">
                        {prod.rating > 0 ? prod.rating.toFixed(1) : 'New'}
                      </span>
                      <span className="text-[10px] text-slate-400">({prod.reviewsCount})</span>
                    </div>

                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="font-black text-sm text-slate-900 tabular-nums">
                        ৳{prod.price.toLocaleString()}
                      </span>
                      {prod.originalPrice && (
                        <span className="text-[11px] text-slate-400 line-through tabular-nums">
                          ৳{prod.originalPrice.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={prod.stock <= 0}
                      onClick={() => handleAddRecommended(prod)}
                      className="w-full mt-3 py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{prod.stock > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={() => {
          dispatch(clearCart());
          setIsClearConfirmOpen(false);
          dispatch(
            addToast({
              type: 'info',
              title: 'Cart Cleared',
              message: 'All items have been removed from your cart.',
            })
          );
        }}
        title="Clear Entire Shopping Cart?"
        message="This will remove all items currently stored in your shopping bag. You can add them back anytime from the catalog."
        confirmLabel="Clear Cart"
        variant="danger"
      />
    </div>
  );
};
