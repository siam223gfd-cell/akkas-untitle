# NOVARA COMMERCE
### Premium Full-Stack Single-Vendor Retail E-Commerce Platform for Bangladesh

Built to the highest engineering standards with **React 19**, **TypeScript**, **Tailwind CSS**, **Redux Toolkit**, **Node.js & Express**, and **MongoDB Atlas**.

---

## 🚀 Key Implemented Architectural Modules

1. **Homepage Visual Fidelity**:
   - Faithful reproduction of the attached reference image (`Aurelia_Blue_E-Commerce_Homepage_fbd5e98b.png`).
   - Deep navy announcement bar with Bangladesh contact numbers (`+880 1234 567890`), free shipping threshold, return and security badges.
   - White main brand header with Aurelia / Novara logo, centered search input with debounced autocomplete suggestions, My Account popup menu, Wishlist count, and Cart badge.
   - Royal blue category navigation bar with "All Categories ▾", Home, Shop, Categories, New Arrivals, Best Sellers, Special Offers, and Admin Console.
   - Hero carousel with glowing blue tech gradient, "⚡ Limited Time Offer", "Upgrade Your Life with Aurelia", "Up to 50% OFF" badge, and flagship gadget showcase (AirPods Pro, iPhone 16 Pro, Watch Series 10).
   - 4 White Trust Badges (Free Shipping over ৳1,000, 100% Secure Payment, 24/7 Customer Support, 30 Days Easy Return).
   - 12 "Shop by Category" cards with dynamic live SKU counts and 3D product previews.
   - Split Promotional Banners (Big Summer Sale 70% & Next-Gen Tech).
   - "Trending Products" row with Top Selling, New Arrivals, Best Rated tabs, authentic BDT pricing, and "Add to Cart" actions.
   - "Live Smarter with Aurelia" mid-page brand banner.
   - "What Our Customers Say" authentic customer testimonials (Rafik Hasan, Tania Akter, Md. Fahim) with Verified Buyer badges.
   - Newsletter subscription bar and footer with Bangladesh payment methods (VISA, Mastercard, bKash, Nagad).

2. **Database & Persistence**:
   - **MongoDB Atlas** integration via Mongoose (`server/database/connection.ts` and models).
   - Automatic database seeder for initial catalog, categories, demo users, coupons, and CMS settings.
   - Operational connection logging and real-time health reporting endpoint at `/api/health`.

3. **Authentication & Required Customer Accounts**:
   - Unauthenticated visitors can browse and maintain a guest cart, but **must register or sign in before placing an order** (Rule 6).
   - Reusable custom backdrop modal (`AuthModal.tsx`) for Sign In, Registration, Password Reset, and instant demo test accounts.
   - Account navigation popup menu in the header (Rule 6).

4. **Redux Toolkit Cart**:
   - Cart badge displays **unique cart lines count** (Rule 16).
   - Line items with variant options, quantity steppers, coupon discount calculations, and persistent localStorage sync.

5. **Server-Side Checkout & Bangladesh Address Hierarchy**:
   - Dependent dropdown selection: **Division → District → Upazila/Thana → Union/Ward**.
   - Saved address auto-selection and new destination forms.
   - Payment methods: Cash on Delivery (COD), bKash, Nagad, Credit/Debit Card.
   - Server-side price and atomic stock verification.

6. **Custom Toast Notification System**:
   - Thin progress bar moving smoothly from right to left over 4 seconds default duration (Rule 8).
   - Hover-to-pause countdown, manual dismissal, and distinct success/error/warning/info states.

7. **Full Operational Admin Suite**:
   - Overview KPI metrics (Gross sales, net sales, order counts, pending fulfillment, low-stock alerts).
   - Catalog management with create/edit in custom modal overlays (Rule 7).
   - Fulfillment state machine (Pending → Confirmed → Processing → Packed → Shipped → Delivered; Cancelled with stock restoration).
   - Review moderation queue (Approve/Reject with reasons).
   - First-party promotional ad placement configuration (Rule 10).
   - MongoDB Atlas connectivity diagnostics.

---

## 🛠️ Environment Variables Configuration

Copy `.env.example` to `.env` and configure:

```bash
NODE_ENV="development"
PORT=3000
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/novara_commerce?retryWrites=true&w=majority"
JWT_SECRET="your_secure_jwt_secret"
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
RESEND_API_KEY="re_placeholder"
EMAIL_FROM="orders@novaracommerce.com"
```

---

## 🧪 Verification & Development

```bash
# Start fullstack dev server (Express API + Vite SPA)
npm run dev

# Run TypeScript verification
npm run lint

# Build production bundle
npm run build

# Start production server
npm start
```
