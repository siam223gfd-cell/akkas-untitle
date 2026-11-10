import { config } from '../../config/env';
import {
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentVerifyRequest,
  PaymentVerifyResponse,
  PaymentRefundRequest,
  PaymentRefundResponse,
  ProviderConfigurationStatus,
} from './types';

export class SslcommerzPaymentProvider {
  private baseUrl: string;
  private storeId: string;
  private storePassword: string;
  private isSandbox: boolean;

  constructor() {
    this.baseUrl = config.payments.sslcommerz.baseUrl;
    this.storeId = config.payments.sslcommerz.storeId;
    this.storePassword = config.payments.sslcommerz.storePassword;
    this.isSandbox = config.payments.sslcommerz.isSandbox;
  }

  public getStatus(): ProviderConfigurationStatus {
    const missing: string[] = [];
    if (!this.storeId) missing.push('SSLCOMMERZ_STORE_ID');
    if (!this.storePassword) missing.push('SSLCOMMERZ_STORE_PASSWORD');

    return {
      provider: 'SSLCOMMERZ',
      name: 'SSLCOMMERZ Card Gateway (Visa, Mastercard, Amex, Nexus)',
      isConfigured: missing.length === 0,
      environment: this.isSandbox ? 'sandbox' : 'live',
      supportedMethods: ['card'],
      missingCredentials: missing,
    };
  }

