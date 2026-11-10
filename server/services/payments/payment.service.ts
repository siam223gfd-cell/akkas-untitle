import mongoose from 'mongoose';
import { OrderModel, IOrder } from '../../database/models/Order';
import {
  PaymentTransactionModel,
  IPaymentTransaction,
  PaymentMethodType,
  PaymentProviderType,
} from '../../database/models/PaymentTransaction';
import { bkashProvider } from './bkash.provider';
import { nagadProvider } from './nagad.provider';
import { sslcommerzProvider } from './sslcommerz.provider';
import { codProvider } from './cod.provider';
import {
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentVerifyRequest,
  PaymentVerifyResponse,
  PaymentRefundResponse,
  ProviderConfigurationStatus,
} from './types';
import { logAuditActivity } from '../../utils/auditLogger';
import { config } from '../../config/env';

export class PaymentService {
  /**
   * Determine authoritative provider for payment method
   */
  public getProviderForMethod(method: PaymentMethodType): PaymentProviderType {
    switch (method) {
      case 'bkash':
        return 'BKASH';
      case 'nagad':
        return 'NAGAD';
      case 'card':
        return 'SSLCOMMERZ';
      case 'cod':
      default:
        return 'COD';
    }
  }

  /**
   * Safe status report of all payment gateways
   */
  public getProviderStatuses(): ProviderConfigurationStatus[] {
    return [
      codProvider.getStatus(),
      bkashProvider.getStatus(),
      nagadProvider.getStatus(),
      sslcommerzProvider.getStatus(),
    ];
  }

