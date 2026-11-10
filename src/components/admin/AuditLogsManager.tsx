import React, { useState, useEffect } from 'react';
import { AuditLog } from '../../types';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity,
  User,
  Clock,
  Layers,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { AuditLogDetailsDrawer } from './drawers/AuditLogDetailsDrawer';

const MODULE_OPTIONS = [
  { value: 'all', label: 'All Modules' },
  { value: 'Security & Auth', label: 'Security & Auth' },
  { value: 'Products', label: 'Products Catalog' },
  { value: 'Orders & Fulfillment', label: 'Orders & Fulfillment' },
  { value: 'Staff Management', label: 'Staff Management & RBAC' },
  { value: 'Categories', label: 'Categories' },
  { value: 'Brands', label: 'Brands Directory' },
  { value: 'Promotions & Coupons', label: 'Promotions & Coupons' },
  { value: 'Reviews', label: 'Customer Reviews' },
  { value: 'Backup & Recovery', label: 'Backup & Recovery' },
  { value: 'Customer Management', label: 'Customer Management' },
  { value: 'Settings & Config', label: 'Settings & Config' },
];

export const AuditLogsManager: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const fetchLogs = async (page = currentPage) => {
    setIsLoading(true);
    const query = new URLSearchParams();
    if (searchQuery) query.set('search', searchQuery);
    if (moduleFilter !== 'all') query.set('module', moduleFilter);
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);
    query.set('page', String(page));
    query.set('limit', '15');

    const res = await apiRequest(`/admin/audit-logs?${query.toString()}`);
    setIsLoading(false);
    if (res.success && res.logs) {
      setLogs(res.logs);
      if (res.pagination) {
        setTotalPages(res.pagination.totalPages || 1);
        setCurrentPage(res.pagination.page || 1);
        setTotalLogs(res.pagination.total || 0);
      }
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [moduleFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setModuleFilter('all');
    setStartDate('');
    setEndDate('');
    fetchLogs(1);
  };

  const getModuleBadgeColor = (mod: string) => {
    switch (mod.toLowerCase()) {
      case 'security & auth':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'products':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'orders & fulfillment':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'staff management':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'backup & recovery':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">System Administrative Audit Trail</h2>
            <p className="text-xs text-slate-500">
              Immutable ledger of administrative logins, catalog modifications, order lifecycle updates, and system recovery.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            {totalLogs} Events Logged
          </span>
          <button
            onClick={() => fetchLogs(currentPage)}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <form onSubmit={handleSearchSubmit} className="space-y-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keyword, admin name, action..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
            />
          </div>

          {/* Module Selector */}
          <div>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
            >
              {MODULE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Start */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs text-slate-700 bg-transparent focus:outline-hidden"
              title="Filter from date"
            />
          </div>

          {/* Date Range End */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs text-slate-700 bg-transparent focus:outline-hidden"
              title="Filter to date"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
          >
            Clear Filters
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            Apply Search
          </button>
        </div>
      </form>

      {/* Audit Logs Table */}
      <div className="divide-y divide-slate-100">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Loading audit log records...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <Activity className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">No audit events match your filter criteria.</p>
            <p className="text-[11px] text-slate-400">Try clearing active search or date parameters.</p>
          </div>
        ) : (
          logs.map((log) => {
            const dateStr = new Date(log.timestamp).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const timeStr = new Date(log.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={log._id}
                onClick={() => setSelectedLog(log)}
                className="py-3 px-3 rounded-2xl hover:bg-slate-50/90 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-[11px] bg-slate-900 text-white px-2 py-0.5 rounded-md">
                      {log.action}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getModuleBadgeColor(log.module)}`}>
                      {log.module}
                    </span>
                    {log.recordId && (
                      <span className="text-[10px] font-mono text-slate-400">
                        #{String(log.recordId).slice(-6)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-800 font-medium leading-relaxed truncate max-w-xl">
                    {log.details}
                  </p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                  <div className="text-right text-[11px] text-slate-500">
                    <p className="font-bold text-slate-800">
                      {log.actorName} <span className="font-normal text-slate-400">({log.actorRole})</span>
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">
                      {dateStr} · {timeStr}
                    </p>
                  </div>
                  <div className="p-1.5 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition">
                    <Eye className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium">
            Page <strong className="text-slate-900">{currentPage}</strong> of <strong className="text-slate-900">{totalPages}</strong> ({totalLogs} total)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => fetchLogs(currentPage - 1)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => fetchLogs(currentPage + 1)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Audit Log Inspection Drawer */}
      <AuditLogDetailsDrawer
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        log={selectedLog}
      />
    </div>
  );
};
