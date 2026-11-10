import React, { useState, useEffect, useRef } from 'react';
import { HeroSlide } from '../../types';
import { apiRequest } from '../../services/api';
import { SafeLink } from '../common/SafeLink';
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';

interface PublicHeroSliderProps {
  autoplayIntervalMs?: number;
}

export const PublicHeroSlider: React.FC<PublicHeroSliderProps> = ({
  autoplayIntervalMs = 5000,
}) => {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef<any>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiRequest('/hero-slides/public')
      .then((res) => {
        if (!isMounted) return;
        setIsLoading(false);
        if (res.success && Array.isArray(res.slides) && res.slides.length > 0) {
          const sorted = [...res.slides].sort((a, b) => (a.order || 0) - (b.order || 0));
          setSlides(sorted);
        } else {
          setSlides([]);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoading(false);
        setSlides([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Clamp currentIndex if slides list shrinks
  useEffect(() => {
    setCurrentIndex((prev) => (slides.length === 0 ? 0 : prev >= slides.length ? 0 : prev));
  }, [slides.length]);

  // Autoplay timer
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, autoplayIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, isPaused, autoplayIntervalMs]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slides.length <= 1) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    }
  };

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartXRef.current = null;
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-3">
        <div className="w-full aspect-16/7 sm:aspect-21/8 lg:aspect-24/8 rounded-3xl bg-slate-900/60 animate-pulse flex items-center justify-center border border-slate-800">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Fallback Hero State when no dynamic slides exist in database
  if (slides.length === 0) {
    return (
      <section
        className="w-full max-w-7xl mx-auto px-4 sm:px-8 pt-3 pb-2"
        aria-label="Storefront Hero"
      >
        <div className="relative w-full aspect-16/7 sm:aspect-21/8 lg:aspect-24/8 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-[#03152e] via-[#052147] to-[#010e20] border border-slate-800/80 flex items-center p-6 sm:p-12 lg:p-16">
          <div className="max-w-xl space-y-3 sm:space-y-4 text-white z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-extrabold text-[10px] sm:text-xs tracking-wider uppercase border border-blue-400/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Aurelia Premium Storefront</span>
            </span>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Shop Smart, Live Better
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed font-medium">
              Discover authentic flagship smartphones, noise-cancelling audio, and premium lifestyle essentials with nationwide warranty delivery across Bangladesh.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <SafeLink
                to="/shop"
                className="px-5 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-blue-600/30 transition-all hover:scale-102 flex items-center gap-2 cursor-pointer"
              >
                <span>Explore Catalog</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </SafeLink>
              <SafeLink
                to="/shop?sort=discount"
                className="px-4 sm:px-5 py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/20 transition-all hover:scale-102 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Special Offers</span>
              </SafeLink>
            </div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-25 lg:opacity-40 pointer-events-none flex items-center justify-end pr-10">
            <img
              src="https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=1200&q=80"
              alt="Flagship Showcase"
              className="h-full object-contain"
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="w-full max-w-7xl mx-auto px-4 sm:px-8 pt-3 pb-2 relative group focus:outline-hidden"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Storefront Hero Slider"
    >
      <div className="relative w-full aspect-16/7 sm:aspect-21/8 lg:aspect-24/8 rounded-3xl overflow-hidden shadow-2xl bg-slate-950 border border-slate-800/80">
        {slides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          const slideImage = slide.image || slide.desktopImage;
          const primaryUrl = (slide.destinationUrl || slide.link || slide.ctaLink || '').trim();
          const hasSlideLink = !!primaryUrl;
          const hasTextOverlay = !!(
            slide.title?.trim() ||
            slide.subtitle?.trim() ||
            slide.ctaText?.trim() ||
            slide.secondaryCtaText?.trim() ||
            slide.badge?.trim()
          );

          return (
            <div
              key={slide._id || slide.id || idx}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <div className="relative w-full h-full">
                {/* Background Picture Asset */}
                <picture className="w-full h-full block">
                  {slide.mobileImage && (
                    <source media="(max-width: 640px)" srcSet={slide.mobileImage} />
                  )}
                  <img
                    src={slideImage}
                    alt={slide.title || 'Novara Showcase Slide'}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    className={`w-full h-full object-cover object-center select-none transition-transform duration-1000 ease-out ${
                      isActive ? 'scale-100' : 'scale-105'
                    } ${hasTextOverlay ? 'opacity-75 sm:opacity-85' : 'opacity-100'}`}
                    referrerPolicy="no-referrer"
                  />
                </picture>

                {/* Case 1: When link is provided, full-slide stretched link (rendered as sibling, never parent of buttons) */}
                {hasSlideLink && (
                  <SafeLink
                    to={primaryUrl}
                    target={slide.target || '_self'}
                    className="absolute inset-0 z-10 cursor-pointer focus:outline-hidden focus:ring-4 focus:ring-blue-500/50"
                    title={slide.title || undefined}
                    aria-label={slide.title || 'Slide link'}
                  >
                    <span className="sr-only">{slide.title || 'View slide details'}</span>
                  </SafeLink>
                )}

                {/* Gradient Overlay for Text Readability when text overlay exists */}
                {hasTextOverlay && (
                  <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent flex items-center z-15 pointer-events-none" />
                )}

                {/* Text & CTA Content Layer */}
                {hasTextOverlay && (
                  <div className="absolute inset-0 z-20 flex items-center p-6 sm:p-12 lg:p-16 pointer-events-none">
                    <div className="max-w-xl space-y-2 sm:space-y-3.5 text-white">
                      {/* Badge */}
                      {slide.badge?.trim() && (
                        <span className="inline-block px-3 py-1 rounded-full bg-blue-600/90 text-white font-extrabold text-[10px] sm:text-xs tracking-wider uppercase shadow-md shadow-blue-500/20 backdrop-blur-xs">
                          {slide.badge}
                        </span>
                      )}

                      {/* Headline */}
                      {slide.title?.trim() && (
                        <h2 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight drop-shadow-md">
                          {slide.title}
                        </h2>
                      )}

                      {/* Subtitle */}
                      {slide.subtitle?.trim() && (
                        <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 sm:line-clamp-3 leading-relaxed drop-shadow-sm font-medium">
                          {slide.subtitle}
                        </p>
                      )}

                      {/* Call to Actions (Interactive buttons elevated to z-30) */}
                      {(slide.ctaText?.trim() || slide.secondaryCtaText?.trim()) && (
                        <div className="flex items-center gap-3 pt-2">
                          {slide.ctaText?.trim() && primaryUrl && (
                            <SafeLink
                              to={primaryUrl}
                              target={slide.target || '_self'}
                              className="pointer-events-auto relative z-30 px-5 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-blue-600/30 transition-all hover:scale-102 flex items-center gap-2 cursor-pointer"
                            >
                              <span>{slide.ctaText}</span>
                              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </SafeLink>
                          )}

                          {slide.secondaryCtaText?.trim() && slide.secondaryCtaUrl?.trim() && (
                            <SafeLink
                              to={slide.secondaryCtaUrl.trim()}
                              target={slide.target || '_self'}
                              className="pointer-events-auto relative z-30 px-4 sm:px-5 py-2.5 sm:py-3 bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/20 transition-all hover:scale-102 flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>{slide.secondaryCtaText}</span>
                            </SafeLink>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Previous & Next Navigation Controls */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous Slide"
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/75 text-white backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200 cursor-pointer shadow-lg hover:scale-105"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next Slide"
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/75 text-white backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200 cursor-pointer shadow-lg hover:scale-105"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </>
        )}

        {/* Pagination Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            {slides.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => setCurrentIndex(dotIdx)}
                aria-label={`Go to slide ${dotIdx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  dotIdx === currentIndex
                    ? 'w-6 sm:w-8 h-2 bg-blue-500 shadow-sm shadow-blue-500/50'
                    : 'w-2 h-2 bg-white/40 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
