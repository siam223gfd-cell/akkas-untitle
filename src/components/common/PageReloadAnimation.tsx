import React, { useState, useEffect } from 'react';
import { ShoppingCart, Sparkles } from 'lucide-react';

interface PageReloadAnimationProps {
  durationMs?: number; // default ~3000ms
}

export const PageReloadAnimation: React.FC<PageReloadAnimationProps> = ({
  durationMs = 2900,
}) => {
  const [shouldRender, setShouldRender] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    // Respect reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShouldRender(false);
      return;
    }

    // Step-wise progress simulation over the 3-second window
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) {
          clearInterval(progressInterval);
          return 100;
        }
        // Rapid initial advance, then smooth steady climb
        const increment = prev < 50 ? 12 : prev < 80 ? 7 : 3;
        return Math.min(prev + increment, 98);
      });
    }, 120);

    // Trigger smooth fade out slightly before total duration
    const fadeTimer = setTimeout(() => {
      setProgress(100);
      setIsFadingOut(true);
    }, durationMs - 450);

    // Completely unmount overlay and cleanup
    const completeTimer = setTimeout(() => {
      setShouldRender(false);
    }, durationMs);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [durationMs]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Aurelia Commerce Storefront"
      className={`fixed inset-0 z-9999 flex flex-col items-center justify-center bg-gradient-to-b from-[#020d20] via-[#041635] to-[#010814] text-white transition-opacity duration-500 ease-out select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Radial Glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[120px] pointer-events-none animate-pulse" />

      {/* Center Brand Identity Container */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-6 px-6 max-w-sm">
        {/* Animated Brand Emblem */}
        <div className="relative group">
          <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-sky-400 to-blue-700 rounded-3xl blur-md opacity-75 animate-pulse" />
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-500 text-white flex items-center justify-center shadow-2xl border border-white/20">
            <ShoppingCart className="w-10 h-10 sm:w-12 sm:h-12 animate-bounce transition-transform" />
          </div>
        </div>

        {/* Brand Headline & Tagline */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-sans">
              Aurelia
            </h1>
            <Sparkles className="w-4 h-4 text-sky-400 animate-spin" />
          </div>
          <p className="text-xs sm:text-sm font-semibold tracking-wider text-blue-200 uppercase">
            Shop Smart, Live Better
          </p>
        </div>

        {/* Sleek Progress Indicator */}
        <div className="w-48 sm:w-56 space-y-2 pt-2">
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-xs p-0.5 border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-sky-400 to-blue-300 rounded-full transition-all duration-200 ease-out shadow-sm shadow-sky-400/50"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-blue-300 font-mono">
            <span>PREPARING STOREFRONT</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>

      {/* Bottom Micro Footer Badge */}
      <div className="absolute bottom-6 text-center text-[11px] text-slate-500 tracking-wide font-medium">
        Novara Commerce · Premium Multi-Category Shopping
      </div>
    </div>
  );
};
