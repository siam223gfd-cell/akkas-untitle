import React from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Star,
  Tag,
  Layers,
  Award,
  Sliders,
  Image as ImageIcon,
  FileText,
  Newspaper,
  Settings,
  CreditCard,
  Truck,
  Percent,
  Bell,
  ShieldCheck,
  Database,
  UserCheck,
  ChevronRight,
  X,
  ExternalLink,
  Megaphone,
  Activity,
  Sparkles,
  Compass,
  DollarSign,
} from 'lucide-react';
import { User } from '../../types';

export type AdminModule =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'transactions'
  | 'customers'
  | 'reviews'
  | 'coupons'
  | 'categories'
  | 'brands'
  | 'attributes'
  | 'hero-slider'
  | 'banners'
  | 'navigation'
  | 'advertisements'
  | 'pages'
  | 'blog-posts'
  | 'general-settings'
  | 'payment-methods'
  | 'shipping-settings'
  | 'tax-fees'
  | 'notifications'
  | 'audit-logs'
  | 'backup-restore'
  | 'staff-management'
  | 'database-status';

export const ROLE_ALLOWED_MODULES: Record<string, AdminModule[]> = {
  super_admin: [
    'dashboard',
    'products',
    'orders',
    'transactions',
    'customers',
    'reviews',
    'coupons',
    'categories',
    'brands',
    'attributes',
    'hero-slider',
    'banners',
    'navigation',
    'advertisements',
    'pages',
    'blog-posts',
    'general-settings',
    'payment-methods',
    'shipping-settings',
    'tax-fees',
    'notifications',
    'audit-logs',
    'backup-restore',
    'staff-management',
    'database-status',
  ],
  admin: [
    'dashboard',
    'products',
    'orders',
    'transactions',
    'customers',
    'reviews',
    'coupons',
    'categories',
    'brands',
    'attributes',
    'hero-slider',
    'banners',
    'navigation',
    'advertisements',
    'pages',
    'blog-posts',
    'general-settings',
    'payment-methods',
    'shipping-settings',
    'tax-fees',
    'notifications',
    'audit-logs',
    'backup-restore',
    'staff-management',
    'database-status',
  ],
  catalog_manager: [
    'dashboard',
    'products',
    'coupons',
    'categories',
    'brands',
    'attributes',
    'hero-slider',
    'banners',
    'navigation',
    'advertisements',
    'pages',
    'blog-posts',
  ],
  order_manager: ['dashboard', 'orders', 'transactions', 'customers'],
  inventory_manager: ['dashboard', 'products'],
  customer_support: ['dashboard', 'customers', 'reviews'],
  finance: ['dashboard', 'orders', 'transactions', 'customers', 'audit-logs'],
};

export function canAccessModule(role: string | undefined, module: AdminModule): boolean {
  if (!role) return false;
  const allowed = ROLE_ALLOWED_MODULES[role];
  return Array.isArray(allowed) ? allowed.includes(module) : false;
}

interface AdminSidebarProps {
  activeModule: AdminModule;
  onSelectModule: (module: AdminModule) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  userRole?: User['role'];
  isDbConnected?: boolean;
  counts?: {
    products?: number;
    orders?: number;
    customers?: number;
    reviews?: number;
    coupons?: number;
  };
}

interface NavItem {
  id: AdminModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  badgeColor?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeModule,
  onSelectModule,
  isOpenMobile,
  onCloseMobile,
  userRole,
  isDbConnected,
  counts,
}) => {
  const handleItemClick = (module: AdminModule) => {
    onSelectModule(module);
    if (isOpenMobile) {
      onCloseMobile();
    }
  };

  const navGroups: NavGroup[] = [
    {
      title: 'Store & Catalog',
      items: [
        { id: 'products', label: 'Products', icon: Package, badge: counts?.products },
        { id: 'orders', label: 'Orders', icon: ShoppingBag, badge: counts?.orders, badgeColor: 'bg-blue-500/20 text-blue-300' },
        { id: 'transactions', label: 'Transactions', icon: DollarSign },
        { id: 'customers', label: 'Customers', icon: Users, badge: counts?.customers },
        { id: 'reviews', label: 'Reviews', icon: Star, badge: counts?.reviews },
        { id: 'coupons', label: 'Coupons', icon: Tag, badge: counts?.coupons },
        { id: 'categories', label: 'Categories', icon: Layers },
        { id: 'brands', label: 'Brands', icon: Award },
        { id: 'attributes', label: 'Attributes', icon: Sliders },
      ],
    },
    {
      title: 'Marketing & Content',
      items: [
        { id: 'navigation', label: 'Navigation Menu', icon: Compass },
        { id: 'hero-slider', label: 'Hero Slider', icon: Sliders },
        { id: 'banners', label: 'Dynamic Banners', icon: ImageIcon },
        { id: 'advertisements', label: 'Advertisements', icon: Megaphone },
        { id: 'pages', label: 'Custom Pages', icon: FileText },
        { id: 'blog-posts', label: 'Blog Posts', icon: Newspaper },
      ],
    },
    {
      title: 'Store Settings',
      items: [
        { id: 'general-settings', label: 'General Settings', icon: Settings },
        { id: 'payment-methods', label: 'Payment Gateways', icon: CreditCard },
        { id: 'shipping-settings', label: 'Shipping Zones', icon: Truck },
        { id: 'tax-fees', label: 'Tax & VAT', icon: Percent },
        { id: 'notifications', label: 'Notifications', icon: Bell },
      ],
    },
    {
      title: 'System & Security',
      items: [
        { id: 'audit-logs', label: 'Audit Trail', icon: ShieldCheck },
        { id: 'backup-restore', label: 'Backup & Recovery', icon: Database },
        { id: 'staff-management', label: 'Staff & Roles', icon: UserCheck },
        { id: 'database-status', label: 'Atlas Diagnostics', icon: Activity },
      ],
    },
  ];

  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !userRole || canAccessModule(userRole, item.id)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#071327] text-slate-300 flex flex-col border-r border-[#122442] shadow-xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[#122442] shrink-0">
          <Link to="/admin" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-base font-black tracking-tight text-white block leading-tight truncate">
                Aurelia
              </span>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase block">
                Store Console
              </span>
            </div>
          </Link>

          {/* Close button for mobile */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Area (Custom Trackless Scrollbar) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-5 admin-sidebar-scroll pb-8">
          {/* Dashboard Main Link */}
          <div>
            <button
              type="button"
              onClick={() => handleItemClick('dashboard')}
              className={`w-full px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-3 transition-all relative ${
                activeModule === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-white before:rounded-r'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 font-semibold'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard Overview</span>
            </button>
          </div>

          {/* Navigation Groups */}
          {visibleNavGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <h4 className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500/90 select-none">
                {group.title}
              </h4>

              <div className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all relative group cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/25 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-white before:rounded-r'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {/* Optional Badge / Indicator */}
                      {item.badge !== undefined && item.badge !== '' && item.badge !== 0 && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-bold tabular-nums ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : item.badgeColor || 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Status Panel */}
        <div className="p-3.5 border-t border-[#122442] bg-[#050e1d] shrink-0">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isDbConnected === false
                    ? 'bg-rose-400'
                    : isDbConnected === true
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400 animate-pulse'
                }`}
              />
              <div className="min-w-0">
                <p className="font-bold text-white text-[11px] truncate">MongoDB Atlas</p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {isDbConnected === false ? 'Disconnected' : isDbConnected === true ? 'Connected' : 'Checking...'}
                </p>
              </div>
            </div>

            <Link
              to="/"
              className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-blue-500/10"
              title="Open storefront"
            >
              <span>Store</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
};
