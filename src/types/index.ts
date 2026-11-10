export type AttributeInputType = 'color_swatch' | 'size_selector' | 'select' | 'radio' | 'text' | 'number' | 'boolean';

export interface AttributeValue {
  id?: string;
  label: string;
  value: string;
  hexColor?: string;
  description?: string;
}

export interface Attribute {
  _id: string;
  name: string;
  slug: string;
  type: AttributeInputType;
  values: AttributeValue[];
  categories: string[];
  isRequired: boolean;
  isFilterable: boolean;
  isVisibleOnPDP: boolean;
  displayOrder: number;
  createdAt?: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  price?: number;
  originalPrice?: number;
  stock: number;
  options: Record<string, string>;
  image?: string;
  barcode?: string;
  isActive?: boolean;
}

export interface ProductHighlight {
  label: string;
  value: string;
  icon?: string;
}

export interface ProductSpecification {
  label: string;
  value: string;
  group?: string;
}

export interface ProductFAQ {
  question: string;
  answer: string;
}

export interface Product {
  _id: string;
  name: string;
  subtitle?: string;
  slug: string;
  sku: string;
  brand: string;
  category: string;
  subcategory?: string;
  description: string;
  features: string[];
  attributes: Record<string, string>;
  highlights?: ProductHighlight[];
  specificationsTable?: ProductSpecification[];
  faqs?: ProductFAQ[];
  basePrice: number;
  salePrice: number;
  stock: number;
  reservedStock?: number;
  images: string[];
  variants: ProductVariant[];
  rating: number;
  reviewCount: number;
  isTrending?: boolean;
  isTopSelling?: boolean;
  isNewArrival?: boolean;
  isBestRated?: boolean;
  isFeatured?: boolean;
  badge?: string;
  status: 'active' | 'draft' | 'archived';
  warranty?: string;
  deliveryEstimate?: string;
  banglaKeywords?: string[];
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  itemCount: number;
  liveCount?: number;
  description?: string;
  order: number;
  featured: boolean;
}

export interface Brand {
  _id: string;
  name: string;
  slug: string;
  logo: string;
  description?: string;
  isActive: boolean;
  itemCount: number;
  featured?: boolean;
}

export interface UserAddress {
  _id?: string;
  id?: string;
  isDefault?: boolean;
  label?: string;
  recipientName: string;
  phone: string;
  division: string;
  divisionId?: string | number;
  district: string;
  districtId?: string | number;
  upazila: string;
  upazilaId?: string | number;
  unionOrWard?: string;
  unionId?: string | number;
  locality?: string;
  house?: string;
  road?: string;
  postalCode?: string;
  streetAddress: string;
  deliveryInstructions?: string;
}

export interface User {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: 'customer' | 'super_admin' | 'admin' | 'order_manager' | 'inventory_manager' | 'catalog_manager' | 'customer_support' | 'finance';
  phone?: string;
  avatar?: string;
  isActive?: boolean;
  providers?: ('email' | 'google' | 'facebook' | string)[];
  googleId?: string;
  facebookId?: string;
  emailVerified?: boolean;
  lastLoginAt?: string;
  addresses: UserAddress[];
  orderCount?: number;
  totalSpent?: number;
  status?: string;
  createdAt?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  subtitle?: string;
  sku: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  image: string;
  options?: Record<string, string>;
  stock: number;
  selected?: boolean;
}

export interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image?: string;
  options?: Record<string, string>;
}

