import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { closeAdminLoginModal, addToast } from '../../features/ui/uiSlice';
import { setCredentials } from '../../features/auth/authSlice';
import { apiRequest } from '../../services/api';
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  X,
  AlertCircle,
  Loader2,
  ArrowRight,
  KeyRound,
} from 'lucide-react';

export const AdminLoginModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isOpen = useAppSelector((state) => state.ui.isAdminLoginModalOpen);
  const { user } = useAppSelector((state) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Reset errors when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setFieldErrors({});
      // If already logged in with admin credentials, prefill email
      if (user && user.role !== 'customer') {
        setEmail(user.email);
      }
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      errors.email = 'Administrator email is required';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Administrator password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const res = await apiRequest('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (res.success && res.token && res.user) {
        dispatch(
          setCredentials({
            token: res.token,
            user: res.user,
          })
        );

        dispatch(
          addToast({
            type: 'success',
            title: 'Authentication Successful',
            message: `Welcome back, ${res.user.name}! Administrative session authorized.`,
          })
        );

        dispatch(closeAdminLoginModal());
        setPassword('');
        navigate('/admin');
      } else {
        setErrorMessage(res.message || 'Administrative authentication failed. Check credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'A network error occurred while authenticating.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-login-title"
      >
        {/* Top Decorative Header */}
        <div className="bg-gradient-to-r from-[#06152d] via-[#002b66] to-[#001736] p-6 text-white relative">
          <button
            onClick={() => dispatch(closeAdminLoginModal())}
            disabled={isLoading}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors disabled:opacity-50"
            aria-label="Close Admin Login Modal"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/90 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 border border-blue-400/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">
                Aurelia Security Gateway
              </span>
              <h2 id="admin-login-title" className="text-xl font-black text-white tracking-tight">
                Admin Portal Login
              </h2>
            </div>
          </div>
          <p className="text-xs text-blue-100/80 mt-2 leading-relaxed">
            Restricted access. Sign in with your administrative account to manage store operations, catalog, and orders.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {/* Global Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1">
                <span className="font-bold block">Authentication Error</span>
                <span className="text-[11px] leading-relaxed">{errorMessage}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Administrator Email <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  disabled={isLoading}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="admin@aurelia.com"
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition-all ${
                    fieldErrors.email ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-blue-600'
                  }`}
                  autoComplete="username"
                  required
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-rose-500 font-medium pl-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Password <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-slate-400" />
                  Encrypted & Secure
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  disabled={isLoading}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="Enter administrator password"
                  className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition-all ${
                    fieldErrors.password ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-blue-600'
                  }`}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-rose-500 font-medium pl-1">{fieldErrors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all hover:translate-y-px disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Admin Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 text-[11px] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <p>
              Environment-backed security: Protected by rate-limiting & HttpOnly token authentication.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
