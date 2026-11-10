import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import { selectCartUniqueLinesCount } from '../../features/cart/cartSlice';
import { selectWishlistCount } from '../../features/wishlist/wishlistSlice';
import { AccountPopup } from './AccountPopup';
import {
  User,
  Heart,
  ShoppingCart,
  Menu,
  ChevronDown,
  ChevronRight,
  X,
  Truck,
  RotateCcw,
  ShieldCheck,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { LiveSearch } from '../common/LiveSearch';
import { apiRequest } from '../../services/api';
import { NavigationItem } from '../../types';
import { renderNavIcon } from '../admin/NavigationManager';

const FALLBACK_NAV_ITEMS: NavigationItem[] = [
  { _id: 'def-1', label: 'Shop All', url: '/shop', type: 'link', parentId: null, displayOrder: 1, isActive: true, openInNewTab: false },
  { _id: 'def-2', label: 'Smartphones', url: '/shop?category=mobile-tablets', type: 'category', parentId: null, displayOrder: 2, isActive: true, openInNewTab: false },
  { _id: 'def-3', label: 'Audio & Sound', url: '/shop?category=electronics', type: 'category', parentId: null, displayOrder: 3, isActive: true, openInNewTab: false },
  { _id: 'def-4', label: 'Laptops & Computing', url: '/shop?category=computer-accessories', type: 'category', parentId: null, displayOrder: 4, isActive: true, openInNewTab: false },
  { _id: 'def-5', label: 'New Arrivals', url: '/shop?sort=newest', type: 'link', parentId: null, displayOrder: 5, isActive: true, openInNewTab: false },
  { _id: 'def-6', label: 'Special Offers', url: '/shop?sort=discount', badge: '⚡', badgeColor: '#f59e0b', type: 'link', parentId: null, displayOrder: 6, isActive: true, openInNewTab: false },
  { _id: 'def-7', label: 'Support', url: '/contact', type: 'page', parentId: null, displayOrder: 7, isActive: true, openInNewTab: false },
];

export const Navbar: React.FC = () => {
  const location = useLocation();
  const cartUniqueCount = useAppSelector(selectCartUniqueLinesCount);
  const wishlistCount = useAppSelector(selectWishlistCount);
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  // Dynamic Navigation state
  const [navItems, setNavItems] = useState<NavigationItem[]>(FALLBACK_NAV_ITEMS);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({});
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch categories for "All Categories ▾" dropdown
  useEffect(() => {
    apiRequest('/categories').then((res) => {
      if (res.success && res.categories) {
        setCategories(res.categories);
      }
    });
  }, []);

  // Fetch dynamic navigation menu from backend API
  useEffect(() => {
    apiRequest<{ success: boolean; items: NavigationItem[] }>('/navigation/public')
      .then((res) => {
        if (res.success && Array.isArray(res.items) && res.items.length > 0) {
          setNavItems(res.items);
        }
      })
      .catch((err) => {
        console.warn('Using fallback navigation items due to connection error:', err);
      });
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsCategoryMenuOpen(false);
    setActiveDropdownId(null);
  }, [location.pathname, location.search]);

  const handleMouseEnterDropdown = (id: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setActiveDropdownId(id);
  };

  const handleMouseLeaveDropdown = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdownId(null);
    }, 150);
  };

  const toggleMobileSubmenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMobileExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isCurrentActive = (url: string) => {
    const current = `${location.pathname}${location.search}`;
    if (url === '/' && current === '/') return true;
    if (url !== '/' && current.startsWith(url)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-white shadow-xs border-b border-slate-100">
      {/* 1. Subtle Micro Announcement Strip */}
      <div className="bg-[#051329] text-white text-[11px] py-1 px-4 sm:px-8 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-6 text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="flex items-center gap-1.5 text-blue-300 font-medium">
              <Truck className="w-3.5 h-3.5 shrink-0 text-blue-400" />
              <span>Free Shipping on Orders Over ৳1,000</span>
            </span>
            <span className="hidden md:inline text-slate-500">·</span>
            <span className="hidden md:flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>100% Genuine Brand Warranty</span>
            </span>
            <span className="hidden lg:inline text-slate-500">·</span>
            <span className="hidden lg:flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
              <span>30 Days Easy Return</span>
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-300 shrink-0">
            <a
              href="tel:+8801234567890"
              className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Phone className="w-3 h-3 text-blue-400" />
              <span>+880 1234 567890</span>
            </a>
            <Link
              to="/admin"
              className="text-[10px] font-bold text-blue-300 hover:text-white bg-blue-500/15 hover:bg-blue-500/25 px-2 py-0.5 rounded-md transition-colors"
            >
              Admin Portal
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Main Navigation Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4 sm:gap-8">
        {/* Left Section: Brand Logo & Identity */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Mobile hamburger toggle */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-blue-700 leading-none block">
                Aurelia
              </span>
              <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 tracking-wider uppercase block">
                Shop Smart, Live Better
              </span>
            </div>
          </Link>
        </div>

        {/* Center Section: Integrated Responsive Search Bar */}
        <div className="flex-1 max-w-2xl relative hidden md:block">
          <LiveSearch />
        </div>

        {/* Right Section: Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Account Icon / Avatar */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAccountOpen(!isAccountOpen)}
              className="p-1 sm:p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-all relative cursor-pointer group flex items-center gap-1.5"
              aria-label="User Account"
              title={isAuthenticated ? `Logged in as ${user?.name}` : 'My Account'}
            >
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-blue-600/30 group-hover:ring-blue-600 transition-all"
                      />
                    ) : (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-blue-700 to-blue-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                      title="Authenticated session active"
                    />
                  </div>
                  <span className="hidden xl:inline text-xs font-bold text-slate-700 max-w-[85px] truncate">
                    {user.name.split(' ')[0]}
                  </span>
                </div>
              ) : (
                <div className="p-1">
                  <User className="w-5 h-5 transition-transform group-hover:scale-105" />
                </div>
              )}
            </button>
            <AccountPopup isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
          </div>

          {/* Wishlist Icon */}
          <Link
            to="/wishlist"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 hover:text-rose-600 hover:bg-slate-100 rounded-xl transition-colors relative group"
            aria-label="Wishlist"
            title="Wishlist"
          >
            <Heart className="w-5 h-5 transition-transform group-hover:scale-105" />
            {wishlistCount > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs tabular-nums">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart Icon */}
          <Link
            to="/cart"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-colors relative group"
            aria-label="Shopping Cart"
            title="Cart"
          >
            <ShoppingCart className="w-5 h-5 transition-transform group-hover:scale-105" />
            {cartUniqueCount > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-rose-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs tabular-nums">
                {cartUniqueCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile search bar when collapsed */}
      <div className="px-4 pb-3 md:hidden">
        <LiveSearch isMobile placeholder="Search catalog products..." />
      </div>

      {/* 3. Compact Dynamic Navigation Menu Bar (Desktop) */}
      <div className="bg-[#0b1f3f] text-white hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center">
            {/* "All Categories ▾" dropdown button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 flex items-center gap-2 transition-colors uppercase tracking-wider cursor-pointer"
              >
                <Menu className="w-3.5 h-3.5" />
                <span>All Categories</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {isCategoryMenuOpen && (
                <div
                  onMouseLeave={() => setIsCategoryMenuOpen(false)}
                  className="absolute left-0 top-full w-60 bg-white text-slate-800 rounded-b-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in duration-100"
                >
                  {categories.map((cat) => (
                    <Link
                      key={cat._id || cat.slug}
                      to={`/shop?category=${cat.slug}`}
                      onClick={() => setIsCategoryMenuOpen(false)}
                      className="px-4 py-2 hover:bg-blue-50 text-xs font-medium text-slate-700 hover:text-blue-700 flex items-center justify-between transition-colors"
                    >
                      <span>{cat.name}</span>
                      <span className="text-[10px] text-slate-400">
                        ({cat.liveCount ?? cat.itemCount ?? 0})
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Database-Driven Dynamic Navigation Bar */}
            <nav className="flex items-center text-xs font-medium">
              {navItems.map((item) => {
                const hasChildren = item.children && item.children.length > 0;
                const isDropdownOpen = activeDropdownId === item._id;
                const active = isCurrentActive(item.url);

                if (hasChildren) {
                  return (
                    <div
                      key={item._id}
                      className="relative"
                      onMouseEnter={() => handleMouseEnterDropdown(item._id)}
                      onMouseLeave={handleMouseLeaveDropdown}
                    >
                      <Link
                        to={item.url}
                        target={item.openInNewTab ? '_blank' : undefined}
                        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                        className={`py-2.5 px-3.5 flex items-center gap-1.5 transition-colors font-medium ${
                          active
                            ? 'text-white bg-white/15 font-semibold'
                            : 'text-slate-200 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {item.icon && renderNavIcon(item.icon, 'w-3.5 h-3.5 text-blue-300')}
                        <span>{item.label}</span>
                        {item.badge && (
                          <span
                            className="px-1.5 py-0.2 text-[9px] font-bold rounded-full uppercase"
                            style={{
                              backgroundColor: `${item.badgeColor || '#3b82f6'}30`,
                              color: item.badgeColor || '#93c5fd',
                              border: `1px solid ${item.badgeColor || '#3b82f6'}60`,
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                        <ChevronDown className="w-3 h-3 opacity-70 ml-0.5" />
                      </Link>

                      {/* Dropdown Menu Popup (Level 2) */}
                      {isDropdownOpen && (
                        <div className="absolute left-0 top-full min-w-[220px] bg-white text-slate-800 rounded-b-xl shadow-2xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                          {item.children!.map((child) => {
                            const hasGrandChildren = child.children && child.children.length > 0;
                            return (
                              <div key={child._id} className="relative group/sub">
                                <Link
                                  to={child.url}
                                  target={child.openInNewTab ? '_blank' : undefined}
                                  rel={child.openInNewTab ? 'noopener noreferrer' : undefined}
                                  className="px-4 py-2 hover:bg-blue-50 text-xs font-medium text-slate-700 hover:text-blue-700 flex items-center justify-between transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {child.icon && renderNavIcon(child.icon, 'w-3.5 h-3.5 text-blue-500')}
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span>{child.label}</span>
                                        {child.badge && (
                                          <span
                                            className="px-1.5 py-0.2 text-[9px] font-bold rounded-full uppercase"
                                            style={{
                                              backgroundColor: `${child.badgeColor || '#3b82f6'}20`,
                                              color: child.badgeColor || '#2563eb',
                                            }}
                                          >
                                            {child.badge}
                                          </span>
                                        )}
                                      </div>
                                      {child.description && (
                                        <div className="text-[10px] text-slate-400 mt-0.5">{child.description}</div>
                                      )}
                                    </div>
                                  </div>
                                  {hasGrandChildren && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                </Link>

                                {/* Nested Grandchild Dropdown (Level 3 Flyout) */}
                                {hasGrandChildren && (
                                  <div className="absolute left-full top-0 min-w-[200px] bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-1.5 hidden group-hover/sub:block animate-in fade-in duration-100">
                                    {child.children!.map((grandchild) => (
                                      <Link
                                        key={grandchild._id}
                                        to={grandchild.url}
                                        target={grandchild.openInNewTab ? '_blank' : undefined}
                                        rel={grandchild.openInNewTab ? 'noopener noreferrer' : undefined}
                                        className="px-4 py-2 hover:bg-blue-50 text-xs font-medium text-slate-700 hover:text-blue-700 flex items-center justify-between transition-colors"
                                      >
                                        <div className="flex items-center gap-2">
                                          {grandchild.icon && renderNavIcon(grandchild.icon, 'w-3 h-3 text-blue-500')}
                                          <span>{grandchild.label}</span>
                                        </div>
                                        {grandchild.badge && (
                                          <span
                                            className="px-1.5 py-0.2 text-[9px] font-bold rounded-full uppercase"
                                            style={{
                                              backgroundColor: `${grandchild.badgeColor || '#3b82f6'}20`,
                                              color: grandchild.badgeColor || '#2563eb',
                                            }}
                                          >
                                            {grandchild.badge}
                                          </span>
                                        )}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Standard Link without dropdown
                return (
                  <Link
                    key={item._id}
                    to={item.url}
                    target={item.openInNewTab ? '_blank' : undefined}
                    rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                    className={`py-2.5 px-3.5 flex items-center gap-1.5 transition-colors font-medium ${
                      active
                        ? 'text-white bg-white/15 font-semibold'
                        : item.badgeColor === '#f59e0b' || item.badge === '⚡'
                        ? 'text-amber-300 hover:text-amber-200 hover:bg-white/10 font-semibold'
                        : 'text-slate-200 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {item.icon && renderNavIcon(item.icon, 'w-3.5 h-3.5 text-blue-300')}
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className="px-1.5 py-0.2 text-[9px] font-bold rounded-full uppercase tracking-wider"
                        style={{
                          backgroundColor: `${item.badgeColor || '#3b82f6'}30`,
                          color: item.badgeColor || '#93c5fd',
                          border: `1px solid ${item.badgeColor || '#3b82f6'}60`,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.openInNewTab && <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center text-[11px] text-slate-300">
            <span>Fast Nationwide Delivery</span>
          </div>
        </div>
      </div>

      {/* 4. Mobile Drawer Menu (with dynamic navigation & nested accordions) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-4 animate-in slide-in-from-top-2 duration-150 max-h-[80vh] overflow-y-auto">
          {/* Dynamic Storefront Navigation List */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Menu & Navigation
            </span>
            <div className="space-y-1">
              {navItems.map((item) => {
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = !!mobileExpanded[item._id];

                return (
                  <div key={item._id} className="rounded-xl border border-slate-100 overflow-hidden">
                    <div className="flex items-center justify-between bg-slate-50/80 hover:bg-blue-50/60 p-2.5 transition-colors">
                      <Link
                        to={item.url}
                        target={item.openInNewTab ? '_blank' : undefined}
                        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                        onClick={() => !hasChildren && setIsMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 flex-1 min-w-0"
                      >
                        {item.icon && renderNavIcon(item.icon, 'w-4 h-4 text-blue-600')}
                        <span className="text-xs font-semibold text-slate-800 truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className="px-1.5 py-0.2 text-[9px] font-bold rounded-full uppercase"
                            style={{
                              backgroundColor: `${item.badgeColor || '#3b82f6'}20`,
                              color: item.badgeColor || '#2563eb',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>

                      {hasChildren && (
                        <button
                          type="button"
                          onClick={(e) => toggleMobileSubmenu(item._id, e)}
                          className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors ml-2"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      )}
                    </div>

                    {/* Mobile Nested Children Accordion */}
                    {hasChildren && isExpanded && (
                      <div className="bg-white px-3 py-2 space-y-1 border-t border-slate-100">
                        {item.children!.map((child) => (
                          <Link
                            key={child._id}
                            to={child.url}
                            target={child.openInNewTab ? '_blank' : undefined}
                            rel={child.openInNewTab ? 'noopener noreferrer' : undefined}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-blue-50 text-xs text-slate-600 hover:text-blue-700 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {child.icon && renderNavIcon(child.icon, 'w-3.5 h-3.5 text-blue-500')}
                              <span className="font-medium">{child.label}</span>
                            </div>
                            {child.badge && (
                              <span
                                className="px-1.5 py-0.2 text-[9px] font-bold rounded-full uppercase"
                                style={{
                                  backgroundColor: `${child.badgeColor || '#3b82f6'}20`,
                                  color: child.badgeColor || '#2563eb',
                                }}
                              >
                                {child.badge}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Popular Categories Grid */}
          <div className="space-y-1 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Popular Categories
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {categories.slice(0, 8).map((cat) => (
                <Link
                  key={cat._id || cat.slug}
                  to={`/shop?category=${cat.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition truncate"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <Link
              to="/shop"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-blue-600 hover:underline"
            >
              Browse Full Catalog →
            </Link>
            <Link
              to="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-slate-500 hover:text-slate-800"
            >
              Customer Support
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
