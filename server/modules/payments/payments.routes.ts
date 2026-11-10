import { Router, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { paymentService } from '../../services/payments/payment.service';
import { OrderModel } from '../../database/models/Order';
import { AuthenticatedRequest, requireRole, requireAuth } from '../../middleware/auth';
import { requireDatabase } from '../../middleware/dbGuard';
import { verifyOrderReceiptToken } from '../../utils/commerce';

export const paymentsRouter = Router();

/**
 * GET /api/payments/providers/config
 * View provider configuration status (safe, no secret disclosure)
 */
paymentsRouter.get(
  '/providers/config',
  requireRole('super_admin', 'admin', 'finance'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const providers = paymentService.getProviderStatuses();
      res.json({ success: true, providers });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

paymentsRouter.use(requireDatabase);

const initiatePaymentSchema = z.object({
  orderId: z.string().min(1, 'Order identifier is required'),
  paymentMethod: z.enum(['cod', 'bkash', 'nagad', 'card']).optional(),
  receiptToken: z.string().optional(),
});

const codCollectSchema = z.object({
  orderId: z.string().min(1, 'Order identifier is required'),
  collectedAmount: z.number().positive('Collected amount must be greater than 0'),
  receiptNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(300).optional(),
});

const refundSchema = z.object({
  transactionId: z.string().min(1, 'Transaction identifier is required'),
  amount: z.number().positive('Refund amount must be greater than 0'),
  reason: z.string().trim().min(3, 'Refund reason is required').max(300),
});

/**
 * POST /api/payments/initiate
 * Initiates payment session with authorized gateway or records COD initiation
 */
paymentsRouter.post('/initiate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = initiatePaymentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        message: parse.error.issues[0]?.message || 'Invalid payment initiation payload.',
      });
    }

    const { orderId, paymentMethod, receiptToken } = parse.data;

    // Verify order exists and check authorization (owner or guest with valid receiptToken or staff)
    const orderFilter = mongoose.Types.ObjectId.isValid(orderId)
      ? { _id: orderId }
      : { orderNumber: orderId.toUpperCase() };

    const order = await OrderModel.findOne(orderFilter).lean() as any;
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const tokenCandidate =
      receiptToken || (req.query.token as string) || (req.headers['x-receipt-token'] as string);
    const hasStaff =
      req.user &&
      ['super_admin', 'admin', 'order_manager', 'finance', 'customer_support'].includes(req.user.role);
    const isOwner = req.user && order.customerId === req.user.id;
    const hasValidToken = verifyOrderReceiptToken(
      tokenCandidate,
      order._id.toString(),
      order.orderNumber
    );

    if (!hasStaff && !isOwner && !hasValidToken) {
      return res.status(req.user ? 403 : 401).json({
        success: false,
        message: 'Unauthorized to initiate payment for this order.',
      });
    }

    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const clientMeta = {
      ip: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      host: Array.isArray(hostHeader) ? hostHeader[0] : String(hostHeader),
      protocol: (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http',
    };

    const result = await paymentService.initiatePayment(
      order._id.toString(),
      paymentMethod,
      clientMeta
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Payment initiation failed.' });
  }
});

/**
 * GET & POST /api/payments/callback/:provider
 * Authorized gateway return handler with server-to-server verification
 */
async function handleGatewayCallbackRoute(req: AuthenticatedRequest, res: Response) {
  try {
    const provider = req.params.provider;
    const allParams = { ...req.query, ...req.body };

    const result = await paymentService.handleGatewayCallback(provider, allParams);

    // If API client requested JSON (e.g. IPN webhook)
    const isJsonRequest =
      req.headers.accept?.includes('application/json') ||
      req.headers['content-type']?.includes('application/json');

    if (isJsonRequest && !result.redirectUrl) {
      return res.json(result);
    }

    // Otherwise redirect customer's browser to the authoritative order result page
    res.redirect(result.redirectUrl || '/order-success');
  } catch (err: any) {
    console.error('Callback error:', err);
    res.redirect(`/order-success?error=callback_error&message=${encodeURIComponent(err.message)}`);
  }
}

