import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import {
  UserCheck,
  Plus,
  ShieldCheck,
  Mail,
  Phone,
  Lock,
  Shield,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  UserX,
  Key,
} from 'lucide-react';
import { AdminModal, ConfirmDialog } from './common/modal';
import { ImageUploadInput } from '../common/ImageUploadInput';
import { apiRequest } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';

const ROLE_DEFINITIONS: Record<string, { label: string; color: string; desc: string }> = {
  super_admin: {
    label: 'Super Admin',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    desc: 'Full system ownership, staff management, backups, and configurations.',
  },
  admin: {
    label: 'Admin',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    desc: 'Storewide operations, catalog editing, orders, and customer management.',
  },
  order_manager: {
    label: 'Order Manager',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    desc: 'Order processing, fulfillment workflows, and courier tracking.',
  },
  catalog_manager: {
    label: 'Catalog Manager',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    desc: 'Product additions, pricing updates, categories, and inventory.',
  },
  customer_support: {
    label: 'Customer Support',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    desc: 'Review moderation, customer enquiries, and shopper communication.',
  },
  finance: {
    label: 'Finance Officer',
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    desc: 'Revenue analytics, payment reconciliation, and financial auditing.',
  },
  inventory_manager: {
    label: 'Inventory Manager',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    desc: 'Warehouse stock control, SKU thresholds, and variant quantities.',
  },
};