  public async initiatePayment(
    req: PaymentInitiateRequest
  ): Promise<PaymentInitiateResponse> {
    const status = this.getStatus();

    if (!status.isConfigured) {
      return {
        success: false,
        paymentProvider: 'SSLCOMMERZ',
        isSandbox: this.isSandbox,
        requiresRedirect: false,
        merchantTransactionReference: req.orderNumber,
        error:
          'SSLCOMMERZ Card Gateway requires valid merchant credentials. ' +
          `Missing: ${status.missingCredentials.join(', ')}. Please configure them in environment variables.`,
      };
    }

    try {
      const initUrl = `${this.baseUrl}/gwprocess/v4/api.php`;

      const params = new URLSearchParams();
      params.append('store_id', this.storeId);
      params.append('store_passwd', this.storePassword);
      params.append('total_amount', req.amount.toFixed(2));
      params.append('currency', req.currency || 'BDT');
      params.append('tran_id', req.orderNumber);
      params.append('success_url', req.callbackUrl);
      params.append('fail_url', req.callbackUrl);
      params.append('cancel_url', req.callbackUrl);
      params.append('ipn_url', req.callbackUrl);

      // Customer parameters
      params.append('cus_name', req.customerName || 'Customer');
      params.append('cus_email', req.customerEmail || 'customer@example.com');
      params.append('cus_add1', req.shippingAddress.streetAddress || 'Dhaka');
      params.append('cus_city', req.shippingAddress.district || 'Dhaka');
      params.append('cus_state', req.shippingAddress.division || 'Dhaka');
      params.append('cus_postcode', req.shippingAddress.postalCode || '1200');
      params.append('cus_country', 'Bangladesh');
      params.append('cus_phone', req.customerPhone);

      // Shipment details
      params.append('shipping_method', 'COURIER');
      params.append('num_of_item', String(req.items.length || 1));
      params.append('product_name', req.items.map((i) => i.name).slice(0, 3).join(', ') || req.orderNumber);
      params.append('product_category', 'General');
      params.append('product_profile', 'general');

      const res = await fetch(initUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = (await res.json()) as any;

      if (!res.ok || data.status !== 'SUCCESS' || !data.GatewayPageURL) {
        return {
          success: false,
          paymentProvider: 'SSLCOMMERZ',
          isSandbox: this.isSandbox,
          requiresRedirect: false,
          merchantTransactionReference: req.orderNumber,
          error: data.failedreason || `SSLCOMMERZ session init failed: ${res.statusText}`,
          rawResponse: data,
        };
      }

      return {
        success: true,
        gatewayUrl: data.GatewayPageURL,
        gatewaySessionId: data.sessionkey,
        merchantTransactionReference: req.orderNumber,
        paymentProvider: 'SSLCOMMERZ',
        isSandbox: this.isSandbox,
        requiresRedirect: true,
        message: 'SSLCOMMERZ card payment session created.',
        rawResponse: {
          sessionkey: data.sessionkey,
          GatewayPageURL: data.GatewayPageURL,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        paymentProvider: 'SSLCOMMERZ',
        isSandbox: this.isSandbox,
        requiresRedirect: false,
        merchantTransactionReference: req.orderNumber,
        error: err.message || 'Network exception while connecting to SSLCOMMERZ gateway.',
      };
    }
  }

  public async verifyPayment(
    req: PaymentVerifyRequest
  ): Promise<PaymentVerifyResponse> {
    const status = this.getStatus();
    if (!status.isConfigured) {
      return {
        success: false,
        verified: false,
        paymentStatus: 'failed',
        verificationTimestamp: new Date(),
        failureReason: 'SSLCOMMERZ credentials not configured on backend.',
      };
    }

    const valId = req.valId || req.gatewayTransactionId;
    if (!valId) {
      return {
        success: false,
        verified: false,
        paymentStatus: 'failed',
        verificationTimestamp: new Date(),
        failureReason: 'Missing val_id required for SSLCOMMERZ server-to-server validation.',
      };
    }

    try {
      const validatorUrl = `${this.baseUrl}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(
        valId
      )}&store_id=${encodeURIComponent(this.storeId)}&store_passwd=${encodeURIComponent(
        this.storePassword
      )}&format=json`;

      const res = await fetch(validatorUrl, {
        method: 'GET',
      });

      const data = (await res.json()) as any;

      const isValidStatus = data.status === 'VALID' || data.status === 'VALIDATED';

      if (res.ok && isValidStatus) {
        const verifiedAmount = parseFloat(data.amount);
        return {
          success: true,
          verified: true,
          paymentStatus: 'paid',
          gatewayTransactionId: data.bank_tran_id || valId,
          verifiedAmount: Number.isNaN(verifiedAmount) ? req.amount : verifiedAmount,
          currency: data.currency || 'BDT',
          verificationTimestamp: new Date(),
          rawResponse: {
            status: data.status,
            tran_id: data.tran_id,
            val_id: data.val_id,
            bank_tran_id: data.bank_tran_id,
            card_type: data.card_type,
            card_brand: data.card_brand,
            card_issuer: data.card_issuer,
            tran_date: data.tran_date,
          },
          message: 'Card payment verified via SSLCOMMERZ authoritative validator API.',
        };
      }

      return {
        success: false,
        verified: false,
        paymentStatus: data.status === 'FAILED' ? 'failed' : data.status === 'CANCELLED' ? 'cancelled' : 'failed',
        verificationTimestamp: new Date(),
        failureReason: data.error || `SSLCOMMERZ validation returned status "${data.status || 'INVALID'}"`,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        verified: false,
        paymentStatus: 'failed',
        verificationTimestamp: new Date(),
        failureReason: err.message || 'Exception during SSLCOMMERZ verification.',
      };
    }
  }

  public async processRefund(req: PaymentRefundRequest): Promise<PaymentRefundResponse> {
    const status = this.getStatus();
    if (!status.isConfigured) {
      return {
        success: false,
        refundAmount: 0,
        refundedAt: new Date(),
        error: 'SSLCOMMERZ credentials not configured for refund.',
      };
    }

    try {
      const refundUrl = `${this.baseUrl}/validator/api/merchantTransIDvalidationAPI.php?refund_amount=${req.amount.toFixed(
        2
      )}&refund_remarks=${encodeURIComponent(req.reason || 'Customer refund')}&bank_tran_id=${encodeURIComponent(
        req.gatewayTransactionId
      )}&store_id=${encodeURIComponent(this.storeId)}&store_passwd=${encodeURIComponent(
        this.storePassword
      )}&format=json`;

      const res = await fetch(refundUrl, { method: 'GET' });
      const data = (await res.json()) as any;

      if (res.ok && (data.status === 'success' || data.status === 'SUCCESS')) {
        return {
          success: true,
          refundTrxId: data.refund_ref_id || data.trans_id,
          refundAmount: req.amount,
          refundedAt: new Date(),
          message: 'SSLCOMMERZ refund request accepted.',
          rawResponse: data,
        };
      }

      return {
        success: false,
        refundAmount: 0,
        refundedAt: new Date(),
        error: data.error_reason || `SSLCOMMERZ refund rejected (${data.status})`,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        refundAmount: 0,
        refundedAt: new Date(),
        error: err.message,
      };
    }
  }
}

export const sslcommerzProvider = new SslcommerzPaymentProvider();
