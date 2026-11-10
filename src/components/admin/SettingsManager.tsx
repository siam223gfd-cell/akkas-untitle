import React, { useEffect, useState } from 'react';
import { StoreSettings, ProviderConfigurationStatus } from '../../types';
import {
  Settings,
  CreditCard,
  Truck,
  Percent,
  Bell,
  Save,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';

interface SettingsManagerProps {
  initialSettings?: StoreSettings;
  activeSubTab?: 'general' | 'payment' | 'shipping' | 'tax' | 'notifications';
  onRefresh: () => void;
}

function buildSettingsState(initialSettings?: StoreSettings): StoreSettings {
  return {
    storeName: initialSettings?.storeName ?? 'Aurelia',
    tagline: initialSettings?.tagline ?? 'Shop Smart, Live Better',
    supportPhone: initialSettings?.supportPhone ?? '+880 1234 567890',
    supportEmail: initialSettings?.supportEmail ?? 'support@aurelia.com',
    currencySymbol: initialSettings?.currencySymbol ?? '৳',
    currencyCode: initialSettings?.currencyCode ?? 'BDT',
    freeShippingThreshold: initialSettings?.freeShippingThreshold ?? 1000,
    shippingDhaka: initialSettings?.shippingDhaka ?? 60,
    shippingOutsideDhaka: initialSettings?.shippingOutsideDhaka ?? 120,
    taxRate: initialSettings?.taxRate ?? 0,
    paymentMethods: {
      cod: initialSettings?.paymentMethods?.cod ?? true,
      bkash: initialSettings?.paymentMethods?.bkash ?? true,
      nagad: initialSettings?.paymentMethods?.nagad ?? true,
      card: initialSettings?.paymentMethods?.card ?? true,
    },
    notifications: {
      newOrderEmail: initialSettings?.notifications?.newOrderEmail ?? true,
      lowStockAlert: initialSettings?.notifications?.lowStockAlert ?? true,
    },
  };
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  initialSettings,
  activeSubTab = 'general',
  onRefresh,
}) => {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<'general' | 'payment' | 'shipping' | 'tax' | 'notifications'>(activeSubTab);
  const [isSaving, setIsSaving] = useState(false);

  const [settings, setSettings] = useState<StoreSettings>(() => buildSettingsState(initialSettings));
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigurationStatus[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);

  const fetchProviderConfigs = async () => {
    setIsLoadingConfigs(true);
    try {
      const res = await apiRequest<{ success: boolean; providers: ProviderConfigurationStatus[] }>('/payments/providers/config');
      if (res?.success && Array.isArray(res.providers)) {
        setProviderConfigs(res.providers);
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  useEffect(() => {
    if (tab === 'payment') {
      fetchProviderConfigs();
    }
  }, [tab]);

  useEffect(() => {
    setTab(activeSubTab);
  }, [activeSubTab]);

  useEffect(() => {
    if (initialSettings) {
      setSettings(buildSettingsState(initialSettings));
    }
  }, [initialSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const res = await apiRequest('/cms/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    setIsSaving(false);

    if (res.success) {
      onRefresh();
      dispatch(
        addToast({
          type: 'success',
          title: 'Settings Saved',
          message: 'Store configuration and checkout parameters have been updated.',
        })
      );
    } else {
      dispatch(
        addToast({
          type: 'error',
          title: 'Save Failed',
          message: res.message || 'Could not update settings.',
        })
      );
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">E-Commerce System Configuration</h2>
            <p className="text-xs text-slate-500">
              Manage store branding, carrier logistics, payment gateways, and tax rules.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl overflow-x-auto self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTab('general')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'general' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setTab('payment')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'payment' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Payment Methods
          </button>
          <button
            type="button"
            onClick={() => setTab('shipping')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'shipping' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Shipping Rates
          </button>
          <button
            type="button"
            onClick={() => setTab('tax')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'tax' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tax & Fees
          </button>
          <button
            type="button"
            onClick={() => setTab('notifications')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tab === 'notifications' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Notifications
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        {/* SUBTAB 1: GENERAL SETTINGS */}
        {tab === 'general' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Brand Identity & Support Channels</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Name</label>
                <input
                  type="text"
                  required
                  value={settings.storeName}
                  onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Support Phone (+880)</label>
                <input
                  type="text"
                  value={settings.supportPhone}
                  onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Support Email</label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={settings.currencySymbol}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency Code</label>
                <input
                  type="text"
                  value={settings.currencyCode}
                  onChange={(e) => setSettings({ ...settings, currencyCode: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: PAYMENT METHODS */}
        {tab === 'payment' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Supported Payment Gateways & Gate Toggles</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Cash on Delivery (COD)</h4>
                  <p className="text-[11px] text-slate-500">Allow customers across all 64 districts to pay in cash upon receiving package.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.paymentMethods.cod}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      paymentMethods: { ...settings.paymentMethods, cod: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">bKash Merchant Payment</h4>
                  <p className="text-[11px] text-slate-500">Accept instant mobile financial service payments via bKash gateway.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.paymentMethods.bkash}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      paymentMethods: { ...settings.paymentMethods, bkash: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Nagad Merchant Payment</h4>
                  <p className="text-[11px] text-slate-500">Accept digital postal money transactions via Nagad MFS.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.paymentMethods.nagad}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      paymentMethods: { ...settings.paymentMethods, nagad: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Credit & Debit Card (Visa / Mastercard)</h4>
                  <p className="text-[11px] text-slate-500">Support domestic and international bank cards via secure payment gateway.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.paymentMethods.card}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      paymentMethods: { ...settings.paymentMethods, card: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>
            </div>

            {/* Gateway Diagnostic & Production Readiness */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Real-World Gateway Credentials & Production Status</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Live verification against server environment variables (.env). Fake/mock verifications are permanently disabled.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchProviderConfigs}
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  {isLoadingConfigs ? 'Checking...' : 'Refresh Status'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {providerConfigs.map((prov) => (
                  <div
                    key={prov.provider}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900">{prov.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          prov.isConfigured
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {prov.isConfigured ? 'Configured' : 'Credentials Missing'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <span>Mode:</span>
                      <span className="font-mono font-bold text-slate-800 uppercase px-1.5 py-0.2 bg-slate-200 rounded">
                        {prov.environment}
                      </span>
                    </div>

                    {prov.missingCredentials && prov.missingCredentials.length > 0 && (
                      <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[10px] text-amber-900">
                        <span className="font-bold block mb-0.5">Missing Keys in .env:</span>
                        <div className="flex flex-wrap gap-1 font-mono">
                          {prov.missingCredentials.map((key) => (
                            <span key={key} className="px-1.5 py-0.5 rounded bg-white border border-amber-300 text-amber-950 font-semibold">
                              {key}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 3: SHIPPING SETTINGS */}
        {tab === 'shipping' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Carrier Delivery Rates & Free Delivery Threshold</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Inside Dhaka City Fee (৳)</label>
                <input
                  type="number"
                  min={0}
                  value={settings.shippingDhaka}
                  onChange={(e) => setSettings({ ...settings, shippingDhaka: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Outside Dhaka City Fee (৳)</label>
                <input
                  type="number"
                  min={0}
                  value={settings.shippingOutsideDhaka}
                  onChange={(e) => setSettings({ ...settings, shippingOutsideDhaka: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Free Delivery Min. Order (৳)</label>
                <input
                  type="number"
                  min={0}
                  value={settings.freeShippingThreshold}
                  onChange={(e) => setSettings({ ...settings, freeShippingThreshold: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-700"
                />
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 4: TAX & FEES */}
        {tab === 'tax' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">VAT & Consumer Retail Tax Rules</h3>
            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 mb-1">VAT Percentage (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={settings.taxRate}
                onChange={(e) => setSettings({ ...settings, taxRate: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Set to 0 if retail prices are VAT-inclusive.</span>
            </div>
          </div>
        )}

        {/* SUBTAB 5: NOTIFICATIONS */}
        {tab === 'notifications' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Store Alerting Channels</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">New Order Email Notification</h4>
                  <p className="text-[11px] text-slate-500">Dispatch email to staff on every confirmed checkout.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications?.newOrderEmail ?? true}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: {
                        newOrderEmail: e.target.checked,
                        lowStockAlert: settings.notifications?.lowStockAlert ?? true,
                      },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Low Stock Alert</h4>
                  <p className="text-[11px] text-slate-500">Notify catalog managers when inventory dips below 10 units.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications?.lowStockAlert ?? true}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: {
                        newOrderEmail: settings.notifications?.newOrderEmail ?? true,
                        lowStockAlert: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/30 flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Settings...' : 'Save All Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
