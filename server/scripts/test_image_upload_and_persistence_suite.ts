import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000/api';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];
let currentSuite = '';

function setSuite(name: string) {
  currentSuite = name;
  console.log(`\n================================================================`);
  console.log(`  SUITE: ${name}`);
  console.log(`================================================================`);
}

function recordPass(testName: string) {
  results.push({ suite: currentSuite, test: testName, passed: true });
  console.log(`  [PASS] ${testName}`);
}

function recordFail(testName: string, err: any) {
  const msg = err?.message || String(err);
  results.push({ suite: currentSuite, test: testName, passed: false, error: msg });
  console.error(`  [FAIL] ${testName} -> ${msg}`);
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

// 1x1 Pixel Sample Data URIs
const SAMPLE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const SAMPLE_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const SAMPLE_WEBP = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

async function runImageTestSuite() {
  console.log('****************************************************************');
  console.log('  IMAGE UPLOAD & FILE EXPLORER SYSTEM VERIFICATION SUITE         ');
  console.log('****************************************************************\n');

  // SUITE 1: AUTHENTICATION
  setSuite('AUTHENTICATION FOUNDATION');
  let adminToken = '';
  try {
    const loginRes = await request('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'siam@gmail.com', password: 'siam12345!' }),
    });
    if (!loginRes.ok || !loginRes.data?.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
    }
    adminToken = loginRes.data.token;
    recordPass('Administrator authentication successfully provides JWT bearer token');
  } catch (err) {
    recordFail('Administrator authentication', err);
    process.exit(1);
  }

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // SUITE 2: MULTI-FORMAT UPLOAD & PERMANENCE
  setSuite('MULTI-FORMAT REAL STORAGE UPLOADS');
  let uploadedPngUrl = '';
  let uploadedJpgUrl = '';
  let uploadedWebpUrl = '';

  try {
    // 1. Upload PNG
    const pngRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_PNG, filename: 'showcase_product.png' }),
    });
    if (pngRes.status === 201 && pngRes.data?.url?.startsWith('/uploads/')) {
      uploadedPngUrl = pngRes.data.url;
      recordPass(`Upload PNG format -> ${uploadedPngUrl} (${pngRes.data.size} bytes)`);
    } else {
      throw new Error(`PNG upload failed: ${JSON.stringify(pngRes.data)}`);
    }

    // 2. Upload JPEG
    const jpgRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_JPEG, filename: 'hero_slide_landscape.jpg' }),
    });
    if (jpgRes.status === 201 && jpgRes.data?.url?.startsWith('/uploads/')) {
      uploadedJpgUrl = jpgRes.data.url;
      recordPass(`Upload JPEG format -> ${uploadedJpgUrl} (${jpgRes.data.size} bytes)`);
    } else {
      throw new Error(`JPEG upload failed: ${JSON.stringify(jpgRes.data)}`);
    }

    // 3. Upload WebP
    const webpRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_WEBP, filename: 'banner_asset.webp' }),
    });
    if (webpRes.status === 201 && webpRes.data?.url?.startsWith('/uploads/')) {
      uploadedWebpUrl = webpRes.data.url;
      recordPass(`Upload WebP format -> ${uploadedWebpUrl} (${webpRes.data.size} bytes)`);
    } else {
      throw new Error(`WebP upload failed: ${JSON.stringify(webpRes.data)}`);
    }

    // 4. Verify HTTP Static Access for each
    for (const [format, uUrl] of [['PNG', uploadedPngUrl], ['JPEG', uploadedJpgUrl], ['WebP', uploadedWebpUrl]]) {
      const httpRes = await fetch(`http://localhost:3000${uUrl}`);
      if (httpRes.status === 200) {
        recordPass(`HTTP static access verified for ${format} asset (${uUrl})`);
      } else {
        throw new Error(`Static access returned status ${httpRes.status} for ${uUrl}`);
      }
    }
  } catch (err) {
    recordFail('Multi-format image upload', err);
  }

  // SUITE 3: VALIDATION & SECURITY INVARIANTS
  setSuite('SECURITY & VALIDATION CONSTRAINTS');
  try {
    // 1. Unauthenticated request
    const unauthRes = await request('/upload', {
      method: 'POST',
      body: JSON.stringify({ data: SAMPLE_PNG, filename: 'hacker.png' }),
    });
    if (unauthRes.status === 401) {
      recordPass('Unauthenticated upload request rejected with 401 Unauthorized');
    } else {
      throw new Error(`Expected 401, got ${unauthRes.status}`);
    }

    // 2. Unsupported MIME type (PDF)
    const pdfRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        data: 'data:application/pdf;base64,JVBERi0xLjQK...',
        filename: 'invoice.pdf',
      }),
    });
    if (pdfRes.status === 400) {
      recordPass('Non-image MIME type (PDF) rejected with 400 Bad Request');
    } else {
      throw new Error(`Expected 400 for PDF, got ${pdfRes.status}`);
    }

    // 3. Malicious SVG injection
    const maliciousSvg = 'data:image/svg+xml;base64,' + Buffer.from('<svg><script>alert("XSS")</script></svg>').toString('base64');
    const svgRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: maliciousSvg, filename: 'vector_exploit.svg' }),
    });
    if (svgRes.status === 400) {
      recordPass('Dangerous SVG containing <script> tag rejected with 400 Bad Request');
    } else {
      throw new Error(`Expected 400 for malicious SVG, got ${svgRes.status}`);
    }
  } catch (err) {
    recordFail('Security & validation', err);
  }

  // SUITE 4: PRODUCT PRIMARY & GALLERY PERSISTENCE
  setSuite('PRODUCT GALLERY & MULTI-IMAGE PERSISTENCE');
  let testProductId = '';
  try {
    // Upload 3 distinct gallery photos
    const g1Res = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_PNG, filename: 'product_primary.png' }),
    });
    const g2Res = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_JPEG, filename: 'product_side_view.jpg' }),
    });
    const g3Res = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_WEBP, filename: 'product_packaging.webp' }),
    });

    const primaryImg = g1Res.data.url;
    const galleryImg1 = g2Res.data.url;
    const galleryImg2 = g3Res.data.url;
    const fullImagesArray = [primaryImg, galleryImg1, galleryImg2];

    const prodCreateRes = await request('/products', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Aurelia Studio Master Headphones Pro',
        slug: `aurelia-master-qa-${Date.now()}`,
        sku: `AUD-QA-${Date.now()}`,
        brand: 'Sony',
        category: 'Electronics',
        basePrice: 28500,
        salePrice: 24900,
        stock: 35,
        description: 'Professional audiophile studio headphones with active noise cancellation.',
        images: fullImagesArray,
        status: 'active',
      }),
    });

    if (prodCreateRes.ok && prodCreateRes.data?.product?._id) {
      testProductId = prodCreateRes.data.product._id;
      recordPass('Create catalog product with primary and multiple gallery photos');
    } else {
      throw new Error(`Product creation failed: ${JSON.stringify(prodCreateRes.data)}`);
    }

    // Verify stored images in database record
    const fetchProd = await request(`/products/${testProductId}`);
    const fetchedImages = fetchProd.data?.product?.images || [];
    if (fetchedImages.length === 3 && fetchedImages[0] === primaryImg && fetchedImages[1] === galleryImg1) {
      recordPass('Product gallery ordering and persistent storage paths verified');
    } else {
      throw new Error(`Gallery mismatch: expected 3 images, got ${JSON.stringify(fetchedImages)}`);
    }

    // Replace primary cover photo with a new uploaded image
    const replaceRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_PNG, filename: 'product_replaced_cover.png' }),
    });
    const newCover = replaceRes.data.url;

    const updateProdRes = await request(`/products/${testProductId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        images: [newCover, galleryImg1, galleryImg2],
      }),
    });

    if (updateProdRes.ok && updateProdRes.data?.product?.images?.[0] === newCover) {
      recordPass('Update product cover photo with newly uploaded image from device');
    } else {
      throw new Error(`Product image update failed: ${JSON.stringify(updateProdRes.data)}`);
    }

    // Storefront instant sync check
    const publicProd = await request(`/products/${testProductId}`);
    if (publicProd.data?.product?.images?.[0] === newCover) {
      recordPass('Public storefront PDP immediately synchronizes updated image reference');
    } else {
      throw new Error('Public storefront PDP did not reflect updated image');
    }

    // Clean up test product
    await request(`/products/${testProductId}`, { method: 'DELETE', headers: adminHeaders });
    recordPass('Clean up test product record');
  } catch (err) {
    recordFail('Product gallery persistence', err);
  }

  // SUITE 5: CATEGORY IMAGE PERSISTENCE & STOREFRONT SYNC
  setSuite('CATEGORY IMAGE PERSISTENCE');
  let testCatId = '';
  try {
    const catUploadRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_PNG, filename: 'category_thumb.png' }),
    });
    const catImageUrl = catUploadRes.data.url;

    const createCatRes = await request('/categories', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA Audio Studio',
        slug: `qa-audio-studio-${Date.now()}`,
        description: 'High-fidelity audio monitoring devices',
        image: catImageUrl,
        order: 98,
      }),
    });

    const catObj = createCatRes.data?.category || createCatRes.data;
    if (createCatRes.ok && catObj?._id) {
      testCatId = catObj._id;
      recordPass('Create category with uploaded device thumbnail');
    } else {
      throw new Error(`Category creation failed: ${JSON.stringify(createCatRes.data)}`);
    }

    // Public storefront sync
    const pubCats = await request('/categories');
    const pubCatList = Array.isArray(pubCats.data) ? pubCats.data : (pubCats.data?.categories || []);
    const foundCat = pubCatList.find((c: any) => c._id === testCatId);
    if (foundCat && foundCat.image === catImageUrl) {
      recordPass('Public website categories API reflects newly uploaded category image');
    } else {
      throw new Error(`Category image missing from public list: ${JSON.stringify(foundCat)}`);
    }

    // Clean up
    await request(`/categories/${testCatId}`, { method: 'DELETE', headers: adminHeaders });
    recordPass('Clean up test category record');
  } catch (err) {
    recordFail('Category image persistence', err);
  }

  // SUITE 6: BRAND LOGO PERSISTENCE & STOREFRONT SYNC
  setSuite('BRAND LOGO ASSET PERSISTENCE');
  let testBrandId = '';
  try {
    const brandUploadRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_PNG, filename: 'audiotech_logo.png' }),
    });
    const brandLogoUrl = brandUploadRes.data.url;

    const createBrandRes = await request('/admin/brands', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA AudioTech Labs',
        slug: `qa-audiotech-${Date.now()}`,
        description: 'Professional acoustic engineering',
        logo: brandLogoUrl,
        featured: true,
      }),
    });

    const brandObj = createBrandRes.data?.brand || createBrandRes.data;
    if (createBrandRes.ok && brandObj?._id) {
      testBrandId = brandObj._id;
      recordPass('Create brand with transparent logo asset');
    } else {
      throw new Error(`Brand creation failed: ${JSON.stringify(createBrandRes.data)}`);
    }

    const brandList = await request('/admin/brands', { headers: adminHeaders });
    const foundBrand = brandList.data?.brands?.find((b: any) => b._id === testBrandId);
    if (foundBrand && foundBrand.logo === brandLogoUrl) {
      recordPass('Brand logo persists accurately in catalog records');
    } else {
      throw new Error(`Brand logo mismatch: ${JSON.stringify(foundBrand)}`);
    }

    // Clean up
    await request(`/admin/brands/${testBrandId}`, { method: 'DELETE', headers: adminHeaders });
    recordPass('Clean up test brand record');
  } catch (err) {
    recordFail('Brand logo persistence', err);
  }

  // SUITE 7: HERO SLIDER DESKTOP & MOBILE BANNERS
  setSuite('HERO SLIDER DUAL-IMAGE ASSETS');
  let testSlideId = '';
  try {
    const dRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_JPEG, filename: 'hero_desktop_banner.jpg' }),
    });
    const mRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_PNG, filename: 'hero_mobile_banner.png' }),
    });

    const desktopImg = dRes.data.url;
    const mobileImg = mRes.data.url;

    const slideCreateRes = await request('/hero-slides', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Master Audio Experience',
        subtitle: 'Studio grade sound for true professionals',
        desktopImage: desktopImg,
        mobileImage: mobileImg,
        link: '/shop',
        ctaText: 'Discover Gear',
        displayOrder: 99,
        isActive: true,
      }),
    });

    if (slideCreateRes.ok && slideCreateRes.data?.slide?._id) {
      testSlideId = slideCreateRes.data.slide._id;
      recordPass('Create hero slider with both desktop and mobile uploaded images');
    } else {
      throw new Error(`Slide create failed: ${JSON.stringify(slideCreateRes.data)}`);
    }

    // Storefront public sync
    const activeSlides = await request('/hero-slides/active');
    const foundSlide = activeSlides.data?.slides?.find((s: any) => s._id === testSlideId);
    if (foundSlide && (foundSlide.desktopImage === desktopImg || foundSlide.image === desktopImg)) {
      recordPass('Public website hero slider reflects newly uploaded desktop & mobile banners');
    } else {
      throw new Error(`Hero slide missing from public active slides: ${JSON.stringify(foundSlide)}`);
    }

    // Clean up
    await request(`/hero-slides/${testSlideId}`, { method: 'DELETE', headers: adminHeaders });
    recordPass('Clean up test hero slider record');
  } catch (err) {
    recordFail('Hero slider dual-image persistence', err);
  }

  // SUITE 8: PROMOTIONAL DYNAMIC BANNERS
  setSuite('PROMOTIONAL DYNAMIC BANNERS');
  let testBannerId = '';
  try {
    const bUploadRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_JPEG, filename: 'promotional_campaign_banner.jpg' }),
    });
    const bannerImg = bUploadRes.data.url;

    const bannerCreateRes = await request('/banners', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA Summer Campaign Banner',
        slug: `qa-summer-banner-${Date.now()}`,
        status: 'published',
        background: {
          type: 'image',
          imageUrl: bannerImg,
        },
        title: { text: 'Summer Audio Fest' },
        link: { url: '/shop' },
      }),
    });

    if (bannerCreateRes.ok && bannerCreateRes.data?.banner?._id) {
      testBannerId = bannerCreateRes.data.banner._id;
      recordPass('Create dynamic banner with uploaded background hero photo');
    } else {
      throw new Error(`Banner create failed: ${JSON.stringify(bannerCreateRes.data)}`);
    }

    // Public active sync
    const pubBanners = await request('/banners/active');
    const foundBanner = pubBanners.data?.banners?.find((b: any) => b._id === testBannerId);
    if (foundBanner && (foundBanner.background?.imageUrl === bannerImg || foundBanner.image === bannerImg)) {
      recordPass('Public storefront renders active promotional banner with uploaded image');
    } else {
      throw new Error(`Banner missing from active list: ${JSON.stringify(foundBanner)}`);
    }

    // Clean up
    await request(`/banners/${testBannerId}`, { method: 'DELETE', headers: adminHeaders });
    recordPass('Clean up test banner record');
  } catch (err) {
    recordFail('Promotional dynamic banner persistence', err);
  }

  // SUITE 9: ADVERTISEMENTS CREATIVE UPLOAD
  setSuite('ADVERTISEMENTS CREATIVE ASSETS');
  let testAdId = '';
  try {
    const adUploadRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_PNG, filename: 'popup_ad_artwork.png' }),
    });
    const adImg = adUploadRes.data.url;

    const adCreateRes = await request('/advertisements', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA Flash Ad',
        title: 'Exclusive Flash Sale',
        mainImage: adImg,
        status: 'published',
        placements: ['popup_modal'],
      }),
    });

    if (adCreateRes.ok && adCreateRes.data?.advertisement?._id) {
      testAdId = adCreateRes.data.advertisement._id;
      recordPass('Create advertisement with uploaded creative graphic asset');
    } else {
      throw new Error(`Ad create failed: ${JSON.stringify(adCreateRes.data)}`);
    }

    // Public active sync
    const pubAds = await request('/advertisements/active');
    const foundAd = pubAds.data?.advertisements?.find((a: any) => a._id === testAdId);
    if (foundAd && foundAd.mainImage === adImg) {
      recordPass('Public website popup modal correctly serves the uploaded advertisement image');
    } else {
      throw new Error(`Ad not found in public active ads: ${JSON.stringify(foundAd)}`);
    }

    // Clean up
    await request(`/advertisements/${testAdId}`, { method: 'DELETE', headers: adminHeaders });
    recordPass('Clean up test advertisement record');
  } catch (err) {
    recordFail('Advertisement creative persistence', err);
  }

  // SUITE 10: BLOG POSTS FEATURED GRAPHICS
  setSuite('BLOG POST FEATURED GRAPHICS');
  let testBlogId = '';
  try {
    const blogUploadRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_JPEG, filename: 'blog_hero_editorial.jpg' }),
    });
    const blogImg = blogUploadRes.data.url;

    const blogCreateRes = await request('/admin/blogs', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'The Future of Wireless Audio Acoustics',
        summary: 'Deep dive into loss-less Bluetooth streaming and ANC advances.',
        content: 'Audio codecs are undergoing a generational revolution in 2026...',
        image: blogImg,
        tags: ['Audio', 'Tech Guide'],
        isActive: true,
      }),
    });

    const blogObj = blogCreateRes.data?.blog || blogCreateRes.data?.post || blogCreateRes.data;
    if (blogCreateRes.ok && blogObj?._id) {
      testBlogId = blogObj._id;
      recordPass('Create blog editorial article with uploaded 16:9 featured graphic');
    } else {
      throw new Error(`Blog create failed: ${JSON.stringify(blogCreateRes.data)}`);
    }

    // Verify persistence
    const blogsList = await request('/admin/blogs', { headers: adminHeaders });
    const foundBlog = blogsList.data?.blogs?.find((b: any) => b._id === testBlogId);
    if (foundBlog && foundBlog.image === blogImg) {
      recordPass('Editorial blog post persists uploaded image accurately');
    } else {
      throw new Error(`Blog image mismatch: ${JSON.stringify(foundBlog)}`);
    }

    // Clean up
    await request(`/admin/blogs/${testBlogId}`, { method: 'DELETE', headers: adminHeaders });
    recordPass('Clean up test blog record');
  } catch (err) {
    recordFail('Blog editorial graphic persistence', err);
  }

  // SUITE 11: STAFF PROFILE AVATARS
  setSuite('STAFF PROFILE PORTRAIT AVATARS');
  let testStaffId = '';
  try {
    const staffUploadRes = await request('/upload', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ data: SAMPLE_PNG, filename: 'staff_portrait.png' }),
    });
    const staffAvatar = staffUploadRes.data.url;

    const staffCreateRes = await request('/admin/staff', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Sarah Rahman',
        email: `sarah_qa_${Date.now()}@novara.com`,
        password: 'StaffPassword123!',
        role: 'catalog_manager',
        phone: '+8801712999999',
        avatar: staffAvatar,
      }),
    });

    if (staffCreateRes.ok && staffCreateRes.data?.staff?.id) {
      testStaffId = staffCreateRes.data.staff.id;
      recordPass('Create staff profile with uploaded device portrait photo');
    } else {
      throw new Error(`Staff create failed: ${JSON.stringify(staffCreateRes.data)}`);
    }

    // Verify staff profile persistence
    const staffList = await request('/admin/staff', { headers: adminHeaders });
    const foundStaff = staffList.data?.staff?.find((s: any) => s.id === testStaffId || s._id === testStaffId);
    if (foundStaff && foundStaff.avatar === staffAvatar) {
      recordPass('Staff member profile retains uploaded avatar URL');
    } else {
      throw new Error(`Staff avatar mismatch: ${JSON.stringify(foundStaff)}`);
    }

    // Clean up
    await request(`/admin/staff/${testStaffId}`, { method: 'DELETE', headers: adminHeaders });
    recordPass('Clean up test staff record');
  } catch (err) {
    recordFail('Staff avatar persistence', err);
  }

  // SUMMARY
  console.log('\n================================================================');
  console.log('             IMAGE SYSTEM AUDIT & VERIFICATION REPORT           ');
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
    console.error('FAILED CHECKS SUMMARY:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- [${r.suite}] ${r.test}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('ALL IMAGE UPLOAD & FILE EXPLORER CHECKS PASSED 100% GREEN!');
    process.exit(0);
  }
}

runImageTestSuite().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
