import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { openAdminLoginModal } from '../../features/ui/uiSlice';
import { ShoppingCart, Facebook, Youtube, Instagram, Twitter, Linkedin, ShieldCheck, ArrowUp } from 'lucide-react';

export const Footer: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const isStaff =
      isAuthenticated &&
      user &&
      ['super_admin', 'admin', 'order_manager', 'inventory_manager', 'catalog_manager', 'customer_support', 'finance'].includes(user.role);

    if (isStaff) {
      navigate('/admin');
    } else {
      dispatch(openAdminLoginModal());
    }
  };

  return (
    <footer className="bg-[#001938] text-white pt-14 pb-8 border-t border-blue-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-blue-900/60">
          {/* Column 1: Brand Info */}
          <div className="lg:col-span-1 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-black text-white leading-none block">Aurelia</span>
                <span className="text-[9px] font-semibold text-blue-300 tracking-wider uppercase block">
                  Shop Smart, Live Better
                </span>
              </div>
            </Link>
            <p className="text-xs text-blue-200/80 leading-relaxed">
              Your trusted online store for premium products at unbeatable prices across Bangladesh.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-2 pt-2">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-blue-900/80 hover:bg-blue-600 flex items-center justify-center transition-colors text-white"
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-blue-900/80 hover:bg-rose-600 flex items-center justify-center transition-colors text-white"
                aria-label="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-blue-900/80 hover:bg-pink-600 flex items-center justify-center transition-colors text-white"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-blue-900/80 hover:bg-blue-500 flex items-center justify-center transition-colors text-white"
                aria-label="X / Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-blue-900/80 hover:bg-blue-700 flex items-center justify-center transition-colors text-white"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Quick Links</h4>
            <ul className="space-y-2.5 text-xs text-blue-200/80">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/shop" className="hover:text-white transition-colors">
                  Shop
                </Link>
              </li>
              <li>
                <Link to="/shop" className="hover:text-white transition-colors">
                  Categories
                </Link>
              </li>
              <li>
                <Link to="/shop?sort=newest" className="hover:text-white transition-colors">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Service */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Customer Service</h4>
            <ul className="space-y-2.5 text-xs text-blue-200/80">
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Return Policy
                </Link>
              </li>
              <li>
                <Link to="/account?tab=orders" className="hover:text-white transition-colors">
                  Track Order
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Our Policies */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Our Policies</h4>
            <ul className="space-y-2.5 text-xs text-blue-200/80">
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Sitemap
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: Payment Methods & Security */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Payment Methods</h4>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="bg-white text-blue-900 font-black text-[11px] px-2.5 py-1 rounded tracking-wider shadow-xs">
                VISA
              </span>
              <span className="bg-white text-rose-600 font-black text-[11px] px-2.5 py-1 rounded tracking-wider shadow-xs">
                Mastercard
              </span>
              <span className="bg-[#e2136e] text-white font-bold text-[11px] px-2.5 py-1 rounded shadow-xs">
                bKash
              </span>
              <span className="bg-[#f7941d] text-white font-bold text-[11px] px-2.5 py-1 rounded shadow-xs">
                Nagad
              </span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-950/60 border border-blue-900">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Security Guaranteed</p>
                <p className="text-[10px] text-blue-300">Your Security, Our Priority</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-blue-300/80 text-center sm:text-left">
          <p>© 2026 Aurelia. All rights reserved. | Made with ❤️ in Bangladesh</p>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3.5 sm:gap-6 text-[11px]">
            <Link to="/contact" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/contact" className="hover:text-white transition-colors">
              Terms & Conditions
            </Link>
            <Link to="/contact" className="hover:text-white transition-colors">
              Sitemap
            </Link>
            <button
              onClick={handleAdminClick}
              className="text-blue-300 hover:text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Admin Portal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Scroll to Top button */}
      <button
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 z-30 w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl flex items-center justify-center transition-all hover:scale-110 focus:outline-hidden"
        aria-label="Scroll to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </footer>
  );
};
