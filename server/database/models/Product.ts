import mongoose, { Document, Schema } from 'mongoose';

export interface IProductVariant {
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

export interface IProductHighlight {
  label: string;
  value: string;
  icon?: string;
}

export interface IProductSpecification {
  label: string;
  value: string;
  group?: string;
}

export interface IProductFAQ {
  question: string;
  answer: string;
}

export interface IProduct extends Document {
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
  highlights: IProductHighlight[];
  specificationsTable: IProductSpecification[];
  faqs: IProductFAQ[];
  basePrice: number;
  salePrice: number;
  stock: number;
  reservedStock: number;
  images: string[];
  variants: IProductVariant[];
  rating: number;
  reviewCount: number;
  isTrending: boolean;
  isTopSelling: boolean;
  isNewArrival: boolean;
  isBestRated: boolean;
  isFeatured: boolean;
  badge?: string; // 'Hot' | '-20%' | 'Best Seller' | '-15%'
  status: 'active' | 'draft' | 'archived';
  warranty?: string;
  deliveryEstimate?: string;
  banglaKeywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>({
  id: { type: String, required: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number },
  originalPrice: { type: Number },
  stock: { type: Number, default: 0 },
  options: { type: Map, of: String, default: {} },
  image: { type: String },
  barcode: { type: String },
  isActive: { type: Boolean, default: true },
});

const HighlightSchema = new Schema<IProductHighlight>(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
    icon: { type: String },
  },
  { _id: false }
);

const SpecificationSchema = new Schema<IProductSpecification>(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
    group: { type: String, default: 'General' },
  },
  { _id: false }
);

const FAQSchema = new Schema<IProductFAQ>(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '' },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    brand: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    subcategory: { type: String, default: '' },
    description: { type: String, required: true },
    features: [{ type: String }],
    attributes: { type: Map, of: String, default: {} },
    highlights: [HighlightSchema],
    specificationsTable: [SpecificationSchema],
    faqs: [FAQSchema],
    basePrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    reservedStock: { type: Number, default: 0 },
    images: [{ type: String }],
    variants: [ProductVariantSchema],
    rating: { type: Number, default: 5, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    isTrending: { type: Boolean, default: false },
    isTopSelling: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isBestRated: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    badge: { type: String },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active' },
    warranty: { type: String, default: '1 Year Official Brand Warranty' },
    deliveryEstimate: { type: String, default: '2-3 Business Days within Dhaka, 3-5 Days across Bangladesh' },
    banglaKeywords: [{ type: String }],
  },
  { timestamps: true }
);

ProductSchema.index({ name: 'text', description: 'text', brand: 'text', category: 'text' });
ProductSchema.index({ status: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ status: 1, salePrice: 1, _id: 1 });
ProductSchema.index({ status: 1, salePrice: -1, _id: -1 });
ProductSchema.index({ status: 1, rating: -1, reviewCount: -1, _id: -1 });
ProductSchema.index({ status: 1, reviewCount: -1, rating: -1, _id: -1 });
ProductSchema.index({ status: 1, category: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ status: 1, category: 1, salePrice: 1, _id: 1 });
ProductSchema.index({ status: 1, category: 1, salePrice: -1, _id: -1 });
ProductSchema.index({ status: 1, brand: 1, createdAt: -1, _id: -1 });
ProductSchema.index({ status: 1, brand: 1, salePrice: 1, _id: 1 });
ProductSchema.index({ status: 1, isTopSelling: 1, reviewCount: -1 });
ProductSchema.index({ status: 1, isNewArrival: 1, createdAt: -1 });
ProductSchema.index({ status: 1, isBestRated: 1, rating: -1 });
ProductSchema.index({ status: 1, isTrending: 1, createdAt: -1 });

export const ProductModel = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
