/**
 * COMMON GROUND — PostgreSQL Database Seed Script (Stage 09 & Section 4)
 *
 * Seeds all 20 relational tables with:
 * - Roles (`admin`, `barista`, `customer`)
 * - Staff & Admin accounts (hashed with scrypt; configurable via env or defaults for local dev)
 * - The 5 Menu Categories and all 18 EGP Products specified in Section 4
 * - Configurable Customization Groups & Options (Size, Temperature, Milk, Sugar, Add-ons/Syrups/Toppings)
 * - Inventory tracking (including low-stock alerts)
 * - Coupons / Discounts (`WELCOME10`, `MORNING15`, `COFFEEONUS`, etc.)
 * - Customers & Initial Live/Completed Orders (`#1050` down to `#1041`) matching Figma 07–10
 */

const db = require("./index");
const { runMigrations } = require("./migrate");
const { hashPassword } = require("../utils/crypto");

const SEED_CATEGORIES = [
  {
    slug: "coffee",
    name: "Coffee",
    description: "Specialty espresso & single-origin filter brews roasted in small batches.",
    displayOrder: 1,
  },
  {
    slug: "non-coffee",
    name: "Non-Coffee",
    description: "Ceremonial Uji matcha and 70% single-origin dark chocolate drinks.",
    displayOrder: 2,
  },
  {
    slug: "iced-drinks",
    name: "Iced Drinks",
    description: "Chilled espresso, cold-whisked matcha, and signature iced lattes.",
    displayOrder: 3,
  },
  {
    slug: "bakery",
    name: "Desserts & Bakery",
    description: "Laminated croissants, brownies, and Basque cheesecake baked fresh each morning.",
    displayOrder: 4,
  },
  {
    slug: "food",
    name: "Food & Sandwiches",
    description: "Toasted artisan sourdough sandwiches and savoury filled croissants.",
    displayOrder: 5,
  },
];

