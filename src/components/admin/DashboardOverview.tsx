import React, { useMemo, useState } from 'react';
import {
  Users,
  ShoppingCart,
  ShoppingBag,
  Star,
  TrendingUp,
  BarChart3,
  Trophy,
  Zap,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Calendar,
  Package,
  Layers,
  Image as ImageIcon,
  Tag,
  Clock,
  User,
  LayoutGrid,
} from 'lucide-react';
import { AdminModule } from './AdminSidebar';
import { AnalyticsResponse } from '../../types';

export type AnalyticsRange = 'today' | '7d' | '30d' | 'month' | 'year';

interface DashboardOverviewProps {
  stats?: AnalyticsResponse['stats'];
  salesOverview?: AnalyticsResponse['salesOverview'];
  topProducts?: AnalyticsResponse['topProducts'];
  orderStatusOverview?: AnalyticsResponse['orderStatusOverview'];
  revenueGrowth?: AnalyticsResponse['revenueGrowth'];
  recentActivities?: AnalyticsResponse['recentActivities'];
  userAnalytics?: AnalyticsResponse['userAnalytics'];
  dateRange?: AnalyticsRange;
  onDateRangeChange?: (range: AnalyticsRange) => void;
  isLoading?: boolean;
  onSelectModule: (module: AdminModule) => void;
  onOpenAddProduct: () => void;
  onOpenAddCoupon: () => void;
  onOpenAddCategory: () => void;
  onOpenAddBanner: () => void;
}

const RANGE_OPTIONS: { value: AnalyticsRange; label: string; subtitle: string }[] = [
  { value: 'today', label: 'Today', subtitle: 'Your store performance today' },
  { value: '7d', label: 'Last 7 Days', subtitle: 'Your store performance over the last 7 days' },
  { value: '30d', label: 'Last 30 Days', subtitle: 'Your store performance over the last 30 days' },
  { value: 'month', label: 'This Month', subtitle: 'Your store performance this month' },
  { value: 'year', label: 'This Year', subtitle: 'Your store performance over the last 12 months' },
];

