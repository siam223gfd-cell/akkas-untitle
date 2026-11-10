import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '../database/connection';
import { seedDatabaseIfEmpty } from '../database/seed';
import { ProductModel } from '../database/models/Product';
import { OrderModel } from '../database/models/Order';
import { UserModel } from '../database/models/User';
import { createExpressApp } from '../app';
import http from 'http';

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition: boolean, name: string, detail?: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`[PASS] ${name}`);
  } else {
    failedChecks++;
    console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runTest() {
  console.log('================================================================');
  console.log('   ENTERPRISE SECURITY, DATABASE & INFINITE SCROLL AUDIT SUITE   ');
  console.log('================================================================\n');

  // 1. Connect to Database (Atlas or embedded MongoMemoryServer)
  const connected = await connectToDatabase();
  assert(connected, 'Database connection established successfully');

  await seedDatabaseIfEmpty();

  // 2. Start Express test server
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`\n--- SUITE 1: HTTP Security Headers & Injection Sanitization ---`);

  // Request to health endpoint to inspect headers
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert(healthRes.status === 200, 'Health endpoint responds 200 OK');
  assert(healthRes.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff is set');
  assert(healthRes.headers.get('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN is set');
  assert(healthRes.headers.get('x-xss-protection') === '1; mode=block', 'X-XSS-Protection: 1; mode=block is set');
  assert(healthRes.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer-Policy is strict-origin-when-cross-origin');

  // NoSQL Injection Test: query param with $gt operator
  const nosqlRes = await fetch(`${baseUrl}/api/products?q[$gt]=`);
  const nosqlJson = await nosqlRes.json();
  assert(nosqlRes.status === 200, 'Server safely sanitizes query with nested $gt operators');
  assert(Array.isArray(nosqlJson.products), 'Sanitizer returns valid products array without erroring');

  console.log(`\n--- SUITE 2: Password Security & User Serialization Invariants ---`);
  const testUser = await UserModel.findOne({ role: 'super_admin' }).lean();
  assert(!!testUser, 'Super admin user exists in database');
  assert(typeof testUser?.password === 'string' && testUser.password.startsWith('$2'), 'Admin password is encrypted with bcrypt hash');

  const mongooseUser = await UserModel.findOne({ role: 'super_admin' });
  const userJson = mongooseUser?.toJSON();
  assert(userJson?.password === undefined, 'User toJSON() strictly removes password hash from serialization');

  console.log(`\n--- SUITE 3: Million-Product Database Indexes Verification ---`);
  const schemaIndexes = ProductModel.schema.indexes();
  const indexKeyObjects = schemaIndexes.map((idx: any) => Object.keys(idx[0]).join('_'));

  const expectedIndexKeys = [
    'status_createdAt__id',
    'status_salePrice__id',
    'status_rating_reviewCount__id',
    'status_category_createdAt__id',
    'status_category_salePrice__id',
    'status_brand_createdAt__id',
  ];

  for (const expected of expectedIndexKeys) {
    const hasIdx = indexKeyObjects.some((k: string) => k === expected);
    assert(hasIdx, `Product Schema defines compound index: ${expected}`);
  }

  console.log(`\n--- SUITE 4: 20-Product Maximum Batch Limit & Field Projection ---`);
  // Request with limit=100 (should be clamped to 20 for public catalog)
  const limitRes = await fetch(`${baseUrl}/api/products?limit=100`);
  const limitJson = await limitRes.json();
  assert(limitRes.status === 200, 'Public products endpoint returns 200');
  assert(limitJson.limit === 20, 'Public request limit=100 is strictly clamped to maximum 20');
  assert(limitJson.products.length <= 20, `Returned batch size is exactly <= 20 (got ${limitJson.products.length})`);

  // Field projection verification: big fields must NOT be returned in listing items
  const firstCard = limitJson.products[0];
  assert(firstCard.description === undefined, 'Field projection: description is excluded from catalog cards');
  assert(firstCard.specificationsTable === undefined, 'Field projection: specificationsTable is excluded from cards');
  assert(firstCard.highlights === undefined, 'Field projection: highlights is excluded from cards');
  assert(firstCard.faqs === undefined, 'Field projection: faqs is excluded from cards');
  assert(firstCard.name && firstCard.salePrice && firstCard.slug, 'Card contains required display fields (name, salePrice, slug)');

  console.log(`\n--- SUITE 5: Keyset Cursor Pagination & Infinite Scroll Sequence ---`);

  // Seed 25 additional products dynamically so total active count >= 50 for full multi-batch test
  const extraProducts = [];
  const baseTimestamp = Date.now();
  for (let i = 1; i <= 25; i++) {
    extraProducts.push({
      name: `Scale Test Product ${i}`,
      slug: `scale-test-product-${baseTimestamp}-${i}`,
      sku: `SCALE-TEST-${baseTimestamp}-${i}`,
      brand: 'ScaleBrand',
      category: 'Electronics',
      description: 'Test product for high catalog pagination scalability.',
      basePrice: 5000 + i * 100,
      salePrice: 4500 + i * 100,
      stock: 50,
      images: ['https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=400&q=80'],
      status: 'active',
      createdAt: new Date(baseTimestamp - i * 60000),
    });
  }
  await ProductModel.insertMany(extraProducts);

  // First page (20 items)
  const page1Res = await fetch(`${baseUrl}/api/products?limit=20&page=1`);
  const page1Json = await page1Res.json();
  assert(page1Json.products.length === 20, `Batch 1 returns exactly 20 products (got ${page1Json.products.length})`);
  assert(page1Json.hasMore === true, 'Batch 1 hasMore is true');
  assert(typeof page1Json.nextCursor === 'string' && page1Json.nextCursor.length > 0, 'Batch 1 returns valid nextCursor string');

  // Second page (next 20 items using cursor)
  const page2Res = await fetch(`${baseUrl}/api/products?limit=20&cursor=${encodeURIComponent(page1Json.nextCursor)}`);
  const page2Json = await page2Res.json();
  assert(page2Json.products.length === 20, `Batch 2 returns exactly 20 products (got ${page2Json.products.length})`);
  assert(page2Json.hasMore === true, 'Batch 2 hasMore is true');

  // Verify zero overlap between Batch 1 and Batch 2
  const ids1 = new Set(page1Json.products.map((p: any) => p._id));
  const overlap = page2Json.products.filter((p: any) => ids1.has(p._id));
  assert(overlap.length === 0, `Zero duplicate products between Batch 1 and Batch 2 (overlap: ${overlap.length})`);

  // Third page (remaining items)
  if (page2Json.nextCursor) {
    const page3Res = await fetch(`${baseUrl}/api/products?limit=20&cursor=${encodeURIComponent(page2Json.nextCursor)}`);
    const page3Json = await page3Res.json();
    assert(page3Json.products.length > 0, `Batch 3 returns remaining items (${page3Json.products.length} items)`);
    // Verify no duplicates between batch 2 and batch 3
    const ids2 = new Set(page2Json.products.map((p: any) => p._id));
    const overlap2 = page3Json.products.filter((p: any) => ids2.has(p._id));
    assert(overlap2.length === 0, `Zero duplicate products between Batch 2 and Batch 3 (overlap: ${overlap2.length})`);
  }

  // Cleanup extra products
  await ProductModel.deleteMany({ brand: 'ScaleBrand' });

  console.log(`\n--- SUITE 6: IDOR Protection & Order Security ---`);
  // Create an order directly in DB to test access controls
  const dummyOrder = await OrderModel.create({
    orderNumber: `TEST-SEC-${Date.now()}`,
    customerId: 'user_alice_123',
    customerName: 'Alice Customer',
    customerEmail: 'alice@example.com',
    customerPhone: '01711112233',
    items: [
      {
        productId: firstCard._id,
        name: firstCard.name,
        sku: firstCard.sku,
        price: firstCard.salePrice,
        quantity: 1,
      },
    ],
    shippingAddress: {
      recipientName: 'Alice Customer',
      phone: '01711112233',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Gulshan',
      streetAddress: 'House 1, Road 2',
    },
    pricing: {
      subtotal: firstCard.salePrice,
      discount: 0,
      shippingFee: 60,
      tax: 0,
      total: firstCard.salePrice + 60,
    },
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    orderStatus: 'pending',
  });

  // Attempt to access without authentication or valid token
  const unauthOrderRes = await fetch(`${baseUrl}/api/orders/${dummyOrder.orderNumber}`);
  assert(unauthOrderRes.status === 401, 'Unauthorized access to single order is rejected with 401');

  // Attempt to access with invalid receipt token
  const badTokenRes = await fetch(`${baseUrl}/api/orders/${dummyOrder.orderNumber}?token=invalid_forged_token`);
  assert(badTokenRes.status === 401, 'Tampered receipt token is rejected with 401');

  // Attempt unauthenticated GET /api/orders (admin list)
  const unauthListRes = await fetch(`${baseUrl}/api/orders`);
  assert(unauthListRes.status === 401, 'Unauthenticated access to admin orders list is rejected with 401');

  // Cleanup dummy order
  await OrderModel.deleteOne({ _id: dummyOrder._id });

  // Close server and disconnect DB
  server.close();
  await disconnectFromDatabase();

  console.log('\n================================================================');
  console.log(`   AUDIT FINISHED: ${passedChecks}/${totalChecks} PASSED (${failedChecks} FAILED)`);
  console.log('================================================================\n');

  if (failedChecks > 0) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