export const StaffManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);

  const [staffList, setStaffList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    phone: '',
    avatar: '',
  });

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    isConfirming: boolean;
  }>({
    isOpen: false,
    id: '',
    name: '',
    isConfirming: false,
  });

  const fetchStaff = async () => {
    setIsLoading(true);
    const query = new URLSearchParams();
    if (searchQuery) query.set('search', searchQuery);
    if (roleFilter !== 'all') query.set('role', roleFilter);

    const res = await apiRequest(`/admin/staff?${query.toString()}`);
    setIsLoading(false);
    if (res.success && res.staff) {
      setStaffList(res.staff);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [roleFilter]);

  const handleOpenCreate = () => {
    setEditingStaff(null);
    setForm({
      name: '',
      email: '',
      password: '',
      role: 'admin',
      phone: '',
      avatar: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff: User) => {
    setEditingStaff(staff);
    setForm({
      name: staff.name,
      email: staff.email,
      password: '',
      role: staff.role,
      phone: staff.phone || '',
      avatar: staff.avatar || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let res;
    if (editingStaff) {
      const payload: any = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        phone: form.phone.trim(),
        avatar: form.avatar,
      };
      if (form.password && form.password.trim().length >= 6) {
        payload.password = form.password.trim();
      }
      res = await apiRequest(`/admin/staff/${editingStaff.id || editingStaff._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      res = await apiRequest('/admin/staff', {
        method: 'POST',
        body: JSON.stringify(form),
      });
    }

    setIsSubmitting(false);

    if (res.success) {
      setIsModalOpen(false);
      setEditingStaff(null);
      fetchStaff();
      dispatch(
        addToast({
          type: 'success',
          title: editingStaff ? 'Staff Account Updated' : 'Staff Member Created',
          message: `${form.name}'s credentials and role permissions have been saved.`,
        })
      );
    } else {
      dispatch(
        addToast({
          type: 'error',
          title: 'Operation Failed',
          message: res.message || 'Could not save staff member.',
        })
      );
    }
  };

  const handleToggleStatus = async (staff: User) => {
    const nextStatus = staff.isActive === false;
    const res = await apiRequest(`/admin/staff/${staff.id || staff._id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: nextStatus }),
    });

    if (res.success) {
      fetchStaff();
      dispatch(
        addToast({
          type: 'success',
          title: nextStatus ? 'Staff Account Activated' : 'Staff Account Deactivated',
          message: `${staff.name} is now ${nextStatus ? 'authorized to log in' : 'deactivated'}.`,
        })
      );
    } else {
      dispatch(
        addToast({
          type: 'error',
          title: 'Update Failed',
          message: res.message || 'Could not change account status.',
        })
      );
    }
  };

  const handleDeleteStaff = (staff: User) => {
    setDeleteConfirm({
      isOpen: true,
      id: staff.id || staff._id || '',
      name: staff.name,
      isConfirming: false,
    });
  };

  const handleConfirmDelete = async () => {
    setDeleteConfirm((prev) => ({ ...prev, isConfirming: true }));
    const res = await apiRequest(`/admin/staff/${deleteConfirm.id}`, { method: 'DELETE' });

    if (res.success) {
      fetchStaff();
      dispatch(
        addToast({
          type: 'info',
          title: 'Staff Member Deleted',
          message: `"${deleteConfirm.name}" was permanently removed.`,
        })
      );
      setDeleteConfirm((prev) => ({ ...prev, isOpen: false, isConfirming: false }));
    } else {
      dispatch(
        addToast({
          type: 'error',
          title: 'Delete Failed',
          message: res.message || 'Could not delete staff member.',
        })
      );
      setDeleteConfirm((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Staff Members & RBAC Permissions</h2>
            <p className="text-xs text-slate-500">
              Manage internal administrative accounts, catalog managers, order fulfillment officers, and customer care.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchStaff}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Refresh staff list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Role Summary Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Staff</span>
          <p className="text-lg font-black text-slate-900 mt-0.5">{staffList.length}</p>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Active Authorized</span>
          <p className="text-lg font-black text-emerald-800 mt-0.5">
            {staffList.filter((s) => s.isActive !== false).length}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Super Admins</span>
          <p className="text-lg font-black text-purple-800 mt-0.5">
            {staffList.filter((s) => s.role === 'super_admin').length}
          </p>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Deactivated</span>
          <p className="text-lg font-black text-amber-800 mt-0.5">
            {staffList.filter((s) => s.isActive === false).length}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchStaff()}
              placeholder="Search by name, email, or phone..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            type="button"
            onClick={fetchStaff}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Search
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-slate-500">Filter Role:</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          >
            <option value="all">All Roles ({staffList.length})</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="order_manager">Order Manager</option>
            <option value="catalog_manager">Catalog Manager</option>
            <option value="inventory_manager">Inventory Manager</option>
            <option value="customer_support">Customer Support</option>
            <option value="finance">Finance</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3">Staff Member</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Assigned Role & Scope</th>
              <th className="p-3">Account Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staffList.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  No staff members match the selected criteria.
                </td>
              </tr>
            ) : (
              staffList.map((s) => {
                const roleMeta = ROLE_DEFINITIONS[s.role] || {
                  label: s.role.replace('_', ' '),
                  color: 'bg-slate-100 text-slate-700 border-slate-200',
                  desc: 'Standard Staff Access',
                };
                const isActive = s.isActive !== false;
                const isSelf = s.id === currentUser?.id || s._id === currentUser?.id;

                return (
                  <tr key={s.id || s._id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 flex items-center gap-2.5">
                      {s.avatar ? (
                        <img
                          src={s.avatar}
                          alt={s.name}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-900 to-blue-900 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-900 truncate">{s.name}</p>
                          {isSelf && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {String(s.id || s._id).slice(-6)}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="text-slate-800 font-medium">{s.email}</p>
                      <p className="text-slate-400 text-[10px]">{s.phone || 'No phone set'}</p>
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-block ${roleMeta.color}`}>
                        {roleMeta.label}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs truncate">{roleMeta.desc}</p>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {isActive ? 'Authorized' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Toggle Status */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(s)}
                          disabled={isSelf}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            isActive
                              ? 'text-amber-600 hover:bg-amber-50 disabled:opacity-30'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={isActive ? 'Deactivate staff account' : 'Re-activate staff account'}
                        >
                          {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>

                        {/* Edit Staff */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Edit staff permissions"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Staff */}
                        {isSuperAdmin && !isSelf && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(s)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Delete staff account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* AdminModal for Create / Edit Staff */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        icon={<UserCheck className="w-5 h-5 text-blue-600" />}
        title={editingStaff ? `Edit Staff Member: ${editingStaff.name}` : 'Provision Staff Account'}
        subtitle="Configure role-based access control (RBAC), contact info, and security credentials."
        size="lg"
      >
        <form onSubmit={handleSaveStaff} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sazzad Hossain"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="staff@novaracommerce.com"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                {editingStaff ? 'Reset Password (leave empty to keep current)' : 'Initial Password *'}
              </label>
              <input
                type="password"
                required={!editingStaff}
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Phone Number (+880)</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+8801700000000"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Role Selector with Scope Explanations */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              Role & Access Level <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
            >
              <option value="admin">Admin (Storewide Operations & Catalog)</option>
              {isSuperAdmin && <option value="super_admin">Super Admin (System Ownership & Staff)</option>}
              <option value="order_manager">Order Manager (Fulfillment & Shipping)</option>
              <option value="catalog_manager">Catalog Manager (Products, Pricing & Categories)</option>
              <option value="customer_support">Customer Support (Reviews & Enquiries)</option>
              <option value="finance">Finance (Revenue Analytics & Auditing)</option>
              <option value="inventory_manager">Inventory Manager (Stock Levels & SKUs)</option>
            </select>
          </div>

          {/* Avatar Image Upload using ImageUploadInput */}
          <ImageUploadInput
            label="Staff Profile Photo (Optional)"
            value={form.avatar}
            onChange={(url) => setForm({ ...form, avatar: url })}
            placeholder="https://..."
            helperText="Upload official staff portrait or avatar from your device."
            aspectRatioClass="aspect-square"
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingStaff ? 'Save Changes' : 'Create Staff Member'}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        title="Delete Staff Member"
        recordIdentifier={deleteConfirm.name}
        message="Are you sure you want to permanently delete this administrative account? All privileges will be revoked immediately and this action is irreversible."
        isConfirming={deleteConfirm.isConfirming}
        confirmLabel="Delete Account"
        variant="danger"
      />
    </div>
  );
};
