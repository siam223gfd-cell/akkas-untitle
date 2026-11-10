import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getUnions } from 'bd-divisions-to-unions';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  removePurchasedItems,
  updateQuantity,
  removeFromCart,
  applyCoupon,
  removeCoupon,
  hydrateCartItems,
  selectSelectedCartSubtotal,
  selectSelectedCartDiscount,
  selectSelectedCartShippingFee,
  selectSelectedCartTax,
  selectSelectedCartTotal,
} from '../features/cart/cartSlice';
import { updateAddresses } from '../features/auth/authSlice';
import { addToast } from '../features/ui/uiSlice';
import { apiRequest } from '../services/api';
import { Order, StoreSettings } from '../types';
import { BangladeshAddressSelector, AddressFormData } from '../components/common/BangladeshAddressSelector';
import { AdminModal } from '../components/admin/common/modal';
import {
  Mail,
  CreditCard,
  Banknote,
  ShieldCheck,
  Lock,
  ArrowRight,
  Info,
  ShoppingCart,
  Trash2,
  Truck,
  RotateCcw,
  Headphones,
  Tag,
  BookmarkCheck,
  PlusCircle,
  X,
  CheckCircle2,
  AlertCircle,
  Package,
} from 'lucide-react';

const BD_PHONE_PATTERN = /^(?:\+?88)?01[3-9]\d{8}$/;
const BD_POSTAL_PATTERN = /^\d{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createIdempotencyKey(): string {
  return `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const cartItems = useAppSelector((state) => state.cart.items);
  const appliedCoupon = useAppSelector((state) => state.cart.coupon);
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  // Strictly checkout selected cart items only
  const checkoutItems = cartItems.filter((item) => item.selected !== false);

  const [storeSettings, setStoreSettings] = useState<StoreSettings | undefined>(undefined);

  // Saved Addresses from authenticated customer account
  const savedAddresses = user?.addresses || [];
  const defaultAddress =
    savedAddresses.find((a) => a.isDefault) || (savedAddresses.length > 0 ? savedAddresses[0] : null);

  const [selectedAddressMode, setSelectedAddressMode] = useState<string>(
    defaultAddress ? defaultAddress._id || defaultAddress.id || 'default' : 'new'
  );

  const [emailAddress, setEmailAddress] = useState(user?.email || '');
  const [saveAddressToAccount, setSaveAddressToAccount] = useState(true);

  const [addressData, setAddressData] = useState<AddressFormData>({
    recipientName: defaultAddress?.recipientName || user?.name || '',
    phone: defaultAddress?.phone || user?.phone || '',
    division: defaultAddress?.division || '',
    divisionId: defaultAddress?.divisionId,
    district: defaultAddress?.district || '',
    districtId: defaultAddress?.districtId,
    upazila: defaultAddress?.upazila || '',
    upazilaId: defaultAddress?.upazilaId,
    unionOrWard: defaultAddress?.unionOrWard || '',
    unionId: defaultAddress?.unionId,
    locality: defaultAddress?.locality || '',
    house: defaultAddress?.house || '',
    road: defaultAddress?.road || '',
    postalCode: defaultAddress?.postalCode || '',
    streetAddress: defaultAddress?.streetAddress || '',
    deliveryInstructions: defaultAddress?.deliveryInstructions || '',
  });

  // Payment Method selection & live verification modal state
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'card' | 'bkash' | 'nagad'>('cod');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Coupon state
  const [couponInput, setCouponInput] = useState(appliedCoupon?.code || '');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Stable idempotency key per checkout cart snapshot
  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());
  const checkoutSignature = `${checkoutItems
    .map((i) => `${i.id}:${i.quantity}`)
    .join(',')}|${appliedCoupon?.code || ''}`;
  useEffect(() => {
    idempotencyKeyRef.current = createIdempotencyKey();
  }, [checkoutSignature]);

  // Fetch latest store settings & customer address book on mount
  useEffect(() => {
    apiRequest('/cms/config').then((res) => {
      if (res.success && res.config?.settings) {
        setStoreSettings(res.config.settings);
      }
    });

    if (isAuthenticated) {
      apiRequest('/auth/addresses').then((res) => {
        if (res.success && Array.isArray(res.addresses)) {
          dispatch(updateAddresses(res.addresses));
        }
      });
    }
  }, [isAuthenticated, dispatch]);

  // Keep email and default address synced when user data updates
  useEffect(() => {
    if (user?.email && !emailAddress) {
      setEmailAddress(user.email);
    }
    if (defaultAddress && selectedAddressMode !== 'new' && !addressData.division) {
      setAddressData({
        recipientName: defaultAddress.recipientName,
        phone: defaultAddress.phone,
        division: defaultAddress.division,
        divisionId: defaultAddress.divisionId,
        district: defaultAddress.district,
        districtId: defaultAddress.districtId,
        upazila: defaultAddress.upazila,
        upazilaId: defaultAddress.upazilaId,
        unionOrWard: defaultAddress.unionOrWard || '',
        unionId: defaultAddress.unionId,
        locality: defaultAddress.locality || '',
        house: defaultAddress.house || '',
        road: defaultAddress.road || '',
        postalCode: defaultAddress.postalCode || '',
        streetAddress: defaultAddress.streetAddress,
        deliveryInstructions: defaultAddress.deliveryInstructions || '',
      });
      setSelectedAddressMode(defaultAddress._id || defaultAddress.id || 'default');
    }
  }, [user]);

  // Auto-switch to first enabled payment method when settings disable current selection
  const enabledMethods = storeSettings?.paymentMethods || {
    cod: true,
    bkash: true,
    nagad: true,
    card: true,
  };
  useEffect(() => {
    const order: ('cod' | 'card' | 'bkash' | 'nagad')[] = ['cod', 'bkash', 'nagad', 'card'];
    if (enabledMethods[paymentMethod] === false) {
      const next = order.find((m) => enabledMethods[m] !== false);
      if (next) setPaymentMethod(next);
    }
  }, [enabledMethods.cod, enabledMethods.bkash, enabledMethods.nagad, enabledMethods.card, paymentMethod]);

  const handleSelectSavedAddress = (addrId: string) => {
    setSelectedAddressMode(addrId);
    if (addrId === 'new') {
      setAddressData({
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
    } else {
      const match = savedAddresses.find((a) => (a._id || a.id) === addrId);
      if (match) {
        setAddressData({
          recipientName: match.recipientName,
          phone: match.phone,
          division: match.division,
          divisionId: match.divisionId,
          district: match.district,
          districtId: match.districtId,
          upazila: match.upazila,
          upazilaId: match.upazilaId,
          unionOrWard: match.unionOrWard || '',
          unionId: match.unionId,
          locality: match.locality || '',
          house: match.house || '',
          road: match.road || '',
          postalCode: match.postalCode || '',
          streetAddress: match.streetAddress,
          deliveryInstructions: match.deliveryInstructions || '',
        });
      }
    }
  };

  // Financial calculations driven cleanly by selected items + StoreSettings + shipping region
  const checkoutSubtotal = useAppSelector(selectSelectedCartSubtotal);
  const discount = useAppSelector(selectSelectedCartDiscount);
  const shippingFee = useAppSelector((state) =>
    selectSelectedCartShippingFee(
      state,
      addressData.division || 'Dhaka',
      addressData.divisionId,
      storeSettings
    )
  );
  const taxAmount = useAppSelector((state) => selectSelectedCartTax(state, storeSettings));
  const totalAmount = useAppSelector((state) =>
    selectSelectedCartTotal(
      state,
      addressData.division || 'Dhaka',
      addressData.divisionId,
      storeSettings
    )
  );
  const freeThreshold = storeSettings?.freeShippingThreshold ?? 1000;

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    if (checkoutSubtotal <= 0) {
      setCouponError('Add items before applying a coupon.');
      return;
    }
    setCouponError('');
    setIsApplyingCoupon(true);
    const res = await apiRequest('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal: checkoutSubtotal }),
    });
    setIsApplyingCoupon(false);

    if (res.success && res.coupon) {
      dispatch(applyCoupon(res.coupon));
      setCouponInput(res.coupon.code);
      dispatch(
        addToast({
          type: 'success',
          title: 'Coupon Applied',
          message: `${res.coupon.code} unlocked a ৳${res.coupon.discount.toLocaleString()} discount!`,
        })
      );
    } else {
      setCouponError(res.message || 'Invalid or expired coupon code.');
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (checkoutItems.length === 0) {
      dispatch(
        addToast({
          type: 'warning',
          title: 'No Items Selected',
          message: 'Please select items in your cart before placing an order.',
        })
      );
      return;
    }

    if (enabledMethods[paymentMethod] === false) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Payment Method Disabled',
          message: 'The selected payment method is currently unavailable.',
        })
      );
      return;
    }

    const cleanPhone = addressData.phone.replace(/[\s()-]/g, '').trim();
    if (!addressData.recipientName.trim() || addressData.recipientName.trim().length < 2) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Invalid Recipient Name',
          message: 'Please enter the recipient full name (at least 2 characters).',
        })
      );
      return;
    }

    if (!BD_PHONE_PATTERN.test(cleanPhone)) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Invalid Bangladesh Phone',
          message: 'Please enter a valid 11-digit BD mobile number (e.g. 01712345678).',
        })
      );
      return;
    }

    if (addressData.postalCode?.trim() && !BD_POSTAL_PATTERN.test(addressData.postalCode.trim())) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Invalid Postal Code',
          message: 'Bangladesh postal codes must be exactly 4 digits.',
        })
      );
      return;
    }

    if (!addressData.division.trim() || !addressData.district.trim() || !addressData.upazila.trim()) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Incomplete Location Hierarchy',
          message: 'Please select Division, District, and Upazila using the Bangladesh location selector.',
        })
      );
      return;
    }

    if (addressData.upazilaId) {
      const unions = getUnions(addressData.upazilaId) || [];
      if (unions.length > 0 && !addressData.unionId && !addressData.unionOrWard?.trim()) {
        dispatch(
          addToast({
            type: 'error',
            title: 'Union / Ward Required',
            message: `Please select a Union / Ward for ${addressData.upazila}.`,
          })
        );
        return;
      }
    }

    if (!addressData.streetAddress.trim() || addressData.streetAddress.trim().length < 3) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Missing Street Address',
          message: 'Please enter a detailed street address for courier dispatch.',
        })
      );
      return;
    }

    const cleanEmail = (emailAddress.trim() || user?.email || '').trim();
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Invalid Email Address',
          message: 'Please enter a valid email address for order receipts and updates.',
        })
      );
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Pre-submit server validation for live availability, variant/parent stock, pricing & coupon eligibility
      const validateRes = await apiRequest('/cart/validate', {
        method: 'POST',
        body: JSON.stringify({
          items: checkoutItems.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            name: i.name,
            quantity: i.quantity,
            options: i.options,
            selected: true,
          })),
          division: addressData.division,
          divisionId: addressData.divisionId,
          couponCode: appliedCoupon?.code,
        }),
      });

      if (!validateRes.success || !Array.isArray(validateRes.items)) {
        dispatch(
          addToast({
            type: 'error',
            title: 'Cart Verification Failed',
            message: validateRes.message || 'Unable to verify item availability right now.',
          })
        );
        return;
      }

      if (appliedCoupon && !validateRes.coupon) {
        dispatch(removeCoupon());
      }

      const unselectedItems = cartItems.filter((i) => i.selected === false);
      const validatedMerged = validateRes.items.map((srv: any) => {
        const prev = checkoutItems.find(
          (c) => c.productId === srv.productId && (c.variantId || '') === (srv.variantId || '')
        );
        return {
          id: srv.id,
          productId: srv.productId,
          variantId: srv.variantId,
          name: srv.name,
          subtitle: prev?.subtitle,
          sku: srv.sku,
          price: srv.price,
          originalPrice: srv.originalPrice,
          quantity: srv.quantity,
          image: srv.image || prev?.image || '',
          options: srv.options || prev?.options,
          stock: srv.stock,
          selected: true,
        };
      });

      const cartChanged =
        validatedMerged.length !== checkoutItems.length ||
        validatedMerged.some((m: any) => {
          const prev = checkoutItems.find(
            (c) => c.productId === m.productId && (c.variantId || '') === (m.variantId || '')
          );
          return !prev || m.quantity !== prev.quantity || m.price !== prev.price;
        });

      if (cartChanged) {
        dispatch(hydrateCartItems([...validatedMerged, ...unselectedItems]));
      }

      if ((Array.isArray(validateRes.errors) && validateRes.errors.length > 0) || cartChanged || validatedMerged.length === 0) {
        dispatch(
          addToast({
            type: 'error',
            title: 'Order Review Needed',
            message:
              validateRes.errors?.[0] ||
              'Item availability or prices changed since you opened checkout. Your cart has been synced — please review and submit again.',
          })
        );
        return;
      }

      const orderPayload = {
        items: checkoutItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          sku: item.sku || '',
          quantity: item.quantity,
          options: item.options,
          image: item.image,
        })),
        shippingAddress: {
          recipientName: addressData.recipientName.trim(),
          phone: cleanPhone,
          division: addressData.division,
          divisionId: addressData.divisionId,
          district: addressData.district,
          districtId: addressData.districtId,
          upazila: addressData.upazila,
          upazilaId: addressData.upazilaId,
          unionOrWard: addressData.unionOrWard || '',
          unionId: addressData.unionId,
          locality: addressData.locality || '',
          house: addressData.house || '',
          road: addressData.road || '',
          postalCode: addressData.postalCode?.trim() || '',
          streetAddress: addressData.streetAddress.trim(),
          deliveryInstructions: addressData.deliveryInstructions || '',
          country: 'Bangladesh',
        },
        paymentMethod,
        couponCode: appliedCoupon?.code,
        customerEmail: cleanEmail,
        customerName: addressData.recipientName.trim(),
        saveAddressToAccount,
        idempotencyKey: idempotencyKeyRef.current,
      };

      const res = await apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify(orderPayload),
      });

      if (res.success && res.order) {
        const token = res.receiptToken || '';
        if (token) {
          try {
            sessionStorage.setItem(`order_receipt_${res.order._id}`, token);
          } catch {
            // ignore storage errors
          }
        }

        dispatch(removePurchasedItems(checkoutItems.map((i) => i.id)));
        if (res.userAddresses) {
          dispatch(updateAddresses(res.userAddresses));
        }

        idempotencyKeyRef.current = createIdempotencyKey();

        if (res.order.paymentMethod !== 'cod' && res.order.paymentStatus !== 'paid') {
          dispatch(
            addToast({
              type: 'info',
              title: 'Order Reserved — Connecting to Payment Gateway',
              message: `Initiating secure ${res.order.paymentMethod.toUpperCase()} merchant session...`,
            })
          );

          try {
            const initRes = await apiRequest('/payments/initiate', {
              method: 'POST',
              body: JSON.stringify({
                orderId: res.order._id,
                paymentMethod: res.order.paymentMethod,
                receiptToken: token,
              }),
            });

            if (initRes.success && initRes.gatewayUrl) {
              dispatch(
                addToast({
                  type: 'info',
                  title: 'Redirecting to Gateway',
                  message: `Connecting to ${initRes.paymentProvider} secure hosted checkout...`,
                })
              );
              window.location.href = initRes.gatewayUrl;
              return;
            } else if (!initRes.success && initRes.error) {
              dispatch(
                addToast({
                  type: 'warning',
                  title: 'Gateway Notice',
                  message: initRes.error,
                })
              );
            }
          } catch (initErr: any) {
            console.error('Payment initiation error:', initErr);
          }

          navigate(
            `/order-success?orderId=${res.order._id}${token ? `&token=${encodeURIComponent(token)}` : ''}&paymentStatus=pending`,
            {
              state: {
                order: res.order,
                receiptToken: token,
              },
            }
          );
        } else {
          dispatch(
            addToast({
              type: 'success',
              title: 'Order Placed (Cash on Delivery)',
              message: `Order #${res.order.orderNumber} confirmed. Payment will be collected upon delivery.`,
            })
          );
          navigate(
            `/order-success?orderId=${res.order._id}${token ? `&token=${encodeURIComponent(token)}` : ''}`,
            {
              state: {
                order: res.order,
                receiptToken: token,
              },
            }
          );
        }
      } else {
        dispatch(
          addToast({
            type: 'error',
            title: 'Order Placement Failed',
            message: res.message || 'Unable to place order. Please review your details.',
          })
        );
      }
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Order Error',
          message: err.message || 'An unexpected error occurred while placing your order.',
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const anyPaymentEnabled =
    enabledMethods.cod !== false ||
    enabledMethods.card !== false ||
    enabledMethods.bkash !== false ||
    enabledMethods.nagad !== false;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-20">
      {/* 1. Dynamic Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#032d69] via-[#0b48a3] to-[#1264df] text-white py-12 sm:py-16">
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-400 blur-3xl"></div>
          <div className="absolute top-1/2 right-10 w-96 h-96 rounded-full bg-cyan-300 blur-3xl"></div>
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 1200 300">
            <path d="M0,150 C300,250 800,50 1200,180 L1200,300 L0,300 Z" fill="rgba(255,255,255,0.06)" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-6 sm:px-12 relative z-0 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl text-center md:text-left">
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">Checkout</h1>
            <p className="text-base sm:text-lg text-blue-100 font-normal mt-2 leading-relaxed">
              Complete your order securely and quickly.
            </p>
          </div>

          <div className="relative shrink-0 flex items-center justify-center">
            <div className="relative w-64 sm:w-80 h-44 flex items-center justify-center">
              <div className="absolute -bottom-2 inset-x-8 h-10 bg-gradient-to-r from-blue-700 to-blue-500 rounded-full blur-xs opacity-70 transform rotate-1"></div>
              <div className="relative z-20 w-20 h-24 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-2xl shadow-2xl border-2 border-white flex items-center justify-center">
                <ShieldCheck className="w-12 h-12 text-white stroke-[2.5]" />
              </div>
              <div className="relative z-30 w-28 h-18 bg-gradient-to-r from-slate-100 to-white rounded-xl shadow-2xl border border-slate-200 -ml-4 -mt-8 transform rotate-6 p-2.5 flex flex-col justify-between">
                <div className="w-4 h-3 bg-amber-400 rounded-xs"></div>
                <div className="space-y-1">
                  <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
                  <div className="w-8 h-1 bg-slate-200 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {checkoutItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
            <ShoppingCart className="w-12 h-12 text-blue-600 mx-auto" />
            <h2 className="text-xl font-black text-slate-900">No Selected Items Ready for Checkout</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {cartItems.length > 0
                ? 'You have items in your cart that are currently unchecked. Select items in your cart to proceed.'
                : 'Your shopping bag is currently empty. Explore our catalog to add products.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              {cartItems.length > 0 && (
                <Link
                  to="/cart"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Review Cart ({cartItems.length})
                </Link>
              )}
              <Link
                to="/shop"
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Browse Products
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6">
              {/* Step 1: Billing & Shipping Information */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center">
                      1
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                        Billing & Shipping Destination
                      </h2>
                      <p className="text-xs text-slate-500">Official Bangladesh Administrative Hierarchy</p>
                    </div>
                  </div>

                  {savedAddresses.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      <span>
                        {savedAddresses.length} Saved Address{savedAddresses.length > 1 ? 'es' : ''}
                      </span>
                    </span>
                  )}
                </div>

                {savedAddresses.length > 0 && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Select a Delivery Destination:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedAddresses.map((addr) => {
                        const addrId = addr._id || addr.id || 'default';
                        const isSelected = selectedAddressMode === addrId;
                        return (
                          <div
                            key={addrId}
                            onClick={() => handleSelectSavedAddress(addrId)}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900">{addr.label || 'Home'}</span>
                                {addr.isDefault && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white uppercase">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            </div>
                            <p className="text-xs font-bold text-slate-800">
                              {addr.recipientName} ({addr.phone})
                            </p>
                            <p className="text-xs text-slate-600 truncate mt-0.5">{addr.streetAddress}</p>
                            <p className="text-[11px] text-slate-500 font-medium mt-1">
                              {addr.unionOrWard ? `${addr.unionOrWard}, ` : ''}
                              {addr.upazila}, {addr.district}, {addr.division}
                            </p>
                          </div>
                        );
                      })}

                      <div
                        onClick={() => handleSelectSavedAddress('new')}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                          selectedAddressMode === 'new'
                            ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                            : 'border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/60'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            selectedAddressMode === 'new' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          <PlusCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Deliver to a New Destination</p>
                          <p className="text-[11px] text-slate-500">Enter a different Bangladesh address</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email Address (for order receipts & updates) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      placeholder="customer@example.com"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <BangladeshAddressSelector
                    value={addressData}
                    onChange={setAddressData}
                    showRecipientFields={true}
                    disabled={isSubmitting}
                  />
                </div>

                {isAuthenticated && (
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveAddressCheckbox"
                      checked={saveAddressToAccount}
                      onChange={(e) => setSaveAddressToAccount(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <label
                      htmlFor="saveAddressCheckbox"
                      className="text-xs font-bold text-slate-700 cursor-pointer select-none"
                    >
                      Save this delivery destination to my account for future orders
                    </label>
                  </div>
                )}
              </div>

              {/* Step 2: Payment Method */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center">
                    2
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Payment Method</h2>
                </div>

                {!anyPaymentEnabled && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                    All checkout payment gateways are currently paused by store administrators.
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {enabledMethods.cod !== false && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cod')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between h-28 relative cursor-pointer ${
                        paymentMethod === 'cod'
                          ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            paymentMethod === 'cod' ? 'border-blue-600 bg-white' : 'border-slate-300'
                          }`}
                        >
                          {paymentMethod === 'cod' && <div className="w-2 h-2 rounded-full bg-blue-600"></div>}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                          <Banknote className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">Cash on Delivery</h4>
                        <p className="text-[10px] text-blue-600 font-medium mt-0.5">Pay when you receive</p>
                      </div>
                    </button>
                  )}

                  {enabledMethods.card !== false && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between h-28 relative cursor-pointer ${
                        paymentMethod === 'card'
                          ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            paymentMethod === 'card' ? 'border-blue-600 bg-white' : 'border-slate-300'
                          }`}
                        >
                          {paymentMethod === 'card' && <div className="w-2 h-2 rounded-full bg-blue-600"></div>}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center shadow-xs">
                          <CreditCard className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">Credit / Debit Card</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Verify Gateway TxID</p>
                      </div>
                    </button>
                  )}

                  {enabledMethods.bkash !== false && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bkash')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between h-28 relative cursor-pointer ${
                        paymentMethod === 'bkash'
                          ? 'border-rose-500 bg-rose-50/40 ring-2 ring-rose-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            paymentMethod === 'bkash' ? 'border-rose-500 bg-white' : 'border-slate-300'
                          }`}
                        >
                          {paymentMethod === 'bkash' && <div className="w-2 h-2 rounded-full bg-rose-600"></div>}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-pink-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                          bK
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">bKash</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Pay with bKash</p>
                      </div>
                    </button>
                  )}

                  {enabledMethods.nagad !== false && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('nagad')}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between h-28 relative cursor-pointer ${
                        paymentMethod === 'nagad'
                          ? 'border-orange-500 bg-orange-50/40 ring-2 ring-orange-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            paymentMethod === 'nagad' ? 'border-orange-500 bg-white' : 'border-slate-300'
                          }`}
                        >
                          {paymentMethod === 'nagad' && <div className="w-2 h-2 rounded-full bg-orange-600"></div>}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-black text-xs shadow-xs">
                          Ng
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">Nagad</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Pay with Nagad</p>
                      </div>
                    </button>
                  )}
                </div>

                <div className="mt-4 p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Server-Verified Pricing & Encrypted Checkout
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Final totals, coupons, and stock reservations are validated authoritatively on our server.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Order Summary */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5 sticky top-24">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">Your Order Summary</h2>
                  </div>
                  <span className="text-xs font-bold text-slate-500">{checkoutItems.length} item(s)</span>
                </div>

                {/* Itemized Selected List */}
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
                  {checkoutItems.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{item.name}</h4>
                          {item.options && Object.keys(item.options).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {Object.entries(item.options).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-600"
                                >
                                  {k}: {v}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-extrabold text-sm text-slate-900 tabular-nums">
                          ৳{item.price.toLocaleString()}
                        </span>

                        <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity - 1 }))}
                            className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-bold text-slate-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity + 1 }))}
                            disabled={item.quantity >= item.stock}
                            className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => dispatch(removeFromCart(item.id))}
                          className="text-rose-500 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coupon Apply / Remove UI */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                      <div className="flex items-center gap-2 font-bold text-emerald-800">
                        <Tag className="w-3.5 h-3.5" />
                        <span>{appliedCoupon.code}</span>
                        <span className="text-emerald-600 font-semibold">
                          (-৳{discount.toLocaleString()})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          dispatch(removeCoupon());
                          setCouponInput('');
                          setCouponError('');
                        }}
                        className="text-slate-500 hover:text-rose-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value.toUpperCase());
                          if (couponError) setCouponError('');
                        }}
                        placeholder="Promo coupon code"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        {isApplyingCoupon ? '...' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {couponError && <p className="text-[11px] font-semibold text-rose-600">{couponError}</p>}
                </div>

                {/* Order Calculations */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      ৳{checkoutSubtotal.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      Shipping Fee
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {shippingFee === 0 ? 'FREE' : `৳${shippingFee.toLocaleString()}`}
                    </span>
                  </div>

                  {discount > 0 && (
                    <div className="flex items-center justify-between text-emerald-600">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Tag className="w-3.5 h-3.5" />
                        Discount {appliedCoupon?.code ? `(${appliedCoupon.code})` : ''}
                      </span>
                      <span className="font-bold tabular-nums">-৳{discount.toLocaleString()}</span>
                    </div>
                  )}

                  {taxAmount > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>VAT / Tax ({storeSettings?.taxRate ?? 0}%)</span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        ৳{taxAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-base">Total Amount</span>
                    <span className="font-black text-2xl text-slate-900 tabular-nums">
                      ৳{totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || checkoutItems.length === 0 || !anyPaymentEnabled}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Processing Order...'
                      : paymentMethod === 'cod'
                      ? 'Place Order'
                      : `Place Order & Pay via ${paymentMethod.toUpperCase()}`}
                  </span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Bottom 4 Trust Badges */}
        <section className="mt-14 pt-8 border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-white transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">100% Secure Payment</h4>
                <p className="text-xs text-slate-500 mt-0.5">Your data is safe</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-white transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Truck className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Free Shipping</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {freeThreshold > 0 ? `On Orders Over ৳${freeThreshold.toLocaleString()}` : 'Storewide Offer'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-white transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Headphones className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">24/7 Customer Support</h4>
                <p className="text-xs text-slate-500 mt-0.5">Always here to help</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-white transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">30 Days Easy Return</h4>
                <p className="text-xs text-slate-500 mt-0.5">Hassle-free policy</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
