import React, { useEffect, useState } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import { apiRequest } from '../services/api';
import { Order } from '../types';
import { useAppDispatch } from '../app/hooks';
import { addToast, openAuthModal } from '../features/ui/uiSlice';
import {
  CheckCircle,
  Clock,
  CreditCard,
  Printer,
  AlertCircle,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

export const OrderSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const orderId = searchParams.get('orderId');

  const routeState = (location.state as { order?: Order; receiptToken?: string } | null) || null;
  const storedToken = orderId ? sessionStorage.getItem(`order_receipt_${orderId}`) || '' : '';
  const initialToken = searchParams.get('token') || routeState?.receiptToken || storedToken;

  const [order, setOrder] = useState<Order | null>(routeState?.order || null);
  const [receiptToken, setReceiptToken] = useState<string>(initialToken);
  const [isLoading, setIsLoading] = useState(!routeState?.order && !!orderId);
  const [errorMsg, setErrorMsg] = useState('');

  // Gateway initiation loading state
  const [isInitiatingGateway, setIsInitiatingGateway] = useState(false);
  const [gatewayError, setGatewayError] = useState('');

  useEffect(() => {
    if (initialToken && orderId) {
      try {
        sessionStorage.setItem(`order_receipt_${orderId}`, initialToken);
      } catch {
        // ignore storage errors
      }
    }
  }, [initialToken, orderId]);

  useEffect(() => {
    if (!orderId) {
      setIsLoading(false);
      return;
    }

    const shouldRefresh =
      !order ||
      order._id !== orderId ||
      (order.paymentMethod !== 'cod' && order.paymentStatus === 'pending' && !order.paymentDetails);

    if (!shouldRefresh) return;

    setIsLoading(true);
    setErrorMsg('');
    const qs = initialToken ? `?token=${encodeURIComponent(initialToken)}` : '';
    apiRequest(`/orders/${encodeURIComponent(orderId)}${qs}`).then((res) => {
      setIsLoading(false);
      if (res.success && res.order) {
        setOrder(res.order);
        if (res.receiptToken) {
          setReceiptToken(res.receiptToken);
          try {
            sessionStorage.setItem(`order_receipt_${res.order._id}`, res.receiptToken);
          } catch {
            // ignore
          }
        }
      } else if (!order) {
        setErrorMsg(res.message || 'Could not load order receipt details.');
      }
    });
  }, [orderId, initialToken]);

  const handleInitiateGatewayPayment = async () => {
    if (!order) return;
    setGatewayError('');
    setIsInitiatingGateway(true);
    try {
      const res = await apiRequest('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order._id,
          paymentMethod: order.paymentMethod,
          receiptToken,
        }),
      });
      setIsInitiatingGateway(false);

      if (res.success && res.gatewayUrl) {
        dispatch(
          addToast({
            type: 'info',
            title: 'Redirecting to Gateway',
            message: `Transferring to ${res.paymentProvider} secure portal...`,
          })
        );
        window.location.href = res.gatewayUrl;
      } else {
        setGatewayError(
          res.error || res.message || 'Unable to connect to authorized payment gateway at this time.'
        );
      }
    } catch (err: any) {
      setIsInitiatingGateway(false);
      setGatewayError(err.message || 'Exception occurred during payment initiation.');
    }
  };

  const isCancelled = order?.orderStatus === 'cancelled';

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 space-y-8">
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center space-y-4">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-inner ${
            errorMsg
              ? 'bg-amber-50 text-amber-600'
              : isCancelled
              ? 'bg-rose-50 text-rose-600'
              : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {errorMsg ? (
            <AlertCircle className="w-10 h-10" />
          ) : isCancelled ? (
            <XCircle className="w-10 h-10" />
          ) : (
            <CheckCircle className="w-10 h-10" />
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {errorMsg
            ? 'Receipt Access Protected'
            : isCancelled
            ? 'Order Cancelled'
            : order?.paymentStatus === 'paid'
            ? 'Payment Verified & Order Confirmed!'
            : 'Thank You! Your Order is Received'}
        </h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          {errorMsg
            ? errorMsg
            : isCancelled
            ? 'This order was cancelled and any reserved inventory has been released.'
            : 'We have recorded your order details and our fulfillment team is processing your shipment.'}
        </p>

        {isLoading && (
          <div className="py-6 text-xs text-slate-400">Loading order details...</div>
        )}

        {errorMsg && !order && (
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => dispatch(openAuthModal({ tab: 'login' }))}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Sign In to View Order
            </button>
          </div>
        )}

        {order && (
          <div className="pt-4 border-t border-slate-100 text-left space-y-6">
            {/* Key Identifiers & Statuses */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Order Number</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{order.orderNumber}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Order Status</span>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-white border border-blue-200 font-bold text-blue-700 uppercase text-[10px]">
                  {order.orderStatus}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment</span>
                <span className="font-bold text-slate-900 uppercase">
                  {order.paymentMethod} ·{' '}
                  <span
                    className={
                      order.paymentStatus === 'paid'
                        ? 'text-emerald-600'
                        : order.paymentStatus === 'refunded'
                        ? 'text-amber-600'
                        : 'text-blue-700'
                    }
                  >
                    {order.paymentStatus}
                  </span>
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Grand Total</span>
                <span className="font-black text-slate-900 text-sm tabular-nums">
                  ৳{order.pricing.total.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Cash on Delivery Notice */}
            {order.paymentMethod === 'cod' && (
              <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Cash on Delivery (Pending Physical Collection)</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Your order is booked and will be dispatched to our courier partner. You will pay{' '}
                  <strong className="text-slate-900">৳{order.pricing.total.toLocaleString()}</strong> in cash
                  directly to the delivery agent upon receiving the package at your address.
                </p>
              </div>
            )}

            {/* Online Payment Pending Gateway Completion */}
            {order.paymentMethod !== 'cod' &&
              order.paymentStatus === 'pending' &&
              order.orderStatus !== 'cancelled' &&
              order.orderStatus !== 'returned' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <CreditCard className="w-4 h-4 text-amber-600" />
                      <span>
                        Awaiting {order.paymentMethod.toUpperCase()} Payment Gateway Verification (৳
                        {order.pricing.total.toLocaleString()})
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isInitiatingGateway}
                      onClick={handleInitiateGatewayPayment}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
                    >
                      {isInitiatingGateway ? 'Connecting Gateway...' : `Pay Now via ${order.paymentMethod.toUpperCase()}`}
                    </button>
                  </div>

                  <p className="text-amber-800 text-[11px]">
                    To confirm this order, payment must be processed through the authorized{' '}
                    <strong className="uppercase">{order.paymentMethod}</strong> payment gateway.
                  </p>

                  {gatewayError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-[11px] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{gatewayError}</span>
                    </div>
                  )}
                </div>
              )}

            {order.paymentDetails &&
              (order.paymentDetails.transactionId || order.paymentDetails.verifiedAt) && (
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">Verified Gateway</span>
                    <span className="font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      {order.paymentDetails.provider || order.paymentMethod.toUpperCase()}
                    </span>
                  </div>
                  {order.paymentDetails.transactionId && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Transaction ID</span>
                      <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                        {order.paymentDetails.transactionId}
                      </span>
                    </div>
                  )}
                  {order.paymentDetails.verifiedAt && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Verified At</span>
                      <span className="font-semibold text-slate-800 mt-0.5 block">
                        {new Date(order.paymentDetails.verifiedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

            {/* Items */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Purchased Items</h3>
              <div className="divide-y divide-slate-100 border-y border-slate-100">
                {order.items.map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-10 h-10 object-cover rounded-lg bg-slate-50 border border-slate-100 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{item.name}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-slate-400 mt-0.5">
                          <span>Qty: {item.quantity}</span>
                          {item.sku && <span>· SKU: {item.sku}</span>}
                          {item.options &&
                            Object.entries(item.options).map(([k, v]) => (
                              <span
                                key={k}
                                className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold text-[10px]"
                              >
                                {k}: {v}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900 tabular-nums shrink-0">
                      ৳{(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  ৳{order.pricing.subtotal.toLocaleString()}
                </span>
              </div>
              {order.pricing.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount {order.pricing.couponCode ? `(${order.pricing.couponCode})` : ''}</span>
                  <span className="tabular-nums">-৳{order.pricing.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping Fee</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {order.pricing.shippingFee === 0
                    ? 'FREE'
                    : `৳${order.pricing.shippingFee.toLocaleString()}`}
                </span>
              </div>
              {(order.pricing.tax || 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>VAT / Tax</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    ৳{order.pricing.tax.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
                <span>Total Paid / Payable</span>
                <span className="text-blue-700 tabular-nums">৳{order.pricing.total.toLocaleString()}</span>
              </div>
            </div>

            {/* Delivery address snapshot */}
            <div className="p-4 rounded-2xl bg-slate-50 text-xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Shipping Destination (Snapshot)
              </span>
              <p className="font-bold text-slate-900">
                {order.shippingAddress.recipientName} ({order.shippingAddress.phone})
              </p>
              <p className="text-slate-600">{order.shippingAddress.streetAddress}</p>
              {(order.shippingAddress.house ||
                order.shippingAddress.road ||
                order.shippingAddress.locality) && (
                <p className="text-[11px] text-slate-500">
                  {[
                    order.shippingAddress.house,
                    order.shippingAddress.road,
                    order.shippingAddress.locality,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              <p className="text-[11px] text-slate-500 font-medium">
                {order.shippingAddress.unionOrWard ? `${order.shippingAddress.unionOrWard}, ` : ''}
                {order.shippingAddress.upazila}, {order.shippingAddress.district},{' '}
                {order.shippingAddress.division}
                {order.shippingAddress.postalCode ? ` - ${order.shippingAddress.postalCode}` : ''}
              </p>
              {order.shippingAddress.deliveryInstructions && (
                <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 mt-1">
                  Instructions: {order.shippingAddress.deliveryInstructions}
                </p>
              )}
            </div>

            {/* Fulfillment Timeline */}
            {order.timeline && order.timeline.length > 0 && (
              <div className="p-4 rounded-2xl bg-white border border-slate-100 space-y-2.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Order Timeline</span>
                </div>
                {order.timeline.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[11px]">
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-1 shrink-0" />
                    <div className="flex-1">
                      <span className="font-bold capitalize text-slate-900">{step.status}</span>
                      <span className="text-slate-400 ml-2">{new Date(step.timestamp).toLocaleString()}</span>
                      {step.note && <p className="text-slate-600">{step.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-6 flex flex-wrap items-center justify-center gap-3 print:hidden">
          {order && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
          )}
          <Link
            to="/account?tab=orders"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            Track in My Orders
          </Link>
          <Link
            to="/shop"
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
          >
            Back to Storefront
          </Link>
        </div>
      </div>
    </div>
  );
};
