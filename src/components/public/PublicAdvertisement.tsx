import React, { useState, useEffect } from 'react';
import { Advertisement } from '../../types';
import { apiRequest } from '../../services/api';
import { SafeLink } from '../common/SafeLink';
import { X, ArrowRight, Sparkles, Tag, ShieldCheck } from 'lucide-react';

interface PublicAdvertisementProps {
  placement: string;
  className?: string;
  variant?: 'banner' | 'card' | 'sidebar' | 'inline';
}

const DISMISSAL_PREFIX = 'novara_ad_dismissed_';

export const PublicAdvertisement: React.FC<PublicAdvertisementProps> = ({
  placement,
  className = '',
  variant = 'banner',
}) => {
  const [ad, setAd] = useState<Advertisement | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

  useEffect(() => {
    let isMounted = true;
    apiRequest(`/advertisements/placement/${placement}`)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.advertisements && res.advertisements.length > 0) {
          // Find first ad not dismissed according to its dismissal policy
          for (const item of res.advertisements) {
            const adId = item._id || item.id;
            const policy = item.closeButton?.dismissalPolicy || 'session';
            let dismissed = false;

            if (policy === 'until_reload') {
              dismissed = false; // in-memory only
            } else if (policy === 'session') {
              dismissed = sessionStorage.getItem(`${DISMISSAL_PREFIX}${adId}`) === 'true';
            } else if (policy === 'duration') {
              const dismissedAt = localStorage.getItem(`${DISMISSAL_PREFIX}${adId}_time`);
              if (dismissedAt) {
                const diffHours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
                const maxHours = item.closeButton?.dismissalDurationHours || 24;
                if (diffHours < maxHours) {
                  dismissed = true;
                } else {
                  localStorage.removeItem(`${DISMISSAL_PREFIX}${adId}_time`);
                }
              }
            } else if (policy === 'until_expiration') {
              dismissed = localStorage.getItem(`${DISMISSAL_PREFIX}${adId}_expired`) === 'true';
            }

            if (!dismissed) {
              setAd(item);
              break;
            }
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [placement]);

  // Track impression once visible
  useEffect(() => {
    if (ad && !hasTrackedImpression && !isDismissed) {
      setHasTrackedImpression(true);
      const adId = ad._id || ad.id;
      if (adId) {
        apiRequest(`/advertisements/${adId}/impression`, { method: 'POST' }).catch(() => {});
      }
    }
  }, [ad, hasTrackedImpression, isDismissed]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!ad) return;

    setIsDismissed(true);
    const adId = ad._id || ad.id;
    const policy = ad.closeButton?.dismissalPolicy || 'session';

    if (policy === 'session') {
      sessionStorage.setItem(`${DISMISSAL_PREFIX}${adId}`, 'true');
    } else if (policy === 'duration') {
      localStorage.setItem(`${DISMISSAL_PREFIX}${adId}_time`, Date.now().toString());
    } else if (policy === 'until_expiration') {
      localStorage.setItem(`${DISMISSAL_PREFIX}${adId}_expired`, 'true');
    }
  };

  const handleCtaClick = () => {
    if (!ad) return;
    const adId = ad._id || ad.id;
    if (adId) {
      apiRequest(`/advertisements/${adId}/click`, { method: 'POST' }).catch(() => {});
    }
  };

  if (!ad || isDismissed) {
    return null;
  }

  const {
    title,
    subtitle,
    description,
    promoBadge,
    mainImage,
    backgroundColor = '#051329',
    gradient = 'from-blue-950 via-slate-900 to-slate-950',
    textColor = '#ffffff',
    cta,
    closeButton,
  } = ad;

  // Render variant: Sidebar
  if (variant === 'sidebar') {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-slate-200/80 shadow-md p-4 bg-gradient-to-br ${gradient} text-white space-y-3 ${className}`}
        style={{ backgroundColor }}
      >
        {closeButton?.enabled && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close Advertisement"
            className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {promoBadge && (
          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500/30 text-blue-300 border border-blue-400/30">
            {promoBadge}
          </span>
        )}

        <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-900/60">
          <img
            src={mainImage}
            alt={title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-black leading-tight" style={{ color: textColor }}>
            {title}
          </h4>
          {subtitle && <p className="text-xs text-blue-200/90 font-medium">{subtitle}</p>}
          {description && <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">{description}</p>}
        </div>

        {cta?.enabled && (
          <SafeLink
            to={cta.url || '/shop'}
            target={cta.target || '_self'}
            onClick={handleCtaClick}
            style={{
              backgroundColor: cta?.bgColor || undefined,
              color: cta?.textColor || undefined,
            }}
            className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <span>{cta.label || 'Shop Now'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </SafeLink>
        )}
      </div>
    );
  }

  // Render variant: Full Banner (between sections, PLP top, etc.)
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 shadow-xl bg-gradient-to-r ${gradient} text-white p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 ${className}`}
      style={{ backgroundColor }}
      role="complementary"
      aria-label="Promotional Advertisement"
    >
      {/* Close button */}
      {closeButton?.enabled && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss advertisement"
          className={`absolute z-30 transition cursor-pointer ${
            closeButton.position === 'top-left'
              ? 'top-3 left-3'
              : closeButton.position === 'bottom-right'
              ? 'bottom-3 right-3'
              : closeButton.position === 'bottom-left'
              ? 'bottom-3 left-3'
              : 'top-3 right-3'
          } ${
            closeButton.appearance === 'circle'
              ? 'w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white/90 flex items-center justify-center backdrop-blur-xs'
              : closeButton.appearance === 'pill'
              ? 'px-2 py-0.5 rounded-full bg-black/40 text-[10px] text-white flex items-center gap-1'
              : 'p-1 text-white/60 hover:text-white'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Left Text & CTA */}
      <div className="space-y-3 max-w-xl z-10 text-center md:text-left">
        {promoBadge && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>{promoBadge}</span>
          </div>
        )}

        <h3 className="text-xl sm:text-3xl font-black tracking-tight leading-tight" style={{ color: textColor }}>
          {title}
        </h3>

        {subtitle && <p className="text-sm font-semibold text-cyan-200">{subtitle}</p>}
        {description && <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed max-w-lg">{description}</p>}

        {cta?.enabled && (
          <div className="pt-2 flex justify-center md:justify-start">
            <SafeLink
              to={cta.url || '/shop'}
              target={cta.target || '_self'}
              onClick={handleCtaClick}
              style={{
                backgroundColor: cta?.bgColor || undefined,
                color: cta?.textColor || undefined,
              }}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-full shadow-lg shadow-blue-600/30 transition-all hover:scale-102 flex items-center gap-2 cursor-pointer"
            >
              <span>{cta.label || 'Shop Now'}</span>
              <ArrowRight className="w-4 h-4" />
            </SafeLink>
          </div>
        )}
      </div>

      {/* Right Product Image Asset */}
      <div className="relative z-10 w-full max-w-xs shrink-0 flex items-center justify-center">
        <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden bg-slate-900/40 p-2 border border-white/10 shadow-2xl backdrop-blur-xs">
          <img
            src={mainImage}
            alt={title}
            className="w-full h-full object-cover rounded-xl"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
};
