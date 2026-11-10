import mongoose, { Document, Schema } from 'mongoose';

export interface IHeroSlide {
  id: string;
  badge: string;
  title: string;
  highlight: string;
  subtitle: string;
  discountBadge: string;
  ctaText: string;
  ctaLink: string;
  desktopImage: string;
  mobileImage?: string;
  order: number;
  isEnabled: boolean;
}

export interface IBannerItem {
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

export interface IStoreSettings {
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
  socialLinks: {
    facebook: string;
    youtube: string;
    instagram: string;
    twitter: string;
    linkedin: string;
  };
  notifications?: {
    newOrderEmail: boolean;
    lowStockAlert: boolean;
  };
}

export interface IPromoPlacement {
  isEnabled: boolean;
  title: string;
  subtitle?: string;
  imageUrl: string;
  destinationUrl: string;
  ctaText: string;
  startDate?: Date;
  endDate?: Date;
}

export interface IHomepageSection {
  id: string;
  title: string;
  isEnabled: boolean;
  order: number;
}

export interface ICMSConfig extends Document {
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  heroBadge: string;
  heroCtaText: string;
  heroCtaLink: string;
  announcementText: string;
  announcementPhone: string;
  announcementEmail: string;
  heroSlides: IHeroSlide[];
  banners: IBannerItem[];
  settings: IStoreSettings;
  sections: IHomepageSection[];
  promotionalPlacement: IPromoPlacement;
  updatedAt: Date;
}

const HeroSlideSchema = new Schema<IHeroSlide>({
  id: { type: String, required: true },
  badge: { type: String, default: 'Limited Time Offer ⚡' },
  title: { type: String, default: 'Upgrade Your Life with' },
  highlight: { type: String, default: 'Aurelia' },
  subtitle: { type: String, default: 'Premium Quality. Unbeatable Prices. Fast delivery across Bangladesh.' },
  discountBadge: { type: String, default: 'Up to 50% OFF' },
  ctaText: { type: String, default: 'Shop Now' },
  ctaLink: { type: String, default: '/shop' },
  desktopImage: { type: String, default: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=600&q=80' },
  mobileImage: { type: String, default: '' },
  order: { type: Number, default: 1 },
  isEnabled: { type: Boolean, default: true },
});

const BannerItemSchema = new Schema<IBannerItem>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  tagline: { type: String, default: '' },
  discountTag: { type: String, default: '' },
  ctaText: { type: String, default: 'Shop Now' },
  ctaLink: { type: String, default: '/shop' },
  imageUrl: { type: String, default: '' },
  position: { type: String, enum: ['split_left', 'split_right', 'mid_banner', 'sponsored'], default: 'split_left' },
  isEnabled: { type: Boolean, default: true },
  order: { type: Number, default: 1 },
});

const StoreSettingsSchema = new Schema<IStoreSettings>({
  storeName: { type: String, default: 'Aurelia' },
  tagline: { type: String, default: 'Shop Smart, Live Better' },
  supportPhone: { type: String, default: '+880 1234 567890' },
  supportEmail: { type: String, default: 'support@aurelia.com' },
  currencySymbol: { type: String, default: '৳' },
  currencyCode: { type: String, default: 'BDT' },
  freeShippingThreshold: { type: Number, default: 1000 },
  shippingDhaka: { type: Number, default: 60 },
  shippingOutsideDhaka: { type: Number, default: 120 },
  taxRate: { type: Number, default: 0 },
  paymentMethods: {
    cod: { type: Boolean, default: true },
    bkash: { type: Boolean, default: true },
    nagad: { type: Boolean, default: true },
    card: { type: Boolean, default: true },
  },
  socialLinks: {
    facebook: { type: String, default: 'https://facebook.com' },
    youtube: { type: String, default: 'https://youtube.com' },
    instagram: { type: String, default: 'https://instagram.com' },
    twitter: { type: String, default: 'https://twitter.com' },
    linkedin: { type: String, default: 'https://linkedin.com' },
  },
  notifications: {
    newOrderEmail: { type: Boolean, default: true },
    lowStockAlert: { type: Boolean, default: true },
  },
});

const PromoPlacementSchema = new Schema<IPromoPlacement>({
  isEnabled: { type: Boolean, default: false },
  title: { type: String, default: 'Exclusive Seasonal Deals' },
  subtitle: { type: String, default: 'Save up to 40% on smart lifestyle gadgets this week only' },
  imageUrl: { type: String, default: '' },
  destinationUrl: { type: String, default: '/shop' },
  ctaText: { type: String, default: 'Shop Exclusive Offer' },
  startDate: { type: Date },
  endDate: { type: Date },
});

const HomepageSectionSchema = new Schema<IHomepageSection>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  isEnabled: { type: Boolean, default: true },
  order: { type: Number, required: true },
});

const CMSConfigSchema = new Schema<ICMSConfig>(
  {
    heroTitle: { type: String, default: 'Upgrade Your Life with' },
    heroHighlight: { type: String, default: 'Aurelia' },
    heroSubtitle: { type: String, default: 'Premium Quality. Unbeatable Prices. Fast delivery across Bangladesh.' },
    heroBadge: { type: String, default: 'Limited Time Offer ⚡' },
    heroCtaText: { type: String, default: 'Shop Now' },
    heroCtaLink: { type: String, default: '/shop' },
    announcementText: { type: String, default: 'Free Shipping on Orders Over ৳1,000 · 30 Days Easy Return · Secure Payment' },
    announcementPhone: { type: String, default: '+880 1234 567890' },
    announcementEmail: { type: String, default: 'support@aurelia.com' },
    heroSlides: [HeroSlideSchema],
    banners: [BannerItemSchema],
    settings: { type: StoreSettingsSchema, default: () => ({}) },
    sections: [HomepageSectionSchema],
    promotionalPlacement: { type: PromoPlacementSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const CMSConfigModel = mongoose.models.CMSConfig || mongoose.model<ICMSConfig>('CMSConfig', CMSConfigSchema);
