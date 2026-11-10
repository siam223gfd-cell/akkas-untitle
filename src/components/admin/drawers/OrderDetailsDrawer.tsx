import React, { useState } from 'react';
import { Order } from '../../../types';
import { AdminDrawer } from '../common/modal';
import { apiRequest } from '../../../services/api';
import {
  ShoppingBag,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  Banknote,
} from 'lucide-react';

interface OrderDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onUpdateStatus?: (order: Order) => void;
  onOrderUpdated?: (order: Order) => void;
}

export const OrderDetailsDrawer: React.FC<OrderDetailsDrawerProps> = ({
  isOpen,
  onClose,
  order,
  onUpdateStatus,
  onOrderUpdated,
}) => {
  const [isCollectingCod, setIsCollectingCod] = useState(false);
  const [codNotes, setCodNotes] = useState('');
  const [isSubmittingCod, setIsSubmittingCod] = useState(false);
  const [codError, setCodError] = useState<string | null>(null);

  if (!order) return null;

  const handleRecordCodCollection = async () => {
    setIsSubmittingCod(true);
    setCodError(null);
    try {
      const res = await apiRequest<{ success: boolean; order: Order; message: string }>('/payments/cod/collect', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order._id,
          amountCollected: order.pricing.total,
          notes: codNotes || 'Cash collected upon delivery',
        }),
      });
      if (res?.success && res.order) {
        setIsCollectingCod(false);
        if (onOrderUpdated) onOrderUpdated(res.order);
      }
    } catch (err: any) {
      setCodError(err?.message || 'Failed to record cash collection');
    } finally {
      setIsSubmittingCod(false);
    }
  };

  const statusColor = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
    processing: 'bg-purple-100 text-purple-800 border-purple-200',
    packed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    shipped: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
    returned: 'bg-slate-200 text-slate-800 border-slate-300',
  }[order.orderStatus] || 'bg-slate-100 text-slate-800 border-slate-200';

  const orderDate = new Date(order.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="xl"
      icon={<ShoppingBag className="w-5 h-5" />}
      title={`Order #${order.orderNumber}`}
      subtitle={`Placed on ${orderDate}`}
      badge={
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColor}`}
        >
          {order.orderStatus}
        </span>
      }
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Invoice</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Close
            </button>
            {onUpdateStatus && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onUpdateStatus(order);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Update Fulfillment</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* 1. Customer Card */}
      <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <User className="w-4 h-4 text-blue-600" />
            <span>Customer Details</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">ID: {order._id.slice(-6)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer Name</span>
            <span className="font-black text-slate-900 text-sm">{order.customerName}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Phone Number</span>
            <a
              href={`tel:${order.customerPhone}`}
              className="font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              <Phone className="w-3 h-3" />
              {order.customerPhone}
            </a>
          </div>
          <div className="sm:col-span-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Email Address</span>
            <span className="font-medium text-slate-700">{order.customerEmail || 'No email provided'}</span>
          </div>
        </div>
      </div>

      {/* 2. Delivery Destination */}
      <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-900 pb-2 border-b border-slate-200/60">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <span>Shipping & Delivery Destination (Order Snapshot)</span>
        </div>
        <p className="font-semibold text-slate-800 leading-relaxed">
          {order.shippingAddress?.streetAddress || 'Address not specified'}
        </p>
        {(order.shippingAddress?.house || order.shippingAddress?.road || order.shippingAddress?.locality) && (
          <p className="text-[11px] text-slate-600 font-medium">
            {[order.shippingAddress.house, order.shippingAddress.road, order.shippingAddress.locality]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 font-medium">
          {order.shippingAddress?.unionOrWard && (
            <>
              <span className="font-semibold text-blue-700">{order.shippingAddress.unionOrWard}</span>
              <span>·</span>
            </>
          )}
          <span>{order.shippingAddress?.upazila}</span>
          <span>·</span>
          <span>{order.shippingAddress?.district}</span>
          <span>·</span>
          <span className="font-bold text-slate-800">{order.shippingAddress?.division} Division</span>
          {order.shippingAddress?.postalCode && (
            <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-[10px] font-mono font-bold text-slate-700">
              Postal: {order.shippingAddress.postalCode}
            </span>
          )}
        </div>
        {order.shippingAddress?.deliveryInstructions && (
          <p className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 font-medium mt-1">
            Instructions: {order.shippingAddress.deliveryInstructions}
          </p>
        )}
      </div>

      {/* 3. Ordered Line Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
            <span>Ordered Items ({order.items.length})</span>
          </h4>
          <span className="text-[11px] font-bold text-slate-500">
            Qty: {order.items.reduce((acc, it) => acc + it.quantity, 0)} units
          </span>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
          {order.items.map((item, idx) => (
            <div key={idx} className="p-3.5 flex items-center gap-3.5 hover:bg-slate-50/50 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/60">
                <img
                  src={
                    item.image ||
                    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=200&q=80'
                  }
                  alt={item.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-bold text-slate-900 truncate">{item.name}</h5>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                  <span className="font-mono text-slate-400">SKU: {item.sku || 'N/A'}</span>
                  {item.variantId && (
                    <>
                      <span>·</span>
                      <span className="text-blue-600 font-semibold">Variant: {item.variantId.slice(-6)}</span>
                    </>
                  )}
                </div>
                {item.options && Object.keys(item.options).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(item.options).map(([optKey, optVal]) => (
                      <span
                        key={optKey}
                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700"
                      >
                        {optKey}: {optVal}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs mt-1">
                  <span className="text-slate-600 font-medium">৳{item.price.toLocaleString()}</span>
                  <span className="text-slate-400">×</span>
                  <span className="font-bold text-slate-900">{item.quantity}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-black text-slate-900 tabular-nums">
                  ৳{(item.price * item.quantity).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Payment & Financial Breakdown */}
      <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <CreditCard className="w-4 h-4 text-purple-600" />
            <span>Payment Summary</span>
          </div>
          <span className="font-bold uppercase tracking-wider text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
            {order.paymentMethod} · {order.paymentStatus}
          </span>
        </div>

        <div className="space-y-1.5 pt-1 text-slate-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-medium text-slate-900 tabular-nums">৳{order.pricing.subtotal.toLocaleString()}</span>
          </div>
          {order.pricing.discount > 0 && (
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>
                Promotional Discount
                {order.pricing.couponCode ? ` (${order.pricing.couponCode})` : ''}
              </span>
              <span className="tabular-nums">- ৳{order.pricing.discount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Shipping Fee</span>
            <span className="font-medium text-slate-900 tabular-nums">
              {order.pricing.shippingFee === 0 ? 'FREE' : `৳${order.pricing.shippingFee.toLocaleString()}`}
            </span>
          </div>
          {(order.pricing.tax || 0) > 0 && (
            <div className="flex justify-between">
              <span>VAT / Tax</span>
              <span className="font-medium text-slate-900 tabular-nums">৳{order.pricing.tax.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
            <span>Grand Total</span>
            <span className="text-blue-700 font-black tabular-nums">৳{order.pricing.total.toLocaleString()}</span>
          </div>
        </div>

        {order.paymentDetails &&
          (order.paymentDetails.transactionId ||
            order.paymentDetails.provider ||
            order.paymentDetails.payerPhone ||
            order.paymentDetails.reference ||
            order.paymentDetails.verifiedAt) && (
            <div className="mt-2 pt-2.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {order.paymentDetails.provider && (
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Provider</span>
                  <span className="font-bold text-slate-800 uppercase">{order.paymentDetails.provider}</span>
                </div>
              )}
              {order.paymentDetails.transactionId && (
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Transaction ID</span>
                  <span className="font-mono font-bold text-slate-800">{order.paymentDetails.transactionId}</span>
                </div>
              )}
              {order.paymentDetails.payerPhone && (
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Payer Account</span>
                  <span className="font-semibold text-slate-800">{order.paymentDetails.payerPhone}</span>
                </div>
              )}
              {order.paymentDetails.verifiedAt && (
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Verified At</span>
                  <span className="font-semibold text-emerald-700">
                    {new Date(order.paymentDetails.verifiedAt).toLocaleString()}
                  </span>
                </div>
              )}
              {order.paymentDetails.reference && (
                <div className="sm:col-span-2">
                  <span className="text-slate-400 font-semibold block uppercase text-[10px]">Reference</span>
                  <span className="font-medium text-slate-700">{order.paymentDetails.reference}</span>
                </div>
              )}
            </div>
          )}

        {/* COD Collection Section */}
        {order.paymentMethod === 'cod' && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            {order.paymentStatus === 'paid' ? (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold">Cash of ৳{order.pricing.total.toLocaleString()} collected and verified.</span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2.5">
                <div className="flex items-start gap-2">
                  <Banknote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">Cash Collection Pending</p>
                    <p className="text-[11px] text-amber-800">
                      Standard COD policy: Unpaid upon checkout. Collect ৳{order.pricing.total.toLocaleString()} physical cash upon delivery.
                    </p>
                  </div>
                </div>

                {isCollectingCod ? (
                  <div className="pt-2 border-t border-amber-200/80 space-y-2">
                    <input
                      type="text"
                      value={codNotes}
                      onChange={(e) => setCodNotes(e.target.value)}
                      placeholder="Optional notes (e.g. Courier rider ID, receipt #)"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {codError && <p className="text-[11px] text-rose-600 font-semibold">{codError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSubmittingCod}
                        onClick={handleRecordCodCollection}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        {isSubmittingCod ? 'Recording...' : `Confirm ৳${order.pricing.total.toLocaleString()} Collected`}
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingCod}
                        onClick={() => setIsCollectingCod(false)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCollectingCod(true)}
                    className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Record Cash Collected (৳{order.pricing.total.toLocaleString()})</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Staff Notes if present */}
      {(order.staffNotes || (order as any).notes) && (
        <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">Audit / Tracking Note</span>
          <p className="font-medium leading-relaxed">{order.staffNotes || (order as any).notes}</p>
        </div>
      )}

      {/* 6. Fulfillment Timeline */}
      {order.timeline && order.timeline.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 pb-2 border-b border-slate-100">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Fulfillment Audit Timeline</span>
          </div>
          <div className="space-y-3">
            {order.timeline.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 capitalize">{step.status}</span>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {new Date(step.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {step.note && <p className="text-[11px] text-slate-600 mt-0.5">{step.note}</p>}
                  {step.actor && (
                    <span className="text-[10px] font-medium text-slate-400">Updated by: {step.actor}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminDrawer>
  );
};
