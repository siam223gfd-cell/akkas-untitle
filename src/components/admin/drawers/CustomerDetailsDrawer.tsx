import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { AdminDrawer } from '../common/modal';
import {
  Users,
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  CreditCard,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Clock,
  ExternalLink,
  Ban,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useAppDispatch } from '../../../app/hooks';
import { addToast } from '../../../features/ui/uiSlice';
import { apiRequest } from '../../../services/api';

interface CustomerDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customer: (User & { orderCount?: number; totalSpent?: number; isActive?: boolean; _id?: string }) | null;
  onCustomerUpdated?: () => void;
}

export const CustomerDetailsDrawer: React.FC<CustomerDetailsDrawerProps> = ({
  isOpen,
  onClose,
  customer,
  onCustomerUpdated,
}) => {
  const dispatch = useAppDispatch();
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const customerId = customer?._id || customer?.id;

  useEffect(() => {
    if (isOpen && customerId) {
      setLoadingOrders(true);
      apiRequest(`/admin/customers/${customerId}/orders`)
        .then((res) => {
          if (res.success) {
            setOrders(res.orders || []);
          }
        })
        .catch((err) => console.error('Failed to fetch customer orders:', err))
        .finally(() => setLoadingOrders(false));
    } else {
      setOrders([]);
    }
  }, [isOpen, customerId]);

  if (!customer) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    dispatch(
      addToast({
        type: 'info',
        title: 'Copied to Clipboard',
        message: `${label} copied.`,
      })
    );
  };

  const handleToggleStatus = async () => {
    if (!customerId) return;
    const newStatus = customer.isActive === false; // If false, new is true
    setTogglingStatus(true);
    try {
      const res = await apiRequest(`/admin/customers/${customerId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      setTogglingStatus(false);

      if (res.success) {
        dispatch(
          addToast({
            type: 'success',
            title: newStatus ? 'Account Activated' : 'Account Suspended',
            message: `Customer account has been ${newStatus ? 'activated' : 'suspended'}.`,
          })
        );
        if (onCustomerUpdated) onCustomerUpdated();
        onClose();
      } else {
        dispatch(
          addToast({
            type: 'error',
            title: 'Update Failed',
            message: res.message || 'Could not update customer account status.',
          })
        );
      }
    } catch (err: any) {
      setTogglingStatus(false);
      dispatch(
        addToast({
          type: 'error',
          title: 'Request Error',
          message: err.message || 'Failed to toggle account status.',
        })
      );
    }
  };

  const memberSince = customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Verified Shopper';

  const isActive = customer.isActive !== false;

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="lg"
      icon={<Users className="w-5 h-5" />}
      title={customer.name}
      subtitle={`Member since ${memberSince}`}
      badge={
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
            isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          {isActive ? 'Active Shopper' : 'Suspended'}
        </span>
      }
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              isActive
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}
          >
            {togglingStatus ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : isActive ? (
              <Ban className="w-3.5 h-3.5" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>{isActive ? 'Suspend Customer' : 'Activate Customer'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* 1. Customer Overview Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-950 text-white space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/50 border border-blue-400/40 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black truncate">{customer.name}</h3>
              <p className="text-xs text-blue-200 truncate">{customer.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs">
              <span className="text-[10px] uppercase tracking-wider text-blue-200 block font-semibold">
                Total Orders
              </span>
              <span className="text-base font-black tabular-nums">
                {customer.orderCount ?? orders.length}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs">
              <span className="text-[10px] uppercase tracking-wider text-blue-200 block font-semibold">
                Lifetime Spent
              </span>
              <span className="text-base font-black tabular-nums">
                ৳ {(customer.totalSpent || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Contact Details Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>Contact Information</span>
          </h4>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/80">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Email
                </span>
                <span className="font-bold text-slate-900 truncate block">
                  {customer.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(customer.email, 'Email address')}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                title="Copy email"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/80">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Phone
                </span>
                <span className="font-bold text-slate-900 truncate block">
                  {customer.phone || 'No phone number provided'}
                </span>
              </div>
              {customer.phone && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(customer.phone!, 'Phone number')}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Copy phone"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2.5. Authentication & OAuth Identity */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Authentication & Identity</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              MongoDB ID: {String(customerId).slice(-8)}
            </span>
          </h4>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Auth Providers</span>
              <div className="flex items-center gap-1.5">
                {(customer.providers || ['email']).map((p: string) => {
                  if (p === 'google' || customer.googleId) {
                    return (
                      <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Google OAuth
                      </span>
                    );
                  }
                  if (p === 'facebook' || customer.facebookId) {
                    return (
                      <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        Facebook OAuth
                      </span>
                    );
                  }
                  return (
                    <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                      Email / Password
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Email Verification</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                customer.emailVerified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {customer.emailVerified ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-slate-400" />}
                {customer.emailVerified ? 'Verified Account' : 'Standard Unverified'}
              </span>
            </div>

            {customer.lastLoginAt && (
              <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Last Active Session</span>
                <span className="font-mono text-slate-700 text-[11px]">
                  {new Date(customer.lastLoginAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Customer Order History */}
        <div className="space-y-2 text-xs">
          <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-purple-600" />
              <span>Order History</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
              {orders.length} Orders
            </span>
          </h4>

          {loadingOrders ? (
            <div className="p-4 rounded-xl border border-slate-200 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Loading purchase history...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
              No previous orders found for this customer.
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((ord: any) => (
                <div
                  key={ord._id || ord.id}
                  className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-2xs hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">
                      {ord.orderNumber || String(ord._id || ord.id).slice(-8)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        ord.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ord.status === 'cancelled'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>
                      {new Date(ord.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="font-bold text-slate-900">
                      ৳ {(ord.pricing?.total || ord.total || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Delivery Addresses */}
        <div className="space-y-2 text-xs">
          <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Saved Addresses</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
              {customer.addresses?.length || 0}
            </span>
          </h4>

          {!customer.addresses || customer.addresses.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
              No saved addresses on file.
            </div>
          ) : (
            <div className="space-y-2">
              {customer.addresses.map((addr: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      {addr.recipientName || customer.name}
                    </span>
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    {addr.streetAddress}, {addr.upazila}, {addr.district}, {addr.division}
                  </p>
                  {addr.phone && (
                    <p className="text-[10px] text-slate-400 font-mono">
                      Recipient Phone: {addr.phone}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminDrawer>
  );
};
