import crypto from 'crypto';
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

export class NagadPaymentProvider {
  private baseUrl: string;
  private merchantId: string;
  private merchantNumber: string;
  private privateKey: string;
  private publicKey: string;

  constructor() {
    this.baseUrl = config.payments.nagad.baseUrl;
    this.merchantId = config.payments.nagad.merchantId;
    this.merchantNumber = config.payments.nagad.merchantNumber;
    this.privateKey = config.payments.nagad.privateKey;
    this.publicKey = config.payments.nagad.publicKey;
  }

  public getStatus(): ProviderConfigurationStatus {
    const missing: string[] = [];
    if (!this.merchantId) missing.push('NAGAD_MERCHANT_ID');
    if (!this.privateKey) missing.push('NAGAD_PRIVATE_KEY');
    if (!this.publicKey) missing.push('NAGAD_PUBLIC_KEY');

    const isSandbox = this.baseUrl.includes('sandbox');

    return {
      provider: 'NAGAD',
      name: 'Nagad Merchant Payment Gateway',
      isConfigured: missing.length === 0,
      environment: isSandbox ? 'sandbox' : 'live',
      supportedMethods: ['nagad'],
      missingCredentials: missing,
    };
  }

  private generateDateTime(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  private signData(data: string): string {
    try {
      const signer = crypto.createSign('SHA256');
      signer.update(data);
      signer.end();
      return signer.sign(this.privateKey, 'base64');
    } catch (err: any) {
      console.error('[Nagad Sign Error]:', err.message);
      return '';
    }
  }

  private encryptWithPublicKey(data: string): string {
    try {
      const buffer = Buffer.from(data, 'utf8');
      const encrypted = crypto.publicEncrypt(
        {
          key: this.publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        buffer
      );
      return encrypted.toString('base64');
    } catch (err: any) {
      console.error('[Nagad Encrypt Error]:', err.message);
      return '';
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
        paymentProvider: 'NAGAD',
        isSandbox,
        requiresRedirect: false,
        merchantTransactionReference: req.orderNumber,
        error:
          'Nagad Merchant Gateway requires authorized credentials. ' +
          `Missing: ${status.missingCredentials.join(', ')}. Please configure them in environment variables.`,
      };
    }

    try {
      const dateTime = this.generateDateTime();
      const sensitiveDataObj = {
        merchantId: this.merchantId,
        datetime: dateTime,
        orderId: req.orderNumber,
        challenge: crypto.randomBytes(16).toString('hex'),
      };

      const sensitiveDataString = JSON.stringify(sensitiveDataObj);
      const encryptedSensitiveData = this.encryptWithPublicKey(sensitiveDataString);
      const signature = this.signData(sensitiveDataString);

      const initUrl = `${this.baseUrl}/check-out/initialize/${this.merchantId}/${req.orderNumber}`;

      const res = await fetch(initUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KM-Api-Version': 'v-0.2.0',
          'X-KM-IP-V4': req.ipAddress || '127.0.0.1',
          'X-KM-Client-Type': 'PC_WEB',
        },
        body: JSON.stringify({
          dateTime,
          sensitiveData: encryptedSensitiveData,
          signature,
        }),
      });

      const data = (await res.json()) as any;

      if (!res.ok || (data.status && data.status !== 'Success' && data.status !== '000')) {
        return {
          success: false,
          paymentProvider: 'NAGAD',
          isSandbox,
          requiresRedirect: false,
          merchantTransactionReference: req.orderNumber,
          error: data.message || `Nagad session initialization failed (${res.status})`,
          rawResponse: data,
        };
      }

      // Nagad complete URL or checkout payment reference
      const paymentRefId = data.paymentReferenceId || data.paymentRefId;
      const callBackUrlWithRef = `${this.baseUrl}/check-out/complete/${paymentRefId}`;

      return {
        success: true,
        gatewayUrl: data.callBackUrl || callBackUrlWithRef,
        gatewaySessionId: paymentRefId,
        merchantTransactionReference: req.orderNumber,
        paymentProvider: 'NAGAD',
        isSandbox,
        requiresRedirect: true,
        message: 'Nagad payment session initialized successfully.',
        rawResponse: {
          paymentReferenceId: paymentRefId,
          dateTime: data.dateTime,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        paymentProvider: 'NAGAD',
        isSandbox,
        requiresRedirect: false,
        merchantTransactionReference: req.orderNumber,
        error: err.message || 'Network exception while connecting to Nagad gateway.',
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
        failureReason: 'Nagad credentials not configured on backend.',
      };
    }

    const paymentRefId = req.paymentRefId || req.gatewaySessionId || req.gatewayTransactionId;
    if (!paymentRefId) {
      return {
        success: false,
        verified: false,
        paymentStatus: 'failed',
        verificationTimestamp: new Date(),
        failureReason: 'Missing Nagad paymentReferenceId required for verification.',
      };
    }

    try {
      const verifyUrl = `${this.baseUrl}/verify/payment/${paymentRefId}`;
      const res = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-KM-Api-Version': 'v-0.2.0',
          'X-KM-IP-V4': '127.0.0.1',
          'X-KM-Client-Type': 'PC_WEB',
        },
      });

      const data = (await res.json()) as any;

      const isSuccessful =
        data.status === 'Success' ||
        data.statusCode === '000' ||
        data.status === 'Paid';

      if (res.ok && isSuccessful) {
        const verifiedAmount = parseFloat(data.amount);
        return {
          success: true,
          verified: true,
          paymentStatus: 'paid',
          gatewayTransactionId: data.issuerPaymentRefNo || paymentRefId,
          verifiedAmount: Number.isNaN(verifiedAmount) ? req.amount : verifiedAmount,
          currency: 'BDT',
          verificationTimestamp: new Date(),
          rawResponse: data,
          message: 'Nagad payment successfully verified server-to-server.',
        };
      }

      return {
        success: false,
        verified: false,
        paymentStatus: data.status === 'Failed' ? 'failed' : data.status === 'Aborted' ? 'cancelled' : 'failed',
        verificationTimestamp: new Date(),
        failureReason: data.message || `Nagad verification returned status "${data.status || 'Unknown'}"`,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        verified: false,
        paymentStatus: 'failed',
        verificationTimestamp: new Date(),
        failureReason: err.message || 'Exception during Nagad payment verification.',
      };
    }
  }

  public async processRefund(req: PaymentRefundRequest): Promise<PaymentRefundResponse> {
    return {
      success: false,
      refundAmount: 0,
      refundedAt: new Date(),
      error:
        'Automated refunds are restricted by Nagad Merchant API policies. ' +
        'Merchant administrators must process refunds through the Nagad Merchant Portal.',
    };
  }
}

export const nagadProvider = new NagadPaymentProvider();