paymentsRouter.get('/callback/:provider', handleGatewayCallbackRoute);
paymentsRouter.post('/callback/:provider', handleGatewayCallbackRoute);

/**
 * GET /api/payments/verify/:orderId
 * Authoritative check of an order's payment and transaction records
 */
paymentsRouter.get('/verify/:orderId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const orderFilter = mongoose.Types.ObjectId.isValid(orderId)
      ? { _id: orderId }
      : { orderNumber: orderId.toUpperCase() };

    const order = await OrderModel.findOne(orderFilter).lean() as any;
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const tokenCandidate =
      (req.query.token as string) || (req.headers['x-receipt-token'] as string);
    const hasStaff =
      req.user &&
      ['super_admin', 'admin', 'order_manager', 'finance', 'customer_support'].includes(req.user.role);
    const isOwner = req.user && order.customerId === req.user.id;
    const hasValidToken = verifyOrderReceiptToken(
      tokenCandidate,
      order._id.toString(),
      order.orderNumber
    );

    if (!hasStaff && !isOwner && !hasValidToken) {
      return res.status(req.user ? 403 : 401).json({
        success: false,
        message: 'Unauthorized.',
      });
    }

    res.json({
      success: true,
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentDetails: order.paymentDetails,
      orderStatus: order.orderStatus,
      pricing: order.pricing,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/payments/transactions
 * Admin list all payment transactions with filters and pagination
 */
paymentsRouter.get(
  '/transactions',
  requireRole('super_admin', 'admin', 'order_manager', 'finance'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await paymentService.getTransactions(req.query);
      res.json({
        success: true,
        transactions: result.transactions,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /api/payments/stats
 * Admin Payment Dashboard analytics & volume aggregations
 */
paymentsRouter.get(
  '/stats',
  requireRole('super_admin', 'admin', 'order_manager', 'finance'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await paymentService.getPaymentStats(req.query);
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/payments/cod/collect
 * Admin / Staff confirmed collection of Cash on Delivery
 */
paymentsRouter.post(
  '/cod/collect',
  requireRole('super_admin', 'admin', 'order_manager', 'finance'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parse = codCollectSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({
          success: false,
          message: parse.error.issues[0]?.message || 'Invalid COD collection payload.',
        });
      }

      const { orderId, collectedAmount, receiptNumber, notes } = parse.data;

      const result = await paymentService.confirmCodCollection(
        orderId,
        {
          collectedAmount,
          receiptNumber,
          notes,
        },
        {
          id: req.user!.id,
          name: req.user!.name,
          email: req.user!.email,
          role: req.user!.role,
        }
      );

      res.json({
        success: true,
        message: `Cash on Delivery collection of ৳${collectedAmount.toLocaleString()} confirmed for Order #${result.order.orderNumber}.`,
        order: result.order,
        transaction: result.transaction,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/payments/refund
 * Admin / Staff process refund
 */
paymentsRouter.post(
  '/refund',
  requireRole('super_admin', 'admin', 'finance'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parse = refundSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({
          success: false,
          message: parse.error.issues[0]?.message || 'Invalid refund payload.',
        });
      }

      const { transactionId, amount, reason } = parse.data;

      const result = await paymentService.processRefund(
        transactionId,
        amount,
        reason,
        {
          id: req.user!.id,
          name: req.user!.name,
          email: req.user!.email,
          role: req.user!.role,
        }
      );

      if (result.success) {
        res.json({
          success: true,
          message: result.message || 'Refund successfully processed.',
          refundTrxId: result.refundTrxId,
          refundAmount: result.refundAmount,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Refund rejected by provider.',
          rawResponse: result.rawResponse,
        });
      }
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);
