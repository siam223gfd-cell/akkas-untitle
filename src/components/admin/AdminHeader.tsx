import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  LogOut,
  User,
  Settings,
  ExternalLink,
  Shield,
  CheckCircle,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logout } from '../../features/auth/authSlice';
import { addToast } from '../../features/ui/uiSlice';
import { apiRequest } from '../../services/api';

interface AdminHeaderProps {
  onOpenMobileSidebar: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  recentActivities?: { type: string; title: string; time: string }[];
  lowStockProducts?: { _id: string; name: string; stock: number }[];
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  onOpenMobileSidebar,
  searchQuery,
  onSearchChange,
  recentActivities = [],
  lowStockProducts = [],
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const notifications = [
    ...lowStockProducts
      .filter((p) => Number(p.stock) <= 5)
      .slice(0, 3)
      .map((p) => ({
        title: `Stock Alert: ${p.name}`,
        subtitle:
          p.stock <= 0 ? 'Out of stock — restock needed' : `Only ${p.stock} unit(s) remaining in stock`,
        isAlert: true,
      })),
    ...recentActivities.slice(0, 4).map((act) => ({
      title: act.title,
      subtitle: act.time,
      isAlert: false,
    })),
  ];

  const handleSignOut = async () => {
    try {
      await apiRequest('/auth/admin/logout', { method: 'POST' });
    } catch {
      // Continue client logout even if network error
    }
    dispatch(logout());
    dispatch(
      addToast({
        type: 'info',
        title: 'Signed Out',
        message: 'You have been securely logged out of the admin panel.',
      })
    );
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Left Side: Mobile Menu Button & Search Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search bar matching Reference */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-600">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search anything..."
              className="w-full pl-10 pr-20 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/80 rounded-2xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-mono text-slate-400 shadow-2xs">
                Ctrl + K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right Side: Storefront Link, Notifications & Admin Profile */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Quick link to live public storefront */}
          <Link
            to="/"
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors border border-blue-200/60 shadow-2xs"
            title="View customer storefront in new tab"
          >
            <span>View Storefront</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          {/* Notifications Bell with live unread badge */}
          <div className="relative">
            <button
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsProfileMenuOpen(false);
              }}
              className="relative p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60 transition-colors shadow-2xs"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                  {notifications.length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-900">Notifications</h4>
                  <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                    {notifications.length} Recent
                  </span>
                </div>
                {notifications.length === 0 ? (
                  <p className="py-5 text-center text-xs text-slate-400">No recent notifications.</p>
                ) : (
                  <div className="divide-y divide-slate-50 py-1 text-xs space-y-2 max-h-72 overflow-y-auto">
                    {notifications.map((item, idx) => (
                      <div key={idx} className="pt-2 first:pt-1">
                        <p className="font-bold text-slate-800 truncate">{item.title}</p>
                        <p className={`text-[11px] ${item.isAlert ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                          {item.subtitle}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Admin Profile */}
          <div className="relative">
            <button
              onClick={() => {
                setIsProfileMenuOpen(!isProfileMenuOpen);
                setIsNotificationsOpen(false);
              }}
              className="flex items-center gap-3 p-1 sm:pr-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || 'Admin Avatar'}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/30"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-700 to-blue-500 text-white flex items-center justify-center font-black text-xs ring-2 ring-blue-500/20">
                  {(user?.name || 'A').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-900">{user?.name || 'Staff'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <span className="text-[10px] text-slate-400 font-medium block capitalize">
                  {user?.role ? user.role.replace('_', ' ') : 'Staff'}
                </span>
              </div>
            </button>

            {/* Profile Dropdown */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-900">{user?.name || 'Staff'}</p>
                  {user?.email && <p className="text-[10px] text-slate-400 truncate">{user.email}</p>}
                  <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                    {user?.role ? user.role.replace('_', ' ') : 'staff'}
                  </span>
                </div>
                <div className="py-1">
                  <Link
                    to="/account"
                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Account Profile</span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2 text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
