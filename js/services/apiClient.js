/**
 * COMMON GROUND — Frontend REST API Client with Static/Serverless Resilient Fallback
 *
 * 1. First attempts live `fetch()` against the Express/PostgreSQL backend (`/api/*`).
 * 2. If the deployment environment is a static preview host (e.g. Vercel static/GitHub Pages)
 *    where `/api/*` returns 404 or is unreachable, transparently falls back to a complete
 *    localStorage-persisted EGP data engine supporting Auth, RBAC, Orders, Menu CRUD,
 *    Customers CRM, Coupons, Analytics, and Store Settings.
 */

import { STORAGE_KEYS } from "../config/constants.js";
import { CATEGORIES, CUSTOMIZATION_OPTIONS, PRODUCTS } from "../data/products.js";
import { storageService } from "./storageService.js";

const FALLBACK_KEYS = {
  PRODUCTS: "cg_fallback_products_egp_v2",
  ORDERS: "cg_fallback_orders_egp_v2",
  CUSTOMERS: "cg_fallback_customers_egp_v2",
  COUPONS: "cg_fallback_coupons_egp_v2",
  SETTINGS: "cg_fallback_settings_egp_v2",
  STAFF: "cg_fallback_staff_egp_v2",
};

const INITIAL_ORDERS = [
  {
    id: 1050,
    orderReference: "1050",
    orderNumber: "1050",
    customerName: "Nour El-Din",
    customerPhone: "+20 100 555 0192",
    customerEmail: "nour@example.eg",
    fulfillmentType: "pickup",
    status: "Pending",
    uiStatus: "New",
    stepIndex: 0,
    paymentStatus: "Paid",
    paymentMethod: "card_on_pickup",
    subtotalEgp: 225,
    discountEgp: 0,
    deliveryFeeEgp: 0,
    tipEgp: 20,
    taxEgp: 0,
    totalEgp: 245,
    subtotal: 225,
    total: 245,
    specialInstructions: "OAT MILK ALLERGY NOTE: Strict dairy-free steam wand please",
    allergyFlag: true,
    estimatedWindow: "10–15 min",
    minutesAgo: 2,
    ageLabel: "2 min ago",
    createdAt: new Date(Date.now() - 2 * 60000).toISOString(),
    items: [
      {
        id: 1,
        productId: "spanish-latte",
        name: "Spanish Latte",
        image: "assets/images/product-iced-oat-latte.png",
        unitPrice: 130,
        unitFinalPriceEgp: 130,
        quantity: 1,
        lineTotalEgp: 130,
        customizationSummary: "16 oz · Iced · Oat milk",
      },
      {
        id: 2,
        productId: "chocolate-brownie",
        name: "Chocolate Brownie",
        image: "assets/images/product-almond-croissant.png",
        unitPrice: 75,
        unitFinalPriceEgp: 75,
        quantity: 1,
        lineTotalEgp: 75,
        customizationSummary: "Warmed",
      },
    ],
  },
  {
    id: 1049,
    orderReference: "1049",
    orderNumber: "1049",
    customerName: "Mariam Hassan",
    customerPhone: "+20 101 234 5678",
    customerEmail: "mariam@example.eg",
    fulfillmentType: "delivery",
    deliveryAddress: "14 Brazil St, Zamalek, Cairo",
    status: "Pending",
    uiStatus: "New",
    stepIndex: 0,
    paymentStatus: "Paid",
    paymentMethod: "card_on_pickup",
    subtotalEgp: 215,
    discountEgp: 0,
    deliveryFeeEgp: 25,
    tipEgp: 0,
    taxEgp: 0,
    totalEgp: 240,
    subtotal: 215,
    total: 240,
    specialInstructions: "",
    allergyFlag: false,
    estimatedWindow: "25–35 min",
    minutesAgo: 4,
    ageLabel: "4 min ago",
    createdAt: new Date(Date.now() - 4 * 60000).toISOString(),
    items: [
      {
        id: 3,
        productId: "iced-matcha",
        name: "Iced Matcha",
        image: "assets/images/product-matcha-latte.png",
        unitPrice: 130,
        unitFinalPriceEgp: 130,
        quantity: 1,
        lineTotalEgp: 130,
        customizationSummary: "12 oz · Iced · Oat milk",
      },
      {
        id: 4,
        productId: "cinnamon-roll",
        name: "Cinnamon Roll",
        image: "assets/images/product-almond-croissant.png",
        unitPrice: 85,
        unitFinalPriceEgp: 85,
        quantity: 1,
        lineTotalEgp: 85,
        customizationSummary: "Warmed",
      },
    ],
  },
  {
    id: 1048,
    orderReference: "1048",
    orderNumber: "1048",
    customerName: "Alex Johnson",
    customerPhone: "+20 109 876 5432",
    customerEmail: "alex.johnson@example.com",
    fulfillmentType: "pickup",
    status: "Preparing",
    uiStatus: "Preparing",
    stepIndex: 1,
    paymentStatus: "Paid",
    paymentMethod: "card_on_pickup",
    subtotalEgp: 195,
    discountEgp: 0,
    deliveryFeeEgp: 0,
    tipEgp: 22.6,
    taxEgp: 0,
    totalEgp: 217.6,
    subtotal: 195,
    total: 217.6,
    specialInstructions: "Less ice on the Spanish latte please",
    allergyFlag: false,
    estimatedWindow: "10:25–10:30 am",
    minutesAgo: 6,
    ageLabel: "6 min ago",
    createdAt: new Date(Date.now() - 6 * 60000).toISOString(),
    items: [
      {
        id: 5,
        productId: "spanish-latte",
        name: "Spanish Latte",
        image: "assets/images/product-iced-oat-latte.png",
        unitPrice: 130,
        unitFinalPriceEgp: 130,
        quantity: 1,
        lineTotalEgp: 130,
        customizationSummary: "16 oz · Iced · Oat milk · Regular sugar",
      },
      {
        id: 6,
        productId: "butter-croissant",
        name: "Butter Croissant",
        image: "assets/images/product-almond-croissant.png",
        unitPrice: 65,
        unitFinalPriceEgp: 65,
        quantity: 1,
        lineTotalEgp: 65,
        customizationSummary: "Warmed",
      },
    ],
  },
  {
    id: 1047,
    orderReference: "1047",
    orderNumber: "1047",
    customerName: "Omar Farouk",
    customerPhone: "+20 112 333 4455",
    customerEmail: "omar@example.eg",
    fulfillmentType: "pickup",
    status: "Preparing",
    uiStatus: "Preparing",
    stepIndex: 1,
    paymentStatus: "Paid",
    paymentMethod: "cash",
    subtotalEgp: 235,
    discountEgp: 0,
    deliveryFeeEgp: 0,
    tipEgp: 0,
    taxEgp: 0,
    totalEgp: 235,
    subtotal: 235,
    total: 235,
    specialInstructions: "",
    allergyFlag: false,
    estimatedWindow: "10–15 min",
    minutesAgo: 9,
    ageLabel: "9 min ago",
    createdAt: new Date(Date.now() - 9 * 60000).toISOString(),
    items: [
      {
        id: 7,
        productId: "flat-white",
        name: "Flat White",
        image: "assets/images/product-flat-white.png",
        unitPrice: 90,
        unitFinalPriceEgp: 90,
        quantity: 1,
        lineTotalEgp: 90,
        customizationSummary: "12 oz · Hot · Whole milk",
      },
      {
        id: 8,
        productId: "chicken-sandwich",
        name: "Chicken Sandwich",
        image: "assets/images/product-almond-croissant.png",
        unitPrice: 145,
        unitFinalPriceEgp: 145,
        quantity: 1,
        lineTotalEgp: 145,
        customizationSummary: "Toasted sourdough",
      },
    ],
  },
  {
    id: 1046,
    orderReference: "1046",
    orderNumber: "1046",
    customerName: "Salma Tarek",
    customerPhone: "+20 100 998 8776",
    customerEmail: "salma@example.eg",
    fulfillmentType: "pickup",
    status: "Ready",
    uiStatus: "Ready",
    stepIndex: 2,
    paymentStatus: "Paid",
    paymentMethod: "card_on_pickup",
    subtotalEgp: 180,
    discountEgp: 0,
    deliveryFeeEgp: 0,
    tipEgp: 0,
    taxEgp: 0,
    totalEgp: 180,
    subtotal: 180,
    total: 180,
    specialInstructions: "",
    allergyFlag: false,
    estimatedWindow: "Ready at counter",
    minutesAgo: 11,
    ageLabel: "11 min ago",
    createdAt: new Date(Date.now() - 11 * 60000).toISOString(),
    items: [
      {
        id: 9,
        productId: "caramel-latte",
        name: "Caramel Latte",
        image: "assets/images/product-iced-oat-latte.png",
        unitPrice: 105,
        unitFinalPriceEgp: 105,
        quantity: 1,
        lineTotalEgp: 105,
        customizationSummary: "12 oz · Hot · Whole milk",
      },
      {
        id: 10,
        productId: "iced-americano",
        name: "Iced Americano",
        image: "assets/images/product-batch-brew.png",
        unitPrice: 75,
        unitFinalPriceEgp: 75,
        quantity: 1,
        lineTotalEgp: 75,
        customizationSummary: "12 oz · Iced",
      },
    ],
  },
  {
    id: 1045,
    orderReference: "1045",
    orderNumber: "1045",
    customerName: "Karim Nabil",
    customerPhone: "+20 122 444 5566",
    customerEmail: "karim@example.eg",
    fulfillmentType: "pickup",
    status: "Ready",
    uiStatus: "Ready",
    stepIndex: 2,
    paymentStatus: "Paid",
    paymentMethod: "cash",
    subtotalEgp: 140,
    discountEgp: 0,
    deliveryFeeEgp: 0,
    tipEgp: 0,
    taxEgp: 0,
    totalEgp: 140,
    subtotal: 140,
    total: 140,
    specialInstructions: "",
    allergyFlag: false,
    estimatedWindow: "Ready at counter",
    minutesAgo: 14,
    ageLabel: "14 min ago",
    createdAt: new Date(Date.now() - 14 * 60000).toISOString(),
    items: [
      {
        id: 11,
        productId: "americano",
        name: "Americano",
        image: "assets/images/product-batch-brew.png",
        unitPrice: 70,
        unitFinalPriceEgp: 70,
        quantity: 2,
        lineTotalEgp: 140,
        customizationSummary: "12 oz · Hot",
      },
    ],
  },
  {
    id: 1044,
    orderReference: "1044",
    orderNumber: "1044",
    customerName: "Laila Mansour",
    customerPhone: "+20 106 777 8899",
    customerEmail: "laila@example.eg",
    fulfillmentType: "pickup",
    status: "Completed",
    uiStatus: "Completed",
    stepIndex: 3,
    paymentStatus: "Paid",
    paymentMethod: "card_on_pickup",
    subtotalEgp: 210,
    discountEgp: 0,
    deliveryFeeEgp: 0,
    tipEgp: 0,
    taxEgp: 0,
    totalEgp: 210,
    subtotal: 210,
    total: 210,
    specialInstructions: "",
    allergyFlag: false,
    estimatedWindow: "Picked up",
    minutesAgo: 25,
    ageLabel: "25 min ago",
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    items: [
      {
        id: 12,
        productId: "iced-spanish-latte",
        name: "Iced Spanish Latte",
        image: "assets/images/product-iced-oat-latte.png",
        unitPrice: 100,
        unitFinalPriceEgp: 100,
        quantity: 1,
        lineTotalEgp: 100,
        customizationSummary: "12 oz · Iced",
      },
      {
        id: 13,
        productId: "cheesecake",
        name: "Cheesecake",
        image: "assets/images/product-almond-croissant.png",
        unitPrice: 110,
        unitFinalPriceEgp: 110,
        quantity: 1,
        lineTotalEgp: 110,
        customizationSummary: "Chilled slice",
      },
    ],
  },
  {
    id: 1043,
    orderReference: "1043",
    orderNumber: "1043",
    customerName: "Youssef Adel",
    customerPhone: "+20 100 112 2334",
    customerEmail: "youssef@example.eg",
    fulfillmentType: "pickup",
    status: "Completed",
    uiStatus: "Completed",
    stepIndex: 3,
    paymentStatus: "Paid",
    paymentMethod: "cash",
    subtotalEgp: 175,
    discountEgp: 0,
    deliveryFeeEgp: 0,
    tipEgp: 0,
    taxEgp: 0,
    totalEgp: 175,
    subtotal: 175,
    total: 175,
    specialInstructions: "",
    allergyFlag: false,
    estimatedWindow: "Picked up",
    minutesAgo: 38,
    ageLabel: "38 min ago",
    createdAt: new Date(Date.now() - 38 * 60000).toISOString(),
    items: [
      {
        id: 14,
        productId: "flat-white",
        name: "Flat White",
        image: "assets/images/product-flat-white.png",
        unitPrice: 90,
        unitFinalPriceEgp: 90,
        quantity: 1,
        lineTotalEgp: 90,
        customizationSummary: "12 oz · Hot",
      },
      {
        id: 15,
        productId: "cappuccino",
        name: "Cappuccino",
        image: "assets/images/product-flat-white.png",
        unitPrice: 85,
        unitFinalPriceEgp: 85,
        quantity: 1,
        lineTotalEgp: 85,
        customizationSummary: "12 oz · Hot",
      },
    ],
  },
];

