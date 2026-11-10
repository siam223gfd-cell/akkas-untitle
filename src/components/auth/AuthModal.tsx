import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { closeAuthModal, setAuthModalTab, addToast } from '../../features/ui/uiSlice';
import { loginSuccess } from '../../features/auth/authSlice';
import { Modal } from '../ui/Modal';
import { apiRequest } from '../../services/api';
import {
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AuthModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthModalOpen, authModalTab, authRedirectPath } = useAppSelector((state) => state.ui);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<'google' | 'facebook' | null>(null);
  const [formError, setFormError] = useState('');

  // Password strength logic
  const calculateStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 9) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: 'bg-rose-500' };
      case 2:
        return { score: 2, label: 'Fair', color: 'bg-amber-500' };
      case 3:
        return { score: 3, label: 'Good', color: 'bg-blue-500' };
      case 4:
        return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
      default:
        return { score: 0, label: '', color: 'bg-slate-200' };
    }
  };

  const strength = calculateStrength(password);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsLoading(true);

    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });

    setIsLoading(false);

    if (res.success && res.token && res.user) {
      dispatch(loginSuccess({ user: res.user, token: res.token }));
      dispatch(
        addToast({
          type: 'success',
          title: 'Welcome Back!',
          message: `Signed in as ${res.user.name}`,
        })
      );
      dispatch(closeAuthModal());
      if (authRedirectPath) {
        navigate(authRedirectPath);
      }
    } else {
      setFormError(res.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanPhone = phone.replace(/[\s()-]/g, '').trim();
    if (cleanPhone && !/^(?:\+?88)?01[3-9]\d{8}$/.test(cleanPhone)) {
      setFormError('Please enter a valid 11-digit Bangladesh mobile number (e.g. 01712345678).');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must contain at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);

    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: cleanPhone,
      }),
    });

    setIsLoading(false);

    if (res.success && res.token && res.user) {
      dispatch(loginSuccess({ user: res.user, token: res.token }));
      dispatch(
        addToast({
          type: 'success',
          title: 'Account Created',
          message: 'Welcome to Aurelia Commerce! Your account is active.',
        })
      );
      dispatch(closeAuthModal());
      if (authRedirectPath) {
        navigate(authRedirectPath);
      }
    } else {
      setFormError(res.message || 'Registration failed.');
    }
  };

  // Google OAuth flow
  const handleGoogleAuth = async () => {
    setFormError('');
    setIsOAuthLoading('google');

    try {
      const cfg = await apiRequest('/auth/config');
      if (cfg?.google?.isConfigured) {
        const redirectUri = `${window.location.origin}/auth/callback/google`;
        const urlRes = await apiRequest(`/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
        if (urlRes?.success && urlRes?.url) {
          window.location.assign(urlRes.url);
          return;
        }
      }

      setIsOAuthLoading(null);
      setFormError(
        'Google OAuth is not configured on this server. Please sign in or create an account with your email address.'
      );
    } catch (err: any) {
      setIsOAuthLoading(null);
      setFormError(err.message || 'Network error during Google authentication.');
    }
  };

  // Facebook OAuth flow
  const handleFacebookAuth = async () => {
    setFormError('');
    setIsOAuthLoading('facebook');

    try {
      const cfg = await apiRequest('/auth/config');
      if (cfg?.facebook?.isConfigured) {
        const redirectUri = `${window.location.origin}/auth/callback/facebook`;
        const urlRes = await apiRequest(`/auth/facebook/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
        if (urlRes?.success && urlRes?.url) {
          window.location.assign(urlRes.url);
          return;
        }
      }

      setIsOAuthLoading(null);
      setFormError(
        'Facebook OAuth is not configured on this server. Please sign in or create an account with your email address.'
      );
    } catch (err: any) {
      setIsOAuthLoading(null);
      setFormError(err.message || 'Network error during Facebook authentication.');
    }
  };

  return (
    <Modal
      isOpen={isAuthModalOpen}
      onClose={() => dispatch(closeAuthModal())}
      title={
        authModalTab === 'login'
          ? 'Sign In to Your Account'
          : authModalTab === 'register'
          ? 'Create a Customer Account'
          : 'Reset Password'
      }
      subtitle="Orders, saved addresses, and verified reviews are synced with your persistent account."
      maxWidth="md"
    >
      {/* Tab toggle */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-5">
        <button
          type="button"
          onClick={() => {
            dispatch(setAuthModalTab('login'));
            setFormError('');
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            authModalTab === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch(setAuthModalTab('register'));
            setFormError('');
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            authModalTab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Create Account
        </button>
      </div>

      {formError && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* Social OAuth Buttons Row (Real Google & Facebook buttons) */}
      {authModalTab !== 'forgot' && (
        <div className="space-y-2.5 mb-5">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isLoading || !!isOAuthLoading}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
          >
            {isOAuthLoading === 'google' ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.93 6.72-4.93z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            onClick={handleFacebookAuth}
            disabled={isLoading || !!isOAuthLoading}
            className="w-full py-2.5 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
          >
            {isOAuthLoading === 'facebook' ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            )}
            <span>Continue with Facebook</span>
          </button>

          <div className="relative flex py-2 items-center">
            <div className="grow border-t border-slate-200"></div>
            <span className="shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Or continue with email
            </span>
            <div className="grow border-t border-slate-200"></div>
          </div>
        </div>
      )}

      {/* LOGIN TAB */}
      {authModalTab === 'login' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">Password</label>
              <button
                type="button"
                onClick={() => dispatch(setAuthModalTab('forgot'))}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !!isOAuthLoading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing In...
              </>
            ) : (
              <>
                Sign In to Proceed
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* REGISTER TAB */}
      {authModalTab === 'register' && (
        <form onSubmit={handleRegister} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rafik Hasan"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 1712 345678"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Create Password</label>
              {strength.label && (
                <span className="text-[10px] font-bold text-slate-500">
                  Strength: <span className="text-slate-800">{strength.label}</span>
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength progress bar */}
            {password.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-1 rounded-full transition-all ${
                      strength.score >= step ? strength.color : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && password === confirmPassword && (
              <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1 font-medium">
                <Check className="w-3 h-3" /> Passwords match
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !!isOAuthLoading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                Complete Registration
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* FORGOT PASSWORD TAB */}
      {authModalTab === 'forgot' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <p className="text-xs font-bold text-slate-800">Account Recovery Assistance</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Automated email password reset is not configured on this server. Contact our support team with your registered email address for identity verification and password assistance.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                dispatch(closeAuthModal());
                navigate('/contact');
              }}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              Contact Support
            </button>
            <button
              type="button"
              onClick={() => dispatch(setAuthModalTab('login'))}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
