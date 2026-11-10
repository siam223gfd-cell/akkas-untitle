import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { Product, ProductVariant, Review } from '../types';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addToCart } from '../features/cart/cartSlice';
import { toggleWishlist, selectIsInWishlist } from '../features/wishlist/wishlistSlice';
import { addToast, openAuthModal } from '../features/ui/uiSlice';
import { PublicAdvertisement } from '../components/public/PublicAdvertisement';
import {
  Star,
  Truck,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Heart,
  Share2,
  Check,
  CheckCircle2,
  ChevronRight,
  Zap,
  Camera,
  Cpu,
  Smartphone,
  Battery,
  ThumbsUp,
  ZoomIn,
  X,
  ChevronLeft,
  ArrowRight,
  MessageSquare,
  Scale,
  Feather,
  Activity,
  Wind,
  Shield,
  Leaf,
  Shirt,
  Sparkles,
  Package,
} from 'lucide-react';

// Color map for swatch rendering
const COLOR_HEX_MAP: Record<string, string> = {
  'Titanium Gray': '#c5c8cb',
  'Titanium Black': '#393c40',
  'Titanium Blue': '#4f759b',
  'Titanium Violet': '#6a6784',
  'Navy Blue': '#1e3a8a',
  'Silver Shadow': '#d1d5db',
  'Space Gray': '#4b5563',
  'Ice Blue': '#93c5fd',
  'Midnight Black': '#111827',
  'Heather Gray': '#9ca3af',
  'White': '#ffffff',
  'Black': '#000000',
  'Desert Titanium': '#c2b092',
  'Forest Camo': '#2f4f2f',
  'Jet Black': '#0a0a0a',
  'Starlight': '#f5f5dc',
};

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const cartItems = useAppSelector((state) => state.cart.items);

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'desc' | 'specs' | 'reviews' | 'faqs'>('desc');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<any>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | '5' | '4' | '3' | 'verified'>('all');
  const [reviewSort, setReviewSort] = useState<'newest' | 'helpful' | 'highest'>('newest');
  const [visibleReviewCount, setVisibleReviewCount] = useState(3);

  // Selected dynamic attribute options, e.g. { Color: 'Titanium Gray', Storage: '256GB' }
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Location delivery checker widget state
  const [locationInput, setLocationInput] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState<{
    checked: boolean;
    estimate: string;
    note: string;
    isExpressAvailable: boolean;
  }>({
    checked: false,
    estimate: '2 - 3 Working Days',
    note: 'Free shipping on orders over ৳1,000',
    isExpressAvailable: true,
  });

  // Review submission modal state
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [newReviewPhoto, setNewReviewPhoto] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Helpful votes tracked locally for instant feedback
  const [helpfulVoted, setHelpfulVoted] = useState<Record<string, boolean>>({});
  const [helpfulCounts, setHelpfulCounts] = useState<Record<string, number>>({});

  // Lightbox preview for review image
  const [activeReviewPhoto, setActiveReviewPhoto] = useState<string | null>(null);

  // Wishlist check
  const isInWishlist = useAppSelector(selectIsInWishlist(product?._id || '', product?.slug));

  useEffect(() => {
    if (!slug) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setVisibleReviewCount(3);
    setQuantity(1);

    apiRequest(`/products/${slug}`).then((res) => {
      if (res.success && res.product) {
        const prod: Product = res.product;
        setProduct(prod);
        document.title = `${prod.name} – Novara Commerce`;
        setSelectedImageIndex(0);
        setRelated(res.related || []);

        // Initialize default options from first variant or attributes
        if (prod.variants && prod.variants.length > 0) {
          const firstVar = prod.variants[0];
          const initialOpts: Record<string, string> = { ...firstVar.options };
          setSelectedOptions(initialOpts);
        }

        // Fetch authentic customer reviews
        apiRequest(`/reviews?productId=${prod.slug}`).then((revRes) => {
          if (revRes.success && revRes.reviews) {
            setReviews(revRes.reviews);
            setReviewStats(revRes.stats);
            // Pre-seed helpful counts
            const counts: Record<string, number> = {};
            revRes.reviews.forEach((r: Review) => {
              counts[r._id] = r.helpfulCount || 0;
            });
            setHelpfulCounts(counts);
          }
        });
      }
    });

    return () => {
      document.title = 'Novara Commerce – Premium Online Shopping Bangladesh';
    };
  }, [slug]);

  // Extract all distinct attribute keys and values available from variants
  const availableAttributeGroups = useMemo(() => {
    if (!product || !product.variants || product.variants.length === 0) {
      return [];
    }

    const groups: Record<string, Set<string>> = {};
    product.variants.forEach((v) => {
      if (v.options) {
        Object.entries(v.options).forEach(([k, val]) => {
          if (!groups[k]) groups[k] = new Set();
          groups[k].add(val);
        });
      }
    });

    return Object.entries(groups).map(([name, valuesSet]) => ({
      name,
      values: Array.from(valuesSet),
      type:
        name.toLowerCase().includes('color') || name.toLowerCase().includes('colour')
          ? 'color_swatch'
          : 'size_selector',
    }));
  }, [product]);

  // Compute the currently active variant based on selected options
  const activeVariant: ProductVariant | null = useMemo(() => {
    if (!product || !product.variants || product.variants.length === 0) return null;

    // Match exact options
    const match = product.variants.find((v) => {
      if (!v.options) return false;
      return Object.entries(selectedOptions).every(([k, val]) => v.options[k] === val);
    });

    return match || product.variants[0];
  }, [product, selectedOptions]);

  // Dynamic price, strikethrough, SKU, stock (cart-aware across variants)
  const currentPrice = activeVariant?.price || product?.salePrice || 0;
  const currentOriginalPrice = activeVariant?.originalPrice || product?.basePrice || 0;
  const currentSku = activeVariant?.sku || product?.sku || '';
  const effectiveStock = activeVariant
    ? activeVariant.isActive === false
      ? 0
      : Math.min(activeVariant.stock ?? 0, product?.stock ?? 0)
    : (product?.stock ?? 0);

  const existingVariantQty = product
    ? cartItems
        .filter((c) => c.productId === product._id && (c.variantId || '') === (activeVariant?.id || ''))
        .reduce((s, c) => s + c.quantity, 0)
    : 0;
  const existingProductQty = product
    ? cartItems
        .filter((c) => c.productId === product._id)
        .reduce((s, c) => s + c.quantity, 0)
    : 0;
  const variantCapRemaining = activeVariant
    ? Math.max(0, (activeVariant.stock ?? 0) - existingVariantQty)
    : Math.max(0, effectiveStock - existingProductQty);
  const parentCapRemaining = product ? Math.max(0, (product.stock ?? 0) - existingProductQty) : 0;
  const remainingStock = effectiveStock <= 0 ? 0 : Math.min(variantCapRemaining, parentCapRemaining);

  const discountPercent =
    currentOriginalPrice > currentPrice
      ? Math.round(((currentOriginalPrice - currentPrice) / currentOriginalPrice) * 100)
      : 0;

  useEffect(() => {
    const maxAllowed = Math.max(1, remainingStock || effectiveStock || 1);
    setQuantity((q) => Math.min(q, maxAllowed));
  }, [remainingStock, effectiveStock, activeVariant?.id]);

  // Images list
  const productImages = useMemo(() => {
    if (product?.images && product.images.length > 0) return product.images;
    return [];
  }, [product]);

  const activeImage = productImages[selectedImageIndex] || productImages[0] || '';

  // Handle option selection
  const handleSelectOption = (key: string, value: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Add to Cart
  const handleAddToCart = (): boolean => {
    if (!product) return false;
    if (effectiveStock <= 0) {
      dispatch(
        addToast({
          type: 'warning',
          title: 'Out of Stock',
          message: `${product.name} is currently out of stock.`,
        })
      );
      return false;
    }
    if (remainingStock <= 0 || quantity > remainingStock) {
      dispatch(
        addToast({
          type: 'warning',
          title: 'Maximum Stock in Cart',
          message: `You already have the maximum available stock (${effectiveStock}) in your bag.`,
        })
      );
      return false;
    }
    dispatch(
      addToCart({
        productId: product._id,
        variantId: activeVariant?.id,
        name: activeVariant ? `${product.name} (${activeVariant.name})` : product.name,
        sku: currentSku,
        price: currentPrice,
        originalPrice: currentOriginalPrice > currentPrice ? currentOriginalPrice : undefined,
        quantity,
        image: activeImage,
        options: selectedOptions,
        stock: effectiveStock,
      })
    );
    dispatch(
      addToast({
        type: 'success',
        title: 'Added to Cart',
        message: `${product.name} (Qty: ${quantity}) has been added to your bag.`,
      })
    );
    return true;
  };

  // Buy Now
  const handleBuyNow = () => {
    if (handleAddToCart()) {
      navigate('/checkout');
    }
  };

  // Toggle Wishlist
  const handleToggleWishlist = () => {
    if (!product) return;
    dispatch(
      toggleWishlist({
        productId: product._id,
        name: product.name,
        slug: product.slug,
        price: currentPrice,
        originalPrice: currentOriginalPrice > currentPrice ? currentOriginalPrice : undefined,
        discountBadge: discountPercent > 0 ? `${discountPercent}% OFF` : undefined,
        image: activeImage,
        rating: product.rating,
        reviewCount: `${product.reviewCount} reviews`,
        category: product.category,
        inStock: effectiveStock > 0,
      })
    );
    if (isAuthenticated) {
      apiRequest('/wishlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ productId: product._id }),
      }).catch(() => {});
    }
    dispatch(
      addToast({
        type: 'info',
        title: isInWishlist ? 'Removed from Wishlist' : 'Saved to Wishlist',
        message: isInWishlist
          ? `${product.name} removed from your saved items.`
          : `${product.name} added to your wishlist.`,
      })
    );
  };

  // Location Checker
  const handleCheckDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const loc = locationInput.trim().toLowerCase();
    if (!loc) return;

    if (loc.includes('dhaka') || loc.includes('banani') || loc.includes('gulshan') || loc.includes('dhanmondi') || loc.includes('uttara') || loc.includes('mirpur')) {
      setDeliveryStatus({
        checked: true,
        estimate: '1 - 2 Working Days',
        note: 'Express Next-Day Delivery available for Dhaka Metro (Free on orders over ৳1,000)',
        isExpressAvailable: true,
      });
    } else {
      setDeliveryStatus({
        checked: true,
        estimate: '2 - 3 Working Days',
        note: `Standard courier service to ${locationInput.trim()} (Courier Fee: ৳120 or Free over ৳1,000)`,
        isExpressAvailable: false,
      });
    }
  };

  // Upvote helpful review
  const handleHelpfulVote = async (reviewId: string) => {
    if (helpfulVoted[reviewId]) return;

    setHelpfulVoted((prev) => ({ ...prev, [reviewId]: true }));
    setHelpfulCounts((prev) => ({
      ...prev,
      [reviewId]: (prev[reviewId] || 0) + 1,
    }));

    try {
      await apiRequest(`/reviews/${reviewId}/helpful`, { method: 'POST' });
    } catch (e) {
      // optimistic update maintained
    }
  };

  // Submit Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      dispatch(openAuthModal({ tab: 'login' }));
      return;
    }
    if (!newComment.trim()) return;

    setIsSubmittingReview(true);
    try {
      const res = await apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          productId: product?.slug || product?._id,
          rating: newRating,
          comment: newComment.trim(),
          photos: newReviewPhoto ? [newReviewPhoto.trim()] : [],
        }),
      });

      if (res.success && res.review) {
        setReviews((prev) => [res.review, ...prev]);
        setHelpfulCounts((prev) => ({ ...prev, [res.review._id]: 0 }));
        if (product?.slug) {
          apiRequest(`/reviews?productId=${product.slug}`).then((revRes) => {
            if (revRes.success && revRes.reviews) {
              setReviews(revRes.reviews);
              setReviewStats(revRes.stats);
            }
          });
          apiRequest(`/products/${product.slug}`).then((prodRes) => {
            if (prodRes.success && prodRes.product) {
              setProduct(prodRes.product);
            }
          });
        }
        setIsWriteReviewOpen(false);
        setNewComment('');
        setNewReviewPhoto('');
        dispatch(
          addToast({
            type: 'success',
            title: 'Review Published',
            message: 'Thank you for sharing your review!',
          })
        );
      } else {
        dispatch(
          addToast({
            type: 'error',
            title: 'Submission Failed',
            message: res.message || 'Unable to submit review at this time.',
          })
        );
      }
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Error',
          message: err.message || 'Something went wrong.',
        })
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-slate-600">Loading flagship specifications...</p>
      </div>
    );
  }

  // Key Highlights icons mapping
  const renderHighlightIcon = (iconName?: string) => {
    switch (iconName?.toLowerCase()) {
      case 'camera':
        return <Camera className="w-6 h-6 text-blue-600" />;
      case 'cpu':
        return <Cpu className="w-6 h-6 text-blue-600" />;
      case 'smartphone':
        return <Smartphone className="w-6 h-6 text-blue-600" />;
      case 'battery':
        return <Battery className="w-6 h-6 text-blue-600" />;
      case 'shirt':
        return <Shirt className="w-6 h-6 text-blue-600" />;
      case 'feather':
        return <Feather className="w-6 h-6 text-blue-600" />;
      case 'activity':
        return <Activity className="w-6 h-6 text-blue-600" />;
      case 'wind':
        return <Wind className="w-6 h-6 text-blue-600" />;
      case 'leaf':
        return <Leaf className="w-6 h-6 text-blue-600" />;
      case 'shield':
        return <Shield className="w-6 h-6 text-blue-600" />;
      default:
        return <Sparkles className="w-6 h-6 text-blue-600" />;
    }
  };

  // Filtered & sorted reviews
  const filteredReviews = reviews
    .filter((r) => {
      if (reviewFilter === 'verified') return r.isVerifiedPurchase;
      if (reviewFilter === '5') return r.rating === 5;
      if (reviewFilter === '4') return r.rating === 4;
      if (reviewFilter === '3') return r.rating <= 3;
      return true;
    })
    .sort((a, b) => {
      if (reviewSort === 'helpful') {
        const countB = helpfulCounts[b._id] ?? b.helpfulCount ?? 0;
        const countA = helpfulCounts[a._id] ?? a.helpfulCount ?? 0;
        return countB - countA;
      }
      if (reviewSort === 'highest') {
        return b.rating - a.rating;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const ratingBreakdown = [5, 4, 3, 2, 1].map((stars) => {
    const statEntry = Array.isArray(reviewStats?.breakdown)
      ? reviewStats.breakdown.find((b: any) => Number(b._id ?? b.stars) === stars)
      : reviewStats?.breakdown?.[stars];
    const total = reviews.length;
    if (typeof statEntry === 'number' && reviewStats?.total > 0) {
      return { stars, pct: Math.round((statEntry / reviewStats.total) * 100) };
    }
    if (statEntry && typeof statEntry.count === 'number' && reviewStats?.total > 0) {
      return { stars, pct: Math.round((statEntry.count / reviewStats.total) * 100) };
    }
    if (total > 0) {
      const matched = reviews.filter((r) => Math.round(r.rating) === stars).length;
      return { stars, pct: Math.round((matched / total) * 100) };
    }
    return { stars, pct: 0 };
  });

  return (
    <div className="bg-[#f8fafc] min-h-screen pb-16">
      {/* Breadcrumb Navigation matching reference image */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center text-xs font-medium text-slate-500 space-x-2">
            <Link to="/" className="hover:text-blue-600 transition flex items-center gap-1">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-blue-600 transition">
              {product.category}
            </Link>
            {product.subcategory && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-600">{product.subcategory}</span>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-900 font-semibold truncate max-w-[200px] sm:max-w-xs">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Main Product Hero Grid */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-8 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* LEFT COLUMN: Image Gallery */}
            <div className="lg:col-span-6 space-y-4">
              {/* Main Image Container */}
              <div className="relative bg-[#f1f5f9] rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center p-6 aspect-[4/3] sm:aspect-square group">
                {product.badge && (
                  <span className="absolute top-4 left-4 z-10 bg-red-600 text-white text-[11px] font-black tracking-wider px-3 py-1 rounded-md uppercase shadow-sm">
                    {product.badge}
                  </span>
                )}

                {activeImage && (
                  <button
                    type="button"
                    onClick={() => setIsZoomModalOpen(true)}
                    className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-blue-600 shadow-sm flex items-center justify-center border border-slate-200 transition"
                    title="Click to zoom image"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                )}

                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={product.name}
                    onClick={() => setIsZoomModalOpen(true)}
                    className="max-h-full max-w-full object-contain cursor-zoom-in transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Package className="w-16 h-16 stroke-[1.2]" />
                    <span className="text-xs font-medium">No image available</span>
                  </div>
                )}
              </div>

              {/* Thumbnails Row */}
              {productImages.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {productImages.slice(0, 4).map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative bg-[#f8fafc] rounded-xl border p-2 aspect-square flex items-center justify-center overflow-hidden transition ${
                        selectedImageIndex === idx
                          ? 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <img src={img} alt={`${product.name} thumb ${idx}`} className="max-h-full max-w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Product Info & Universal Variant Engine */}
            <div className="lg:col-span-6 space-y-5">
              {/* Dynamic Stock Badge */}
              <div className="flex items-center gap-2">
                {effectiveStock <= 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-rose-500 text-white">
                    Out of Stock
                  </span>
                ) : effectiveStock <= 5 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white">
                    Only {effectiveStock} left
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500 text-white">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    In Stock
                  </span>
                )}
              </div>

              {/* Title & Subtitle */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {product.name}
                </h1>
                {product.subtitle && (
                  <p className="text-sm font-medium text-slate-500 mt-1">{product.subtitle}</p>
                )}
              </div>

              {/* Rating & Review Counter Row */}
              <div className="flex items-center flex-wrap gap-2 text-xs text-slate-600">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.round(product.rating || 0)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-bold text-slate-900">{(product.rating || 0).toFixed(1)}</span>
                <span className="text-slate-500">({(product.reviewCount || 0).toLocaleString()} Reviews)</span>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setIsWriteReviewOpen(true)}
                  className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Write a Review
                </button>
              </div>

              {/* SKU & Availability Row */}
              <div className="flex items-center gap-4 text-xs text-slate-500 border-b border-slate-100 pb-3">
                <span>
                  SKU: <strong className="text-slate-800">{currentSku || 'N/A'}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  Availability:{' '}
                  <strong className={effectiveStock > 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                    {effectiveStock > 0 ? `In Stock (${effectiveStock})` : 'Out of Stock'}
                  </strong>
                </span>
              </div>

              {/* Live Price Block */}
              <div className="flex items-baseline gap-3">
                <span className="text-2xl sm:text-3xl font-black text-blue-600">
                  ৳{currentPrice.toLocaleString()}
                </span>
                {currentOriginalPrice > currentPrice && (
                  <>
                    <span className="text-base sm:text-lg text-slate-400 line-through">
                      ৳{currentOriginalPrice.toLocaleString()}
                    </span>
                    <span className="bg-rose-50 text-rose-600 text-xs font-extrabold px-2 py-0.5 rounded-full border border-rose-200">
                      {discountPercent}% OFF
                    </span>
                  </>
                )}
              </div>

              {/* Short Description */}
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                {product.description}
              </p>

              {/* DYNAMIC ATTRIBUTE SELECTORS (Color, Storage, Size, etc.) */}
              <div className="space-y-4 pt-2">
                {availableAttributeGroups.map((group) => {
                  const selectedVal = selectedOptions[group.name] || group.values[0];

                  if (group.type === 'color_swatch') {
                    return (
                      <div key={group.name} className="flex items-center gap-4">
                        <span className="text-xs font-bold text-slate-900 w-16">{group.name}:</span>
                        <div className="flex items-center gap-2.5">
                          {group.values.map((val) => {
                            const isSelected = selectedVal === val;
                            const hexColor = COLOR_HEX_MAP[val] || '#94a3b8';

                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleSelectOption(group.name, val)}
                                title={val}
                                className={`w-7 h-7 rounded-full relative transition-transform ${
                                  isSelected
                                    ? 'ring-2 ring-blue-600 ring-offset-2 scale-110 shadow-sm'
                                    : 'border border-slate-300 hover:scale-105'
                                }`}
                                style={{ backgroundColor: hexColor }}
                              >
                                {isSelected && (
                                  <span className="absolute inset-0 flex items-center justify-center">
                                    <Check className={`w-3.5 h-3.5 stroke-[3] ${hexColor === '#ffffff' ? 'text-slate-900' : 'text-white'}`} />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  // Non-color selector (Storage pills, Size selector, etc.)
                  return (
                    <div key={group.name} className="flex items-center gap-4">
                      <span className="text-xs font-bold text-slate-900 w-16">{group.name}:</span>
                      <div className="flex items-center flex-wrap gap-2">
                        {group.values.map((val) => {
                          const isSelected = selectedVal === val;

                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleSelectOption(group.name, val)}
                              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Quantity Row */}
                <div className="flex items-center gap-4 pt-1">
                  <span className="text-xs font-bold text-slate-900 w-16">Quantity:</span>
                  <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                    <button
                      type="button"
                      disabled={quantity <= 1 || remainingStock <= 0}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40 font-bold transition text-sm"
                    >
                      -
                    </button>
                    <span className="px-4 py-1.5 text-xs font-bold text-slate-900 bg-white min-w-[2.5rem] text-center border-x border-slate-200">
                      {effectiveStock <= 0 ? 0 : quantity}
                    </span>
                    <button
                      type="button"
                      disabled={effectiveStock <= 0 || remainingStock <= 0 || quantity >= remainingStock}
                      onClick={() => setQuantity((q) => Math.min(Math.max(1, remainingStock), q + 1))}
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40 font-bold transition text-sm"
                    >
                      +
                    </button>
                  </div>
                  {effectiveStock > 0 && remainingStock < effectiveStock && (
                    <span className="text-[11px] font-medium text-slate-500">
                      ({remainingStock} more can be added)
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons: Add to Cart & Buy Now */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
                <button
                  type="button"
                  disabled={effectiveStock <= 0 || remainingStock <= 0}
                  onClick={handleAddToCart}
                  className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed active:scale-[0.99] text-white font-bold py-3 px-6 rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {effectiveStock <= 0
                    ? 'Out of Stock'
                    : remainingStock <= 0
                    ? 'Max Quantity in Cart'
                    : 'Add to Cart'}
                </button>
                <button
                  type="button"
                  disabled={effectiveStock <= 0 || remainingStock <= 0}
                  onClick={handleBuyNow}
                  className="w-full sm:flex-1 bg-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] text-blue-600 font-bold border-2 border-blue-600 py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-blue-600" />
                  Buy Now
                </button>
              </div>

              {/* Wishlist & Compare Row */}
              <div className="flex items-center gap-6 pt-1 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={handleToggleWishlist}
                  className="flex items-center gap-1.5 hover:text-blue-600 font-medium transition"
                >
                  <Heart className={`w-4 h-4 ${isInWishlist ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
                  {isInWishlist ? 'Saved in Wishlist' : 'Add to Wishlist'}
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(addToast({ type: 'info', title: 'Compare', message: 'Product added to comparison drawer.' }))}
                  className="flex items-center gap-1.5 hover:text-blue-600 font-medium transition"
                >
                  <Scale className="w-4 h-4 text-slate-500" />
                  Compare
                </button>
              </div>

              {/* Estimated Delivery Widget */}
              <div className="bg-[#eff6ff]/70 border border-blue-100 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs text-slate-800">
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold block text-slate-900">
                        Estimated Delivery: {deliveryStatus.estimate}
                      </span>
                      <span className="text-[11px] text-slate-500">{deliveryStatus.note}</span>
                    </div>
                  </div>
                </div>

                {/* Location checker input form */}
                <form onSubmit={handleCheckDelivery} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    placeholder="Enter your location (e.g. Dhaka, Banani...)"
                    className="flex-1 bg-white border border-slate-200 text-xs rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition"
                  >
                    Check
                  </button>
                </form>

                {/* Trust Badges Strip (3 trust guarantees) */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-blue-200/50 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <strong className="block text-slate-800 font-semibold">Free Shipping</strong>
                      <span className="text-[10px] text-slate-500">Over ৳1,000</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <strong className="block text-slate-800 font-semibold">Secure Payment</strong>
                      <span className="text-[10px] text-slate-500">100% Secure</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <strong className="block text-slate-800 font-semibold">Easy Return</strong>
                      <span className="text-[10px] text-slate-500">30 Days</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* 4 KEY FEATURE HIGHLIGHT CARDS (Full Width Row) */}
        {product.highlights && product.highlights.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {product.highlights.map((hl, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200/90 p-4 flex items-center gap-3.5 shadow-sm"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  {renderHighlightIcon(hl.icon)}
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">{hl.value}</h4>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">{hl.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TABBED CONTENT SECTION */}
        <div className="bg-white rounded-2xl border border-slate-200/90 mt-8 shadow-sm overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex items-center border-b border-slate-200 overflow-x-auto px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setActiveTab('desc')}
              className={`py-4 px-4 text-xs sm:text-sm font-bold transition border-b-2 whitespace-nowrap ${
                activeTab === 'desc'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/20'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Description
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('specs')}
              className={`py-4 px-4 text-xs sm:text-sm font-bold transition border-b-2 whitespace-nowrap ${
                activeTab === 'specs'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/20'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Specifications
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              className={`py-4 px-4 text-xs sm:text-sm font-bold transition border-b-2 whitespace-nowrap ${
                activeTab === 'reviews'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/20'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Reviews ({product.reviewCount.toLocaleString()})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('faqs')}
              className={`py-4 px-4 text-xs sm:text-sm font-bold transition border-b-2 whitespace-nowrap ${
                activeTab === 'faqs'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/20'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              FAQs
            </button>
          </div>

          {/* Tab Body */}
          <div className="p-6 sm:p-8">
            {activeTab === 'desc' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Description Column */}
                <div className="lg:col-span-6 space-y-4">
                  <h3 className="text-base font-bold text-slate-900">Product Description</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {product.description}
                  </p>
                  {product.features && product.features.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Key Capabilities</h4>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        {product.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Right Technical Specifications Mini Table */}
                <div className="lg:col-span-6 bg-slate-50 rounded-xl border border-slate-200/80 p-5">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Technical Specifications</h3>
                  {product.specificationsTable && product.specificationsTable.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {product.specificationsTable.map((spec, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                          <span className="text-[11px] font-medium text-slate-400 block">{spec.label}</span>
                          <span className="font-bold text-slate-800 block mt-0.5">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : product.attributes && Object.keys(product.attributes).length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {Object.entries(product.attributes)
                        .filter(([, val]) => val !== undefined && val !== null && String(val).trim() !== '')
                        .map(([key, val]) => (
                          <div key={key} className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                            <span className="text-[11px] font-medium text-slate-400 block capitalize">{key}</span>
                            <span className="font-bold text-slate-800 block mt-0.5">{String(val)}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="bg-white p-4 rounded-lg border border-slate-200/70 text-xs text-slate-500">
                      Technical specifications will be updated soon.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="max-w-3xl space-y-4">
                <h3 className="text-base font-bold text-slate-900">Comprehensive Hardware & Technical Specifications</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                  {product.specificationsTable && product.specificationsTable.length > 0 ? (
                    product.specificationsTable.map((spec, idx) => (
                      <div key={idx} className="flex py-3 px-4 hover:bg-slate-50 transition">
                        <span className="w-1/3 text-slate-500 font-medium shrink-0 pr-2">{spec.label}</span>
                        <span className="w-2/3 text-slate-900 font-semibold break-words">{spec.value}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex py-3 px-4 hover:bg-slate-50 transition">
                        <span className="w-1/3 text-slate-500 font-medium shrink-0 pr-2">Warranty</span>
                        <span className="w-2/3 text-slate-900 font-semibold break-words">{product.warranty || '1 Year Official Warranty'}</span>
                      </div>
                      <div className="flex py-3 px-4 hover:bg-slate-50 transition">
                        <span className="w-1/3 text-slate-500 font-medium shrink-0 pr-2">Delivery</span>
                        <span className="w-2/3 text-slate-900 font-semibold break-words">{product.deliveryEstimate || '2-3 Business Days'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                <p className="text-xs text-slate-500 mb-6">
                  Showing authenticated buyer ratings and reviews for this product.
                </p>
                {/* Embedded reviews preview in tab */}
              </div>
            )}

            {activeTab === 'faqs' && (
              <div className="max-w-3xl space-y-3">
                <h3 className="text-base font-bold text-slate-900 mb-4">Frequently Asked Questions</h3>
                {(product.faqs && product.faqs.length > 0 ? product.faqs : [
                  {
                    question: 'Does this product include warranty coverage?',
                    answer: product.warranty || 'Official manufacturer / brand warranty applies where specified.',
                  },
                  {
                    question: 'How fast is nationwide courier delivery?',
                    answer: product.deliveryEstimate || '2 to 3 working days via secure courier service across Bangladesh.',
                  },
                  {
                    question: 'What is the store return policy?',
                    answer: '30 days easy return policy with refund or replacement subject to inspection.',
                  },
                ]).map((faq, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">
                        ?
                      </span>
                      {faq.question}
                    </h4>
                    <p className="text-xs text-slate-600 mt-2 pl-7 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CUSTOMER REVIEWS & RATINGS SECTION */}
        <div className="bg-white rounded-2xl border border-slate-200/90 mt-8 p-6 sm:p-8 shadow-sm">
          {/* Section Header */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
              ★
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Customer Reviews & Ratings
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Rating Overview Card */}
            <div className="lg:col-span-4 bg-slate-50/70 rounded-xl border border-slate-200/80 p-5 space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-900">{(product.rating || 0).toFixed(1)}</span>
                <span className="text-lg font-bold text-slate-400">/ 5</span>
              </div>

              {/* Stars */}
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < Math.round(product.rating || 0)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>

              <p className="text-xs font-medium text-slate-500">
                Based on {(product.reviewCount || 0).toLocaleString()} Reviews
              </p>

              {/* Rating Breakdown Progress Bars */}
              <div className="space-y-1.5 pt-2 text-xs">
                {ratingBreakdown.map((row) => (
                  <div key={row.stars} className="flex items-center gap-2">
                    <span className="w-10 text-slate-600 font-medium">{row.stars} Star</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${row.pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-slate-500 font-semibold">{row.pct}%</span>
                  </div>
                ))}
              </div>

              {/* Write Review Button */}
              <button
                type="button"
                onClick={() => setIsWriteReviewOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 mt-2"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Write a Review
              </button>
            </div>

            {/* Right Reviews Listing & Filters */}
            <div className="lg:col-span-8 space-y-4">
              {/* Filter and Sort Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <select
                    value={reviewFilter}
                    onChange={(e: any) => {
                      setReviewFilter(e.target.value);
                      setVisibleReviewCount(3);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="all">All Reviews</option>
                    <option value="verified">Verified Buyers</option>
                    <option value="5">5 Star Reviews</option>
                    <option value="4">4 Star Reviews</option>
                    <option value="3">3 Star & Below</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Sort by:</span>
                  <select
                    value={reviewSort}
                    onChange={(e: any) => {
                      setReviewSort(e.target.value);
                      setVisibleReviewCount(3);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="newest">Newest</option>
                    <option value="helpful">Most Helpful</option>
                    <option value="highest">Highest Rating</option>
                  </select>
                </div>
              </div>

              {/* Review Cards */}
              <div className="space-y-4">
                {filteredReviews.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No reviews found matching the filter.</p>
                ) : (
                  filteredReviews.slice(0, visibleReviewCount).map((rev) => (
                    <div
                      key={rev._id}
                      className="bg-slate-50/50 rounded-xl border border-slate-200/70 p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                            {rev.userName ? rev.userName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-900">{rev.userName}</span>
                              {rev.isVerifiedPurchase && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  Verified Buyer
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {new Date(rev.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center text-amber-400">
                          {[...Array(rev.rating)].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed font-normal">{rev.comment}</p>

                      {rev.photos && rev.photos.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          {rev.photos.map((photo, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => setActiveReviewPhoto(photo)}
                              className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 transition"
                            >
                              <img src={photo} alt="Customer photo" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                        <button
                          type="button"
                          onClick={() => handleHelpfulVote(rev._id)}
                          className={`flex items-center gap-1.5 transition ${
                            helpfulVoted[rev._id] ? 'text-blue-600 font-bold' : 'hover:text-blue-600'
                          }`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${helpfulVoted[rev._id] ? 'fill-blue-600' : ''}`} />
                          <span>Helpful ({helpfulCounts[rev._id] ?? rev.helpfulCount ?? 0})</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Load More Button */}
              {filteredReviews.length > visibleReviewCount && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleReviewCount((c) => c + 5)}
                    className="text-xs font-semibold text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-400 rounded-lg px-4 py-2 transition cursor-pointer"
                  >
                    Load More Reviews ({filteredReviews.length - visibleReviewCount} remaining)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* YOU MAY ALSO LIKE SECTION (4-Product Grid) */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full" />
              <h2 className="text-xl font-extrabold text-slate-900">You May Also Like</h2>
            </div>
            <Link
              to="/shop"
              className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
            >
              View All Products
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {related.slice(0, 4).map((relProd) => {
              const relDiscount =
                relProd.basePrice > relProd.salePrice
                  ? Math.round(((relProd.basePrice - relProd.salePrice) / relProd.basePrice) * 100)
                  : 0;

              return (
                <div
                  key={relProd._id}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col group"
                >
                  {/* Image container */}
                  <div className="relative bg-[#f8fafc] p-6 aspect-square flex items-center justify-center overflow-hidden border-b border-slate-100">
                    {relDiscount > 0 ? (
                      <span className="absolute top-3 left-3 z-10 bg-emerald-500 text-white text-[11px] font-black px-2 py-0.5 rounded-md shadow-sm">
                        -{relDiscount}%
                      </span>
                    ) : relProd.badge ? (
                      <span className="absolute top-3 left-3 z-10 bg-amber-500 text-white text-[11px] font-black px-2 py-0.5 rounded-md shadow-sm">
                        {relProd.badge}
                      </span>
                    ) : null}

                    <Link to={`/product/${relProd.slug}`} className="w-full h-full flex items-center justify-center">
                      {relProd.images?.[0] ? (
                        <img
                          src={relProd.images[0]}
                          alt={relProd.name}
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Package className="w-12 h-12 text-slate-300" />
                      )}
                    </Link>
                  </div>

                  {/* Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <Link
                        to={`/product/${relProd.slug}`}
                        className="text-sm font-bold text-slate-900 hover:text-blue-600 transition line-clamp-1 block"
                      >
                        {relProd.name}
                      </Link>

                      {/* Stars & Reviews */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                        <div className="flex items-center">
                          <Star
                            className={`w-3.5 h-3.5 ${
                              (relProd.rating || 0) > 0
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        </div>
                        <span className="font-bold text-slate-800">{(relProd.rating || 0).toFixed(1)}</span>
                        <span>({relProd.reviewCount || 0})</span>
                      </div>

                      {/* Price */}
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-base font-extrabold text-blue-600">
                          ৳{relProd.salePrice.toLocaleString()}
                        </span>
                        {relProd.basePrice > relProd.salePrice && (
                          <span className="text-xs text-slate-400 line-through">
                            ৳{relProd.basePrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add to Cart button */}
                    <button
                      type="button"
                      disabled={(relProd.stock ?? 0) <= 0}
                      onClick={() => {
                        if ((relProd.stock ?? 0) <= 0) return;
                        dispatch(
                          addToCart({
                            productId: relProd._id,
                            name: relProd.name,
                            sku: relProd.sku,
                            price: relProd.salePrice,
                            originalPrice: relProd.basePrice > relProd.salePrice ? relProd.basePrice : undefined,
                            quantity: 1,
                            image: relProd.images?.[0] || '',
                            stock: relProd.stock,
                          })
                        );
                        dispatch(
                          addToast({
                            type: 'success',
                            title: 'Added to Cart',
                            message: `${relProd.name} added to your bag.`,
                          })
                        );
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed active:scale-[0.99] text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {(relProd.stock ?? 0) > 0 ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PDP Bottom Advertisement */}
        <PublicAdvertisement placement="pdp_bottom" className="mt-10" />
      </div>

      {/* FULL-SCREEN ZOOM MODAL */}
      {isZoomModalOpen && activeImage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsZoomModalOpen(false)}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 p-2 rounded-full transition"
            >
              <X className="w-7 h-7" />
            </button>

            {/* Modal Image */}
            <div className="bg-white rounded-2xl p-6 w-full flex items-center justify-center max-h-[75vh]">
              <img
                src={activeImage}
                alt={product.name}
                className="max-h-[70vh] max-w-full object-contain"
              />
            </div>

            {/* Thumbnail carousel */}
            <div className="flex items-center gap-3 mt-4">
              {productImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-14 h-14 rounded-xl overflow-hidden border-2 bg-white transition ${
                    selectedImageIndex === idx ? 'border-blue-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="thumb" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* WRITE A REVIEW MODAL */}
      {isWriteReviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in duration-200">
            <button
              type="button"
              onClick={() => setIsWriteReviewOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">Write a Review</h3>
            <p className="text-xs text-slate-500 mb-4">
              Share your experience with <strong>{product.name}</strong>
            </p>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Star Rating Select */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Overall Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="p-1 focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-700 ml-2">{newRating} of 5 Stars</span>
                </div>
              </div>

              {/* Comment Input */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Your Review</label>
                <textarea
                  rows={4}
                  required
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="What did you like or dislike? How does it perform?"
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400"
                />
              </div>

              {/* Photo URL input */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Photo URL (Optional)</label>
                <input
                  type="url"
                  value={newReviewPhoto}
                  onChange={(e) => setNewReviewPhoto(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWriteReviewOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview || !newComment.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-xs transition"
                >
                  {isSubmittingReview ? 'Publishing...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW PHOTO LIGHTBOX */}
      {activeReviewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActiveReviewPhoto(null)}
        >
          <div className="relative max-w-lg max-h-[80vh]">
            <button
              type="button"
              onClick={() => setActiveReviewPhoto(null)}
              className="absolute -top-10 right-0 text-white p-1"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={activeReviewPhoto} alt="Customer review photo" className="rounded-xl max-h-[75vh] object-contain shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetailPage;