const INITIAL_CUSTOMERS = [
  {
    id: 1,
    fullName: "Alex Johnson",
    email: "alex.johnson@example.com",
    phone: "+20 109 876 5432",
    ordersCount: 42,
    totalSpentEgp: 6420,
    loyaltyPoints: 120,
    usualDrink: "Spanish Latte · Oat milk",
    favoritePairing: "Butter Croissant",
    segment: "Regulars Club",
    lastVisit: "Today",
  },
  {
    id: 2,
    fullName: "Nour El-Din",
    email: "nour@example.eg",
    phone: "+20 100 555 0192",
    ordersCount: 36,
    totalSpentEgp: 5580,
    loyaltyPoints: 185,
    usualDrink: "Iced Spanish Latte · 16 oz",
    favoritePairing: "Chocolate Brownie",
    segment: "Regulars Club",
    lastVisit: "Today",
  },
  {
    id: 3,
    fullName: "Mariam Hassan",
    email: "mariam@example.eg",
    phone: "+20 101 234 5678",
    ordersCount: 28,
    totalSpentEgp: 4190,
    loyaltyPoints: 140,
    usualDrink: "Iced Matcha · Oat milk",
    favoritePairing: "Cinnamon Roll",
    segment: "Regulars Club",
    lastVisit: "Today",
  },
  {
    id: 4,
    fullName: "Omar Farouk",
    email: "omar@example.eg",
    phone: "+20 112 333 4455",
    ordersCount: 19,
    totalSpentEgp: 2945,
    loyaltyPoints: 95,
    usualDrink: "Flat White",
    favoritePairing: "Chicken Sandwich",
    segment: "Regulars Club",
    lastVisit: "Today",
  },
  {
    id: 5,
    fullName: "Salma Tarek",
    email: "salma@example.eg",
    phone: "+20 100 998 8776",
    ordersCount: 15,
    totalSpentEgp: 2310,
    loyaltyPoints: 75,
    usualDrink: "Caramel Latte",
    favoritePairing: "Butter Croissant",
    segment: "Regulars Club",
    lastVisit: "Today",
  },
  {
    id: 6,
    fullName: "Karim Nabil",
    email: "karim@example.eg",
    phone: "+20 122 444 5566",
    ordersCount: 9,
    totalSpentEgp: 1380,
    loyaltyPoints: 45,
    usualDrink: "Americano",
    favoritePairing: "Turkey Croissant",
    segment: "New this month",
    lastVisit: "Today",
  },
  {
    id: 7,
    fullName: "Laila Mansour",
    email: "laila@example.eg",
    phone: "+20 106 777 8899",
    ordersCount: 24,
    totalSpentEgp: 3840,
    loyaltyPoints: 160,
    usualDrink: "Iced Caramel Macchiato",
    favoritePairing: "Cheesecake",
    segment: "Regulars Club",
    lastVisit: "Today",
  },
  {
    id: 8,
    fullName: "Youssef Adel",
    email: "youssef@example.eg",
    phone: "+20 100 112 2334",
    ordersCount: 11,
    totalSpentEgp: 1690,
    loyaltyPoints: 55,
    usualDrink: "Cappuccino",
    favoritePairing: "Grilled Cheese Sandwich",
    segment: "New this month",
    lastVisit: "Today",
  },
];

