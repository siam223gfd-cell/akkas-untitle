import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addToast, openAdminLoginModal } from '../features/ui/uiSlice';
import { apiRequest } from '../services/api';
import { AdminModal, ConfirmDialog } from '../components/admin/common/modal';
import { OrderDetailsDrawer } from '../components/admin/drawers/OrderDetailsDrawer';
import { ProductDetailsDrawer } from '../components/admin/drawers/ProductDetailsDrawer';
import { ReviewDetailsDrawer } from '../components/admin/drawers/ReviewDetailsDrawer';
import { ImageUploadInput } from '../components/common/ImageUploadInput';
import { Product, Order, Review, Category, CMSConfig, Brand, User, OrderStatsResponse } from '../types';

import { AdminSidebar, AdminModule, canAccessModule } from '../components/admin/AdminSidebar';
import { AdminHeader } from '../components/admin/AdminHeader';
import { DashboardOverview, AnalyticsRange } from '../components/admin/DashboardOverview';
import { HeroSliderManager } from '../components/admin/HeroSliderManager';
import { BannersManager } from '../components/admin/BannersManager';
import { BrandsManager } from '../components/admin/BrandsManager';
import { SettingsManager } from '../components/admin/SettingsManager';
import { CustomersManager } from '../components/admin/CustomersManager';
import { AuditLogsManager } from '../components/admin/AuditLogsManager';
import { BackupManager } from '../components/admin/BackupManager';
import { StaffManager } from '../components/admin/StaffManager';
import { PagesManager } from '../components/admin/PagesManager';
import { BlogPostsManager } from '../components/admin/BlogPostsManager';
import { AttributesManager } from '../components/admin/AttributesManager';
import { AdvertisementsManager } from '../components/admin/ads/AdvertisementsManager';
import { AtlasDiagnosticsManager } from '../components/admin/AtlasDiagnosticsManager';
import { NavigationManager } from '../components/admin/NavigationManager';
import { TransactionsManager } from '../components/admin/TransactionsManager';

