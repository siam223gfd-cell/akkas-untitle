import React, { useState, useEffect } from 'react';
import { Advertisement } from '../../../types';
import {
  Megaphone,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Search,
  Filter,
  ExternalLink,
  MousePointerClick,
  BarChart2,
  Calendar,
  X,
  Layers,
  Sparkles,
  Smartphone,
  ArrowRight,
} from 'lucide-react';
import { AdminModal, ConfirmDialog, FormSection, FormField } from '../common/modal';
import { AdvertisementDetailsDrawer } from '../drawers/AdvertisementDetailsDrawer';
import { ImageUploadInput } from '../../common/ImageUploadInput';
import { SafeLink } from '../../common/SafeLink';
import { apiRequest } from '../../../services/api';
import { useAppDispatch } from '../../../app/hooks';
import { addToast } from '../../../features/ui/uiSlice';

const AVAILABLE_PLACEMENTS = [
  { id: 'homepage_hero', label: 'Homepage Hero Area' },
  { id: 'between_sections', label: 'Between Sections (Homepage)' },
  { id: 'homepage_top_bar', label: 'Homepage Top Bar' },
  { id: 'plp_top', label: 'Product Listing Page (Top Banner)' },
  { id: 'plp_sidebar', label: 'Product Listing Page (Sidebar)' },
  { id: 'pdp_sidebar', label: 'Product Detail Page (Sidebar)' },
  { id: 'pdp_bottom', label: 'Product Detail Page (Bottom)' },
  { id: 'category_header', label: 'Category Page Header' },
  { id: 'footer', label: 'Footer Promotional Area' },
  { id: 'popup_modal', label: 'Floating / Pop-up Promo' },
];

