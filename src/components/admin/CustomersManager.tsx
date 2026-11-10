import React, { useState } from 'react';
import { User } from '../../types';
import {
  Users,
  Search,
  Eye,
  ShieldCheck,
  Mail,
  Phone,
  Filter,
  CheckCircle2,
  Clock,
  Ban,
  Check,
  RefreshCw,
} from 'lucide-react';
import { CustomerDetailsDrawer } from './drawers/CustomerDetailsDrawer';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';

interface CustomersManagerProps {
  customers: User[];
  onRefresh: () => void;
}

export const CustomersManager: React.FC<CustomersManagerProps> = ({ customers, onRefresh }) => {
  const dispatch = useAppDispatch();
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'google' | 'facebook' | 'email'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Compute metrics
  const totalCount = customers.length;
  const googleCount = customers.filter(
    (c) => (c.providers && c.providers.includes('google')) || !!c.googleId
  ).length;
  const facebookCount = customers.filter(
    (c) => (c.providers && c.providers.includes('facebook')) || !!c.facebookId
  ).length;
  const emailCount = customers.filter(
    (c) =>
      (!c.providers || c.providers.includes('email') || c.providers.length === 0) &&
      !c.googleId &&
      !c.facebookId
  ).length;

  const filtered = customers.filter((c: any) => {
    // Search query
    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      (c.phone && c.phone.includes(query));

    if (!matchesSearch) return false;

    // Provider filter
    const isGoogle = (c.providers && c.providers.includes('google')) || !!c.googleId;
    const isFacebook = (c.providers && c.providers.includes('facebook')) || !!c.facebookId;

    if (providerFilter === 'google' && !isGoogle) return false;
    if (providerFilter === 'facebook' && !isFacebook) return false;
    if (providerFilter === 'email' && (isGoogle || isFacebook)) return false;

    // Status filter
    const isActive = c.isActive !== false;
    if (statusFilter === 'active' && !isActive) return false;
    if (statusFilter === 'suspended' && isActive) return false;

    return true;
  });

  const handleToggleStatus = async (customer: any) => {
    const customerId = customer._id || customer.id;
    if (!customerId) return;
    const nextStatus = customer.isActive === false; // toggle
    setUpdatingId(customerId);

    try {
      const res = await apiRequest(`/admin/customers/${customerId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus }),
      });

      setUpdatingId(null);
      if (res.success) {
        dispatch(
          addToast({
            type: 'success',
            title: nextStatus ? 'Account Activated' : 'Account Suspended',
            message: `${customer.name}'s account status has been updated.`,
          })
        );
        onRefresh();
      } else {
        dispatch(addToast({ type: 'error', title: 'Action Failed', message: res.message || 'Status update error.' }));
      }
    } catch (err: any) {
      setUpdatingId(null);
      dispatch(addToast({ type: 'error', title: 'Network Error', message: err.message }));
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Quick Stats Cards for User Base */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Customers
            </span>
            <span className="text-2xl font-black text-slate-900 tabular-nums">{totalCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
              Google Verified
            </span>
            <span className="text-2xl font-black text-slate-900 tabular-nums">{googleCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-sm">
            G
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
              Facebook Accounts
            </span>
            <span className="text-2xl font-black text-slate-900 tabular-nums">{facebookCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">
            f
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Email / Password
            </span>
            <span className="text-2xl font-black text-slate-900 tabular-nums">{emailCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Customer Directory Container */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Registered Shopper Accounts</h2>
              <p className="text-xs text-slate-500">
                Audited identity records, OAuth providers, and order activity in MongoDB Atlas.
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 uppercase mr-1">
              <Filter className="w-3 h-3" /> Auth:
            </span>
            <button
              onClick={() => setProviderFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                providerFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setProviderFilter('google')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                providerFilter === 'google'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Google ({googleCount})
            </button>
            <button
              onClick={() => setProviderFilter('facebook')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                providerFilter === 'facebook'
                  ? 'bg-blue-700 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              Facebook ({facebookCount})
            </button>
            <button
              onClick={() => setProviderFilter('email')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                providerFilter === 'email'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Email ({emailCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Customer Profile</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Auth Provider</th>
                <th className="p-3">Registered / Last Login</th>
                <th className="p-3">Orders & Value</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No customer accounts match your current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((c: any) => {
                  const isGoogle = (c.providers && c.providers.includes('google')) || !!c.googleId;
                  const isFacebook = (c.providers && c.providers.includes('facebook')) || !!c.facebookId;
                  const isActive = c.isActive !== false;
                  const regDate = c.createdAt
                    ? new Date(c.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Earlier';
                  const lastLogin = c.lastLoginAt
                    ? new Date(c.lastLoginAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A';

                  return (
                    <tr key={c._id || c.id} className="hover:bg-slate-50/60 transition">
                      {/* 1. Customer Name & Avatar */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          {c.avatar ? (
                            <img
                              src={c.avatar}
                              alt={c.name}
                              className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-600/20 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-700 to-blue-500 text-white font-black flex items-center justify-center shrink-0 shadow-2xs">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900">{c.name}</p>
                              {c.emailVerified && (
                                <span title="Verified Account">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {String(c._id || c.id).slice(-8)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Contact */}
                      <td className="p-3">
                        <p className="text-slate-800 font-medium truncate max-w-[180px]">{c.email}</p>
                        <p className="text-slate-400 text-[10px]">{c.phone || 'No phone set'}</p>
                      </td>

                      {/* 3. Provider Badges */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {isGoogle && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Google
                            </span>
                          )}
                          {isFacebook && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                              Facebook
                            </span>
                          )}
                          {!isGoogle && !isFacebook && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                              Email
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Timestamps */}
                      <td className="p-3">
                        <p className="text-slate-800 font-medium">{regDate}</p>
                        <p className="text-slate-400 text-[10px]">Active: {lastLogin}</p>
                      </td>

                      {/* 5. Orders & Spent */}
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{c.orderCount || 0} orders</p>
                        <p className="font-bold text-blue-700 tabular-nums">৳ {(c.totalSpent || 0).toLocaleString()}</p>
                      </td>

                      {/* 6. Status */}
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>

                      {/* 7. Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(c)}
                            disabled={updatingId === (c._id || c.id)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              isActive
                                ? 'text-rose-600 hover:bg-rose-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={isActive ? 'Suspend customer' : 'Reactivate customer'}
                          >
                            {updatingId === (c._id || c.id) ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : isActive ? (
                              <Ban className="w-3.5 h-3.5" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(c)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Inspect full profile and order history"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Customer Profile Drawer */}
        <CustomerDetailsDrawer
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          customer={selectedCustomer}
          onCustomerUpdated={onRefresh}
        />
      </div>
    </div>
  );
};
