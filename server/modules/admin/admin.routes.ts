import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ProductModel } from '../../database/models/Product';
import { OrderModel } from '../../database/models/Order';
import { UserModel } from '../../database/models/User';
import { ReviewModel } from '../../database/models/Review';
import { CouponModel } from '../../database/models/Coupon';
import { CategoryModel } from '../../database/models/Category';
import { BrandModel } from '../../database/models/Brand';
import { PageModel } from '../../database/models/Page';
import { BlogPostModel } from '../../database/models/BlogPost';
import { AuditLogModel } from '../../database/models/AuditLog';
import { CMSConfigModel } from '../../database/models/CMS';
import { HeroSlideModel } from '../../database/models/HeroSlide';
import { BannerModel } from '../../database/models/Banner';
import { AdvertisementModel } from '../../database/models/Advertisement';
import { AuthenticatedRequest, requireRole } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { logAuditActivity } from '../../utils/auditLogger';
import { config } from '../../config/env';
import { escapeRegex } from '../../utils/regex';

export const adminRouter = Router();

const VALID_STAFF_ROLES = new Set([
  'super_admin',
  'admin',
  'catalog_manager',
  'order_manager',
  'inventory_manager',
  'customer_support',
  'finance',
]);

// Apply requireDatabase to all admin routes
adminRouter.use(requireDatabase);
// Restrict to staff / admin roles (including inventory_manager)
adminRouter.use(
  requireRole(
    'super_admin',
    'admin',
    'catalog_manager',
    'order_manager',
    'inventory_manager',
    'customer_support',
    'finance'
  )
);

