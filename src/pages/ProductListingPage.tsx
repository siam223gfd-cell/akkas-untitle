import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { Product, Category } from '../types';
import { ProductCard, ProductCardSkeleton } from '../components/public/ProductCard';
import { PublicAdvertisement } from '../components/public/PublicAdvertisement';
import {
  Filter,
  SlidersHorizontal,
  X,
  Search,
  Check,
  ArrowUp,
  PackageCheck,
} from 'lucide-react';

export const ProductListingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination & progressive loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Active filters from query params
  const categoryParam = searchParams.get('category') || 'all';
  const brandParam = searchParams.get('brand') || '';
  const queryParam = searchParams.get('q') || '';
  const sortParam = searchParams.get('sort') || 'newest';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';

  // Concurrency & stale response locks
  const inFlightRef = useRef(false);
  const activeQueryStringRef = useRef('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Fetch categories once on mount
  useEffect(() => {
    let active = true;
    apiRequest('/categories').then((res) => {
      if (active && res.success && res.categories) {
        setCategories(res.categories);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Compute normalized query string for current filter combination
  const currentFilterParams = React.useMemo(() => {
    const params = new URLSearchParams();
    if (categoryParam && categoryParam !== 'all') params.set('category', categoryParam);
    if (brandParam) params.set('brand', brandParam);
    if (queryParam) params.set('q', queryParam);
    if (sortParam && sortParam !== 'newest') params.set('sort', sortParam);
    if (minPriceParam) params.set('minPrice', minPriceParam);
    if (maxPriceParam) params.set('maxPrice', maxPriceParam);
    return params.toString();
  }, [categoryParam, brandParam, queryParam, sortParam, minPriceParam, maxPriceParam]);

  // Initial load or filter/search/sort change: Reset list and fetch first 20 items
  useEffect(() => {
    activeQueryStringRef.current = currentFilterParams;
    inFlightRef.current = true;
    setIsLoading(true);
    setIsLoadingMore(false);
    setProducts([]);
    setNextCursor(null);
    setCurrentPage(1);
    setHasMore(true);

    const endpoint = `/products?limit=20&page=1${currentFilterParams ? `&${currentFilterParams}` : ''}`;

    apiRequest(endpoint)
      .then((res) => {
        // Guard against race conditions: ignore response if filter changed while in flight
        if (activeQueryStringRef.current !== currentFilterParams) return;

        setIsLoading(false);
        inFlightRef.current = false;

        if (res.success) {
          const items: Product[] = res.products || [];
          setProducts(items);
          setTotalCount(res.pagination?.total || items.length);
          setHasMore(Boolean(res.hasMore ?? (items.length === 20)));
          setNextCursor(res.nextCursor || null);
          if (res.availableBrands) setAvailableBrands(res.availableBrands);
        } else {
          setProducts([]);
          setHasMore(false);
        }
      })
      .catch(() => {
        if (activeQueryStringRef.current !== currentFilterParams) return;
        setIsLoading(false);
        inFlightRef.current = false;
        setProducts([]);
        setHasMore(false);
      });
  }, [currentFilterParams]);

  // Progressive batch loader: fetch the next 20 products
  const loadNextBatch = useCallback(() => {
    if (inFlightRef.current || !hasMore || isLoading || isLoadingMore) {
      return;
    }

    inFlightRef.current = true;
    setIsLoadingMore(true);

    const nextPage = currentPage + 1;
    const queryParts = [
      'limit=20',
      `page=${nextPage}`,
      ...(nextCursor ? [`cursor=${encodeURIComponent(nextCursor)}`] : []),
      ...(currentFilterParams ? [currentFilterParams] : []),
    ];

    const endpoint = `/products?${queryParts.join('&')}`;

    apiRequest(endpoint)
      .then((res) => {
        if (activeQueryStringRef.current !== currentFilterParams) return;

        setIsLoadingMore(false);
        inFlightRef.current = false;

        if (res.success && Array.isArray(res.products)) {
          const newItems: Product[] = res.products;

          if (newItems.length === 0) {
            setHasMore(false);
            setNextCursor(null);
            return;
          }

          // Strict deduplication by ID and slug to prevent duplicate keys across page boundaries
          setProducts((prev) => {
            const seen = new Set(prev.map((p) => p._id || p.slug));
            const uniqueNew = newItems.filter((p) => !seen.has(p._id || p.slug));
            return [...prev, ...uniqueNew];
          });

          setCurrentPage(nextPage);
          setHasMore(Boolean(res.hasMore ?? (newItems.length === 20)));
          setNextCursor(res.nextCursor || null);
          if (res.pagination?.total) setTotalCount(res.pagination.total);
        } else {
          setHasMore(false);
        }
      })
      .catch(() => {
        if (activeQueryStringRef.current !== currentFilterParams) return;
        setIsLoadingMore(false);
        inFlightRef.current = false;
        setHasMore(false);
      });
  }, [hasMore, isLoading, isLoadingMore, nextCursor, currentPage, currentFilterParams]);

  // IntersectionObserver to detect when user approaches the end of the loaded catalog
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          loadNextBatch();
        }
      },
      {
        root: null,
        rootMargin: '250px',
        threshold: 0.05,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, loadNextBatch]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete('page');
    setSearchParams(next);
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <nav className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
            <Link to="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-semibold">
              {categoryParam !== 'all' ? categoryParam : queryParam ? `Search: "${queryParam}"` : 'All Products'}
            </span>
          </nav>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {categoryParam !== 'all'
              ? `${categoryParam.toUpperCase()}`
              : queryParam
              ? `Results for "${queryParam}"`
              : 'Explore Catalog'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isLoading
              ? 'Loading catalog items...'
              : `Showing ${products.length} of ${totalCount} authentic products available for delivery`}
          </p>
        </div>

        {/* Sort and mobile filter toggle */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsMobileFilterOpen(true)}
            className="lg:hidden min-h-[38px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-xs cursor-pointer active:bg-slate-50"
          >
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            Filters
          </button>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs min-h-[38px]">
            <span className="text-xs font-semibold text-slate-400">Sort:</span>
            <select
              value={sortParam}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-hidden cursor-pointer"
            >
              <option value="newest">Newest Arrivals</option>
              <option value="popular">Best Selling & Popular</option>
              <option value="discount">Biggest Discounts</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Customer Rating</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block space-y-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs h-fit sticky top-24">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              <span>Filters</span>
            </div>
            <button onClick={clearAllFilters} className="text-xs text-blue-600 hover:underline cursor-pointer">
              Clear All
            </button>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Categories</h4>
            <div className="space-y-1.5">
              <button
                onClick={() => updateParam('category', 'all')}
                className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  categoryParam === 'all'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => updateParam('category', cat.name)}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    categoryParam.toLowerCase() === cat.name.toLowerCase()
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className="text-[10px] text-slate-400">{cat.liveCount ?? cat.itemCount ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Brands */}
          {availableBrands.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Brands</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {availableBrands.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => updateParam('brand', brandParam === brand ? '' : brand)}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      brandParam === brand ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{brand}</span>
                    {brandParam === brand && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price Range */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Price (BDT ৳)</h4>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min ৳"
                value={minPriceParam}
                onChange={(e) => updateParam('minPrice', e.target.value)}
                className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                placeholder="Max ৳"
                value={maxPriceParam}
                onChange={(e) => updateParam('maxPrice', e.target.value)}
                className="w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* PLP Sidebar Advertisement */}
          <PublicAdvertisement placement="plp_sidebar" variant="sidebar" className="mt-6" />
        </aside>

        {/* Product Grid Area */}
        <main className="lg:col-span-3">
          {/* PLP Top Advertisement Banner */}
          <PublicAdvertisement placement="plp_top" className="mb-6" />

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No matching products found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                We couldn't find any items matching your selected criteria. Try adjusting your search keywords or clearing
                filters.
              </p>
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-blue-700 transition cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Responsive Product Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard key={product._id || product.slug} product={product} />
                ))}

                {/* Progressive Skeleton Loader appended during real pending batch requests */}
                {isLoadingMore &&
                  [...Array(4)].map((_, i) => (
                    <ProductCardSkeleton key={`skeleton-append-${i}`} />
                  ))}
              </div>

              {/* Infinite Scroll Sentinel element */}
              <div ref={sentinelRef} className="h-8 w-full pointer-events-none" aria-hidden="true" />

              {/* End of catalog indicator */}
              {!hasMore && products.length > 0 && !isLoading && !isLoadingMore && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center shadow-xs flex flex-col items-center justify-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <PackageCheck className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">You've reached the end of the catalog</h4>
                  <p className="text-[11px] text-slate-400">
                    Showing all {products.length} authentic products matching your criteria.
                  </p>
                  <button
                    onClick={scrollToTop}
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    Back to Top
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xs sm:w-80 bg-white h-full p-5 sm:p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Filters</h3>
              <button onClick={() => setIsMobileFilterOpen(false)} className="p-1 cursor-pointer" aria-label="Close filters">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Categories</h4>
              <button
                onClick={() => {
                  updateParam('category', 'all');
                  setIsMobileFilterOpen(false);
                }}
                className={`w-full text-left py-1.5 text-xs font-medium ${
                  categoryParam === 'all' ? 'text-blue-600 font-bold' : 'text-slate-700'
                }`}
              >
                All Categories
              </button>
              {categories.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => {
                    updateParam('category', c.name);
                    setIsMobileFilterOpen(false);
                  }}
                  className={`w-full text-left py-1.5 text-xs ${
                    categoryParam.toLowerCase() === c.name.toLowerCase()
                      ? 'text-blue-600 font-bold'
                      : 'text-slate-700'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {availableBrands.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Brands</h4>
                {availableBrands.map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      updateParam('brand', brandParam === b ? '' : b);
                      setIsMobileFilterOpen(false);
                    }}
                    className={`w-full text-left py-1.5 text-xs flex items-center justify-between ${
                      brandParam === b ? 'text-blue-600 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <span>{b}</span>
                    {brandParam === b && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => {
                  clearAllFilters();
                  setIsMobileFilterOpen(false);
                }}
                className="w-1/2 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
              >
                Reset
              </button>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-1/2 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