// All 18 EGP Catalog Products from Section 4
const SEED_PRODUCTS = [
  // 1. Coffee (5 items)
  {
    sku: "COF-001",
    slug: "spanish-latte",
    categorySlug: "coffee",
    name: "Spanish Latte",
    badge: "BESTSELLER",
    shortDescription: "Rich double espresso with silky textured & condensed milk",
    menuDescription: "Smooth, balanced & lightly sweet",
    detailDescription:
      "Our signature double espresso combined with velvety steamed milk and a gentle swirl of sweet condensed milk. Smooth, balanced, and a little irresistible.",
    originNote: "House blend • Brazil + Colombia • Chocolate, caramel",
    allergenNote: "Contains dairy unless substituted with oat or almond milk.",
    priceEgp: 95,
    image: "assets/images/product-iced-oat-latte.png",
    isCustomizable: true,
    isFeatured: true,
    featuredOrder: 1,
    stock: 48,
    trackStock: false,
  },
  {
    sku: "COF-002",
    slug: "caramel-latte",
    categorySlug: "coffee",
    name: "Caramel Latte",
    badge: null,
    shortDescription: "Double espresso, small-batch burnt caramel & steamed milk",
    menuDescription: "House caramel, velvety steamed milk",
    detailDescription:
      "Rich house espresso layered with our house-cooked burnt sugar caramel sauce and silky micro-foamed milk.",
    originNote: "House blend • Brazil + Colombia • Caramel, roasted almond",
    allergenNote: "Contains dairy. Prepared in a kitchen that handles tree nuts.",
    priceEgp: 105,
    image: "assets/images/product-flat-white.png",
    isCustomizable: true,
    isFeatured: false,
    featuredOrder: null,
    stock: 40,
    trackStock: false,
  },
  {
    sku: "COF-003",
    slug: "americano",
    categorySlug: "coffee",
    name: "Americano",
    badge: "SINGLE ORIGIN",
    shortDescription: "Single origin. Beautifully simple.",
    menuDescription: "Ethiopia · peach, bergamot",
    detailDescription:
      "Clean, aromatic double espresso pulled over filtered hot water highlighting floral bergamot aroma and sweet stone-fruit clarity.",
    originNote: "Single origin • Yirgacheffe, Ethiopia • Peach, bergamot",
    allergenNote: "Dairy-free by default. Prepared in a kitchen that handles nuts and dairy.",
    priceEgp: 70,
    image: "assets/images/product-batch-brew.png",
    isCustomizable: true,
    isFeatured: true,
    featuredOrder: 3,
    stock: 60,
    trackStock: false,
  },
  {
    sku: "COF-004",
    slug: "cappuccino",
    categorySlug: "coffee",
    name: "Cappuccino",
    badge: null,
    shortDescription: "Classic airy micro-foam with a bold double espresso core",
    menuDescription: "Equal parts espresso, steamed milk & foam",
    detailDescription:
      "Traditional neighborhood cappuccino crafted with a double shot of house blend and dense, glossy micro-foam.",
    originNote: "House blend • Brazil + Colombia • Dark cocoa, hazelnut",
    allergenNote: "Contains dairy unless substituted with plant-based milk.",
    priceEgp: 85,
    image: "assets/images/product-flat-white.png",
    isCustomizable: true,
    isFeatured: false,
    featuredOrder: null,
    stock: 50,
    trackStock: false,
  },
  {
    sku: "COF-005",
    slug: "flat-white",
    categorySlug: "coffee",
    name: "Flat White",
    badge: "HOUSE FAVORITE",
    shortDescription: "Velvety milk. A bold little classic.",
    menuDescription: "Double espresso, velvety milk",
    detailDescription:
      "Twin ristretto shots of our house blend topped with thin, glossy micro-foamed milk for an intensely smooth coffee-forward cup.",
    originNote: "House blend • Brazil + Colombia • Chocolate, caramel",
    allergenNote: "Contains dairy unless substituted with oat or almond milk.",
    priceEgp: 90,
    image: "assets/images/product-flat-white.png",
    isCustomizable: true,
    isFeatured: true,
    featuredOrder: 2,
    stock: 50,
    trackStock: false,
  },

  // 2. Non-Coffee (3 items)
  {
    sku: "TEA-001",
    slug: "iced-matcha",
    categorySlug: "non-coffee",
    name: "Iced Matcha",
    badge: "CEREMONIAL",
    shortDescription: "First-harvest Uji matcha hand-whisked over ice & milk",
    menuDescription: "Ceremonial Uji matcha, creamy milk",
    detailDescription:
      "Vibrant stone-milled Uji green tea whisked to order with warm water and poured over crystal ice and your choice of milk.",
    originNote: "First harvest • Uji, Kyoto • Umami, sweet grass",
    allergenNote: "Contains dairy unless ordered with oat or almond milk.",
    priceEgp: 110,
    image: "assets/images/product-iced-oat-latte.png",
    isCustomizable: true,
    isFeatured: false,
    featuredOrder: null,
    stock: 35,
    trackStock: false,
  },
  {
    sku: "TEA-002",
    slug: "iced-chocolate",
    categorySlug: "non-coffee",
    name: "Iced Chocolate",
    badge: null,
    shortDescription: "70% single-origin dark chocolate ganache over cold milk",
    menuDescription: "Rich dark cocoa, chilled milk, ice",
    detailDescription:
      "House-melted 70% dark couverture chocolate ganache blended with cold milk and served over ice.",
    originNote: "70% Single-origin cacao • Rich dark chocolate",
    allergenNote: "Contains dairy and soy lecithin.",
    priceEgp: 95,
    image: "assets/images/product-iced-oat-latte.png",
    isCustomizable: true,
    isFeatured: false,
    featuredOrder: null,
    stock: 40,
    trackStock: false,
  },
  {
    sku: "TEA-003",
    slug: "hot-chocolate",
    categorySlug: "non-coffee",
    name: "Hot Chocolate",
    badge: null,
    shortDescription: "Steamed milk folded into 70% dark chocolate ganache",
    menuDescription: "70% cocoa ganache, velvety micro-foam",
    detailDescription:
      "Warm, comforting 70% dark chocolate steamed with whole or oat milk and finished with velvety cocoa foam.",
    originNote: "70% Single-origin cacao • Toasted marshmallow notes",
    allergenNote: "Contains dairy unless substituted with plant milk.",
    priceEgp: 85,
    image: "assets/images/product-flat-white.png",
    isCustomizable: true,
    isFeatured: false,
    featuredOrder: null,
    stock: 40,
    trackStock: false,
  },

  // 3. Desserts & Bakery (4 items)
  {
    sku: "BAK-001",
    slug: "chocolate-brownie",
    categorySlug: "bakery",
    name: "Chocolate Brownie",
    badge: null,
    shortDescription: "Fudgy dark couverture chocolate square with flaky sea salt",
    menuDescription: "70% dark chocolate, sea salt flake",
    detailDescription:
      "Crinkly-topped, dense fudgy brownie baked daily with 70% dark couverture chocolate and finished with Maldon sea salt.",
    originNote: "Baked in-house every morning",
    allergenNote: "Contains wheat, eggs, dairy, and soy.",
    priceEgp: 75,
    image: "assets/images/product-almond-croissant.png",
    isCustomizable: false,
    isFeatured: false,
    featuredOrder: null,
    stock: 18,
    trackStock: true,
  },
  {
    sku: "BAK-002",
    slug: "butter-croissant",
    categorySlug: "bakery",
    name: "Butter Croissant",
    badge: "FRESHLY BAKED",
    shortDescription: "Baked daily. Gone by afternoon.",
    menuDescription: "Buttery layers, golden honeycomb crumb",
    detailDescription:
      "Three-day laminated French-butter pastry baked every morning until deeply golden and flaky.",
    originNote: "Cultured butter • 27 laminated layers • Baked at 6:00 am",
    allergenNote: "Contains wheat, eggs, and dairy.",
    priceEgp: 65,
    image: "assets/images/product-almond-croissant.png",
    isCustomizable: false,
    isFeatured: true,
    featuredOrder: 4,
    stock: 6,
    trackStock: true,
  },
  {
    sku: "BAK-003",
    slug: "cheesecake",
    categorySlug: "bakery",
    name: "Cheesecake",
    badge: null,
    shortDescription: "Creamy Basque-style slice with caramelized top",
    menuDescription: "Baked daily · vanilla bean & cream",
    detailDescription:
      "Silky, crustless San Sebastián Basque cheesecake with a deeply caramelized exterior and creamy vanilla-bean center.",
    originNote: "House bakery • Madagascar vanilla bean",
    allergenNote: "Contains dairy and eggs.",
    priceEgp: 110,
    image: "assets/images/product-almond-croissant.png",
    isCustomizable: false,
    isFeatured: false,
    featuredOrder: null,
    stock: 12,
    trackStock: true,
  },
  {
    sku: "BAK-004",
    slug: "cinnamon-roll",
    categorySlug: "bakery",
    name: "Cinnamon Roll",
    badge: null,
    shortDescription: "Warm brioche swirl with Ceylon cinnamon & vanilla glaze",
    menuDescription: "Soft brioche, brown butter glaze",
    detailDescription:
      "Pillowy overnight brioche rolled with Ceylon cinnamon and dark muscovado sugar, topped with warm vanilla bean glaze.",
    originNote: "Ceylon cinnamon • Served warm",
    allergenNote: "Contains wheat, eggs, and dairy.",
    priceEgp: 85,
    image: "assets/images/product-almond-croissant.png",
    isCustomizable: false,
    isFeatured: false,
    featuredOrder: null,
    stock: 14,
    trackStock: true,
  },

  // 4. Food & Sandwiches (3 items)
  {
    sku: "FOD-001",
    slug: "chicken-sandwich",
    categorySlug: "food",
    name: "Chicken Sandwich",
    badge: null,
    shortDescription: "Herb-roasted chicken, basil pesto aioli & arugula on sourdough",
    menuDescription: "Toasted country sourdough, basil pesto",
    detailDescription:
      "Sliced herb-roasted chicken breast, house basil pesto aioli, pickled shallots, and wild arugula pressed on country sourdough.",
    originNote: "Prepared fresh to order • Served toasted",
    allergenNote: "Contains wheat, eggs, dairy, and pine nuts.",
    priceEgp: 145,
    image: "assets/images/product-almond-croissant.png",
    isCustomizable: false,
    isFeatured: false,
    featuredOrder: null,
    stock: 15,
    trackStock: true,
  },
  {
    sku: "FOD-002",
    slug: "turkey-croissant",
    categorySlug: "food",
    name: "Turkey Croissant",
    badge: null,
    shortDescription: "Smoked turkey breast, aged gruyère & Dijon mustard in a flaky croissant",
    menuDescription: "Smoked turkey, gruyère, wholegrain Dijon",
    detailDescription:
      "Our house butter croissant split and filled with smoked turkey breast, melted gruyère cheese, and honey-Dijon glaze.",
    originNote: "Warm pressed croissant sandwich",
    allergenNote: "Contains wheat, eggs, dairy, and mustard.",
    priceEgp: 125,
    image: "assets/images/product-almond-croissant.png",
    isCustomizable: false,
    isFeatured: false,
    featuredOrder: null,
    stock: 10,
    trackStock: true,
  },
  {
    sku: "FOD-003",
    slug: "grilled-cheese-sandwich",
    categorySlug: "food",
    name: "Grilled Cheese Sandwich",
    badge: null,
    shortDescription: "Three-cheese blend melted on butter-toasted sourdough",
    menuDescription: "Aged cheddar, gruyère & mozzarella on sourdough",
    detailDescription:
      "Golden pan-toasted sourdough filled with sharp cheddar, nutty gruyère, and mozzarella with a hint of garlic herb butter.",
    originNote: "Country sourdough • Melted to order",
    allergenNote: "Contains wheat and dairy.",
    priceEgp: 115,
    image: "assets/images/product-almond-croissant.png",
    isCustomizable: false,
    isFeatured: false,
    featuredOrder: null,
    stock: 20,
    trackStock: true,
  },

  // 5. Iced Drinks (3 items)
  {
    sku: "ICE-001",
    slug: "iced-spanish-latte",
    categorySlug: "iced-drinks",
    name: "Iced Spanish Latte",
    badge: "POPULAR",
    shortDescription: "Smooth espresso, chilled milk & sweet condensed cream over ice",
    menuDescription: "Over ice · smooth, balanced & refreshing",
    detailDescription:
      "Our signature double espresso poured over crystal ice, cold milk, and sweet condensed cream.",
    originNote: "House blend • Brazil + Colombia • Chocolate, caramel",
    allergenNote: "Contains dairy unless customized with oat or almond milk.",
    priceEgp: 100,
    image: "assets/images/product-iced-oat-latte.png",
    isCustomizable: true,
    isFeatured: false,
    featuredOrder: null,
    stock: 50,
    trackStock: false,
  },
  {
    sku: "ICE-002",
    slug: "iced-americano",
    categorySlug: "iced-drinks",
    name: "Iced Americano",
    badge: null,
    shortDescription: "Crisp double espresso poured over filtered ice water",
    menuDescription: "Refreshing, bright & zero dairy",
    detailDescription:
      "A clean, refreshing double shot of house espresso pulled over chilled filtered water and ice.",
    originNote: "House blend • Brazil + Colombia",
    allergenNote: "Dairy-free.",
    priceEgp: 75,
    image: "assets/images/product-iced-oat-latte.png",
    isCustomizable: true,
    isFeatured: false,
    featuredOrder: null,
    stock: 60,
    trackStock: false,
  },
  {
    sku: "ICE-003",
    slug: "iced-caramel-macchiato",
    categorySlug: "iced-drinks",
    name: "Iced Caramel Macchiato",
    badge: null,
    shortDescription: "Layered cold milk, vanilla, double espresso & house caramel drizzle",
    menuDescription: "Layered espresso, vanilla, burnt caramel",
    detailDescription:
      "Chilled milk infused with Madagascar vanilla, marked with freshly pulled double espresso and finished with house caramel crosshatch.",
    originNote: "House blend • Brazil + Colombia • Vanilla & burnt sugar",
    allergenNote: "Contains dairy unless substituted with oat or almond milk.",
    priceEgp: 115,
    image: "assets/images/product-iced-oat-latte.png",
    isCustomizable: true,
    isFeatured: false,
    featuredOrder: null,
    stock: 45,
    trackStock: false,
  },
];

