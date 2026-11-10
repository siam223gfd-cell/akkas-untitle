import {
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentVerifyRequest,
  PaymentVerifyResponse,
  ProviderConfigurationStatus,
} from './types';

export class CodPaymentProvider {
  public getStatus(): ProviderConfigurationStatus {
    return {
      provider: 'COD',
      name: 'Cash on Delivery (Physical Cash Collection Upon Delivery)',
      isConfigured: true,
      environment: 'live',
      supportedMethods: ['cod'],
      missingCredentials: [],
    };
  }

  public initiatePayment(req: PaymentInitiateRequest): PaymentInitiateResponse {
    return {
      success: true,
      paymentProvider: 'COD',
      isSandbox: false,
      requiresRedirect: false,
      merchantTransactionReference: req.orderNumber,
      message:
        'Cash on Delivery order created. Payment collection pending upon package delivery by courier.',
    };
  }

  public verifyPayment(_req: PaymentVerifyRequest): PaymentVerifyResponse {
    return {
      success: false,
      verified: false,
      paymentStatus: 'pending',
      verificationTimestamp: new Date(),
      failureReason:
        'Cash on Delivery cannot be verified online. Cash collection must be confirmed upon delivery by authorized personnel.',
    };
  }
}

export const codProvider = new CodPaymentProvider();