function formatTrendPct(current: number, previous: number): string {
  if (previous <= 0 && current <= 0) return '0.0%';
  if (previous <= 0 && current > 0) return '+100.0%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function formatRelativeTime(dateVal: Date | string | undefined): string {
  if (!dateVal) return 'just now';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return 'just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

/**
 * GET /api/admin/analytics?range=today|7d|30d|month|year
 * Real MongoDB aggregations with prior-period trend comparison and continuous time-series buckets
 */
adminRouter.get('/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawRange = String(req.query.range || '30d').toLowerCase();
    const range: 'today' | '7d' | '30d' | 'month' | 'year' =
      rawRange === 'today' ||
      rawRange === '7d' ||
      rawRange === '30d' ||
      rawRange === 'month' ||
      rawRange === 'year'
        ? rawRange
        : '30d';

    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let currentStart: Date;
    const currentEnd = new Date(now);
    let priorStart: Date;
    let priorEnd: Date;

    if (range === 'today') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      priorStart = new Date(currentStart.getTime() - 24 * 60 * 60 * 1000);
      priorEnd = new Date(currentStart.getTime() - 1);
    } else if (range === '7d') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      priorStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      priorEnd = new Date(currentStart.getTime() - 1);
    } else if (range === 'month') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      priorStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      priorEnd = new Date(currentStart.getTime() - 1);
    } else if (range === 'year') {
      currentStart = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1, 0, 0, 0, 0);
      priorStart = new Date(now.getFullYear() - 2, now.getMonth() + 1, 1, 0, 0, 0, 0);
      priorEnd = new Date(currentStart.getTime() - 1);
    } else {
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
      priorStart = new Date(currentStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      priorEnd = new Date(currentStart.getTime() - 1);
    }

    const twelveMonthsStart = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1, 0, 0, 0, 0);

    const [
      totalProducts,
      totalCustomers,
      allTimeOrderAgg,
      currentOrderAgg,
      priorOrderAgg,
      statusBuckets,
      topProductsAgg,
      currentReviewsCount,
      priorReviewsCount,
      allTimeReviewsCount,
      activeUsersCurrent,
      activeUsersPrior,
      salesSeriesRaw,
      twelveMonthRaw,
      recentOrders,
      recentUsers,
      recentReviews,
      recentCoupons,
      recentProducts,
      googleUsers,
      facebookUsers,
      emailUsers,
    ] = await Promise.all([
      ProductModel.countDocuments({ status: { $ne: 'archived' } }),
      UserModel.countDocuments({ role: 'customer' }),
      OrderModel.aggregate([
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $in: ['$orderStatus', ['cancelled', 'returned']] },
                  0,
                  { $ifNull: ['$pricing.total', 0] },
                ],
              },
            },
          },
        },
      ]),
      OrderModel.aggregate([
        { $match: { createdAt: { $gte: currentStart, $lte: currentEnd } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $in: ['$orderStatus', ['cancelled', 'returned']] },
                  0,
                  { $ifNull: ['$pricing.total', 0] },
                ],
              },
            },
            buyers: { $addToSet: '$customerId' },
          },
        },
      ]),
      OrderModel.aggregate([
        { $match: { createdAt: { $gte: priorStart, $lte: priorEnd } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $in: ['$orderStatus', ['cancelled', 'returned']] },
                  0,
                  { $ifNull: ['$pricing.total', 0] },
                ],
              },
            },
            buyers: { $addToSet: '$customerId' },
          },
        },
      ]),
      OrderModel.aggregate([
        { $match: { createdAt: { $gte: currentStart, $lte: currentEnd } } },
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      ]),
      OrderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: currentStart, $lte: currentEnd },
            orderStatus: { $nin: ['cancelled', 'returned'] },
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.name' },
            price: { $first: '$items.price' },
            image: { $first: '$items.image' },
            sold: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          },
        },
        { $sort: { sold: -1, revenue: -1 } },
        { $limit: 5 },
      ]),
      ReviewModel.countDocuments({ createdAt: { $gte: currentStart, $lte: currentEnd } }),
      ReviewModel.countDocuments({ createdAt: { $gte: priorStart, $lte: priorEnd } }),
      ReviewModel.countDocuments(),
      UserModel.countDocuments({
        role: 'customer',
        isActive: { $ne: false },
        $or: [
          { lastLoginAt: { $gte: currentStart, $lte: currentEnd } },
          { createdAt: { $gte: currentStart, $lte: currentEnd } },
        ],
      }),
      UserModel.countDocuments({
        role: 'customer',
        isActive: { $ne: false },
        $or: [
          { lastLoginAt: { $gte: priorStart, $lte: priorEnd } },
          { createdAt: { $gte: priorStart, $lte: priorEnd } },
        ],
      }),
      OrderModel.aggregate([
        { $match: { createdAt: { $gte: currentStart, $lte: currentEnd } } },
        {
          $group: {
            _id:
              range === 'today'
                ? { $dateToString: { format: '%Y-%m-%d %H', date: '$createdAt' } }
                : range === 'year'
                ? { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
                : { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ['$orderStatus', ['cancelled', 'returned']] },
                  0,
                  { $ifNull: ['$pricing.total', 0] },
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      OrderModel.aggregate([
        {
          $match: {
            createdAt: { $gte: twelveMonthsStart, $lte: currentEnd },
            orderStatus: { $nin: ['cancelled', 'returned'] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            revenue: { $sum: { $ifNull: ['$pricing.total', 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      OrderModel.find().sort({ createdAt: -1 }).limit(3).select('orderNumber createdAt').lean(),
      UserModel.find({ role: 'customer' }).sort({ createdAt: -1 }).limit(3).select('name createdAt').lean(),
      ReviewModel.find().sort({ createdAt: -1 }).limit(2).select('rating userName createdAt').lean(),
      CouponModel.find().sort({ createdAt: -1 }).limit(2).select('code createdAt').lean(),
      ProductModel.find().sort({ createdAt: -1 }).limit(2).select('name createdAt').lean(),
      UserModel.countDocuments({
        role: 'customer',
        $or: [{ providers: 'google' }, { googleId: { $exists: true, $ne: '' } }],
      }),
      UserModel.countDocuments({
        role: 'customer',
        $or: [{ providers: 'facebook' }, { facebookId: { $exists: true, $ne: '' } }],
      }),
      UserModel.countDocuments({
        role: 'customer',
        $or: [{ providers: 'email' }, { providers: { $size: 0 } }, { providers: { $exists: false } }],
      }),
    ]);

    const curOrders = currentOrderAgg[0] || { totalOrders: 0, totalRevenue: 0, buyers: [] };
    const prevOrders = priorOrderAgg[0] || { totalOrders: 0, totalRevenue: 0, buyers: [] };
    const allTimeSummary = allTimeOrderAgg[0] || { totalOrders: 0, totalRevenue: 0 };

    const curUniqueBuyers = Array.isArray(curOrders.buyers) ? curOrders.buyers.length : 0;
    const prevUniqueBuyers = Array.isArray(prevOrders.buyers) ? prevOrders.buyers.length : 0;
    const totalVisitorsCurrent = activeUsersCurrent + curUniqueBuyers;
    const totalVisitorsPrior = activeUsersPrior + prevUniqueBuyers;

    const statusCounts: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      processing: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
    };
    for (const b of statusBuckets) {
      if (b._id) {
        statusCounts[String(b._id)] = b.count;
      }
    }

    const rangeOrderCount = curOrders.totalOrders || 0;
    const orderStatusPercentages = {
      pending: rangeOrderCount ? Math.round((statusCounts.pending / rangeOrderCount) * 100) : 0,
      confirmed: rangeOrderCount ? Math.round((statusCounts.confirmed / rangeOrderCount) * 100) : 0,
      processing: rangeOrderCount
        ? Math.round(((statusCounts.processing + statusCounts.packed) / rangeOrderCount) * 100)
        : 0,
      shipped: rangeOrderCount ? Math.round((statusCounts.shipped / rangeOrderCount) * 100) : 0,
      delivered: rangeOrderCount ? Math.round((statusCounts.delivered / rangeOrderCount) * 100) : 0,
      cancelled: rangeOrderCount ? Math.round((statusCounts.cancelled / rangeOrderCount) * 100) : 0,
      returned: rangeOrderCount ? Math.round((statusCounts.returned / rangeOrderCount) * 100) : 0,
    };

    // Build continuous time-series buckets for salesOverview
    const seriesLookup = new Map<string, { orders: number; revenue: number }>();
    for (const row of salesSeriesRaw) {
      seriesLookup.set(String(row._id), { orders: row.orders || 0, revenue: row.revenue || 0 });
    }

    const salesOverview: { date: string; orders: number; revenue: number }[] = [];
    if (range === 'today') {
      const ymd = currentStart.toISOString().slice(0, 10);
      for (let h = 0; h < 24; h += 3) {
        let orders = 0;
        let revenue = 0;
        for (let offset = 0; offset < 3; offset++) {
          const hh = String(h + offset).padStart(2, '0');
          const hit = seriesLookup.get(`${ymd} ${hh}`);
          if (hit) {
            orders += hit.orders;
            revenue += hit.revenue;
          }
        }
        salesOverview.push({ date: `${String(h).padStart(2, '0')}:00`, orders, revenue });
      }
    } else if (range === 'year') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const hit = seriesLookup.get(ym);
        salesOverview.push({
          date: `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`,
          orders: hit?.orders || 0,
          revenue: hit?.revenue || 0,
        });
      }
    } else {
      const cursor = new Date(currentStart);
      while (cursor <= currentEnd) {
        const ymd = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
          cursor.getDate()
        ).padStart(2, '0')}`;
        const hit = seriesLookup.get(ymd);
        salesOverview.push({
          date: `${monthNames[cursor.getMonth()]} ${cursor.getDate()}`,
          orders: hit?.orders || 0,
          revenue: hit?.revenue || 0,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // Build real trailing 12-month revenueGrowth series
    const monthLookup = new Map<string, number>();
    for (const m of twelveMonthRaw) {
      monthLookup.set(String(m._id), m.revenue || 0);
    }
    const rawMonthlyGrowth: { month: string; revenue: number; isPeak?: boolean }[] = [];
    let maxMonthRevenue = 0;
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rev = monthLookup.get(ym) || 0;
      if (rev > maxMonthRevenue) maxMonthRevenue = rev;
      rawMonthlyGrowth.push({
        month: monthNames[d.getMonth()],
        revenue: rev,
      });
    }
    const revenueGrowth = rawMonthlyGrowth.map((m) => ({
      ...m,
      isPeak: maxMonthRevenue > 0 && m.revenue === maxMonthRevenue,
    }));

    const topProducts = topProductsAgg.map((p: any) => ({
      name: p.name,
      price: p.price || 0,
      image: p.image || '',
      sold: p.sold || 0,
      revenue: p.revenue || 0,
    }));

    // Merge real activity stream sorted chronologically
    const rawActivities: {
      type: string;
      title: string;
      createdAt: Date;
      icon: string;
      color: string;
    }[] = [];

    for (const o of recentOrders as any[]) {
      rawActivities.push({
        type: 'order',
        title: `New Order #${o.orderNumber}`,
        createdAt: new Date(o.createdAt),
        icon: 'ShoppingCart',
        color: 'text-blue-600 bg-blue-50',
      });
    }
    for (const u of recentUsers as any[]) {
      rawActivities.push({
        type: 'user',
        title: `Customer Registered (${u.name})`,
        createdAt: new Date(u.createdAt),
        icon: 'User',
        color: 'text-cyan-600 bg-cyan-50',
      });
    }
    for (const r of recentReviews as any[]) {
      rawActivities.push({
        type: 'review',
        title: `New Review (${r.rating}★ by ${r.userName})`,
        createdAt: new Date(r.createdAt),
        icon: 'Star',
        color: 'text-amber-500 bg-amber-50',
      });
    }
    for (const c of recentCoupons as any[]) {
      rawActivities.push({
        type: 'coupon',
        title: `Coupon Created (${c.code})`,
        createdAt: new Date(c.createdAt),
        icon: 'Tag',
        color: 'text-sky-600 bg-sky-50',
      });
    }
    for (const p of recentProducts as any[]) {
      rawActivities.push({
        type: 'product',
        title: `Product Added (${p.name})`,
        createdAt: new Date(p.createdAt),
        icon: 'Package',
        color: 'text-blue-600 bg-blue-50',
      });
    }

    const recentActivities = rawActivities
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 6)
      .map((a) => ({
        type: a.type,
        title: a.title,
        time: formatRelativeTime(a.createdAt),
        icon: a.icon,
        color: a.color,
      }));

    res.json({
      success: true,
      range,
      stats: {
        totalVisitors: totalVisitorsCurrent,
        totalVisitorsTrend: formatTrendPct(totalVisitorsCurrent, totalVisitorsPrior),
        totalOrders: curOrders.totalOrders,
        totalOrdersTrend: formatTrendPct(curOrders.totalOrders, prevOrders.totalOrders),
        totalRevenue: curOrders.totalRevenue,
        totalRevenueTrend: formatTrendPct(curOrders.totalRevenue, prevOrders.totalRevenue),
        totalReviews: currentReviewsCount,
        totalReviewsTrend: formatTrendPct(currentReviewsCount, priorReviewsCount),
        activeUsers: activeUsersCurrent,
        activeUsersTrend: formatTrendPct(activeUsersCurrent, activeUsersPrior),
        totalProducts,
        totalCustomers,
        allTimeOrders: allTimeSummary.totalOrders,
        allTimeRevenue: allTimeSummary.totalRevenue,
        allTimeReviews: allTimeReviewsCount,
      },
      salesOverview,
      topProducts,
      orderStatusOverview: {
        totalOrders: rangeOrderCount,
        percentages: orderStatusPercentages,
        counts: statusCounts,
      },
      revenueGrowth,
      recentActivities,
      userAnalytics: {
        totalCustomers,
        googleUsers,
        facebookUsers,
        emailUsers,
        providerDistribution: {
          google: googleUsers,
          facebook: facebookUsers,
          email: emailUsers || Math.max(0, totalCustomers - googleUsers - facebookUsers),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * CUSTOMER MANAGEMENT
 */
/**
 * GET /api/admin/customers/stats & /api/admin/users/stats
 * Dedicated aggregated analytics on registered users, acquisition velocity, and auth providers
 */
adminRouter.get(
  ['/customers/stats', '/users/stats'],
  requireRole('super_admin', 'admin', 'customer_support', 'order_manager', 'finance'),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newToday,
      newThisWeek,
      newThisMonth,
      activeUsers,
      suspendedUsers,
      googleUsers,
      facebookUsers,
      emailUsers,
    ] = await Promise.all([
      UserModel.countDocuments({ role: 'customer' }),
      UserModel.countDocuments({ role: 'customer', createdAt: { $gte: startOfToday } }),
      UserModel.countDocuments({ role: 'customer', createdAt: { $gte: sevenDaysAgo } }),
      UserModel.countDocuments({ role: 'customer', createdAt: { $gte: thirtyDaysAgo } }),
      UserModel.countDocuments({ role: 'customer', isActive: { $ne: false } }),
      UserModel.countDocuments({ role: 'customer', isActive: false }),
      UserModel.countDocuments({
        role: 'customer',
        $or: [{ providers: 'google' }, { googleId: { $exists: true, $ne: '' } }],
      }),
      UserModel.countDocuments({
        role: 'customer',
        $or: [{ providers: 'facebook' }, { facebookId: { $exists: true, $ne: '' } }],
      }),
      UserModel.countDocuments({
        role: 'customer',
        $or: [
          { providers: 'email' },
          { providers: { $size: 0 } },
          { providers: { $exists: false } },
        ],
      }),
    ]);

    // Build 14-day daily registration trend
    const trendDays: { date: string; label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const dayCount = await UserModel.countDocuments({
        role: 'customer',
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      trendDays.push({
        date: startOfDay.toISOString().split('T')[0],
        label: `${monthNames[startOfDay.getMonth()]} ${startOfDay.getDate()}`,
        count: dayCount,
      });
    }

    res.json({
      success: true,
      stats: {
        totalUsers,
        newToday,
        newThisWeek,
        newThisMonth,
        activeUsers,
        suspendedUsers,
        providerDistribution: {
          google: googleUsers,
          facebook: facebookUsers,
          email: emailUsers || Math.max(0, totalUsers - googleUsers - facebookUsers),
        },
        registrationTrend: trendDays,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * CUSTOMER MANAGEMENT
 */
adminRouter.get(
  '/customers',
  requireRole('super_admin', 'admin', 'customer_support', 'order_manager', 'finance'),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = ((req.query.search as string) || '').trim();
    const provider = ((req.query.provider as string) || '').trim().toLowerCase();
    const status = ((req.query.status as string) || '').trim().toLowerCase();

    const query: any = { role: 'customer' };

    if (search) {
      const safe = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: safe }, { email: safe }, { phone: safe }];
    }

    if (provider && ['google', 'facebook', 'email'].includes(provider)) {
      const providerClause =
        provider === 'google'
          ? { $or: [{ providers: 'google' }, { googleId: { $exists: true, $ne: '' } }] }
          : provider === 'facebook'
          ? { $or: [{ providers: 'facebook' }, { facebookId: { $exists: true, $ne: '' } }] }
          : { $or: [{ providers: 'email' }, { providers: { $size: 0 } }, { providers: { $exists: false } }] };

      if (query.$or) {
        query.$and = [{ $or: query.$or }, providerClause];
        delete query.$or;
      } else {
        Object.assign(query, providerClause);
      }
    }

    if (status && ['active', 'suspended'].includes(status)) {
      query.isActive = status === 'active';
    }

    const customers = await UserModel.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with order aggregates (excluding cancelled/returned revenue)
    const orderAggregates = await OrderModel.aggregate([
      {
        $group: {
          _id: '$customerId',
          orderCount: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [
                { $in: ['$orderStatus', ['cancelled', 'returned']] },
                0,
                { $ifNull: ['$pricing.total', 0] },
              ],
            },
          },
        },
      },
    ]);

    const orderMap: Record<string, { count: number; spent: number }> = {};
    orderAggregates.forEach((oa) => {
      orderMap[oa._id] = { count: oa.orderCount, spent: oa.totalSpent };
    });

    const enriched = customers.map((c) => ({
      ...c,
      id: c._id.toString(),
      orderCount: orderMap[c._id.toString()]?.count || 0,
      totalSpent: orderMap[c._id.toString()]?.spent || 0,
      status: c.isActive !== false ? 'active' : 'suspended',
      isActive: c.isActive !== false,
      providers: Array.isArray(c.providers) && c.providers.length > 0 ? c.providers : ['email'],
      avatar: c.avatar || '',
      emailVerified: !!c.emailVerified,
      lastLoginAt: c.lastLoginAt || c.updatedAt || c.createdAt,
    }));

    res.json({ success: true, customers: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

adminRouter.get(
  '/customers/:id',
  requireRole('super_admin', 'admin', 'customer_support', 'order_manager', 'finance'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid customer identifier.' });
      }
      const customer = await UserModel.findOne({ _id: req.params.id, role: 'customer' })
        .select('-password')
        .lean();
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
      res.json({ success: true, customer });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

adminRouter.get(
  '/customers/:id/orders',
  requireRole('super_admin', 'admin', 'customer_support', 'order_manager', 'finance'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid customer identifier.' });
      }
      const orders = await OrderModel.find({ customerId: req.params.id })
        .sort({ createdAt: -1 })
        .lean();
      res.json({ success: true, orders });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

adminRouter.patch(
  '/customers/:id/status',
  requireRole('super_admin', 'admin', 'customer_support'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid customer identifier.' });
      }
      const { isActive } = req.body;
      const customer = await UserModel.findOneAndUpdate(
        { _id: req.params.id, role: 'customer' },
        { isActive: !!isActive },
        { new: true }
      ).select('-password');

      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer account not found.' });
      }

      await logAuditActivity({
        action: isActive ? 'ACTIVATE_CUSTOMER' : 'SUSPEND_CUSTOMER',
        module: 'Customer Management',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `${isActive ? 'Activated' : 'Suspended'} shopper account for "${customer.name}" (${customer.email})`,
        recordId: customer._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.json({
        success: true,
        message: `Customer account ${isActive ? 'activated' : 'suspended'} successfully.`,
        customer,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

adminRouter.put(
  '/customers/:id',
  requireRole('super_admin', 'admin', 'customer_support'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid customer identifier.' });
      }
      const { name, phone } = req.body;
      const updateData: any = {};
      if (typeof name === 'string' && name.trim()) updateData.name = name.trim();
      if (typeof phone === 'string') updateData.phone = phone.trim();

      const customer = await UserModel.findOneAndUpdate(
        { _id: req.params.id, role: 'customer' },
        updateData,
        { new: true }
      ).select('-password');

      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer account not found.' });
      }

      await logAuditActivity({
        action: 'UPDATE_CUSTOMER',
        module: 'Customer Management',
        actorName: req.user!.name,
        actorEmail: req.user!.email,
        actorRole: req.user!.role,
        details: `Updated profile details for customer "${customer.name}"`,
        recordId: customer._id.toString(),
        ipAddress: req.ip || '127.0.0.1',
      });

      res.json({ success: true, message: 'Customer profile updated.', customer });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * BRANDS MANAGEMENT
 */
adminRouter.get('/brands', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: Request, res: Response) => {
  try {
    let brands = await BrandModel.find().sort({ name: 1 }).lean();
    if (brands.length === 0) {
      const defaultBrands = [
        { name: 'Apple', slug: 'apple', logo: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=200&q=80', itemCount: 42 },
        { name: 'Samsung', slug: 'samsung', logo: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=200&q=80', itemCount: 38 },
        { name: 'Sony', slug: 'sony', logo: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=200&q=80', itemCount: 24 },
        { name: 'Nike', slug: 'nike', logo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80', itemCount: 56 },
        { name: 'Asus', slug: 'asus', logo: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=200&q=80', itemCount: 19 },
      ];
      await BrandModel.insertMany(defaultBrands);
      brands = await BrandModel.find().sort({ name: 1 }).lean();
    }
    res.json({ success: true, brands });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

adminRouter.post('/brands', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, logo, description, featured } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Brand name is required.' });
    }
    const cleanName = name.trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `brand-${Date.now()}`;
    const brand = await BrandModel.create({
      name: cleanName,
      slug,
      logo: typeof logo === 'string' ? logo.trim() : '',
      description: typeof description === 'string' ? description.trim() : '',
      featured: !!featured,
    });

    await AuditLogModel.create({
      action: 'CREATE_BRAND',
      module: 'Brands',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `Created new brand "${cleanName}"`,
    });

    res.status(201).json({ success: true, message: 'Brand created successfully', brand });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'A brand with this slug already exists.' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

adminRouter.put('/brands/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid brand identifier.' });
    }
    const updates: any = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) updates.name = req.body.name.trim();
    if (typeof req.body.slug === 'string' && req.body.slug.trim()) {
      updates.slug = req.body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    }
    if (typeof req.body.logo === 'string') updates.logo = req.body.logo.trim();
    if (typeof req.body.description === 'string') updates.description = req.body.description.trim();
    if (typeof req.body.isActive === 'boolean') updates.isActive = req.body.isActive;
    if (typeof req.body.featured === 'boolean') updates.featured = req.body.featured;

    const brand = await BrandModel.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
    res.json({ success: true, message: 'Brand updated', brand });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'A brand with this slug already exists.' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

adminRouter.delete('/brands/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid brand identifier.' });
    }
    const brand = await BrandModel.findByIdAndDelete(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
    res.json({ success: true, message: 'Brand removed' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * CONTENT PAGES MANAGEMENT (About Us, Contact, FAQ, Terms, Policies)
 */
adminRouter.get('/pages', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: Request, res: Response) => {
  try {
    let pages = await PageModel.find().lean();
    if (pages.length === 0) {
      await PageModel.insertMany([
        {
          slug: 'about-us',
          title: 'About Aurelia Commerce',
          content: 'Aurelia is Bangladesh’s premier online lifestyle and electronics store providing genuine, premium products with expedited fulfillment.',
        },
        {
          slug: 'privacy-policy',
          title: 'Privacy Policy',
          content: 'We prioritize your digital security and never share customer payment credentials or sensitive contact details with unauthorized third parties.',
        },
        {
          slug: 'terms-conditions',
          title: 'Terms & Conditions',
          content: 'Review the contractual terms for purchasing consumer electronics, warranty coverage, and returns on Aurelia.',
        },
      ]);
      pages = await PageModel.find().lean();
    }
    res.json({ success: true, pages });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

adminRouter.put('/pages/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid page identifier.' });
    }
    const updates: any = {};
    if (typeof req.body.title === 'string' && req.body.title.trim()) updates.title = req.body.title.trim();
    if (typeof req.body.content === 'string') updates.content = req.body.content;
    if (typeof req.body.metaTitle === 'string') updates.metaTitle = req.body.metaTitle.trim();
    if (typeof req.body.metaDescription === 'string') updates.metaDescription = req.body.metaDescription.trim();
    if (typeof req.body.isActive === 'boolean') updates.isActive = req.body.isActive;

    const page = await PageModel.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    res.json({ success: true, message: 'Page updated', page });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

adminRouter.post('/pages', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, slug, content, metaTitle, metaDescription, isActive } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Page title is required.' });
    }
    const cleanTitle = title.trim();
    const finalSlug = (slug && typeof slug === 'string' && slug.trim())
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const page = await PageModel.create({
      title: cleanTitle,
      slug: finalSlug,
      content: typeof content === 'string' ? content : '',
      metaTitle: typeof metaTitle === 'string' ? metaTitle.trim() : '',
      metaDescription: typeof metaDescription === 'string' ? metaDescription.trim() : '',
      isActive: isActive !== false,
    });
    res.status(201).json({ success: true, message: 'Page created successfully', page });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'A page with this slug already exists.' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

adminRouter.delete('/pages/:id', requireRole('super_admin', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid page identifier.' });
    }
    const deleted = await PageModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Page not found' });
    res.json({ success: true, message: 'Page deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * BLOG POSTS MANAGEMENT
 */
adminRouter.get('/blogs', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: Request, res: Response) => {
  try {
    let blogs = await BlogPostModel.find().sort({ publishedAt: -1 }).lean();
    if (blogs.length === 0) {
      await BlogPostModel.insertMany([
        {
          title: 'Top 10 Tech Accessories for 2026 in Bangladesh',
          slug: 'top-10-tech-accessories-2026',
          summary: 'From true wireless noise cancelling earbuds to high-wattage GaN chargers, discover this year’s must-have gear.',
          content: 'Smart devices continue to evolve rapidly. Here is our curated guide to the best performance electronics available at Aurelia.',
          author: 'Aurelia Tech Team',
          image: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=400&q=80',
          tags: ['Tech', 'Audio', 'Gadgets'],
        },
      ]);
      blogs = await BlogPostModel.find().lean();
    }
    res.json({ success: true, blogs, posts: blogs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

adminRouter.post('/blogs', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, summary, content, author, image, tags, isActive } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Blog post title is required.' });
    }
    if (!summary || typeof summary !== 'string' || !summary.trim()) {
      return res.status(400).json({ success: false, message: 'Blog post summary is required.' });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Blog post content is required.' });
    }
    const cleanTitle = title.trim();
    const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `post-${Date.now()}`;
    const blog = await BlogPostModel.create({
      title: cleanTitle,
      slug,
      summary: summary.trim(),
      content: content.trim(),
      author: typeof author === 'string' && author.trim() ? author.trim() : 'Aurelia Editorial',
      image: typeof image === 'string' ? image.trim() : '',
      tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()) : [],
      isActive: isActive !== false,
    });
    res.status(201).json({ success: true, message: 'Blog post published', blog, post: blog });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'A blog post with this slug already exists.' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

adminRouter.put('/blogs/:id', requireRole('super_admin', 'admin', 'catalog_manager'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid blog post identifier.' });
    }
    const updates: any = {};
    if (typeof req.body.title === 'string' && req.body.title.trim()) updates.title = req.body.title.trim();
    if (typeof req.body.summary === 'string') updates.summary = req.body.summary.trim();
    if (typeof req.body.content === 'string') updates.content = req.body.content.trim();
    if (typeof req.body.author === 'string') updates.author = req.body.author.trim();
    if (typeof req.body.image === 'string') updates.image = req.body.image.trim();
    if (Array.isArray(req.body.tags)) updates.tags = req.body.tags.filter((t: any) => typeof t === 'string' && t.trim());
    if (typeof req.body.isActive === 'boolean') updates.isActive = req.body.isActive;
    if (typeof req.body.readTime === 'number') updates.readTime = req.body.readTime;

    const blog = await BlogPostModel.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!blog) return res.status(404).json({ success: false, message: 'Blog post not found' });
    res.json({ success: true, message: 'Blog post updated', blog, post: blog });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

adminRouter.delete('/blogs/:id', requireRole('super_admin', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid blog post identifier.' });
    }
    const deleted = await BlogPostModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Blog post not found' });
    res.json({ success: true, message: 'Blog post deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * AUDIT LOGS (Searchable, Filterable, Paginated, Read-Only)
 */
adminRouter.get('/audit-logs', requireRole('super_admin', 'admin', 'finance'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = ((req.query.search as string) || '').trim();
    const moduleFilter = ((req.query.module as string) || '').trim();
    const actionFilter = ((req.query.action as string) || '').trim();
    const startDate = ((req.query.startDate as string) || '').trim();
    const endDate = ((req.query.endDate as string) || '').trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (search) {
      const safe = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { details: safe },
        { actorName: safe },
        { actorEmail: safe },
        { action: safe },
        { module: safe },
      ];
    }

    if (moduleFilter && moduleFilter !== 'all') {
      filter.module = new RegExp(`^${escapeRegex(moduleFilter)}$`, 'i');
    }

    if (actionFilter && actionFilter !== 'all') {
      filter.action = new RegExp(`^${escapeRegex(actionFilter)}$`, 'i');
    }

    if (startDate || endDate) {
      const ts: Record<string, Date> = {};
      if (startDate) {
        const d = new Date(startDate);
        if (!Number.isNaN(d.getTime())) ts.$gte = d;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          ts.$lte = end;
        }
      }
      if (Object.keys(ts).length > 0) {
        filter.timestamp = ts;
      }
    }

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * STAFF MANAGEMENT & RBAC (Full CRUD, Activation/Deactivation, Protection)
 */
adminRouter.get('/staff', requireRole('super_admin', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = ((req.query.search as string) || '').trim();
    const roleFilter = ((req.query.role as string) || '').trim();

    const query: any = { role: { $ne: 'customer' } };

    if (search) {
      const safe = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: safe }, { email: safe }, { phone: safe }];
    }

    if (roleFilter && roleFilter !== 'all' && VALID_STAFF_ROLES.has(roleFilter)) {
      query.role = roleFilter;
    }

    const staff = await UserModel.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = staff.map((s) => ({
      ...s,
      id: s._id.toString(),
      isActive: s.isActive !== false,
      status: s.isActive !== false ? 'active' : 'inactive',
    }));

    res.json({ success: true, staff: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

adminRouter.post('/staff', requireRole('super_admin', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password, role, phone, avatar } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const targetRole = role || 'admin';
    if (!VALID_STAFF_ROLES.has(targetRole)) {
      return res.status(400).json({ success: false, message: `Invalid staff role "${targetRole}".` });
    }

    const targetEmail = String(email).toLowerCase().trim();
    const existing = await UserModel.findOne({ email: targetEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user account with this email address already exists.' });
    }

    // Role elevation prevention: Only super_admin can create another super_admin
    if (targetRole === 'super_admin' && req.user!.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super administrators can provision super_admin accounts.' });
    }

    const newStaff = await UserModel.create({
      name: String(name).trim(),
      email: targetEmail,
      password,
      role: targetRole,
      phone: phone ? String(phone).trim() : '',
      avatar: typeof avatar === 'string' ? avatar.trim() : '',
      isActive: true,
      addresses: [],
    });

    await logAuditActivity({
      action: 'CREATE_STAFF_MEMBER',
      module: 'Staff Management',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `Created new staff account "${newStaff.name}" with role "${targetRole}"`,
      recordId: newStaff._id.toString(),
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: `Staff account for "${newStaff.name}" created successfully.`,
      staff: {
        id: newStaff._id.toString(),
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
        phone: newStaff.phone,
        avatar: newStaff.avatar,
        isActive: true,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

adminRouter.put('/staff/:id', requireRole('super_admin', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid staff identifier.' });
    }
    const targetUser = await UserModel.findById(req.params.id);
    if (!targetUser || targetUser.role === 'customer') {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    // Protection: Non-super_admin cannot edit a super_admin account
    if (targetUser.role === 'super_admin' && req.user!.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to modify a super_admin account.' });
    }

    const { name, email, phone, role, avatar, password } = req.body;

    if (role !== undefined) {
      if (!VALID_STAFF_ROLES.has(role)) {
        return res.status(400).json({ success: false, message: `Invalid staff role "${role}".` });
      }
      if (role === 'super_admin' && req.user!.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Only super administrators can assign the super_admin role.' });
      }
      const primaryAdmin = config.adminEmail?.toLowerCase().trim();
      if (targetUser.email.toLowerCase() === primaryAdmin && role !== 'super_admin') {
        return res.status(400).json({ success: false, message: 'The primary system administrator must retain the super_admin role.' });
      }
    }

    if (name && typeof name === 'string') targetUser.name = name.trim();
    if (email && typeof email === 'string') targetUser.email = email.toLowerCase().trim();
    if (typeof phone === 'string') targetUser.phone = phone.trim();
    if (role) targetUser.role = role;
    if (typeof avatar === 'string') targetUser.avatar = avatar.trim();

    if (password && typeof password === 'string' && password.length >= 6) {
      targetUser.password = password;
    }

    await targetUser.save();

    await logAuditActivity({
      action: 'UPDATE_STAFF_MEMBER',
      module: 'Staff Management',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `Updated staff profile and permissions for "${targetUser.name}" (${targetUser.role})`,
      recordId: targetUser._id.toString(),
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: 'Staff profile updated successfully.',
      staff: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        phone: targetUser.phone,
        avatar: targetUser.avatar,
        isActive: targetUser.isActive !== false,
      },
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'A user account with this email already exists.' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

adminRouter.patch('/staff/:id/status', requireRole('super_admin', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid staff identifier.' });
    }
    const targetUser = await UserModel.findById(req.params.id);
    if (!targetUser || targetUser.role === 'customer') {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    const primaryAdmin = config.adminEmail?.toLowerCase().trim();
    if (targetUser.email.toLowerCase() === primaryAdmin) {
      return res.status(400).json({ success: false, message: 'The primary system administrator cannot be deactivated.' });
    }

    if (targetUser._id.toString() === req.user!.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own active account.' });
    }

    if (targetUser.role === 'super_admin' && req.user!.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super administrators can alter super_admin status.' });
    }

    const { isActive } = req.body;
    targetUser.isActive = !!isActive;
    await targetUser.save();

    await logAuditActivity({
      action: isActive ? 'ACTIVATE_STAFF' : 'DEACTIVATE_STAFF',
      module: 'Staff Management',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `${isActive ? 'Activated' : 'Deactivated'} staff access for "${targetUser.name}" (${targetUser.email})`,
      recordId: targetUser._id.toString(),
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Staff account "${targetUser.name}" is now ${isActive ? 'active' : 'deactivated'}.`,
      isActive: targetUser.isActive,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

adminRouter.delete('/staff/:id', requireRole('super_admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid staff identifier.' });
    }
    const targetUser = await UserModel.findById(req.params.id);
    if (!targetUser || targetUser.role === 'customer') {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    const primaryAdmin = config.adminEmail?.toLowerCase().trim();
    if (targetUser.email.toLowerCase() === primaryAdmin) {
      return res.status(400).json({ success: false, message: 'The primary system administrator cannot be deleted.' });
    }

    if (targetUser._id.toString() === req.user!.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own active administrator account.' });
    }

    await UserModel.findByIdAndDelete(req.params.id);

    await logAuditActivity({
      action: 'DELETE_STAFF_MEMBER',
      module: 'Staff Management',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `Permanently removed staff member "${targetUser.name}" (${targetUser.email})`,
      recordId: req.params.id,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({ success: true, message: `Staff member "${targetUser.name}" deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * SYSTEM BACKUP & RESTORE (Full Multi-Collection Snapshot & Safe Restoration)
 */
adminRouter.post('/backup/export', requireRole('super_admin', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      products,
      categories,
      brands,
      orders,
      coupons,
      reviews,
      cms,
      pages,
      heroSlides,
      banners,
      advertisements,
      blogPosts,
    ] = await Promise.all([
      ProductModel.find().lean(),
      CategoryModel.find().lean(),
      BrandModel.find().lean(),
      OrderModel.find().lean(),
      CouponModel.find().lean(),
      ReviewModel.find().lean(),
      CMSConfigModel.findOne().lean(),
      PageModel.find().lean(),
      HeroSlideModel.find().lean(),
      BannerModel.find().lean(),
      AdvertisementModel.find().lean(),
      BlogPostModel.find().lean(),
    ]);

    const backupData = {
      exportDate: new Date().toISOString(),
      platform: 'Novara Commerce',
      version: '2.0.0',
      exportedBy: {
        name: req.user!.name,
        email: req.user!.email,
        role: req.user!.role,
      },
      counts: {
        products: products.length,
        categories: categories.length,
        brands: brands.length,
        orders: orders.length,
        coupons: coupons.length,
        reviews: reviews.length,
        pages: pages.length,
        heroSlides: heroSlides.length,
        banners: banners.length,
        advertisements: advertisements.length,
        blogPosts: blogPosts.length,
      },
      data: {
        products,
        categories,
        brands,
        orders,
        coupons,
        reviews,
        cms,
        pages,
        heroSlides,
        banners,
        advertisements,
        blogPosts,
      },
    };

    await logAuditActivity({
      action: 'EXPORT_DATABASE_BACKUP',
      module: 'Backup & Recovery',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `Generated full database backup snapshot (${products.length} products, ${orders.length} orders, ${categories.length} categories).`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: 'Database backup snapshot generated successfully.',
      backup: backupData,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

adminRouter.post('/backup/validate', requireRole('super_admin', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { backup } = req.body;
    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid backup file: Not a valid JSON payload.' });
    }

    if (!backup.data || typeof backup.data !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid backup format: Missing root "data" object.' });
    }

    const { data } = backup;
    const counts = {
      products: Array.isArray(data.products) ? data.products.length : 0,
      categories: Array.isArray(data.categories) ? data.categories.length : 0,
      brands: Array.isArray(data.brands) ? data.brands.length : 0,
      orders: Array.isArray(data.orders) ? data.orders.length : 0,
      coupons: Array.isArray(data.coupons) ? data.coupons.length : 0,
      reviews: Array.isArray(data.reviews) ? data.reviews.length : 0,
      pages: Array.isArray(data.pages) ? data.pages.length : 0,
      heroSlides: Array.isArray(data.heroSlides) ? data.heroSlides.length : 0,
      banners: Array.isArray(data.banners) ? data.banners.length : 0,
      advertisements: Array.isArray(data.advertisements) ? data.advertisements.length : 0,
      blogPosts: Array.isArray(data.blogPosts) ? data.blogPosts.length : 0,
      hasCMS: !!data.cms,
    };

    const totalRecords = Object.entries(counts).reduce(
      (acc, [k, v]) => (typeof v === 'number' ? acc + v : acc),
      0
    );

    res.json({
      success: true,
      valid: true,
      exportDate: backup.exportDate || 'Unknown',
      platform: backup.platform || 'Novara/Aurelia',
      counts,
      totalRecords,
      message: `Valid backup package containing ${totalRecords} records across catalog, orders, and CMS.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

adminRouter.post('/backup/restore', requireRole('super_admin', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { backup, confirm } = req.body;

    if (!confirm) {
      return res.status(400).json({
        success: false,
        message: 'Explicit administrative confirmation required (confirm: true).',
      });
    }

    if (!backup || !backup.data) {
      return res.status(400).json({
        success: false,
        message: 'Corrupted or missing backup data object.',
      });
    }

    const { data } = backup;
    const restoredSummary: Record<string, number> = {};

    // Restore Products
    if (Array.isArray(data.products) && data.products.length > 0) {
      for (const p of data.products) {
        if (p._id) {
          const { _id, ...rest } = p;
          await ProductModel.findByIdAndUpdate(_id, rest, { upsert: true });
        } else if (p.slug) {
          await ProductModel.findOneAndUpdate({ slug: p.slug }, p, { upsert: true });
        }
      }
      restoredSummary.products = data.products.length;
    }

    // Restore Categories
    if (Array.isArray(data.categories) && data.categories.length > 0) {
      for (const c of data.categories) {
        if (c._id) {
          const { _id, ...rest } = c;
          await CategoryModel.findByIdAndUpdate(_id, rest, { upsert: true });
        } else if (c.slug) {
          await CategoryModel.findOneAndUpdate({ slug: c.slug }, c, { upsert: true });
        }
      }
      restoredSummary.categories = data.categories.length;
    }

    // Restore Brands
    if (Array.isArray(data.brands) && data.brands.length > 0) {
      for (const b of data.brands) {
        if (b._id) {
          const { _id, ...rest } = b;
          await BrandModel.findByIdAndUpdate(_id, rest, { upsert: true });
        } else if (b.slug) {
          await BrandModel.findOneAndUpdate({ slug: b.slug }, b, { upsert: true });
        }
      }
      restoredSummary.brands = data.brands.length;
    }

    // Restore Coupons
    if (Array.isArray(data.coupons) && data.coupons.length > 0) {
      for (const cp of data.coupons) {
        if (cp.code) {
          await CouponModel.findOneAndUpdate({ code: cp.code }, cp, { upsert: true });
        }
      }
      restoredSummary.coupons = data.coupons.length;
    }

    // Restore Orders
    if (Array.isArray(data.orders) && data.orders.length > 0) {
      for (const ord of data.orders) {
        if (ord.orderNumber) {
          await OrderModel.findOneAndUpdate({ orderNumber: ord.orderNumber }, ord, { upsert: true });
        }
      }
      restoredSummary.orders = data.orders.length;
    }

    // Restore CMS Config
    if (data.cms) {
      const existing = await CMSConfigModel.findOne();
      if (existing) {
        await CMSConfigModel.findByIdAndUpdate(existing._id, data.cms);
      } else {
        await CMSConfigModel.create(data.cms);
      }
      restoredSummary.cms = 1;
    }

    // Restore Hero Slides
    if (Array.isArray(data.heroSlides) && data.heroSlides.length > 0) {
      for (const hs of data.heroSlides) {
        if (hs._id) {
          const { _id, ...rest } = hs;
          await HeroSlideModel.findByIdAndUpdate(_id, rest, { upsert: true });
        }
      }
      restoredSummary.heroSlides = data.heroSlides.length;
    }

    // Restore Dynamic Banners
    if (Array.isArray(data.banners) && data.banners.length > 0) {
      for (const bn of data.banners) {
        if (bn.slug) {
          await BannerModel.findOneAndUpdate({ slug: bn.slug }, bn, { upsert: true });
        }
      }
      restoredSummary.banners = data.banners.length;
    }

    await logAuditActivity({
      action: 'RESTORE_DATABASE_BACKUP',
      module: 'Backup & Recovery',
      actorName: req.user!.name,
      actorEmail: req.user!.email,
      actorRole: req.user!.role,
      details: `Restored database backup snapshot from ${backup.exportDate || 'uploaded archive'} across ${Object.keys(restoredSummary).length} collections.`,
      ipAddress: req.ip || '127.0.0.1',
      metadata: { restoredSummary },
    });

    res.json({
      success: true,
      message: 'Database snapshot successfully restored into MongoDB Atlas.',
      restoredSummary,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Restoration failed.' });
  }
});