import {
  Package,
  ShoppingBag,
  Layers,
  MessageSquare,
  Tag,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Database,
  RefreshCw,
  Search,
  Check,
  Eye,
  Filter,
  Shield,
  ArrowRight,
  Copy,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Sparkles,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';

const ORDER_STATUS_TRANSITIONS: Record<Order['orderStatus'], Order['orderStatus'][]> = {
  pending: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'packed', 'shipped', 'cancelled'],
  processing: ['packed', 'shipped', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

const ORDER_STATUS_LABELS: Record<Order['orderStatus'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled (Restores stock)',
  returned: 'Returned',
};

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isSessionChecking } = useAppSelector((state) => state.auth);

  const [activeModule, setActiveModule] = useState<AdminModule>('dashboard');
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const prevAnalyticsRangeRef = useRef<AnalyticsRange>('30d');

  // Operational Data States
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('30d');
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStatsResponse | null>(null);
  const [orderPage, setOrderPage] = useState(1);
  const [orderPagination, setOrderPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [customers, setCustomers] = useState<User[]>([]);
  const [cmsConfig, setCmsConfig] = useState<CMSConfig | null>(null);
  const [dbHealth, setDbHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filters for product & order listings
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderPaymentStatusFilter, setOrderPaymentStatusFilter] = useState('all');
  const [orderPaymentMethodFilter, setOrderPaymentMethodFilter] = useState('all');
  const [orderStartDate, setOrderStartDate] = useState('');
  const [orderEndDate, setOrderEndDate] = useState('');
  const [orderSort, setOrderSort] = useState<'newest' | 'oldest' | 'amount_desc' | 'amount_asc'>('newest');

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productModalTab, setProductModalTab] = useState<'basic' | 'variants' | 'highlights' | 'specs' | 'faqs'>('basic');
const defaultProductForm = {
  name: '',
  subtitle: '',
  slug: '',
  sku: '',
  brand: '',
  category: 'Electronics',
  subcategory: '',
  basePrice: 0,
  salePrice: 0,
  stock: 0,
  description: '',
  badge: '',
  status: 'active' as 'active' | 'draft' | 'archived',
  image: '',
  images: [] as string[],
  warranty: '1 Year Brand Warranty',
  deliveryEstimate: '2-3 Working Days',
  variants: [] as any[],
  highlights: [] as { label: string; value: string; icon?: string }[],
  specificationsTable: [] as { label: string; value: string; group?: string }[],
  faqs: [] as { question: string; answer: string }[],
};

  const [productForm, setProductForm] = useState(defaultProductForm);

  // Order Status Modal State
  const [isOrderStatusModalOpen, setIsOrderStatusModalOpen] = useState(false);
  const [selectedOrderForStatus, setSelectedOrderForStatus] = useState<Order | null>(null);
  const [newOrderStatus, setNewOrderStatus] = useState<Order['orderStatus']>('confirmed');
  const [newPaymentStatus, setNewPaymentStatus] = useState<Order['paymentStatus']>('pending');
  const [orderStatusNote, setOrderStatusNote] = useState<string>('');

  // Coupon Modal State
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 1000,
    maxDiscount: 1000,
    validUntil: '2028-12-31',
  });

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    image: '',
    description: '',
    order: 1,
  });

  // Inspection Drawers State
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);
  const [inspectingProduct, setInspectingProduct] = useState<Product | null>(null);
  const [inspectingReview, setInspectingReview] = useState<Review | null>(null);

  const handleInspectOrderById = async (orderId: string) => {
    const existing = orders.find((o) => o._id === orderId);
    if (existing) {
      setInspectingOrder(existing);
      return;
    }
    try {
      const res = await apiRequest<{ success: boolean; order: Order }>(`/orders/${orderId}`);
      if (res?.order) {
        setInspectingOrder(res.order);
      }
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err?.message || 'Failed to load order details' }));
    }
  };

  // Modernized ConfirmDialog State (replaces window.confirm)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    type: 'product' | 'coupon' | 'category' | 'review';
    isConfirming: boolean;
  }>({
    isOpen: false,
    id: '',
    name: '',
    type: 'product',
    isConfirming: false,
  });

  // Database Connection Console State
  const [customAtlasUri, setCustomAtlasUri] = useState('');
  const [isConnectingDb, setIsConnectingDb] = useState(false);
  const [isSeedingDb, setIsSeedingDb] = useState(false);

  const isStaff =
    isAuthenticated &&
    user &&
    ['super_admin', 'admin', 'order_manager', 'inventory_manager', 'catalog_manager', 'customer_support', 'finance'].includes(user.role);

  const canCreateOrDuplicateProduct = ['super_admin', 'admin', 'catalog_manager'].includes(user?.role || '');
  const canEditProduct = ['super_admin', 'admin', 'catalog_manager', 'inventory_manager'].includes(user?.role || '');
  const canDeleteProduct = ['super_admin', 'admin'].includes(user?.role || '');
  const canUpdateOrderStatus = ['super_admin', 'admin', 'order_manager'].includes(user?.role || '');
  const canDeleteCoupon = ['super_admin', 'admin'].includes(user?.role || '');

  const handleSelectModule = (nextModule: AdminModule) => {
    if (!canAccessModule(user?.role, nextModule)) {
      dispatch(
        addToast({
          type: 'warning',
          title: 'Access Restricted',
          message: 'Your staff role does not have permission for this module.',
        })
      );
      return;
    }
    setActiveModule(nextModule);
  };

  const fetchAnalytics = async (range: AnalyticsRange = analyticsRange) => {
    setIsAnalyticsLoading(true);
    try {
      const res = await apiRequest(`/admin/analytics?range=${range}`);
      if (res.success) {
        setAnalyticsData(res);
      }
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  const fetchOrdersAndStats = async (pageOverride?: number) => {
    const targetPage = pageOverride ?? orderPage;
    setIsOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', '20');
      params.set('sort', orderSort);
      if (orderStatusFilter !== 'all') params.set('status', orderStatusFilter);
      if (orderPaymentStatusFilter !== 'all') params.set('paymentStatus', orderPaymentStatusFilter);
      if (orderPaymentMethodFilter !== 'all') params.set('paymentMethod', orderPaymentMethodFilter);
      if (orderStartDate) params.set('startDate', orderStartDate);
      if (orderEndDate) params.set('endDate', orderEndDate);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const statsParams = new URLSearchParams();
      if (orderPaymentStatusFilter !== 'all') statsParams.set('paymentStatus', orderPaymentStatusFilter);
      if (orderPaymentMethodFilter !== 'all') statsParams.set('paymentMethod', orderPaymentMethodFilter);
      if (orderStartDate) statsParams.set('startDate', orderStartDate);
      if (orderEndDate) statsParams.set('endDate', orderEndDate);
      if (searchQuery.trim()) statsParams.set('search', searchQuery.trim());

      const [ordersRes, statsRes] = await Promise.all([
        apiRequest(`/orders?${params.toString()}`),
        apiRequest(`/orders/stats?${statsParams.toString()}`),
      ]);

      if (ordersRes.success) {
        setOrders(ordersRes.orders || []);
        setOrderPagination(
          ordersRes.pagination || {
            page: targetPage,
            limit: 20,
            total: (ordersRes.orders || []).length,
            totalPages: 1,
          }
        );
      }
      if (statsRes.success && statsRes.stats) {
        setOrderStats(statsRes.stats);
      }
    } finally {
      setIsOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (isSessionChecking) return;
    if (!isStaff) {
      dispatch(openAdminLoginModal());
      return;
    }
    if (!canAccessModule(user?.role, activeModule)) {
      setActiveModule('dashboard');
      return;
    }
    refreshAllData();
  }, [isSessionChecking, isAuthenticated, user?.role, activeModule]);

  useEffect(() => {
    if (prevAnalyticsRangeRef.current === analyticsRange) return;
    prevAnalyticsRangeRef.current = analyticsRange;
    if (!isStaff) return;
    fetchAnalytics(analyticsRange);
  }, [analyticsRange, isStaff]);

  useEffect(() => {
    if (!isStaff || !canAccessModule(user?.role, 'orders') || activeModule !== 'orders') return;
    const timer = setTimeout(() => {
      fetchOrdersAndStats(orderPage);
    }, 150);
    return () => clearTimeout(timer);
  }, [
    isStaff,
    user?.role,
    activeModule,
    orderPage,
    orderStatusFilter,
    orderPaymentStatusFilter,
    orderPaymentMethodFilter,
    orderStartDate,
    orderEndDate,
    orderSort,
    searchQuery,
  ]);

  const refreshAllData = async () => {
    const role = user?.role;
    setIsLoading(true);

    const tasks: Promise<any>[] = [
      fetchAnalytics(analyticsRange),
      apiRequest('/products?status=all&limit=100').then((res) => {
        if (res.success) setProducts(res.products || []);
      }),
      apiRequest('/categories').then((res) => {
        if (res.success) setCategories(res.categories || []);
      }),
      apiRequest('/cms/config').then((res) => {
        if (res.success) setCmsConfig(res.config);
      }),
      apiRequest('/health').then((res) => {
        setDbHealth(res);
      }),
    ];

    if (canAccessModule(role, 'orders')) {
      tasks.push(fetchOrdersAndStats(orderPage));
    }
    if (canAccessModule(role, 'reviews')) {
      tasks.push(
        apiRequest('/reviews/admin').then((res) => {
          if (res.success) setReviews(res.reviews || []);
        })
      );
    }
    if (canAccessModule(role, 'coupons')) {
      tasks.push(
        apiRequest('/coupons').then((res) => {
          if (res.success) setCoupons(res.coupons || []);
        })
      );
    }
    if (canAccessModule(role, 'brands')) {
      tasks.push(
        apiRequest('/admin/brands').then((res) => {
          if (res.success) setBrands(res.brands || []);
        })
      );
    }
    if (['super_admin', 'admin', 'customer_support', 'order_manager', 'finance'].includes(role || '')) {
      tasks.push(
        apiRequest('/admin/customers').then((res) => {
          if (res.success) setCustomers(res.customers || []);
        })
      );
    }

    await Promise.allSettled(tasks);
    setIsLoading(false);
  };

  if (isSessionChecking) {
    return (
      <div className="min-h-screen bg-[#06152d] text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center mb-4 animate-pulse">
          <Shield className="w-7 h-7 text-blue-400" />
        </div>
        <p className="text-xs font-bold tracking-widest uppercase text-blue-300">
          Verifying Administrative Session...
        </p>
      </div>
    );
  }

  // Handle Product Save (Create or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const primaryImg = productForm.image.trim();
    const mergedImages = [
      ...(primaryImg ? [primaryImg] : []),
      ...(productForm.images || []).filter((img) => img && img !== primaryImg),
    ];

    if (mergedImages.length === 0) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Product Photo Required',
          message: 'Upload an image or paste a valid product photo URL before saving.',
        })
      );
      return;
    }

    const payload = {
      ...productForm,
      slug: (productForm.slug || productForm.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
      images: mergedImages,
    };

    let res;
    if (editingProduct) {
      res = await apiRequest(`/products/${editingProduct._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      res = await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    if (res.success) {
      setIsProductModalOpen(false);
      setEditingProduct(null);
      refreshAllData();
      dispatch(
        addToast({
          type: 'success',
          title: editingProduct ? 'Product Updated' : 'Product Created',
          message: `${productForm.name} saved to catalog.`,
        })
      );
    } else {
      dispatch(addToast({ type: 'error', title: 'Save Failed', message: res.message || 'Could not save product.' }));
    }
  };

  // Toggle publish/draft status
  const handleToggleProductStatus = async (p: Product) => {
    const newStatus = p.status === 'active' ? 'draft' : 'active';
    const res = await apiRequest(`/products/${p._id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.success) {
      refreshAllData();
      dispatch(
        addToast({
          type: 'success',
          title: `Product ${newStatus === 'active' ? 'Published' : 'Unpublished'}`,
          message: `${p.name} is now ${newStatus}.`,
        })
      );
    } else {
      dispatch(addToast({ type: 'error', title: 'Failed', message: res.message || 'Failed to update status.' }));
    }
  };

  // Duplicate an existing product
  const handleDuplicateProduct = (p: Product) => {
    setEditingProduct(null);
    const rand = Math.floor(100 + Math.random() * 900);
    setProductForm({
      name: `${p.name} (Copy)`,
      subtitle: p.subtitle || '',
      slug: `${p.slug}-copy-${rand}`,
      sku: `${p.sku}-CPY${rand}`,
      brand: p.brand,
      category: p.category,
      subcategory: p.subcategory || '',
      basePrice: p.basePrice,
      salePrice: p.salePrice,
      stock: p.stock,
      description: p.description,
      badge: p.badge || '',
      status: 'draft',
      image: p.images?.[0] || '',
      images: p.images || [],
      warranty: p.warranty || '',
      deliveryEstimate: p.deliveryEstimate || '',
      variants: p.variants?.map((v, i) => ({
        ...v,
        id: `var-dup-${Date.now()}-${i}`,
        sku: `${v.sku}-CPY`,
      })) || [],
      highlights: p.highlights || [],
      specificationsTable: p.specificationsTable || [],
      faqs: p.faqs || [],
    });
    setProductModalTab('basic');
    setIsProductModalOpen(true);
    dispatch(addToast({ type: 'info', title: 'Product Duplicated', message: 'Review details and click Save.' }));
  };

  // Handle Product Delete (Opens ConfirmDialog)
  const handleDeleteProduct = (id: string, name: string) => {
    setDeleteConfirm({
      isOpen: true,
      id,
      name,
      type: 'product',
      isConfirming: false,
    });
  };

  // Centralized Async Delete Executor for AdminDashboard
  const handleExecuteDelete = async () => {
    setDeleteConfirm((prev) => ({ ...prev, isConfirming: true }));
    try {
      let endpoint = '';
      if (deleteConfirm.type === 'product') endpoint = `/products/${deleteConfirm.id}`;
      else if (deleteConfirm.type === 'coupon') endpoint = `/coupons/${deleteConfirm.id}`;
      else if (deleteConfirm.type === 'category') endpoint = `/categories/${deleteConfirm.id}`;
      else if (deleteConfirm.type === 'review') endpoint = `/reviews/${deleteConfirm.id}`;

      const res = await apiRequest(endpoint, { method: 'DELETE' });
      if (res.success) {
        refreshAllData();
        dispatch(
          addToast({
            type: 'info',
            title: `${deleteConfirm.type.charAt(0).toUpperCase() + deleteConfirm.type.slice(1)} Removed`,
            message: `"${deleteConfirm.name}" was successfully removed.`,
          })
        );
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false, isConfirming: false }));
      } else {
        dispatch(
          addToast({
            type: 'error',
            title: 'Delete Failed',
            message: res.message || 'Operation could not be completed.',
          })
        );
        setDeleteConfirm((prev) => ({ ...prev, isConfirming: false }));
      }
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Error', message: err.message || 'Network error.' }));
      setDeleteConfirm((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  // Handle Order Status & Payment Status Lifecycle Transition
  const openOrderStatusModal = (order: Order) => {
    setSelectedOrderForStatus(order);
    setNewOrderStatus(order.orderStatus);
    setNewPaymentStatus(order.paymentStatus);
    setOrderStatusNote('');
    setIsOrderStatusModalOpen(true);
  };

  const handleUpdateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForStatus) return;

    const payload: Record<string, string> = {
      note: orderStatusNote,
    };
    if (newOrderStatus !== selectedOrderForStatus.orderStatus) {
      payload.status = newOrderStatus;
    }
    if (newPaymentStatus !== selectedOrderForStatus.paymentStatus) {
      payload.paymentStatus = newPaymentStatus;
    }

    // Always allow status note audit update if nothing else changed by sending current status
    if (!payload.status && !payload.paymentStatus) {
      payload.status = newOrderStatus;
    }

    const res = await apiRequest(`/orders/${selectedOrderForStatus._id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    if (res.success) {
      if (res.order && inspectingOrder?._id === res.order._id) {
        setInspectingOrder(res.order);
      }
      setIsOrderStatusModalOpen(false);
      setSelectedOrderForStatus(null);
      setOrderStatusNote('');
      refreshAllData();
      dispatch(
        addToast({
          type: 'success',
          title: 'Order Updated',
          message: `Order #${selectedOrderForStatus.orderNumber} synced (${newOrderStatus} / ${newPaymentStatus}).`,
        })
      );
    } else {
      dispatch(addToast({ type: 'error', title: 'Update Failed', message: res.message || 'Status transition rejected.' }));
    }
  };

  // Handle Review Moderation
  const handleModerateReview = async (id: string, status: 'approved' | 'rejected') => {
    const res = await apiRequest(`/reviews/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });

    if (res.success) {
      refreshAllData();
      dispatch(
        addToast({
          type: 'success',
          title: `Review ${status}`,
          message: `Review moderation status updated.`,
        })
      );
    }
  };

  // Handle Coupon Create / Edit
  const handleOpenCreateCoupon = () => {
    setEditingCoupon(null);
    setCouponForm({
      code: '',
      discountType: 'percentage',
      discountValue: 10,
      minOrderAmount: 1000,
      maxDiscount: 1000,
      validUntil: '2028-12-31',
    });
    setIsCouponModalOpen(true);
  };

  const handleOpenEditCoupon = (c: any) => {
    setEditingCoupon(c);
    setCouponForm({
      code: c.code || '',
      discountType: c.discountType || 'percentage',
      discountValue: c.discountValue || 10,
      minOrderAmount: c.minOrderAmount || 0,
      maxDiscount: c.maxDiscount || 1000,
      validUntil: c.validUntil ? new Date(c.validUntil).toISOString().split('T')[0] : '2028-12-31',
    });
    setIsCouponModalOpen(true);
  };

  const handleDeleteCoupon = (c: any) => {
    setDeleteConfirm({
      isOpen: true,
      id: c._id,
      name: c.code,
      type: 'coupon',
      isConfirming: false,
    });
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    let res;
    if (editingCoupon) {
      res = await apiRequest(`/coupons/${editingCoupon._id}`, {
        method: 'PUT',
        body: JSON.stringify(couponForm),
      });
    } else {
      res = await apiRequest('/coupons', {
        method: 'POST',
        body: JSON.stringify(couponForm),
      });
    }

    if (res.success) {
      setIsCouponModalOpen(false);
      setEditingCoupon(null);
      setCouponForm({ code: '', discountType: 'percentage', discountValue: 10, minOrderAmount: 1000, maxDiscount: 1000, validUntil: '2028-12-31' });
      refreshAllData();
      dispatch(addToast({ type: 'success', title: editingCoupon ? 'Coupon Updated' : 'Coupon Created', message: `Coupon ${couponForm.code} is active.` }));
    } else {
      dispatch(addToast({ type: 'error', title: 'Failed', message: res.message || 'Could not save coupon.' }));
    }
  };

  // Handle Category Create / Edit
  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      slug: '',
      image: '',
      description: '',
      order: categories.length + 1,
    });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name || '',
      slug: cat.slug || '',
      image: cat.image || '',
      description: (cat as any).description || '',
      order: (cat as any).order || 1,
    });
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = (cat: Category) => {
    setDeleteConfirm({
      isOpen: true,
      id: cat._id || cat.slug,
      name: cat.name,
      type: 'category',
      isConfirming: false,
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    let res;
    if (editingCategory) {
      res = await apiRequest(`/categories/${editingCategory._id}`, {
        method: 'PUT',
        body: JSON.stringify(categoryForm),
      });
    } else {
      res = await apiRequest('/categories', {
        method: 'POST',
        body: JSON.stringify(categoryForm),
      });
    }

    if (res.success) {
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', slug: '', image: '', description: '', order: categories.length + 1 });
      refreshAllData();
      dispatch(addToast({ type: 'success', title: editingCategory ? 'Category Updated' : 'Category Created', message: `${categoryForm.name} saved to catalog.` }));
    } else {
      dispatch(addToast({ type: 'error', title: 'Failed', message: res.message || 'Could not save category.' }));
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = productCategoryFilter === 'all' || p.category.toLowerCase() === productCategoryFilter.toLowerCase();
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-[#06152d] text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/30">
          <Shield className="w-8 h-8 text-blue-400" />
        </div>
        <span className="text-xs font-black tracking-widest uppercase text-blue-400 mb-2">Restricted Access</span>
        <h1 className="text-3xl font-black text-white tracking-tight mb-3">Aurelia Administrative Gateway</h1>
        <p className="text-sm text-slate-300 max-w-md mb-8 leading-relaxed">
          This portal requires verified administrative staff credentials. Customer accounts are prohibited from accessing store configuration.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => dispatch(openAdminLoginModal())}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-102 flex items-center gap-2 cursor-pointer"
          >
            <span>Log In to Admin Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fc] text-slate-800 flex antialiased">
      {/* 1. Dedicated Dark Midnight Sidebar matching Reference Image */}
      <AdminSidebar
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        isOpenMobile={isSidebarMobileOpen}
        onCloseMobile={() => setIsSidebarMobileOpen(false)}
        userRole={user?.role}
        isDbConnected={typeof dbHealth?.database?.isConnected === 'boolean' ? dbHealth.database.isConnected : undefined}
        counts={{
          products: products.length,
          orders: orderStats?.totalOrders ?? orderPagination.total ?? orders.length,
          customers: customers.length,
          reviews: reviews.length,
          coupons: coupons.length,
        }}
      />

      {/* 2. Main Administration Canvas */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen">
        {/* Top Header matching Reference Image */}
        <AdminHeader
          onOpenMobileSidebar={() => setIsSidebarMobileOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setOrderPage(1);
          }}
          recentActivities={analyticsData?.recentActivities}
          lowStockProducts={products.filter((p) => Number(p.stock) <= 5).slice(0, 5)}
        />

        {/* Content Body */}
        <main className="p-4 sm:p-8 flex-1 space-y-6">
          {/* ==================== MODULE 1: DASHBOARD OVERVIEW ==================== */}
          {activeModule === 'dashboard' && (
            <DashboardOverview
              stats={analyticsData?.stats}
              salesOverview={analyticsData?.salesOverview}
              topProducts={analyticsData?.topProducts}
              orderStatusOverview={analyticsData?.orderStatusOverview}
              revenueGrowth={analyticsData?.revenueGrowth}
              recentActivities={analyticsData?.recentActivities}
              userAnalytics={analyticsData?.userAnalytics}
              dateRange={analyticsRange}
              onDateRangeChange={setAnalyticsRange}
              isLoading={isAnalyticsLoading || isLoading}
              onSelectModule={handleSelectModule}
              onOpenAddProduct={() => {
                if (!canCreateOrDuplicateProduct) {
                  dispatch(addToast({ type: 'warning', title: 'Restricted', message: 'Your role cannot create new products.' }));
                  return;
                }
                setEditingProduct(null);
                setProductModalTab('basic');
                setProductForm({
                  ...defaultProductForm,
                  category: categories[0]?.name || defaultProductForm.category,
                });
                setIsProductModalOpen(true);
              }}
              onOpenAddCoupon={() => {
                if (!canAccessModule(user?.role, 'coupons')) {
                  dispatch(addToast({ type: 'warning', title: 'Restricted', message: 'Your role cannot manage coupons.' }));
                  return;
                }
                handleOpenCreateCoupon();
              }}
              onOpenAddCategory={() => {
                if (!canAccessModule(user?.role, 'categories')) {
                  dispatch(addToast({ type: 'warning', title: 'Restricted', message: 'Your role cannot manage categories.' }));
                  return;
                }
                handleOpenCreateCategory();
              }}
              onOpenAddBanner={() => handleSelectModule('banners')}
            />
          )}

          {/* ==================== MODULE 2: PRODUCTS ==================== */}
          {activeModule === 'products' && canAccessModule(user?.role, 'products') && (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-black text-slate-900">Products Catalog Management</h2>
                  <p className="text-xs text-slate-500">Live products, pricing, stock levels, and store visibility.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c._id || c.slug} value={c.name}>{c.name}</option>
                    ))}
                  </select>

                  {canCreateOrDuplicateProduct && (
                    <button
                      onClick={() => {
                        setEditingProduct(null);
                        setProductModalTab('basic');
                        setProductForm({
                          ...defaultProductForm,
                          category: categories[0]?.name || defaultProductForm.category,
                        });
                        setIsProductModalOpen(true);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Product</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Sale Price</th>
                      <th className="p-3">Stock Units</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Rating</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((p) => (
                      <tr key={p._id} className="hover:bg-slate-50/50">
                        <td className="p-3 flex items-center gap-2.5">
                          {p.images?.[0] ? (
                            <img
                              src={p.images[0]}
                              alt={p.name}
                              className="w-9 h-9 object-cover rounded-lg bg-slate-50 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate max-w-xs">{p.name}</p>
                            <p className="font-mono text-slate-400 text-[10px]">{p.sku}</p>
                          </div>
                        </td>
                        <td className="p-3">{p.category}</td>
                        <td className="p-3 font-bold text-slate-900 tabular-nums">৳ {p.salePrice.toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`font-bold ${p.stock < 10 ? 'text-rose-600' : 'text-slate-700'}`}>
                            {p.stock} units
                          </span>
                          {p.variants && p.variants.length > 0 && (
                            <span className="block text-[10px] text-blue-600 font-medium">
                              {p.variants.length} variants
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            disabled={!canEditProduct}
                            onClick={() => handleToggleProductStatus(p)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                              p.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                            } disabled:opacity-60 disabled:cursor-not-allowed`}
                            title={canEditProduct ? 'Click to toggle active/draft' : 'Read-only status'}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {p.status === 'active' ? 'Published' : p.status === 'archived' ? 'Archived' : 'Draft'}
                          </button>
                        </td>
                        <td className="p-3">
                          {(p.reviewCount || 0) > 0 ? (
                            <span>★ {Number(p.rating || 0).toFixed(1)} ({p.reviewCount})</span>
                          ) : (
                            <span className="text-slate-400">No reviews</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={`/product/${p.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="View on storefront"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            {canCreateOrDuplicateProduct && (
                              <button
                                onClick={() => handleDuplicateProduct(p)}
                                className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                                title="Duplicate product"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setInspectingProduct(p)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Inspect product details drawer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {canEditProduct && (
                              <button
                                onClick={() => {
                                  setEditingProduct(p);
                                  setProductForm({
                                    name: p.name,
                                    subtitle: p.subtitle || '',
                                    slug: p.slug,
                                    sku: p.sku,
                                    brand: p.brand,
                                    category: p.category,
                                    subcategory: p.subcategory || '',
                                    basePrice: p.basePrice,
                                    salePrice: p.salePrice,
                                    stock: p.stock,
                                    description: p.description,
                                    badge: p.badge || '',
                                    status: p.status || 'active',
                                    image: p.images?.[0] || '',
                                    images: p.images || [],
                                    warranty: p.warranty || '',
                                    deliveryEstimate: p.deliveryEstimate || '',
                                    variants: p.variants || [],
                                    highlights: p.highlights || [],
                                    specificationsTable: p.specificationsTable || [],
                                    faqs: p.faqs || [],
                                  });
                                  setProductModalTab('basic');
                                  setIsProductModalOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Edit product"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDeleteProduct && (
                              <button
                                onClick={() => handleDeleteProduct(p._id, p.name)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== MODULE 3: ORDERS ==================== */}
          {activeModule === 'orders' && canAccessModule(user?.role, 'orders') && (
            <div className="space-y-5">
              {/* Server-Aggregated Order KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                    Matching Orders
                  </span>
                  <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                    {(orderStats?.totalOrders ?? orderPagination.total ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                    Gross Order Value
                  </span>
                  <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                    ৳ {(orderStats?.totalRevenue ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
                  <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide block">
                    Verified Paid Revenue
                  </span>
                  <p className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">
                    ৳ {(orderStats?.paidRevenue ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
                  <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide block">
                    Active Fulfillment Queue
                  </span>
                  <p className="text-2xl font-black text-amber-700 mt-1 tabular-nums">
                    {(
                      (orderStats?.orderStatuses?.pending ?? 0) +
                      (orderStats?.orderStatuses?.confirmed ?? 0) +
                      (orderStats?.orderStatuses?.processing ?? 0) +
                      (orderStats?.orderStatuses?.packed ?? 0)
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-5">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-black text-slate-900">Orders & Fulfillment State Machine</h2>
                    <p className="text-xs text-slate-500">
                      Server-paginated orders with payment status tracking, date filters, and transition validation.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Filter by fulfillment status"
                      value={orderStatusFilter}
                      onChange={(e) => {
                        setOrderStatusFilter(e.target.value);
                        setOrderPage(1);
                      }}
                      className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="packed">Packed</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="returned">Returned</option>
                    </select>

                    <select
                      aria-label="Filter by payment status"
                      value={orderPaymentStatusFilter}
                      onChange={(e) => {
                        setOrderPaymentStatusFilter(e.target.value);
                        setOrderPage(1);
                      }}
                      className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                    >
                      <option value="all">All Payments</option>
                      <option value="pending">Payment Pending</option>
                      <option value="paid">Paid</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>

                    <select
                      aria-label="Filter by payment method"
                      value={orderPaymentMethodFilter}
                      onChange={(e) => {
                        setOrderPaymentMethodFilter(e.target.value);
                        setOrderPage(1);
                      }}
                      className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                    >
                      <option value="all">All Methods</option>
                      <option value="cod">Cash on Delivery</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="card">Card</option>
                    </select>

                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="date"
                        aria-label="Start date"
                        value={orderStartDate}
                        onChange={(e) => {
                          setOrderStartDate(e.target.value);
                          setOrderPage(1);
                        }}
                        className="bg-transparent text-xs text-slate-700 focus:outline-none"
                      />
                      <span className="text-slate-400 text-[10px]">to</span>
                      <input
                        type="date"
                        aria-label="End date"
                        value={orderEndDate}
                        onChange={(e) => {
                          setOrderEndDate(e.target.value);
                          setOrderPage(1);
                        }}
                        className="bg-transparent text-xs text-slate-700 focus:outline-none"
                      />
                    </div>

                    <select
                      aria-label="Sort orders"
                      value={orderSort}
                      onChange={(e) => {
                        setOrderSort(e.target.value as any);
                        setOrderPage(1);
                      }}
                      className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="amount_desc">Amount: High to Low</option>
                      <option value="amount_asc">Amount: Low to High</option>
                    </select>

                    {(orderStatusFilter !== 'all' ||
                      orderPaymentStatusFilter !== 'all' ||
                      orderPaymentMethodFilter !== 'all' ||
                      orderStartDate ||
                      orderEndDate ||
                      searchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setOrderStatusFilter('all');
                          setOrderPaymentStatusFilter('all');
                          setOrderPaymentMethodFilter('all');
                          setOrderStartDate('');
                          setOrderEndDate('');
                          setSearchQuery('');
                          setOrderSort('newest');
                          setOrderPage(1);
                        }}
                        className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">Order #</th>
                        <th className="p-3">Customer & Phone</th>
                        <th className="p-3">Destination</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Payment</th>
                        <th className="p-3">Fulfillment Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-xs text-slate-500">
                            {isOrdersLoading ? 'Loading orders...' : 'No orders match the current filters.'}
                          </td>
                        </tr>
                      ) : (
                        orders.map((o) => (
                          <tr key={o._id} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <span className="font-mono font-bold text-slate-900 block">{o.orderNumber}</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(o.createdAt).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="p-3">
                              <p className="font-bold text-slate-800">{o.customerName}</p>
                              <p className="text-[10px] text-slate-400">{o.customerPhone}</p>
                            </td>
                            <td className="p-3">
                              <p className="font-semibold text-slate-800">
                                {o.shippingAddress?.upazila || 'N/A'}, {o.shippingAddress?.district || 'Bangladesh'}
                              </p>
                              {o.shippingAddress?.unionOrWard && (
                                <p className="text-[10px] text-slate-400 font-medium">
                                  {o.shippingAddress.unionOrWard}
                                </p>
                              )}
                            </td>
                            <td className="p-3 font-black text-slate-900 tabular-nums">
                              ৳ {o.pricing.total.toLocaleString()}
                            </td>
                            <td className="p-3 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="uppercase font-bold text-blue-700">{o.paymentMethod}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                    o.paymentStatus === 'paid'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : o.paymentStatus === 'failed'
                                      ? 'bg-rose-100 text-rose-800'
                                      : o.paymentStatus === 'refunded'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {o.paymentStatus}
                                </span>
                              </div>
                              {o.paymentDetails?.transactionId && (
                                <p className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]">
                                  Tx: {o.paymentDetails.transactionId}
                                </p>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  o.orderStatus === 'delivered'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : o.orderStatus === 'cancelled' || o.orderStatus === 'returned'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {o.orderStatus}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setInspectingOrder(o)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                  title="Inspect full order details drawer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {canUpdateOrderStatus && (
                                  <button
                                    type="button"
                                    onClick={() => openOrderStatusModal(o)}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                  >
                                    Update
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Server Pagination Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs">
                  <p className="text-slate-500 font-medium">
                    Showing page <span className="font-bold text-slate-900">{orderPagination.page}</span> of{' '}
                    <span className="font-bold text-slate-900">{Math.max(1, orderPagination.totalPages)}</span> (
                    <span className="font-bold text-slate-900">{orderPagination.total}</span> total orders)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={orderPage <= 1 || isOrdersLoading}
                      onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={orderPage >= Math.max(1, orderPagination.totalPages) || isOrdersLoading}
                      onClick={() => setOrderPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== MODULE 3B: TRANSACTIONS & PAYMENTS ==================== */}
          {activeModule === 'transactions' && canAccessModule(user?.role, 'transactions') && (
            <TransactionsManager onInspectOrder={handleInspectOrderById} />
          )}

          {/* ==================== MODULE 4: CUSTOMERS ==================== */}
          {activeModule === 'customers' && (
            <CustomersManager customers={customers} onRefresh={refreshAllData} />
          )}

          {/* ==================== MODULE 5: REVIEWS ==================== */}
          {activeModule === 'reviews' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Customer Reviews Moderation Queue</h3>
                <p className="text-xs text-slate-500">Approve or reject customer product ratings before publication.</p>
              </div>

              <div className="divide-y divide-slate-100">
                {reviews.map((rev) => (
                  <div key={rev._id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-900">{rev.userName}</span>
                        <span className="text-amber-500 font-bold">★ {rev.rating}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            rev.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {rev.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{rev.comment}</p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        onClick={() => setInspectingReview(rev)}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                        title="Inspect review details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleModerateReview(rev._id, 'approved')}
                        className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 cursor-pointer"
                        title="Approve review"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleModerateReview(rev._id, 'rejected')}
                        className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 cursor-pointer"
                        title="Reject review"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            isOpen: true,
                            id: rev._id,
                            name: `Review from ${rev.userName}`,
                            type: 'review',
                            isConfirming: false,
                          })
                        }
                        className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-rose-50 hover:text-rose-600 cursor-pointer transition"
                        title="Permanently delete review"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== MODULE 6: COUPONS ==================== */}
          {activeModule === 'coupons' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Promotions & Vouchers</h3>
                  <p className="text-xs text-slate-500">Create discount coupons and campaign voucher codes.</p>
                </div>
                <button
                  onClick={handleOpenCreateCoupon}
                  className="px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md hover:bg-blue-700 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Coupon</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {coupons.map((c, idx) => (
                  <div key={c._id || c.code || idx} className="p-4 rounded-2xl border border-blue-100 bg-blue-50/30 space-y-2 relative group hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-blue-700 text-sm">{c.code}</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                        {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `৳${c.discountValue} OFF`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">Min Order: ৳{c.minOrderAmount?.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400">Used: {c.usedCount || 0} times</p>
                    <div className="pt-2 border-t border-blue-100/60 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-400 font-medium">
                        Valid to: {c.validUntil ? new Date(c.validUntil).toLocaleDateString() : 'Active'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditCoupon(c)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                          title="Edit Coupon"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {canDeleteCoupon && (
                          <button
                            onClick={() => handleDeleteCoupon(c)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            title="Delete Coupon"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== MODULE 7: CATEGORIES ==================== */}
          {activeModule === 'categories' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Category Hierarchy & Ordering</h3>
                  <p className="text-xs text-slate-500">Control storefront navigation categories and item counts.</p>
                </div>
                <button
                  onClick={handleOpenCreateCategory}
                  className="px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md hover:bg-blue-700 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Category</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {categories.map((cat) => (
                  <div key={cat._id || cat.slug} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-center flex flex-col items-center relative group hover:border-blue-200 transition">
                    <div className="w-14 h-14 rounded-xl bg-white p-2 shadow-2xs mb-2 overflow-hidden flex items-center justify-center">
                      {cat.image ? (
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-cover rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Layers className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{cat.name}</h4>
                    <span className="text-[10px] text-slate-400">({cat.liveCount ?? cat.itemCount ?? 0} products)</span>
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200/50 w-full justify-center">
                      <button
                        onClick={() => handleOpenEditCategory(cat)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                        title="Edit Category"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== MODULE 8: BRANDS ==================== */}
          {activeModule === 'brands' && (
            <BrandsManager brands={brands} onRefresh={refreshAllData} />
          )}

          {/* ==================== MODULE: ATTRIBUTES ==================== */}
          {activeModule === 'attributes' && (
            <AttributesManager categories={categories} />
          )}

          {/* ==================== MODULE 9: HERO SLIDER ==================== */}
          {activeModule === 'hero-slider' && (
            <HeroSliderManager slides={cmsConfig?.heroSlides || []} onRefresh={refreshAllData} />
          )}

          {/* ==================== MODULE 10: BANNERS ==================== */}
          {activeModule === 'banners' && (
            <BannersManager banners={cmsConfig?.banners || []} onRefresh={refreshAllData} />
          )}

          {/* ==================== MODULE: DYNAMIC NAVIGATION ==================== */}
          {activeModule === 'navigation' && (
            <NavigationManager />
          )}

          {/* ==================== MODULE: ADVERTISEMENTS ==================== */}
          {activeModule === 'advertisements' && (
            <AdvertisementsManager />
          )}

          {/* ==================== MODULE 11: PAGES ==================== */}
          {activeModule === 'pages' && (
            <PagesManager />
          )}

          {/* ==================== MODULE 12: BLOG POSTS ==================== */}
          {activeModule === 'blog-posts' && (
            <BlogPostsManager />
          )}

          {/* ==================== MODULE 13: SETTINGS ==================== */}
          {(activeModule === 'general-settings' ||
            activeModule === 'payment-methods' ||
            activeModule === 'shipping-settings' ||
            activeModule === 'tax-fees' ||
            activeModule === 'notifications') && (
            <SettingsManager
              initialSettings={cmsConfig?.settings}
              activeSubTab={
                activeModule === 'payment-methods'
                  ? 'payment'
                  : activeModule === 'shipping-settings'
                  ? 'shipping'
                  : activeModule === 'tax-fees'
                  ? 'tax'
                  : activeModule === 'notifications'
                  ? 'notifications'
                  : 'general'
              }
              onRefresh={refreshAllData}
            />
          )}

          {/* ==================== MODULE 14: AUDIT LOGS ==================== */}
          {activeModule === 'audit-logs' && (
            <AuditLogsManager />
          )}

          {/* ==================== MODULE 15: BACKUP & RESTORE ==================== */}
          {activeModule === 'backup-restore' && (
            <BackupManager />
          )}

          {/* ==================== MODULE 16: STAFF MANAGEMENT ==================== */}
          {activeModule === 'staff-management' && (
            <StaffManager />
          )}

          {/* ==================== MODULE 17: MONGODB ATLAS STATUS ==================== */}
          {activeModule === 'database-status' && (
            <AtlasDiagnosticsManager onDataRefresh={refreshAllData} />
          )}
        </main>
      </div>

      {/* ==================== GLOBAL MODALS ==================== */}

      {/* MODAL 1: Create / Edit Product */}
      <AdminModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? `Edit Product: ${editingProduct.name}` : 'Create New Catalog Product'}
        subtitle="Manage product specifications, dynamic variants, pricing, and live storefront attributes."
        size="4xl"
        icon={<Package className="w-5 h-5 text-blue-600" />}
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {/* Modal Tab Switcher */}
          <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setProductModalTab('basic')}
              className={`px-3 py-1.5 rounded-lg transition ${
                productModalTab === 'basic' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Basic & Pricing
            </button>
            <button
              type="button"
              onClick={() => setProductModalTab('variants')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                productModalTab === 'variants' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Variants Matrix</span>
              {productForm.variants?.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${productModalTab === 'variants' ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-800'}`}>
                  {productForm.variants.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setProductModalTab('highlights')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                productModalTab === 'highlights' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Highlights & Specs</span>
              {productForm.highlights?.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${productModalTab === 'highlights' ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-800'}`}>
                  {productForm.highlights.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setProductModalTab('faqs')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                productModalTab === 'faqs' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>FAQs & Content</span>
              {productForm.faqs?.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${productModalTab === 'faqs' ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-800'}`}>
                  {productForm.faqs.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: BASIC & PRICING */}
          {productModalTab === 'basic' && (
            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setProductForm({
                        ...productForm,
                        name,
                        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
                      });
                    }}
                    placeholder="e.g. Samsung Galaxy S25 Ultra 5G"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subtitle / Tagline</label>
                  <input
                    type="text"
                    value={productForm.subtitle}
                    onChange={(e) => setProductForm({ ...productForm, subtitle: e.target.value })}
                    placeholder="e.g. Next-Level Performance. Unmatched Innovation."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Slug</label>
                  <input
                    type="text"
                    required
                    value={productForm.slug}
                    onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand *</label>
                  <input
                    type="text"
                    required
                    value={productForm.brand}
                    onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    {categories.map((c) => (
                      <option key={c._id || c.slug} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategory</label>
                  <input
                    type="text"
                    value={productForm.subcategory}
                    onChange={(e) => setProductForm({ ...productForm, subcategory: e.target.value })}
                    placeholder="e.g. Smartphones, Audio..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Badge</label>
                  <input
                    type="text"
                    value={productForm.badge}
                    onChange={(e) => setProductForm({ ...productForm, badge: e.target.value })}
                    placeholder="e.g. BEST SELLER, -20%, Hot"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Regular Price (৳) *</label>
                  <input
                    type="number"
                    required
                    value={productForm.basePrice}
                    onChange={(e) => setProductForm({ ...productForm, basePrice: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Price (৳) *</label>
                  <input
                    type="number"
                    required
                    value={productForm.salePrice}
                    onChange={(e) => setProductForm({ ...productForm, salePrice: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    required
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catalog Status</label>
                  <select
                    value={productForm.status}
                    onChange={(e: any) => setProductForm({ ...productForm, status: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="active">Active / Published</option>
                    <option value="draft">Draft (Hidden from Storefront)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <ImageUploadInput
                    label="Primary Cover Photo"
                    value={productForm.image}
                    onChange={(url) => setProductForm({ ...productForm, image: url })}
                    placeholder="https://..."
                    helperText="Upload device photo or paste CDN URL. Displayed as main storefront thumbnail."
                    aspectRatio="square"
                  />
                </div>
              </div>

              {/* Product Gallery Images (Multi-Image Upload) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <ImageUploadInput
                  label="Product Photo Gallery & Showcase Views"
                  multiple
                  values={productForm.images || []}
                  onMultipleChange={(urls) => {
                    setProductForm({
                      ...productForm,
                      images: urls,
                      image: productForm.image || urls[0] || '',
                    });
                  }}
                  helperText="Upload multiple gallery photos from your computer. Customers can browse these in the interactive PDP gallery."
                  maxImages={8}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Short Description *</label>
                <textarea
                  required
                  rows={2}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 2: VARIANTS MATRIX */}
          {productModalTab === 'variants' && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Product Variants ({productForm.variants?.length || 0})</h4>
                  <p className="text-[11px] text-slate-500">Add options (e.g. Color, Storage, Size) with custom SKUs, prices, and stock.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newVar = {
                      id: `var-${Date.now()}`,
                      name: `Variant ${(productForm.variants?.length || 0) + 1}`,
                      sku: `${productForm.sku}-VAR${(productForm.variants?.length || 0) + 1}`,
                      price: productForm.salePrice,
                      originalPrice: productForm.basePrice,
                      stock: 10,
                      options: { Option: 'Default' },
                      isActive: true,
                    };
                    setProductForm({ ...productForm, variants: [...(productForm.variants || []), newVar] });
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Variant
                </button>
              </div>

              {(!productForm.variants || productForm.variants.length === 0) ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-500">No variants created yet. This product uses single SKU pricing.</p>
                  <button
                    type="button"
                    onClick={() => {
                      const newVar = {
                        id: `var-${Date.now()}`,
                        name: 'Standard Edition',
                        sku: `${productForm.sku}-STD`,
                        price: productForm.salePrice,
                        stock: productForm.stock,
                        options: { Edition: 'Standard' },
                        isActive: true,
                      };
                      setProductForm({ ...productForm, variants: [newVar] });
                    }}
                    className="mt-2 text-xs font-bold text-blue-600 hover:underline"
                  >
                    + Add first variant
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {productForm.variants.map((variant, vIdx) => (
                    <div key={vIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Name</label>
                          <input
                            type="text"
                            value={variant.name}
                            onChange={(e) => {
                              const updated = [...productForm.variants];
                              updated[vIdx] = { ...updated[vIdx], name: e.target.value };
                              setProductForm({ ...productForm, variants: updated });
                            }}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">SKU</label>
                          <input
                            type="text"
                            value={variant.sku}
                            onChange={(e) => {
                              const updated = [...productForm.variants];
                              updated[vIdx] = { ...updated[vIdx], sku: e.target.value };
                              setProductForm({ ...productForm, variants: updated });
                            }}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Price (৳)</label>
                          <input
                            type="number"
                            value={variant.price || 0}
                            onChange={(e) => {
                              const updated = [...productForm.variants];
                              updated[vIdx] = { ...updated[vIdx], price: Number(e.target.value) };
                              setProductForm({ ...productForm, variants: updated });
                            }}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-blue-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Stock</label>
                          <input
                            type="number"
                            value={variant.stock || 0}
                            onChange={(e) => {
                              const updated = [...productForm.variants];
                              updated[vIdx] = { ...updated[vIdx], stock: Number(e.target.value) };
                              setProductForm({ ...productForm, variants: updated });
                            }}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      {/* Options String and Delete button */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-500">Options:</span>
                          <span className="font-mono text-[11px] text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {JSON.stringify(variant.options || {})}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 cursor-pointer text-[11px] font-semibold text-slate-600">
                            <input
                              type="checkbox"
                              checked={variant.isActive !== false}
                              onChange={(e) => {
                                const updated = [...productForm.variants];
                                updated[vIdx] = { ...updated[vIdx], isActive: e.target.checked };
                                setProductForm({ ...productForm, variants: updated });
                              }}
                              className="rounded text-blue-600"
                            />
                            Active
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = productForm.variants.filter((_, i) => i !== vIdx);
                              setProductForm({ ...productForm, variants: updated });
                            }}
                            className="text-rose-600 hover:text-rose-800 p-1"
                            title="Remove variant"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HIGHLIGHTS & SPECS */}
          {productModalTab === 'highlights' && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* 4 Feature Highlights */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">Feature Highlight Cards (4 Key Badges on PDP)</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setProductForm({
                        ...productForm,
                        highlights: [...(productForm.highlights || []), { label: 'Feature', value: 'New Spec', icon: 'sparkles' }],
                      });
                    }}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    + Add Highlight
                  </button>
                </div>
                <div className="space-y-2">
                  {productForm.highlights?.map((hl, hIdx) => (
                    <div key={hIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Value (e.g. 200MP Camera)"
                        value={hl.value}
                        onChange={(e) => {
                          const updated = [...productForm.highlights];
                          updated[hIdx] = { ...updated[hIdx], value: e.target.value };
                          setProductForm({ ...productForm, highlights: updated });
                        }}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Label (e.g. Camera)"
                        value={hl.label}
                        onChange={(e) => {
                          const updated = [...productForm.highlights];
                          updated[hIdx] = { ...updated[hIdx], label: e.target.value };
                          setProductForm({ ...productForm, highlights: updated });
                        }}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                      <select
                        value={hl.icon || 'sparkles'}
                        onChange={(e) => {
                          const updated = [...productForm.highlights];
                          updated[hIdx] = { ...updated[hIdx], icon: e.target.value };
                          setProductForm({ ...productForm, highlights: updated });
                        }}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="camera">Camera</option>
                        <option value="cpu">CPU/Processor</option>
                        <option value="smartphone">Display</option>
                        <option value="battery">Battery</option>
                        <option value="feather">Lightweight</option>
                        <option value="sparkles">Sparkles</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = productForm.highlights.filter((_, i) => i !== hIdx);
                          setProductForm({ ...productForm, highlights: updated });
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Specifications Table */}
              <div className="space-y-2 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">Technical Specifications Table</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setProductForm({
                        ...productForm,
                        specificationsTable: [...(productForm.specificationsTable || []), { label: 'Spec Name', value: 'Value' }],
                      });
                    }}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    + Add Spec Row
                  </button>
                </div>
                <div className="space-y-2">
                  {productForm.specificationsTable?.map((spec, sIdx) => (
                    <div key={sIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Label (e.g. Display)"
                        value={spec.label}
                        onChange={(e) => {
                          const updated = [...productForm.specificationsTable];
                          updated[sIdx] = { ...updated[sIdx], label: e.target.value };
                          setProductForm({ ...productForm, specificationsTable: updated });
                        }}
                        className="w-1/3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. 6.8-inch AMOLED 2X)"
                        value={spec.value}
                        onChange={(e) => {
                          const updated = [...productForm.specificationsTable];
                          updated[sIdx] = { ...updated[sIdx], value: e.target.value };
                          setProductForm({ ...productForm, specificationsTable: updated });
                        }}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = productForm.specificationsTable.filter((_, i) => i !== sIdx);
                          setProductForm({ ...productForm, specificationsTable: updated });
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FAQS & CONTENT */}
          {productModalTab === 'faqs' && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Warranty Text</label>
                  <input
                    type="text"
                    value={productForm.warranty}
                    onChange={(e) => setProductForm({ ...productForm, warranty: e.target.value })}
                    placeholder="e.g. 1 Year Official Brand Warranty"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Estimate Text</label>
                  <input
                    type="text"
                    value={productForm.deliveryEstimate}
                    onChange={(e) => setProductForm({ ...productForm, deliveryEstimate: e.target.value })}
                    placeholder="e.g. Estimated Delivery: 2 - 3 Working Days"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* FAQs List */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">Frequently Asked Questions (PDP Accordion)</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setProductForm({
                        ...productForm,
                        faqs: [...(productForm.faqs || []), { question: 'Question?', answer: 'Answer...' }],
                      });
                    }}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    + Add FAQ
                  </button>
                </div>
                <div className="space-y-2">
                  {productForm.faqs?.map((faq, fIdx) => (
                    <div key={fIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          placeholder="Question"
                          value={faq.question}
                          onChange={(e) => {
                            const updated = [...productForm.faqs];
                            updated[fIdx] = { ...updated[fIdx], question: e.target.value };
                            setProductForm({ ...productForm, faqs: updated });
                          }}
                          className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = productForm.faqs.filter((_, i) => i !== fIdx);
                            setProductForm({ ...productForm, faqs: updated });
                          }}
                          className="text-slate-400 hover:text-rose-600 ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Answer"
                        value={faq.answer}
                        onChange={(e) => {
                          const updated = [...productForm.faqs];
                          updated[fIdx] = { ...updated[fIdx], answer: e.target.value };
                          setProductForm({ ...productForm, faqs: updated });
                        }}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition">
              Save Product
            </button>
          </div>
        </form>
      </AdminModal>

      {/* MODAL 2: Order Status & Payment Lifecycle Transition */}
      <AdminModal
        isOpen={isOrderStatusModalOpen}
        onClose={() => setIsOrderStatusModalOpen(false)}
        title={`Manage Order #${selectedOrderForStatus?.orderNumber}`}
        subtitle="Perform authorized lifecycle transitions with payment tracking and audit note."
        size="md"
        icon={<ShoppingBag className="w-5 h-5 text-blue-600" />}
      >
        <form onSubmit={handleUpdateOrderStatus} className="space-y-4">
          {selectedOrderForStatus && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Order Status <span className="text-[10px] text-slate-400">(Current: {selectedOrderForStatus.orderStatus})</span>
                </label>
                <select
                  value={newOrderStatus}
                  onChange={(e) => setNewOrderStatus(e.target.value as Order['orderStatus'])}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  {[
                    selectedOrderForStatus.orderStatus,
                    ...(ORDER_STATUS_TRANSITIONS[selectedOrderForStatus.orderStatus] || []),
                  ].map((statusKey) => (
                    <option key={statusKey} value={statusKey}>
                      {ORDER_STATUS_LABELS[statusKey]}
                      {statusKey === selectedOrderForStatus.orderStatus ? ' (Current)' : ''}
                    </option>
                  ))}
                </select>
                {(ORDER_STATUS_TRANSITIONS[selectedOrderForStatus.orderStatus] || []).length === 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Terminal fulfillment state reached. You can still update payment status or log a staff note.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Status <span className="text-[10px] text-slate-400">({selectedOrderForStatus.paymentMethod.toUpperCase()})</span>
                </label>
                <select
                  value={newPaymentStatus}
                  onChange={(e) => setNewPaymentStatus(e.target.value as Order['paymentStatus'])}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Note / Reason</label>
            <input
              type="text"
              placeholder="e.g. Courier tracking dispatched via Pathao / Payment reconciled"
              value={orderStatusNote}
              onChange={(e) => setOrderStatusNote(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOrderStatusModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer hover:bg-blue-700 transition">
              Update Order
            </button>
          </div>
        </form>
      </AdminModal>

      {/* MODAL 3: New / Edit Coupon Modal */}
      <AdminModal
        isOpen={isCouponModalOpen}
        onClose={() => setIsCouponModalOpen(false)}
        title={editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create Promotional Coupon'}
        subtitle="Define discount rules, minimum order amounts, and expiration."
        size="md"
        icon={<Tag className="w-5 h-5 text-blue-600" />}
      >
        <form onSubmit={handleSaveCoupon} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Coupon Code *</label>
            <input
              type="text"
              required
              placeholder="e.g. SUMMER20"
              value={couponForm.code}
              onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase font-mono font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Type</label>
              <select
                value={couponForm.discountType}
                onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value as any })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (৳)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Value *</label>
              <input
                type="number"
                required
                value={couponForm.discountValue}
                onChange={(e) => setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Order Amount (৳)</label>
            <input
              type="number"
              value={couponForm.minOrderAmount}
              onChange={(e) => setCouponForm({ ...couponForm, minOrderAmount: Number(e.target.value) })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Valid Until</label>
            <input
              type="date"
              value={couponForm.validUntil}
              onChange={(e) => setCouponForm({ ...couponForm, validUntil: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCouponModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer hover:bg-blue-700 transition">
              {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* MODAL 4: Create / Edit Category Modal */}
      <AdminModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Category'}
        subtitle="Add or modify a product classification category in the storefront."
        size="lg"
        icon={<Layers className="w-5 h-5 text-blue-600" />}
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Gaming & VR"
              value={categoryForm.name}
              onChange={(e) => {
                const name = e.target.value;
                setCategoryForm({
                  ...categoryForm,
                  name,
                  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
                });
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <ImageUploadInput
              label="Category Thumbnail Asset"
              value={categoryForm.image}
              onChange={(url) => setCategoryForm({ ...categoryForm, image: url })}
              placeholder="https://images.unsplash.com/..."
              helperText="Representative square photo for storefront navigation."
              aspectRatio="square"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer hover:bg-blue-700 transition">
              {editingCategory ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* ==================== ENTERPRISE DETAILS DRAWERS & CONFIRM DIALOGS ==================== */}

      {/* Order Details Drawer */}
      <OrderDetailsDrawer
        isOpen={!!inspectingOrder}
        onClose={() => setInspectingOrder(null)}
        order={inspectingOrder}
        onUpdateStatus={canUpdateOrderStatus ? (ord) => openOrderStatusModal(ord) : undefined}
        onOrderUpdated={(updated) => {
          setInspectingOrder(updated);
          refreshAllData();
        }}
      />

      {/* Product Details Drawer */}
      <ProductDetailsDrawer
        isOpen={!!inspectingProduct}
        onClose={() => setInspectingProduct(null)}
        product={inspectingProduct}
        onEdit={
          canEditProduct
            ? (p) => {
                setEditingProduct(p);
                setProductForm({
                  name: p.name,
                  subtitle: p.subtitle || '',
                  slug: p.slug,
                  sku: p.sku,
                  brand: p.brand,
                  category: p.category,
                  subcategory: p.subcategory || '',
                  basePrice: p.basePrice,
                  salePrice: p.salePrice,
                  stock: p.stock,
                  description: p.description,
                  badge: p.badge || '',
                  status: p.status || 'active',
                  image: p.images?.[0] || '',
                  images: p.images || [],
                  warranty: p.warranty || '',
                  deliveryEstimate: p.deliveryEstimate || '',
                  variants: p.variants || [],
                  highlights: p.highlights || [],
                  specificationsTable: p.specificationsTable || [],
                  faqs: p.faqs || [],
                });
                setProductModalTab('basic');
                setIsProductModalOpen(true);
              }
            : undefined
        }
      />

      {/* Review Details Drawer */}
      <ReviewDetailsDrawer
        isOpen={!!inspectingReview}
        onClose={() => setInspectingReview(null)}
        review={inspectingReview}
        onApprove={(id) => handleModerateReview(id, 'approved')}
        onReject={(id) => handleModerateReview(id, 'rejected')}
      />

      {/* Modernized Deletion ConfirmDialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleExecuteDelete}
        title={`Delete ${deleteConfirm.type.charAt(0).toUpperCase() + deleteConfirm.type.slice(1)}`}
        recordIdentifier={deleteConfirm.name}
        message={`Are you sure you want to permanently delete this ${deleteConfirm.type}? This action cannot be undone and will update catalog state immediately.`}
        isConfirming={deleteConfirm.isConfirming}
        confirmLabel={`Delete ${deleteConfirm.type.charAt(0).toUpperCase() + deleteConfirm.type.slice(1)}`}
        variant="danger"
      />
    </div>
  );
};
