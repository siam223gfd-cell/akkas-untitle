import React, { useState, useEffect } from 'react';
import { HeroSlide } from '../../types';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Link as LinkIcon,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRight,
  MoveUp,
  MoveDown,
  RefreshCw,
} from 'lucide-react';
import { AdminModal, ConfirmDialog, FormField, FormSection } from './common/modal';
import { ImageUploadInput } from '../common/ImageUploadInput';
import { SafeLink } from '../common/SafeLink';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';

interface HeroSliderManagerProps {
  slides?: HeroSlide[];
  onRefresh?: () => void;
}

export const HeroSliderManager: React.FC<HeroSliderManagerProps> = ({ onRefresh }) => {
  const dispatch = useAppDispatch();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ConfirmDialog State
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    id: string;
    title: string;
    isConfirming: boolean;
  }>({
    isOpen: false,
    id: '',
    title: '',
    isConfirming: false,
  });

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    badge: '',
    desktopImage: '',
    mobileImage: '',
    destinationUrl: '',
    ctaText: '',
    secondaryCtaText: '',
    secondaryCtaUrl: '',
    target: '_self' as '_self' | '_blank',
    order: 1,
    isActive: true,
    startDate: '',
    endDate: '',
  });

  const fetchSlides = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/hero-slides');
      setIsLoading(false);
      if (res.success && res.slides) {
        setSlides(res.slides);
      }
    } catch {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSlides();
  }, []);

  const toDateTimeLocal = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  const handleOpenCreate = () => {
    setEditingSlide(null);
    setForm({
      title: '',
      subtitle: '',
      badge: '',
      desktopImage: '',
      mobileImage: '',
      destinationUrl: '',
      ctaText: '',
      secondaryCtaText: '',
      secondaryCtaUrl: '',
      target: '_self',
      order: slides.length + 1,
      isActive: true,
      startDate: '',
      endDate: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (slide: HeroSlide) => {
    setEditingSlide(slide);
    setForm({
      title: slide.title || '',
      subtitle: slide.subtitle || '',
      badge: slide.badge || '',
      desktopImage: slide.image || slide.desktopImage || '',
      mobileImage: slide.mobileImage || '',
      destinationUrl: slide.link || slide.destinationUrl || '',
      ctaText: slide.ctaText || '',
      secondaryCtaText: slide.secondaryCtaText || '',
      secondaryCtaUrl: slide.secondaryCtaUrl || '',
      target: slide.target || '_self',
      order: slide.displayOrder ?? slide.order ?? 1,
      isActive: slide.isActive !== false,
      startDate: toDateTimeLocal(slide.startDate),
      endDate: toDateTimeLocal(slide.endDate),
    });
    setIsModalOpen(true);
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.desktopImage.trim()) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Image Required',
          message: 'Please upload or provide a desktop slide image.',
        })
      );
      return;
    }

    if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      dispatch(
        addToast({
          type: 'error',
          title: 'Invalid Schedule Window',
          message: 'Schedule start date must be before or equal to end date.',
        })
      );
      return;
    }

    const payload = {
      ...form,
      image: form.desktopImage.trim(),
      link: form.destinationUrl.trim(),
      displayOrder: form.order,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
    };

    setIsSubmitting(true);
    try {
      let res;
      if (editingSlide) {
        res = await apiRequest(`/hero-slides/${editingSlide._id || editingSlide.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiRequest('/hero-slides', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsSubmitting(false);
      if (res.success) {
        setIsModalOpen(false);
        fetchSlides();
        if (onRefresh) onRefresh();
        dispatch(
          addToast({
            type: 'success',
            title: editingSlide ? 'Hero Slide Updated' : 'Hero Slide Created',
            message: 'Changes are live in the homepage hero slider.',
          })
        );
      } else {
        dispatch(
          addToast({
            type: 'error',
            title: 'Save Failed',
            message: res.message || 'Could not save hero slide.',
          })
        );
      }
    } catch (err: any) {
      setIsSubmitting(false);
      dispatch(
        addToast({
          type: 'error',
          title: 'Save Error',
          message: err.message || 'An error occurred while saving hero slide.',
        })
      );
    }
  };

  const handleToggleStatus = async (slide: HeroSlide) => {
    const nextStatus = !slide.isActive;
    const res = await apiRequest(`/hero-slides/${slide._id || slide.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: nextStatus }),
    });

    if (res.success) {
      fetchSlides();
      if (onRefresh) onRefresh();
      dispatch(
        addToast({
          type: 'success',
          title: 'Status Updated',
          message: `Slide set to ${nextStatus ? 'active' : 'inactive'}.`,
        })
      );
    } else {
      dispatch(addToast({ type: 'error', title: 'Update Failed', message: res.message || 'Could not update status.' }));
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === slides.length - 1)) {
      return;
    }

    const previousSlides = [...slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const swapped = [...slides];
    const temp = swapped[index];
    swapped[index] = swapped[targetIndex];
    swapped[targetIndex] = temp;

    const normalized = swapped.map((slide, idx) => ({
      ...slide,
      order: idx + 1,
    }));
    setSlides(normalized);

    const items = normalized
      .filter((s) => !!(s._id || s.id))
      .map((s) => ({ id: s._id || s.id, order: s.order }));

    const res = await apiRequest('/hero-slides/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    });

    if (res.success) {
      fetchSlides();
      if (onRefresh) onRefresh();
      dispatch(addToast({ type: 'info', title: 'Slide Reordered', message: 'Display order updated.' }));
    } else {
      setSlides(previousSlides);
      dispatch(addToast({ type: 'error', title: 'Reorder Failed', message: res.message || 'Could not update slide order.' }));
    }
  };

  const handleDelete = (id: string, title: string) => {
    setDeleteDialog({
      isOpen: true,
      id,
      title: title || 'Untitled Banner Slide',
      isConfirming: false,
    });
  };

  const handleConfirmDelete = async () => {
    setDeleteDialog((prev) => ({ ...prev, isConfirming: true }));
    try {
      const res = await apiRequest(`/hero-slides/${deleteDialog.id}`, { method: 'DELETE' });
      if (res.success) {
        fetchSlides();
        if (onRefresh) onRefresh();
        dispatch(addToast({ type: 'info', title: 'Slide Deleted', message: `"${deleteDialog.title || 'Slide'}" removed.` }));
        setDeleteDialog((prev) => ({ ...prev, isOpen: false, isConfirming: false }));
      } else {
        dispatch(addToast({ type: 'error', title: 'Delete Failed', message: res.message || 'Could not delete slide.' }));
        setDeleteDialog((prev) => ({ ...prev, isConfirming: false }));
      }
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Error', message: err.message }));
      setDeleteDialog((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const hasPreviewOverlay = !!(
    form.title.trim() ||
    form.subtitle.trim() ||
    form.badge.trim() ||
    form.ctaText.trim() ||
    form.secondaryCtaText.trim()
  );

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Homepage Hero Slider Manager</h2>
            <p className="text-xs text-slate-500">
              Manage dynamic storefront carousel slides, imagery, titles, CTAs, and destination links.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchSlides}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            title="Refresh Slides"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Hero Slide</span>
          </button>
        </div>
      </div>

      {/* Slide Count Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
          <span className="text-slate-500">Total Slides</span>
          <span className="font-bold text-slate-900">{slides.length}</span>
        </div>
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
          <span className="text-slate-500">Active Published</span>
          <span className="font-bold text-emerald-600">
            {slides.filter((s) => s.isActive !== false).length}
          </span>
        </div>
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
          <span className="text-slate-500">With CTA Buttons</span>
          <span className="font-bold text-blue-600">
            {slides.filter((s) => !!s.ctaText).length}
          </span>
        </div>
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
          <span className="text-slate-500">Target Range</span>
          <span className="font-bold text-slate-700">~3 to 5 Recommended</span>
        </div>
      </div>

      {/* Slides Table */}
      {slides.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <ImageIcon className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">No Hero Slides Configured</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create your first dynamic slide with high-resolution banner imagery and optional CTA links.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Slide</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3 w-12 text-center">Order</th>
                <th className="p-3">Preview & Title</th>
                <th className="p-3">CTA & Links</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slides.map((slide, index) => {
                const isActive = slide.isActive !== false;
                return (
                  <tr key={slide._id || slide.id || index} className="hover:bg-slate-50/50">
                    {/* Order Controls */}
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                          title="Move slide up"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-bold text-slate-700 text-xs">
                          {slide.order ?? index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(index, 'down')}
                          disabled={index === slides.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                          title="Move slide down"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Preview & Details */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shrink-0 relative">
                          <img
                            src={slide.desktopImage}
                            alt={slide.title || 'Banner Image Slide'}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0 max-w-sm space-y-0.5">
                          {slide.badge && (
                            <span className="inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                              {slide.badge}
                            </span>
                          )}
                          <p className="font-bold text-slate-900 truncate text-xs">
                            {slide.title || 'Banner Image Slide'}
                          </p>
                          {slide.subtitle && (
                            <p className="text-[11px] text-slate-500 truncate">{slide.subtitle}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* CTAs */}
                    <td className="p-3 space-y-1">
                      {slide.ctaText || slide.destinationUrl ? (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-bold text-slate-800">
                            {slide.ctaText || 'Banner Link'}:
                          </span>
                          {slide.destinationUrl ? (
                            <span className="font-mono text-blue-600 truncate max-w-[140px]">
                              {slide.destinationUrl}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No destination URL</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No link configured</span>
                      )}
                      {slide.secondaryCtaText && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span>{slide.secondaryCtaText}:</span>
                          <span className="font-mono truncate max-w-[140px]">
                            {slide.secondaryCtaUrl || 'No URL'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleStatus(slide)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                        title="Click to toggle publish status"
                      >
                        {isActive ? 'Published' : 'Draft'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(slide)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Edit slide"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(slide._id || slide.id || '', slide.title || '')}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete slide"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide Create / Edit Modal */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSlide ? `Edit Hero Slide: ${editingSlide.title || 'Banner Slide'}` : 'Create Homepage Hero Slide'}
        subtitle="Configure banner visual assets, optional text overlays, call-to-action buttons, and scheduling."
        size="3xl"
        icon={<Sliders className="w-5 h-5 text-blue-600" />}
      >
        <form onSubmit={handleSaveSlide} className="space-y-5">
          {/* Visual Live Preview in Modal */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Live Slide Preview
            </span>
            <div className="relative w-full aspect-21/8 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md flex items-center">
              {form.desktopImage ? (
                <img
                  src={form.desktopImage}
                  alt={form.title || 'Slide Preview'}
                  className={`absolute inset-0 w-full h-full object-cover ${hasPreviewOverlay ? 'opacity-65' : 'opacity-100'}`}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                  Upload or paste a desktop banner image to preview
                </div>
              )}
              {hasPreviewOverlay && (
                <div className="relative z-10 p-6 max-w-lg space-y-2 text-white">
                  {form.badge && (
                    <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500 text-white shadow-xs">
                      {form.badge}
                    </span>
                  )}
                  {form.title && (
                    <h3 className="text-xl sm:text-2xl font-black leading-tight drop-shadow-md">
                      {form.title}
                    </h3>
                  )}
                  {form.subtitle && (
                    <p className="text-xs text-slate-200 line-clamp-2 drop-shadow-sm">
                      {form.subtitle}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    {form.ctaText && (
                      <span className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md inline-flex items-center gap-1.5">
                        <span>{form.ctaText}</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                    {form.secondaryCtaText && (
                      <span className="px-4 py-1.5 bg-white/20 backdrop-blur-xs text-white font-bold text-xs rounded-xl border border-white/30">
                        {form.secondaryCtaText}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Sections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-bold mb-1">Slide Title / Headline (Optional)</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Leave blank for an image-only promotional banner"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Badge Tag (Optional)</label>
              <input
                type="text"
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                placeholder="e.g. SPECIAL PROMOTION"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Display Order</label>
              <input
                type="number"
                min={1}
                value={form.order}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 1 })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-bold mb-1">Subtitle / Description (Optional)</label>
              <textarea
                rows={2}
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="Short supportive summary for customers..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            {/* Images */}
            <div className="sm:col-span-2">
              <ImageUploadInput
                label="Desktop Banner Image (1600x600 recommended)"
                value={form.desktopImage}
                onChange={(url) => setForm({ ...form, desktopImage: url })}
                placeholder="Upload or paste desktop banner image URL"
                aspectRatio="banner"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <ImageUploadInput
                label="Mobile-Specific Banner Image (Optional)"
                value={form.mobileImage}
                onChange={(url) => setForm({ ...form, mobileImage: url })}
                placeholder="Upload or paste mobile optimized banner image URL"
                aspectRatio="video"
              />
            </div>

            {/* CTAs */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Primary CTA Button Text (Optional)</label>
              <input
                type="text"
                value={form.ctaText}
                onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                placeholder="e.g. Explore Catalog"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-bold">Primary Destination URL (Optional)</label>
                <span className="text-[10px] text-slate-400">Leave blank for non-clickable banner</span>
              </div>
              <input
                type="text"
                value={form.destinationUrl}
                onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })}
                placeholder="e.g. /shop?category=electronics (or leave blank)"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                If provided, clicking the slide navigates here. If blank, slide displays normally without link navigation.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Secondary CTA Text (Optional)</label>
              <input
                type="text"
                value={form.secondaryCtaText}
                onChange={(e) => setForm({ ...form, secondaryCtaText: e.target.value })}
                placeholder="e.g. View Discounts"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Secondary Destination URL (Optional)</label>
              <input
                type="text"
                value={form.secondaryCtaUrl}
                onChange={(e) => setForm({ ...form, secondaryCtaUrl: e.target.value })}
                placeholder="e.g. /shop?sort=discount"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Link Open Target</label>
              <select
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value === '_blank' ? '_blank' : '_self' })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              >
                <option value="_self">Same Tab (_self)</option>
                <option value="_blank">New Tab (_blank)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Schedule Start (Optional)</label>
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Schedule End (Optional)</label>
                <input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="sm:col-span-2 flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <p className="font-bold text-slate-800">Publish on Storefront</p>
                <p className="text-[11px] text-slate-400">Make this slide immediately visible in the homepage hero slider.</p>
              </div>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Saving...' : editingSlide ? 'Update Hero Slide' : 'Create Hero Slide'}</span>
            </button>
          </div>
        </form>
      </AdminModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        title="Delete Hero Slide"
        recordIdentifier={deleteDialog.title || 'Untitled Banner Slide'}
        message="Are you sure you want to delete this hero slide? It will be immediately removed from the customer storefront."
        isConfirming={deleteDialog.isConfirming}
        confirmLabel="Delete Slide"
        variant="danger"
      />
    </div>
  );
};
