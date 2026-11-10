import React from 'react';
import { DynamicBanner, BannerLayer, BannerButton } from '../../types';
import { SafeLink } from '../common/SafeLink';
import {
  ArrowRight,
  ShoppingCart,
  Sparkles,
  ExternalLink,
  Zap,
  Star,
  Tag,
  Check,
} from 'lucide-react';

interface PublicDynamicBannerProps {
  banner: DynamicBanner;
  className?: string;
  ignoreStatus?: boolean;
}

export const PublicDynamicBanner: React.FC<PublicDynamicBannerProps> = ({
  banner,
  className = '',
  ignoreStatus = false,
}) => {
  if (!banner || (!ignoreStatus && banner.status !== 'published')) {
    return null;
  }

  const { background, layout, layers = [], buttons = [], responsive } = banner;

  // Background CSS computation
  let bgStyle: React.CSSProperties = {
    backgroundColor: background.color || '#001736',
  };

  let gradientCss = '';
  if (background.gradient && background.gradient.stops?.length > 0) {
    const stopsStr = background.gradient.stops
      .map((s) => `${s.color} ${s.stop}%`)
      .join(', ');
    if (background.gradient.type === 'radial') {
      gradientCss = `radial-gradient(circle, ${stopsStr})`;
    } else if (background.gradient.type === 'conic') {
      gradientCss = `conic-gradient(from ${background.gradient.angle || 0}deg, ${stopsStr})`;
    } else {
      gradientCss = `linear-gradient(${background.gradient.angle || 90}deg, ${stopsStr})`;
    }
  }

  if (background.type === 'gradient' && gradientCss) {
    bgStyle.backgroundImage = gradientCss;
  } else if (background.type === 'combined') {
    if (background.imageUrl && gradientCss) {
      bgStyle.backgroundImage = `${gradientCss}, url("${background.imageUrl}")`;
      bgStyle.backgroundSize = background.imageSize || 'cover';
      bgStyle.backgroundPosition = background.imagePosition || 'center';
      bgStyle.backgroundRepeat = background.imageRepeat || 'no-repeat';
    } else if (gradientCss) {
      bgStyle.backgroundImage = gradientCss;
    } else if (background.imageUrl) {
      bgStyle.backgroundImage = `url("${background.imageUrl}")`;
      bgStyle.backgroundSize = background.imageSize || 'cover';
      bgStyle.backgroundPosition = background.imagePosition || 'center';
      bgStyle.backgroundRepeat = background.imageRepeat || 'no-repeat';
    }
  } else if (background.type === 'image' && background.imageUrl) {
    bgStyle.backgroundImage = `url("${background.imageUrl}")`;
    bgStyle.backgroundSize = background.imageSize || 'cover';
    bgStyle.backgroundPosition = background.imagePosition || 'center';
    bgStyle.backgroundRepeat = background.imageRepeat || 'no-repeat';
  }

  // Layout container styling
  const containerStyle: React.CSSProperties = {
    width: layout.width || '100%',
    minHeight: layout.minHeight || '300px',
    borderRadius: `${layout.borderRadius ?? 24}px`,
    borderWidth: `${layout.borderWidth ?? 1}px`,
    borderStyle: (layout.borderWidth ?? 1) > 0 ? 'solid' : 'none',
    borderColor: layout.borderColor || 'rgba(255, 255, 255, 0.1)',
    boxShadow: layout.boxShadow || '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    paddingTop: `${layout.padding?.top ?? 32}px`,
    paddingRight: `${layout.padding?.right ?? 32}px`,
    paddingBottom: `${layout.padding?.bottom ?? 32}px`,
    paddingLeft: `${layout.padding?.left ?? 32}px`,
    overflow: layout.overflow || 'hidden',
  };

  const renderIcon = (iconName?: string) => {
    switch (iconName) {
      case 'ArrowRight':
        return <ArrowRight className="w-4 h-4" />;
      case 'ShoppingCart':
        return <ShoppingCart className="w-4 h-4" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4" />;
      case 'ExternalLink':
        return <ExternalLink className="w-4 h-4" />;
      case 'Zap':
        return <Zap className="w-4 h-4 fill-current" />;
      case 'Star':
        return <Star className="w-4 h-4 fill-current" />;
      case 'Tag':
        return <Tag className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const visibleLayers = layers.filter((l) => l.isVisible !== false);
  const visibleButtons = buttons.filter((b) => b.isVisible !== false);

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ ...containerStyle, ...bgStyle }}
    >
      {/* Optional Overlay if Combined / Image */}
      {(background.type === 'combined' || background.type === 'image') && background.overlayOpacity && background.overlayOpacity > 0 ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: background.overlayColor || '#000000',
            opacity: (background.overlayOpacity || 40) / 100,
          }}
        />
      ) : null}

      {/* Content wrapper */}
      <div
        className="relative z-10 flex flex-col justify-center h-full space-y-3"
        style={{
          maxWidth: layout.containerWidth || '650px',
          alignItems:
            layout.contentAlign === 'center'
              ? 'center'
              : layout.contentAlign === 'right'
              ? 'flex-end'
              : 'flex-start',
          textAlign: layout.contentAlign || 'left',
        }}
      >
        {/* Render Layers */}
        {visibleLayers.map((layer) => {
          const layerStyle: React.CSSProperties = {
            fontFamily: layer.fontFamily || 'Plus Jakarta Sans',
            fontSize: `${layer.fontSize || 16}px`,
            fontWeight: layer.fontWeight || '600',
            color: layer.textColor || '#ffffff',
            lineHeight: layer.lineHeight || '1.3',
            letterSpacing: layer.letterSpacing || 'normal',
            opacity: (layer.opacity ?? 100) / 100,
            transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
            textAlign: layer.textAlign || 'left',
          };

          if (layer.type === 'badge') {
            return (
              <div key={layer.id} className="inline-block">
                <span
                  style={layerStyle}
                  className="px-3 py-1 rounded-full bg-white/15 border border-white/20 backdrop-blur-xs uppercase text-[10px] tracking-wider font-extrabold inline-block"
                >
                  {layer.text}
                </span>
              </div>
            );
          }

          if (layer.type === 'heading') {
            return (
              <h2 key={layer.id} style={layerStyle} className="tracking-tight leading-tight">
                {layer.text}
              </h2>
            );
          }

          if (layer.type === 'subheading') {
            return (
              <h3 key={layer.id} style={layerStyle} className="leading-snug">
                {layer.text}
              </h3>
            );
          }

          if (layer.type === 'description') {
            return (
              <p key={layer.id} style={layerStyle} className="max-w-xl">
                {layer.text}
              </p>
            );
          }

          if (layer.type === 'price' || layer.type === 'discount') {
            return (
              <span key={layer.id} style={layerStyle} className="font-black tabular-nums">
                {layer.text}
              </span>
            );
          }

          if (layer.type === 'image' && layer.imageUrl) {
            return (
              <img
                key={layer.id}
                src={layer.imageUrl}
                alt={layer.text || 'Banner element'}
                className="max-h-24 object-contain rounded-lg"
              />
            );
          }

          return (
            <div key={layer.id} style={layerStyle}>
              {layer.text}
            </div>
          );
        })}

        {/* Render CTA Buttons */}
        {visibleButtons.length > 0 && (
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {visibleButtons.map((btn) => {
              const iconNode = renderIcon(btn.icon);
              const btnStyle: React.CSSProperties = {
                backgroundColor: btn.bgColor || '#2563eb',
                color: btn.textColor || '#ffffff',
                borderRadius: `${btn.borderRadius ?? 9999}px`,
                paddingLeft: `${btn.paddingX ?? 20}px`,
                paddingRight: `${btn.paddingX ?? 20}px`,
                paddingTop: `${btn.paddingY ?? 10}px`,
                paddingBottom: `${btn.paddingY ?? 10}px`,
                fontSize: `${btn.fontSize ?? 13}px`,
                fontWeight: btn.fontWeight || '700',
                borderWidth: btn.borderWidth ? `${btn.borderWidth}px` : undefined,
                borderStyle: btn.borderWidth ? 'solid' : undefined,
                borderColor: btn.borderColor || 'transparent',
              };

              return (
                <SafeLink
                  key={btn.id}
                  to={btn.url}
                  target={btn.target || '_self'}
                  style={btnStyle}
                  className="inline-flex items-center gap-2 shadow-md hover:brightness-110 hover:scale-102 transition-all cursor-pointer"
                >
                  {btn.iconPosition === 'left' && iconNode}
                  <span>{btn.label}</span>
                  {btn.iconPosition === 'right' && iconNode}
                </SafeLink>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
