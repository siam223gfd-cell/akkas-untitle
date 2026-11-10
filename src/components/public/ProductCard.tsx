import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../../types';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { addToCart } from '../../features/cart/cartSlice';
import { toggleWishlist, selectIsInWishlist } from '../../features/wishlist/wishlistSlice';
import { addToast } from '../../features/ui/uiSlice';
import { apiRequest } from '../../services/api';
import { Star, ShoppingCart, Heart, Package } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, className = '' }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const isInWishlist = useAppSelector(selectIsInWishlist(product._id, product.slug));
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const hasImage = Boolean(product.images?.[0] && !imageError);
  const displayImage = hasImage ? product.images![0] : '';

  const hasDiscount = product.basePrice > product.salePrice;
  const discountPercentage = hasDiscount
    ? Math.round(((product.basePrice - product.salePrice) / product.basePrice) * 100)
    : 0;

  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  const handleCardClick = () => {
    navigate(`/product/${product.slug}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isOutOfStock) return;

    dispatch(
      addToCart({
        productId: product._id,
        name: product.name,
        sku: product.sku,
        price: product.salePrice,
        originalPrice: hasDiscount ? product.basePrice : undefined,
        quantity: 1,
        image: displayImage,
        stock: product.stock,
      })
    );

    dispatch(
      addToast({
        type: 'success',
        title: 'Added to Cart',
        message: `${product.name} (৳${product.salePrice.toLocaleString()}) added to your shopping bag.`,
      })
    );
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    dispatch(
      toggleWishlist({
        productId: product._id,
        name: product.name,
        slug: product.slug,
        price: product.salePrice,
        originalPrice: hasDiscount ? product.basePrice : undefined,
        discountBadge: hasDiscount ? `-${discountPercentage}%` : product.badge,
        image: displayImage,
        rating: product.rating,
        reviewCount: product.reviewCount,
        category: product.category,
        inStock: !isOutOfStock,
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
        type: isInWishlist ? 'info' : 'success',
        title: isInWishlist ? 'Removed from Wishlist' : 'Saved to Wishlist',
        message: isInWishlist
          ? `${product.name} removed from your saved items.`
          : `${product.name} saved to your wishlist.`,
      })
    );
  };

  return (
    <article
      onClick={handleCardClick}
      className={`group bg-white rounded-2xl border border-slate-100 hover:border-blue-300 shadow-2xs hover:shadow-xl transition-all duration-300 p-3.5 flex flex-col justify-between cursor-pointer relative min-w-0 ${className}`}
      aria-label={product.name}
    >
      {/* Top Badges & Wishlist Action */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between z-10 pointer-events-none">
        <div className="flex flex-col gap-1 items-start">
          {/* Discount or Custom Badge */}
          {hasDiscount && discountPercentage > 0 ? (
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-white bg-emerald-600 shadow-xs">
              -{discountPercentage}%
            </span>
          ) : product.badge ? (
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-white shadow-xs ${
                product.badge === 'Hot'
                  ? 'bg-rose-600'
                  : product.badge === 'New'
                  ? 'bg-blue-600'
                  : 'bg-amber-500'
              }`}
            >
              {product.badge}
            </span>
          ) : null}

          {/* Stock state indicator badge */}
          {isOutOfStock ? (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-800 text-white shadow-xs">
              Sold Out
            </span>
          ) : isLowStock ? (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
              Only {product.stock} left
            </span>
          ) : null}
        </div>

        {/* Wishlist Toggle Button (Interactive) */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          aria-label={isInWishlist ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          className="pointer-events-auto w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-400 hover:text-rose-600 shadow-sm border border-slate-100 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              isInWishlist ? 'text-rose-500 fill-rose-500' : 'text-slate-500 group-hover:text-slate-700'
            }`}
          />
        </button>
      </div>

      {/* Product Image Container with Layout Shift Prevention */}
      <div className="w-full aspect-square rounded-xl bg-slate-50 mb-3 overflow-hidden flex items-center justify-center relative">
        {hasImage ? (
          <>
            {!imageLoaded && <div className="absolute inset-0 bg-slate-100 animate-pulse" />}
            <img
              src={displayImage}
              alt={product.name}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              referrerPolicy="no-referrer"
            />
          </>
        ) : (
          <Package className="w-10 h-10 text-slate-300" />
        )}
      </div>

      {/* Product Details Section */}
      <div className="space-y-1.5 flex-1 flex flex-col justify-between">
        <div>
          {product.brand && (
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              {product.brand}
            </span>
          )}
          <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
            {product.name}
          </h3>
        </div>

        <div className="space-y-2 pt-1">
          {/* Authentic Rating & Review Count (Only display if real data exists) */}
          {product.rating > 0 ? (
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="font-bold text-slate-800">{product.rating.toFixed(1)}</span>
              {product.reviewCount > 0 && (
                <span className="text-[10px] text-slate-400">
                  (
                  {product.reviewCount >= 1000
                    ? `${(product.reviewCount / 1000).toFixed(1)}k`
                    : product.reviewCount}
                  )
                </span>
              )}
            </div>
          ) : (
            <div className="h-4" />
          )}

          {/* Pricing Row */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm font-black text-blue-700 tabular-nums">
              ৳{product.salePrice.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="text-[10px] text-slate-400 line-through tabular-nums">
                ৳{product.basePrice.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Add to Cart CTA Button */}
      <button
        type="button"
        disabled={isOutOfStock}
        onClick={handleAddToCart}
        aria-label={isOutOfStock ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
        className={`mt-3 w-full py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer ${
          isOutOfStock
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            : 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-blue-500/10'
        }`}
      >
        <ShoppingCart className="w-3.5 h-3.5" />
        <span>{isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
      </button>
    </article>
  );
};

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3.5 flex flex-col justify-between animate-pulse space-y-3">
      <div className="w-full aspect-square bg-slate-100 rounded-xl" />
      <div className="space-y-1.5">
        <div className="w-1/3 h-2.5 bg-slate-100 rounded" />
        <div className="w-full h-3.5 bg-slate-100 rounded" />
        <div className="w-2/3 h-3.5 bg-slate-100 rounded" />
        <div className="w-1/2 h-4 bg-slate-100 rounded pt-1" />
      </div>
      <div className="w-full h-8 bg-slate-100 rounded-xl mt-3" />
    </div>
  );
};