const SEED_CUSTOMIZATION_GROUPS = [
  {
    slug: "size",
    name: "Size",
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    displayOrder: 1,
    options: [
      { slug: "12oz", name: "12 oz", shortLabel: "12 oz", priceDeltaEgp: 0, isDefault: true, order: 1 },
      { slug: "16oz", name: "16 oz", shortLabel: "16 oz", priceDeltaEgp: 15, isDefault: false, order: 2 },
    ],
  },
  {
    slug: "temperature",
    name: "Temperature",
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    displayOrder: 2,
    options: [
      { slug: "hot", name: "Hot", shortLabel: "Hot", priceDeltaEgp: 0, isDefault: true, order: 1 },
      { slug: "iced", name: "Iced", shortLabel: "Iced", priceDeltaEgp: 0, isDefault: false, order: 2 },
    ],
  },
  {
    slug: "milk",
    name: "Milk",
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    displayOrder: 3,
    options: [
      { slug: "whole", name: "Whole milk", shortLabel: "Whole", priceDeltaEgp: 0, isDefault: true, order: 1 },
      { slug: "oat", name: "Oat milk", shortLabel: "Oat", priceDeltaEgp: 20, isDefault: false, order: 2 },
      { slug: "almond", name: "Almond milk", shortLabel: "Almond", priceDeltaEgp: 20, isDefault: false, order: 3 },
    ],
  },
  {
    slug: "sugar",
    name: "Sugar level",
    isRequired: false,
    minSelections: 0,
    maxSelections: 1,
    displayOrder: 4,
    options: [
      { slug: "regular-sugar", name: "Regular sugar", shortLabel: "Regular", priceDeltaEgp: 0, isDefault: true, order: 1 },
      { slug: "less-sugar", name: "Less sugar (50%)", shortLabel: "Less sugar", priceDeltaEgp: 0, isDefault: false, order: 2 },
      { slug: "no-sugar", name: "No added sugar", shortLabel: "Unsweetened", priceDeltaEgp: 0, isDefault: false, order: 3 },
    ],
  },
  {
    slug: "addons",
    name: "Make it yours",
    isRequired: false,
    minSelections: 0,
    maxSelections: 5,
    displayOrder: 5,
    options: [
      { slug: "extra-shot", name: "Extra espresso shot", shortLabel: "+1 Shot", priceDeltaEgp: 25, isDefault: false, order: 1 },
      { slug: "decaf", name: "Decaf espresso", shortLabel: "Decaf", priceDeltaEgp: 0, isDefault: false, order: 2 },
      { slug: "vanilla-syrup", name: "Vanilla bean syrup", shortLabel: "Vanilla", priceDeltaEgp: 15, isDefault: false, order: 3 },
      { slug: "caramel-syrup", name: "House caramel syrup", shortLabel: "Caramel", priceDeltaEgp: 15, isDefault: false, order: 4 },
      { slug: "whipped-cream", name: "Whipped cream topping", shortLabel: "Whip", priceDeltaEgp: 15, isDefault: false, order: 5 },
    ],
  },
];