  /**
   * Initiate payment for an existing order
   */
  public async initiatePayment(
    orderIdentifier: string,
    methodOverride?: PaymentMethodType,
    clientMeta?: { ip?: string; userAgent?: string; host?: string; protocol?: string }
  ): Promise<PaymentInitiateResponse> {
    const orderFilter = mongoose.Types.ObjectId.isValid(orderIdentifier)
      ? { _id: orderIdentifier }
      : { orderNumber: orderIdentifier.toUpperCase() };

    const order = (await OrderModel.findOne(orderFilter)) as IOrder | null;
    if (!order) {
      throw new Error(`Order "${orderIdentifier}" not found.`);
    }

    if (order.paymentStatus === 'paid') {
      throw new Error(`Order #${order.orderNumber} is already marked as PAID.`);
    }

    if (order.orderStatus === 'cancelled' || order.orderStatus === 'returned') {
      throw new Error(`Cannot initiate payment for a ${order.orderStatus} order.`);
    }

    const paymentMethod: PaymentMethodType = methodOverride || (order.paymentMethod as PaymentMethodType);
    const providerType = this.getProviderForMethod(paymentMethod);

    // If method changed, update order record
    if (order.paymentMethod !== paymentMethod) {
      order.paymentMethod = paymentMethod as any;
      await order.save();
    }

    // Determine host and protocol for callbacks
    const fallbackBase = `${clientMeta?.protocol || 'https'}://${clientMeta?.host || 'localhost:3000'}`;
    const configuredBase = config.appUrl || fallbackBase;
    const cleanAppBase = configuredBase.replace(/\/+$/, '');
    const callbackUrl = `${cleanAppBase}/api/payments/callback/${providerType.toLowerCase()}`;

    const initiateReq: PaymentInitiateRequest = {
      orderId: (order._id as any).toString(),
      orderNumber: order.orderNumber,
      amount: order.pricing.total,
      currency: 'BDT',
      paymentMethod,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddress: {
        streetAddress: order.shippingAddress.streetAddress,
        upazila: order.shippingAddress.upazila,
        district: order.shippingAddress.district,
        division: order.shippingAddress.division,
        postalCode: order.shippingAddress.postalCode,
      },
      items: order.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        sku: i.sku,
      })),
      callbackUrl,
      ipAddress: clientMeta?.ip,
      userAgent: clientMeta?.userAgent,
    };

    let result: PaymentInitiateResponse;
    switch (providerType) {
      case 'BKASH':
        result = await bkashProvider.initiatePayment(initiateReq);
        break;
      case 'NAGAD':
        result = await nagadProvider.initiatePayment(initiateReq);
        break;
      case 'SSLCOMMERZ':
        result = await sslcommerzProvider.initiatePayment(initiateReq);
        break;
      case 'COD':
      default:
        result = codProvider.initiatePayment(initiateReq);
        break;
    }

    // Generate internal tracking transaction number
    const transactionNumber = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    // Create or update PaymentTransaction record
    const existingTxn = await PaymentTransactionModel.findOne({
      orderId: order._id,
      paymentStatus: { $in: ['initiated', 'pending', 'processing'] },
    });

    if (existingTxn) {
      existingTxn.paymentMethod = paymentMethod;
      existingTxn.paymentProvider = providerType;
      existingTxn.amount = order.pricing.total;
      existingTxn.gatewaySessionId = result.gatewaySessionId || existingTxn.gatewaySessionId;
      existingTxn.gatewayResponse = result.rawResponse || existingTxn.gatewayResponse;
      existingTxn.failureReason = result.error || undefined;
      existingTxn.paymentStatus = result.success ? (providerType === 'COD' ? 'pending' : 'initiated') : 'failed';
      await existingTxn.save();
    } else {
      await PaymentTransactionModel.create({
        transactionNumber,
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        paymentMethod,
        paymentProvider: providerType,
        gatewaySessionId: result.gatewaySessionId,
        merchantTransactionReference: order.orderNumber,
        amount: order.pricing.total,
        currency: 'BDT',
        paymentStatus: result.success ? (providerType === 'COD' ? 'pending' : 'initiated') : 'failed',
        gatewayResponse: result.rawResponse,
        failureReason: result.error,
        ipAddress: clientMeta?.ip,
        userAgent: clientMeta?.userAgent,
        environment: result.isSandbox ? 'sandbox' : 'live',
      });
    }

    return result;
  }

  /**
   * Handle returning customer from payment gateway callback
   */
  public async handleGatewayCallback(
    providerName: string,
    params: Record<string, any>
  ): Promise<{
    orderId?: string;
    orderNumber?: string;
    verified: boolean;
    status: string;
    message: string;
    redirectUrl: string;
  }> {
    const provider = providerName.toUpperCase() as PaymentProviderType;
    let verifyReq: PaymentVerifyRequest;

    let orderNumberCandidate = (
      params.tran_id ||
      params.order_id ||
      params.merchantInvoiceNumber ||
      params.orderNumber ||
      ''
    ).toString().trim();

    // Provider-specific mapping
    if (provider === 'BKASH') {
      const paymentID = params.paymentID || params.paymentId;
      const status = params.status; // 'success', 'failure', 'cancel'

      if (status === 'cancel') {
        return this.handleCancellation(paymentID, 'bKash customer cancelled payment session.');
      }
      if (status === 'failure') {
        return this.handleFailure(paymentID, 'bKash payment failed or was declined by provider.');
      }

      verifyReq = {
        merchantTransactionReference: orderNumberCandidate,
        gatewaySessionId: paymentID,
        statusCandidate: status,
      };
    } else if (provider === 'NAGAD') {
      const paymentRefId = params.payment_ref_id || params.paymentRefId;
      const status = params.status;

      if (status === 'Aborted' || status === 'Cancelled') {
        return this.handleCancellation(paymentRefId, 'Nagad customer cancelled payment session.');
      }

      verifyReq = {
        merchantTransactionReference: orderNumberCandidate,
        paymentRefId,
        gatewaySessionId: paymentRefId,
        statusCandidate: status,
      };
    } else if (provider === 'SSLCOMMERZ') {
      const valId = params.val_id;
      const tranId = params.tran_id;
      const status = params.status; // 'VALID', 'FAILED', 'CANCELLED'

      if (status === 'CANCELLED') {
        return this.handleCancellation(tranId, 'Customer cancelled card checkout.');
      }
      if (status === 'FAILED') {
        return this.handleFailure(tranId, 'Card transaction failed or was rejected by issuing bank.');
      }

      verifyReq = {
        merchantTransactionReference: tranId,
        valId,
        gatewayTransactionId: params.bank_tran_id || valId,
        statusCandidate: status,
      };
      orderNumberCandidate = tranId;
    } else {
      throw new Error(`Unsupported callback provider "${providerName}"`);
    }

    // If order number not in params, lookup by gateway session ID
    let transaction = await PaymentTransactionModel.findOne({
      $or: [
        { merchantTransactionReference: orderNumberCandidate },
        { gatewaySessionId: verifyReq.gatewaySessionId },
      ],
    });

    if (!transaction && orderNumberCandidate) {
      transaction = await PaymentTransactionModel.findOne({ orderNumber: orderNumberCandidate });
    }

    if (!transaction) {
      return {
        verified: false,
        status: 'failed',
        message: 'Could not associate gateway transaction with any recorded order.',
        redirectUrl: `/order-success?error=unmatched_transaction`,
      };
    }

    // Call provider's official server-to-server verification
    let verifyRes: PaymentVerifyResponse;
    if (provider === 'BKASH') {
      verifyRes = await bkashProvider.verifyPayment(verifyReq);
    } else if (provider === 'NAGAD') {
      verifyRes = await nagadProvider.verifyPayment(verifyReq);
    } else {
      verifyRes = await sslcommerzProvider.verifyPayment(verifyReq);
    }

    // Atomic update of transaction and order
    if (verifyRes.verified && verifyRes.paymentStatus === 'paid') {
      const order = await OrderModel.findById(transaction.orderId);
      if (order && order.paymentStatus !== 'paid') {
        const nextOrderStatus = order.orderStatus === 'pending' ? 'confirmed' : order.orderStatus;
        const gatewayTxId = verifyRes.gatewayTransactionId || `GW-${Date.now()}`;

        // Idempotency check: ensure gatewayTxId not already credited to another order
        const dupOrder = await OrderModel.findOne({
          'paymentDetails.transactionId': gatewayTxId,
          _id: { $ne: order._id },
        });

        if (!dupOrder) {
          order.paymentStatus = 'paid';
          order.orderStatus = nextOrderStatus;
          order.paymentDetails = {
            transactionId: gatewayTxId,
            provider: provider,
            verifiedAmount: verifyRes.verifiedAmount || order.pricing.total,
            verifiedAt: new Date(),
            verifiedBy: `Gateway Server-to-Server (${provider})`,
          };
          order.timeline.push({
            status: nextOrderStatus,
            timestamp: new Date(),
            note: `Online payment verified via ${provider} (TxID: ${gatewayTxId})`,
            actor: 'Payment Gateway',
          });
          await order.save();
        }
      }

      transaction.paymentStatus = 'paid';
      transaction.gatewayTransactionId = verifyRes.gatewayTransactionId;
      transaction.verificationTimestamp = new Date();
      transaction.completedTimestamp = new Date();
      transaction.gatewayResponse = verifyRes.rawResponse || transaction.gatewayResponse;
      await transaction.save();

      await logAuditActivity({
        action: 'VERIFY_PAYMENT',
        module: 'Payment Infrastructure',
        actorName: 'System / Gateway Callback',
        actorEmail: 'gateway@novaracommerce.com',
        actorRole: 'system',
        details: `Successfully verified ৳${transaction.amount} online payment via ${provider} for Order #${transaction.orderNumber}`,
        recordId: (transaction._id as any).toString(),
      });

      return {
        orderId: (transaction.orderId as any).toString(),
        orderNumber: transaction.orderNumber,
        verified: true,
        status: 'paid',
        message: 'Payment verified successfully!',
        redirectUrl: `/order-success?orderId=${transaction.orderId}&paymentStatus=paid`,
      };
    } else {
      transaction.paymentStatus = verifyRes.paymentStatus || 'failed';
      transaction.failureReason = verifyRes.failureReason || 'Verification check failed.';
      transaction.verificationTimestamp = new Date();
      await transaction.save();

      return {
        orderId: (transaction.orderId as any).toString(),
        orderNumber: transaction.orderNumber,
        verified: false,
        status: transaction.paymentStatus,
        message: transaction.failureReason,
        redirectUrl: `/order-success?orderId=${transaction.orderId}&paymentStatus=${transaction.paymentStatus}&reason=${encodeURIComponent(
          transaction.failureReason
        )}`,
      };
    }
  }

  private async handleCancellation(refId: string, reason: string) {
    const txn = await PaymentTransactionModel.findOne({
      $or: [{ merchantTransactionReference: refId }, { gatewaySessionId: refId }],
    });
    if (txn) {
      txn.paymentStatus = 'cancelled';
      txn.failureReason = reason;
      await txn.save();
      return {
        orderId: (txn.orderId as any).toString(),
        orderNumber: txn.orderNumber,
        verified: false,
        status: 'cancelled',
        message: reason,
        redirectUrl: `/order-success?orderId=${txn.orderId}&paymentStatus=cancelled`,
      };
    }
    return {
      verified: false,
      status: 'cancelled',
      message: reason,
      redirectUrl: `/order-success?error=cancelled`,
    };
  }

  private async handleFailure(refId: string, reason: string) {
    const txn = await PaymentTransactionModel.findOne({
      $or: [{ merchantTransactionReference: refId }, { gatewaySessionId: refId }],
    });
    if (txn) {
      txn.paymentStatus = 'failed';
      txn.failureReason = reason;
      await txn.save();
      return {
        orderId: (txn.orderId as any).toString(),
        orderNumber: txn.orderNumber,
        verified: false,
        status: 'failed',
        message: reason,
        redirectUrl: `/order-success?orderId=${txn.orderId}&paymentStatus=failed`,
      };
    }
    return {
      verified: false,
      status: 'failed',
      message: reason,
      redirectUrl: `/order-success?error=payment_failed`,
    };
  }

  /**
   * Cash on Delivery collection confirmation by authorized staff/courier
   */
  public async confirmCodCollection(
    orderIdentifier: string,
    collectionData: {
      collectedAmount: number;
      receiptNumber?: string;
      notes?: string;
    },
    staffUser: { id: string; name: string; email: string; role: string }
  ): Promise<{ order: IOrder; transaction: IPaymentTransaction }> {
    const orderFilter = mongoose.Types.ObjectId.isValid(orderIdentifier)
      ? { _id: orderIdentifier }
      : { orderNumber: orderIdentifier.toUpperCase() };

    const order = (await OrderModel.findOne(orderFilter)) as IOrder | null;
    if (!order) {
      throw new Error(`Order "${orderIdentifier}" not found.`);
    }

    if (order.paymentMethod !== 'cod') {
      throw new Error(`Order #${order.orderNumber} is not a Cash on Delivery order.`);
    }

    if (order.paymentStatus === 'paid') {
      throw new Error(`COD payment has already been collected and marked PAID.`);
    }

    if (order.orderStatus === 'cancelled' || order.orderStatus === 'returned') {
      throw new Error(`Cannot collect payment for a ${order.orderStatus} order.`);
    }

    const collectedAmount = Number(collectionData.collectedAmount) || order.pricing.total;
    const now = new Date();

    // Update order
    order.paymentStatus = 'paid';
    order.paymentDetails = {
      provider: 'COD',
      transactionId: collectionData.receiptNumber || `COD-${order.orderNumber}`,
      verifiedAmount: collectedAmount,
      verifiedAt: now,
      verifiedBy: staffUser.name,
      reference: collectionData.notes || 'Cash collected on delivery',
    };
    order.timeline.push({
      status: order.orderStatus,
      timestamp: now,
      note: `Cash on Delivery collected (৳${collectedAmount.toLocaleString()}) by ${staffUser.name}${
        collectionData.receiptNumber ? ` [Receipt: ${collectionData.receiptNumber}]` : ''
      }`,
      actor: staffUser.name,
    });
    await order.save();

    // Create or update PaymentTransaction record
    let txn = await PaymentTransactionModel.findOne({ orderId: order._id, paymentMethod: 'cod' });
    if (!txn) {
      txn = new PaymentTransactionModel({
        transactionNumber: `TXN-COD-${order.orderNumber}`,
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        paymentMethod: 'cod',
        paymentProvider: 'COD',
        merchantTransactionReference: order.orderNumber,
        amount: order.pricing.total,
        currency: 'BDT',
        environment: 'live',
      });
    }

    txn.paymentStatus = 'paid';
    txn.completedTimestamp = now;
    txn.verificationTimestamp = now;
    txn.codCollection = {
      collectedAt: now,
      collectedBy: staffUser.name,
      collectedAmount,
      receiptNumber: collectionData.receiptNumber,
      notes: collectionData.notes,
    };
    await txn.save();

    await logAuditActivity({
      action: 'CONFIRM_COD_COLLECTION',
      module: 'Payment Infrastructure',
      actorName: staffUser.name,
      actorEmail: staffUser.email,
      actorRole: staffUser.role,
      details: `Confirmed Cash on Delivery collection of ৳${collectedAmount} for Order #${order.orderNumber}`,
      recordId: (order._id as any).toString(),
    });

    return { order, transaction: txn };
  }

  /**
   * Process refund through provider or manual audited recording
   */
  public async processRefund(
    transactionIdOrNumber: string,
    amount: number,
    reason: string,
    staffUser: { id: string; name: string; email: string; role: string }
  ): Promise<PaymentRefundResponse> {
    const filter = mongoose.Types.ObjectId.isValid(transactionIdOrNumber)
      ? { _id: transactionIdOrNumber }
      : {
          $or: [
            { transactionNumber: transactionIdOrNumber.toUpperCase() },
            { orderNumber: transactionIdOrNumber.toUpperCase() },
            { gatewayTransactionId: transactionIdOrNumber },
          ],
        };

    const txn = (await PaymentTransactionModel.findOne(filter)) as IPaymentTransaction | null;
    if (!txn) {
      throw new Error(`Payment transaction "${transactionIdOrNumber}" not found.`);
    }

    if (txn.paymentStatus !== 'paid') {
      throw new Error(`Cannot refund transaction with status "${txn.paymentStatus}". Only PAID transactions can be refunded.`);
    }

    const refundAmount = Math.min(txn.amount, Math.max(1, Number(amount) || txn.amount));

    let refundResult: PaymentRefundResponse;
    const req = {
      merchantTransactionReference: txn.merchantTransactionReference,
      gatewayTransactionId: txn.gatewayTransactionId || txn.merchantTransactionReference,
      amount: refundAmount,
      reason,
      staffUser,
    };

    if (txn.paymentProvider === 'BKASH') {
      refundResult = await bkashProvider.processRefund(req);
    } else if (txn.paymentProvider === 'SSLCOMMERZ') {
      refundResult = await sslcommerzProvider.processRefund(req);
    } else {
      // Manual / COD / Nagad audited refund
      refundResult = {
        success: true,
        refundTrxId: `REF-${Date.now().toString(36).toUpperCase()}`,
        refundAmount,
        refundedAt: new Date(),
        message: 'Manual refund audited and recorded successfully.',
      };
    }

    if (refundResult.success) {
      txn.paymentStatus = 'refunded';
      txn.refundDetails = {
        refundTrxId: refundResult.refundTrxId,
        refundAmount,
        refundedAt: refundResult.refundedAt || new Date(),
        refundedBy: staffUser.name,
        refundReason: reason,
        gatewayResponse: refundResult.rawResponse,
      };
      await txn.save();

      // Update Order
      const order = await OrderModel.findById(txn.orderId);
      if (order) {
        order.paymentStatus = 'refunded';
        order.timeline.push({
          status: order.orderStatus,
          timestamp: new Date(),
          note: `Payment refunded (৳${refundAmount.toLocaleString()}) by ${staffUser.name}. Reason: ${reason}`,
          actor: staffUser.name,
        });
        await order.save();
      }

      await logAuditActivity({
        action: 'PROCESS_REFUND',
        module: 'Payment Infrastructure',
        actorName: staffUser.name,
        actorEmail: staffUser.email,
        actorRole: staffUser.role,
        details: `Processed refund of ৳${refundAmount} for Order #${txn.orderNumber} (${txn.paymentProvider})`,
        recordId: (txn._id as any).toString(),
      });
    }

    return refundResult;
  }

  /**
   * Admin Payment Dashboard Stats & Aggregations
   */
  public async getPaymentStats(filterParams: Record<string, any> = {}): Promise<any> {
    const filter: any = {};
    if (filterParams.provider && filterParams.provider !== 'all') {
      filter.paymentProvider = filterParams.provider.toUpperCase();
    }
    if (filterParams.method && filterParams.method !== 'all') {
      filter.paymentMethod = filterParams.method.toLowerCase();
    }
    if (filterParams.status && filterParams.status !== 'all') {
      filter.paymentStatus = filterParams.status.toLowerCase();
    }
    if (filterParams.startDate || filterParams.endDate) {
      filter.createdAt = {};
      if (filterParams.startDate) {
        const d = new Date(filterParams.startDate);
        if (!Number.isNaN(d.getTime())) filter.createdAt.$gte = d;
      }
      if (filterParams.endDate) {
        const d = new Date(filterParams.endDate);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = d;
        }
      }
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

    const [statusAgg, providerAgg, volumeAgg, recentTxns] = await Promise.all([
      PaymentTransactionModel.aggregate([
        { $match: filter },
        { $group: { _id: '$paymentStatus', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      ]),
      PaymentTransactionModel.aggregate([
        { $match: filter },
        { $group: { _id: '$paymentProvider', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      ]),
      PaymentTransactionModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalVolume: { $sum: '$amount' },
            paidVolume: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$amount', 0] },
            },
            onlinePaidVolume: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$paymentStatus', 'paid'] },
                      { $ne: ['$paymentProvider', 'COD'] },
                    ],
                  },
                  '$amount',
                  0,
                ],
              },
            },
            codCollectedVolume: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$paymentStatus', 'paid'] },
                      { $eq: ['$paymentProvider', 'COD'] },
                    ],
                  },
                  '$amount',
                  0,
                ],
              },
            },
            codPendingVolume: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$paymentStatus', ['pending', 'initiated']] },
                      { $eq: ['$paymentProvider', 'COD'] },
                    ],
                  },
                  '$amount',
                  0,
                ],
              },
            },
            refundedVolume: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$amount', 0] },
            },
          },
        },
      ]),
      PaymentTransactionModel.find(filter).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const summary = volumeAgg[0] || {
      totalTransactions: 0,
      totalVolume: 0,
      paidVolume: 0,
      onlinePaidVolume: 0,
      codCollectedVolume: 0,
      codPendingVolume: 0,
      refundedVolume: 0,
    };

    return {
      summary,
      statusBreakdown: statusAgg,
      providerBreakdown: providerAgg,
      recentTransactions: recentTxns,
    };
  }

  /**
   * Admin paginated transactions list
   */
  public async getTransactions(
    queryParams: Record<string, any>
  ): Promise<{ transactions: IPaymentTransaction[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, parseInt(queryParams.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (queryParams.provider && queryParams.provider !== 'all') {
      filter.paymentProvider = queryParams.provider.toUpperCase();
    }
    if (queryParams.method && queryParams.method !== 'all') {
      filter.paymentMethod = queryParams.method.toLowerCase();
    }
    if (queryParams.status && queryParams.status !== 'all') {
      filter.paymentStatus = queryParams.status.toLowerCase();
    }
    if (queryParams.search && String(queryParams.search).trim()) {
      const clean = String(queryParams.search).trim();
      filter.$or = [
        { transactionNumber: new RegExp(clean, 'i') },
        { orderNumber: new RegExp(clean, 'i') },
        { gatewayTransactionId: new RegExp(clean, 'i') },
        { customerName: new RegExp(clean, 'i') },
        { customerPhone: new RegExp(clean, 'i') },
      ];
    }
    if (queryParams.startDate || queryParams.endDate) {
      filter.createdAt = {};
      if (queryParams.startDate) {
        const d = new Date(queryParams.startDate);
        if (!Number.isNaN(d.getTime())) filter.createdAt.$gte = d;
      }
      if (queryParams.endDate) {
        const d = new Date(queryParams.endDate);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = d;
        }
      }
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

    const [transactions, total] = await Promise.all([
      PaymentTransactionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PaymentTransactionModel.countDocuments(filter),
    ]);

    return {
      transactions: transactions as IPaymentTransaction[],
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const paymentService = new PaymentService();
