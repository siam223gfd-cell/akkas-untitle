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

interface BkashTokenCache {
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
}

let cachedToken: BkashTokenCache | null = null;

export class BkashPaymentProvider {
  private baseUrl: string;
  private appKey: string;
  private appSecret: string;
  private username: string;
  private password: string;

  constructor() {
    this.baseUrl = config.payments.bkash.baseUrl;
    this.appKey = config.payments.bkash.appKey;
    this.appSecret = config.payments.bkash.appSecret;
    this.username = config.payments.bkash.username;
    this.password = config.payments.bkash.password;
  }

  public getStatus(): ProviderConfigurationStatus {
    const missing: string[] = [];
    if (!this.appKey) missing.push('BKASH_APP_KEY');
    if (!this.appSecret) missing.push('BKASH_APP_SECRET');
    if (!this.username) missing.push('BKASH_USERNAME');
    if (!this.password) missing.push('BKASH_PASSWORD');

    const isSandbox = this.baseUrl.includes('sandbox');

    return {
      provider: 'BKASH',
      name: 'bKash Merchant Payment Gateway',
      isConfigured: missing.length === 0,
      environment: isSandbox ? 'sandbox' : 'live',
      supportedMethods: ['bkash'],
      missingCredentials: missing,
    };
  }

  private async getAuthToken(): Promise<string> {
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt > now + 60000) {
      return cachedToken.idToken;
    }

    if (!this.appKey || !this.appSecret || !this.username || !this.password) {
      throw new Error(
        'bKash payment gateway credentials are not configured in environment variables. ' +
        'Missing: BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, or BKASH_PASSWORD.'
      );
    }

    try {
      const grantUrl = `${this.baseUrl}/token/grant`;
      const res = await fetch(grantUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          username: this.username,
          password: this.password,
        },
        body: JSON.stringify({
          app_key: this.appKey,
          app_secret: this.appSecret,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok || data.statusCode !== '0000' || !data.id_token) {
        throw new Error(
          data.statusMessage ||
            `Failed to grant bKash auth token (Status: ${data.statusCode || res.status})`
        );
      }

      const expiresInSec = Number(data.expiresIn) || 3600;
      cachedToken = {
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        expiresAt: now + expiresInSec * 1000,
      };

      return data.id_token;
    } catch (err: any) {
      console.error('[bKash Token Grant Error]:', err.message);
      throw err;
    }
  }

