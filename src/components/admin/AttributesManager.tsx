import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { Attribute, AttributeValue, AttributeInputType } from '../../types';
import { useAppDispatch } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';
import { AdminModal, ConfirmDialog } from './common/modal';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  Sparkles,
  Layers,
  Palette,
  Hash,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface AttributesManagerProps {
  categories: { name: string; slug: string }[];
}

export const AttributesManager: React.FC<AttributesManagerProps> = ({ categories }) => {
  const dispatch = useAppDispatch();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<Attribute | null>(null);

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

  // Form State
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<AttributeInputType>('color_swatch');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [isRequired, setIsRequired] = useState(false);
  const [isFilterable, setIsFilterable] = useState(true);
  const [isVisibleOnPDP, setIsVisibleOnPDP] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(1);
  const [values, setValues] = useState<AttributeValue[]>([
    { label: '', value: '', hexColor: '' },
  ]);

  const loadAttributes = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/attributes');
      if (res.success && res.attributes) {
        setAttributes(res.attributes);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttributes();
  }, []);

  const openCreateModal = () => {
    setEditingAttr(null);
    setName('');
    setSlug('');
    setType('size_selector');
    setSelectedCategories(['all']);
    setIsRequired(false);
    setIsFilterable(true);
    setIsVisibleOnPDP(true);
    setDisplayOrder(attributes.length + 1);
    setValues([
      { label: 'Small', value: 'S' },
      { label: 'Medium', value: 'M' },
      { label: 'Large', value: 'L' },
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (attr: Attribute) => {
    setEditingAttr(attr);
    setName(attr.name);
    setSlug(attr.slug);
    setType(attr.type);
    setSelectedCategories(attr.categories || ['all']);
    setIsRequired(attr.isRequired);
    setIsFilterable(attr.isFilterable);
    setIsVisibleOnPDP(attr.isVisibleOnPDP);
    setDisplayOrder(attr.displayOrder || 1);
    setValues(attr.values && attr.values.length > 0 ? attr.values : [{ label: '', value: '' }]);
    setIsModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingAttr) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      );
    }
  };

  const handleAddValue = () => {
    setValues((prev) => [...prev, { label: '', value: '', hexColor: type === 'color_swatch' ? '#3b82f6' : undefined }]);
  };

  const handleRemoveValue = (index: number) => {
    setValues((prev) => prev.filter((_, i) => i !== index));
  };

  const handleValueChange = (index: number, field: keyof AttributeValue, val: string) => {
    setValues((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      if (field === 'label' && !updated[index].value) {
        updated[index].value = val;
      }
      return updated;
    });
  };

  const handleSaveAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || isSaving) return;

    // Filter empty values
    const cleanValues = values.filter((v) => v.label.trim() && v.value.trim());

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      type,
      categories: selectedCategories.length > 0 ? selectedCategories : ['all'],
      isRequired,
      isFilterable,
      isVisibleOnPDP,
      displayOrder: Number(displayOrder),
      values: cleanValues,
    };

    setIsSaving(true);
    try {
      if (editingAttr) {
        const res = await apiRequest(`/attributes/${editingAttr._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (res.success) {
          dispatch(addToast({ type: 'success', title: 'Attribute Updated', message: `${name} has been updated.` }));
          setIsModalOpen(false);
          loadAttributes();
        } else {
          dispatch(addToast({ type: 'error', title: 'Update Failed', message: res.message || 'Could not update attribute.' }));
        }
      } else {
        const res = await apiRequest('/attributes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res.success) {
          dispatch(addToast({ type: 'success', title: 'Attribute Created', message: `${name} created successfully.` }));
          setIsModalOpen(false);
          loadAttributes();
        } else {
          dispatch(addToast({ type: 'error', title: 'Creation Failed', message: res.message || 'Could not create attribute.' }));
        }
      }
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Error', message: err.message }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAttribute = (id: string, attrName: string) => {
    setDeleteDialog({
      isOpen: true,
      id,
      name: attrName,
      isConfirming: false,
    });
  };

  const handleConfirmDeleteAttribute = async () => {
    setDeleteDialog((prev) => ({ ...prev, isConfirming: true }));
    try {
      const res = await apiRequest(`/attributes/${deleteDialog.id}`, { method: 'DELETE' });
      if (res.success) {
        dispatch(addToast({ type: 'info', title: 'Deleted', message: `Attribute ${deleteDialog.name} removed.` }));
        setDeleteDialog((prev) => ({ ...prev, isOpen: false, isConfirming: false }));
        loadAttributes();
      } else {
        dispatch(addToast({ type: 'error', title: 'Error', message: res.message || 'Could not delete attribute.' }));
        setDeleteDialog((prev) => ({ ...prev, isConfirming: false }));
      }
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Error', message: err.message }));
      setDeleteDialog((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const filteredAttributes = attributes.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            Universal Product Attributes & Variants
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure dynamic attributes (Color swatches, Size selectors, RAM, Storage) across unlimited product categories.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add New Attribute
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search attributes by name, type, or slug..."
          className="w-full text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      {/* Attributes Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Name / Slug</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Values & Swatches</th>
                <th className="py-3.5 px-4">Categories</th>
                <th className="py-3.5 px-4">Visibility</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading attributes...
                  </td>
                </tr>
              ) : filteredAttributes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No attributes found. Click "Add New Attribute" to create one.
                  </td>
                </tr>
              ) : (
                filteredAttributes.map((attr) => (
                  <tr key={attr._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div>{attr.name}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{attr.slug}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {attr.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center flex-wrap gap-1.5 max-w-xs">
                        {attr.values?.map((val, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {val.hexColor && (
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/20"
                                style={{ backgroundColor: val.hexColor }}
                              />
                            )}
                            {val.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center flex-wrap gap-1">
                        {attr.categories?.map((cat, idx) => (
                          <span key={idx} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      {attr.isVisibleOnPDP ? (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Live on PDP
                        </span>
                      ) : (
                        <span className="text-slate-400">Hidden</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(attr)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="Edit attribute"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttribute(attr._id, attr.name)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete attribute"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT ADMIN MODAL */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="2xl"
        icon={<Sliders className="w-5 h-5" />}
        title={editingAttr ? `Edit Attribute: ${editingAttr.name}` : 'Create Universal Attribute'}
        subtitle="Define attribute type and options that generate variants and PDP selection controls."
      >
        <form onSubmit={handleSaveAttribute} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Attribute Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Color, Storage, Size"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Slug *</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. color, storage, size"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Display Type *</label>
                  <select
                    value={type}
                    onChange={(e: any) => setType(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="color_swatch">Color Swatch (Visual circles)</option>
                    <option value="size_selector">Size / Storage Pill Selector</option>
                    <option value="select">Dropdown Select</option>
                    <option value="radio">Radio Buttons</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Display Order</label>
                  <input
                    type="number"
                    min="1"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 1)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Categories assignment */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Applicable Categories</label>
                <div className="flex items-center flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCategories.includes('all')) {
                        setSelectedCategories([]);
                      } else {
                        setSelectedCategories(['all']);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      selectedCategories.includes('all')
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Categories
                  </button>
                  {categories.map((cat) => {
                    const isSelected = selectedCategories.includes(cat.name);
                    return (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => {
                          if (selectedCategories.includes(cat.name)) {
                            setSelectedCategories((prev) => prev.filter((c) => c !== cat.name));
                          } else {
                            setSelectedCategories((prev) => [...prev.filter((c) => c !== 'all'), cat.name]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Required
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isFilterable}
                    onChange={(e) => setIsFilterable(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Filterable
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isVisibleOnPDP}
                    onChange={(e) => setIsVisibleOnPDP(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Live on PDP
                </label>
              </div>

              {/* Values List */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800">
                    Attribute Values & Options ({values.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddValue}
                    className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Option
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {values.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Label (e.g. Titanium Gray)"
                        value={val.label}
                        onChange={(e) => handleValueChange(idx, 'label', e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. Titanium Gray)"
                        value={val.value}
                        onChange={(e) => handleValueChange(idx, 'value', e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                      {type === 'color_swatch' && (
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={val.hexColor || '#c5c8cb'}
                            onChange={(e) => handleValueChange(idx, 'hexColor', e.target.value)}
                            className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveValue(idx)}
                        disabled={values.length <= 1}
                        className="text-slate-400 hover:text-red-600 disabled:opacity-30 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-xl text-xs transition flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : editingAttr ? (
                    'Save Changes'
                  ) : (
                    'Create Attribute'
                  )}
                </button>
              </div>
            </form>
      </AdminModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDeleteAttribute}
        title="Delete Attribute"
        recordIdentifier={deleteDialog.name}
        message="Are you sure you want to permanently delete this attribute? Existing product variants mapped to this attribute will lose their dynamic option mapping."
        isConfirming={deleteDialog.isConfirming}
        confirmLabel="Delete Attribute"
        variant="danger"
      />
    </div>
  );
};
