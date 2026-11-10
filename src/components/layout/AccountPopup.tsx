import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logout } from '../../features/auth/authSlice';
import { openAuthModal, addToast } from '../../features/ui/uiSlice';
import { apiRequest } from '../../services/api';
import {
  ShoppingBag,
  MapPin,
  Settings,
  LogOut,
  ShieldCheck,
  LogIn,
  UserPlus,
  ChevronRight,
  Heart,
  CheckCircle2,
} from 'lucide-react';

interface AccountPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountPopup: React.FC<AccountPopupProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleProtectedNavigation = (path: string) => {
    onClose();
    if (isAuthenticated) {
      navigate(path);
    } else {
      dispatch(openAuthModal({ tab: 'login', redirectPath: path }));
    }
  };

  const isStaff = user && ['super_admin', 'admin', 'order_manager', 'inventory_manager', 'catalog_manager', 'finance', 'customer_support'].includes(user.role);

  const handleLogout = async () => {
    try {
      await apiRequest(isStaff ? '/auth/admin/logout' : '/auth/logout', { method: 'POST' });
    } catch {
      // Proceed with local session clearing even if request fails
    }
    dispatch(logout());
    dispatch(
      addToast({
        type: 'info',
        title: 'Signed Out',
        message: 'You have been safely signed out.',
      })
    );
    onClose();
    navigate('/');
  };

  // Determine provider display badge
  const providers = user?.providers || ['email'];
  const isGoogle = providers.includes('google') || !!user?.googleId;
  const isFacebook = providers.includes('facebook') || !!user?.facebookId;

  return (
    <div
      ref={popupRef}
      className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 py-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {isAuthenticated && user ? (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 mb-1">
          <div className="flex items-start gap-3">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-blue-600/20 shrink-0 shadow-xs"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-700 to-blue-500 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                {user.emailVerified && (
                  <span title="Verified Account">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
              
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700">
                  {user.role}
                </span>

                {isGoogle && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Google
                  </span>
                )}
                {isFacebook && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    Facebook
                  </span>
                )}
                {!isGoogle && !isFacebook && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    Email Account
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-slate-100 text-center">
          <p className="text-sm font-bold text-slate-900 mb-1">Welcome to Aurelia Commerce</p>
          <p className="text-xs text-slate-500 mb-3">Sign in for order tracking & faster checkout</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onClose();
                dispatch(openAuthModal({ tab: 'login' }));
              }}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              onClick={() => {
                onClose();
                dispatch(openAuthModal({ tab: 'register' }));
              }}
              className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register
            </button>
          </div>
        </div>
      )}

      {/* Menu items */}
      <div className="py-1">
        <button
          onClick={() => handleProtectedNavigation('/account?tab=orders')}
          className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between group transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            <span>My Orders & Purchases</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
        </button>

        <button
          onClick={() => handleProtectedNavigation('/wishlist')}
          className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between group transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Heart className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
            <span>My Wishlist & Favorites</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
        </button>

        <button
          onClick={() => handleProtectedNavigation('/account?tab=addresses')}
          className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between group transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            <span>Saved Shipping Addresses</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
        </button>

        <button
          onClick={() => handleProtectedNavigation('/account?tab=profile')}
          className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between group transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Settings className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            <span>Account Profile & Security</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
        </button>

        {isStaff && (
          <button
            onClick={() => {
              onClose();
              navigate('/admin');
            }}
            className="w-full px-4 py-2.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center justify-between group transition-colors border-t border-slate-100 mt-1 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Admin Operations Suite</span>
            </div>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">STAFF</span>
          </button>
        )}

        {isAuthenticated && (
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors border-t border-slate-100 mt-1 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </div>
  );
};
