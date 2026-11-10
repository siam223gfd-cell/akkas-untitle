import mongoose, { Document, Schema } from 'mongoose';

export type AdStatus = 'draft' | 'published' | 'archived';
export type AdDeviceTargeting = 'all' | 'desktop_only' | 'mobile_only' | 'tablet_only';
export type AdDismissalPolicy = 'until_reload' | 'session' | 'duration' | 'until_expiration';

export interface IAdvertisementCTA {
  enabled: boolean;
  label: string;
  url: string;
  target: '_self' | '_blank';
  variant: 'primary' | 'secondary' | 'outline' | 'dark' | 'light';
  bgColor?: string;
  textColor?: string;
}

export interface IAdvertisementCloseButton {
  enabled: boolean;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  appearance: 'minimal' | 'circle' | 'pill' | 'dark' | 'light';
  dismissalPolicy: AdDismissalPolicy;
  dismissalDurationHours: number; // e.g. 24
}

export interface IAdvertisement extends Document {
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
  cta: IAdvertisementCTA;
  closeButton: IAdvertisementCloseButton;
  placements: string[];
  deviceTargeting: AdDeviceTargeting;
  priority: number;
  status: AdStatus;
  startDate?: Date;
  endDate?: Date;
  impressions: number;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
}

const AdCTASchema = new Schema<IAdvertisementCTA>(
  {
    enabled: { type: Boolean, default: true },
    label: { type: String, default: 'Shop Now' },
    url: { type: String, default: '/shop' },
    target: { type: String, enum: ['_self', '_blank'], default: '_self' },
    variant: {
      type: String,
      enum: ['primary', 'secondary', 'outline', 'dark', 'light'],
      default: 'primary',
    },
    bgColor: { type: String, default: '#2563eb' },
    textColor: { type: String, default: '#ffffff' },
  },
  { _id: false }
);

const AdCloseButtonSchema = new Schema<IAdvertisementCloseButton>(
  {
    enabled: { type: Boolean, default: true },
    position: {
      type: String,
      enum: ['top-right', 'top-left', 'bottom-right', 'bottom-left'],
      default: 'top-right',
    },
    appearance: {
      type: String,
      enum: ['minimal', 'circle', 'pill', 'dark', 'light'],
      default: 'circle',
    },
    dismissalPolicy: {
      type: String,
      enum: ['until_reload', 'session', 'duration', 'until_expiration'],
      default: 'session',
    },
    dismissalDurationHours: { type: Number, default: 24 },
  },
  { _id: false }
);

const AdvertisementSchema = new Schema<IAdvertisement>(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '' },
    description: { type: String, default: '' },
    promoBadge: { type: String, default: '' },
    mainImage: { type: String, required: true },
    secondaryImage: { type: String, default: '' },
    backgroundImage: { type: String, default: '' },
    backgroundColor: { type: String, default: '#020617' },
    gradient: { type: String, default: 'from-blue-900/60 to-slate-950' },
    textColor: { type: String, default: '#ffffff' },
    cta: { type: AdCTASchema, default: () => ({}) },
    closeButton: { type: AdCloseButtonSchema, default: () => ({}) },
    placements: {
      type: [String],
      default: ['between_sections'],
      index: true,
    },
    deviceTargeting: {
      type: String,
      enum: ['all', 'desktop_only', 'mobile_only', 'tablet_only'],
      default: 'all',
    },
    priority: { type: Number, default: 1, index: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const AdvertisementModel =
  mongoose.models.Advertisement ||
  mongoose.model<IAdvertisement>('Advertisement', AdvertisementSchema);