function formatCompactNumber(val: number): string {
  const num = Number(val || 0);
  if (num >= 100000) {
    const l = num / 100000;
    return `${Number.isInteger(l) ? l : l.toFixed(1)}L`;
  }
  if (num >= 1000) {
    const k = num / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return String(Math.round(num));
}

function buildSparklinePath(values: number[]): string {
  if (!values || values.length === 0) {
    return 'M 0,42 L 100,42';
  }
  const maxVal = Math.max(...values, 0);
  if (maxVal <= 0) {
    return 'M 0,42 L 100,42';
  }
  if (values.length === 1) {
    const y = 44 - (values[0] / maxVal) * 36;
    return `M 0,${y.toFixed(1)} L 100,${y.toFixed(1)}`;
  }
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 44 - (Math.max(0, v) / maxVal) * 36;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildLineAndAreaPaths(
  points: { x: number; y: number }[],
  plotBottom: number
): { linePath: string; areaPath: string } {
  if (points.length === 0) {
    return { linePath: '', areaPath: '' };
  }
  if (points.length === 1) {
    const p = points[0];
    return {
      linePath: `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`,
      areaPath: `M ${p.x.toFixed(1)},${p.y.toFixed(1)} L ${p.x.toFixed(1)},${plotBottom} Z`,
    };
  }
  const lineParts = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  const linePath = lineParts.join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${linePath} L ${last.x.toFixed(1)},${plotBottom} L ${first.x.toFixed(1)},${plotBottom} Z`;
  return { linePath, areaPath };
}

function renderTrendBadge(trend?: string) {
  const clean = (trend || '0.0%').trim();
  const isNeg = clean.startsWith('-');
  const isZero = clean === '0.0%' || clean === '0%' || clean === '+0.0%';

  if (isNeg) {
    return (
      <div className="flex items-center gap-1 text-xs font-bold text-rose-600">
        <ArrowDown className="w-3.5 h-3.5" />
        <span>{clean}</span>
      </div>
    );
  }
  if (isZero) {
    return (
      <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
        <span>{clean}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
      <ArrowUp className="w-3.5 h-3.5" />
      <span>{clean}</span>
    </div>
  );
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  salesOverview,
  topProducts,
  orderStatusOverview,
  revenueGrowth,
  recentActivities,
  userAnalytics,
  dateRange,
  onDateRangeChange,
  isLoading = false,
  onSelectModule,
  onOpenAddProduct,
  onOpenAddCoupon,
  onOpenAddCategory,
  onOpenAddBanner,
}) => {
  const [localRange, setLocalRange] = useState<AnalyticsRange>('30d');
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [hoveredSalesIdx, setHoveredSalesIdx] = useState<number | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<{ month: string; revenue: number; isPeak?: boolean } | null>(null);

  const activeRange: AnalyticsRange = dateRange ?? localRange;
  const activeRangeMeta = RANGE_OPTIONS.find((r) => r.value === activeRange) || RANGE_OPTIONS[2];

  const handleSelectRange = (nextRange: AnalyticsRange) => {
    setLocalRange(nextRange);
    onDateRangeChange?.(nextRange);
    setIsDateRangeOpen(false);
  };

  // Normalized Sales Overview Geometry
  const salesSeries = useMemo(() => (Array.isArray(salesOverview) ? salesOverview : []), [salesOverview]);

  const salesChart = useMemo(() => {
    const plotLeft = 46;
    const plotRight = 486;
    const plotTop = 18;
    const plotBottom = 176;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    const maxRevenue = Math.max(0, ...salesSeries.map((d) => Number(d.revenue || 0)));
    const maxOrders = Math.max(0, ...salesSeries.map((d) => Number(d.orders || 0)));
    const hasActivity = maxRevenue > 0 || maxOrders > 0;

    const yAxisMaxRev = maxRevenue > 0 ? Math.ceil(maxRevenue * 1.15) : 1000;
    const yAxisMaxOrd = maxOrders > 0 ? Math.ceil(maxOrders * 1.15) : 10;

    const coords = salesSeries.map((d, i) => {
      const x =
        salesSeries.length <= 1
          ? (plotLeft + plotRight) / 2
          : plotLeft + (i / (salesSeries.length - 1)) * plotWidth;
      const revY = plotBottom - (Math.max(0, Number(d.revenue || 0)) / yAxisMaxRev) * plotHeight;
      const ordY = plotBottom - (Math.max(0, Number(d.orders || 0)) / yAxisMaxOrd) * plotHeight;
      return {
        idx: i,
        date: d.date,
        orders: Number(d.orders || 0),
        revenue: Number(d.revenue || 0),
        x,
        revY,
        ordY,
      };
    });

    const revPaths = buildLineAndAreaPaths(
      coords.map((c) => ({ x: c.x, y: c.revY })),
      plotBottom
    );
    const ordPaths = buildLineAndAreaPaths(
      coords.map((c) => ({ x: c.x, y: c.ordY })),
      plotBottom
    );

    const yTicks = [1, 0.75, 0.5, 0.25, 0].map((fraction) => ({
      y: plotBottom - fraction * plotHeight,
      label: fraction === 0 ? '0' : maxRevenue > 0 ? formatCompactNumber(yAxisMaxRev * fraction) : '0',
    }));

    // Select up to 6 evenly spaced X-axis labels
    const xLabels: { x: number; label: string }[] = [];
    if (coords.length > 0) {
      const targetCount = Math.min(6, coords.length);
      const seenIdx = new Set<number>();
      for (let i = 0; i < targetCount; i++) {
        const idx = targetCount === 1 ? 0 : Math.round((i / (targetCount - 1)) * (coords.length - 1));
        if (!seenIdx.has(idx)) {
          seenIdx.add(idx);
          xLabels.push({ x: coords[idx].x, label: coords[idx].date });
        }
      }
    }

    return {
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      hasActivity,
      coords,
      revPaths,
      ordPaths,
      yTicks,
      xLabels,
    };
  }, [salesSeries]);

  // Sparkline series derived dynamically from salesOverview
  const ordersSparklinePath = useMemo(
    () => buildSparklinePath(salesSeries.map((s) => Number(s.orders || 0))),
    [salesSeries]
  );
  const revenueSparklinePath = useMemo(
    () => buildSparklinePath(salesSeries.map((s) => Number(s.revenue || 0))),
    [salesSeries]
  );

  // Top Products Max
  const safeTopProducts = useMemo(() => (Array.isArray(topProducts) ? topProducts.slice(0, 5) : []), [topProducts]);
  const topProductMaxSold = useMemo(
    () => Math.max(1, ...safeTopProducts.map((p) => Number(p.sold || 0))),
    [safeTopProducts]
  );

  // Order Status Donut Dynamic Geometry
  const orderDonut = useMemo(() => {
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const counts = orderStatusOverview?.counts || {};
    const total = Number(orderStatusOverview?.totalOrders ?? 0);

    const rawGroups = [
      {
        key: 'pending',
        label: 'Pending',
        count: Number(counts.pending || 0),
        color: '#2563eb',
        dotClass: 'bg-blue-600',
      },
      {
        key: 'processing',
        label: 'Processing',
        count: Number(counts.confirmed || 0) + Number(counts.processing || 0) + Number(counts.packed || 0),
        color: '#f59e0b',
        dotClass: 'bg-amber-500',
      },
      {
        key: 'shipped',
        label: 'Shipped',
        count: Number(counts.shipped || 0),
        color: '#10b981',
        dotClass: 'bg-emerald-500',
      },
      {
        key: 'delivered',
        label: 'Delivered',
        count: Number(counts.delivered || 0),
        color: '#8b5cf6',
        dotClass: 'bg-purple-500',
      },
    ];

    const cancelledOrReturned = Number(counts.cancelled || 0) + Number(counts.returned || 0);
    if (cancelledOrReturned > 0) {
      rawGroups.push({
        key: 'cancelled',
        label: 'Cancelled / Ret.',
        count: cancelledOrReturned,
        color: '#f43f5e',
        dotClass: 'bg-rose-500',
      });
    }

    let accumulatedOffset = 0;
    const segments = rawGroups.map((grp) => {
      const pct = total > 0 ? Math.round((grp.count / total) * 100) : 0;
      const segLen = total > 0 ? (grp.count / total) * circumference : 0;
      const offset = -accumulatedOffset;
      accumulatedOffset += segLen;
      return {
        ...grp,
        pct,
        segLen,
        offset,
      };
    });

    return {
      radius,
      circumference,
      total,
      segments,
    };
  }, [orderStatusOverview]);

  // Revenue Growth Monthly Chart
  const growthChart = useMemo(() => {
    const months = Array.isArray(revenueGrowth) ? revenueGrowth : [];
    const maxRev = Math.max(0, ...months.map((m) => Number(m.revenue || 0)));
    const scaleMax = maxRev > 0 ? Math.ceil(maxRev * 1.15) : 1000;
    const peakMonth =
      maxRev > 0
        ? months.find((m) => m.isPeak) || months.reduce((best, cur) => (cur.revenue > best.revenue ? cur : best), months[0])
        : null;

    const milestones =
      maxRev > 0
        ? ['0', formatCompactNumber(scaleMax / 3), formatCompactNumber((2 * scaleMax) / 3), formatCompactNumber(scaleMax)]
        : ['0', '৳0', '৳0', '৳0'];

    return {
      months,
      maxRev,
      scaleMax,
      peakMonth,
      milestones,
    };
  }, [revenueGrowth]);

  // KPI Values
  const totalVisitors = Number(stats?.totalVisitors ?? 0);
  const totalOrders = Number(stats?.totalOrders ?? 0);
  const totalRevenue = Number(stats?.totalRevenue ?? 0);
  const totalReviews = Number(stats?.totalReviews ?? 0);
  const totalCustomers = Number(stats?.totalCustomers ?? 0);
  const activeUsers = Number(stats?.activeUsers ?? 0);

  const googleUsers = Number(userAnalytics?.googleUsers ?? 0);
  const facebookUsers = Number(userAnalytics?.facebookUsers ?? 0);
  const emailUsers = Number(
    userAnalytics?.emailUsers ?? Math.max(0, totalCustomers - googleUsers - facebookUsers)
  );

  const hoveredSalesPoint = hoveredSalesIdx !== null ? salesChart.coords[hoveredSalesIdx] : null;
  const activeCalloutMonth = hoveredMonth || growthChart.peakMonth;

  return (
    <div className={`space-y-6 transition-opacity ${isLoading ? 'opacity-80' : 'opacity-100'}`}>
      {/* 1. Header Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {activeRangeMeta.subtitle}. Live database metrics synced across orders, reviews, and shoppers.
          </p>
        </div>

        {/* Date-Range Dropdown Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDateRangeOpen(!isDateRangeOpen)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{activeRangeMeta.label}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>

          {isDateRangeOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
              {RANGE_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => handleSelectRange(option.value)}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition-colors font-medium cursor-pointer ${
                    activeRange === option.value ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Four Key Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Visitors / Engaged Shoppers */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100/90 shadow-xs flex items-center justify-between gap-3 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Engaged Visitors</span>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {totalVisitors.toLocaleString()}
              </p>
            </div>
            {renderTrendBadge(stats?.totalVisitorsTrend)}
          </div>

          {/* Dynamic Blue Sparkline SVG */}
          <div className="w-24 h-14 shrink-0 opacity-80">
            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
              <path
                d={ordersSparklinePath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Total Orders */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100/90 shadow-xs flex items-center justify-between gap-3 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="w-11 h-11 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Total Orders</span>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {totalOrders.toLocaleString()}
              </p>
            </div>
            {renderTrendBadge(stats?.totalOrdersTrend)}
          </div>

          {/* Dynamic Indigo Sparkline SVG */}
          <div className="w-24 h-14 shrink-0 opacity-80">
            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
              <path
                d={ordersSparklinePath}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Total Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100/90 shadow-xs flex items-center justify-between gap-3 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Total Revenue</span>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                ৳ {totalRevenue.toLocaleString()}
              </p>
            </div>
            {renderTrendBadge(stats?.totalRevenueTrend)}
          </div>

          {/* Dynamic Green Sparkline SVG */}
          <div className="w-24 h-14 shrink-0 opacity-80">
            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
              <path
                d={revenueSparklinePath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Total Reviews */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100/90 shadow-xs flex items-center justify-between gap-3 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Customer Reviews</span>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {totalReviews.toLocaleString()}
              </p>
            </div>
            {renderTrendBadge(stats?.totalReviewsTrend)}
          </div>

          {/* Dynamic Amber Sparkline SVG */}
          <div className="w-24 h-14 shrink-0 opacity-80">
            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
              <path
                d={revenueSparklinePath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Row 2: Sales Overview (5 cols) + Top Products (4 cols) + Quick Actions (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card A: Sales Overview Area Chart (~5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-100/90 shadow-xs flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sales Overview</h3>
                <p className="text-[11px] text-slate-400">{activeRangeMeta.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 font-bold text-slate-700">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                Orders
              </span>
              <span className="flex items-center gap-1 font-bold text-slate-700">
                <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                Revenue (৳)
              </span>
            </div>
          </div>

          {/* Dynamic SVG Area Line Chart */}
          <div className="pt-2 relative">
            {hoveredSalesPoint && (
              <div className="absolute top-0 right-2 z-10 bg-slate-900 text-white px-2.5 py-1.5 rounded-xl text-[10px] font-bold shadow-lg flex items-center gap-3 pointer-events-none">
                <span className="text-slate-300">{hoveredSalesPoint.date}</span>
                <span>{hoveredSalesPoint.orders} orders</span>
                <span className="text-sky-300">৳{hoveredSalesPoint.revenue.toLocaleString()}</span>
              </div>
            )}

            <div className="relative h-56 w-full">
              <svg viewBox="0 0 500 200" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.38" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines + Dynamic Y-axis labels */}
                {salesChart.yTicks.map((tick, idx) => (
                  <g key={idx}>
                    <line
                      x1={salesChart.plotLeft}
                      y1={tick.y}
                      x2={salesChart.plotRight}
                      y2={tick.y}
                      stroke={idx === salesChart.yTicks.length - 1 ? '#e2e8f0' : '#f1f5f9'}
                      strokeWidth="1"
                      strokeDasharray={idx === salesChart.yTicks.length - 1 ? undefined : '4 4'}
                    />
                    <text x="38" y={tick.y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                      {tick.label}
                    </text>
                  </g>
                ))}

                {/* Dynamic Revenue & Orders Area Curves */}
                {salesChart.hasActivity && salesChart.revPaths.linePath && (
                  <>
                    <path d={salesChart.revPaths.areaPath} fill="url(#revenueGrad)" />
                    <path
                      d={salesChart.revPaths.linePath}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                )}

                {salesChart.hasActivity && salesChart.ordPaths.linePath && (
                  <>
                    <path d={salesChart.ordPaths.areaPath} fill="url(#ordersGrad)" />
                    <path
                      d={salesChart.ordPaths.linePath}
                      fill="none"
                      stroke="#1d4ed8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                )}

                {/* Hovered guide line */}
                {hoveredSalesPoint && (
                  <line
                    x1={hoveredSalesPoint.x}
                    y1={salesChart.plotTop}
                    x2={hoveredSalesPoint.x}
                    y2={salesChart.plotBottom}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Invisible Hover Capture Slices */}
                {salesChart.coords.map((pt) => {
                  const colW =
                    salesChart.coords.length > 1
                      ? (salesChart.plotRight - salesChart.plotLeft) / salesChart.coords.length
                      : salesChart.plotRight - salesChart.plotLeft;
                  return (
                    <rect
                      key={pt.idx}
                      x={pt.x - colW / 2}
                      y={salesChart.plotTop}
                      width={Math.max(8, colW)}
                      height={salesChart.plotBottom - salesChart.plotTop}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredSalesIdx(pt.idx)}
                      onMouseLeave={() => setHoveredSalesIdx(null)}
                    />
                  );
                })}

                {/* Dynamic X-axis date labels */}
                {salesChart.xLabels.map((lbl, idx) => (
                  <text key={idx} x={lbl.x} y="195" textAnchor="middle" fontSize="10" fill="#94a3b8">
                    {lbl.label}
                  </text>
                ))}
              </svg>

              {!salesChart.hasActivity && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xs font-semibold text-slate-400 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-100">
                    No sales activity recorded in this period.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card B: Top Products (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Top Products</h3>
                <p className="text-[11px] text-slate-400">Best Selling Products ({activeRangeMeta.label})</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectModule('products')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {safeTopProducts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
              <Package className="w-7 h-7 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-500">No product sales recorded in this period.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 py-1 space-y-2.5">
              {safeTopProducts.map((prod, idx) => {
                const sold = Number(prod.sold ?? 0);
                const ratio = Math.min(100, Math.round((sold / topProductMaxSold) * 100));
                return (
                  <div key={`${prod.name}-${idx}`} className="pt-2 flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    {prod.image ? (
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-9 h-9 rounded-lg object-cover bg-slate-50 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{prod.name}</p>
                      <p className="text-[11px] font-semibold text-slate-500">৳ {Number(prod.price ?? 0).toLocaleString()}</p>
                    </div>

                    <div className="w-24 text-right shrink-0">
                      <span className="text-xs font-bold text-slate-700 block mb-1">{sold} sold</span>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card C: Quick Actions (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-slate-100/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
              <p className="text-[11px] text-slate-400">Frequently used operations</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 py-2">
            <button
              type="button"
              onClick={onOpenAddProduct}
              className="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-100 hover:border-blue-200 text-center flex flex-col items-center justify-center transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100/60 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-600">Add Product</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddCategory}
              className="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-100 hover:border-blue-200 text-center flex flex-col items-center justify-center transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100/60 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-600">Create Category</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddBanner}
              className="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-100 hover:border-blue-200 text-center flex flex-col items-center justify-center transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100/60 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-600">Create Banner</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddCoupon}
              className="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-100 hover:border-blue-200 text-center flex flex-col items-center justify-center transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100/60 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <Tag className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-600">Add Coupon</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectModule('orders')}
              className="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-100 hover:border-blue-200 text-center flex flex-col items-center justify-center transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100/60 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-600">Manage Orders</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectModule('reviews')}
              className="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-100 hover:border-blue-200 text-center flex flex-col items-center justify-center transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100/60 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <Star className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-600">View Reviews</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Row 3: Order Status (4 cols) + Revenue Growth (5 cols) + Active Users (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card D: Order Status Donut Chart (~4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-100/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Order Status</h3>
                <p className="text-[11px] text-slate-400">Distribution in selected range</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              {activeRangeMeta.label}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {orderDonut.total === 0 ? (
                  <circle
                    cx="50"
                    cy="50"
                    r={orderDonut.radius}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="11"
                  />
                ) : (
                  orderDonut.segments
                    .filter((seg) => seg.segLen > 0)
                    .map((seg) => (
                      <circle
                        key={seg.key}
                        cx="50"
                        cy="50"
                        r={orderDonut.radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="11"
                        strokeDasharray={`${seg.segLen.toFixed(2)} ${(orderDonut.circumference - seg.segLen).toFixed(2)}`}
                        strokeDashoffset={seg.offset.toFixed(2)}
                      />
                    ))
                )}
              </svg>

              {/* Center count */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-slate-900 leading-none">
                  {orderDonut.total.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Total Orders</span>
              </div>
            </div>

            {/* Dynamic Legend */}
            <div className="space-y-2 text-xs min-w-[130px]">
              {orderDonut.segments.map((seg) => (
                <div key={seg.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${seg.dotClass}`} />
                    {seg.label}
                  </span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {seg.count} ({seg.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card E: Revenue Growth Monthly Bar Chart (~5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-100/90 shadow-xs flex flex-col justify-between relative">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Revenue Growth</h3>
                <p className="text-[11px] text-slate-400">Trailing 12-Month Revenue</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
              12 Months
            </span>
          </div>

          <div className="pt-6 relative">
            {activeCalloutMonth && activeCalloutMonth.revenue > 0 && (
              <div className="absolute top-1 right-2 z-10 bg-[#001736] text-white px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-md flex items-center gap-1.5">
                <span>
                  {activeCalloutMonth.month}: ৳ {Number(activeCalloutMonth.revenue).toLocaleString()}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
              </div>
            )}

            <div className="h-44 flex items-end justify-between gap-1.5 sm:gap-2 pt-6 pb-2 border-b border-slate-100">
              {growthChart.months.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                  No monthly revenue data available yet.
                </div>
              ) : (
                growthChart.months.map((m, idx) => {
                  const rev = Number(m.revenue || 0);
                  const heightPercent =
                    rev > 0 ? Math.max(5, Math.min(100, Math.round((rev / growthChart.scaleMax) * 100))) : 0;
                  const isPeak = Boolean(m.isPeak && rev > 0);
                  return (
                    <div
                      key={`${m.month}-${idx}`}
                      onMouseEnter={() => setHoveredMonth(m)}
                      onMouseLeave={() => setHoveredMonth(null)}
                      className="flex-1 flex flex-col items-center gap-1 h-full justify-end group cursor-pointer"
                    >
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className={`w-full rounded-t-md transition-all ${
                            rev <= 0
                              ? 'bg-slate-200 h-[2px]'
                              : isPeak
                              ? 'bg-gradient-to-t from-blue-700 to-blue-500 shadow-sm shadow-blue-500/30'
                              : 'bg-blue-500 group-hover:bg-blue-600'
                          }`}
                          style={rev > 0 ? { height: `${heightPercent}%` } : undefined}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 group-hover:text-slate-800 font-medium">
                        {m.month}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dynamic Y-axis milestones */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
              {growthChart.milestones.map((mLabel, i) => (
                <span key={i}>{mLabel}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Card F: Active Users & Auth Provider Distribution (~3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-slate-100/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Shopper Identity & Auth</h3>
                <p className="text-[11px] text-slate-400">OAuth & Registered Accounts</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectModule('customers')}
              className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition cursor-pointer"
            >
              Manage
            </button>
          </div>

          <div className="py-2.5 space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {totalCustomers.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 font-semibold ml-1.5">Shoppers</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{activeUsers.toLocaleString()} Active</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Google OAuth
                </span>
                <span className="tabular-nums font-mono">{googleUsers}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5 text-blue-700">
                  <span className="w-2 h-2 rounded-full bg-blue-600" /> Facebook OAuth
                </span>
                <span className="tabular-nums font-mono">{facebookUsers}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-slate-600" /> Email Accounts
                </span>
                <span className="tabular-nums font-mono">{emailUsers}</span>
              </div>
            </div>
          </div>

          <div className="relative h-20 w-full bg-blue-50/40 rounded-2xl overflow-hidden p-2 flex items-center justify-center border border-blue-100/50 mt-1">
            <svg viewBox="0 0 300 150" className="w-full h-full opacity-60 text-blue-300 fill-current">
              <path d="M40,50 Q60,30 90,40 T140,50 T170,80 T210,60 T250,70 T280,50 L270,110 Q240,120 200,115 T150,130 T90,120 T40,110 Z" />
            </svg>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-blue-600 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 relative ring-2 ring-white" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Row 4: Recent Activities (~9 cols) + Upgrade Your Store (~3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-9 bg-white rounded-3xl p-6 border border-slate-100/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Activities</h3>
                <p className="text-[11px] text-slate-400">Latest activities from your store</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectModule('audit-logs')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {!recentActivities || recentActivities.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 font-medium">
              No recent store activities recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-3">
              {recentActivities.slice(0, 5).map((act, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-center gap-3 hover:border-blue-200 transition-colors"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      act.type === 'order'
                        ? 'bg-blue-100 text-blue-600'
                        : act.type === 'user'
                        ? 'bg-cyan-100 text-cyan-600'
                        : act.type === 'review'
                        ? 'bg-amber-100 text-amber-500'
                        : act.type === 'coupon'
                        ? 'bg-sky-100 text-sky-600'
                        : 'bg-indigo-100 text-indigo-600'
                    }`}
                  >
                    {act.type === 'order' && <ShoppingCart className="w-4 h-4" />}
                    {act.type === 'user' && <User className="w-4 h-4" />}
                    {act.type === 'review' && <Star className="w-4 h-4" />}
                    {act.type === 'coupon' && <Tag className="w-4 h-4" />}
                    {act.type === 'product' && <Package className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate leading-tight">{act.title}</p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card H: Store Configuration Callout */}
        <div className="lg:col-span-3 rounded-3xl p-6 bg-gradient-to-br from-blue-700 via-blue-600 to-sky-600 text-white shadow-xl shadow-blue-500/15 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-1.5 z-10">
            <h3 className="text-base font-black tracking-tight leading-tight">Store Configuration</h3>
            <p className="text-xs text-blue-100/90 leading-relaxed">
              Manage shipping fees, payment gateways, tax rates, and notifications.
            </p>
          </div>

          <div className="pt-4 z-10 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onSelectModule('general-settings')}
              className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 font-black text-xs rounded-xl shadow-md transition-all hover:translate-x-0.5 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Open Settings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-inner">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
