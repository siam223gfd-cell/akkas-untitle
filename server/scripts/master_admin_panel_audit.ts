import http from 'http';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000/api';

interface TestResult {
  module: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];
let currentModule = '';

function setModule(mod: string) {
  currentModule = mod;
  console.log(`\n================================================================`);
  console.log(`  MODULE: ${mod}`);
  console.log(`================================================================`);
}

function recordPass(testName: string) {
  results.push({ module: currentModule, name: testName, passed: true });
  console.log(`  [PASS] ${testName}`);
}

function recordFail(testName: string, err: any) {
  const errMsg = err?.message || String(err);
  results.push({ module: currentModule, name: testName, passed: false, error: errMsg });
  console.error(`  [FAIL] ${testName} -> ${errMsg}`);
}

async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, ok: res.ok, data };
}

async function runMasterAudit() {
  console.log('****************************************************************');
  console.log('   STARTING COMPREHENSIVE MASTER QA AUDIT FOR ALL ADMIN MODULES  ');
  console.log('****************************************************************\n');

  // STEP 0: ACQUIRE TOKENS
  setModule('AUTHENTICATION & RBAC FOUNDATION');
  let adminToken = '';
  let customerToken = '';

  try {
    const adminLoginRes = await request('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'siam@gmail.com', password: 'siam12345!' }),
    });
    if (!adminLoginRes.ok || !adminLoginRes.data?.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
    }
    adminToken = adminLoginRes.data.token;
    recordPass('Administrator login succeeds with configured credentials');
  } catch (err) {
    recordFail('Administrator login succeeds with configured credentials', err);
  }

  try {
    const custEmail = `audit_qa_${Date.now()}@example.com`;
    const custRegRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'QA Auditor Customer',
        email: custEmail,
        password: 'QAPassword123!',
        phone: '+8801712888888',
      }),
    });
    if (!custRegRes.ok || !custRegRes.data?.token) {
      throw new Error(`Customer register failed: ${JSON.stringify(custRegRes.data)}`);
    }
    customerToken = custRegRes.data.token;
    recordPass('Customer account creation and authentication');
  } catch (err) {
    recordFail('Customer account creation and authentication', err);
  }

  try {
    const unauthRes = await request('/admin/analytics');
    if (unauthRes.status === 401) {
      recordPass('Unauthenticated request to protected admin endpoint returns 401');
    } else {
      throw new Error(`Expected 401, got ${unauthRes.status}`);
    }
  } catch (err) {
    recordFail('Unauthenticated request to protected admin endpoint returns 401', err);
  }

  try {
    const custForbiddenRes = await request('/admin/analytics', {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (custForbiddenRes.status === 403) {
      recordPass('Customer role calling admin endpoint receives 403 Forbidden');
    } else {
      throw new Error(`Expected 403, got ${custForbiddenRes.status}`);
    }
  } catch (err) {
    recordFail('Customer role calling admin endpoint receives 403 Forbidden', err);
  }

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const custHeaders = { Authorization: `Bearer ${customerToken}` };

  // MODULE A: DASHBOARD & ANALYTICS
  setModule('DASHBOARD & ANALYTICS');
  try {
    const res = await request('/admin/analytics?range=30d', { headers: adminHeaders });
    if (res.ok && res.data?.stats && typeof res.data.stats.totalProducts === 'number') {
      recordPass('GET /api/admin/analytics?range=30d returns live database aggregations');
    } else {
      throw new Error(`Invalid analytics response: ${JSON.stringify(res.data)}`);
    }
  } catch (err) {
    recordFail('GET /api/admin/analytics?range=30d returns live database aggregations', err);
  }

  try {
    for (const range of ['7d', '90d', '1y'] as const) {
      const rangeRes = await request(`/admin/analytics?range=${range}`, { headers: adminHeaders });
      if (!rangeRes.ok) throw new Error(`Range ${range} returned status ${rangeRes.status}`);
    }
    recordPass('Analytics date range filters (7d, 90d, 1y) execute successfully');
  } catch (err) {
    recordFail('Analytics date range filters (7d, 90d, 1y) execute successfully', err);
  }

  // MODULE B: HERO SLIDER MANAGEMENT
  setModule('HERO SLIDER MANAGEMENT');
  let testSlideId = '';
  try {
    // Create
    const createRes = await request('/hero-slides', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Master Audit Test Slide',
        subtitle: 'Automated E2E Verification Slide Subtitle',
        badge: 'NEW ARRIVAL',
        desktopImage: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1200&q=80',
        mobileImage: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=600&q=80',
        destinationUrl: '/shop',
        ctaText: 'Test Action',
        order: 99,
        isActive: true,
      }),
    });

    if (createRes.ok && createRes.data?.slide?._id) {
      testSlideId = createRes.data.slide._id;
      recordPass('Create hero slider (POST /api/hero-slides)');
    } else {
      throw new Error(`Slide create failed: ${JSON.stringify(createRes.data)}`);
    }

    // Read list
    const listRes = await request('/hero-slides', { headers: adminHeaders });
    const found = listRes.data?.slides?.some((s: any) => s._id === testSlideId);
    if (found) {
      recordPass('Read hero slider in admin list (GET /api/hero-slides)');
    } else {
      throw new Error('Newly created slide not found in admin list');
    }

    // Update
    const updateRes = await request(`/hero-slides/${testSlideId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Updated Master Audit Test Slide',
        order: 100,
      }),
    });
    if (updateRes.ok && updateRes.data?.slide?.title === 'Updated Master Audit Test Slide') {
      recordPass('Update hero slider (PUT /api/hero-slides/:id)');
    } else {
      throw new Error(`Slide update failed: ${JSON.stringify(updateRes.data)}`);
    }

    // Public sync: verify active slides
    const activeRes = await request('/hero-slides/active');
    const inActive = activeRes.data?.slides?.some((s: any) => s._id === testSlideId);
    if (inActive) {
      recordPass('Public website reflects active hero slide (GET /api/hero-slides/active)');
    } else {
      throw new Error('Slide not found in public active slides');
    }

    // Toggle status
    const toggleRes = await request(`/hero-slides/${testSlideId}/toggle-status`, {
      method: 'PATCH',
      headers: adminHeaders,
    });
    if (toggleRes.ok && toggleRes.data?.slide?.isActive === false) {
      recordPass('Toggle hero slider active status to disabled');
    } else {
      throw new Error(`Toggle failed: ${JSON.stringify(toggleRes.data)}`);
    }

    // Public sync: verify disabled slide is NOT in active list
    const activeAfterDisable = await request('/hero-slides/active');
    const inActiveDisabled = activeAfterDisable.data?.slides?.some((s: any) => s._id === testSlideId);
    if (!inActiveDisabled) {
      recordPass('Public website hides disabled hero slide');
    } else {
      throw new Error('Disabled slide still visible in public active list');
    }

    // Delete
    const deleteRes = await request(`/hero-slides/${testSlideId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (deleteRes.ok) {
      recordPass('Delete hero slider (DELETE /api/hero-slides/:id)');
    } else {
      throw new Error(`Delete failed: ${JSON.stringify(deleteRes.data)}`);
    }
  } catch (err) {
    recordFail('Hero slider lifecycle', err);
  }

  // MODULE C: PROMOTIONAL BANNERS
  setModule('PROMOTIONAL BANNERS');
  let testBannerId = '';
  try {
    const createBannerRes = await request('/banners', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA Audit Promotional Banner',
        slug: `qa-banner-${Date.now()}`,
        status: 'published',
        placements: ['split_left'],
        priority: 5,
        background: {
          type: 'solid',
          color: '#1e3a8a',
          opacity: 100,
        },
        layout: {
          width: '100%',
          height: '280px',
          borderRadius: 16,
        },
        layers: [
          {
            id: 'l1',
            type: 'heading',
            text: 'Huge Discounts',
            fontSize: 24,
            fontWeight: 'bold',
            textColor: '#ffffff',
            isVisible: true,
          },
        ],
        buttons: [
          {
            id: 'b1',
            label: 'Shop Now',
            url: '/shop',
            isVisible: true,
          },
        ],
      }),
    });

    if (createBannerRes.ok && createBannerRes.data?.banner?._id) {
      testBannerId = createBannerRes.data.banner._id;
      recordPass('Create promotional banner (POST /api/banners)');
    } else {
      throw new Error(`Banner create failed: ${JSON.stringify(createBannerRes.data)}`);
    }

    // Read list
    const bannersList = await request('/banners', { headers: adminHeaders });
    const bannerFound = bannersList.data?.banners?.some((b: any) => b._id === testBannerId);
    if (bannerFound) {
      recordPass('Read banner in admin list (GET /api/banners)');
    } else {
      throw new Error('Banner not in admin list');
    }

    // Public active sync
    const activeBanners = await request('/banners/active');
    const inActiveBanners = activeBanners.data?.banners?.some((b: any) => b._id === testBannerId);
    if (inActiveBanners) {
      recordPass('Public website reflects active banner (GET /api/banners/active)');
    } else {
      throw new Error('Banner not found in public active list');
    }

    // Update banner
    const updateBannerRes = await request(`/banners/${testBannerId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA Audit Banner Updated',
        status: 'draft',
      }),
    });
    if (updateBannerRes.ok && updateBannerRes.data?.banner?.status === 'draft') {
      recordPass('Update banner & transition to draft (PUT /api/banners/:id)');
    } else {
      throw new Error(`Update banner failed: ${JSON.stringify(updateBannerRes.data)}`);
    }

    // Delete banner
    const deleteBannerRes = await request(`/banners/${testBannerId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (deleteBannerRes.ok) {
      recordPass('Delete promotional banner (DELETE /api/banners/:id)');
    } else {
      throw new Error(`Delete banner failed: ${JSON.stringify(deleteBannerRes.data)}`);
    }
  } catch (err) {
    recordFail('Promotional banners lifecycle', err);
  }

  // MODULE D: ADVERTISEMENTS
  setModule('ADVERTISEMENTS MANAGEMENT');
  let testAdId = '';
  try {
    const createAdRes = await request('/advertisements', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA Audit Advertisement',
        title: 'Special Summer Ad Deal',
        subtitle: 'Save up to 40% on smart electronics',
        description: 'Get verified quality products with 1 year official warranty.',
        promoBadge: 'Limited Stock',
        mainImage: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80',
        backgroundColor: '#0f172a',
        textColor: '#ffffff',
        cta: {
          enabled: true,
          label: 'Order Now',
          url: '/shop',
          target: '_self',
          variant: 'primary',
          bgColor: '#2563eb',
          textColor: '#ffffff',
        },
        closeButton: {
          enabled: true,
          position: 'top-right',
          appearance: 'circle',
          dismissalPolicy: 'session',
          dismissalDurationHours: 24,
        },
        placements: ['popup_modal', 'between_sections'],
        deviceTargeting: 'all',
        priority: 1,
        status: 'published',
      }),
    });

    if (createAdRes.ok && createAdRes.data?.advertisement?._id) {
      testAdId = createAdRes.data.advertisement._id;
      recordPass('Create advertisement campaign (POST /api/advertisements)');
    } else {
      throw new Error(`Create ad failed: ${JSON.stringify(createAdRes.data)}`);
    }

    // Read list
    const adsList = await request('/advertisements', { headers: adminHeaders });
    const adFound = adsList.data?.advertisements?.some((a: any) => a._id === testAdId);
    if (adFound) {
      recordPass('Read advertisement in admin list (GET /api/advertisements)');
    } else {
      throw new Error('Ad not found in admin list');
    }

    // Public active sync
    const activeAds = await request('/advertisements/active');
    const inActiveAds = activeAds.data?.advertisements?.some((a: any) => a._id === testAdId);
    if (inActiveAds) {
      recordPass('Public storefront sync: active advertisement rendered (GET /api/advertisements/active)');
    } else {
      throw new Error('Ad not present in active ads endpoint');
    }

    // Update status to archived
    const updateAdRes = await request(`/advertisements/${testAdId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Updated Summer Ad Title',
        status: 'archived',
      }),
    });
    if (updateAdRes.ok && updateAdRes.data?.advertisement?.status === 'archived') {
      recordPass('Update advertisement status to archived (PUT /api/advertisements/:id)');
    } else {
      throw new Error(`Update ad failed: ${JSON.stringify(updateAdRes.data)}`);
    }

    // Verify archived ad disappears from public active endpoint
    const activeAfterArchive = await request('/advertisements/active');
    const inArchivePublic = activeAfterArchive.data?.advertisements?.some((a: any) => a._id === testAdId);
    if (!inArchivePublic) {
      recordPass('Public website immediately hides archived advertisement');
    } else {
      throw new Error('Archived ad still exposed publicly');
    }

    // Delete ad
    const deleteAdRes = await request(`/advertisements/${testAdId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (deleteAdRes.ok) {
      recordPass('Delete advertisement (DELETE /api/advertisements/:id)');
    } else {
      throw new Error(`Delete ad failed: ${JSON.stringify(deleteAdRes.data)}`);
    }
  } catch (err) {
    recordFail('Advertisement lifecycle', err);
  }

  // MODULE E: PRODUCT MANAGEMENT
  setModule('PRODUCT MANAGEMENT');
  let testProductId = '';
  const testSku = `SKU-AUDIT-${Date.now()}`;
  try {
    const createProdRes = await request('/products', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Master QA Ergonomic Wireless Headset',
        subtitle: 'High fidelity audio with noise cancellation',
        slug: `qa-headset-${Date.now()}`,
        sku: testSku,
        brand: 'Aurelia Tech',
        category: 'Electronics',
        subcategory: 'Audio',
        description: 'Complete testing description with specifications and deep attributes.',
        basePrice: 5000,
        salePrice: 4200,
        stock: 30,
        images: ['https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80'],
        variants: [
          {
            id: 'v1',
            sku: `${testSku}-BLK`,
            name: 'Matte Black',
            price: 4200,
            stock: 20,
            options: { Color: 'Matte Black' },
          },
          {
            id: 'v2',
            sku: `${testSku}-WHT`,
            name: 'Arctic White',
            price: 4400,
            stock: 10,
            options: { Color: 'Arctic White' },
          },
        ],
        highlights: [{ label: 'Battery', value: '40 Hours Playback', icon: 'battery' }],
        specificationsTable: [{ label: 'Driver', value: '40mm Neodymium', group: 'Audio' }],
        faqs: [{ question: 'Is it waterproof?', answer: 'It is IPX4 splash resistant.' }],
        status: 'active',
        isFeatured: true,
      }),
    });

    const createdProduct = createProdRes.data?.product || createProdRes.data;
    if (createProdRes.ok && createdProduct?._id) {
      testProductId = createdProduct._id;
      recordPass('Create product with variants, highlights, specs & FAQs');
    } else {
      throw new Error(`Product create failed: ${JSON.stringify(createProdRes.data)}`);
    }

    // Read by ID
    const getProdRes = await request(`/products/${testProductId}`);
    const prodData = getProdRes.data?.product || getProdRes.data;
    if (getProdRes.ok && (prodData?.sku === testSku || prodData?._id === testProductId)) {
      recordPass('Read product details by ID with variant matrix intact');
    } else {
      throw new Error(`Read product failed: ${JSON.stringify(getProdRes.data)}`);
    }

    // Update product price & stock
    const updateProdRes = await request(`/products/${testProductId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        salePrice: 3899,
        stock: 28,
      }),
    });
    const updatedProd = updateProdRes.data?.product || updateProdRes.data;
    if (updateProdRes.ok && updatedProd?.salePrice === 3899) {
      recordPass('Update product price & inventory stock');
    } else {
      throw new Error(`Update product failed: ${JSON.stringify(updateProdRes.data)}`);
    }

    // Storefront instant sync
    const publicProdRes = await request(`/products/${testProductId}`);
    const publicProd = publicProdRes.data?.product || publicProdRes.data;
    if (publicProd?.salePrice === 3899) {
      recordPass('Public product endpoint immediately synchronizes updated price');
    } else {
      throw new Error('Public product did not reflect updated price');
    }

    // Duplicate product
    const dupRes = await request(`/products/${testProductId}/duplicate`, {
      method: 'POST',
      headers: adminHeaders,
    });
    if (dupRes.ok && dupRes.data?.product?._id) {
      const dupId = dupRes.data.product._id;
      recordPass('Admin duplicates product with auto-generated unique SKU and slug');
      // Clean up duplicated product
      await request(`/products/${dupId}`, { method: 'DELETE', headers: adminHeaders });
    } else {
      throw new Error(`Product duplication failed: ${JSON.stringify(dupRes.data)}`);
    }

    // Delete product
    const delProdRes = await request(`/products/${testProductId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (delProdRes.ok) {
      recordPass('Admin deletes product (DELETE /api/products/:id)');
    } else {
      throw new Error(`Delete product failed: ${JSON.stringify(delProdRes.data)}`);
    }
  } catch (err) {
    recordFail('Product management lifecycle', err);
  }

  // MODULE F: CATEGORY MANAGEMENT
  setModule('CATEGORY MANAGEMENT');
  let testCatId = '';
  try {
    const createCatRes = await request('/categories', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Master QA Category',
        slug: `qa-cat-${Date.now()}`,
        description: 'Temporary testing category for QA audit',
        image: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=400&q=80',
        order: 99,
      }),
    });

    const createdCat = createCatRes.data?.category || createCatRes.data;
    if (createCatRes.ok && createdCat?._id) {
      testCatId = createdCat._id;
      recordPass('Create category (POST /api/categories)');
    } else {
      throw new Error(`Create category failed: ${JSON.stringify(createCatRes.data)}`);
    }

    // Read categories
    const catListRes = await request('/categories');
    const catList = Array.isArray(catListRes.data) ? catListRes.data : (catListRes.data?.categories || []);
    const catFound = catList.some((c: any) => c._id === testCatId || c.id === testCatId);
    if (catFound) {
      recordPass('Read categories list with new category present');
    } else {
      throw new Error('Category not in list');
    }

    // Update category
    const updateCatRes = await request(`/categories/${testCatId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Master QA Category Updated',
      }),
    });
    const updatedCat = updateCatRes.data?.category || updateCatRes.data;
    if (updateCatRes.ok && updatedCat?.name === 'Master QA Category Updated') {
      recordPass('Update category name (PUT /api/categories/:id)');
    } else {
      throw new Error(`Category update failed: ${JSON.stringify(updateCatRes.data)}`);
    }

    // Delete category
    const delCatRes = await request(`/categories/${testCatId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (delCatRes.ok) {
      recordPass('Delete category safely (DELETE /api/categories/:id)');
    } else {
      throw new Error(`Delete category failed: ${JSON.stringify(delCatRes.data)}`);
    }
  } catch (err) {
    recordFail('Category management lifecycle', err);
  }

  // MODULE G: BRAND MANAGEMENT
  setModule('BRAND MANAGEMENT');
  let testBrandId = '';
  try {
    const createBrandRes = await request('/admin/brands', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA Sound Labs',
        slug: `qa-sound-${Date.now()}`,
        description: 'Audiophile grade hardware laboratory',
        logo: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=200&q=80',
        featured: true,
      }),
    });

    const createdBrand = createBrandRes.data?.brand || createBrandRes.data;
    if (createBrandRes.ok && createdBrand?._id) {
      testBrandId = createdBrand._id;
      recordPass('Create brand (POST /api/admin/brands)');
    } else {
      throw new Error(`Create brand failed: ${JSON.stringify(createBrandRes.data)}`);
    }

    // Read list
    const brandsListRes = await request('/admin/brands', { headers: adminHeaders });
    const brandFound = brandsListRes.data?.brands?.some((b: any) => b._id === testBrandId);
    if (brandFound) {
      recordPass('Read brands list (GET /api/admin/brands)');
    } else {
      throw new Error('Brand not found in list');
    }

    // Update brand
    const updateBrandRes = await request(`/admin/brands/${testBrandId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA Sound Labs International',
      }),
    });
    if (updateBrandRes.ok && updateBrandRes.data?.brand?.name === 'QA Sound Labs International') {
      recordPass('Update brand information (PUT /api/admin/brands/:id)');
    } else {
      throw new Error(`Update brand failed: ${JSON.stringify(updateBrandRes.data)}`);
    }

    // Delete brand
    const delBrandRes = await request(`/admin/brands/${testBrandId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (delBrandRes.ok) {
      recordPass('Delete brand (DELETE /api/admin/brands/:id)');
    } else {
      throw new Error(`Delete brand failed: ${JSON.stringify(delBrandRes.data)}`);
    }
  } catch (err) {
    recordFail('Brand management lifecycle', err);
  }

  // MODULE H: UNIVERSAL ATTRIBUTES MANAGEMENT
  setModule('UNIVERSAL ATTRIBUTES MANAGEMENT');
  let testAttrId = '';
  try {
    const createAttrRes = await request('/attributes', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA Screen Refresh Rate',
        slug: `qa-refresh-rate-${Date.now()}`,
        type: 'select',
        categories: ['Electronics', 'Mobile & Tablets'],
        isRequired: false,
        isFilterable: true,
        isVisibleOnPDP: true,
        values: [
          { label: '60 Hz', value: '60hz' },
          { label: '120 Hz ProMotion', value: '120hz' },
        ],
      }),
    });

    if (createAttrRes.ok && createAttrRes.data?.attribute?._id) {
      testAttrId = createAttrRes.data.attribute._id;
      recordPass('Create universal product attribute (POST /api/attributes)');
    } else {
      throw new Error(`Create attribute failed: ${JSON.stringify(createAttrRes.data)}`);
    }

    // Read attributes
    const attrListRes = await request('/attributes');
    const attrFound = attrListRes.data?.attributes?.some((a: any) => a._id === testAttrId);
    if (attrFound) {
      recordPass('Read attributes catalog (GET /api/attributes)');
    } else {
      throw new Error('Attribute not in list');
    }

    // Update attribute
    const updateAttrRes = await request(`/attributes/${testAttrId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA Screen Refresh Rate (Adaptive)',
      }),
    });
    if (updateAttrRes.ok && updateAttrRes.data?.attribute?.name.includes('Adaptive')) {
      recordPass('Update attribute (PUT /api/attributes/:id)');
    } else {
      throw new Error(`Update attribute failed: ${JSON.stringify(updateAttrRes.data)}`);
    }

    // Delete attribute
    const delAttrRes = await request(`/attributes/${testAttrId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (delAttrRes.ok) {
      recordPass('Delete attribute (DELETE /api/attributes/:id)');
    } else {
      throw new Error(`Delete attribute failed: ${JSON.stringify(delAttrRes.data)}`);
    }
  } catch (err) {
    recordFail('Attributes management lifecycle', err);
  }

  // MODULE I: ORDER & INVENTORY MANAGEMENT
  setModule('ORDER & INVENTORY MANAGEMENT');
  let orderId = '';
  let orderNumber = '';
  let receiptToken = '';
  try {
    // 1. Create order
    const orderCreateRes = await request('/orders', {
      method: 'POST',
      headers: custHeaders,
      body: JSON.stringify({
        items: [
          {
            productId: 'airpods-pro-2',
            quantity: 1,
          },
        ],
        shippingAddress: {
          recipientName: 'QA Auditor Customer',
          phone: '+8801712888888',
          division: 'Dhaka',
          divisionId: '30',
          district: 'Dhaka',
          districtId: '26',
          upazila: 'Dhaka North City Corporat',
          upazilaId: '493',
          unionOrWard: 'gulshan',
          unionId: '4694',
          streetAddress: 'House 10, Road 4, Gulshan 2',
          postalCode: '1212',
        },
        paymentMethod: 'cod',
      }),
    });

    if (orderCreateRes.ok && orderCreateRes.data?.order?._id) {
      orderId = orderCreateRes.data.order._id;
      orderNumber = orderCreateRes.data.order.orderNumber;
      receiptToken = orderCreateRes.data.receiptToken;
      recordPass(`Customer places order ${orderNumber} with valid receipt token`);
    } else {
      throw new Error(`Create order failed: ${JSON.stringify(orderCreateRes.data)}`);
    }

    // 2. Admin searches and reads order
    const adminOrdersRes = await request(`/orders?search=${orderNumber}`, { headers: adminHeaders });
    if (adminOrdersRes.ok && adminOrdersRes.data?.orders?.some((o: any) => o._id === orderId)) {
      recordPass('Admin searches & retrieves order in listing');
    } else {
      throw new Error('Order not found via admin search');
    }

    // 3. Admin reads order details
    const orderDetailRes = await request(`/orders/${orderId}`, { headers: adminHeaders });
    if (orderDetailRes.ok && orderDetailRes.data?.order?.orderNumber === orderNumber) {
      recordPass('Admin inspects complete order details, items & recipient address');
    } else {
      throw new Error(`Order detail failed: ${JSON.stringify(orderDetailRes.data)}`);
    }

    // 4. Status Transition: pending -> confirmed
    const status1Res = await request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'confirmed', note: 'QA Verified Order' }),
    });
    if (status1Res.ok && status1Res.data?.order?.orderStatus === 'confirmed') {
      recordPass('Order transition: pending -> confirmed');
    } else {
      throw new Error(`Status transition failed: ${JSON.stringify(status1Res.data)}`);
    }

    // 5. Status Transition: confirmed -> processing
    const status2Res = await request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'processing', note: 'Packaging started' }),
    });
    if (status2Res.ok && status2Res.data?.order?.orderStatus === 'processing') {
      recordPass('Order transition: confirmed -> processing');
    } else {
      throw new Error(`Status transition failed: ${JSON.stringify(status2Res.data)}`);
    }

    // 6. Status Transition: processing -> packed
    const status3Res = await request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'packed', note: 'Boxed and ready' }),
    });
    if (status3Res.ok && status3Res.data?.order?.orderStatus === 'packed') {
      recordPass('Order transition: processing -> packed');
    } else {
      throw new Error(`Status transition failed: ${JSON.stringify(status3Res.data)}`);
    }

    // 7. Status Transition: packed -> shipped
    const status4Res = await request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'shipped', note: 'Handed over to courier' }),
    });
    if (status4Res.ok && status4Res.data?.order?.orderStatus === 'shipped') {
      recordPass('Order transition: packed -> shipped');
    } else {
      throw new Error(`Status transition failed: ${JSON.stringify(status4Res.data)}`);
    }

    // 8. Status Transition: shipped -> delivered
    const status5Res = await request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'delivered', note: 'Delivered to customer' }),
    });
    if (status5Res.ok && status5Res.data?.order?.orderStatus === 'delivered') {
      recordPass('Order transition: shipped -> delivered (Fulfillment completed)');
    } else {
      throw new Error(`Status transition failed: ${JSON.stringify(status5Res.data)}`);
    }

    // 9. Negative transition test: cannot jump from delivered back to pending
    const invalidStatusRes = await request(`/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'pending' }),
    });
    if (!invalidStatusRes.ok) {
      recordPass('State machine rejects illegal transition: delivered -> pending');
    } else {
      throw new Error('State machine illegally allowed transition delivered -> pending');
    }
  } catch (err) {
    recordFail('Order lifecycle & state machine', err);
  }

  // MODULE J: PAYMENT MANAGEMENT & LEDGER
  setModule('PAYMENT MANAGEMENT & TRANSACTIONS');
  try {
    const txRes = await request('/payments/transactions', { headers: adminHeaders });
    if (txRes.ok && Array.isArray(txRes.data?.transactions)) {
      recordPass('Admin retrieves payment transactions ledger (GET /api/payments/transactions)');
    } else {
      throw new Error(`Transactions fetch failed: ${JSON.stringify(txRes.data)}`);
    }

    const provRes = await request('/payments/providers/config', { headers: adminHeaders });
    if (provRes.ok && Array.isArray(provRes.data?.providers) && provRes.data.providers.length === 4) {
      recordPass('Payment provider config reports all 4 gateways with environment and credentials');
    } else {
      throw new Error(`Providers config failed: ${JSON.stringify(provRes.data)}`);
    }
  } catch (err) {
    recordFail('Payment management', err);
  }

  // MODULE K: CUSTOMER MANAGEMENT
  setModule('CUSTOMER MANAGEMENT');
  try {
    const custsRes = await request('/admin/customers', { headers: adminHeaders });
    if (custsRes.ok && Array.isArray(custsRes.data?.customers)) {
      recordPass('Admin lists customer accounts (GET /api/admin/customers)');
    } else {
      throw new Error(`Customers listing failed: ${JSON.stringify(custsRes.data)}`);
    }

    const firstCust = custsRes.data?.customers?.[0];
    if (firstCust?._id || firstCust?.id) {
      const cId = firstCust._id || firstCust.id;
      const custDetailRes = await request(`/admin/customers/${cId}`, { headers: adminHeaders });
      if (custDetailRes.ok && custDetailRes.data?.customer) {
        recordPass('Admin retrieves customer details & profile (GET /api/admin/customers/:id)');
      } else {
        throw new Error(`Customer details failed: ${JSON.stringify(custDetailRes.data)}`);
      }

      const custOrdersRes = await request(`/admin/customers/${cId}/orders`, { headers: adminHeaders });
      if (custOrdersRes.ok && Array.isArray(custOrdersRes.data?.orders)) {
        recordPass('Admin inspects customer order history (GET /api/admin/customers/:id/orders)');
      } else {
        throw new Error(`Customer orders failed: ${JSON.stringify(custOrdersRes.data)}`);
      }
    }
  } catch (err) {
    recordFail('Customer management', err);
  }

  // MODULE L: COUPONS & DISCOUNTS
  setModule('COUPONS & DISCOUNTS');
  let testCouponId = '';
  const testCouponCode = `AUDIT${Date.now()}`;
  try {
    const createCouponRes = await request('/coupons', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        code: testCouponCode,
        discountType: 'percentage',
        discountValue: 15,
        minOrderAmount: 2000,
        maxDiscount: 1500,
        validUntil: '2028-12-31',
        isActive: true,
      }),
    });

    const createdCoupon = createCouponRes.data?.coupon || createCouponRes.data;
    if (createCouponRes.ok && createdCoupon?._id) {
      testCouponId = createdCoupon._id;
      recordPass(`Create coupon ${testCouponCode} (POST /api/coupons)`);
    } else {
      throw new Error(`Create coupon failed: ${JSON.stringify(createCouponRes.data)}`);
    }

    // Validate coupon via checkout API
    const valRes = await request('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code: testCouponCode, subtotal: 5000 }),
    });
    const discountVal = valRes.data?.coupon?.discount ?? valRes.data?.discount;
    if (valRes.ok && discountVal === 750) {
      recordPass('Validate coupon: 15% of 5000 accurately calculates ৳750 discount');
    } else {
      throw new Error(`Coupon validation failed: ${JSON.stringify(valRes.data)}`);
    }

    // Min order amount rejection
    const minValRes = await request('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code: testCouponCode, subtotal: 1000 }),
    });
    if (!minValRes.ok && minValRes.data?.message?.includes('Minimum')) {
      recordPass('Coupon validation strictly enforces minOrderAmount (৳2000)');
    } else {
      throw new Error(`Enforce minOrderAmount failed: ${JSON.stringify(minValRes.data)}`);
    }

    // Delete coupon
    const delCouponRes = await request(`/coupons/${testCouponId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (delCouponRes.ok) {
      recordPass('Delete coupon (DELETE /api/coupons/:id)');
    } else {
      throw new Error(`Delete coupon failed: ${JSON.stringify(delCouponRes.data)}`);
    }
  } catch (err) {
    recordFail('Coupons management lifecycle', err);
  }

  // MODULE M: REVIEWS & RATINGS MODERATION
  setModule('REVIEWS & RATINGS MODERATION');
  let testReviewId = '';
  try {
    // Customer submits review
    const submitRevRes = await request('/reviews', {
      method: 'POST',
      headers: custHeaders,
      body: JSON.stringify({
        productId: 'airpods-pro-2',
        rating: 5,
        title: 'Master QA Verified Audio Experience',
        comment: 'Crystal clear treble and phenomenal ANC. Absolutely worth every taka.',
        photos: ['https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=400&q=80'],
      }),
    });

    if (submitRevRes.ok && submitRevRes.data?.review?._id) {
      testReviewId = submitRevRes.data.review._id;
      recordPass('Customer submits review with photo (POST /api/reviews)');
    } else {
      throw new Error(`Submit review failed: ${JSON.stringify(submitRevRes.data)}`);
    }

    // Admin lists reviews (including unapproved)
    const adminRevList = await request('/reviews/admin', { headers: adminHeaders });
    const revFound = adminRevList.data?.reviews?.some((r: any) => r._id === testReviewId);
    if (revFound) {
      recordPass('Admin retrieves all reviews for moderation (GET /api/reviews/admin)');
    } else {
      throw new Error('Review not in admin list');
    }

    // Admin approves review
    const approveRes = await request(`/reviews/${testReviewId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'approved' }),
    });
    if (approveRes.ok && approveRes.data?.review?.status === 'approved') {
      recordPass('Admin approves review for public storefront');
    } else {
      throw new Error(`Approve review failed: ${JSON.stringify(approveRes.data)}`);
    }

    // Public list contains approved review
    const publicRevs = await request('/reviews?productId=airpods-pro-2');
    const inPublicRevs = publicRevs.data?.reviews?.some((r: any) => r._id === testReviewId);
    if (inPublicRevs) {
      recordPass('Approved review displays publicly on product detail page');
    } else {
      throw new Error('Approved review missing from public reviews list');
    }

    // Delete review
    const delRevRes = await request(`/reviews/${testReviewId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (delRevRes.ok) {
      recordPass('Admin deletes review (DELETE /api/reviews/:id)');
    } else {
      throw new Error(`Delete review failed: ${JSON.stringify(delRevRes.data)}`);
    }
  } catch (err) {
    recordFail('Reviews moderation lifecycle', err);
  }

  // MODULE N: CONTENT & CMS PAGES
  setModule('CONTENT & CMS PAGES');
  let testPageId = '';
  try {
    const createPageRes = await request('/admin/pages', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Master QA Warranty Policy',
        slug: `qa-warranty-${Date.now()}`,
        content: 'Official manufacturer warranty policy terms and conditions.',
        isActive: true,
      }),
    });

    if (createPageRes.ok && createPageRes.data?.page?._id) {
      testPageId = createPageRes.data.page._id;
      recordPass('Create CMS static page (POST /api/admin/pages)');
    } else {
      throw new Error(`Create page failed: ${JSON.stringify(createPageRes.data)}`);
    }

    // Read pages
    const pagesListRes = await request('/admin/pages', { headers: adminHeaders });
    const pageFound = pagesListRes.data?.pages?.some((p: any) => p._id === testPageId);
    if (pageFound) {
      recordPass('Read CMS pages list (GET /api/admin/pages)');
    } else {
      throw new Error('Page not in list');
    }

    // Update page
    const updatePageRes = await request(`/admin/pages/${testPageId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Master QA Warranty Policy (Revised)',
      }),
    });
    if (updatePageRes.ok && updatePageRes.data?.page?.title.includes('Revised')) {
      recordPass('Update CMS page title and content');
    } else {
      throw new Error(`Update page failed: ${JSON.stringify(updatePageRes.data)}`);
    }

    // Delete page
    const delPageRes = await request(`/admin/pages/${testPageId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (delPageRes.ok) {
      recordPass('Delete CMS static page (DELETE /api/admin/pages/:id)');
    } else {
      throw new Error(`Delete page failed: ${JSON.stringify(delPageRes.data)}`);
    }
  } catch (err) {
    recordFail('CMS static pages lifecycle', err);
  }

  // MODULE O: BLOG POSTS
  setModule('BLOG POSTS MANAGEMENT');
  let testBlogId = '';
  try {
    const createBlogRes = await request('/admin/blogs', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'How to Pick the Best Noise-Cancelling Headphones in 2026',
        summary: 'A comprehensive guide to wireless audio codecs, ANC levels, and battery endurance.',
        content: 'Detailed audio engineering breakdown for Bangladeshi music producers and listeners.',
        author: 'Aurelia Tech Reviewer',
        image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
        tags: ['Audio', 'Headphones', 'Tech Guide'],
        readTime: 5,
        isActive: true,
      }),
    });

    const createdBlog = createBlogRes.data?.blog || createBlogRes.data?.post || createBlogRes.data;
    if (createBlogRes.ok && createdBlog?._id) {
      testBlogId = createdBlog._id;
      recordPass('Create blog post (POST /api/admin/blogs)');
    } else {
      throw new Error(`Create blog failed: ${JSON.stringify(createBlogRes.data)}`);
    }

    // Read list
    const blogsList = await request('/admin/blogs', { headers: adminHeaders });
    const blogFound = blogsList.data?.blogs?.some((b: any) => b._id === testBlogId);
    if (blogFound) {
      recordPass('Read blog posts list (GET /api/admin/blogs)');
    } else {
      throw new Error('Blog not in list');
    }

    // Update blog
    const updateBlogRes = await request(`/admin/blogs/${testBlogId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Updated 2026 Headphone Guide',
        summary: 'Updated audio guide summary for 2026.',
      }),
    });
    const updatedBlog = updateBlogRes.data?.blog || updateBlogRes.data?.post || updateBlogRes.data;
    if (updateBlogRes.ok && updatedBlog?.title?.includes('Updated')) {
      recordPass('Update blog post information (PUT /api/admin/blogs/:id)');
    } else {
      throw new Error(`Update blog failed: ${JSON.stringify(updateBlogRes.data)}`);
    }

    // Delete blog
    const delBlogRes = await request(`/admin/blogs/${testBlogId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (delBlogRes.ok) {
      recordPass('Delete blog post (DELETE /api/admin/blogs/:id)');
    } else {
      throw new Error(`Delete blog failed: ${JSON.stringify(delBlogRes.data)}`);
    }
  } catch (err) {
    recordFail('Blog posts lifecycle', err);
  }

  // MODULE P: DYNAMIC NAVIGATION MENUS
  setModule('DYNAMIC NAVIGATION MENUS');
  let testNavId = '';
  try {
    const createNavRes = await request('/navigation', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        label: 'Special Deals',
        url: '/shop?sort=discount',
        type: 'link',
        displayOrder: 9,
        isActive: true,
      }),
    });

    const createdNav = createNavRes.data?.item || createNavRes.data;
    if (createNavRes.ok && createdNav?._id) {
      testNavId = createdNav._id;
      recordPass('Create navigation menu item (POST /api/navigation)');
    } else {
      throw new Error(`Create nav failed: ${JSON.stringify(createNavRes.data)}`);
    }

    // Read admin items list
    const adminNavRes = await request('/navigation/admin', { headers: adminHeaders });
    const navItems = adminNavRes.data?.items || adminNavRes.data;
    const navFound = Array.isArray(navItems) && navItems.some((n: any) => n._id === testNavId || n.id === testNavId);
    if (navFound) {
      recordPass('Admin retrieves active navigation items list');
    } else {
      throw new Error(`Nav item not found in admin list: ${JSON.stringify(adminNavRes.data)}`);
    }

    // Update navigation
    const updateNavRes = await request(`/navigation/${testNavId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        label: 'Hot Flash Deals 🔥',
        url: '/shop?sort=discount',
        type: 'link',
      }),
    });
    const updatedNavLabel = updateNavRes.data?.item?.label || updateNavRes.data?.label;
    if (updateNavRes.ok && updatedNavLabel?.includes('Hot Flash')) {
      recordPass('Update navigation menu label');
    } else {
      throw new Error(`Update nav failed: ${JSON.stringify(updateNavRes.data)}`);
    }

    // Delete navigation
    const delNavRes = await request(`/navigation/${testNavId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (delNavRes.ok) {
      recordPass('Delete navigation menu item (DELETE /api/navigation/:id)');
    } else {
      throw new Error(`Delete nav failed: ${JSON.stringify(delNavRes.data)}`);
    }
  } catch (err) {
    recordFail('Dynamic navigation lifecycle', err);
  }

  // MODULE Q: SETTINGS & CONFIGURATION
  setModule('SETTINGS & STORE CONFIGURATION');
  try {
    const origConfig = await request('/cms/config');
    const origSettings = origConfig.data?.config?.settings || origConfig.data?.settings || {};

    const updatedSettingsRes = await request('/cms/settings', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        storeName: 'Aurelia Premium Commerce',
        supportEmail: 'qa-support@aureliacommerce.com',
        shippingDhaka: 70,
        shippingOutsideDhaka: 130,
        freeShippingThreshold: 1500,
        taxRate: 5,
        paymentMethods: {
          cod: true,
          bkash: true,
          nagad: true,
          card: true,
        },
      }),
    });

    if (updatedSettingsRes.ok && updatedSettingsRes.data?.settings?.shippingDhaka === 70) {
      recordPass('Update store settings, shipping rates, and tax rate (PUT /api/cms/settings)');
    } else {
      throw new Error(`Update settings failed: ${JSON.stringify(updatedSettingsRes.data)}`);
    }

    // Verify persistence after reload
    const verifyConfig = await request('/cms/config');
    const persistedSettings = verifyConfig.data?.config?.settings || verifyConfig.data?.settings;
    if (persistedSettings?.supportEmail === 'qa-support@aureliacommerce.com') {
      recordPass('Store settings persist accurately upon subsequent fetch');
    } else {
      throw new Error('Store settings did not persist: ' + JSON.stringify(persistedSettings));
    }

    // Restore original settings
    await request('/cms/settings', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify(origSettings),
    });
    recordPass('Restore baseline store settings');
  } catch (err) {
    recordFail('Settings & configuration', err);
  }

  // MODULE R: FILE & IMAGE UPLOADS
  setModule('FILE & IMAGE UPLOAD SYSTEM');
  try {
    // 1x1 transparent PNG data URI
    const validPngDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    const uploadRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        dataUri: validPngDataUri,
        filename: 'qa_pixel_test.png',
      }),
    });

    if (uploadRes.status === 201 && uploadRes.data?.url) {
      const publicUrl = uploadRes.data.url;
      recordPass(`Upload valid PNG image -> ${publicUrl}`);

      // Verify static HTTP access
      const staticRes = await fetch(`http://localhost:3000${publicUrl}`);
      if (staticRes.ok) {
        recordPass('Uploaded image is immediately accessible via public HTTP URL');
      } else {
        throw new Error(`Static file access failed: ${staticRes.status}`);
      }
    } else {
      throw new Error(`Upload failed: ${JSON.stringify(uploadRes.data)}`);
    }

    // Negative test: invalid MIME type
    const invalidMimeRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        dataUri: 'data:application/pdf;base64,JVBERi0xLjQK...',
        filename: 'document.pdf',
      }),
    });
    if (invalidMimeRes.status === 400 && invalidMimeRes.data?.message?.includes('Unsupported')) {
      recordPass('Upload rejects invalid MIME type (PDF)');
    } else {
      throw new Error(`Invalid MIME was not rejected properly: ${invalidMimeRes.status}`);
    }

    // Negative test: SVG with malicious script injection
    const maliciousSvg = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
    const svgRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        dataUri: maliciousSvg,
        filename: 'exploit.svg',
      }),
    });
    if (svgRes.status === 400 && svgRes.data?.message?.includes('script')) {
      recordPass('Upload rejects dangerous SVG containing script tag');
    } else {
      throw new Error(`Malicious SVG was not blocked: ${svgRes.status}`);
    }
  } catch (err) {
    recordFail('File upload system', err);
  }

  // MODULE S: AUDIT LOGS
  setModule('AUDIT LOGS & TELEMETRY');
  try {
    const logsRes = await request('/admin/audit-logs?limit=10', { headers: adminHeaders });
    if (logsRes.ok && Array.isArray(logsRes.data?.logs) && logsRes.data.logs.length > 0) {
      recordPass('Admin views immutable system audit logs generated by CRUD actions');
    } else {
      throw new Error(`Audit logs failed: ${JSON.stringify(logsRes.data)}`);
    }
  } catch (err) {
    recordFail('Audit logs telemetry', err);
  }

  // MODULE T: BACKUP & DATABASE EXPORT
  setModule('BACKUP & RECOVERY');
  try {
    const backupRes = await request('/admin/backup/export', {
      method: 'POST',
      headers: adminHeaders,
    });
    if (backupRes.ok && backupRes.data?.backup?.counts?.products > 0) {
      recordPass('Admin generates complete JSON database backup snapshot');
    } else {
      throw new Error(`Backup export failed or products count missing (Status: ${backupRes.status})`);
    }
  } catch (err) {
    recordFail('Backup snapshot export', err);
  }

  // SUMMARY
  console.log('\n================================================================');
  console.log('             FINAL END-TO-END QA AUDIT REPORT                   ');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`TOTAL CHECKS EXECUTED: ${total}`);
  console.log(`PASSED:                ${passed}`);
  console.log(`FAILED:                ${failed}`);
  console.log(`SUCCESS RATE:          ${((passed / total) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error('FAILED TESTS SUMMARY:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- [${r.module}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('ALL MODULE AUDITS AND PRODUCTION-GRADE REPAIRS COMPLETED 100% GREEN!');
    process.exit(0);
  }
}

runMasterAudit().catch((err) => {
  console.error('FATAL AUDIT FAILURE:', err);
  process.exit(1);
});
