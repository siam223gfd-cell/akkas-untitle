import React from 'react';
import { Product } from '../../../types';
import { AdminDrawer } from '../common/modal';
import {
  Package,
  Star,
  Layers,
  Sparkles,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProductDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onEdit?: (product: Product) => void;
}

export const ProductDetailsDrawer: React.FC<ProductDetailsDrawerProps> = ({
  isOpen,
  onClose,
  product,
  onEdit,
}) => {
  if (!product) return null;

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="xl"
      icon={<Package className="w-5 h-5" />}
      title={product.name}
      subtitle={`SKU: ${product.sku} · Category: ${product.category}`}
      badge={
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            product.stock > 10
              ? 'bg-emerald-100 text-emerald-800'
              : product.stock > 0
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
        </span>
      }
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <Link
            to={`/product/${product.slug}`}
            target="_blank"
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>View on Storefront</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Close
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(product);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Product</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* 1. Image Gallery */}
      <div className="space-y-2">
        <div className="w-full aspect-video rounded-2xl bg-slate-50 overflow-hidden border border-slate-200/80 flex items-center justify-center">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-contain p-4"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Package className="w-12 h-12 text-slate-300" />
          )}
        </div>
        {product.images && product.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {product.images.map((img, idx) => (
              <div
                key={idx}
                className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-slate-50 p-1"
              >
                <img src={img} alt="thumb" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Key Metrics & Pricing */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-xs">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Sale Price</span>
          <span className="text-base font-black text-blue-700 tabular-nums">৳{product.salePrice.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Regular Price</span>
          <span className="text-sm font-bold text-slate-400 line-through tabular-nums">
            ৳{product.basePrice.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Rating</span>
          <div className="flex items-center gap-1 font-black text-slate-900">
            <Star
              className={`w-3.5 h-3.5 ${
                (product.rating || 0) > 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
              }`}
            />
            <span>{(product.rating || 0).toFixed(1)}</span>
            <span className="text-[10px] text-slate-400 font-medium">({product.reviewCount || 0})</span>
          </div>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Brand</span>
          <span className="font-bold text-slate-800">{product.brand || 'Universal'}</span>
        </div>
      </div>

      {/* 3. Description */}
      <div className="space-y-1 text-xs">
        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Product Description</h4>
        <p className="text-slate-600 leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200/80">
          {product.description || 'No description entered.'}
        </p>
      </div>

      {/* 4. Variants Matrix */}
      {product.variants && product.variants.length > 0 && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>Configured Variants ({product.variants.length})</span>
            </h4>
          </div>
          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
            {product.variants.map((v, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">{v.name || `Variant #${idx + 1}`}</p>
                  <p className="font-mono text-[10px] text-slate-400">SKU: {v.sku}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-blue-700 tabular-nums">
                    ৳{(v.price != null ? v.price : product.salePrice).toLocaleString()}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      v.stock > 0 ? 'bg-slate-100 text-slate-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {v.stock} in stock
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Highlight Badges */}
      {product.highlights && product.highlights.length > 0 && (
        <div className="space-y-2 text-xs">
          <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Key Feature Highlights</span>
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {product.highlights.map((h, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">{h.label}</span>
                <span className="font-bold text-slate-900">{h.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Technical Specifications */}
      {product.specificationsTable && product.specificationsTable.length > 0 && (
        <div className="space-y-2 text-xs">
          <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Technical Specifications</h4>
          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
            {product.specificationsTable.map((spec, idx) => (
              <div key={idx} className="p-2.5 flex justify-between">
                <span className="font-semibold text-slate-500">{spec.label}</span>
                <span className="font-bold text-slate-900 text-right">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminDrawer>
  );
};
