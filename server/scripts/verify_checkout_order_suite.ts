import {
  BD_MOBILE_REGEX,
  BD_POSTAL_CODE_REGEX,
  isValidBdPhone,
  normalizeBdPhone,
  isValidBdPostalCode,
  mergeStoreSettings,
  calculateShippingFee,
  calculateTax,
  evaluateCoupon,
  ORDER_STATUS_TRANSITIONS,
  canTransitionOrderStatus,
  createOrderReceiptToken,
  verifyOrderReceiptToken,
} from '../utils/commerce';
import { validateLocationHierarchy } from '../modules/locations/locations.routes';
import type { OrderStatus } from '../database/models/Order';

console.log('================================================================');
console.log('   CHECKOUT, PRICING, STATE MACHINE & SECURITY UNIT SUITE       ');
console.log('================================================================\n');

let total = 0;
let passed = 0;
let failed = 0;

function check(condition: boolean, name: string, detail?: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ----------------------------------------------------------------
// Suite 1: StoreSettings Merging & Boundary Handling
// ----------------------------------------------------------------
console.log('--- SUITE 1: StoreSettings & Zero Preservation ---');
const defaults = mergeStoreSettings();
check(
  defaults.shippingDhaka === 60 &&
    defaults.shippingOutsideDhaka === 120 &&
    defaults.freeShippingThreshold === 1000 &&
    defaults.taxRate === 0,
  'Default store settings populate expected initial values'
);

const zeroSettings = mergeStoreSettings({
  shippingDhaka: 0,
  shippingOutsideDhaka: 0,
  freeShippingThreshold: 0,
  taxRate: 0,
  paymentMethods: { cod: false, bkash: true, nagad: false, card: true },
  notifications: { newOrderEmail: false, lowStockAlert: true },
});
check(zeroSettings.shippingDhaka === 0, 'Preserves explicit 0 shippingDhaka');
check(zeroSettings.shippingOutsideDhaka === 0, 'Preserves explicit 0 shippingOutsideDhaka');
check(zeroSettings.freeShippingThreshold === 0, 'Preserves explicit 0 freeShippingThreshold');
check(zeroSettings.paymentMethods.cod === false && zeroSettings.paymentMethods.bkash === true, 'Preserves payment method toggles');
check(zeroSettings.notifications.newOrderEmail === false && zeroSettings.notifications.lowStockAlert === true, 'Preserves notification toggles');

const clampedSettings = mergeStoreSettings({ taxRate: 150, shippingDhaka: -50 });
check(clampedSettings.taxRate === 100, 'Clamps taxRate above 100 to 100');
check(clampedSettings.shippingDhaka === 60, 'Falls back when negative shippingDhaka supplied');

// ----------------------------------------------------------------
// Suite 2: Dynamic Shipping & Tax Calculations
// ----------------------------------------------------------------
console.log('\n--- SUITE 2: Shipping & Tax Calculation ---');
check(calculateShippingFee(0, { division: 'Dhaka' }, defaults) === 0, 'Zero subtotal returns 0 shipping');
check(calculateShippingFee(1000, { division: 'Dhaka' }, defaults) === 0, 'Subtotal meeting freeShippingThreshold returns 0');
check(calculateShippingFee(999, { division: 'Dhaka' }, defaults) === 60, 'Dhaka division below threshold charges shippingDhaka');
check(calculateShippingFee(500, { division: 'ঢাকা' }, defaults) === 60, 'Bangla Dhaka title maps to shippingDhaka');
check(calculateShippingFee(500, { divisionId: '30' }, defaults) === 60, 'Division ID 30 maps to shippingDhaka');
check(calculateShippingFee(999, { division: 'Chattogram' }, defaults) === 120, 'Outside Dhaka charges shippingOutsideDhaka');
check(
  calculateShippingFee(5000, { division: 'Sylhet' }, { freeShippingThreshold: 0, shippingDhaka: 70, shippingOutsideDhaka: 130 }) === 130,
  'freeShippingThreshold=0 disables threshold free shipping'
);

check(calculateTax(1000, 0) === 0, 'Zero tax rate produces 0 tax');
check(calculateTax(0, 15) === 0, 'Zero taxable amount produces 0 tax');
check(calculateTax(24999, 5) === 1250, 'Rounds 5% tax accurately');
check(calculateTax(1000, 150) === 1000, 'Caps tax calculation rate at 100%');

// ----------------------------------------------------------------
// Suite 3: Coupon Evaluation Edge Cases
// ----------------------------------------------------------------
console.log('\n--- SUITE 3: Coupon Evaluation Engine ---');
const now = new Date('2026-11-10T12:00:00Z');

check(!evaluateCoupon(null, 5000, now).valid, 'Null coupon is rejected');
check(
  !evaluateCoupon({ discountType: 'percentage', discountValue: 10, isActive: false }, 5000, now).valid,
  'Inactive coupon is rejected'
);
check(
  !evaluateCoupon({ discountType: 'fixed', discountValue: 200, validFrom: '2026-12-01T00:00:00Z' }, 5000, now).valid,
  'Future validFrom coupon is rejected'
);
check(
  !evaluateCoupon({ discountType: 'fixed', discountValue: 200, validUntil: '2026-10-01T00:00:00Z' }, 5000, now).valid,
  'Expired coupon is rejected'
);
check(
  !evaluateCoupon({ discountType: 'fixed', discountValue: 200, usageLimit: 10, usedCount: 10 }, 5000, now).valid,
  'Coupon at usageLimit is rejected'
);
check(
  !evaluateCoupon({ discountType: 'percentage', discountValue: 10, minOrderAmount: 2000 }, 1999, now).valid,
  'Order below minOrderAmount is rejected'
);

const pctCapped = evaluateCoupon(
  { discountType: 'percentage', discountValue: 20, maxDiscount: 1500, minOrderAmount: 2000 },
  10000,
  now
);
check(pctCapped.valid && pctCapped.discount === 1500, 'Percentage discount respects maxDiscount cap');

const fixedClamped = evaluateCoupon({ discountType: 'fixed', discountValue: 500 }, 300, now);
check(fixedClamped.valid && fixedClamped.discount === 300, 'Fixed coupon never exceeds subtotal');

// ----------------------------------------------------------------
// Suite 4: Order Status Transition State Machine
// ----------------------------------------------------------------
console.log('\n--- SUITE 4: Order Fulfillment State Machine ---');
const allStatuses: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
];

