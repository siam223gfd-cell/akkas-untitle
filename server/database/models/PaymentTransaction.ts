import mongoose, { Document, Schema } from 'mongoose';

export type PaymentMethodType = 'cod' | 'bkash' | 'nagad' | 'card';
export type PaymentProviderType = 'BKASH' | 'NAGAD' | 'SSLCOMMERZ' | 'COD';
export type PaymentTransactionStatus =
  | 'initiated'
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refunded';

export interface ICodCollection {
  collectedAt: Date;
  collectedBy: string;
  collectedAmount: number;
  receiptNumber?: string;
  notes?: string;
}

export interface IRefundRecord {
  refundTrxId?: string;
  refundAmount: number;
  refundedAt: Date;
  refundedBy: string;
  refundReason?: string;
  gatewayResponse?: any;
}

export interface IPaymentTransaction extends Document {
  transactionNumber: string;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: PaymentMethodType;
  paymentProvider: PaymentProviderType;
  gatewayTransactionId?: string;
  gatewaySessionId?: string;
  merchantTransactionReference: string;
  amount: number;
  currency: string;
  paymentStatus: PaymentTransactionStatus;
  gatewayResponse?: any;
  initiationTimestamp: Date;
  verificationTimestamp?: Date;
  completedTimestamp?: Date;
  failureReason?: string;
  codCollection?: ICodCollection;
  refundDetails?: IRefundRecord;
  ipAddress?: string;
  userAgent?: string;
  environment: 'sandbox' | 'live';
  createdAt: Date;
  updatedAt: Date;
}

const CodCollectionSchema = new Schema<ICodCollection>(
  {
    collectedAt: { type: Date, default: Date.now },
    collectedBy: { type: String, required: true },
    collectedAmount: { type: Number, required: true },
    receiptNumber: { type: String },
    notes: { type: String },
  },
  { _id: false }
);

const RefundRecordSchema = new Schema<IRefundRecord>(
  {
    refundTrxId: { type: String },
    refundAmount: { type: Number, required: true },
    refundedAt: { type: Date, default: Date.now },
    refundedBy: { type: String, required: true },
    refundReason: { type: String },
    gatewayResponse: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    transactionNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerEmail: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'bkash', 'nagad', 'card'],
      required: true,
      index: true,
    },
    paymentProvider: {
      type: String,
      enum: ['BKASH', 'NAGAD', 'SSLCOMMERZ', 'COD'],
      required: true,
      index: true,
    },
    gatewayTransactionId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    gatewaySessionId: {
      type: String,
      trim: true,
      sparse: true,
    },
    merchantTransactionReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'BDT',
      uppercase: true,
    },
    paymentStatus: {
      type: String,
      enum: [
        'initiated',
        'pending',
        'processing',
        'paid',
        'failed',
        'cancelled',
        'expired',
        'refunded',
      ],
      default: 'initiated',
      index: true,
    },
    gatewayResponse: {
      type: Schema.Types.Mixed,
    },
    initiationTimestamp: {
      type: Date,
      default: Date.now,
    },
    verificationTimestamp: {
      type: Date,
    },
    completedTimestamp: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
    codCollection: {
      type: CodCollectionSchema,
    },
    refundDetails: {
      type: RefundRecordSchema,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    environment: {
      type: String,
      enum: ['sandbox', 'live'],
      default: 'sandbox',
    },
  },
  { timestamps: true }
);

PaymentTransactionSchema.index({ createdAt: -1 });
PaymentTransactionSchema.index({ paymentProvider: 1, paymentStatus: 1 });
PaymentTransactionSchema.index({ orderNumber: 1, paymentStatus: 1 });

export const PaymentTransactionModel =
  mongoose.models.PaymentTransaction ||
  mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);