export const AdvertisementsManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [stats, setStats] = useState<any>({
    total: 0,
    active: 0,
    expired: 0,
    totalImpressions: 0,
    totalClicks: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [placementFilter, setPlacementFilter] = useState('all');

  // Modal & Drawer State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [inspectingAd, setInspectingAd] = useState<Advertisement | null>(null);
  const [modalTab, setModalTab] = useState<'form' | 'preview'>('form');
  const [previewMode, setPreviewMode] = useState<'banner' | 'card' | 'popup'>('banner');

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

  const defaultForm = {
    name: '',
    title: '',
    subtitle: '',
    description: '',
    promoBadge: '',
    mainImage: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=600&q=80',
    secondaryImage: '',
    backgroundColor: '#051329',
    gradient: 'from-blue-950 via-slate-900 to-slate-950',
    textColor: '#ffffff',
    cta: {
      enabled: true,
      label: 'Shop Now',
      url: '/shop',
      target: '_self' as '_self' | '_blank',
      variant: 'primary' as 'primary' | 'secondary' | 'outline' | 'dark' | 'light',
      bgColor: '#2563eb',
      textColor: '#ffffff',
    },
    closeButton: {
      enabled: true,
      position: 'top-right' as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left',
      appearance: 'circle' as 'minimal' | 'circle' | 'pill' | 'dark' | 'light',
      dismissalPolicy: 'session' as 'until_reload' | 'session' | 'duration' | 'until_expiration',
      dismissalDurationHours: 24,
    },
    placements: ['between_sections'],
    deviceTargeting: 'all' as 'all' | 'desktop_only' | 'mobile_only' | 'tablet_only',
    priority: 1,
    status: 'published' as 'draft' | 'published' | 'archived',
    startDate: '',
    endDate: '',
  };

  const [form, setForm] = useState(defaultForm);

  const fetchAds = async () => {
    setIsLoading(true);
    const query = new URLSearchParams();
    if (searchQuery) query.set('search', searchQuery);
    if (statusFilter !== 'all') query.set('status', statusFilter);
    if (placementFilter !== 'all') query.set('placement', placementFilter);

    const res = await apiRequest(`/advertisements?${query.toString()}`);
    setIsLoading(false);
    if (res.success) {
      setAds(res.advertisements || []);
      if (res.stats) setStats(res.stats);
    }
  };

  useEffect(() => {
    fetchAds();
  }, [statusFilter, placementFilter]);

  const handleOpenCreate = () => {
    setEditingAd(null);
    setForm(defaultForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setForm({
      name: ad.name,
      title: ad.title,
      subtitle: ad.subtitle || '',
      description: ad.description || '',
      promoBadge: ad.promoBadge || '',
      mainImage: ad.mainImage,
      secondaryImage: ad.secondaryImage || '',
      backgroundColor: ad.backgroundColor || '#051329',
      gradient: ad.gradient || 'from-blue-950 via-slate-900 to-slate-950',
      textColor: ad.textColor || '#ffffff',
      cta: {
        enabled: ad.cta?.enabled !== false,
        label: ad.cta?.label || 'Shop Now',
        url: ad.cta?.url || '/shop',
        target: ad.cta?.target || '_self',
        variant: ad.cta?.variant || 'primary',
        bgColor: ad.cta?.bgColor || '#2563eb',
        textColor: ad.cta?.textColor || '#ffffff',
      },
      closeButton: {
        enabled: ad.closeButton?.enabled !== false,
        position: ad.closeButton?.position || 'top-right',
        appearance: ad.closeButton?.appearance || 'circle',
        dismissalPolicy: ad.closeButton?.dismissalPolicy || 'session',
        dismissalDurationHours: ad.closeButton?.dismissalDurationHours || 24,
      },
      placements: ad.placements || ['between_sections'],
      deviceTargeting: ad.deviceTargeting || 'all',
      priority: ad.priority || 1,
      status: ad.status || 'published',
      startDate: ad.startDate ? new Date(ad.startDate).toISOString().slice(0, 10) : '',
      endDate: ad.endDate ? new Date(ad.endDate).toISOString().slice(0, 10) : '',
    });
    setIsModalOpen(true);
  };

  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.title || !form.mainImage) {
      dispatch(addToast({ type: 'error', title: 'Missing Fields', message: 'Name, Title, and Main Image are required.' }));
      return;
    }

    let res;
    if (editingAd) {
      res = await apiRequest(`/advertisements/${editingAd._id || editingAd.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
    } else {
      res = await apiRequest('/advertisements', {
        method: 'POST',
        body: JSON.stringify(form),
      });
    }

    if (res.success) {
      setIsModalOpen(false);
      fetchAds();
      dispatch(
        addToast({
          type: 'success',
          title: editingAd ? 'Advertisement Updated' : 'Advertisement Created',
          message: `${form.title} saved to database.`,
        })
      );
    } else {
      dispatch(addToast({ type: 'error', title: 'Failed', message: res.message || 'Could not save advertisement.' }));
    }
  };

  const handleToggleStatus = async (ad: Advertisement) => {
    const nextStatus = ad.status === 'published' ? 'draft' : 'published';
    const res = await apiRequest(`/advertisements/${ad._id || ad.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.success) {
      fetchAds();
      dispatch(
        addToast({
          type: 'success',
          title: 'Status Updated',
          message: `Ad is now ${nextStatus}.`,
        })
      );
    }
  };

  const handleDuplicateAd = async (ad: Advertisement) => {
    const res = await apiRequest(`/advertisements/${ad._id || ad.id}/duplicate`, { method: 'POST' });
    if (res.success) {
      fetchAds();
      dispatch(addToast({ type: 'info', title: 'Ad Duplicated', message: 'Saved as draft copy.' }));
    }
  };

  const handleDeleteAd = (id: string, name: string) => {
    setDeleteDialog({
      isOpen: true,
      id,
      name,
      isConfirming: false,
    });
  };

  const handleConfirmDeleteAd = async () => {
    setDeleteDialog((prev) => ({ ...prev, isConfirming: true }));
    try {
      const res = await apiRequest(`/advertisements/${deleteDialog.id}`, { method: 'DELETE' });
      if (res.success) {
        fetchAds();
        dispatch(addToast({ type: 'info', title: 'Advertisement Removed', message: `"${deleteDialog.name}" was deleted.` }));
        setDeleteDialog((prev) => ({ ...prev, isOpen: false, isConfirming: false }));
      } else {
        dispatch(addToast({ type: 'error', title: 'Delete Failed', message: res.message || 'Could not delete advertisement.' }));
        setDeleteDialog((prev) => ({ ...prev, isConfirming: false }));
      }
    } catch (err: any) {
      dispatch(addToast({ type: 'error', title: 'Error', message: err.message }));
      setDeleteDialog((prev) => ({ ...prev, isConfirming: false }));
    }
  };

  const togglePlacement = (placementId: string) => {
    if (form.placements.includes(placementId)) {
      if (form.placements.length === 1) return; // Keep at least one
      setForm({ ...form, placements: form.placements.filter((p) => p !== placementId) });
    } else {
      setForm({ ...form, placements: [...form.placements, placementId] });
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Advertisement Management System</h2>
            <p className="text-xs text-slate-500">
              Manage promotional campaigns, multi-placement targeting, dismissal policies, and impression tracking.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Advertisement</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Ads</span>
          <p className="text-lg font-black text-slate-900 mt-0.5">{stats.total || ads.length}</p>
        </div>
        <div className="p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Active Published</span>
          <p className="text-lg font-black text-emerald-800 mt-0.5">{stats.active || 0}</p>
        </div>
        <div className="p-3.5 rounded-2xl border border-amber-100 bg-amber-50/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Expired</span>
          <p className="text-lg font-black text-amber-800 mt-0.5">{stats.expired || 0}</p>
        </div>
        <div className="p-3.5 rounded-2xl border border-blue-100 bg-blue-50/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Total Impressions</span>
          <p className="text-lg font-black text-blue-800 mt-0.5">{(stats.totalImpressions || 0).toLocaleString()}</p>
        </div>
        <div className="p-3.5 rounded-2xl border border-purple-100 bg-purple-50/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Total CTA Clicks</span>
          <p className="text-lg font-black text-purple-800 mt-0.5">{(stats.totalClicks || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchAds()}
              placeholder="Search advertisements by title or internal name..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>
          <button
            type="button"
            onClick={fetchAds}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
          >
            Search
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={placementFilter}
            onChange={(e) => setPlacementFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          >
            <option value="all">All Placements</option>
            {AVAILABLE_PLACEMENTS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ads Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3">Ad Creative</th>
              <th className="p-3">Placements</th>
              <th className="p-3">Targeting</th>
              <th className="p-3">Impressions / Clicks</th>
              <th className="p-3">CTR</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ads.map((ad) => {
              const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0';
              return (
                <tr key={ad._id || ad.id} className="hover:bg-slate-50/50">
                  <td className="p-3 flex items-center gap-3">
                    <img
                      src={ad.mainImage}
                      alt={ad.title}
                      className="w-12 h-12 object-cover rounded-xl bg-slate-900 shrink-0 border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate max-w-xs">{ad.title}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs">{ad.name}</p>
                      {ad.promoBadge && (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                          {ad.promoBadge}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {ad.placements.map((p) => (
                        <span
                          key={p}
                          className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                            p === 'popup_modal'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p === 'popup_modal' ? '✨ Storefront Popup' : p.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 capitalize font-semibold text-slate-700">
                    {ad.deviceTargeting.replace('_', ' ')}
                  </td>
                  <td className="p-3 font-mono font-semibold text-slate-800">
                    {ad.impressions.toLocaleString()} / <span className="text-blue-600">{ad.clicks.toLocaleString()}</span>
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-900">
                    {ctr}%
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(ad)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition ${
                        ad.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${ad.status === 'published' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {ad.status}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setInspectingAd(ad)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        title="Inspect ad performance & placements drawer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateAd(ad)}
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                        title="Duplicate ad"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(ad)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        title="Edit advertisement"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAd(ad._id || ad.id || '', ad.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete advertisement"
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

      {/* AdminModal for Creating / Editing Advertisement */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        icon={<Megaphone className="w-5 h-5" />}
        title={editingAd ? `Edit Advertisement: ${editingAd.title}` : 'Create New Advertisement Campaign'}
        subtitle="Configure advertising creatives, placement eligibility, close button persistence, and CTA links."
        size="4xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setModalTab('form')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                modalTab === 'form' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Campaign Settings
            </button>
            <button
              type="button"
              onClick={() => setModalTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                modalTab === 'preview' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Visual Preview</span>
            </button>
          </div>

          {modalTab === 'preview' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setPreviewMode('banner')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                  previewMode === 'banner' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Desktop Banner
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('card')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                  previewMode === 'card' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mobile / Sidebar
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('popup')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                  previewMode === 'popup' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Storefront Popup
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveAd} className="space-y-4">
          {modalTab === 'preview' ? (
            <div className="space-y-4 p-4 rounded-3xl bg-slate-900 text-white min-h-[380px] flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 self-start mb-2">
                Simulated {previewMode === 'banner' ? 'Desktop Banner' : previewMode === 'card' ? 'Mobile / Sidebar Card' : 'Promotional Popup Overlay'}
              </span>

              {/* Mode 1: Desktop Banner */}
              {previewMode === 'banner' && (
                <div
                  className="w-full rounded-2xl overflow-hidden p-6 border border-white/10 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6"
                  style={{ backgroundColor: form.backgroundColor }}
                >
                  <div className="space-y-2 max-w-md">
                    {form.promoBadge && (
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-500 text-white font-extrabold text-[10px] uppercase">
                        {form.promoBadge}
                      </span>
                    )}
                    <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">{form.title || 'Ad Headline'}</h3>
                    {form.subtitle && <p className="text-xs font-semibold text-cyan-200">{form.subtitle}</p>}
                    {form.description && <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{form.description}</p>}
                    {form.cta.enabled && (
                      <div className="pt-2">
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-full text-xs font-bold shadow-md">
                          <span>{form.cta.label || 'Shop Now'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="w-36 h-36 rounded-2xl overflow-hidden bg-slate-950/60 p-2 border border-white/10 shrink-0">
                    <img src={form.mainImage} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                  </div>
                </div>
              )}

              {/* Mode 2: Mobile / Sidebar Card */}
              {previewMode === 'card' && (
                <div
                  className="w-full max-w-xs rounded-2xl overflow-hidden p-4 border border-white/10 shadow-2xl space-y-3"
                  style={{ backgroundColor: form.backgroundColor }}
                >
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-950/60">
                    <img src={form.mainImage} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  {form.promoBadge && (
                    <span className="inline-block px-2 py-0.5 rounded-md bg-blue-500/30 text-blue-300 border border-blue-400/30 text-[10px] font-bold uppercase">
                      {form.promoBadge}
                    </span>
                  )}
                  <h4 className="text-sm font-black text-white leading-tight">{form.title || 'Ad Headline'}</h4>
                  {form.subtitle && <p className="text-xs text-cyan-200 font-medium">{form.subtitle}</p>}
                  {form.cta.enabled && (
                    <div className="w-full py-2 px-3 bg-blue-600 text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1">
                      <span>{form.cta.label || 'Shop Now'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              )}

              {/* Mode 3: Storefront Popup */}
              {previewMode === 'popup' && (
                <div
                  className="w-full max-w-lg rounded-3xl overflow-hidden border border-white/20 shadow-2xl flex flex-col sm:flex-row relative"
                  style={{ backgroundColor: form.backgroundColor }}
                >
                  <div className="sm:w-5/12 bg-slate-950/60 p-5 flex items-center justify-center shrink-0 border-b sm:border-b-0 sm:border-r border-white/10">
                    <div className="w-28 h-28 rounded-xl overflow-hidden shadow-lg border border-white/10">
                      <img src={form.mainImage} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="flex-1 p-5 space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      {form.promoBadge && (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold uppercase">
                          {form.promoBadge}
                        </span>
                      )}
                      <h4 className="text-base font-black text-white leading-tight">{form.title || 'Ad Headline'}</h4>
                      {form.subtitle && <p className="text-[11px] text-cyan-200">{form.subtitle}</p>}
                      {form.description && <p className="text-[11px] text-slate-300 line-clamp-2">{form.description}</p>}
                    </div>
                    {form.cta.enabled && (
                      <div className="pt-2 flex items-center gap-2">
                        <span className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1 shadow-md">
                          <span>{form.cta.label || 'Shop Now'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                        <span className="px-3 py-2 rounded-xl border border-white/20 text-xs text-slate-300">
                          Dismiss
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* SECTION 1: CAMPAIGN IDENTITY & HEADLINE */}
              <FormSection
                title="1. Campaign Information & Copywriting"
                description="Internal tracking identifier, storefront headline title, badges, and marketing copy."
                icon={<Megaphone className="w-4 h-4" />}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <FormField label="Internal Campaign Name" required hint="Used for internal admin tracking">
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Galaxy S25 Ultra Q1 Push"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-600 focus:outline-none transition"
                    />
                  </FormField>
                  <FormField label="Public Headline Title" required hint="Primary headline seen by store visitors">
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Flagship Galaxy S25 Ultra 5G"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <FormField label="Subtitle" hint="Secondary benefit or specification callout">
                    <input
                      type="text"
                      value={form.subtitle}
                      onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                      placeholder="e.g. Titanium Gray · 12GB RAM · 256GB"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition"
                    />
                  </FormField>
                  <FormField label="Promotional Badge Tag" hint="High-contrast eye-catcher badge">
                    <input
                      type="text"
                      value={form.promoBadge}
                      onChange={(e) => setForm({ ...form, promoBadge: e.target.value })}
                      placeholder="e.g. Official Warranty or Limited Stock 🔥"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition"
                    />
                  </FormField>
                </div>

                <FormField label="Description / Marketing Copy" hint="Supporting details and promotional message">
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="e.g. Experience next-gen Galaxy AI, revolutionary 200MP camera resolution, and ultra-fast delivery nationwide..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition"
                  />
                </FormField>
              </FormSection>

              {/* SECTION 2: CREATIVE ASSET */}
              <FormSection
                title="2. Promotional Image Asset"
                description="Upload device artwork or product photography from device or provide CDN URL."
                icon={<Sparkles className="w-4 h-4" />}
              >
                <ImageUploadInput
                  label="Main Advertisement Image"
                  required
                  value={form.mainImage}
                  onChange={(url) => setForm({ ...form, mainImage: url })}
                  placeholder="https://images.unsplash.com/..."
                  helperText="Recommended square or portrait PNG/JPG with clean transparent or dark backdrop."
                />
              </FormSection>

              {/* SECTION 3: STOREFRONT PLACEMENTS */}
              <FormSection
                title="3. Storefront Placements & Pop-up Targeting"
                description="Select all placements across the store where this campaign should be eligible."
                icon={<Layers className="w-4 h-4" />}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {AVAILABLE_PLACEMENTS.map((p) => {
                    const isSelected = form.placements.includes(p.id);
                    const isPopup = p.id === 'popup_modal';
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlacement(p.id)}
                        className={`p-3 rounded-2xl text-xs font-bold text-left border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? isPopup
                              ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
                              : 'bg-blue-50/90 border-blue-300 text-blue-950 shadow-xs'
                            : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span className="block truncate">{p.label}</span>
                          {isPopup && (
                            <span className="text-[10px] text-amber-700 font-medium block">
                              Promotional Overlay Pop-up
                            </span>
                          )}
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-black ${
                            isSelected
                              ? isPopup
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && '✓'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </FormSection>

              {/* SECTION 4: CALL TO ACTION */}
              <FormSection
                title="4. Call to Action (CTA) & Destination Link"
                description="Configure the interactive action button and destination route or external URL."
                icon={<ArrowRight className="w-4 h-4" />}
              >
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-bold text-slate-800">Show Action Button</span>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.cta.enabled}
                      onChange={(e) => setForm({ ...form, cta: { ...form.cta, enabled: e.target.checked } })}
                      className="rounded text-blue-600 w-4 h-4"
                    />
                    <span>{form.cta.enabled ? 'CTA Enabled' : 'CTA Disabled'}</span>
                  </label>
                </div>

                {form.cta.enabled && (
                  <div className="space-y-3.5 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <FormField label="Button Label" required>
                        <input
                          type="text"
                          value={form.cta.label}
                          onChange={(e) => setForm({ ...form, cta: { ...form.cta, label: e.target.value } })}
                          placeholder="Shop Now"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-600 focus:outline-none transition"
                        />
                      </FormField>

                      <FormField label="Destination URL" required hint="Internal or External URL">
                        <input
                          type="text"
                          value={form.cta.url}
                          onChange={(e) => setForm({ ...form, cta: { ...form.cta, url: e.target.value } })}
                          placeholder="/shop or https://..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-blue-600 focus:outline-none transition"
                        />
                      </FormField>

                      <FormField label="Target Window">
                        <select
                          value={form.cta.target}
                          onChange={(e) => setForm({ ...form, cta: { ...form.cta, target: e.target.value as any } })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition"
                        >
                          <option value="_self">Same Tab (_self)</option>
                          <option value="_blank">New Tab (_blank)</option>
                        </select>
                      </FormField>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <FormField label="Button Background Color">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={form.cta.bgColor || '#2563eb'}
                            onChange={(e) => setForm({ ...form, cta: { ...form.cta, bgColor: e.target.value } })}
                            className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer"
                          />
                          <span className="font-mono text-xs font-bold text-slate-700">{form.cta.bgColor || '#2563eb'}</span>
                        </div>
                      </FormField>

                      <FormField label="Button Text Color">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={form.cta.textColor || '#ffffff'}
                            onChange={(e) => setForm({ ...form, cta: { ...form.cta, textColor: e.target.value } })}
                            className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer"
                          />
                          <span className="font-mono text-xs font-bold text-slate-700">{form.cta.textColor || '#ffffff'}</span>
                        </div>
                      </FormField>
                    </div>
                  </div>
                )}
              </FormSection>

              {/* SECTION 5: DISMISSAL & CLOSE POLICY */}
              <FormSection
                title="5. Close Button & Dismissal Frequency Policy"
                description="Control how long the advertisement stays hidden after a visitor dismisses it."
                icon={<X className="w-4 h-4" />}
              >
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-bold text-slate-800">Allow Visitor Dismissal</span>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.closeButton.enabled}
                      onChange={(e) =>
                        setForm({ ...form, closeButton: { ...form.closeButton, enabled: e.target.checked } })
                      }
                      className="rounded text-blue-600 w-4 h-4"
                    />
                    <span>{form.closeButton.enabled ? 'Close Button Active' : 'Close Button Hidden'}</span>
                  </label>
                </div>

                {form.closeButton.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                    <FormField label="Dismissal Policy" hint="Storage duration">
                      <select
                        value={form.closeButton.dismissalPolicy}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            closeButton: { ...form.closeButton, dismissalPolicy: e.target.value as any },
                          })
                        }
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-600 focus:outline-none transition"
                      >
                        <option value="session">Current Browser Session (Recommended)</option>
                        <option value="duration">Fixed Duration in Hours</option>
                        <option value="until_reload">Until Page Reload (Transient)</option>
                        <option value="until_expiration">Until Ad Expiration Date</option>
                      </select>
                    </FormField>

                    {form.closeButton.dismissalPolicy === 'duration' && (
                      <FormField label="Hide Duration (Hours)" hint="Time before re-showing">
                        <input
                          type="number"
                          min="1"
                          max="720"
                          value={form.closeButton.dismissalDurationHours}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              closeButton: {
                                ...form.closeButton,
                                dismissalDurationHours: Number(e.target.value) || 24,
                              },
                            })
                          }
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-blue-600 focus:outline-none transition"
                        />
                      </FormField>
                    )}

                    <FormField label="Close Button Visual Style">
                      <select
                        value={form.closeButton.appearance}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            closeButton: { ...form.closeButton, appearance: e.target.value as any },
                          })
                        }
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition"
                      >
                        <option value="circle">Circular Translucent (Standard)</option>
                        <option value="pill">Pill with 'Close' text</option>
                        <option value="minimal">Minimal Subtle Icon</option>
                      </select>
                    </FormField>
                  </div>
                )}
              </FormSection>

              {/* SECTION 6: DEVICE & TIMING CONTROLS */}
              <FormSection
                title="6. Audience Targeting & Flight Dates"
                description="Hardware device targeting, priority conflict resolution, and schedule dates."
                icon={<Calendar className="w-4 h-4" />}
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                  <FormField label="Device Targeting">
                    <select
                      value={form.deviceTargeting}
                      onChange={(e) => setForm({ ...form, deviceTargeting: e.target.value as any })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-blue-600 focus:outline-none transition"
                    >
                      <option value="all">All Devices (Responsive)</option>
                      <option value="desktop_only">Desktop Only</option>
                      <option value="mobile_only">Mobile Only</option>
                      <option value="tablet_only">Tablet Only</option>
                    </select>
                  </FormField>

                  <FormField label="Priority" hint="1 = Top priority">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 1 })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black focus:bg-white focus:border-blue-600 focus:outline-none transition"
                    />
                  </FormField>

                  <FormField label="Flight Start Date" hint="Optional start time">
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition"
                    />
                  </FormField>

                  <FormField label="Flight End Date" hint="Optional auto-expire">
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition"
                    />
                  </FormField>
                </div>
              </FormSection>
            </>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              className="p-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold"
            >
              <option value="published">Published & Active</option>
              <option value="draft">Save as Draft</option>
              <option value="archived">Archived</option>
            </select>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                {editingAd ? 'Save Changes' : 'Create Advertisement'}
              </button>
            </div>
          </div>
        </form>
      </AdminModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDeleteAd}
        title="Delete Advertisement"
        recordIdentifier={deleteDialog.name}
        message="Are you sure you want to permanently delete this advertisement? All storefront impressions and dismissal states for this ad will be removed immediately."
        isConfirming={deleteDialog.isConfirming}
        confirmLabel="Delete Advertisement"
        variant="danger"
      />

      {/* Advertisement Details Drawer */}
      <AdvertisementDetailsDrawer
        isOpen={!!inspectingAd}
        onClose={() => setInspectingAd(null)}
        advertisement={inspectingAd}
        onEdit={(ad) => {
          setInspectingAd(null);
          handleOpenEdit(ad);
        }}
      />
    </div>
  );
};