const INITIAL_COUPONS = [
  {
    id: 1,
    code: "WELCOME10",
    description: "10% off first online ritual order",
    discountType: "percentage",
    discountValue: 10,
    minOrderEgp: 0,
    maxDiscountEgp: 75,
    usageLimit: 500,
    usedCount: 142,
    status: "Active",
    startsAt: "Nov 1, 2026",
    endsAt: "Dec 31, 2026",
  },
  {
    id: 2,
    code: "MORNING15",
    description: "15% off morning coffee & bakery before 11am",
    discountType: "percentage",
    discountValue: 15,
    minOrderEgp: 120,
    maxDiscountEgp: 60,
    usageLimit: 300,
    usedCount: 88,
    status: "Active",
    startsAt: "Nov 1, 2026",
    endsAt: "Dec 15, 2026",
  },
  {
    id: 3,
    code: "COFFEEONUS",
    description: "50 EGP off orders over 200 EGP",
    discountType: "fixed",
    discountValue: 50,
    minOrderEgp: 200,
    maxDiscountEgp: 50,
    usageLimit: 200,
    usedCount: 64,
    status: "Active",
    startsAt: "Nov 10, 2026",
    endsAt: "Dec 31, 2026",
  },
  {
    id: 4,
    code: "OATLOVER",
    description: "Free oat milk upgrade (20 EGP off)",
    discountType: "fixed",
    discountValue: 20,
    minOrderEgp: 95,
    maxDiscountEgp: 20,
    usageLimit: 250,
    usedCount: 51,
    status: "Active",
    startsAt: "Nov 5, 2026",
    endsAt: "Dec 31, 2026",
  },
];

