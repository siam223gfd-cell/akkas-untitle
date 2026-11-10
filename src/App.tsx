import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './app/store';
import { hydrateUser, logout, setSessionChecking } from './features/auth/authSlice';
import { apiRequest } from './services/api';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { ToastContainer } from './components/ui/ToastContainer';
import { AuthModal } from './components/auth/AuthModal';
import { AdminLoginModal } from './components/auth/AdminLoginModal';
import { DatabaseStatusBanner } from './components/layout/DatabaseStatusBanner';
import { PublicAdvertisementPopup } from './components/public/PublicAdvertisementPopup';
import { PageReloadAnimation } from './components/common/PageReloadAnimation';

import { HomePage } from './pages/HomePage';
import { ProductListingPage } from './pages/ProductListingPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { WishlistPage } from './pages/WishlistPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { AccountPage } from './pages/AccountPage';
import { ContactSupportPage } from './pages/ContactSupportPage';
import { AdminDashboard } from './pages/AdminDashboard';

function AppShell() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      const currentAuth = store.getState().auth;
      const currentToken = currentAuth.token;
      const storedUser = currentAuth.user;

      if (isAdmin) {
        store.dispatch(setSessionChecking(true));
        try {
          const res = await apiRequest('/auth/admin/me');
          if (!active) return;
          if (res.success && res.user) {
            store.dispatch(hydrateUser({ user: res.user }));
          } else if (
            res.status === 401 ||
            (res.status === 403 && storedUser?.role !== 'customer')
          ) {
            store.dispatch(logout());
          }
        } finally {
          if (active) store.dispatch(setSessionChecking(false));
        }
        return;
      }

      if (!currentToken) {
        store.dispatch(setSessionChecking(false));
        return;
      }

      store.dispatch(setSessionChecking(true));
      try {
        const res = await apiRequest('/auth/me');
        if (!active) return;
        if (res.success && res.user) {
          store.dispatch(hydrateUser({ user: res.user }));
        } else if (res.status === 401 || res.status === 403) {
          store.dispatch(logout());
        }
      } finally {
        if (active) store.dispatch(setSessionChecking(false));
      }
    };

    verifySession();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[#f4f7fc] font-sans text-slate-900 selection:bg-blue-600 selection:text-white antialiased">
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
        </Routes>
        <ToastContainer />
        <AuthModal />
        <AdminLoginModal />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
      <DatabaseStatusBanner />
      <Navbar />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ProductListingPage />} />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/order-success" element={<OrderSuccessPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/contact" element={<ContactSupportPage />} />
        </Routes>
      </main>

      <Footer />

      {/* Global UI Overlays */}
      <PageReloadAnimation />
      <PublicAdvertisementPopup />
      <ToastContainer />
      <AuthModal />
      <AdminLoginModal />
    </div>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </Provider>
  );
}