const SEED_COUPONS = [
  {
    code: "WELCOME10",
    description: "10% off first orders",
    discountType: "percentage",
    discountValue: 10,
    minOrderEgp: 80,
    maxDiscountEgp: 50,
    usageLimit: 500,
    usedCount: 86,
    status: "Active",
    startsAt: "Nov 1, 2026",
    endsAt: "Dec 31, 2026",
    firstTimeOnly: true,
  },
  {
    code: "MORNING15",
    description: "15% off · 7–9 am",
    discountType: "percentage",
    discountValue: 15,
    minOrderEgp: 100,
    maxDiscountEgp: 60,
    usageLimit: 250,
    usedCount: 54,
    status: "Active",
    startsAt: "Nov 1, 2026",
    endsAt: "Nov 30, 2026",
    firstTimeOnly: false,
  },
  {
    code: "COFFEEONUS",
    description: "30 EGP off orders over 150 EGP",
    discountType: "fixed",
    discountValue: 30,
    minOrderEgp: 150,
    maxDiscountEgp: 30,
    usageLimit: 200,
    usedCount: 44,
    status: "Active",
    startsAt: "Nov 1, 2026",
    endsAt: "Dec 15, 2026",
    firstTimeOnly: false,
  },
  {
    code: "WEEKEND20",
    description: "20% off weekend coffee orders",
    discountType: "percentage",
    discountValue: 20,
    minOrderEgp: 120,
    maxDiscountEgp: 75,
    usageLimit: 100,
    usedCount: 0,
    status: "Scheduled",
    startsAt: "Nov 28, 2026",
    endsAt: "Nov 29, 2026",
    firstTimeOnly: false,
  },
  {
    code: "FALLFAVORITE",
    description: "10% off seasonal drinks",
    discountType: "percentage",
    discountValue: 10,
    minOrderEgp: 80,
    maxDiscountEgp: 40,
    usageLimit: 200,
    usedCount: 120,
    status: "Expired",
    startsAt: "Oct 1, 2026",
    endsAt: "Oct 31, 2026",
    firstTimeOnly: false,
  },
  {
    code: "LOCALLOVE",
    description: "20 EGP off orders over 120 EGP",
    discountType: "fixed",
    discountValue: 20,
    minOrderEgp: 120,
    maxDiscountEgp: 20,
    usageLimit: 150,
    usedCount: 12,
    status: "Paused",
    startsAt: "Nov 1, 2026",
    endsAt: "Dec 31, 2026",
    firstTimeOnly: false,
  },
];