const INITIAL_SETTINGS = {
  storeName: "Common Ground",
  branchName: "Maple Street · Zamalek",
  addressLine: "42 Maple Street, Zamalek, Cairo",
  phone: "+20 2 2735 0142",
  email: "hello@commonground.coffee",
  currency: "EGP",
  currencyCode: "EGP",
  isAcceptingOrders: true,
  pickupEnabled: true,
  standardPrepMinutes: 10,
  pickupBufferMinutes: 5,
  maxActiveOrders: 15,
  deliveryEnabled: true,
  deliveryRadiusKm: 5,
  deliveryFeeEgp: 25,
  deliveryMinOrderEgp: 100,
  pickupEstimate: "10–15 min",
  pickupEstimateLabel: "10–15 min",
  deliveryEstimate: "25–35 min",
  deliveryEstimateLabel: "25–35 min",
  telegramNotificationsEnabled: true,
};

const INITIAL_STAFF = [
  {
    id: 1,
    employeeCode: "EMP-001",
    fullName: "Sam Rivera",
    email: "sam.rivera@commonground.coffee",
    phone: "+20 100 000 0001",
    role: "admin",
    title: "Store Manager",
    station: "Management & Quality",
    shiftLabel: "7:00 am – 3:30 pm",
    isOnShift: true,
    isActive: true,
  },
  {
    id: 2,
    employeeCode: "EMP-002",
    fullName: "Jamie Chen",
    email: "jamie@commonground.coffee",
    phone: "+20 100 000 0002",
    role: "barista",
    title: "Lead Barista",
    station: "Espresso Bar 1",
    shiftLabel: "7:00 am – 3:00 pm",
    isOnShift: true,
    isActive: true,
  },
  {
    id: 3,
    employeeCode: "EMP-003",
    fullName: "Tariq Mansour",
    email: "tariq@commonground.coffee",
    phone: "+20 100 000 0003",
    role: "barista",
    title: "Cold Bar & Bakery Specialist",
    station: "Cold Brew & Warming",
    shiftLabel: "8:00 am – 4:00 pm",
    isOnShift: true,
    isActive: true,
  },
];

