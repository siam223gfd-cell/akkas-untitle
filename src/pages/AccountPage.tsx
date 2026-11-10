import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { getUnions } from 'bd-divisions-to-unions';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout, updateAddresses, updateUser } from '../features/auth/authSlice';
import {
  selectWishlistItems,
  selectWishlistCount,
  removeFromWishlist,
  setWishlistItems,
  WishlistItem,
} from '../features/wishlist/wishlistSlice';
import { addToCart } from '../features/cart/cartSlice';
import { addToast, openAuthModal } from '../features/ui/uiSlice';
import { apiRequest } from '../services/api';
import { Order, Product } from '../types';
import { BangladeshAddressSelector, AddressFormData } from '../components/common/BangladeshAddressSelector';
import { AdminModal, ConfirmDialog } from '../components/admin/common/modal';
import {
  User,
  ShoppingBag,
  MapPin,
  Heart,
  LogOut,
  Clock,
  Trash2,
  Edit2,
  Plus,
  Package,
  XCircle,
  KeyRound,
  Search,
  ShoppingCart,
  Eye,
  CreditCard,
} from 'lucide-react';

const BD_PHONE_PATTERN = /^(?:\+?88)?01[3-9]\d{8}$/;
const BD_POSTAL_PATTERN = /^\d{4}$/;

function mapProductToWishlistItem(prod: Product): WishlistItem {
  const hasDiscount = prod.basePrice > prod.salePrice;
  const pct = hasDiscount ? Math.round(((prod.basePrice - prod.salePrice) / prod.basePrice) * 100) : 0;
  return {
    productId: prod._id,
    name: prod.name,
    slug: prod.slug,
    price: prod.salePrice,
    originalPrice: hasDiscount ? prod.basePrice : undefined,
    discountBadge: pct > 0 ? `-${pct}%` : prod.badge,
    image: prod.images?.[0] || '',
    rating: prod.rating || 0,
    reviewCount:
      prod.reviewCount >= 1000
        ? `${(prod.reviewCount / 1000).toFixed(1)}k reviews`
        : `${prod.reviewCount || 0} reviews`,
    category: prod.category,
    inStock: (prod.stock ?? 0) > 0,
  };
}

