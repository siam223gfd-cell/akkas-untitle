import { PaymentMethodType, PaymentProviderType, PaymentTransactionStatus } from '../../database/models/PaymentTransaction';

export interface PaymentInitiateRequest {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethodType;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    streetAddress: string;
    upazila: string;
    district: string;
    division: string;
    postalCode?: string;
  };
  items: {
    name: string;
    quantity: number;
    price: number;
    sku?: string;
  }[];
  callbackUrl: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PaymentInitiateResponse {
  success: boolean;
  gatewayUrl?: string;
  gatewaySessionId?: string;
  merchantTransactionReference: string;
  paymentProvider: PaymentProviderType;
  isSandbox: boolean;
  message?: string;
  requiresRedirect: boolean;
  error?: string;
  rawResponse?: any;
}

export interface PaymentVerifyRequest {
  merchantTransactionReference: string;
  gatewayTransactionId?: string;
  gatewaySessionId?: string;
  amount?: number;
  valId?: string;
  paymentRefId?: string;
  statusCandidate?: string;
  rawPayload?: any;
}

export interface PaymentVerifyResponse {
  success: boolean;
  verified: boolean;
  paymentStatus: PaymentTransactionStatus;
  gatewayTransactionId?: string;
  verifiedAmount?: number;
  currency?: string;
  verificationTimestamp: Date;
  rawResponse?: any;
  failureReason?: string;
  message?: string;
}

export interface PaymentRefundRequest {
  merchantTransactionReference: string;
  gatewayTransactionId: string;
  amount: number;
  reason?: string;
  staffUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface PaymentRefundResponse {
  success: boolean;
  refundTrxId?: string;
  refundAmount: number;
  refundedAt: Date;
  message?: string;
  rawResponse?: any;
  error?: string;
}

export interface ProviderConfigurationStatus {
  provider: PaymentProviderType;
  name: string;
  isConfigured: boolean;
  environment: 'sandbox' | 'live';
  supportedMethods: PaymentMethodType[];
  missingCredentials: string[];
}
