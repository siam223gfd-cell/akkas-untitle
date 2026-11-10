import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Advertisement } from '../../types';
import { apiRequest } from '../../services/api';
import { SafeLink } from '../common/SafeLink';
import { X, ArrowRight, Sparkles, Tag, ShieldCheck } from 'lucide-react';

const POPUP_DISMISSAL_PREFIX = 'aurelia_popup_dismissed_';

export const PublicAdvertisementPopup: React.FC = () => {
  const location = useLocation();
  const [ad, setAd] = useState<Advertisement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

  // Check if current route is excluded (admin or checkout paths)
  const isExcludedPath =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/order-success');

  useEffect(() => {
    if (isExcludedPath) {
      setIsVisible(false);
      return;
    }

    let isMounted = true;
    let delayTimer: NodeJS.Timeout | null = null;

    // Fetch eligible public advertisements
    const fetchEligiblePopup = async () => {
      try {
        // Try popup_modal placement first, or general public ads
        let res = await apiRequest('/advertisements/placement/popup_modal');
        let candidates: Advertisement[] = [];

        if (res.success && res.advertisements && res.advertisements.length > 0) {
          candidates = res.advertisements;
        } else {
          // Fallback to all published public ads with popup_modal placement or highest priority
          const allRes = await apiRequest('/advertisements/public');
          if (allRes.success && allRes.advertisements) {
            candidates = allRes.advertisements.filter((item: Advertisement) =>
              item.placements?.includes('popup_modal')
            );
            // If no explicit popup_modal exists, check for high priority general promo
            if (candidates.length === 0 && allRes.advertisements.length > 0) {
              const topPriorityAd = allRes.advertisements[0];
              if (topPriorityAd && topPriorityAd.priority <= 2) {
                candidates = [topPriorityAd];
              }
            }
          }
        }

        if (!isMounted || candidates.length === 0) return;

        // Find the first candidate that has not been dismissed according to its policy
        for (const candidate of candidates) {
          const adId = candidate._id || candidate.id;
          if (!adId) continue;

          const policy = candidate.closeButton?.dismissalPolicy || 'session';
          let isDismissed = false;

          if (policy === 'until_reload') {
            isDismissed = false;
          } else if (policy === 'session') {
            isDismissed = sessionStorage.getItem(`${POPUP_DISMISSAL_PREFIX}${adId}`) === 'true';
          } else if (policy === 'duration') {
            const dismissedAt = localStorage.getItem(`${POPUP_DISMISSAL_PREFIX}${adId}_time`);
            if (dismissedAt) {
              const diffHours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
              const maxHours = candidate.closeButton?.dismissalDurationHours || 24;
              if (diffHours < maxHours) {
                isDismissed = true;
              } else {
                localStorage.removeItem(`${POPUP_DISMISSAL_PREFIX}${adId}_time`);
              }
            }
          } else if (policy === 'until_expiration') {
            isDismissed = localStorage.getItem(`${POPUP_DISMISSAL_PREFIX}${adId}_expired`) === 'true';
          }

          if (!isDismissed) {
            setAd(candidate);
            // Configurable graceful appearance delay (2.5 seconds) so the user can see the store first
            delayTimer = setTimeout(() => {
              if (isMounted) {
                setIsVisible(true);
              }
            }, 2500);
            break;
          }
        }
      } catch (err) {
        // Silently handle offline or network err
      }
    };

    fetchEligiblePopup();

    return () => {
      isMounted = false;
      if (delayTimer) clearTimeout(delayTimer);
    };
  }, [location.pathname, isExcludedPath]);

  // Track impression once popup becomes visible
  useEffect(() => {
    if (isVisible && ad && !hasTrackedImpression) {
      setHasTrackedImpression(true);
      const adId = ad._id || ad.id;
      if (adId) {
        apiRequest(`/advertisements/${adId}/impression`, { method: 'POST' }).catch(() => {});
      }
    }
  }, [isVisible, ad, hasTrackedImpression]);

  // Escape key listener to close cleanly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  const handleDismiss = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!ad) return;

    setIsVisible(false);
    const adId = ad._id || ad.id;
    if (!adId) return;

    const policy = ad.closeButton?.dismissalPolicy || 'session';
    if (policy === 'session') {
      sessionStorage.setItem(`${POPUP_DISMISSAL_PREFIX}${adId}`, 'true');
    } else if (policy === 'duration') {
      localStorage.setItem(`${POPUP_DISMISSAL_PREFIX}${adId}_time`, Date.now().toString());
    } else if (policy === 'until_expiration') {
      localStorage.setItem(`${POPUP_DISMISSAL_PREFIX}${adId}_expired`, 'true');
    }
  };

  const handleCtaClick = () => {
    if (!ad) return;
    const adId = ad._id || ad.id;
    if (adId) {
      apiRequest(`/advertisements/${adId}/click`, { method: 'POST' }).catch(() => {});
    }
    // Also dismiss popup upon navigating through CTA
    handleDismiss();
  };

  if (!ad || !isVisible || isExcludedPath) {
    return null;
  }

  const {
    title,
    subtitle,
    description,
    promoBadge,
    mainImage,
    backgroundColor = '#06152d',
    gradient = 'from-blue-950 via-[#06152d] to-slate-950',
    textColor = '#ffffff',
    cta,
    closeButton,
  } = ad;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Promotional Offer"
    >
      <div
        className="relative w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-gradient-to-br from-blue-950/90 via-[#06152d] to-slate-950 text-white animate-in zoom-in-95 duration-250 flex flex-col md:flex-row group"
        style={{ backgroundColor: backgroundColor || '#06152d' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accessible Close Button */}
        {closeButton?.enabled !== false && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close promotional popup"
            className={`absolute z-30 transition cursor-pointer ${
              closeButton?.position === 'top-left'
                ? 'top-3.5 left-3.5'
                : 'top-3.5 right-3.5'
            } ${
              closeButton?.appearance === 'pill'
                ? 'px-3 py-1 rounded-full bg-black/60 hover:bg-black/90 text-white/90 text-[10px] font-bold flex items-center gap-1.5 border border-white/20 shadow-md'
                : 'w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white/90 hover:text-white flex items-center justify-center backdrop-blur-xs border border-white/20 shadow-md'
            }`}
          >
            <X className="w-4 h-4" />
            {closeButton?.appearance === 'pill' && <span>Close</span>}
          </button>
        )}

        {/* Left / Top Product Image Showcase */}
        <div className="md:w-5/12 bg-slate-900/70 relative overflow-hidden flex items-center justify-center p-6 shrink-0 border-b md:border-b-0 md:border-r border-white/10">
          <div className="absolute inset-0 bg-radial from-blue-500/25 via-blue-900/10 to-transparent pointer-events-none" />
          <div className="relative w-full aspect-square max-w-[200px] rounded-2xl overflow-hidden shadow-2xl bg-slate-950/60 p-2.5 border border-white/15">
            <img
              src={mainImage}
              alt={title}
              className="w-full h-full object-cover rounded-xl transition duration-500 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Right Content & Actions */}
        <div className="flex-1 p-6 sm:p-7 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            {promoBadge && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-wider shadow-xs">
                <Sparkles className="w-3 h-3 text-cyan-300" />
                <span>{promoBadge}</span>
              </div>
            )}

            <h3
              className="text-xl sm:text-2xl font-black tracking-tight leading-snug drop-shadow-sm"
              style={{ color: textColor || '#ffffff' }}
            >
              {title}
            </h3>

            {subtitle && (
              <p className="text-xs font-bold text-cyan-200 tracking-wide">
                {subtitle}
              </p>
            )}

            {description && (
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                {description}
              </p>
            )}
          </div>

          {/* CTA & Dismiss Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            {cta?.enabled !== false && (
              <SafeLink
                to={cta?.url || '/shop'}
                target={cta?.target || '_self'}
                onClick={handleCtaClick}
                style={{
                  backgroundColor: cta?.bgColor || '#2563eb',
                  color: cta?.textColor || '#ffffff',
                }}
                className="w-full sm:flex-1 py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-102 hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{cta?.label || 'Shop Now'}</span>
                <ArrowRight className="w-4 h-4" />
              </SafeLink>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/20 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
