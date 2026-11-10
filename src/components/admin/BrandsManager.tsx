import React, { useState } from 'react';
import { Brand } from '../../types';
import { Award, Plus, Edit2, Trash2 } from 'lucide-react';
import { AdminModal, ConfirmDialog } from './common/modal';
import { ImageUploadInput } from '../common/ImageUploadInput';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';

interface BrandsManagerProps {
  brands: Brand[];
  onRefresh: () => void;
}

export const BrandsManager: React.FC<BrandsManagerProps> = ({ brands, onRefresh }) => {
  const dispatch = useAppDispatch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  // ConfirmDialog State
  const [deleteDialog, setDeleteDialog] = useState<{
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

  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    logo: '',
    description: '',
    featured: false,
  });

  const handleOpenCreate = () => {
    setEditingBrand(null);
    setForm({ name: '', logo: '', description: '', featured: false });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setForm({
      name: brand.name,
      logo: brand.logo,
      description: brand.description || '',
      featured: !!brand.featured,
    });
    setIsModalOpen(true);
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      let res;
      if (editingBrand) {
        res = await apiRequest(`/admin/brands/${editingBrand._id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        res = await apiRequest('/admin/brands', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }

      if (res.success) {
        setIsModalOpen(false);
        onRefresh();
        dispatch(
          addToast({
            type: 'success',
            title: editingBrand ? 'Brand Updated' : 'Brand Created',
            message: `${form.name} saved to catalog.`,
          })
        );
      } else {
        dispatch(
          addToast({
            type: 'error',
            title: 'Operation Failed',
            message: res.message || 'Could not save brand.',
          })
        );
      }
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Operation Failed',
          message: err.message || 'Could not save brand.',
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBrand = (id: string, name: string) => {
    setDeleteDialog({
      isOpen: true,
      id,
      name,
      isConfirming: false,
    });
  };

  const handleConfirmDeleteBrand = async () => {
    setDeleteDialog((prev) => ({ ...prev, isConfirming: true }));
    try {
      const res = await apiRequest(`/admin/brands/${deleteDialog.id}`, { method: 'DELETE' });
      if (res.success) {
        onRefresh();
        dispatch(addToast({ type: 'info', title: 'Brand Deleted', message: `Brand "${deleteDialog.name}" removed.` }));
        setDeleteDialog((prev) => ({ ...prev, isOpen: false, isConfirming: false }));
      } else {
        dispatch(addToast({ type: 'error', title: 'Delete Failed', message: res.message || 'Could not delete brand.' }));
        setDeleteDialog((prev) => ({ ...prev, isConfirming: false }));
      }
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Error', message: err.message }));
      setDeleteDialog((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Brand Partners Directory</h2>
            <p className="text-xs text-slate-500">Manage official manufacturer and distributor brand assets.</p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Brand Partner</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {brands.map((b) => (
          <div
            key={b._id}
            className="p-4 rounded-2xl border border-slate-100 hover:border-blue-200 bg-white shadow-2xs hover:shadow-md transition-all flex flex-col items-center text-center justify-between group"
          >
            <div className="w-16 h-16 rounded-xl bg-slate-50 p-2 mb-3 flex items-center justify-center overflow-hidden">
              {b.logo ? (
                <img src={b.logo} alt={b.name} className="w-full h-full object-contain" />
              ) : (
                <Award className="w-8 h-8 text-blue-500" />
              )}
            </div>

            <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600">{b.name}</h4>
            <span className="text-[10px] text-slate-400 mt-0.5">{b.itemCount || 0} Products</span>

            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-50 w-full justify-center">
              <button
                onClick={() => handleOpenEdit(b)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                title="Edit brand"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDeleteBrand(b._id, b.name)}
                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                title="Delete brand"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* AdminModal for Brand Creation & Editing */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        icon={<Award className="w-5 h-5" />}
        title={editingBrand ? `Edit Brand: ${editingBrand.name}` : 'Create Brand Partner'}
        subtitle="Manage brand identity, high-res logos, and catalog filtering."
        size="md"
      >
        <form onSubmit={handleSaveBrand} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Brand Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Apple, Sony, Samsung"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <ImageUploadInput
              label="Brand Logo Asset"
              value={form.logo}
              onChange={(url) => setForm({ ...form, logo: url })}
              placeholder="https://..."
              helperText="Upload transparent PNG/SVG or paste logo URL."
              previewMode="contain"
              aspectRatio="contain"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Description / Overview
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Official consumer electronics brand..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <input
              type="checkbox"
              id="featuredBrand"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="featuredBrand" className="text-xs font-bold text-slate-700 cursor-pointer">
              Feature in Homepage Brand Showcase
            </label>
          </div>

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
              disabled={isSaving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : editingBrand ? (
                'Save Changes'
              ) : (
                'Create Brand'
              )}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDeleteBrand}
        title="Delete Brand Partner"
        recordIdentifier={deleteDialog.name}
        message="Are you sure you want to permanently delete this brand partner? Storefront products referencing this brand will retain their text brand value."
        isConfirming={deleteDialog.isConfirming}
        confirmLabel="Delete Brand"
        variant="danger"
      />
    </div>
  );
};
