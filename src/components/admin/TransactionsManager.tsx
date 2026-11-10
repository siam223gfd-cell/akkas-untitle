import React, { useState, useEffect } from 'react';
import { PaymentTransaction, ProviderConfigurationStatus } from '../../types';
import { apiRequest } from '../../services/api';
import { useAppDispatch } from '../../app/hooks';
import { addToast } from '../../features/ui/uiSlice';
import { AdminModal } from './common/modal';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCcw,
  Search,
  Filter,
  Calendar,
  Eye,
  ShieldCheck,
  Building,
  User,
  Phone,
  Hash,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Banknote,
  AlertTriangle,
} from 'lucide-react';

interface TransactionsManagerProps {
  onInspectOrder?: (orderId: string) => void;
}

export const TransactionsManager: React.FC<TransactionsManagerProps> = ({ onInspectOrder }) => {
  const dispatch = useAppDispatch();

  // Transactions list & pagination
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dashboard Stats
  const [stats, setStats] = useState<any>(null);
  const [providersStatus, setProvidersStatus] = useState<ProviderConfigurationStatus[]>([]);

  // Modals & Inspection Drawer
  const [inspectingTxn, setInspectingTxn] = useState<PaymentTransaction | null>(null);

  // COD Collection Modal
  const [codModalTxn, setCodModalTxn] = useState<PaymentTransaction | null>(null);
  const [codAmount, setCodAmount] = useState<number>(0);
  const [codReceipt, setCodReceipt] = useState('');
  const [codNotes, setCodNotes] = useState('');
  const [isSubmittingCod, setIsSubmittingCod] = useState(false);

  // Refund Modal
  const [refundModalTxn, setRefundModalTxn] = useState<PaymentTransaction | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (providerFilter !== 'all') params.set('provider', providerFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const [txRes, statsRes, provRes] = await Promise.all([
        apiRequest(`/payments/transactions?${params.toString()}`),
        apiRequest(`/payments/stats?${params.toString()}`),
        apiRequest('/payments/providers/config'),
      ]);

      if (txRes.success) {
        setTransactions(txRes.transactions || []);
        if (txRes.pagination) {
          setTotal(txRes.pagination.total);
          setTotalPages(txRes.pagination.totalPages);
        }
      }

      if (statsRes.success && statsRes.stats) {
        setStats(statsRes.stats);
      }

      if (provRes.success && Array.isArray(provRes.providers)) {
        setProvidersStatus(provRes.providers);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions();
    }, 150);
    return () => clearTimeout(timer);
  }, [page, providerFilter, statusFilter, search, startDate, endDate]);

  const handleOpenCodModal = (txn: PaymentTransaction) => {
    setCodModalTxn(txn);
    setCodAmount(txn.amount);
    setCodReceipt(`REC-${Date.now().toString().slice(-6)}`);
    setCodNotes('');
  };

  const handleConfirmCod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codModalTxn) return;
    setIsSubmittingCod(true);

    const res = await apiRequest('/payments/cod/collect', {
      method: 'POST',
      body: JSON.stringify({
        orderId: codModalTxn.orderId,
        collectedAmount: Number(codAmount) || codModalTxn.amount,
        receiptNumber: codReceipt.trim() || undefined,
        notes: codNotes.trim() || undefined,
      }),
    });

    setIsSubmittingCod(false);
    if (res.success) {
      dispatch(
        addToast({
          type: 'success',
          title: 'COD Payment Collected',
          message: res.message || 'Payment marked as collected and order confirmed.',
        })
      );
      setCodModalTxn(null);
      fetchTransactions();
    } else {
      dispatch(
        addToast({
          type: 'error',
          title: 'Collection Failed',
          message: res.message || 'Could not record collection.',
        })
      );
    }
  };

  const handleOpenRefundModal = (txn: PaymentTransaction) => {
    setRefundModalTxn(txn);
    setRefundAmount(txn.amount);
    setRefundReason('Customer requested refund / order return');
  };

  const handleConfirmRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalTxn) return;
    setIsSubmittingRefund(true);

    const res = await apiRequest('/payments/refund', {
      method: 'POST',
      body: JSON.stringify({
        transactionId: refundModalTxn.transactionNumber,
        amount: Number(refundAmount) || refundModalTxn.amount,
        reason: refundReason.trim(),
      }),
    });

    setIsSubmittingRefund(false);
    if (res.success) {
      dispatch(
        addToast({
          type: 'success',
          title: 'Refund Processed',
          message: res.message || 'Refund successfully recorded and synchronized.',
        })
      );
      setRefundModalTxn(null);
      fetchTransactions();
    } else {
      dispatch(
        addToast({
          type: 'error',
          title: 'Refund Failed',
          message: res.message || 'Could not process refund.',
        })
      );
    }
  };

  const providerBadges: Record<string, { label: string; bg: string; text: string; border: string }> = {
    BKASH: { label: 'bKash', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
    NAGAD: { label: 'Nagad', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    SSLCOMMERZ: { label: 'Card (SSLCOMMERZ)', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    COD: { label: 'Cash on Delivery', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' },
  };

  const statusBadges: Record<string, { label: string; bg: string; text: string }> = {
    paid: { label: 'Paid & Verified', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    pending: { label: 'Pending Collection', bg: 'bg-amber-100', text: 'text-amber-800' },
    initiated: { label: 'Initiated', bg: 'bg-blue-100', text: 'text-blue-800' },
    processing: { label: 'Processing', bg: 'bg-indigo-100', text: 'text-indigo-800' },
    failed: { label: 'Failed', bg: 'bg-rose-100', text: 'text-rose-800' },
    cancelled: { label: 'Cancelled', bg: 'bg-slate-100', text: 'text-slate-700' },
    refunded: { label: 'Refunded', bg: 'bg-purple-100', text: 'text-purple-800' },
  };

  const summary = stats?.summary || {
    totalVolume: 0,
    paidVolume: 0,
    onlinePaidVolume: 0,
    codCollectedVolume: 0,
    codPendingVolume: 0,
    refundedVolume: 0,
  };

  return (
    <div className="space-y-6">
      {/* 1. Payment Dashboard Volume KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
            Total Payment Volume
          </span>
          <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
            ৳ {summary.totalVolume.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Gross recorded transactions</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide block">
            Online Paid Volume
          </span>
          <p className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">
            ৳ {summary.onlinePaidVolume.toLocaleString()}
          </p>
          <span className="text-[10px] text-emerald-600/80 font-medium">bKash, Nagad & Cards</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide block">
            COD Collected
          </span>
          <p className="text-2xl font-black text-blue-700 mt-1 tabular-nums">
            ৳ {summary.codCollectedVolume.toLocaleString()}
          </p>
          <span className="text-[10px] text-blue-600/80 font-medium">Physical cash confirmed</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide block">
            COD Pending Collection
          </span>
          <p className="text-2xl font-black text-amber-700 mt-1 tabular-nums">
            ৳ {summary.codPendingVolume.toLocaleString()}
          </p>
          <span className="text-[10px] text-amber-600/80 font-medium">Courier delivery queue</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
          <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide block">
            Total Refunds
          </span>
          <p className="text-2xl font-black text-purple-700 mt-1 tabular-nums">
            ৳ {summary.refundedVolume.toLocaleString()}
          </p>
          <span className="text-[10px] text-purple-600/80 font-medium">Returned / compensated</span>
        </div>
      </div>

      {/* 2. Gateway Environment & Credentials Health Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
              Payment Gateway Integration Status
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">Live Server-to-Server Environment</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {providersStatus.map((prov) => (
            <div
              key={prov.provider}
              className={`p-3 rounded-xl border flex flex-col justify-between ${
                prov.isConfigured
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-amber-50/50 border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">{prov.name.split(' ')[0]}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    prov.environment === 'live'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-purple-600 text-white'
                  }`}
                >
                  {prov.environment}
                </span>
              </div>
              <div className="mt-2 text-[11px]">
                {prov.isConfigured ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Credentials Configured
                  </span>
                ) : (
                  <div>
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Pending Credentials
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate mt-0.5" title={prov.missingCredentials.join(', ')}>
                      Needs: {prov.missingCredentials.slice(0, 2).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Transaction Ledger Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900">Payment Transactions Ledger</h2>
            <p className="text-xs text-slate-500">
              Complete, tamper-proof record of payment initiation, server-side verification, COD collections, and refunds.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search TxID, Order #, Phone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white"
              />
            </div>

            <select
              aria-label="Filter by provider"
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPage(1);
              }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
            >
              <option value="all">All Providers</option>
              <option value="BKASH">bKash</option>
              <option value="NAGAD">Nagad</option>
              <option value="SSLCOMMERZ">SSLCOMMERZ</option>
              <option value="COD">Cash on Delivery</option>
            </select>

            <select
              aria-label="Filter by payment status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid & Verified</option>
              <option value="pending">Pending Collection</option>
              <option value="initiated">Initiated</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                aria-label="Start date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs text-slate-700 focus:outline-none"
              />
              <span className="text-slate-400 text-[10px]">to</span>
              <input
                type="date"
                aria-label="End date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs text-slate-700 focus:outline-none"
              />
            </div>

            {(providerFilter !== 'all' || statusFilter !== 'all' || search || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setProviderFilter('all');
                  setStatusFilter('all');
                  setSearch('');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Tx Number / Date</th>
                <th className="p-3">Order Ref</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Provider & Gateway</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-slate-500">
                    {isLoading ? 'Loading transactions ledger...' : 'No transactions recorded matching the filters.'}
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => {
                  const pBadge = providerBadges[txn.paymentProvider] || providerBadges.COD;
                  const sBadge = statusBadges[txn.paymentStatus] || { label: txn.paymentStatus, bg: 'bg-slate-100 text-slate-700' };

                  return (
                    <tr key={txn._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3">
                        <span className="font-mono font-bold text-slate-900 block truncate max-w-[150px]">
                          {txn.transactionNumber}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(txn.createdAt).toLocaleString()}
                        </span>
                      </td>

                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => onInspectOrder && onInspectOrder(txn.orderId)}
                          className="font-mono font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>{txn.orderNumber}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>

                      <td className="p-3">
                        <p className="font-bold text-slate-900">{txn.customerName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{txn.customerPhone}</p>
                      </td>

                      <td className="p-3 space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${pBadge.bg} ${pBadge.text} ${pBadge.border}`}
                        >
                          {pBadge.label}
                        </span>
                        {txn.gatewayTransactionId && (
                          <p className="font-mono text-[10px] text-slate-500 truncate max-w-[130px]">
                            GW: {txn.gatewayTransactionId}
                          </p>
                        )}
                      </td>

                      <td className="p-3 font-black text-slate-900 tabular-nums text-sm">
                        ৳ {txn.amount.toLocaleString()}
                      </td>

                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${sBadge.bg}`}>
                          {sBadge.label}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectingTxn(txn)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Inspect full transaction details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {txn.paymentProvider === 'COD' && txn.paymentStatus !== 'paid' && txn.paymentStatus !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleOpenCodModal(txn)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                              title="Confirm COD Cash Collection"
                            >
                              Collect
                            </button>
                          )}

                          {txn.paymentStatus === 'paid' && (
                            <button
                              type="button"
                              onClick={() => handleOpenRefundModal(txn)}
                              className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="Process Refund"
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Showing page {page} of {totalPages} ({total} transactions)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Transaction Details Inspection Modal */}
      {inspectingTxn && (
        <AdminModal
          isOpen={!!inspectingTxn}
          onClose={() => setInspectingTxn(null)}
          title={`Transaction ${inspectingTxn.transactionNumber}`}
          subtitle={`Created on ${new Date(inspectingTxn.createdAt).toLocaleString()}`}
          icon={<CreditCard className="w-5 h-5 text-blue-600" />}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Amount</span>
                <span className="text-base font-black text-slate-900 tabular-nums">
                  ৳ {inspectingTxn.amount.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                <span className="font-bold text-slate-900 uppercase">{inspectingTxn.paymentStatus}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Provider</span>
                <span className="font-bold text-slate-900">{inspectingTxn.paymentProvider}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Environment</span>
                <span className="font-bold text-purple-700 uppercase">{inspectingTxn.environment}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-100 space-y-2">
              <h4 className="font-black text-slate-900 uppercase tracking-wide text-[10px]">Order & Customer</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                <p>
                  <strong>Order:</strong> #{inspectingTxn.orderNumber}
                </p>
                <p>
                  <strong>Customer:</strong> {inspectingTxn.customerName}
                </p>
                <p>
                  <strong>Email:</strong> {inspectingTxn.customerEmail}
                </p>
                <p>
                  <strong>Phone:</strong> {inspectingTxn.customerPhone}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-100 space-y-2">
              <h4 className="font-black text-slate-900 uppercase tracking-wide text-[10px]">Gateway Audit Trail</h4>
              <div className="space-y-1 text-slate-600">
                <p>
                  <strong>Internal Ref:</strong> {inspectingTxn.merchantTransactionReference}
                </p>
                {inspectingTxn.gatewayTransactionId && (
                  <p>
                    <strong>Gateway Transaction ID:</strong> {inspectingTxn.gatewayTransactionId}
                  </p>
                )}
                {inspectingTxn.gatewaySessionId && (
                  <p>
                    <strong>Gateway Session ID:</strong> {inspectingTxn.gatewaySessionId}
                  </p>
                )}
                {inspectingTxn.verificationTimestamp && (
                  <p>
                    <strong>Verified At:</strong> {new Date(inspectingTxn.verificationTimestamp).toLocaleString()}
                  </p>
                )}
                {inspectingTxn.failureReason && (
                  <p className="text-rose-600 font-semibold">
                    <strong>Failure Reason:</strong> {inspectingTxn.failureReason}
                  </p>
                )}
              </div>
            </div>

            {inspectingTxn.codCollection && (
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-100 space-y-1 text-blue-900">
                <h4 className="font-black uppercase tracking-wide text-[10px]">Cash on Delivery Collection Proof</h4>
                <p>
                  <strong>Collected By:</strong> {inspectingTxn.codCollection.collectedBy}
                </p>
                <p>
                  <strong>Collected Amount:</strong> ৳{inspectingTxn.codCollection.collectedAmount.toLocaleString()}
                </p>
                <p>
                  <strong>Receipt #:</strong> {inspectingTxn.codCollection.receiptNumber || 'N/A'}
                </p>
                <p>
                  <strong>Timestamp:</strong> {new Date(inspectingTxn.codCollection.collectedAt).toLocaleString()}
                </p>
                {inspectingTxn.codCollection.notes && (
                  <p>
                    <strong>Notes:</strong> {inspectingTxn.codCollection.notes}
                  </p>
                )}
              </div>
            )}

            {inspectingTxn.refundDetails && (
              <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-100 space-y-1 text-purple-900">
                <h4 className="font-black uppercase tracking-wide text-[10px]">Refund Details</h4>
                <p>
                  <strong>Refund Trx ID:</strong> {inspectingTxn.refundDetails.refundTrxId || 'N/A'}
                </p>
                <p>
                  <strong>Refund Amount:</strong> ৳{inspectingTxn.refundDetails.refundAmount.toLocaleString()}
                </p>
                <p>
                  <strong>Refunded By:</strong> {inspectingTxn.refundDetails.refundedBy}
                </p>
                <p>
                  <strong>Timestamp:</strong> {new Date(inspectingTxn.refundDetails.refundedAt).toLocaleString()}
                </p>
                {inspectingTxn.refundDetails.refundReason && (
                  <p>
                    <strong>Reason:</strong> {inspectingTxn.refundDetails.refundReason}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectingTxn(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* 5. Confirm COD Cash Collection Modal */}
      {codModalTxn && (
        <AdminModal
          isOpen={!!codModalTxn}
          onClose={() => setCodModalTxn(null)}
          title={`Confirm COD Collection for Order #${codModalTxn.orderNumber}`}
          subtitle="Record physical cash collection by courier or delivery officer."
          icon={<Banknote className="w-5 h-5 text-emerald-600" />}
          size="md"
        >
          <form onSubmit={handleConfirmCod} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 space-y-1">
              <p className="font-bold">Collection Verification Policy</p>
              <p className="text-[11px] leading-relaxed">
                Confirming this collection permanently transitions Order #{codModalTxn.orderNumber} to{' '}
                <strong>PAID</strong> and records an audited collection entry under your staff account.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Collected Amount (৳)</label>
              <input
                type="number"
                required
                min={1}
                value={codAmount}
                onChange={(e) => setCodAmount(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Receipt / Slip # (Optional)</label>
              <input
                type="text"
                value={codReceipt}
                onChange={(e) => setCodReceipt(e.target.value)}
                placeholder="e.g. REC-894212"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Courier / Collection Note (Optional)</label>
              <input
                type="text"
                value={codNotes}
                onChange={(e) => setCodNotes(e.target.value)}
                placeholder="Collected by courier delivery agent"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCodModalTxn(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingCod}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingCod ? 'Recording...' : 'Confirm Cash Received'}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* 6. Refund Confirmation Modal */}
      {refundModalTxn && (
        <AdminModal
          isOpen={!!refundModalTxn}
          onClose={() => setRefundModalTxn(null)}
          title={`Process Refund for Tx ${refundModalTxn.transactionNumber}`}
          subtitle={`Order #${refundModalTxn.orderNumber} via ${refundModalTxn.paymentProvider}`}
          icon={<RotateCcw className="w-5 h-5 text-purple-600" />}
          size="md"
        >
          <form onSubmit={handleConfirmRefund} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-900 space-y-1">
              <p className="font-bold">Refund Compliance Rule</p>
              <p className="text-[11px] leading-relaxed">
                Refunds are initiated through the official provider API where supported, and audited in your store ledger.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Refund Amount (৳)</label>
              <input
                type="number"
                required
                min={1}
                max={refundModalTxn.amount}
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Max refundable: ৳{refundModalTxn.amount.toLocaleString()}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Refund Reason *</label>
              <textarea
                required
                rows={2}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for refund..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRefundModalTxn(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingRefund}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingRefund ? 'Processing...' : 'Authorize Refund'}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
};
