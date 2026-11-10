import mongoose, { Document, Schema } from 'mongoose';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type PaymentMethod = 'cod' | 'card' | 'bkash' | 'nagad';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface IOrderItem {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image?: string;
  options?: Record<string, string>;
}

export interface IOrderShippingAddress {
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

export interface IOrderPricing {
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
  couponCode?: string;
}

export interface IOrderTimeline {
  status: OrderStatus;
  timestamp: Date;
  note?: string;
  actor?: string;
}

export interface IOrderPaymentDetails {
  transactionId?: string;
  provider?: string;
  reference?: string;
  payerPhone?: string;
  verifiedAmount?: number;
  verifiedAt?: Date;
  verifiedBy?: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  idempotencyKey?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: IOrderItem[];
  shippingAddress: IOrderShippingAddress;
  pricing: IOrderPricing;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentDetails?: IOrderPaymentDetails;
  orderStatus: OrderStatus;
  timeline: IOrderTimeline[];
  staffNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId: { type: String, required: true },
  variantId: { type: String },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  image: { type: String },
  options: { type: Map, of: String },
});

const OrderShippingAddressSchema = new Schema<IOrderShippingAddress>({
  recipientName: { type: String, required: true },
  phone: { type: String, required: true },
  division: { type: String, required: true },
  divisionId: { type: Schema.Types.Mixed },
  district: { type: String, required: true },
  districtId: { type: Schema.Types.Mixed },
  upazila: { type: String, required: true },
  upazilaId: { type: Schema.Types.Mixed },
  unionOrWard: { type: String, default: '' },
  unionId: { type: Schema.Types.Mixed },
  locality: { type: String, default: '' },
  house: { type: String, default: '' },
  road: { type: String, default: '' },
  postalCode: { type: String, default: '' },
  streetAddress: { type: String, required: true },
  deliveryInstructions: { type: String, default: '' },
});

const OrderPricingSchema = new Schema<IOrderPricing>({
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  shippingFee: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, required: true },
  couponCode: { type: String },
});

const OrderTimelineSchema = new Schema<IOrderTimeline>({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  note: { type: String },
  actor: { type: String, default: 'system' },
});

const OrderPaymentDetailsSchema = new Schema<IOrderPaymentDetails>(
  {
    transactionId: { type: String, trim: true },
    provider: { type: String, trim: true },
    reference: { type: String, trim: true },
    payerPhone: { type: String, trim: true },
    verifiedAmount: { type: Number },
    verifiedAt: { type: Date },
    verifiedBy: { type: String, trim: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, uppercase: true },
    idempotencyKey: { type: String, unique: true, sparse: true, trim: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, required: true },
    items: [OrderItemSchema],
    shippingAddress: OrderShippingAddressSchema,
    pricing: OrderPricingSchema,
    paymentMethod: { type: String, enum: ['cod', 'card', 'bkash', 'nagad'], default: 'cod' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    paymentDetails: { type: OrderPaymentDetailsSchema, default: undefined },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'pending',
    },
    timeline: [OrderTimelineSchema],
    staffNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ paymentMethod: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ customerPhone: 1 });
OrderSchema.index({ 'paymentDetails.transactionId': 1 }, { unique: true, sparse: true });

export const OrderModel = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