function getFallbackCollection(key, defaultData) {
  const existing = storageService.get(key, null);
  if (existing && Array.isArray(existing) && existing.length > 0) {
    return existing;
  }
  if (existing && !Array.isArray(defaultData) && typeof existing === "object") {
    return existing;
  }
  storageService.set(key, defaultData);
  return JSON.parse(JSON.stringify(defaultData));
}

function getFallbackProducts() {
  const defaultProducts = PRODUCTS.map((p, idx) => ({
    ...p,
    dbId: idx + 1,
    sku: `CG-${String(idx + 1).padStart(3, "0")}`,
    slug: p.id,
    priceEgp: p.price,
    stockQuantity: p.categoryId === "bakery" ? 14 : 45,
    isStockTracked: p.categoryId === "bakery" || p.categoryId === "food",
    lowStockThreshold: 8,
    stockStatus: "Available",
  }));
  return getFallbackCollection(FALLBACK_KEYS.PRODUCTS, defaultProducts);
}

/**
 * Fallback API router executed whenever `/api/*` returns 404/5xx on a static host (e.g., Vercel static deployment).
 */
function handleClientFallback(endpoint, { method = "GET", body = null } = {}) {
  const urlObj = new URL(endpoint, "http://localhost:8090");
  const path = urlObj.pathname;
  const query = Object.fromEntries(urlObj.searchParams.entries());

  // 1. AUTH LOGIN
  if (path === "/api/auth/login" && method === "POST") {
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (
      email === "sam.rivera@commonground.coffee" &&
      password === "CommonGroundAdmin2026!"
    ) {
      const user = {
        userId: 1,
        email: "sam.rivera@commonground.coffee",
        fullName: "Sam Rivera",
        role: "admin",
      };
      return { token: "cg_static_admin_token_2026", user };
    }

    if (
      email === "jamie@commonground.coffee" &&
      password === "CommonGroundBarista2026!"
    ) {
      const user = {
        userId: 2,
        email: "jamie@commonground.coffee",
        fullName: "Jamie Chen",
        role: "barista",
      };
      return { token: "cg_static_barista_token_2026", user };
    }

    const err = new Error("Invalid email or password.");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  if (path === "/api/auth/me") {
    const user = storageService.get(STORAGE_KEYS.AUTH_USER, null);
    if (!user) {
      const err = new Error("Authentication required.");
      err.status = 401;
      throw err;
    }
    return { user };
  }

  if (path === "/api/auth/logout") {
    return { loggedOut: true };
  }

  // 2. SETTINGS & HEALTH
  if (path === "/api/health") {
    return {
      status: "ok",
      database: "connected",
      currency: "EGP",
      isAcceptingOrders: true,
    };
  }

  if (path === "/api/settings/public" || path === "/api/admin/settings") {
    const settings = getFallbackCollection(FALLBACK_KEYS.SETTINGS, INITIAL_SETTINGS);
    if (method === "PATCH") {
      const updated = { ...settings, ...(body || {}) };
      storageService.set(FALLBACK_KEYS.SETTINGS, updated);
      return updated;
    }
    return settings;
  }

  // 3. CATEGORIES
  if (path === "/api/categories") {
    return CATEGORIES.filter((c) => c.id !== "all").map((c, idx) => ({
      id: c.id,
      dbId: idx + 1,
      slug: c.id,
      name: c.label,
      displayOrder: idx + 1,
      isActive: true,
    }));
  }

  // 4. PRODUCTS CRUD
  if (path === "/api/products" && method === "GET") {
    let list = getFallbackProducts();
    if (query.category && query.category !== "all") {
      list = list.filter(
        (p) =>
          p.categoryId === query.category ||
          (Array.isArray(p.categoryIds) && p.categoryIds.includes(query.category))
      );
    }
    if (query.search) {
      const q = query.search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.shortDescription && p.shortDescription.toLowerCase().includes(q))
      );
    }
    if (query.sort === "price-asc") list.sort((a, b) => a.price - b.price);
    if (query.sort === "price-desc") list.sort((a, b) => b.price - a.price);
    if (query.sort === "name-asc") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  if (path === "/api/products" && method === "POST") {
    const list = getFallbackProducts();
    const slug = String(body?.name || "new-item")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    const priceEgp = Number(body?.priceEgp || 85);
    const created = {
      id: slug,
      dbId: list.length + 1,
      sku: body?.sku || `CG-${String(list.length + 1).padStart(3, "0")}`,
      slug,
      name: body?.name || "New Item",
      categoryId: body?.categoryId || "coffee",
      categoryIds: [body?.categoryId || "coffee"],
      shortDescription: body?.shortDescription || "Freshly prepared",
      menuDescription: body?.shortDescription || "Freshly prepared",
      detailDescription: body?.detailDescription || body?.shortDescription || "Freshly prepared",
      price: priceEgp,
      priceEgp,
      baseSizePrice: priceEgp,
      image: body?.image || "assets/images/product-flat-white.png",
      available: body?.isAvailable !== false,
      customizable: true,
      stockQuantity: Number(body?.stockQuantity ?? 25),
      isStockTracked: true,
      stockStatus: body?.isAvailable === false ? "Sold out" : "Available",
    };
    list.unshift(created);
    storageService.set(FALLBACK_KEYS.PRODUCTS, list);
    return created;
  }

  if (path.startsWith("/api/products/")) {
    const idOrSlug = decodeURIComponent(path.replace("/api/products/", ""));
    const aliasMap = {
      "iced-oat-latte": "spanish-latte",
      "batch-brew": "americano",
      "almond-croissant": "butter-croissant",
    };
    const lookup = aliasMap[idOrSlug] || idOrSlug;
    const list = getFallbackProducts();
    const idx = list.findIndex(
      (p) => p.id === lookup || p.slug === lookup || String(p.dbId) === lookup
    );

    if (idx === -1) {
      const err = new Error("Product not found.");
      err.status = 404;
      throw err;
    }

    if (method === "GET") {
      return {
        ...list[idx],
        customizationGroups: [
          { id: "size", slug: "size", name: "Size", options: CUSTOMIZATION_OPTIONS.sizes },
          { id: "milk", slug: "milk", name: "Milk", options: CUSTOMIZATION_OPTIONS.milks },
          { id: "addons", slug: "addons", name: "Add-ons", options: CUSTOMIZATION_OPTIONS.addons },
        ],
      };
    }

    if (method === "PATCH") {
      const current = list[idx];
      const nextPrice =
        body?.priceEgp !== undefined ? Number(body.priceEgp) : current.priceEgp;
      const nextAvail =
        body?.isAvailable !== undefined ? Boolean(body.isAvailable) : current.available;
      const nextStock =
        body?.stockQuantity !== undefined
          ? Number(body.stockQuantity)
          : current.stockQuantity;

      list[idx] = {
        ...current,
        name: body?.name !== undefined ? body.name : current.name,
        categoryId: body?.categoryId || current.categoryId,
        shortDescription:
          body?.shortDescription !== undefined
            ? body.shortDescription
            : current.shortDescription,
        price: nextPrice,
        priceEgp: nextPrice,
        available: nextAvail,
        stockQuantity: nextStock,
        stockStatus: !nextAvail || nextStock <= 0 ? "Sold out" : nextStock <= 8 ? "Low stock" : "Available",
      };
      storageService.set(FALLBACK_KEYS.PRODUCTS, list);
      return list[idx];
    }

    if (method === "DELETE") {
      const removed = list.splice(idx, 1)[0];
      storageService.set(FALLBACK_KEYS.PRODUCTS, list);
      return { deletedSlug: removed.slug };
    }
  }

  // 5. ORDERS & STATUS TRANSITIONS
  if (path === "/api/admin/orders" && method === "GET") {
    let orders = getFallbackCollection(FALLBACK_KEYS.ORDERS, INITIAL_ORDERS);
    if (query.status && query.status !== "all") {
      const statuses = query.status
        .split(",")
        .map((s) => (s.trim() === "New" ? "Pending" : s.trim()));
      orders = orders.filter(
        (o) => statuses.includes(o.status) || statuses.includes(o.uiStatus)
      );
    }
    return orders;
  }

  if (path === "/api/orders" && method === "POST") {
    const orders = getFallbackCollection(FALLBACK_KEYS.ORDERS, INITIAL_ORDERS);
    const nextRef = String(
      Math.max(...orders.map((o) => Number(o.orderReference) || 1050), 1050) + 1
    );
    const products = getFallbackProducts();

    let subtotalEgp = 0;
    const resolvedItems = (body?.items || []).map((it, idx) => {
      const prod =
        products.find((p) => p.id === it.productId || p.slug === it.productId) ||
        products[0];
      const unitPrice = Number(it.unitPrice) || prod.price;
      const qty = Number(it.quantity) || 1;
      const lineTotal = unitPrice * qty;
      subtotalEgp += lineTotal;
      return {
        id: Date.now() + idx,
        productId: prod.id,
        name: prod.name,
        image: prod.image,
        unitPrice,
        unitFinalPriceEgp: unitPrice,
        quantity: qty,
        lineTotalEgp: lineTotal,
        customizationSummary: it.customizationSummary || "Standard ritual",
      };
    });

    const deliveryFeeEgp = body?.fulfillmentType === "delivery" ? 25 : 0;
    const discountEgp = body?.couponCode ? Math.round(subtotalEgp * 0.1) : 0;
    const tipEgp = Math.round(subtotalEgp * (Number(body?.tipRate) || 0));
    const totalEgp = Math.max(0, subtotalEgp - discountEgp + deliveryFeeEgp + tipEgp);

    const newOrder = {
      id: Number(nextRef),
      orderReference: nextRef,
      orderNumber: nextRef,
      customerName: body?.customerName || "Alex Johnson",
      customerPhone: body?.customerPhone || "+20 100 555 0142",
      customerEmail: body?.customerEmail || "alex.johnson@example.com",
      fulfillmentType: body?.fulfillmentType || "pickup",
      deliveryAddress: body?.deliveryAddress?.streetAddress || null,
      status: "Pending",
      uiStatus: "New",
      stepIndex: 0,
      paymentStatus: body?.paymentMethod === "cash" ? "Pending" : "Paid",
      paymentMethod: body?.paymentMethod || "cash",
      subtotalEgp,
      discountEgp,
      deliveryFeeEgp,
      tipEgp,
      taxEgp: 0,
      totalEgp,
      subtotal: subtotalEgp,
      total: totalEgp,
      specialInstructions: body?.specialInstructions || "",
      allergyFlag: /allergy|dairy|nut|gluten/i.test(body?.specialInstructions || ""),
      estimatedWindow: body?.fulfillmentType === "delivery" ? "25–35 min" : "10–15 min",
      minutesAgo: 0,
      ageLabel: "Just now",
      createdAt: new Date().toISOString(),
      items: resolvedItems,
    };

    orders.unshift(newOrder);
    storageService.set(FALLBACK_KEYS.ORDERS, orders);
    return newOrder;
  }

  if (path.startsWith("/api/orders/track/")) {
    const ref = decodeURIComponent(path.replace("/api/orders/track/", "")).replace(/^#/, "");
    const orders = getFallbackCollection(FALLBACK_KEYS.ORDERS, INITIAL_ORDERS);
    return orders.find((o) => o.orderReference === ref) || orders[0];
  }

  if (path.startsWith("/api/admin/orders/") && path.endsWith("/status") && method === "PATCH") {
    const ref = decodeURIComponent(
      path.replace("/api/admin/orders/", "").replace("/status", "")
    ).replace(/^#/, "");
    const orders = getFallbackCollection(FALLBACK_KEYS.ORDERS, INITIAL_ORDERS);
    const idx = orders.findIndex(
      (o) => o.orderReference === ref || String(o.id) === ref
    );
    if (idx === -1) {
      const err = new Error("Order not found.");
      err.status = 404;
      throw err;
    }

    const nextStatus = body?.status === "New" ? "Pending" : body?.status || orders[idx].status;
    const stepMap = { Pending: 0, Accepted: 1, Preparing: 1, Ready: 2, Completed: 3 };
    orders[idx] = {
      ...orders[idx],
      status: nextStatus,
      uiStatus: nextStatus === "Pending" ? "New" : nextStatus,
      stepIndex: stepMap[nextStatus] ?? 1,
      paymentStatus:
        body?.paymentStatus ||
        (nextStatus === "Completed" ? "Paid" : orders[idx].paymentStatus),
    };
    storageService.set(FALLBACK_KEYS.ORDERS, orders);
    return orders[idx];
  }

  // 6. ADMIN OVERVIEW & ANALYTICS
  if (path === "/api/admin/overview") {
    const orders = getFallbackCollection(FALLBACK_KEYS.ORDERS, INITIAL_ORDERS);
    const products = getFallbackProducts();
    const settings = getFallbackCollection(FALLBACK_KEYS.SETTINGS, INITIAL_SETTINGS);

    const validOrders = orders.filter(
      (o) => o.status !== "Cancelled" && o.status !== "Rejected"
    );
    const netSalesEgp = validOrders.reduce((sum, o) => sum + Number(o.totalEgp || 0), 0);
    const activeOrders = orders.filter((o) =>
      ["Pending", "Accepted", "Preparing", "Ready"].includes(o.status)
    ).length;
    const completedOrders = orders.filter((o) => o.status === "Completed").length;

    return {
      netSalesEgp,
      totalOrders: orders.length,
      activeOrders,
      completedOrders,
      avgOrderEgp: validOrders.length ? Number((netSalesEgp / validOrders.length).toFixed(2)) : 0,
      avgPrepMinutes: 6,
      oldestOrderMinutes: 9,
      staffOnShift: 3,
      isAcceptingOrders: settings.isAcceptingOrders,
      pickupEstimate: settings.pickupEstimate,
      lowStockAlerts: products
        .filter((p) => p.stockQuantity <= 8)
        .map((p) => ({
          name: p.name,
          slug: p.slug,
          quantityAvailable: p.stockQuantity,
        })),
      crowdFavorites: [
        { name: "Spanish Latte", units_sold: 14 },
        { name: "Flat White", units_sold: 11 },
        { name: "Butter Croissant", units_sold: 9 },
        { name: "Iced Matcha", units_sold: 7 },
      ],
      weeklySalesEgp: [
        { day: "Wed", salesEgp: 7850 },
        { day: "Thu", salesEgp: 7420 },
        { day: "Fri", salesEgp: 9120 },
        { day: "Sat", salesEgp: 10450 },
        { day: "Sun", salesEgp: 9680 },
        { day: "Mon", salesEgp: 8340 },
        { day: "Tue", salesEgp: netSalesEgp + 4680 },
      ],
    };
  }

  if (path === "/api/admin/analytics") {
    return {
      periodLabel: "Oct 26 – Nov 24",
      netSales30dEgp: 246800,
      orders30d: 2281,
      avgOrder30dEgp: 108.2,
      returningCustomerRate: 64.2,
      revenueByCategory: [
        { category: "Coffee", percentage: 68 },
        { category: "Desserts & Bakery", percentage: 22 },
        { category: "Non-Coffee & Matcha", percentage: 7 },
        { category: "Food & Sandwiches", percentage: 3 },
      ],
      topProducts: [
        { name: "Spanish Latte", units: 632, netSalesEgp: 60040 },
        { name: "Flat White", units: 560, netSalesEgp: 50400 },
        { name: "Americano", units: 414, netSalesEgp: 28980 },
        { name: "Butter Croissant", units: 382, netSalesEgp: 24830 },
        { name: "Iced Matcha", units: 211, netSalesEgp: 23210 },
      ],
      fulfillmentSplit: {
        pickupPercentage: 82,
        deliveryPercentage: 18,
      },
    };
  }

  // 7. CUSTOMERS CRM
  if (path === "/api/admin/customers" && method === "GET") {
    return getFallbackCollection(FALLBACK_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  }

  if (path.startsWith("/api/admin/customers/") && path.endsWith("/points") && method === "PATCH") {
    const id = Number(
      path.replace("/api/admin/customers/", "").replace("/points", "")
    );
    const customers = getFallbackCollection(FALLBACK_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    const idx = customers.findIndex((c) => c.id === id);
    if (idx !== -1) {
      customers[idx].loyaltyPoints = Math.max(0, Number(body?.loyaltyPoints || 0));
      storageService.set(FALLBACK_KEYS.CUSTOMERS, customers);
      return customers[idx];
    }
  }

  // 8. COUPONS / DISCOUNTS
  if (path === "/api/admin/coupons" && method === "GET") {
    return getFallbackCollection(FALLBACK_KEYS.COUPONS, INITIAL_COUPONS);
  }

  if (path === "/api/admin/coupons" && method === "POST") {
    const coupons = getFallbackCollection(FALLBACK_KEYS.COUPONS, INITIAL_COUPONS);
    const created = {
      id: coupons.length + 1,
      code: String(body?.code || "NEWCODE").toUpperCase(),
      description: body?.description || "Promotional discount",
      discountType: body?.discountType || "percentage",
      discountValue: Number(body?.discountValue || 10),
      minOrderEgp: Number(body?.minOrderEgp || 0),
      maxDiscountEgp: 60,
      usageLimit: 200,
      usedCount: 0,
      status: body?.status || "Active",
      startsAt: "Nov 24, 2026",
      endsAt: "Dec 31, 2026",
    };
    coupons.unshift(created);
    storageService.set(FALLBACK_KEYS.COUPONS, coupons);
    return created;
  }

  if (path.startsWith("/api/admin/coupons/") && method === "PATCH") {
    const id = Number(path.replace("/api/admin/coupons/", ""));
    const coupons = getFallbackCollection(FALLBACK_KEYS.COUPONS, INITIAL_COUPONS);
    const idx = coupons.findIndex((c) => c.id === id);
    if (idx !== -1) {
      coupons[idx] = { ...coupons[idx], ...(body || {}) };
      storageService.set(FALLBACK_KEYS.COUPONS, coupons);
      return coupons[idx];
    }
  }

  // 9. STAFF
  if (path === "/api/admin/staff") {
    return getFallbackCollection(FALLBACK_KEYS.STAFF, INITIAL_STAFF);
  }

  return {};
}

export async function apiRequest(endpoint, { method = "GET", body = null, token = null } = {}) {
  const authToken = token || storageService.get(STORAGE_KEYS.AUTH_TOKEN, null);
  const headers = {
    Accept: "application/json",
  };

  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method,
      headers,
      credentials: "same-origin",
      body: body !== null ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network unreachable — use local fallback engine
    return handleClientFallback(endpoint, { method, body });
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => ({})) : {};

  // If deployed on a static host (e.g. Vercel static preview) where `/api/*` returns a platform 404
  // or HTML/plain-text error page instead of our `{ success, data, error }` JSON envelope:
  const isBackendEnvelope =
    typeof payload === "object" &&
    payload !== null &&
    typeof payload.success === "boolean";

  if (!isBackendEnvelope && (response.status === 404 || response.status === 405 || response.status >= 500)) {
    return handleClientFallback(endpoint, { method, body });
  }

  if (!response.ok || payload.success === false) {
    const err = new Error(
      payload?.error?.message || `Request to ${endpoint} failed with status ${response.status}`
    );
    err.code = payload?.error?.code || `HTTP_${response.status}`;
    err.status = response.status;
    throw err;
  }

  return payload.data;
}
