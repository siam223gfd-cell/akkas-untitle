import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks';
import { addToast } from '../features/ui/uiSlice';
import { apiRequest } from '../services/api';
import { Product, Category, DynamicBanner } from '../types';
import { ProductCard, ProductCardSkeleton } from '../components/public/ProductCard';
import { PublicHeroSlider } from '../components/public/PublicHeroSlider';
import { PublicDynamicBanner } from '../components/public/PublicDynamicBanner';
import { PublicAdvertisement } from '../components/public/PublicAdvertisement';
import { SafeLink } from '../components/common/SafeLink';
import {
  Truck,
  ShieldCheck,
  Headphones,
  RotateCcw,
  Star,
  ArrowRight,
  Mail,
  CheckCircle,
  Layers,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const [dynamicBanners, setDynamicBanners] = useState<DynamicBanner[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [trendingTab, setTrendingTab] = useState<'topSelling' | 'newArrivals' | 'bestRated'>('topSelling');
  const [trendingData, setTrendingData] = useState<{
    topSelling: Product[];
    newArrivals: Product[];
    bestRated: Product[];
  }>({
    topSelling: [],
    newArrivals: [],
    bestRated: [],
  });
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [cmsConfig, setCmsConfig] = useState<any>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isNewsletterSubscribed, setIsNewsletterSubscribed] = useState(false);
  const [isLoadingTrending, setIsLoadingTrending] = useState(true);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(true);

  useEffect(() => {
    // Fetch live categories
    apiRequest('/categories').then((res) => {
      if (res.success && res.categories) {
        setCategories(res.categories);
      }
    });

    // Fetch trending products
    setIsLoadingTrending(true);
    apiRequest('/products/trending')
      .then((res) => {
        setIsLoadingTrending(false);
        if (res.success && res.data) {
          setTrendingData(res.data);
        }
      })
      .catch(() => setIsLoadingTrending(false));

    // Fetch featured catalog products
    setIsLoadingFeatured(true);
    apiRequest('/products?limit=14&sort=popular')
      .then((res) => {
        setIsLoadingFeatured(false);
        if (res.success && res.products) {
          setFeaturedProducts(res.products);
        }
      })
      .catch(() => setIsLoadingFeatured(false));

    // Fetch CMS settings
    apiRequest('/cms/config').then((res) => {
      if (res.success && res.config) {
        setCmsConfig(res.config);
      }
    });

    // Fetch live Dynamic Banners
    apiRequest('/banners/public').then((res) => {
      if (res.success && res.banners) {
        setDynamicBanners(res.banners);
      }
    });
  }, []);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;

    const res = await apiRequest('/cms/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email: newsletterEmail }),
    });

    if (res.success) {
      setIsNewsletterSubscribed(true);
      setNewsletterEmail('');
      dispatch(
        addToast({
          type: 'success',
          title: 'Subscribed!',
          message: res.message || 'You have successfully subscribed to our newsletter.',
        })
      );
    }
  };

  const currentProducts = trendingData[trendingTab] || [];

  return (
    <div className="space-y-12 sm:space-y-16 pb-16">
      {/* 1. HERO CAMPAIGN (Image-Only Hero Slider - Strictly Visual Assets, Optional Clickable Link, Zero Text Overlays) */}
      <section className="relative">
        <PublicHeroSlider />
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-4">
          <PublicAdvertisement placement="homepage_hero" />
        </div>
      </section>

      {/* 2. TRUST BADGES STRIP (Matching Reference Image) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 -mt-6 sm:-mt-8 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-100/80 border border-slate-100 flex items-center gap-4 hover:border-blue-200 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Free Shipping</h4>
              <p className="text-xs text-slate-500">On Orders Over ৳1,000</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-100/80 border border-slate-100 flex items-center gap-4 hover:border-blue-200 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">100% Secure Payment</h4>
              <p className="text-xs text-slate-500">Your Data is Safe</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-100/80 border border-slate-100 flex items-center gap-4 hover:border-blue-200 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">24/7 Customer Support</h4>
              <p className="text-xs text-slate-500">Always Here to Help</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-100/80 border border-slate-100 flex items-center gap-4 hover:border-blue-200 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">30 Days Easy Return</h4>
              <p className="text-xs text-slate-500">Hassle-Free Policy</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SHOP BY CATEGORY (12 Cards with counts, matching image) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-6 bg-blue-600 rounded-full inline-block" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Shop by Category</h2>
          </div>
          <Link
            to="/shop"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <span>View All Categories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {categories.map((cat) => (
            <Link
              key={cat._id || cat.slug}
              to={`/shop?category=${cat.slug}`}
              className="group bg-white rounded-2xl p-4 border border-slate-100 hover:border-blue-300 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center justify-center"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-50 mb-3 flex items-center justify-center group-hover:scale-105 transition-transform">
                {cat.image ? (
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Layers className="w-7 h-7 text-slate-300" />
                )}
              </div>
              <h3 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                {cat.name}
              </h3>
              <span className="text-[10px] text-slate-400 mt-0.5">
                ({cat.liveCount ?? cat.itemCount ?? 0})
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. SPLIT PROMOTIONAL BANNERS (Dynamic Banner Builder Driven & Fallback Compatible) */}
      {(() => {
        const dynamicLeft = dynamicBanners.find((b) => b.placements?.includes('split_left'));
        const dynamicRight = dynamicBanners.find((b) => b.placements?.includes('split_right'));

        const leftBanner = cmsConfig?.banners?.find((b: any) => b.position === 'split_left' && b.isActive !== false);
        const rightBanner = cmsConfig?.banners?.find((b: any) => b.position === 'split_right' && b.isActive !== false);

        return (
          <section className="max-w-7xl mx-auto px-4 sm:px-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Banner */}
              {dynamicLeft ? (
                <PublicDynamicBanner banner={dynamicLeft} />
              ) : (
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-sky-400 text-white p-5 sm:p-8 lg:p-9 shadow-xl shadow-blue-500/10 flex items-center justify-between">
                  <div className="space-y-3 z-10 max-w-[70%] sm:max-w-[65%]">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
                      {leftBanner?.badge || 'Big Summer Sale'}
                    </span>
                    <h3 className="text-xl sm:text-3xl font-black leading-tight">
                      {leftBanner?.title || 'Up to 70% OFF'}
                    </h3>
                    <p className="text-xs text-blue-100">
                      {leftBanner?.subtitle || "Don't Miss Out On Hot Electronics & Lifestyle!"}
                    </p>
                    <Link
                      to={leftBanner?.link || '/shop?sort=discount'}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-blue-700 font-bold text-xs rounded-full shadow-md hover:bg-blue-50 transition-colors"
                    >
                      <span>{leftBanner?.ctaText || 'Shop the Sale'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-center opacity-85">
                    <img
                      src={leftBanner?.image || 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=400&q=80'}
                      alt={leftBanner?.title || 'Summer Sale'}
                      className="h-full object-cover object-left"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}

              {/* Right Banner */}
              {dynamicRight ? (
                <PublicDynamicBanner banner={dynamicRight} />
              ) : (
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#001736] to-[#002f6c] text-white p-5 sm:p-8 lg:p-9 shadow-xl flex items-center justify-between">
                  <div className="space-y-3 z-10 max-w-[70%] sm:max-w-[65%]">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                      {rightBanner?.badge || 'Next-Gen Tech'}
                    </span>
                    <h3 className="text-xl sm:text-3xl font-black leading-tight">
                      {rightBanner?.title || 'Smarter. Faster. Better.'}
                    </h3>
                    <p className="text-xs text-blue-200">
                      {rightBanner?.subtitle || 'Exclusive discounts on ultrabooks & iPads'}
                    </p>
                    <Link
                      to={rightBanner?.link || '/shop?category=electronics'}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-full shadow-md transition-colors"
                    >
                      <span>{rightBanner?.ctaText || 'Explore Tech'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="absolute right-2 top-0 bottom-0 w-1/3 flex items-center justify-center">
                    <img
                      src={rightBanner?.image || 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&q=80'}
                      alt={rightBanner?.title || 'Next Gen Tech'}
                      className="h-24 sm:h-28 object-contain drop-shadow-2xl"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Advertisement: Between Sections */}
            <PublicAdvertisement placement="between_sections" />
          </section>
        );
      })()}

      {/* 5. TRENDING PRODUCTS SECTION (Matching Reference) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-6 bg-blue-600 rounded-full inline-block" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Trending Products</h2>
          </div>

          {/* Filter tabs: Top Selling, New Arrivals, Best Rated */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setTrendingTab('topSelling')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                trendingTab === 'topSelling'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Top Selling
            </button>
            <button
              onClick={() => setTrendingTab('newArrivals')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                trendingTab === 'newArrivals'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              New Arrivals
            </button>
            <button
              onClick={() => setTrendingTab('bestRated')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                trendingTab === 'bestRated'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Best Rated
            </button>
          </div>
        </div>

        {/* Product Cards Row */}
        {isLoadingTrending ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5 sm:gap-4">
            {[...Array(7)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : currentProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center space-y-2">
            <p className="text-xs font-bold text-slate-700">No products available in this tab right now.</p>
            <p className="text-[11px] text-slate-400">Explore our complete catalog for thousands of trending items.</p>
            <Link
              to="/shop"
              className="inline-block mt-1 px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition"
            >
              Browse All Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5 sm:gap-4">
            {currentProducts.map((product) => (
              <ProductCard key={product._id || product.slug} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 6. MID-PAGE BRAND FEATURE BANNER: "Live Smarter with Aurelia" (Dynamic Banner with CMS Fallback) */}
      {(() => {
        const midDynamicBanner = dynamicBanners.find((b) => b.placements?.includes('mid_banner'));
        if (midDynamicBanner) {
          return (
            <section className="max-w-7xl mx-auto px-4 sm:px-8">
              <PublicDynamicBanner banner={midDynamicBanner} />
            </section>
          );
        }

        const midBanner = cmsConfig?.banners?.find((b: any) => b.position === 'mid_banner' && b.isActive !== false);

        return (
          <section className="max-w-7xl mx-auto px-4 sm:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#001736] via-[#002b66] to-[#001a3a] text-white p-8 sm:p-12 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-3 max-w-lg z-10 text-center md:text-left">
                {midBanner?.badge && (
                  <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold">
                    {midBanner.badge}
                  </span>
                )}
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                  {midBanner?.title || 'Live Smarter with Aurelia'}
                </h2>
                <p className="text-sm text-blue-100/80">
                  {midBanner?.subtitle || 'Discover the latest trends, unbeatable deals, and a better shopping experience curated for Bangladesh.'}
                </p>
                <div className="pt-2">
                  <Link
                    to={midBanner?.link || '/shop'}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs uppercase tracking-wider rounded-full shadow-lg transition-colors"
                  >
                    <span>{midBanner?.ctaText || 'Shop Now'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              <div className="relative z-10 w-full max-w-md flex items-center justify-center">
                <img
                  src={midBanner?.image || 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80'}
                  alt={midBanner?.title || 'Live Smarter Tech'}
                  className="w-full max-w-xs drop-shadow-2xl rounded-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </section>
        );
      })()}

      {/* 7. FEATURED CATALOG SHOWCASE (20-30 Genuine Database Products on Homepage) */}
      {featuredProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full inline-block" />
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Featured Catalog & Hot Deals
                </h2>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Genuine flagship electronics, lifestyle gear, and audio accessories from verified brands.
                </p>
              </div>
            </div>
            <Link
              to="/shop?sort=popular"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
            >
              <span>Explore All Products</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoadingFeatured ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5 sm:gap-4">
              {[...Array(7)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5 sm:gap-4">
              {featuredProducts.map((product) => (
                <ProductCard key={product._id || product.slug} product={product} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 8. AUTHENTIC CUSTOMER REVIEWS (What Our Customers Say) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-6 bg-blue-600 rounded-full inline-block" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">What Our Customers Say</h2>
          </div>
          <Link
            to="/shop"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <span>View All Reviews</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Review 1: Rafik Hasan */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
            <p className="text-sm text-slate-700 italic leading-relaxed">
              "Aurelia has the best products and super fast delivery. Highly recommended!"
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                  alt="Rafik Hasan"
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Rafik Hasan</h4>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                    <CheckCircle className="w-3 h-3 fill-blue-600 text-white" />
                    Verified Buyer
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
            </div>
          </div>

          {/* Review 2: Tania Akter */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
            <p className="text-sm text-slate-700 italic leading-relaxed">
              "Excellent quality and amazing service. I will shop again for sure!"
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80"
                  alt="Tania Akter"
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Tania Akter</h4>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                    <CheckCircle className="w-3 h-3 fill-blue-600 text-white" />
                    Verified Buyer
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
            </div>
          </div>

          {/* Review 3: Md. Fahim */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
            <p className="text-sm text-slate-700 italic leading-relaxed">
              "Very professional and trustworthy online store. Love it! 💖"
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80"
                  alt="Md. Fahim"
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Md. Fahim</h4>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                    <CheckCircle className="w-3 h-3 fill-blue-600 text-white" />
                    Verified Buyer
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. NEWSLETTER SUBSCRIPTION (Matching Reference) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 text-white p-5 sm:p-8 lg:p-10 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center lg:text-left">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Mail className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-bold">Subscribe to Our Newsletter</h3>
              <p className="text-xs text-blue-100">Get the latest updates, offers and exclusive vouchers.</p>
            </div>
          </div>

          <form onSubmit={handleNewsletterSubmit} className="w-full lg:max-w-md flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              type="email"
              required
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Enter your email address"
              className="flex-1 min-h-[44px] py-2.5 px-4 bg-white rounded-xl text-slate-800 text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-white/40 shadow-inner"
            />
            <button
              type="submit"
              disabled={isNewsletterSubscribed}
              className="min-h-[44px] py-2.5 px-6 bg-[#002244] hover:bg-black disabled:opacity-75 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer text-center whitespace-nowrap"
            >
              {isNewsletterSubscribed ? 'Subscribed ✓' : 'Subscribe'}
            </button>
          </form>
        </div>
      </section>

      {/* 9. OPTIONAL ADMIN-MANAGED PROMOTIONAL PLACEMENT */}
      {cmsConfig?.promotionalPlacement?.isEnabled && cmsConfig.promotionalPlacement.imageUrl && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8">
          <SafeLink
            to={cmsConfig.promotionalPlacement.destinationUrl || '/shop'}
            className="block overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-xl relative group"
          >
            <img
              src={cmsConfig.promotionalPlacement.imageUrl}
              alt={cmsConfig.promotionalPlacement.title}
              className="w-full h-48 sm:h-64 object-cover group-hover:scale-102 transition-transform"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 flex flex-col justify-end text-white">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Sponsored Placement</span>
              <h3 className="text-xl sm:text-2xl font-black">{cmsConfig.promotionalPlacement.title}</h3>
              {cmsConfig.promotionalPlacement.subtitle && (
                <p className="text-xs text-slate-300 mt-1">{cmsConfig.promotionalPlacement.subtitle}</p>
              )}
            </div>
          </SafeLink>
        </section>
      )}
    </div>
  );
};