export const AccountPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const wishlistItems = useAppSelector(selectWishlistItems);
  const wishlistCount = useAppSelector(selectWishlistCount);

  const activeTab = searchParams.get('tab') || 'orders';

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderModal, setSelectedOrderModal] = useState<Order | null>(null);

  // Shared non-blocking ConfirmDialog state (zero window.confirm)
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'cancel-order'; orderId: string; orderNumber: string }
    | { type: 'delete-address'; addressId: string; label?: string }
    | null
  >(null);
  const [isProcessingConfirm, setIsProcessingConfirm] = useState(false);

  // Address modal/form state
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressLabel, setAddressLabel] = useState('Home');
  const [isAddressDefault, setIsAddressDefault] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const [addressFormData, setAddressFormData] = useState<AddressFormData>({
    recipientName: '',
    phone: '',
    division: '',
    divisionId: undefined,
    district: '',
    districtId: undefined,
    upazila: '',
    upazilaId: undefined,
    unionOrWard: '',
    unionId: undefined,
    locality: '',
    house: '',
    road: '',
    postalCode: '',
    streetAddress: '',
    deliveryInstructions: '',
  });

  // Profile edit state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      dispatch(openAuthModal({ tab: 'login', redirectPath: '/account' }));
    } else if (user) {
      setProfileName(user.name);
      setProfilePhone(user.phone || '');
    }
  }, [isAuthenticated, user, dispatch]);

  const loadOrders = () => {
    if (!isAuthenticated) return;
    setIsLoadingOrders(true);
    const params = new URLSearchParams();
    if (orderStatusFilter !== 'all') params.set('status', orderStatusFilter);
    if (orderSearch.trim()) params.set('search', orderSearch.trim());
    const qs = params.toString() ? `?${params.toString()}` : '';
    apiRequest(`/orders/my-orders${qs}`).then((res) => {
      setIsLoadingOrders(false);
      if (res.success && res.orders) {
        setOrders(res.orders);
      }
    });
  };

  useEffect(() => {
    loadOrders();
  }, [isAuthenticated, orderStatusFilter]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiRequest('/wishlist').then((res) => {
      if (res.success && Array.isArray(res.items)) {
        dispatch(setWishlistItems(res.items.map(mapProductToWishlistItem)));
      }
    });
    apiRequest('/auth/addresses').then((res) => {
      if (res.success && Array.isArray(res.addresses)) {
        dispatch(updateAddresses(res.addresses));
      }
    });
  }, [isAuthenticated, dispatch]);

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Sign in to Access Your Account</h2>
        <button
          type="button"
          onClick={() => dispatch(openAuthModal({ tab: 'login' }))}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handleOpenCreateAddress = () => {
    setEditingAddressId(null);
    setAddressFormData({
      recipientName: user?.name || '',
      phone: user?.phone || '',
      division: '',
      divisionId: undefined,
      district: '',
      districtId: undefined,
      upazila: '',
      upazilaId: undefined,
      unionOrWard: '',
      unionId: undefined,
      locality: '',
      house: '',
      road: '',
      postalCode: '',
      streetAddress: '',
      deliveryInstructions: '',
    });
    setAddressLabel('Home');
    setIsAddressDefault((user?.addresses?.length || 0) === 0);
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr: any) => {
    setEditingAddressId(addr._id || addr.id);
    setAddressFormData({
      recipientName: addr.recipientName,
      phone: addr.phone,
      division: addr.division,
      divisionId: addr.divisionId,
      district: addr.district,
      districtId: addr.districtId,
      upazila: addr.upazila,
      upazilaId: addr.upazilaId,
      unionOrWard: addr.unionOrWard || '',
      unionId: addr.unionId,
      locality: addr.locality || '',
      house: addr.house || '',
      road: addr.road || '',
      postalCode: addr.postalCode || '',
      streetAddress: addr.streetAddress,
      deliveryInstructions: addr.deliveryInstructions || '',
    });
    setAddressLabel(addr.label || 'Home');
    setIsAddressDefault(!!addr.isDefault);
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPhone = addressFormData.phone.replace(/[\s()-]/g, '').trim();
    if (!addressFormData.recipientName.trim() || addressFormData.recipientName.trim().length < 2) {
      dispatch(addToast({ type: 'error', title: 'Invalid Recipient Name', message: 'Recipient name is required.' }));
      return;
    }

    if (!BD_PHONE_PATTERN.test(cleanPhone)) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Invalid Phone Number',
          message: 'Please enter a valid 11-digit Bangladesh mobile number (e.g. 01712345678).',
        })
      );
      return;
    }

    if (addressFormData.postalCode?.trim() && !BD_POSTAL_PATTERN.test(addressFormData.postalCode.trim())) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Invalid Postal Code',
          message: 'Postal code must be 4 digits.',
        })
      );
      return;
    }

    if (!addressFormData.division.trim() || !addressFormData.district.trim() || !addressFormData.upazila.trim()) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Incomplete Location',
          message: 'Please select Division, District, and Upazila.',
        })
      );
      return;
    }

    if (addressFormData.upazilaId) {
      const unions = getUnions(addressFormData.upazilaId) || [];
      if (unions.length > 0 && !addressFormData.unionId && !addressFormData.unionOrWard?.trim()) {
        dispatch(
          addToast({
            type: 'error',
            title: 'Union / Ward Required',
            message: `Please select a Union / Ward for ${addressFormData.upazila}.`,
          })
        );
        return;
      }
    }

    if (!addressFormData.streetAddress.trim() || addressFormData.streetAddress.trim().length < 3) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Missing Street Address',
          message: 'Detailed street address is required.',
        })
      );
      return;
    }

    if (isSavingAddress) return;
    setIsSavingAddress(true);

    try {
      const payload = {
        ...addressFormData,
        phone: cleanPhone,
        postalCode: addressFormData.postalCode?.trim() || '',
        label: addressLabel,
        isDefault: isAddressDefault,
      };

      const res = editingAddressId
        ? await apiRequest(`/auth/addresses/${editingAddressId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await apiRequest('/auth/addresses', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      if (res.success && res.addresses) {
        dispatch(updateAddresses(res.addresses));
        setIsAddressModalOpen(false);
        setEditingAddressId(null);
        dispatch(
          addToast({
            type: 'success',
            title: editingAddressId ? 'Address Updated' : 'Address Saved',
            message: 'Your delivery destination has been saved to your account.',
          })
        );
      } else {
        dispatch(
          addToast({
            type: 'error',
            title: 'Operation Failed',
            message: res.message || 'Could not save address.',
          })
        );
      }
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to save address.' }));
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSetDefaultAddress = async (addressId?: string) => {
    if (!addressId) return;
    const res = await apiRequest(`/auth/addresses/${addressId}/default`, { method: 'PATCH' });
    if (res.success && res.addresses) {
      dispatch(updateAddresses(res.addresses));
      dispatch(
        addToast({
          type: 'success',
          title: 'Default Address Updated',
          message: 'Primary shipping destination has been changed.',
        })
      );
    }
  };

  const handleExecuteConfirm = async () => {
    if (!confirmAction) return;
    setIsProcessingConfirm(true);

    try {
      if (confirmAction.type === 'cancel-order') {
        const res = await apiRequest(`/orders/${confirmAction.orderId}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'Customer requested cancellation via portal' }),
        });
        if (res.success) {
          dispatch(
            addToast({
              type: 'success',
              title: 'Order Cancelled',
              message: `Order ${confirmAction.orderNumber} has been cancelled and reserved stock released.`,
            })
          );
          loadOrders();
          if (selectedOrderModal?._id === confirmAction.orderId && res.order) {
            setSelectedOrderModal(res.order);
          }
        } else {
          dispatch(
            addToast({
              type: 'error',
              title: 'Cancellation Failed',
              message: res.message || 'Could not cancel this order.',
            })
          );
        }
      } else if (confirmAction.type === 'delete-address') {
        const res = await apiRequest(`/auth/addresses/${confirmAction.addressId}`, { method: 'DELETE' });
        if (res.success && res.addresses) {
          dispatch(updateAddresses(res.addresses));
          if (editingAddressId === confirmAction.addressId) {
            setEditingAddressId(null);
            setIsAddressModalOpen(false);
          }
          dispatch(
            addToast({
              type: 'info',
              title: 'Address Removed',
              message: 'The address has been removed from your account.',
            })
          );
        }
      }
    } finally {
      setIsProcessingConfirm(false);
      setConfirmAction(null);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = profilePhone.replace(/[\s()-]/g, '').trim();
    if (cleanPhone && !BD_PHONE_PATTERN.test(cleanPhone)) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Invalid Phone',
          message: 'Please enter a valid 11-digit Bangladesh mobile number.',
        })
      );
      return;
    }
    setIsSavingProfile(true);
    const res = await apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name: profileName.trim(), phone: cleanPhone }),
    });
    setIsSavingProfile(false);

    if (res.success && res.user) {
      dispatch(updateUser(res.user));
      dispatch(
        addToast({
          type: 'success',
          title: 'Profile Updated',
          message: 'Your personal information has been saved.',
        })
      );
    } else {
      dispatch(
        addToast({
          type: 'error',
          title: 'Update Failed',
          message: res.message || 'Could not update profile.',
        })
      );
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Password Mismatch',
          message: 'New password and confirmation do not match.',
        })
      );
      return;
    }

    setIsChangingPassword(true);
    const res = await apiRequest('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setIsChangingPassword(false);

    if (res.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      dispatch(
        addToast({
          type: 'success',
          title: 'Password Changed',
          message: 'Your password has been successfully updated.',
        })
      );
    } else {
      dispatch(
        addToast({
          type: 'error',
          title: 'Change Failed',
          message: res.message || 'Incorrect current password.',
        })
      );
    }
  };

  const handleAddWishlistToCart = async (item: WishlistItem) => {
    if (item.inStock === false) return;
    const res = await apiRequest(`/products/${encodeURIComponent(item.slug || item.productId)}`);
    if (!res.success || !res.product) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Product Unavailable',
          message: 'This product could not be loaded from the catalog.',
        })
      );
      return;
    }
    const prod: Product = res.product;
    if ((prod.stock ?? 0) <= 0) {
      dispatch(
        addToast({
          type: 'warning',
          title: 'Out of Stock',
          message: `${prod.name} is currently out of stock.`,
        })
      );
      return;
    }
    dispatch(
      addToCart({
        productId: prod._id,
        name: prod.name,
        subtitle: prod.subtitle || prod.category || '',
        sku: prod.sku || '',
        price: prod.salePrice,
        originalPrice: prod.basePrice > prod.salePrice ? prod.basePrice : undefined,
        quantity: 1,
        image: prod.images?.[0] || item.image || '',
        stock: prod.stock,
      })
    );
    dispatch(
      addToast({
        type: 'success',
        title: 'Added to Cart',
        message: `${prod.name} added to your shopping bag.`,
      })
    );
  };

  const handleRemoveWishlistItem = (item: WishlistItem) => {
    dispatch(removeFromWishlist(item.productId));
    apiRequest(`/wishlist/${encodeURIComponent(item.productId)}`, { method: 'DELETE' }).catch(() => {});
    dispatch(
      addToast({
        type: 'info',
        title: 'Removed',
        message: `${item.name} removed from your wishlist.`,
      })
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Account Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-md">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">{user.name}</h1>
            <p className="text-xs text-slate-500">{user.email}</p>
            <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
              Verified {user.role}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            try {
              const isStaff = ['super_admin', 'admin', 'moderator', 'inventory_manager', 'order_manager', 'support_agent', 'finance'].includes(user.role);
              await apiRequest(isStaff ? '/auth/admin/logout' : '/auth/logout', { method: 'POST' });
            } catch {
              // ignore network errors
            }
            dispatch(logout());
            navigate('/');
          }}
          className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors self-start sm:self-auto flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>

      {/* Tabs Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs h-fit">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'orders' })}
              className={`w-full px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 sm:gap-3 transition-colors cursor-pointer ${
                activeTab === 'orders' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span className="truncate">Orders ({orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'addresses' })}
              className={`w-full px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 sm:gap-3 transition-colors cursor-pointer ${
                activeTab === 'addresses' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">Addresses ({user.addresses?.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'wishlist' })}
              className={`w-full px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 sm:gap-3 transition-colors cursor-pointer ${
                activeTab === 'wishlist' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Heart className="w-4 h-4 shrink-0" />
              <span className="truncate">Wishlist ({wishlistCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'profile' })}
              className={`w-full px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 sm:gap-3 transition-colors cursor-pointer ${
                activeTab === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span className="truncate">Profile & Security</span>
            </button>
          </div>
        </aside>

        <main className="lg:col-span-9">
          {/* TAB 1: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900">Your Order History</h2>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      loadOrders();
                    }}
                    className="relative flex-1 sm:w-auto"
                  >
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Order # or item..."
                      className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </form>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="w-full sm:w-auto px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
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
                </div>
              </div>

              {isLoadingOrders ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading your orders...</div>
              ) : orders.length === 0 ? (
                <div className="p-12 bg-white rounded-3xl border border-slate-100 text-center space-y-3">
                  <Package className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500">No matching orders found.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/shop')}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((ord) => {
                    const receiptQs = ord.receiptToken
                      ? `&token=${encodeURIComponent(ord.receiptToken)}`
                      : '';
                    return (
                      <div
                        key={ord._id}
                        className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 text-xs">
                          <div>
                            <span className="font-mono font-bold text-slate-900">{ord.orderNumber}</span>
                            <span className="text-slate-400 ml-2">
                              {new Date(ord.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                                ord.orderStatus === 'delivered'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.orderStatus === 'cancelled'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {ord.orderStatus}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                                ord.paymentStatus === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : ord.paymentStatus === 'refunded'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {ord.paymentStatus}
                            </span>
                            <span className="font-black text-slate-900 tabular-nums">
                              ৳{ord.pricing.total.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 overflow-x-auto">
                          {ord.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 shrink-0 bg-slate-50 p-2 rounded-xl">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-8 h-8 object-cover rounded bg-white"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded bg-white flex items-center justify-center">
                                  <Package className="w-4 h-4 text-slate-300" />
                                </div>
                              )}
                              <span className="text-xs text-slate-700 max-w-xs truncate">{item.name}</span>
                              <span className="text-xs text-slate-400 font-bold">x{item.quantity}</span>
                            </div>
                          ))}
                        </div>

                        <div className="text-[11px] text-slate-500 pt-1 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Delivering to: {ord.shippingAddress.upazila}, {ord.shippingAddress.district} (
                            {ord.paymentMethod.toUpperCase()})
                          </span>
                          <div className="flex items-center gap-3">
                            {(ord.orderStatus === 'pending' || ord.orderStatus === 'confirmed') && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    type: 'cancel-order',
                                    orderId: ord._id,
                                    orderNumber: ord.orderNumber,
                                  })
                                }
                                className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Cancel Order
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedOrderModal(ord)}
                              className="font-bold text-slate-700 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Details
                            </button>
                            <Link
                              to={`/order-success?orderId=${ord._id}${receiptQs}`}
                              className="font-bold text-blue-600 hover:underline"
                            >
                              Receipt →
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADDRESSES */}
          {activeTab === 'addresses' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">Saved Delivery Addresses</h2>
                  <p className="text-xs text-slate-500">
                    Manage delivery destinations for fast, verified one-click checkout.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreateAddress}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Address</span>
                </button>
              </div>

              {isAddressModalOpen && (
                <div className="bg-white p-6 rounded-3xl border-2 border-blue-600/30 shadow-xl space-y-5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {editingAddressId ? 'Update Delivery Address' : 'Add New Bangladesh Delivery Address'}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Powered by authoritative bd-divisions-to-unions location data
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddressModalOpen(false);
                        setEditingAddressId(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveAddress} className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 pb-2">
                      <span className="text-xs font-bold text-slate-700">Address Label:</span>
                      {['Home', 'Office', 'Warehouse', 'Other'].map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setAddressLabel(lbl)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            addressLabel === lbl
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    <BangladeshAddressSelector
                      value={addressFormData}
                      onChange={setAddressFormData}
                      showRecipientFields={true}
                      disabled={isSavingAddress}
                    />

                    <div className="pt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isDefaultAddrCheck"
                        checked={isAddressDefault}
                        onChange={(e) => setIsAddressDefault(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                      <label htmlFor="isDefaultAddrCheck" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                        Set as primary default address for checkout
                      </label>
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddressModalOpen(false);
                          setEditingAddressId(null);
                        }}
                        disabled={isSavingAddress}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingAddress}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSavingAddress ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <span>{editingAddressId ? 'Save Changes' : 'Save Address'}</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {user.addresses && user.addresses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {user.addresses.map((addr: any, idx) => {
                    const addrId = addr._id || addr.id || String(idx);
                    return (
                      <div
                        key={addrId}
                        className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3 relative group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-slate-100 text-slate-700">
                                {addr.label || 'Home'}
                              </span>
                              {addr.isDefault && (
                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-600 text-white">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditAddress(addr)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Edit Address"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    type: 'delete-address',
                                    addressId: addrId,
                                    label: addr.label || addr.recipientName,
                                  })
                                }
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Delete Address"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900">{addr.recipientName}</h4>
                          <p className="text-xs font-semibold text-blue-600 mt-0.5">{addr.phone}</p>
                          <p className="text-xs text-slate-700 font-medium mt-2 leading-relaxed">
                            {addr.streetAddress}
                          </p>
                          {(addr.house || addr.road || addr.locality) && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {[addr.house, addr.road, addr.locality].filter(Boolean).join(', ')}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-500 font-medium mt-1">
                            {addr.unionOrWard ? `${addr.unionOrWard}, ` : ''}
                            {addr.upazila}, {addr.district}, {addr.division}
                            {addr.postalCode ? ` - ${addr.postalCode}` : ''}
                          </p>
                          {addr.deliveryInstructions && (
                            <p className="text-[11px] text-amber-700 bg-amber-50/80 px-2 py-1 rounded-md border border-amber-200/50 mt-2 font-medium">
                              Note: {addr.deliveryInstructions}
                            </p>
                          )}
                        </div>

                        {!addr.isDefault && (
                          <div className="pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleSetDefaultAddress(addrId)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                            >
                              Set as Default Address
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">No Saved Delivery Destinations Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Save your home or office address using Bangladesh's official division, district, and upazila hierarchy for fast checkout.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenCreateAddress}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition cursor-pointer"
                  >
                    Add Your First Address
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIVE WISHLIST */}
          {activeTab === 'wishlist' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Your Saved Wishlist ({wishlistCount})</h2>
                <Link to="/wishlist" className="text-xs font-bold text-blue-600 hover:underline">
                  Open Full Wishlist →
                </Link>
              </div>

              {wishlistItems.length === 0 ? (
                <div className="bg-white p-10 rounded-3xl border border-slate-100 text-center space-y-3">
                  <Heart className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500">Your saved wishlist is currently empty.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/shop')}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Explore Catalog
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {wishlistItems.map((item) => (
                    <div
                      key={item.productId}
                      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5"
                    >
                      <Link
                        to={`/product/${item.slug || item.productId}`}
                        className="w-16 h-16 rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100 flex items-center justify-center"
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-slate-300" />
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/product/${item.slug || item.productId}`}
                          className="text-xs font-bold text-slate-900 hover:text-blue-600 truncate block"
                        >
                          {item.name}
                        </Link>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-xs font-black text-blue-700 tabular-nums">
                            ৳{item.price.toLocaleString()}
                          </span>
                          {item.originalPrice && item.originalPrice > item.price && (
                            <span className="text-[10px] text-slate-400 line-through tabular-nums">
                              ৳{item.originalPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            disabled={item.inStock === false}
                            onClick={() => handleAddWishlistToCart(item)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>{item.inStock === false ? 'Out of Stock' : 'Add to Cart'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveWishlistItem(item)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Remove from wishlist"
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

          {/* TAB 4: PROFILE & SECURITY */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-xl">
              <form onSubmit={handleUpdateProfile} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Personal Information
                </h2>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user.email}
                      className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Email address cannot be modified.</span>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Phone Number (+880)</label>
                    <input
                      type="tel"
                      value={profilePhone}
                      placeholder="01712345678"
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </form>

              <form onSubmit={handleChangePassword} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  Change Password
                </h2>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Current Password</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">New Password (min 6 characters)</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Customer Order Details Modal */}
      <AdminModal
        isOpen={!!selectedOrderModal}
        onClose={() => setSelectedOrderModal(null)}
        size="lg"
        icon={<ShoppingBag className="w-5 h-5" />}
        title={selectedOrderModal ? `Order #${selectedOrderModal.orderNumber}` : ''}
        subtitle={selectedOrderModal ? new Date(selectedOrderModal.createdAt).toLocaleString() : ''}
      >
        {selectedOrderModal && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 uppercase">Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold uppercase text-[10px]">
                  {selectedOrderModal.orderStatus}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                  {selectedOrderModal.paymentMethod} · {selectedOrderModal.paymentStatus}
                </span>
              </div>
              <span className="font-black text-slate-900 text-sm tabular-nums">
                ৳{selectedOrderModal.pricing.total.toLocaleString()}
              </span>
            </div>

            {selectedOrderModal.paymentDetails?.transactionId && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  Payment TxID: <span className="font-mono">{selectedOrderModal.paymentDetails.transactionId}</span>
                </span>
                {selectedOrderModal.paymentDetails.verifiedAt && (
                  <span className="text-[11px] text-emerald-700">
                    {new Date(selectedOrderModal.paymentDetails.verifiedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {selectedOrderModal.items.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-3 bg-white">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover bg-slate-50 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-50 shrink-0 flex items-center justify-center">
                        <Package className="w-5 h-5 text-slate-300" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-500">
                        ৳{item.price.toLocaleString()} × {item.quantity}
                      </p>
                      {item.options && Object.keys(item.options).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(item.options).map(([k, v]) => (
                            <span
                              key={k}
                              className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-semibold text-slate-600"
                            >
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 tabular-nums">
                    ৳{(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>৳{selectedOrderModal.pricing.subtotal.toLocaleString()}</span>
              </div>
              {selectedOrderModal.pricing.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>
                    Discount {selectedOrderModal.pricing.couponCode ? `(${selectedOrderModal.pricing.couponCode})` : ''}
                  </span>
                  <span>-৳{selectedOrderModal.pricing.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span>
                  {selectedOrderModal.pricing.shippingFee === 0
                    ? 'FREE'
                    : `৳${selectedOrderModal.pricing.shippingFee.toLocaleString()}`}
                </span>
              </div>
              {(selectedOrderModal.pricing.tax || 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>VAT / Tax</span>
                  <span>৳{selectedOrderModal.pricing.tax.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-slate-200 font-black text-slate-900">
                <span>Total</span>
                <span>৳{selectedOrderModal.pricing.total.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Delivery Address</span>
              <p className="font-bold text-slate-900">
                {selectedOrderModal.shippingAddress.recipientName} ({selectedOrderModal.shippingAddress.phone})
              </p>
              <p className="text-slate-600">{selectedOrderModal.shippingAddress.streetAddress}</p>
              {(selectedOrderModal.shippingAddress.house ||
                selectedOrderModal.shippingAddress.road ||
                selectedOrderModal.shippingAddress.locality) && (
                <p className="text-[11px] text-slate-500">
                  {[
                    selectedOrderModal.shippingAddress.house,
                    selectedOrderModal.shippingAddress.road,
                    selectedOrderModal.shippingAddress.locality,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                {selectedOrderModal.shippingAddress.unionOrWard
                  ? `${selectedOrderModal.shippingAddress.unionOrWard}, `
                  : ''}
                {selectedOrderModal.shippingAddress.upazila}, {selectedOrderModal.shippingAddress.district},{' '}
                {selectedOrderModal.shippingAddress.division}
                {selectedOrderModal.shippingAddress.postalCode
                  ? ` - ${selectedOrderModal.shippingAddress.postalCode}`
                  : ''}
              </p>
            </div>

            {selectedOrderModal.timeline && selectedOrderModal.timeline.length > 0 && (
              <div className="p-3 rounded-xl bg-white border border-slate-100 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Fulfillment Timeline</span>
                </div>
                {selectedOrderModal.timeline.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-1 shrink-0" />
                    <div>
                      <span className="font-bold capitalize text-slate-900">{step.status}</span>
                      <span className="text-slate-400 ml-2">{new Date(step.timestamp).toLocaleString()}</span>
                      {step.note && <p className="text-slate-600">{step.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </AdminModal>

      {/* Non-blocking Confirmation Dialog for Order Cancellation & Address Deletion */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => !isProcessingConfirm && setConfirmAction(null)}
        onConfirm={handleExecuteConfirm}
        isConfirming={isProcessingConfirm}
        title={
          confirmAction?.type === 'cancel-order'
            ? `Cancel Order ${confirmAction.orderNumber}?`
            : 'Remove Saved Address?'
        }
        recordIdentifier={
          confirmAction?.type === 'cancel-order'
            ? confirmAction.orderNumber
            : confirmAction?.label
        }
        message={
          confirmAction?.type === 'cancel-order'
            ? 'Cancelling this order will immediately release its inventory back into store stock and mark any completed online payment as refunded.'
            : 'This delivery address will be permanently deleted from your customer address book.'
        }
        confirmLabel={confirmAction?.type === 'cancel-order' ? 'Confirm Cancellation' : 'Delete Address'}
        variant="danger"
      />
    </div>
  );
};
