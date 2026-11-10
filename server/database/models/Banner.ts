import mongoose, { Document, Schema } from 'mongoose';

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

export interface IBannerLayer {
  id: string;
  type: LayerType;
  text?: string;
  imageUrl?: string;
  position: {
    x: number; // percentage or pixels
    y: number;
    mode: 'flow' | 'absolute';
  };
  fontFamily?: string;
  fontSize: number; // px
  fontWeight: string;
  textColor: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign: 'left' | 'center' | 'right';
  opacity: number; // 0 - 100
  rotation?: number; // deg
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

export interface IBannerButton {
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

export interface IBannerBackground {
  type: BackgroundType;
  color: string;
  opacity: number; // 0 - 100
  imageUrl?: string;
  tabletImageUrl?: string;
  mobileImageUrl?: string;
  imagePosition?: string;
  imageSize?: 'cover' | 'contain' | 'auto';
  imageRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
  overlayColor?: string;
  overlayOpacity?: number; // 0 - 100
  gradient?: {
    type: GradientType;
    angle: number; // 0 - 360
    direction?: string;
    stops: { color: string; stop: number }[];
    opacity?: number;
  };
}

export interface IBannerLayout {
  width: string; // e.g. '100%', '1200px'
  height: string; // e.g. 'auto', '420px'
  minHeight: string; // e.g. '300px'
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
  containerWidth: string; // e.g. '100%', '80%', '650px'
}

export interface IBannerResponsive {
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

export interface IBanner extends Document {
  name: string;
  slug: string;
  status: BannerStatus;
  placements: string[];
  priority: number;
  startDate?: Date;
  endDate?: Date;
  background: IBannerBackground;
  layout: IBannerLayout;
  layers: IBannerLayer[];
  buttons: IBannerButton[];
  responsive: IBannerResponsive;
  createdAt: Date;
  updatedAt: Date;
}

const BannerLayerSchema = new Schema<IBannerLayer>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'heading',
        'subheading',
        'description',
        'badge',
        'price',
        'discount',
        'image',
        'decorative',
        'custom_text',
      ],
      default: 'heading',
    },
    text: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      mode: { type: String, enum: ['flow', 'absolute'], default: 'flow' },
    },
    fontFamily: { type: String, default: 'Plus Jakarta Sans' },
    fontSize: { type: Number, default: 28 },
    fontWeight: { type: String, default: '700' },
    textColor: { type: String, default: '#ffffff' },
    lineHeight: { type: String, default: '1.2' },
    letterSpacing: { type: String, default: 'normal' },
    textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    opacity: { type: Number, default: 100 },
    rotation: { type: Number, default: 0 },
    zIndex: { type: Number, default: 1 },
    padding: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    margin: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    isVisible: { type: Boolean, default: true },
    deviceVisibility: {
      desktop: { type: Boolean, default: true },
      tablet: { type: Boolean, default: true },
      mobile: { type: Boolean, default: true },
    },
  },
  { _id: false }
);

const BannerButtonSchema = new Schema<IBannerButton>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, default: 'Shop Now' },
    url: { type: String, required: true, default: '/shop' },
    target: { type: String, enum: ['_self', '_blank'], default: '_self' },
    variant: {
      type: String,
      enum: ['primary', 'secondary', 'outline', 'ghost', 'custom'],
      default: 'primary',
    },
    bgColor: { type: String, default: '#2563eb' },
    textColor: { type: String, default: '#ffffff' },
    gradient: { type: String, default: '' },
    borderColor: { type: String, default: 'transparent' },
    borderWidth: { type: Number, default: 0 },
    borderRadius: { type: Number, default: 9999 },
    paddingX: { type: Number, default: 24 },
    paddingY: { type: Number, default: 12 },
    fontSize: { type: Number, default: 14 },
    fontWeight: { type: String, default: '700' },
    hoverBgColor: { type: String, default: '#1d4ed8' },
    hoverTextColor: { type: String, default: '#ffffff' },
    hoverAnimation: {
      type: String,
      enum: ['none', 'scale', 'translate', 'glow'],
      default: 'scale',
    },
    icon: { type: String, default: 'ArrowRight' },
    iconPosition: { type: String, enum: ['left', 'right'], default: 'right' },
    isVisible: { type: Boolean, default: true },
  },
  { _id: false }
);

const BannerSchema = new Schema<IBanner>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    placements: {
      type: [String],
      default: ['mid_banner'],
      index: true,
    },
    priority: { type: Number, default: 1, index: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    background: {
      type: {
        type: String,
        enum: ['solid', 'image', 'gradient', 'combined'],
        default: 'gradient',
      },
      color: { type: String, default: '#0f172a' },
      opacity: { type: Number, default: 100 },
      imageUrl: { type: String, default: '' },
      tabletImageUrl: { type: String, default: '' },
      mobileImageUrl: { type: String, default: '' },
      imagePosition: { type: String, default: 'center' },
      imageSize: { type: String, default: 'cover' },
      imageRepeat: { type: String, default: 'no-repeat' },
      overlayColor: { type: String, default: '#000000' },
      overlayOpacity: { type: Number, default: 40 },
      gradient: {
        type: { type: String, default: 'linear' },
        angle: { type: Number, default: 90 },
        direction: { type: String, default: 'to right' },
        stops: [
          {
            color: { type: String, default: '#001736' },
            stop: { type: Number, default: 0 },
          },
          {
            color: { type: String, default: '#002f6c' },
            stop: { type: Number, default: 100 },
          },
        ],
        opacity: { type: Number, default: 100 },
      },
    },
    layout: {
      width: { type: String, default: '100%' },
      height: { type: String, default: 'auto' },
      minHeight: { type: String, default: '320px' },
      maxHeight: { type: String, default: '' },
      aspectRatio: { type: String, default: '' },
      padding: {
        top: { type: Number, default: 36 },
        right: { type: Number, default: 36 },
        bottom: { type: Number, default: 36 },
        left: { type: Number, default: 36 },
      },
      margin: {
        top: { type: Number, default: 0 },
        right: { type: Number, default: 0 },
        bottom: { type: Number, default: 0 },
        left: { type: Number, default: 0 },
      },
      borderRadius: { type: Number, default: 24 },
      borderWidth: { type: Number, default: 1 },
      borderColor: { type: String, default: 'rgba(255, 255, 255, 0.1)' },
      boxShadow: { type: String, default: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
      overflow: { type: String, enum: ['hidden', 'visible'], default: 'hidden' },
      contentAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
      verticalAlign: { type: String, enum: ['top', 'center', 'bottom'], default: 'center' },
      containerWidth: { type: String, default: '600px' },
    },
    layers: [BannerLayerSchema],
    buttons: [BannerButtonSchema],
    responsive: {
      tablet: {
        minHeight: { type: String, default: '280px' },
        paddingScale: { type: Number, default: 0.8 },
        fontScale: { type: Number, default: 0.9 },
      },
      mobile: {
        minHeight: { type: String, default: '240px' },
        paddingScale: { type: Number, default: 0.6 },
        fontScale: { type: Number, default: 0.8 },
        stackButtons: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true }
);

export const BannerModel = mongoose.models.Banner || mongoose.model<IBanner>('Banner', BannerSchema);
