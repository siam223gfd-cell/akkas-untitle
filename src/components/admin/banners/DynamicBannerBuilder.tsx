import React, { useState } from 'react';
import { DynamicBanner, BannerLayer, BannerButton, BackgroundType } from '../../../types';
import {
  ArrowLeft,
  Save,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Plus,
  Trash2,
  Layers as LayersIcon,
  Palette,
  Layout,
  MousePointer,
  Calendar,
  Sparkles,
  ArrowRight,
  Check,
  Type,
  Maximize2,
  Sliders,
} from 'lucide-react';
import { ImageUploadInput } from '../../common/ImageUploadInput';
import { PublicDynamicBanner } from '../../public/PublicDynamicBanner';

interface DynamicBannerBuilderProps {
  initialBanner?: DynamicBanner | null;
  onSave: (bannerData: Partial<DynamicBanner>) => Promise<void>;
  onCancel: () => void;
}

const DEFAULT_BANNER: DynamicBanner = {
  name: 'New Promotional Campaign Banner',
  slug: `banner-${Date.now().toString().slice(-6)}`,
  status: 'published',
  placements: ['mid_banner'],
  priority: 1,
  background: {
    type: 'combined',
    color: '#001736',
    opacity: 100,
    imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80',
    imagePosition: 'center',
    imageSize: 'cover',
    imageRepeat: 'no-repeat',
    overlayColor: '#001128',
    overlayOpacity: 70,
    gradient: {
      type: 'linear',
      angle: 90,
      direction: 'to right',
      stops: [
        { color: '#001736', stop: 0 },
        { color: '#002f6c', stop: 100 },
      ],
      opacity: 95,
    },
  },
  layout: {
    width: '100%',
    height: 'auto',
    minHeight: '320px',
    padding: { top: 36, right: 36, bottom: 36, left: 36 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    contentAlign: 'left',
    verticalAlign: 'center',
    containerWidth: '60%',
  },
  layers: [
    {
      id: 'layer-badge',
      type: 'badge',
      text: 'SPECIAL PROMOTION ⚡',
      fontSize: 11,
      fontWeight: '800',
      textColor: '#93c5fd',
      textAlign: 'left',
      opacity: 100,
      zIndex: 2,
      isVisible: true,
      position: { x: 0, y: 0, mode: 'flow' },
    },
    {
      id: 'layer-heading',
      type: 'heading',
      text: 'Next-Gen Flagship Audio & Tech',
      fontSize: 32,
      fontWeight: '900',
      textColor: '#ffffff',
      textAlign: 'left',
      opacity: 100,
      zIndex: 2,
      isVisible: true,
      position: { x: 0, y: 0, mode: 'flow' },
    },
    {
      id: 'layer-desc',
      type: 'description',
      text: 'Upgrade your daily workflow with authentic brand gear and ultra-fast nationwide delivery.',
      fontSize: 13,
      fontWeight: '400',
      textColor: '#cbd5e1',
      textAlign: 'left',
      opacity: 95,
      zIndex: 2,
      isVisible: true,
      position: { x: 0, y: 0, mode: 'flow' },
    },
  ],
  buttons: [
    {
      id: 'btn-1',
      label: 'Explore Catalog',
      url: '/shop',
      target: '_self',
      variant: 'primary',
      bgColor: '#2563eb',
      textColor: '#ffffff',
      borderRadius: 9999,
      paddingX: 22,
      paddingY: 11,
      fontSize: 13,
      fontWeight: '700',
      hoverAnimation: 'scale',
      icon: 'ArrowRight',
      iconPosition: 'right',
      isVisible: true,
    },
  ],
  responsive: {
    tablet: { minHeight: '280px', paddingScale: 0.8, fontScale: 0.9 },
    mobile: { minHeight: '240px', paddingScale: 0.6, fontScale: 0.8, stackButtons: true },
  },
};

const THEME_PRESETS = [
  {
    name: 'Aurelia Deep Navy',
    color1: '#001736',
    color2: '#002f6c',
    textColor: '#ffffff',
    btnBg: '#2563eb',
  },
  {
    name: 'Cyber Onyx & Blue',
    color1: '#060d19',
    color2: '#0d2847',
    textColor: '#ffffff',
    btnBg: '#0284c7',
  },
  {
    name: 'Royal Amethyst',
    color1: '#1e1035',
    color2: '#3b1c6e',
    textColor: '#ffffff',
    btnBg: '#8b5cf6',
  },
  {
    name: 'Emerald Prestige',
    color1: '#062016',
    color2: '#0d402e',
    textColor: '#ffffff',
    btnBg: '#10b981',
  },
  {
    name: 'Sunset Coral',
    color1: '#260a18',
    color2: '#57172b',
    textColor: '#ffffff',
    btnBg: '#f43f5e',
  },
];

const AVAILABLE_PLACEMENTS = [
  { id: 'mid_banner', label: 'Mid-Page Feature (Live Smarter)' },
  { id: 'home_hero_banner', label: 'Homepage Secondary Hero' },
  { id: 'split_left', label: 'Split Left (Summer Sale)' },
  { id: 'split_right', label: 'Split Right (Next-Gen Tech)' },
  { id: 'plp_banner', label: 'Product Listing Top Banner' },
  { id: 'pdp_banner', label: 'Product Detail Promo Banner' },
  { id: 'sponsored', label: 'Sponsored Section' },
];

export const DynamicBannerBuilder: React.FC<DynamicBannerBuilderProps> = ({
  initialBanner,
  onSave,
  onCancel,
}) => {
  const [banner, setBanner] = useState<DynamicBanner>(() => {
    if (initialBanner) {
      return {
        ...DEFAULT_BANNER,
        ...initialBanner,
        background: { ...DEFAULT_BANNER.background, ...(initialBanner.background || {}) },
        layout: { ...DEFAULT_BANNER.layout, ...(initialBanner.layout || {}) },
        layers: initialBanner.layers?.length ? initialBanner.layers : DEFAULT_BANNER.layers,
        buttons: initialBanner.buttons?.length ? initialBanner.buttons : DEFAULT_BANNER.buttons,
      };
    }
    return DEFAULT_BANNER;
  });

  const [activeTab, setActiveTab] = useState<'content' | 'cta' | 'background' | 'placement'>('content');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isSaving, setIsSaving] = useState(false);

  // Helper to update specific layer by type or index
  const updateLayer = (id: string, updates: Partial<BannerLayer>) => {
    setBanner((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  };

  const handleAddLayer = (type: 'badge' | 'heading' | 'description' | 'custom_text') => {
    const newLayer: BannerLayer = {
      id: `layer-${Date.now()}`,
      type,
      text: type === 'badge' ? 'NEW OFFER' : type === 'heading' ? 'Eye-Catching Headline' : 'Supporting descriptive text goes here.',
      fontSize: type === 'badge' ? 11 : type === 'heading' ? 28 : 13,
      fontWeight: type === 'heading' ? '800' : '500',
      textColor: '#ffffff',
      textAlign: 'left',
      opacity: 100,
      zIndex: 2,
      isVisible: true,
      position: { x: 0, y: 0, mode: 'flow' },
    };
    setBanner((prev) => ({
      ...prev,
      layers: [...prev.layers, newLayer],
    }));
  };

  const handleRemoveLayer = (id: string) => {
    setBanner((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== id),
    }));
  };

  // Helper to update primary CTA button
  const updatePrimaryButton = (updates: Partial<BannerButton>) => {
    setBanner((prev) => {
      const currentButtons = prev.buttons || [];
      if (currentButtons.length === 0) {
        return {
          ...prev,
          buttons: [
            {
              id: 'btn-1',
              label: 'Explore Catalog',
              url: '/shop',
              target: '_self',
              variant: 'primary',
              bgColor: '#2563eb',
              textColor: '#ffffff',
              borderRadius: 9999,
              paddingX: 22,
              paddingY: 11,
              fontSize: 13,
              fontWeight: '700',
              hoverAnimation: 'scale',
              icon: 'ArrowRight',
              iconPosition: 'right',
              isVisible: true,
              ...updates,
            },
          ],
        };
      }
      return {
        ...prev,
        buttons: [{ ...currentButtons[0], ...updates }],
      };
    });
  };

  // Apply theme preset
  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    setBanner((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        color: preset.color1,
        gradient: {
          type: 'linear',
          angle: 90,
          direction: 'to right',
          stops: [
            { color: preset.color1, stop: 0 },
            { color: preset.color2, stop: 100 },
          ],
          opacity: 95,
        },
      },
      buttons: (prev.buttons || []).map((b) => ({ ...b, bgColor: preset.btnBg })),
    }));
  };

  const handleTogglePlacement = (placementId: string) => {
    setBanner((prev) => {
      const current = prev.placements || [];
      const exists = current.includes(placementId);
      const updated = exists ? current.filter((p) => p !== placementId) : [...current, placementId];
      return { ...prev, placements: updated.length ? updated : ['mid_banner'] };
    });
  };

  const handleSubmitSave = async () => {
    setIsSaving(true);
    try {
      await onSave(banner);
    } finally {
      setIsSaving(false);
    }
  };

  const primaryButton = banner.buttons?.[0] || DEFAULT_BANNER.buttons[0];

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-slate-100 rounded-3xl border border-slate-200 overflow-hidden shadow-xl animate-in fade-in duration-200">
      {/* 1. TOP STUDIO HEADER */}
      <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Exit Studio</span>
          </button>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div>
            <input
              type="text"
              value={banner.name}
              onChange={(e) => setBanner({ ...banner, name: e.target.value })}
              className="text-sm font-black text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none transition px-1 py-0.5 rounded"
              placeholder="Banner Campaign Name"
            />
            <span className="text-[10px] text-slate-400 block px-1">
              Slug: <span className="font-mono">{banner.slug}</span>
            </span>
          </div>
        </div>

        {/* Center: Device Switcher */}
        <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setPreviewDevice('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              previewDevice === 'desktop' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewDevice('tablet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              previewDevice === 'tablet' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Tablet (768px)</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewDevice('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              previewDevice === 'mobile' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile (375px)</span>
          </button>
        </div>

        {/* Right: Status & Save */}
        <div className="flex items-center gap-3">
          <select
            value={banner.status}
            onChange={(e) => setBanner({ ...banner, status: e.target.value as any })}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              banner.status === 'published'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          <button
            type="button"
            onClick={handleSubmitSave}
            disabled={isSaving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition cursor-pointer hover:scale-102"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Banner'}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN 2-COLUMN STUDIO WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT / CENTER: LIVE INTERACTIVE PREVIEW STAGE */}
        <main className="flex-1 bg-slate-900/90 overflow-y-auto p-6 sm:p-8 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between pb-4 text-slate-400 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-300">Live Preview Stage</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {previewDevice === 'desktop' ? 'Full Responsive Width' : previewDevice === 'tablet' ? '768px Viewport' : '375px Viewport'}
            </span>
          </div>

          {/* Device Frame Viewport */}
          <div
            className={`w-full transition-all duration-300 flex items-center justify-center my-auto ${
              previewDevice === 'desktop'
                ? 'max-w-5xl'
                : previewDevice === 'tablet'
                ? 'max-w-[768px]'
                : 'max-w-[375px]'
            }`}
          >
            <div className="w-full rounded-3xl overflow-hidden shadow-2xl border border-white/10 p-1 bg-slate-950/60 backdrop-blur-md">
              <PublicDynamicBanner banner={banner} ignoreStatus={true} />
            </div>
          </div>

          {/* Quick Palette Preset Bar */}
          <div className="w-full max-w-2xl mt-6 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>One-Click Color Presets:</span>
            </span>
            <div className="flex items-center gap-2">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white transition hover:scale-105 border border-white/20 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  style={{ background: `linear-gradient(90deg, ${preset.color1}, ${preset.color2})` }}
                  title={`Apply ${preset.name}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.btnBg }} />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
        </main>

        {/* RIGHT: STRUCTURED CONFIGURATION CONTROLS */}
        <aside className="w-96 bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-lg z-10">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'content' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Content</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cta')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'cta' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>CTA Button</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('background')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'background' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Background</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('placement')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'placement' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Placement</span>
            </button>
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            {/* TAB 1: CONTENT & MESSAGING */}
            {activeTab === 'content' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-sm">Banner Text & Messaging</h3>
                  <p className="text-[11px] text-slate-500">Edit the primary headline, promotional badge, and supporting text.</p>
                </div>

                {/* Layer list */}
                <div className="space-y-3">
                  {banner.layers.map((layer) => (
                    <div key={layer.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono font-bold text-[10px] uppercase">
                          {layer.type}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateLayer(layer.id, { isVisible: !layer.isVisible })}
                            className={`p-1 rounded-md text-[10px] font-bold ${
                              layer.isVisible ? 'text-emerald-700 bg-emerald-100' : 'text-slate-400 bg-slate-200'
                            }`}
                          >
                            {layer.isVisible ? 'Visible' : 'Hidden'}
                          </button>
                          {banner.layers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLayer(layer.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Text Content</label>
                        <input
                          type="text"
                          value={layer.text || ''}
                          onChange={(e) => updateLayer(layer.id, { text: e.target.value })}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Text Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={layer.textColor}
                              onChange={(e) => updateLayer(layer.id, { textColor: e.target.value })}
                              className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                            />
                            <span className="font-mono text-[10px] text-slate-600">{layer.textColor}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Font Size (px)</label>
                          <input
                            type="number"
                            min="10"
                            max="72"
                            value={layer.fontSize}
                            onChange={(e) => updateLayer(layer.id, { fontSize: Number(e.target.value) })}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Layer Quick Buttons */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500">Add Element:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddLayer('badge')}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-[10px] transition cursor-pointer"
                    >
                      + Badge
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddLayer('heading')}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-[10px] transition cursor-pointer"
                    >
                      + Heading
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddLayer('description')}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-[10px] transition cursor-pointer"
                    >
                      + Description
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CALL TO ACTION BUTTON */}
            {activeTab === 'cta' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-sm">Action Button (CTA)</h3>
                  <p className="text-[11px] text-slate-500">Configure the destination link and button presentation.</p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Enable Button</span>
                    <button
                      type="button"
                      onClick={() => updatePrimaryButton({ isVisible: !primaryButton.isVisible })}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                        primaryButton.isVisible ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {primaryButton.isVisible ? 'Active' : 'Disabled'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Button Label *</label>
                    <input
                      type="text"
                      value={primaryButton.label}
                      onChange={(e) => updatePrimaryButton({ label: e.target.value })}
                      placeholder="e.g. Explore Deals"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Destination URL *</label>
                    <input
                      type="text"
                      value={primaryButton.url}
                      onChange={(e) => updatePrimaryButton({ url: e.target.value })}
                      placeholder="e.g. /shop or https://..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Button Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={primaryButton.bgColor}
                          onChange={(e) => updatePrimaryButton({ bgColor: e.target.value })}
                          className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                        />
                        <span className="font-mono text-[10px] text-slate-600">{primaryButton.bgColor}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Text Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={primaryButton.textColor}
                          onChange={(e) => updatePrimaryButton({ textColor: e.target.value })}
                          className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                        />
                        <span className="font-mono text-[10px] text-slate-600">{primaryButton.textColor}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Open Link In</label>
                    <select
                      value={primaryButton.target}
                      onChange={(e) => updatePrimaryButton({ target: e.target.value as any })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="_self">Same Tab (_self)</option>
                      <option value="_blank">New Tab (_blank)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BACKGROUND & VISUALS */}
            {activeTab === 'background' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-sm">Background Atmosphere</h3>
                  <p className="text-[11px] text-slate-500">Configure background imagery, gradients, and overlay tints.</p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Background Style Mode</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['combined', 'gradient', 'image'] as BackgroundType[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setBanner({ ...banner, background: { ...banner.background, type: mode } })}
                          className={`py-2 px-2 text-[10px] font-bold rounded-xl border text-center uppercase transition cursor-pointer ${
                            banner.background.type === mode
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {mode === 'combined' ? 'Image + Tint' : mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Image Upload if mode is image or combined */}
                  {(banner.background.type === 'combined' || banner.background.type === 'image') && (
                    <ImageUploadInput
                      label="Background Hero Photo"
                      value={banner.background.imageUrl || ''}
                      onChange={(url) => setBanner({ ...banner, background: { ...banner.background, imageUrl: url } })}
                      placeholder="https://images.unsplash.com/..."
                      helperText="High-resolution landscape image (1200x500 recommended)."
                      aspectRatio="banner"
                    />
                  )}

                  {/* Gradient Colors */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Atmosphere Gradient Tint</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Start Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={banner.background.gradient?.stops?.[0]?.color || '#001736'}
                            onChange={(e) => {
                              const newColor = e.target.value;
                              const stops = [...(banner.background.gradient?.stops || [{ color: '#001736', stop: 0 }, { color: '#002f6c', stop: 100 }])];
                              stops[0] = { ...stops[0], color: newColor };
                              setBanner({
                                ...banner,
                                background: {
                                  ...banner.background,
                                  color: newColor,
                                  gradient: { ...banner.background.gradient!, stops },
                                },
                              });
                            }}
                            className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                          />
                          <span className="font-mono text-[10px] text-slate-600">
                            {banner.background.gradient?.stops?.[0]?.color || '#001736'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">End Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={banner.background.gradient?.stops?.[1]?.color || '#002f6c'}
                            onChange={(e) => {
                              const newColor = e.target.value;
                              const stops = [...(banner.background.gradient?.stops || [{ color: '#001736', stop: 0 }, { color: '#002f6c', stop: 100 }])];
                              stops[1] = { ...stops[1], color: newColor };
                              setBanner({
                                ...banner,
                                background: {
                                  ...banner.background,
                                  gradient: { ...banner.background.gradient!, stops },
                                },
                              });
                            }}
                            className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                          />
                          <span className="font-mono text-[10px] text-slate-600">
                            {banner.background.gradient?.stops?.[1]?.color || '#002f6c'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dark Overlay Tint Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-500">Dark Overlay Readability Tint</label>
                      <span className="font-mono text-[10px] text-slate-700 font-bold">{banner.background.overlayOpacity || 70}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="95"
                      value={banner.background.overlayOpacity || 70}
                      onChange={(e) =>
                        setBanner({
                          ...banner,
                          background: { ...banner.background, overlayOpacity: Number(e.target.value) },
                        })
                      }
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PLACEMENT & LAYOUT */}
            {activeTab === 'placement' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-sm">Placements & Scheduling</h3>
                  <p className="text-[11px] text-slate-500">Select where this banner appears across the website catalog.</p>
                </div>

                {/* Placements Checklist */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500">Storefront Placements</label>
                  <div className="space-y-1.5">
                    {AVAILABLE_PLACEMENTS.map((p) => {
                      const isSelected = banner.placements?.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleTogglePlacement(p.id)}
                          className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{p.label}</span>
                          <span
                            className={`w-4 h-4 rounded-md flex items-center justify-center border text-[10px] ${
                              isSelected ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Priority */}
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Display Priority (1 = Top)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={banner.priority || 1}
                      onChange={(e) => setBanner({ ...banner, priority: Number(e.target.value) })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Minimum Banner Height</label>
                    <select
                      value={banner.layout?.minHeight || '320px'}
                      onChange={(e) =>
                        setBanner({
                          ...banner,
                          layout: { ...banner.layout, minHeight: e.target.value },
                        })
                      }
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="260px">Compact (260px)</option>
                      <option value="320px">Standard (320px)</option>
                      <option value="400px">Hero Large (400px)</option>
                      <option value="480px">Cinematic (480px)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