export interface OrderPaymentDetails {
  transactionId?: string;
  provider?: string;
  reference?: string;
  payerPhone?: string;
  verifiedAmount?: number;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  idempotencyKey?: string;
  receiptToken?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  shippingAddress: UserAddress;
  pricing: {
    subtotal: number;
    discount: number;
    shippingFee: number;
    tax: number;
    total: number;
    couponCode?: string;
  };
  paymentMethod: 'cod' | 'card' | 'bkash' | 'nagad';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentDetails?: OrderPaymentDetails;
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  timeline: {
    status: string;
    timestamp: string;
    note?: string;
    actor?: string;
  }[];
  staffNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderStatsResponse {
  totalOrders: number;
  totalRevenue: number;
  paidRevenue: number;
  orderStatuses: Record<Order['orderStatus'], number>;
  paymentStatuses: Record<Order['paymentStatus'], number>;
}

export interface PaymentTransaction {
  _id: string;
  transactionNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: 'cod' | 'bkash' | 'nagad' | 'card';
  paymentProvider: 'BKASH' | 'NAGAD' | 'SSLCOMMERZ' | 'COD';
  gatewayTransactionId?: string;
  gatewaySessionId?: string;
  merchantTransactionReference: string;
  amount: number;
  currency: string;
  paymentStatus: 'initiated' | 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'expired' | 'refunded';
  gatewayResponse?: any;
  initiationTimestamp: string;
  verificationTimestamp?: string;
  completedTimestamp?: string;
  failureReason?: string;
  codCollection?: {
    collectedAt: string;
    collectedBy: string;
    collectedAmount: number;
    receiptNumber?: string;
    notes?: string;
  };
  refundDetails?: {
    refundTrxId?: string;
    refundAmount: number;
    refundedAt: string;
    refundedBy: string;
    refundReason?: string;
  };
  environment: 'sandbox' | 'live';
  createdAt: string;
  updatedAt?: string;
}

export interface ProviderConfigurationStatus {
  provider: 'BKASH' | 'NAGAD' | 'SSLCOMMERZ' | 'COD';
  name: string;
  isConfigured: boolean;
  environment: 'sandbox' | 'live';
  supportedMethods: ('cod' | 'bkash' | 'nagad' | 'card')[];
  missingCredentials: string[];
}

export interface AnalyticsResponse {
  range?: 'today' | '7d' | '30d' | 'month' | 'year';
  stats: {
    totalVisitors: number;
    totalVisitorsTrend: string;
    totalOrders: number;
    totalOrdersTrend: string;
    totalRevenue: number;
    totalRevenueTrend: string;
    totalReviews: number;
    totalReviewsTrend: string;
    activeUsers: number;
    activeUsersTrend: string;
    totalProducts: number;
    totalCustomers: number;
    allTimeOrders?: number;
    allTimeRevenue?: number;
    allTimeReviews?: number;
  };
  salesOverview: { date: string; orders: number; revenue: number }[];
  topProducts: { name: string; price: number; image: string; sold: number; revenue?: number }[];
  orderStatusOverview: {
    totalOrders: number;
    percentages: Record<string, number>;
    counts: Record<string, number>;
  };
  revenueGrowth: { month: string; revenue: number; isPeak?: boolean }[];
  recentActivities: { type: string; title: string; time: string; icon: string; color: string }[];
  userAnalytics?: {
    totalCustomers: number;
    googleUsers: number;
    facebookUsers: number;
    emailUsers: number;
    providerDistribution: { google: number; facebook: number; email: number };
  };
}

export interface Review {
  _id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  isVerifiedPurchase: boolean;
  status: 'pending' | 'approved' | 'rejected';
  helpfulCount?: number;
  photos?: string[];
  createdAt: string;
}

export interface HeroSlide {
  _id?: string;
  id?: string;
  title: string; // Internal identifier for admin
  image?: string; // Alias for desktopImage
  desktopImage: string;
  mobileImage?: string;
  link?: string; // Alias for destinationUrl
  destinationUrl?: string; // Optional clickable link
  target?: '_self' | '_blank';
  order: number;
  displayOrder?: number; // Alias for order
  isActive: boolean;
  isEnabled?: boolean; // backwards compatibility
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  // Legacy optional fields for backward compatibility
  badge?: string;
  highlight?: string;
  subtitle?: string;
  discountBadge?: string;
  ctaText?: string;
  ctaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
}

export type BannerStatus = 'draft' | 'published' | 'archived';
export type BackgroundType = 'solid' | 'image' | 'gradient' | 'combined';
export type GradientType = 'linear' | 'radial' | 'conic';
export type LayerType =
  | 'heading'
  | 'subheading'
  | 'description'
  | 'badge'
  | 'price'
  | 'discount'
  | 'image'
  | 'decorative'
  | 'custom_text';

export interface BannerLayer {
  id: string;
  type: LayerType;
  text?: string;
  imageUrl?: string;
  position: {
    x: number;
    y: number;
    mode: 'flow' | 'absolute';
  };
  fontFamily?: string;
  fontSize: number;
  fontWeight: string;
  textColor: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign: 'left' | 'center' | 'right';
  opacity: number;
  rotation?: number;
  zIndex: number;
  padding?: { x: number; y: number };
  margin?: { x: number; y: number };
  isVisible: boolean;
  deviceVisibility?: {
    desktop: boolean;
    tablet: boolean;
    mobile: boolean;
  };
}

export interface BannerButton {
  id: string;
  label: string;
  url: string;
  target: '_self' | '_blank';
  variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'custom';
  bgColor: string;
  textColor: string;
  gradient?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius: number;
  paddingX: number;
  paddingY: number;
  fontSize: number;
  fontWeight: string;
  hoverBgColor?: string;
  hoverTextColor?: string;
  hoverAnimation: 'none' | 'scale' | 'translate' | 'glow';
  icon?: string;
  iconPosition: 'left' | 'right';
  isVisible: boolean;
}

export interface BannerBackground {
  type: BackgroundType;
  color: string;
  opacity: number;
  imageUrl?: string;
  tabletImageUrl?: string;
  mobileImageUrl?: string;
  imagePosition?: string;
  imageSize?: 'cover' | 'contain' | 'auto';
  imageRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
  overlayColor?: string;
  overlayOpacity?: number;
  gradient?: {
    type: GradientType;
    angle: number;
    direction?: string;
    stops: { color: string; stop: number }[];
    opacity?: number;
  };
}

export interface BannerLayout {
  width: string;
  height: string;
  minHeight: string;
  maxHeight?: string;
  aspectRatio?: string;
  padding: { top: number; right: number; bottom: number; left: number };
  margin: { top: number; right: number; bottom: number; left: number };
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  boxShadow: string;
  overflow: 'hidden' | 'visible';
  contentAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'center' | 'bottom';
  containerWidth: string;
}

export interface BannerResponsive {
  tablet?: {
    minHeight?: string;
    paddingScale?: number;
    fontScale?: number;
  };
  mobile?: {
    minHeight?: string;
    paddingScale?: number;
    fontScale?: number;
    stackButtons?: boolean;
  };
}

export interface DynamicBanner {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  status: BannerStatus;
  placements: string[];
  priority: number;
  startDate?: string;
  endDate?: string;
  background: BannerBackground;
  layout: BannerLayout;
  layers: BannerLayer[];
  buttons: BannerButton[];
  responsive: BannerResponsive;
  createdAt?: string;
  updatedAt?: string;
}

// Legacy BannerItem interface for backward compatibility with CMS
export interface BannerItem {
  _id?: string;
  id: string;
  title: string;
  subtitle: string;
  tagline?: string;
  discountTag?: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
  position: 'split_left' | 'split_right' | 'mid_banner' | 'sponsored';
  isEnabled: boolean;
  order: number;
}

export type AdStatus = 'draft' | 'published' | 'archived';
export type AdDeviceTargeting = 'all' | 'desktop_only' | 'mobile_only' | 'tablet_only';
export type AdDismissalPolicy = 'until_reload' | 'session' | 'duration' | 'until_expiration';

export interface AdvertisementCTA {
  enabled: boolean;
  label: string;
  url: string;
  target: '_self' | '_blank';
  variant: 'primary' | 'secondary' | 'outline' | 'dark' | 'light';
  bgColor?: string;
  textColor?: string;
}

export interface AdvertisementCloseButton {
  enabled: boolean;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  appearance: 'minimal' | 'circle' | 'pill' | 'dark' | 'light';
  dismissalPolicy: AdDismissalPolicy;
  dismissalDurationHours: number;
}

export interface Advertisement {
  _id?: string;
  id?: string;
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  promoBadge?: string;
  mainImage: string;
  secondaryImage?: string;
  backgroundImage?: string;
  backgroundColor: string;
  gradient?: string;
  textColor: string;
  cta: AdvertisementCTA;
  closeButton: AdvertisementCloseButton;
  placements: string[];
  deviceTargeting: AdDeviceTargeting;
  priority: number;
  status: AdStatus;
  startDate?: string;
  endDate?: string;
  impressions: number;
  clicks: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  supportPhone: string;
  supportEmail: string;
  currencySymbol: string;
  currencyCode: string;
  freeShippingThreshold: number;
  shippingDhaka: number;
  shippingOutsideDhaka: number;
  taxRate: number;
  paymentMethods: {
    cod: boolean;
    bkash: boolean;
    nagad: boolean;
    card: boolean;
  };
  notifications?: {
    newOrderEmail: boolean;
    lowStockAlert: boolean;
  };
  socialLinks?: {
    facebook: string;
    youtube: string;
    instagram: string;
    twitter: string;
    linkedin: string;
  };
}

export interface ContentPage {
  _id: string;
  slug: string;
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive: boolean;
  updatedAt?: string;
}

export interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  author: string;
  image: string;
  tags: string[];
  publishedAt: string;
  isActive: boolean;
  views?: number;
}

export interface AuditLog {
  _id: string;
  action: string;
  module: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  details: string;
  recordId?: string;
  metadata?: any;
  ipAddress?: string;
  timestamp: string;
}

export interface CMSConfig {
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  heroBadge: string;
  heroCtaText: string;
  heroCtaLink: string;
  announcementText: string;
  announcementPhone: string;
  announcementEmail: string;
  heroSlides?: HeroSlide[];
  banners?: BannerItem[];
  settings?: StoreSettings;
  sections: {
    id: string;
    title: string;
    isEnabled: boolean;
    order: number;
  }[];
  promotionalPlacement: {
    isEnabled: boolean;
    title: string;
    subtitle?: string;
    imageUrl: string;
    destinationUrl: string;
    ctaText: string;
  };
}

export interface NavigationItem {
  _id: string;
  label: string;
  url: string;
  icon?: string;
  type: 'link' | 'dropdown' | 'category' | 'page';
  parentId: string | null;
  displayOrder: number;
  isActive: boolean;
  openInNewTab: boolean;
  badge?: string;
  badgeColor?: string;
  description?: string;
  children?: NavigationItem[];
  childrenCount?: number;
  createdAt?: string;
  updatedAt?: string;
}