const SEED_CUSTOMERS = [
  { name: "Alex Johnson", email: "alex.johnson@example.com", phone: "+20 100 555 0142", orders: 24, spentEgp: 2428, points: 120, usual: "Spanish Latte · 12 oz · Oat milk", pairing: "Butter Croissant", segment: "Regulars" },
  { name: "Mia Chen", email: "mia.chen@example.com", phone: "+20 101 555 0192", orders: 18, spentEgp: 1792, points: 80, usual: "Americano · 12 oz · Black", pairing: "Chocolate Brownie", segment: "Regulars" },
  { name: "James Wilson", email: "james.w@example.com", phone: "+20 102 555 0114", orders: 9, spentEgp: 957, points: 45, usual: "Flat White · 12 oz", pairing: "Cinnamon Roll", segment: "Regulars" },
  { name: "Sara Lee", email: "sara.lee@example.com", phone: "+20 106 555 0177", orders: 31, spentEgp: 3184, points: 160, usual: "Iced Spanish Latte · Oat milk", pairing: "Cheesecake", segment: "Regulars" },
  { name: "Ben Carter", email: "ben.c@example.com", phone: "+20 109 555 0133", orders: 12, spentEgp: 1425, points: 60, usual: "Flat White × 3", pairing: "Turkey Croissant", segment: "Regulars" },
  { name: "Emma Davis", email: "emma.d@example.com", phone: "+20 111 555 0168", orders: 21, spentEgp: 2056, points: 105, usual: "Americano · 12 oz", pairing: "Butter Croissant", segment: "Regulars" },
  { name: "Oliver Smith", email: "oliver.s@example.com", phone: "+20 112 555 0181", orders: 4, spentEgp: 422, points: 20, usual: "Cappuccino · 12 oz", pairing: "Chocolate Brownie", segment: "New this month" },
  { name: "Isla Brown", email: "isla.b@example.com", phone: "+20 115 555 0159", orders: 16, spentEgp: 1724, points: 75, usual: "Iced Matcha · Oat milk", pairing: "Butter Croissant", segment: "At risk" },
];

