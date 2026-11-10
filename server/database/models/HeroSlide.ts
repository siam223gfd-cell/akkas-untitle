import mongoose, { Document, Schema } from 'mongoose';

export interface IHeroSlideItem extends Document {
  title: string;
  subtitle?: string;
  badge?: string;
  image?: string;
  desktopImage: string;
  mobileImage?: string;
  link?: string;
  destinationUrl?: string;
  ctaText?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  target: '_self' | '_blank';
  order: number;
  displayOrder: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HeroSlideItemSchema = new Schema<IHeroSlideItem>(
  {
    title: { type: String, default: '', trim: true },
    subtitle: { type: String, default: '', trim: true },
    badge: { type: String, default: '', trim: true },
    image: { type: String, default: '' },
    desktopImage: { type: String, required: true },
    mobileImage: { type: String, default: '' },
    link: { type: String, default: '', trim: true },
    destinationUrl: { type: String, default: '', trim: true },
    ctaText: { type: String, default: '', trim: true },
    secondaryCtaText: { type: String, default: '', trim: true },
    secondaryCtaUrl: { type: String, default: '', trim: true },
    target: { type: String, enum: ['_self', '_blank'], default: '_self' },
    order: { type: Number, default: 1, index: true },
    displayOrder: { type: Number, default: 1, index: true },
    isActive: { type: Boolean, default: true, index: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { timestamps: true }
);

// Bidirectional synchronization between legacy desktopImage/destinationUrl/order and new image/link/displayOrder
HeroSlideItemSchema.pre<IHeroSlideItem>('validate', function () {
  if (this.image && !this.desktopImage) {
    this.desktopImage = this.image;
  } else if (this.desktopImage && !this.image) {
    this.image = this.desktopImage;
  }

  if (this.link && !this.destinationUrl) {
    this.destinationUrl = this.link;
  } else if (this.destinationUrl && !this.link) {
    this.link = this.destinationUrl;
  }

  if (this.displayOrder !== undefined && this.order === undefined) {
    this.order = this.displayOrder;
  } else if (this.order !== undefined && this.displayOrder === undefined) {
    this.displayOrder = this.order;
  } else if (this.order !== undefined) {
    this.displayOrder = this.order;
  }
});

export const HeroSlideModel =
  mongoose.models.HeroSlide ||
  mongoose.model<IHeroSlideItem>('HeroSlide', HeroSlideItemSchema);

