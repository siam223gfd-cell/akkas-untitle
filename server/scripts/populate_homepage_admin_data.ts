const BASE_URL = 'http://localhost:3000/api';

interface LoginResponse {
  success: boolean;
  token?: string;
  message?: string;
}

async function run() {
  console.log('====================================================');
  console.log('HOMEPAGE CONTENT POPULATION VIA ADMIN REST APIS');
  console.log('====================================================\n');

  // 1. Authenticate as Super Admin
  console.log('1. Authenticating as Super Administrator...');
  const loginRes = await fetch(`${BASE_URL}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'siam@gmail.com', password: 'siam12345!' }),
  });
  const loginData: LoginResponse = (await loginRes.json()) as any;
  if (!loginData.success || !loginData.token) {
    throw new Error(`Admin login failed: ${loginData.message}`);
  }
  const token = loginData.token;
  console.log('   ✓ Super Administrator authenticated successfully.\n');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Fetch existing products to avoid duplicating slugs
  console.log('2. Inspecting existing catalog...');
  const existingProductsRes = await fetch(`${BASE_URL}/products?limit=200`);
  const existingProductsData: any = await existingProductsRes.json();
  const existingSlugs = new Set((existingProductsData.products || []).map((p: any) => p.slug));
  console.log(`   Found ${existingSlugs.size} existing products.\n`);

  // 3. New premium products to populate underrepresented & 0-count categories
  const newProducts = [
    // --- Beauty & Care ---
    {
      name: 'Dyson Supersonic Nural Intelligent Hair Dryer',
      subtitle: 'Smart Nural sensor mode protects scalp health and enhances natural shine',
      slug: 'dyson-supersonic-nural-hair-dryer',
      sku: 'DY-SN-NURL-01',
      description:
        'The Dyson Supersonic Nural intelligent hair dryer automatically adjusts heat to protect scalp health and enhance natural shine. Engineered with fast intelligent drying, scalp protect mode, and five intelligent styling attachments.',
      category: 'Beauty & Care',
      subcategory: 'Hair Care',
      brand: 'Dyson',
      basePrice: 64999,
      salePrice: 58999,
      stock: 14,
      images: [
        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'TOP SELLER ✨',
      warranty: '2 Years International Manufacturer Warranty',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: true,
      isTopSelling: true,
      isNewArrival: false,
      isBestRated: true,
      status: 'active' as const,
      highlights: [
        { label: 'Airflow Speed', value: '41L/s' },
        { label: 'Technology', value: 'Scalp Protect Sensor' },
        { label: 'Motor', value: 'V9 Digital Motor' },
      ],
      specificationsTable: [
        { label: 'Power', value: '1600 Watts', group: 'Technical' },
        { label: 'Weight', value: '680g', group: 'Dimensions' },
        { label: 'Cable Length', value: '2.8m', group: 'Technical' },
      ],
    },
    {
      name: 'CeraVe Complete Hydrating Skincare Routine Trio',
      subtitle: 'Gentle Cleanser (236ml), Daily Moisturizing Lotion (236ml) & Moisturizing Cream (177ml)',
      slug: 'cerave-hydrating-skincare-trio',
      sku: 'CV-HYD-TRIO-01',
      description:
        'Developed with dermatologists, the CeraVe Hydrating Routine Trio contains three essential ceramides to cleanse, hydrate, and restore the skin barrier. Non-comedogenic and fragrance-free for normal to dry sensitive skin.',
      category: 'Beauty & Care',
      subcategory: 'Skincare',
      brand: 'CeraVe',
      basePrice: 5500,
      salePrice: 4850,
      stock: 45,
      images: [
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1608248597359-54845582f327?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'DERM RECOMMENDED',
      warranty: '100% Authentic Import Guarantee',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: true,
      isTopSelling: true,
      isNewArrival: true,
      isBestRated: true,
      status: 'active' as const,
    },
    {
      name: 'Foreo Luna 4 Smart Facial Cleansing & Firming Massager',
      subtitle: 'T-Sonic pulsations with ultra-hygienic silicone touchpoints',
      slug: 'foreo-luna-4-smart-facial-cleanser',
      sku: 'FO-LN4-FIRM-01',
      description:
        'The Foreo Luna 4 combines ultra-soft silicone touchpoints with 16 adjustable T-Sonic pulsation intensities to remove 99% of dirt, oil, and makeup residue while offering targeted firming massage routines.',
      category: 'Beauty & Care',
      subcategory: 'Beauty Tech',
      brand: 'Foreo',
      basePrice: 28000,
      salePrice: 24500,
      stock: 18,
      images: [
        'https://images.unsplash.com/photo-1512290900672-1f02e6425110?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'SWEDISH DESIGN',
      warranty: '2 Years Brand Warranty',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: false,
      isTopSelling: false,
      isNewArrival: true,
      isBestRated: true,
      status: 'active' as const,
    },

    // --- Health & Wellness ---
    {
      name: 'Omron Platinum Upper Arm Blood Pressure Monitor',
      subtitle: 'Bluetooth Smart Sync with dual display & irregular heartbeat detector',
      slug: 'omron-platinum-bluetooth-blood-pressure-monitor',
      sku: 'OM-BP-PLAT-01',
      description:
        'The Omron Platinum Bluetooth blood pressure monitor stores up to 200 readings for two users with dual LCD display for comparing current and previous readings. Clinically validated accuracy with Omron Connect app integration.',
      category: 'Health & Wellness',
      subcategory: 'Medical Monitoring',
      brand: 'Omron',
      basePrice: 10500,
      salePrice: 8999,
      stock: 28,
      images: [
        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'CLINICALLY VALIDATED',
      warranty: '5 Years Official Brand Warranty',
      deliveryEstimate: '1-2 Days in Dhaka, 3 Days Nationwide',
      isFeatured: true,
      isTopSelling: true,
      isNewArrival: false,
      isBestRated: true,
      status: 'active' as const,
    },
    {
      name: 'Theragun Pro Plus Deep Tissue Percussive Massager',
      subtitle: 'Multi-therapy recovery with near-infrared LED light, vibration, and heat',
      slug: 'theragun-pro-plus-deep-tissue-massager',
      sku: 'TG-PRO-PLUS-01',
      description:
        'The ultimate recovery device: Theragun Pro Plus combines percussive massage with near-infrared LED light therapy, heat, vibration, and built-in biometric sensor to enhance mobility, relieve chronic tension, and accelerate muscle healing.',
      category: 'Health & Wellness',
      subcategory: 'Muscle Recovery',
      brand: 'Therabody',
      basePrice: 59999,
      salePrice: 54999,
      stock: 12,
      images: [
        'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'PRO ATHLETE CHOICE',
      warranty: '2 Years Official Warranty',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: true,
      isTopSelling: false,
      isNewArrival: true,
      isBestRated: true,
      status: 'active' as const,
    },
    {
      name: 'Oral-B iO Series 9 Electric Toothbrush with AI Tracking',
      subtitle: 'Revolutionary magnetic drive with 3D teeth tracking & interactive color display',
      slug: 'oral-b-io-series-9-electric-toothbrush',
      sku: 'OB-IO9-WHT-01',
      description:
        'The Oral-B iO Series 9 combines powerful micro-vibrating bristles with Oral-B dentist-inspired round brush head powered by a smooth magnetic drive. AI 3D tracking monitors front, top, and back surfaces for the purest clean.',
      category: 'Health & Wellness',
      subcategory: 'Oral Care',
      brand: 'Oral-B',
      basePrice: 32000,
      salePrice: 28999,
      stock: 22,
      images: [
        'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'AI GUIDANCE',
      warranty: '2 Years Manufacturer Warranty',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: false,
      isTopSelling: true,
      isNewArrival: false,
      isBestRated: true,
      status: 'active' as const,
    },

    // --- Toys & Games ---
    {
      name: 'LEGO Icons NASA Artemis Space Launch System (3601 Pcs)',
      subtitle: 'Authentic collector scale replica of the Artemis I rocket with mobile launcher',
      slug: 'lego-icons-nasa-artemis-space-launch-system',
      sku: 'LG-ART-NASA-01',
      description:
        'Embark on a creative mission with the 3,601-piece LEGO Icons NASA Artemis Space Launch System set. Featuring a multi-stage rocket with 2 solid-fuel boosters, detailed mobile launch tower, and Orion spacecraft model.',
      category: 'Toys & Games',
      subcategory: 'Collector Sets',
      brand: 'LEGO',
      basePrice: 38000,
      salePrice: 34999,
      stock: 10,
      images: [
        'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'COLLECTOR EDITION',
      warranty: '100% Genuine LEGO Factory Sealed',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: true,
      isTopSelling: true,
      isNewArrival: true,
      isBestRated: true,
      status: 'active' as const,
    },
    {
      name: 'Sony PlayStation 5 DualSense Wireless Controller (Midnight Black)',
      subtitle: 'Immersive haptic feedback, adaptive triggers, and built-in microphone',
      slug: 'sony-ps5-dualsense-wireless-controller-midnight-black',
      sku: 'PS5-DS-BLK-01',
      description:
        'Experience gaming realism with the official Sony PS5 DualSense wireless controller. Features dynamic adaptive triggers, immersive haptic feedback, built-in mic, and ergonomic grips in sleek Midnight Black.',
      category: 'Toys & Games',
      subcategory: 'Console Gaming',
      brand: 'Sony',
      basePrice: 9200,
      salePrice: 8499,
      stock: 35,
      images: [
        'https://images.unsplash.com/photo-1606318801954-d46846592883?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'OFFICIAL SONY',
      warranty: '1 Year Brand Warranty',
      deliveryEstimate: '1-2 Days in Dhaka, 3 Days Nationwide',
      isFeatured: true,
      isTopSelling: true,
      isNewArrival: false,
      isBestRated: true,
      status: 'active' as const,
    },
    {
      name: 'Nintendo Switch OLED Model Mario Red Edition',
      subtitle: 'Vibrant 7-inch OLED screen, wide adjustable stand, and 64GB internal storage',
      slug: 'nintendo-switch-oled-mario-red-edition',
      sku: 'NT-SW-OLED-MR-01',
      description:
        'Play anytime, anywhere with the vibrant 7-inch OLED screen of the Nintendo Switch OLED Model in signature Mario Red. Includes enhanced audio, 64GB storage, wired LAN dock, and Joy-Con controllers.',
      category: 'Toys & Games',
      subcategory: 'Consoles',
      brand: 'Nintendo',
      basePrice: 43500,
      salePrice: 39999,
      stock: 16,
      images: [
        'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'SPECIAL EDITION',
      warranty: '1 Year Brand Warranty',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: false,
      isTopSelling: true,
      isNewArrival: true,
      isBestRated: true,
      status: 'active' as const,
    },

    // --- Garden & Outdoor ---
    {
      name: 'Bosch Aquatak 125 Compact High-Pressure Washer',
      subtitle: '125 bar pressure, 360L/h water flow with 3-in-1 nozzle for patios and cars',
      slug: 'bosch-aquatak-125-pressure-washer',
      sku: 'BSH-AQ125-01',
      description:
        'The Bosch UniversalAquatak 125 high-pressure washer delivers fast, flexible, and effortless cleaning for vehicles, driveways, garden furniture, and walls with its quick-connect 3-in-1 fan, rotary, and point jet nozzle.',
      category: 'Garden & Outdoor',
      subcategory: 'Outdoor Cleaning',
      brand: 'Bosch',
      basePrice: 21000,
      salePrice: 18500,
      stock: 20,
      images: [
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'GERMAN ENGINEERING',
      warranty: '1 Year Bosch Warranty',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: true,
      isTopSelling: false,
      isNewArrival: true,
      isBestRated: true,
      status: 'active' as const,
    },
    {
      name: 'YETI Tundra 45 High-Performance Insulated Hard Cooler',
      subtitle: 'Rotomolded construction with PermaFrost insulation for multi-day ice retention',
      slug: 'yeti-tundra-45-hard-cooler',
      sku: 'YT-TD45-TAN-01',
      description:
        'The legendary YETI Tundra 45 combines versatility with durability. Holds up to 28 cans with recommended 2:1 ice-to-contents ratio. Indestructible rotomolded construction with certified bear-resistant locks.',
      category: 'Garden & Outdoor',
      subcategory: 'Camping & Adventure',
      brand: 'YETI',
      basePrice: 42000,
      salePrice: 38500,
      stock: 14,
      images: [
        'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'HEAVY DUTY',
      warranty: '5 Years Manufacturer Warranty',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: false,
      isTopSelling: true,
      isNewArrival: false,
      isBestRated: true,
      status: 'active' as const,
    },
    {
      name: 'Anker SOLIX C1000 1056Wh Portable Power Station',
      subtitle: '1800W AC output with HyperFlash ultra-fast 58-minute recharge',
      slug: 'anker-solix-c1000-portable-power-station',
      sku: 'AK-SOL-C1000-01',
      description:
        'Power 99% of appliances outdoors and during load shedding with the Anker SOLIX C1000. Features durable LFP batteries lasting over 3,000 cycles, 1800W pure sine wave output, and smart app control.',
      category: 'Garden & Outdoor',
      subcategory: 'Power & Camping',
      brand: 'Anker',
      basePrice: 108000,
      salePrice: 98000,
      stock: 9,
      images: [
        'https://images.unsplash.com/photo-1590393284050-2f3b9c7b94ad?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'FLAGSHIP POWER',
      warranty: '5 Years Official Warranty',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: true,
      isTopSelling: true,
      isNewArrival: true,
      isBestRated: true,
      status: 'active' as const,
    },

    // --- Kitchen & Dining ---
    {
      name: 'Ninja Foodi DualZone 6-in-1 8-Quart Air Fryer',
      subtitle: 'Two independent baskets with Smart Finish to cook 2 foods in 2 ways at once',
      slug: 'ninja-foodi-dualzone-8-quart-air-fryer',
      sku: 'NJ-FD-DZ8Q-01',
      description:
        'The Ninja Foodi DualZone 2-basket air fryer lets you cook mains and sides simultaneously. Features 6 customizable cooking functions: Air Fry, Air Broil, Roast, Bake, Reheat, and Dehydrate with up to 75% less fat.',
      category: 'Kitchen & Dining',
      subcategory: 'Small Appliances',
      brand: 'Ninja',
      basePrice: 25999,
      salePrice: 22500,
      stock: 24,
      images: [
        'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'TOP CHEF CHOICE',
      warranty: '1 Year Brand Warranty',
      deliveryEstimate: '1-2 Days in Dhaka, 3 Days Nationwide',
      isFeatured: true,
      isTopSelling: true,
      isNewArrival: false,
      isBestRated: true,
      status: 'active' as const,
    },
    {
      name: "De'Longhi Magnifica S Compact Espresso Coffee Machine",
      subtitle: 'Integrated silent conical burr grinder with manual cappuccino milk frother',
      slug: 'delonghi-magnifica-s-espresso-machine',
      sku: 'DL-MAG-S-BLK-01',
      description:
        'Brew fresh bean-to-cup espresso and silky lattes at home with the De\'Longhi Magnifica S. Features 15-bar pressure pump, 13 grind settings, twin dispensing spouts, and removable brewing unit for easy maintenance.',
      category: 'Kitchen & Dining',
      subcategory: 'Coffee & Tea',
      brand: "De'Longhi",
      basePrice: 75000,
      salePrice: 68000,
      stock: 11,
      images: [
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'ITALIAN ESPRESSO',
      warranty: '2 Years Brand Warranty',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: true,
      isTopSelling: false,
      isNewArrival: true,
      isBestRated: true,
      status: 'active' as const,
    },
    {
      name: 'Zwilling J.A. Henckels Pro 7-Piece German Knife Block Set',
      subtitle: 'Special formula high carbon no-stain steel with precision forged curved bolster',
      slug: 'zwilling-pro-7-piece-german-knife-block-set',
      sku: 'ZW-PRO7-BLK-01',
      description:
        'Manufactured in Solingen Germany, the Zwilling Pro 7-piece cutlery block set features FRIODUR ice-hardened blades engineered for unmatched cutting edge retention, balance, and kitchen ergonomics.',
      category: 'Kitchen & Dining',
      subcategory: 'Cutlery',
      brand: 'Zwilling',
      basePrice: 41000,
      salePrice: 36500,
      stock: 17,
      images: [
        'https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'SOLINGEN GERMANY',
      warranty: 'Lifetime Manufacturer Warranty',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: false,
      isTopSelling: true,
      isNewArrival: false,
      isBestRated: true,
      status: 'active' as const,
    },

    // --- Home & Living (Supplemental) ---
    {
      name: 'Dyson Purifier Hot+Cool Formaldehyde HP09 Air Purifier',
      subtitle: 'Captures allergens, destroys formaldehyde, and heats or cools the entire room',
      slug: 'dyson-purifier-hot-cool-hp09',
      sku: 'DY-HP09-WGL-01',
      description:
        'The Dyson Purifier Hot+Cool Formaldehyde HP09 continuously detects and destroys formaldehyde while capturing 99.97% of particles as small as 0.3 microns. Real-time air quality tracking on LCD and Dyson app.',
      category: 'Home & Living',
      subcategory: 'Air Treatment',
      brand: 'Dyson',
      basePrice: 96000,
      salePrice: 89999,
      stock: 12,
      images: [
        'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'HEPA H13 CERTIFIED',
      warranty: '2 Years Dyson Warranty',
      deliveryEstimate: '2-3 Working Days Nationwide',
      isFeatured: true,
      isTopSelling: true,
      isNewArrival: true,
      isBestRated: true,
      status: 'active' as const,
    },

    // --- Fashion (Supplemental) ---
    {
      name: 'Ray-Ban Aviator Classic Polarized Sunglasses',
      subtitle: 'Gold metal frame with G-15 green polarized lenses for 100% UV protection',
      slug: 'ray-ban-aviator-classic-polarized',
      sku: 'RB-AV-3025-01',
      description:
        'Originally designed for U.S. aviators in 1937, the Ray-Ban RB3025 Aviator Classic is the iconic teardrop frame that offers timeless styling with crystal green polarized lenses that block 99% of reflected glare.',
      category: 'Fashion',
      subcategory: 'Eyewear',
      brand: 'Ray-Ban',
      basePrice: 18500,
      salePrice: 16500,
      stock: 30,
      images: [
        'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
      ],
      badge: 'ICONIC EYEWEAR',
      warranty: '2 Years Manufacturer Warranty',
      deliveryEstimate: '1-2 Days in Dhaka, 3 Days Nationwide',
      isFeatured: true,
      isTopSelling: true,
      isNewArrival: false,
      isBestRated: true,
      status: 'active' as const,
    },
  ];

  console.log(`3. Creating ${newProducts.length} new products across all 12 categories...`);
  let createdCount = 0;
  for (const prod of newProducts) {
    if (existingSlugs.has(prod.slug)) {
      console.log(`   - Skipping existing slug: ${prod.slug}`);
      continue;
    }
    const createRes = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(prod),
    });
    const createData: any = await createRes.json();
    if (createData.success) {
      createdCount++;
      console.log(`   ✓ Created [${prod.category}]: ${prod.name} (৳${prod.salePrice})`);
    } else {
      console.error(`   ✗ Failed to create ${prod.name}:`, createData);
    }
  }
  console.log(`\n   Summary: ${createdCount} new products successfully added to database.\n`);

  // 4. Update CMS Configuration: Enable and populate Promotional Placement Section
  console.log('4. Configuring CMS Promotional Placement Section...');
  const cmsUpdateRes = await fetch(`${BASE_URL}/cms/config`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      promotionalPlacement: {
        isEnabled: true,
        title: 'Curated Flagship Tech & Luxury Lifestyle',
        subtitle: 'Official brand warranties, 2-3 days nationwide delivery across Bangladesh, and 0% EMI financing.',
        imageUrl: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1600&q=85',
        destinationUrl: '/shop?sort=discount',
        ctaText: 'Explore Hot Deals',
      },
    }),
  });
  const cmsUpdateData: any = await cmsUpdateRes.json();
  if (cmsUpdateData.success) {
    console.log('   ✓ CMS Promotional Placement enabled and saved to database.\n');
  } else {
    console.error('   ✗ Failed to update CMS config:', cmsUpdateData);
  }

  // 5. Update/Ensure Hero Slider Slides
  console.log('5. Verifying Hero Slider Slides...');
  const heroRes = await fetch(`${BASE_URL}/hero-slides/public`);
  const heroData: any = await heroRes.json();
  console.log(`   Currently ${heroData.slides?.length || 0} active slides in hero carousel.`);
  heroData.slides?.forEach((s: any, idx: number) => {
    console.log(`   Slide ${idx + 1}: "${s.title}" -> Destination: ${s.link || s.destinationUrl || '(Non-clickable)'}`);
  });
  console.log('');

  // 6. Verification of Category Counts
  console.log('6. Verifying Updated Category Live Counts...');
  const catRes = await fetch(`${BASE_URL}/categories`);
  const catData: any = await catRes.json();
  console.log(`   Total Categories: ${catData.categories?.length || 0}`);
  catData.categories?.forEach((c: any) => {
    console.log(`   - ${c.name} (slug: ${c.slug}): ${c.liveCount ?? c.itemCount ?? 0} active products`);
  });
  console.log('');

  // 7. Verification of Trending & Featured Products on Homepage
  console.log('7. Verifying Homepage Product Feeds...');
  const trendingRes = await fetch(`${BASE_URL}/products/trending`);
  const trendingData: any = await trendingRes.json();
  console.log(`   - Top Selling: ${trendingData.data?.topSelling?.length || 0} products`);
  console.log(`   - New Arrivals: ${trendingData.data?.newArrivals?.length || 0} products`);
  console.log(`   - Best Rated: ${trendingData.data?.bestRated?.length || 0} products`);

  const featuredRes = await fetch(`${BASE_URL}/products?limit=14&sort=popular`);
  const featuredData: any = await featuredRes.json();
  console.log(`   - Featured Catalog: ${featuredData.products?.length || 0} products returned for homepage grid.`);

  console.log('\n====================================================');
  console.log('HOMEPAGE POPULATION COMPLETE & VERIFIED');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('Population script failed:', err);
  process.exit(1);
});