  public async initiatePayment(
    req: PaymentInitiateRequest
  ): Promise<PaymentInitiateResponse> {
    const status = this.getStatus();
    const isSandbox = status.environment === 'sandbox';

    if (!status.isConfigured) {
      return {
        success: false,
        paymentProvider: 'BKASH',
        isSandbox,
        requiresRedirect: false,
        merchantTransactionReference: req.orderNumber,
        error:
          'bKash Merchant Gateway is awaiting authorized merchant credentials. ' +
          `Missing: ${status.missingCredentials.join(', ')}. Please configure them in environment variables.`,
      };
    }

    try {
      const idToken = await this.getAuthToken();
      const createUrl = `${this.baseUrl}/create`;

      const payload = {
        mode: '0011',
        payerReference: req.customerPhone,
        callbackURL: req.callbackUrl,
        amount: req.amount.toFixed(2),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: req.orderNumber,
      };

      const res = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'X-APP-Key': this.appKey,
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as any;

      if (!res.ok || data.statusCode !== '0000' || !data.bkashURL) {
        return {
          success: false,
          paymentProvider: 'BKASH',
          isSandbox,
          requiresRedirect: false,
          merchantTransactionReference: req.orderNumber,
          error: data.statusMessage || `bKash payment session creation failed (${data.statusCode || res.status})`,
          rawResponse: data,
        };
      }

      return {
        success: true,
        gatewayUrl: data.bkashURL,
        gatewaySessionId: data.paymentID,
        merchantTransactionReference: req.orderNumber,
        paymentProvider: 'BKASH',
        isSandbox,
        requiresRedirect: true,
        message: 'bKash payment session created successfully.',
        rawResponse: {
          paymentID: data.paymentID,
          createTime: data.createTime,
          orgLogo: data.orgLogo,
          orgName: data.orgName,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        paymentProvider: 'BKASH',
        isSandbox,
        requiresRedirect: false,
        merchantTransactionReference: req.orderNumber,
        error: err.message || 'Network exception while connecting to bKash gateway.',
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
        failureReason: 'bKash credentials not configured on backend.',
      };
    }

    const paymentID = req.gatewaySessionId;
    if (!paymentID) {
      return {
        success: false,
        verified: false,
        paymentStatus: 'failed',
        verificationTimestamp: new Date(),
        failureReason: 'Missing bKash paymentID required for execution.',
      };
    }

    try {
      const idToken = await this.getAuthToken();
      const executeUrl = `${this.baseUrl}/execute`;

      const res = await fetch(executeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'X-APP-Key': this.appKey,
        },
        body: JSON.stringify({ paymentID }),
      });

      const data = (await res.json()) as any;

      // Handle cases where payment might have already executed or needs query fallback
      if (data.statusCode === '0000' && data.transactionStatus === 'Completed') {
        const verifiedAmount = parseFloat(data.amount);
        return {
          success: true,
          verified: true,
          paymentStatus: 'paid',
          gatewayTransactionId: data.trxID,
          verifiedAmount: Number.isNaN(verifiedAmount) ? req.amount : verifiedAmount,
          currency: data.currency || 'BDT',
          verificationTimestamp: new Date(),
          rawResponse: {
            trxID: data.trxID,
            paymentID: data.paymentID,
            transactionStatus: data.transactionStatus,
            customerMsisdn: data.customerMsisdn,
            paymentExecuteTime: data.paymentExecuteTime,
          },
          message: 'bKash payment successfully executed and verified server-to-server.',
        };
      }

      // If execute returned an error or status other than Completed, query payment
      const queryResult = await this.queryPayment(paymentID);
      if (queryResult.verified) {
        return queryResult;
      }

      return {
        success: false,
        verified: false,
        paymentStatus: 'failed',
        verificationTimestamp: new Date(),
        failureReason: data.statusMessage || `bKash payment execution failed (${data.statusCode})`,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        verified: false,
        paymentStatus: 'failed',
        verificationTimestamp: new Date(),
        failureReason: err.message || 'Exception during bKash verification.',
      };
    }
  }

  public async queryPayment(paymentID: string): Promise<PaymentVerifyResponse> {
    try {
      const idToken = await this.getAuthToken();
      const queryUrl = `${this.baseUrl}/payment/search/${paymentID}`;

      const res = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'X-APP-Key': this.appKey,
        },
      });

      const data = (await res.json()) as any;
      if (res.ok && data.statusCode === '0000' && data.transactionStatus === 'Completed') {
        return {
          success: true,
          verified: true,
          paymentStatus: 'paid',
          gatewayTransactionId: data.trxID,
          verifiedAmount: parseFloat(data.amount),
          currency: data.currency || 'BDT',
          verificationTimestamp: new Date(),
          rawResponse: data,
          message: 'bKash payment verified via status query.',
        };
      }

      return {
        success: false,
        verified: false,
        paymentStatus: data.transactionStatus === 'Initiated' ? 'pending' : 'failed',
        verificationTimestamp: new Date(),
        failureReason: data.statusMessage || 'Payment not completed according to bKash record.',
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        verified: false,
        paymentStatus: 'failed',
        verificationTimestamp: new Date(),
        failureReason: err.message,
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
        error: 'bKash credentials not configured for refund.',
      };
    }

    try {
      const idToken = await this.getAuthToken();
      const refundUrl = `${this.baseUrl}/payment/refund`;

      const payload = {
        paymentID: req.merchantTransactionReference,
        amount: req.amount.toFixed(2),
        trxID: req.gatewayTransactionId,
        sku: 'STORE_REFUND',
        reason: req.reason || 'Customer requested refund via merchant console',
      };

      const res = await fetch(refundUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'X-APP-Key': this.appKey,
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as any;
      if (res.ok && data.statusCode === '0000') {
        return {
          success: true,
          refundTrxId: data.refundTrxID,
          refundAmount: req.amount,
          refundedAt: new Date(),
          message: 'bKash refund executed successfully through official API.',
          rawResponse: data,
        };
      }

      return {
        success: false,
        refundAmount: 0,
        refundedAt: new Date(),
        error: data.statusMessage || `bKash refund rejected (${data.statusCode})`,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        refundAmount: 0,
        refundedAt: new Date(),
        error: err.message || 'Failed to communicate refund request to bKash.',
      };
    }
  }
}

export const bkashProvider = new BkashPaymentProvider();
