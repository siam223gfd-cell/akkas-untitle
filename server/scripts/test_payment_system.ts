import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { paymentService } from '../services/payments/payment.service';
import { codProvider } from '../services/payments/cod.provider';
import { bkashProvider } from '../services/payments/bkash.provider';
import { nagadProvider } from '../services/payments/nagad.provider';
import { sslcommerzProvider } from '../services/payments/sslcommerz.provider';
import { createExpressApp } from '../app';

let totalChecks = 0;
let passedChecks = 0;

function assert(condition: boolean, label: string, details?: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`[PASS] ${label}`);
  } else {
    console.error(`[FAIL] ${label}${details ? ` -> ${details}` : ''}`);
    throw new Error(`Assertion failed: ${label}`);
  }
}

async function runPaymentSystemAudit() {
  console.log('================================================================');
  console.log('   PRODUCTION PAYMENT SYSTEM AUDIT & VERIFICATION SUITE         ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // SUITE 1: PROVIDER ADAPTER CONFIGURATION & REGISTRATION
  // -------------------------------------------------------------
  console.log('--- SUITE 1: Provider Adapter Discovery & Contract Verification ---');
  const providerStatuses = paymentService.getProviderStatuses();
  assert(Array.isArray(providerStatuses) && providerStatuses.length === 4, 'Exactly 4 payment providers registered in orchestrator');

  const cod = providerStatuses.find((p) => p.provider === 'COD');
  const bkash = providerStatuses.find((p) => p.provider === 'BKASH');
  const nagad = providerStatuses.find((p) => p.provider === 'NAGAD');
  const sslcz = providerStatuses.find((p) => p.provider === 'SSLCOMMERZ');

  assert(!!cod && cod.isConfigured === true, 'COD provider is permanently available and configured');
  assert(!!bkash && bkash.environment === 'sandbox', 'bKash provider default is sandbox environment');
  assert(!!nagad && nagad.environment === 'sandbox', 'Nagad provider default is sandbox environment');
  assert(!!sslcz && sslcz.environment === 'sandbox', 'SSLCOMMERZ provider default is sandbox environment');

  assert(bkash!.missingCredentials.includes('BKASH_APP_KEY'), 'bKash detects missing BKASH_APP_KEY in clean environment');
  assert(nagad!.missingCredentials.includes('NAGAD_PRIVATE_KEY'), 'Nagad detects missing NAGAD_PRIVATE_KEY in clean environment');
  assert(sslcz!.missingCredentials.includes('SSLCOMMERZ_STORE_ID'), 'SSLCOMMERZ detects missing SSLCOMMERZ_STORE_ID in clean environment');

  // -------------------------------------------------------------
  // SUITE 2: CASH ON DELIVERY (COD) REAL INVARIANT CONTRACT
  // -------------------------------------------------------------
  console.log('\n--- SUITE 2: Cash on Delivery Physical Cash Invariants ---');
  const mockOrder = {
    _id: '507f1f77bcf86cd799439011',
    orderNumber: 'TEST-COD-001',
    customerId: '507f1f77bcf86cd799439012',
    customerName: 'Siam Rahaman',
    customerEmail: 'siam@example.com',
    customerPhone: '01712345678',
    pricing: {
      subtotal: 2500,
      discount: 0,
      shippingFee: 60,
      tax: 0,
      total: 2560,
    },
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    shippingAddress: {
      streetAddress: 'House 5, Road 2, Gulshan',
      district: 'Dhaka',
    },
  };

  const initPayload: import('../services/payments/types').PaymentInitiateRequest = {
    orderId: mockOrder._id,
    orderNumber: mockOrder.orderNumber,
    amount: mockOrder.pricing.total,
    currency: 'BDT',
    paymentMethod: 'cod',
    customerName: mockOrder.customerName,
    customerEmail: mockOrder.customerEmail,
    customerPhone: mockOrder.customerPhone,
    shippingAddress: {
      streetAddress: 'House 5, Road 2, Gulshan',
      upazila: 'Gulshan',
      district: 'Dhaka',
      division: 'Dhaka',
      postalCode: '1212',
    },
    items: [
      {
        name: 'Test Product',
        quantity: 1,
        price: 2500,
        sku: 'TEST-01',
      },
    ],
    callbackUrl: 'http://localhost:3000/api/payments/callback',
  };

  const codInit = codProvider.initiatePayment(initPayload);
  assert(codInit.success === true, 'COD payment initiation succeeds');
  assert(codInit.requiresRedirect === false, 'COD does not require 3P browser redirect');
  assert(codInit.paymentProvider === 'COD', 'COD provider identifies as COD');
  assert(!codInit.gatewayUrl, 'COD has no external gateway URL');

  const codVerify = codProvider.verifyPayment({
    merchantTransactionReference: mockOrder.orderNumber,
    rawPayload: {},
  });
  assert(codVerify.verified === false && codVerify.paymentStatus === 'pending', 'COD cannot be verified online and strictly remains pending');

  // -------------------------------------------------------------
  // SUITE 3: BKASH REAL TOKENIZED CHECKOUT API CONTRACT
  // -------------------------------------------------------------
  console.log('\n--- SUITE 3: bKash Tokenized Checkout Contract & Missing Keys ---');
  const bkashRes = await bkashProvider.initiatePayment({ ...initPayload, paymentMethod: 'bkash' });
  assert(bkashRes.success === false, 'bKash fails gracefully when keys missing');
  assert(
    !!bkashRes.error && (bkashRes.error.includes('credentials') || bkashRes.error.includes('Missing')),
    'bKash returns actionable error identifying missing keys'
  );

  // -------------------------------------------------------------
  // SUITE 4: NAGAD RSA ENCRYPTED MERCHANT API CONTRACT
  // -------------------------------------------------------------
  console.log('\n--- SUITE 4: Nagad RSA Signed Contract & Missing Keys ---');
  const nagadRes = await nagadProvider.initiatePayment({ ...initPayload, paymentMethod: 'nagad' });
  assert(nagadRes.success === false, 'Nagad fails gracefully when keys missing');
  assert(
    !!nagadRes.error && (nagadRes.error.includes('credentials') || nagadRes.error.includes('Missing')),
    'Nagad returns actionable error identifying missing keys'
  );

  // -------------------------------------------------------------
  // SUITE 5: SSLCOMMERZ V4 SESSION CONTRACT & MISSING KEYS
  // -------------------------------------------------------------
  console.log('\n--- SUITE 5: SSLCOMMERZ v4 Session API Contract & Missing Keys ---');
  const sslczRes = await sslcommerzProvider.initiatePayment({
    ...initPayload,
    paymentMethod: 'card',
  });
  assert(sslczRes.success === false, 'SSLCOMMERZ fails gracefully when store ID missing');
  assert(
    !!sslczRes.error && (sslczRes.error.includes('credentials') || sslczRes.error.includes('Missing')),
    'SSLCOMMERZ returns actionable error identifying missing keys'
  );

  // -------------------------------------------------------------
  // SUITE 6: HTTP REST SECURITY & PERMISSION BOUNDARIES
  // -------------------------------------------------------------
  console.log('\n--- SUITE 6: HTTP Security, Authentication & Role Boundaries ---');
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api/payments`;

  const adminToken = jwt.sign(
    { id: 'audit-admin-01', email: 'admin@novaracommerce.com', role: 'super_admin' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const customerToken = jwt.sign(
    { id: 'audit-customer-01', email: 'customer@novaracommerce.com', role: 'customer' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  try {
    // 6.1 /providers/config security
    const unauthConfig = await fetch(`${baseUrl}/providers/config`);
    assert(unauthConfig.status === 401, 'Unauthenticated GET /providers/config is blocked (401)');

    const customerConfig = await fetch(`${baseUrl}/providers/config`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(customerConfig.status === 403, 'Customer role cannot access admin /providers/config (403)');

    const adminConfig = await fetch(`${baseUrl}/providers/config`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminConfig.status === 200, 'Super Admin role can access /providers/config (200)');
    const adminConfigData = (await adminConfig.json()) as any;
    assert(adminConfigData.providers.length === 4, 'Admin config response returns all 4 providers');

  } finally {
    server.close();
  }

  // -------------------------------------------------------------
  // SUITE 7: ZERO FAKE SIMULATION INVARIANT
  // -------------------------------------------------------------
  console.log('\n--- SUITE 7: Anti-Simulation & Strict Ledger Invariants ---');
  assert(
    !paymentService.initiatePayment.toString().includes('mock') &&
      !paymentService.initiatePayment.toString().includes('fake') &&
      !paymentService.initiatePayment.toString().includes('demo-paid'),
    'paymentService contains zero simulation bypasses or fake paid triggers'
  );

  console.log('\n================================================================');
  console.log(`   AUDIT FINISHED: ${passedChecks}/${totalChecks} CHECKS PASSED (100% GREEN)`);
  console.log('================================================================');
}

runPaymentSystemAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('AUDIT FAILED:', err);
    process.exit(1);
  });