let matrixOk = true;
for (const from of allStatuses) {
  for (const to of allStatuses) {
    const expected = from === to || (ORDER_STATUS_TRANSITIONS[from] || []).includes(to);
    const actual = canTransitionOrderStatus(from, to);
    if (actual !== expected) {
      matrixOk = false;
      console.error(`Mismatch transition ${from} -> ${to}: got ${actual}, expected ${expected}`);
    }
  }
}
check(matrixOk, 'All 64 state transition pairs match ORDER_STATUS_TRANSITIONS strictly');
check(!canTransitionOrderStatus('pending', 'delivered'), 'Cannot jump directly from pending to delivered');
check(!canTransitionOrderStatus('delivered', 'pending'), 'Cannot revert delivered back to pending');
check(!canTransitionOrderStatus('cancelled', 'confirmed'), 'Cancelled terminal state blocks transition to confirmed');

// ----------------------------------------------------------------
// Suite 5: Signed Order Receipt HMAC Token
// ----------------------------------------------------------------
console.log('\n--- SUITE 5: Guest Receipt HMAC Verification ---');
const oid = '6730a8e2b54d8f0012345678';
const oNum = 'NOV-20261110-1234';
const tok = createOrderReceiptToken(oid, oNum);
check(tok.length === 64, 'Receipt token is 64-char SHA-256 HMAC hex');
check(verifyOrderReceiptToken(tok, oid, oNum), 'Verifies valid receipt token');
check(verifyOrderReceiptToken(tok, oid, oNum.toLowerCase()), 'Verifies receipt token case-insensitively on orderNumber');
check(!verifyOrderReceiptToken(tok, '6730a8e2b54d8f0012345679', oNum), 'Rejects token for different orderId');
check(!verifyOrderReceiptToken(tok, oid, 'NOV-20261110-9999'), 'Rejects token for different orderNumber');
check(!verifyOrderReceiptToken(tok.slice(0, -1) + (tok.endsWith('0') ? '1' : '0'), oid, oNum), 'Rejects single-char tampered token');
check(!verifyOrderReceiptToken('', oid, oNum), 'Rejects empty token');

// ----------------------------------------------------------------
// Suite 6: Regexes & Hierarchy Sanity
// ----------------------------------------------------------------
console.log('\n--- SUITE 6: Phone, Postal & Location Integration Sanity ---');
check(BD_MOBILE_REGEX.test('01712345678') && isValidBdPhone('+8801712345678'), 'BD mobile regex validates local & +88 formats');
check(normalizeBdPhone('+880 1812-345678') === '01812345678', 'Phone normalizer strips prefixes and punctuation');
check(BD_POSTAL_CODE_REGEX.test('1212') && isValidBdPostalCode('1212') && !isValidBdPostalCode('121'), 'BD postal code enforces 4 digits');
check(
  validateLocationHierarchy('Dhaka', 'Dhaka', 'Dhaka South City Corporat', 'Dhanmondi').isValid,
  'Canonical seeded Dhanmondi ward passes location hierarchy validator'
);

// ----------------------------------------------------------------
// Suite 7: Optional Live MongoDB Connectivity Check
// ----------------------------------------------------------------
console.log('\n--- SUITE 7: Live MongoDB Connectivity Check ---');
if (process.env.MONGODB_URI && process.env.MONGODB_URI.trim()) {
  console.log('[INFO] MONGODB_URI detected in env — use bash server/scripts/e2e_full_audit.sh against running server on port 3000 for live DB integration verification.');
} else {
  console.log('[BLOCKED] Live MongoDB integration checks skipped: MONGODB_URI is not configured in environment.');
}

console.log('\n================================================================');
console.log(`CHECKOUT & ORDER SUITE SUMMARY: ${passed}/${total} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