async function seedDatabase() {
  await runMigrations();

  // Check if already seeded
  const existingProducts = await db.query("SELECT COUNT(*)::int AS cnt FROM products");
  if (existingProducts.rows[0].cnt > 0) {
    return;
  }

  const adminPass = process.env.ADMIN_SEED_PASSWORD || "CommonGroundAdmin2026!";
  const baristaPass = process.env.BARISTA_SEED_PASSWORD || "CommonGroundBarista2026!";
  const customerPass = "CommonGroundCustomer2026!";

  await db.withTransaction(async (tx) => {
    // 1. Roles
    const adminRoleRes = await tx.query(
      "INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id",
      ["admin", "Store Owner / Manager with full administrative privileges"]
    );
    const baristaRoleRes = await tx.query(
      "INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id",
      ["barista", "Café Barista managing live incoming orders"]
    );
    const customerRoleRes = await tx.query(
      "INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id",
      ["customer", "Registered Regulars Club customer"]
    );

    const adminRoleId = adminRoleRes.rows[0].id;
    const baristaRoleId = baristaRoleRes.rows[0].id;
    const customerRoleId = customerRoleRes.rows[0].id;

    // 2. Users & Staff
    const adminUserRes = await tx.query(
      `INSERT INTO users (role_id, email, password_hash, full_name, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        adminRoleId,
        process.env.ADMIN_SEED_EMAIL || "sam.rivera@commonground.coffee",
        hashPassword(adminPass),
        "Sam Rivera",
        "+20 100 555 0100",
      ]
    );
    const baristaUserRes = await tx.query(
      `INSERT INTO users (role_id, email, password_hash, full_name, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        baristaRoleId,
        process.env.BARISTA_SEED_EMAIL || "jamie@commonground.coffee",
        hashPassword(baristaPass),
        "Jamie",
        "+20 100 555 0101",
      ]
    );
    const secondBaristaUserRes = await tx.query(
      `INSERT INTO users (role_id, email, password_hash, full_name, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        baristaRoleId,
        "nour.hassan@commonground.coffee",
        hashPassword(baristaPass),
        "Nour Hassan",
        "+20 100 555 0102",
      ]
    );
    const customerUserRes = await tx.query(
      `INSERT INTO users (role_id, email, password_hash, full_name, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        customerRoleId,
        "alex.johnson@example.com",
        hashPassword(customerPass),
        "Alex Johnson",
        "+20 100 555 0142",
      ]
    );

    await tx.query(
      `INSERT INTO staff (user_id, employee_code, title, station, shift_label, is_on_shift)
       VALUES ($1, 'EMP-001', 'Store Manager', 'Management & QC', 'Full Day (7am–5pm)', TRUE)`,
      [adminUserRes.rows[0].id]
    );
    const jamieStaffRes = await tx.query(
      `INSERT INTO staff (user_id, employee_code, title, station, shift_label, is_on_shift)
       VALUES ($1, 'EMP-002', 'Lead Barista', 'Espresso Bar 1', 'Morning Shift (7am–3pm)', TRUE)
       RETURNING id`,
      [baristaUserRes.rows[0].id]
    );
    await tx.query(
      `INSERT INTO staff (user_id, employee_code, title, station, shift_label, is_on_shift)
       VALUES ($1, 'EMP-003', 'Barista', 'Cold Bar & Bakery', 'Morning Shift (7am–3pm)', TRUE)`,
      [secondBaristaUserRes.rows[0].id]
    );

    // 3. Café Settings
    await tx.query(
      `INSERT INTO cafe_settings (
        store_name, branch_name, address_line, phone, email, currency_code,
        is_accepting_orders, pickup_enabled, standard_prep_minutes, pickup_buffer_minutes,
        max_active_orders, delivery_enabled, delivery_radius_km, delivery_fee_piastres,
        delivery_fee_egp, delivery_min_order_egp
      ) VALUES (
        'Common Ground', 'Maple Street', '42 Maple Street, Zamalek, Cairo', '+20 100 555 0142',
        'hello@commonground.coffee', 'EGP', TRUE, TRUE, 10, 5, 12, TRUE, 5.00, 2500, 25.00, 100.00
      )`
    );

    // 4. Categories
    const categoryIdBySlug = {};
    for (const cat of SEED_CATEGORIES) {
      const res = await tx.query(
        `INSERT INTO categories (slug, name, description, display_order, is_active)
         VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
        [cat.slug, cat.name, cat.description, cat.displayOrder]
      );
      categoryIdBySlug[cat.slug] = res.rows[0].id;
    }

    // 5. Customization Groups & Options
    const groupIdBySlug = {};
    const optionBySlug = {};
    for (const grp of SEED_CUSTOMIZATION_GROUPS) {
      const gRes = await tx.query(
        `INSERT INTO customization_groups (slug, name, is_required, min_selections, max_selections, display_order)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [grp.slug, grp.name, grp.isRequired, grp.minSelections, grp.maxSelections, grp.displayOrder]
      );
      const groupId = gRes.rows[0].id;
      groupIdBySlug[grp.slug] = groupId;

      for (const opt of grp.options) {
        const deltaPiastres = Math.round(opt.priceDeltaEgp * 100);
        const oRes = await tx.query(
          `INSERT INTO customization_options (
            group_id, slug, name, short_label, price_delta_piastres, price_delta_egp, is_default, is_available, display_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8) RETURNING id`,
          [groupId, opt.slug, opt.name, opt.shortLabel, deltaPiastres, opt.priceDeltaEgp, opt.isDefault, opt.order]
        );
        optionBySlug[opt.slug] = {
          id: oRes.rows[0].id,
          groupName: grp.name,
          name: opt.name,
          priceDeltaEgp: opt.priceDeltaEgp,
          priceDeltaPiastres: deltaPiastres,
        };
      }
    }

    // 6. Products, Images, Variants, Assignments & Inventory
    const productBySlug = {};
    for (const prod of SEED_PRODUCTS) {
      const catId = categoryIdBySlug[prod.categorySlug];
      const basePiastres = Math.round(prod.priceEgp * 100);

      const pRes = await tx.query(
        `INSERT INTO products (
          sku, slug, category_id, name, badge, short_description, menu_description,
          detail_description, origin_note, allergen_note, base_price_piastres, base_price_egp,
          is_available, is_customizable, is_featured, featured_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, $13, $14, $15)
        RETURNING id`,
        [
          prod.sku,
          prod.slug,
          catId,
          prod.name,
          prod.badge,
          prod.shortDescription,
          prod.menuDescription,
          prod.detailDescription,
          prod.originNote,
          prod.allergenNote,
          basePiastres,
          prod.priceEgp,
          prod.isCustomizable,
          prod.isFeatured,
          prod.featuredOrder,
        ]
      );
      const productId = pRes.rows[0].id;
      productBySlug[prod.slug] = {
        id: productId,
        ...prod,
        basePiastres,
      };

      await tx.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, display_order)
         VALUES ($1, $2, $3, TRUE, 1)`,
        [productId, prod.image, prod.name]
      );

      // Variants (12 oz & 16 oz for customizable drinks, Standard for food/bakery)
      if (prod.isCustomizable) {
        await tx.query(
          `INSERT INTO product_variants (product_id, slug, name, price_delta_piastres, price_delta_egp, is_default)
           VALUES ($1, '12oz', '12 oz', 0, 0.00, TRUE),
                  ($1, '16oz', '16 oz', 1500, 15.00, FALSE)`,
          [productId]
        );

        let assignOrder = 1;
        for (const grpSlug of ["size", "temperature", "milk", "sugar", "addons"]) {
          await tx.query(
            `INSERT INTO product_customization_assignments (product_id, group_id, display_order)
             VALUES ($1, $2, $3)`,
            [productId, groupIdBySlug[grpSlug], assignOrder++]
          );
        }
      } else {
        await tx.query(
          `INSERT INTO product_variants (product_id, slug, name, price_delta_piastres, price_delta_egp, is_default)
           VALUES ($1, 'standard', 'Standard', 0, 0.00, TRUE)`,
          [productId]
        );
      }

      // Inventory
      const invRes = await tx.query(
        `INSERT INTO inventory (product_id, quantity_available, low_stock_threshold, is_tracked)
         VALUES ($1, $2, 8, $3) RETURNING id`,
        [productId, prod.stock, prod.trackStock]
      );

      await tx.query(
        `INSERT INTO inventory_movements (inventory_id, change_amount, reason, created_by_user_id)
         VALUES ($1, $2, 'Initial morning bake & bar stock', $3)`,
        [invRes.rows[0].id, prod.stock, adminUserRes.rows[0].id]
      );
    }

    // 7. Coupons
    for (const c of SEED_COUPONS) {
      await tx.query(
        `INSERT INTO coupons (
          code, description, discount_type, discount_value, min_order_egp, max_discount_egp,
          usage_limit, used_count, status, starts_at, ends_at, first_time_only
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          c.code,
          c.description,
          c.discountType,
          c.discountValue,
          c.minOrderEgp,
          c.maxDiscountEgp,
          c.usageLimit,
          c.usedCount,
          c.status,
          c.startsAt,
          c.endsAt,
          c.firstTimeOnly,
        ]
      );
    }

    // 8. Customers
    const customerIdByName = {};
    for (const cust of SEED_CUSTOMERS) {
      const linkedUserId = cust.email === "alex.johnson@example.com" ? customerUserRes.rows[0].id : null;
      const cRes = await tx.query(
        `INSERT INTO customers (
          user_id, full_name, email, phone, loyalty_points, usual_drink, favorite_pairing,
          orders_count, total_spent_piastres, total_spent_egp, segment, last_visit_label
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Today') RETURNING id`,
        [
          linkedUserId,
          cust.name,
          cust.email,
          cust.phone,
          cust.points,
          cust.usual,
          cust.pairing,
          cust.orders,
          cust.spentEgp * 100,
          cust.spentEgp,
          cust.segment,
        ]
      );
      customerIdByName[cust.name] = cRes.rows[0].id;
    }

    await tx.query(
      `INSERT INTO addresses (customer_id, street_address, city, state_region, postal_code, delivery_notes)
       VALUES ($1, '128 Oak Avenue, Apt 4B', 'Cairo', 'Zamalek', '11511', 'Leave at the door')`,
      [customerIdByName["Alex Johnson"]]
    );

    // 9. Seed Initial Live & Completed Orders (#1041 to #1050 matching Figma 07 & 09)
    const seedOrders = [
      {
        ref: "1050",
        customerName: "Mia Chen",
        phone: "+20 101 555 0192",
        email: "mia.chen@example.com",
        status: "Pending",
        paymentStatus: "Paid",
        paymentMethod: "cash",
        notes: "",
        allergy: false,
        minutesAgo: 1,
        items: [{ slug: "americano", qty: 2, summary: "12 oz · Black" }],
      },
      {
        ref: "1049",
        customerName: "James Wilson",
        phone: "+20 102 555 0114",
        email: "james.w@example.com",
        status: "Pending",
        paymentStatus: "Paid",
        paymentMethod: "cash",
        notes: "",
        allergy: false,
        minutesAgo: 2,
        items: [{ slug: "flat-white", qty: 2, summary: "12 oz · Whole milk" }],
      },
      {
        ref: "1048",
        customerName: "Alex Johnson",
        phone: "+20 100 555 0142",
        email: "alex.johnson@example.com",
        status: "Preparing",
        paymentStatus: "Paid",
        paymentMethod: "card_on_pickup",
        notes: "No straw, please.",
        allergy: false,
        minutesAgo: 6,
        items: [
          { slug: "iced-spanish-latte", qty: 1, summary: "12 oz · Oat milk" },
          { slug: "butter-croissant", qty: 1, summary: "Freshly baked" },
        ],
      },
      {
        ref: "1047",
        customerName: "Sara Lee",
        phone: "+20 106 555 0177",
        email: "sara.lee@example.com",
        status: "Preparing",
        paymentStatus: "Paid",
        paymentMethod: "cash",
        notes: "DAIRY ALLERGY · Use a clean pitcher",
        allergy: true,
        minutesAgo: 8,
        items: [{ slug: "spanish-latte", qty: 1, summary: "12 oz · Oat milk" }],
      },
      {
        ref: "1046",
        customerName: "Ben Carter",
        phone: "+20 109 555 0133",
        email: "ben.c@example.com",
        status: "Ready",
        paymentStatus: "Paid",
        paymentMethod: "cash",
        notes: "",
        allergy: false,
        minutesAgo: 8,
        items: [{ slug: "flat-white", qty: 3, summary: "12 oz · Whole milk" }],
      },
      {
        ref: "1045",
        customerName: "Emma Davis",
        phone: "+20 111 555 0168",
        email: "emma.d@example.com",
        status: "Ready",
        paymentStatus: "Paid",
        paymentMethod: "cash",
        notes: "",
        allergy: false,
        minutesAgo: 9,
        items: [{ slug: "americano", qty: 1, summary: "12 oz · Black" }],
      },
      {
        ref: "1044",
        customerName: "Oliver Smith",
        phone: "+20 112 555 0181",
        email: "oliver.s@example.com",
        status: "Completed",
        paymentStatus: "Paid",
        paymentMethod: "cash",
        notes: "",
        allergy: false,
        minutesAgo: 14,
        items: [
          { slug: "cappuccino", qty: 1, summary: "12 oz · Whole milk" },
          { slug: "chocolate-brownie", qty: 1, summary: "Warmed" },
        ],
      },
      {
        ref: "1043",
        customerName: "Isla Brown",
        phone: "+20 115 555 0159",
        email: "isla.b@example.com",
        status: "Completed",
        paymentStatus: "Paid",
        paymentMethod: "cash",
        notes: "",
        allergy: false,
        minutesAgo: 18,
        items: [
          { slug: "iced-matcha", qty: 1, summary: "12 oz · Oat milk" },
          { slug: "butter-croissant", qty: 1, summary: "Freshly baked" },
        ],
      },
    ];

    for (const ord of seedOrders) {
      let subtotalPiastres = 0;
      const lineItems = ord.items.map((it) => {
        const prod = productBySlug[it.slug];
        const lineTotal = prod.basePiastres * it.qty;
        subtotalPiastres += lineTotal;
        return { prod, qty: it.qty, summary: it.summary, lineTotal };
      });
      const subtotalEgp = Number((subtotalPiastres / 100).toFixed(2));
      const createdAt = new Date(Date.now() - ord.minutesAgo * 60 * 1000).toISOString();

      const oRes = await tx.query(
        `INSERT INTO orders (
          order_reference, customer_id, customer_name, customer_phone, customer_email,
          fulfillment_type, status, payment_status, payment_method,
          subtotal_piastres, subtotal_egp, total_piastres, total_egp,
          special_instructions, allergy_flag, estimated_window, assigned_staff_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'pickup', $6, $7, $8, $9, $10, $9, $10, $11, $12, '10:25–10:30 am', $13, $14)
        RETURNING id`,
        [
          ord.ref,
          customerIdByName[ord.customerName] || null,
          ord.customerName,
          ord.phone,
          ord.email,
          ord.status,
          ord.paymentStatus,
          ord.paymentMethod,
          subtotalPiastres,
          subtotalEgp,
          ord.notes,
          ord.allergy,
          jamieStaffRes.rows[0].id,
          createdAt,
        ]
      );
      const orderId = oRes.rows[0].id;

      for (const li of lineItems) {
        const unitEgp = Number((li.prod.basePiastres / 100).toFixed(2));
        const lineEgp = Number((li.lineTotal / 100).toFixed(2));
        await tx.query(
          `INSERT INTO order_items (
            order_id, product_id, product_slug_snapshot, product_name_snapshot, product_image_snapshot,
            unit_base_price_piastres, unit_base_price_egp, unit_final_price_piastres, unit_final_price_egp,
            quantity, line_total_piastres, line_total_egp, customization_summary
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $7, $8, $9, $10, $11)`,
          [
            orderId,
            li.prod.id,
            li.prod.slug,
            li.prod.name,
            li.prod.image,
            li.prod.basePiastres,
            unitEgp,
            li.qty,
            li.lineTotal,
            lineEgp,
            li.summary,
          ]
        );
      }

      await tx.query(
        `INSERT INTO payments (
          order_id, payment_method, payment_status, amount_piastres, amount_egp, card_brand, card_last4
        ) VALUES ($1, $2, $3, $4, $5, 'Visa', '4242')`,
        [orderId, ord.paymentMethod, ord.paymentStatus, subtotalPiastres, subtotalEgp]
      );
    }
  });
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log("[db:seed] PostgreSQL database seeded successfully with 18 EGP products and sample orders.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[db:seed] Seed failed:", err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
