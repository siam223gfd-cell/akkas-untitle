import React from 'react';
import { Review } from '../../../types';
import { AdminDrawer } from '../common/modal';
import {
  MessageSquare,
  User,
  Star,
  CheckCircle2,
  XCircle,
  Package,
  Calendar,
  ThumbsUp,
  ShieldCheck,
} from 'lucide-react';

interface ReviewDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  review: Review | null;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export const ReviewDetailsDrawer: React.FC<ReviewDetailsDrawerProps> = ({
  isOpen,
  onClose,
  review,
  onApprove,
  onReject,
}) => {
  if (!review) return null;

  const statusColor = {
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    rejected: 'bg-rose-100 text-rose-800 border-rose-200',
  }[review.status] || 'bg-slate-100 text-slate-800 border-slate-200';

  const reviewDate = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Recently';

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="lg"
      icon={<MessageSquare className="w-5 h-5 text-blue-600" />}
      title="Customer Review Details"
      subtitle={`Submitted by ${review.userName} • ${reviewDate}`}
      badge={
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColor}`}>
          {review.status}
        </span>
      }
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {onReject && review.status !== 'rejected' && (
              <button
                type="button"
                onClick={() => {
                  onReject(review._id);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject</span>
              </button>
            )}
            {onApprove && review.status !== 'approved' && (
              <button
                type="button"
                onClick={() => {
                  onApprove(review._id);
                  onClose();
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve Review</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Rating & Verdict Header Banner */}
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/60 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Customer Rating</span>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-black text-slate-900">{review.rating}.0 / 5.0</span>
            </div>
          </div>
          {review.isVerifiedPurchase && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100/80 text-emerald-800 text-[11px] font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verified Buyer</span>
            </div>
          )}
        </div>

        {/* Review Comment Section */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Review Content</span>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{review.comment}</p>
          </div>
        </div>

        {/* Customer Photos if any */}
        {review.photos && review.photos.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attached Photos ({review.photos.length})</span>
            <div className="grid grid-cols-3 gap-3">
              {review.photos.map((photo, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <img src={photo} alt={`Review attachment ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer & Product Metadata */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Review Metadata</span>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                <User className="w-3.5 h-3.5" />
                <span>Customer</span>
              </div>
              <p className="font-bold text-slate-900">{review.userName}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate">{review.userId}</p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                <Package className="w-3.5 h-3.5" />
                <span>Target Product</span>
              </div>
              <p className="font-bold text-slate-900 font-mono text-[11px] truncate">ID: {review.productId}</p>
              <p className="text-[10px] text-slate-400">Target catalog SKU</p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                <Calendar className="w-3.5 h-3.5" />
                <span>Submitted</span>
              </div>
              <p className="font-bold text-slate-900">{reviewDate}</p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>Helpful Votes</span>
              </div>
              <p className="font-bold text-slate-900">{review.helpfulCount || 0} votes</p>
            </div>
          </div>
        </div>
      </div>
    </AdminDrawer>
  );
};
