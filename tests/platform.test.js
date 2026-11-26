/**
 * COMMON GROUND — Full-Stack Automated Verification Suite (Phase 4 & Stage 13)
 *
 * Executes unit, integration, security, RBAC, PII privacy, XSS sanitization,
 * idempotency, N+1 performance, and business-rule tests against:
 *  - PostgreSQL relational database (20 tables via PGlite in-memory test instance)
 *  - Express REST API endpoints (`/api/*`)
 *  - Cryptographic & Telegram notification services
 *  - Frontend domain modules (`constants.js`, `productService.js`)
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-common-ground-2026";

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { app } = require("../server/index.js");
const { seedDatabase } = require("../server/db/seed.js");
const { query } = require("../server/db/index.js");
const {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
} = require("../server/utils/crypto.js");
const { escapeTelegramMarkdown } = require("../server/services/telegramService.js");

let adminToken = "";
let baristaToken = "";
let createdOrderId = null;
let createdOrderNumber = "";

before(async () => {
  await seedDatabase();
});

describe("1. Database & Public Catalog API Tests", () => {
  test("GET /api/health confirms PostgreSQL connectivity and EGP currency", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.database, "connected");
    assert.equal(res.body.data.currency, "EGP");
    assert.equal(res.body.data.isAcceptingOrders, true);
  });

  test("GET /api/settings/public returns EGP store configuration", async () => {
    const res = await request(app).get("/api/settings/public");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.currency, "EGP");
    assert.equal(res.body.data.deliveryFeeEgp, 25);
  });

  test("GET /api/categories returns all 5 menu categories", async () => {
    const res = await request(app).get("/api/categories");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 5);
    const slugs = res.body.data.map((c) => c.slug);
    assert.deepEqual(slugs, ["coffee", "non-coffee", "iced-drinks", "bakery", "food"]);
  });

  test("GET /api/products returns all 18 Egyptian Pound (EGP) catalog products", async () => {
    const res = await request(app).get("/api/products");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 18);

    const expectedCatalog = {
      "Spanish Latte": 95,
      "Caramel Latte": 105,
      Americano: 70,
      Cappuccino: 85,
      "Flat White": 90,
      "Iced Matcha": 110,
      "Iced Chocolate": 95,
      "Hot Chocolate": 85,
      "Chocolate Brownie": 75,
      "Butter Croissant": 65,
      Cheesecake: 110,
      "Cinnamon Roll": 85,
      "Chicken Sandwich": 145,
      "Turkey Croissant": 125,
      "Grilled Cheese Sandwich": 115,
      "Iced Spanish Latte": 100,
      "Iced Americano": 75,
      "Iced Caramel Macchiato": 115,
    };

    for (const [name, expectedPrice] of Object.entries(expectedCatalog)) {
      const match = res.body.data.find((p) => p.name === name);
      assert.ok(match, `Missing product: ${name}`);
      assert.equal(match.price, expectedPrice, `Incorrect EGP price for ${name}`);
    }
  });

  test("GET /api/products supports category filtering, search, and price sorting", async () => {
    const bakeryRes = await request(app).get("/api/products?category=bakery");
    assert.equal(bakeryRes.status, 200);
    assert.equal(bakeryRes.body.data.length, 4);
    assert.ok(bakeryRes.body.data.every((p) => p.categoryId === "bakery"));

    const searchRes = await request(app).get("/api/products?search=Spanish");
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.body.data.length, 2);

    const ascRes = await request(app).get("/api/products?sort=price-asc");
    assert.equal(ascRes.status, 200);
    assert.equal(ascRes.body.data[0].name, "Butter Croissant");
    assert.equal(ascRes.body.data[0].price, 65);
  });

  test("GET /api/products/:slug returns full product details and batched customization groups (BUG-004b)", async () => {
    const res = await request(app).get("/api/products/spanish-latte");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, "Spanish Latte");
    assert.equal(res.body.data.price, 95);
    assert.ok(Array.isArray(res.body.data.customizationGroups));
    const groupSlugs = res.body.data.customizationGroups.map((g) => g.slug);
    assert.ok(groupSlugs.includes("size"));
    assert.ok(groupSlugs.includes("milk"));
    assert.ok(groupSlugs.includes("addons"));

    // Legacy slug alias test
    const aliasRes = await request(app).get("/api/products/iced-oat-latte");
    assert.equal(aliasRes.status, 200);
    assert.equal(aliasRes.body.data.id, "spanish-latte");
  });
});

describe("2. Authentication, RBAC, PII Privacy & XSS Security Tests", () => {
  test("POST /api/auth/login rejects invalid credentials with 401", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "sam.rivera@commonground.coffee",
      password: "WrongPassword123!",
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, "INVALID_CREDENTIALS");
  });

  test("POST /api/auth/login authenticates Barista and Admin accounts", async () => {
    const baristaRes = await request(app).post("/api/auth/login").send({
      email: "jamie@commonground.coffee",
      password: "CommonGroundBarista2026!",
    });
    assert.equal(baristaRes.status, 200);
    assert.equal(baristaRes.body.data.user.role, "barista");
    baristaToken = baristaRes.body.data.token;
    assert.ok(baristaToken.length > 20);

    const adminRes = await request(app).post("/api/auth/login").send({
      email: "sam.rivera@commonground.coffee",
      password: "CommonGroundAdmin2026!",
    });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.body.data.user.role, "admin");
    adminToken = adminRes.body.data.token;
    assert.ok(adminToken.length > 20);
  });

  test("Protected routes reject unauthenticated or tampered tokens with 401", async () => {
    const noTokenRes = await request(app).get("/api/admin/orders");
    assert.equal(noTokenRes.status, 401);
    assert.equal(noTokenRes.body.error.code, "UNAUTHORIZED");

    const tamperedRes = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${baristaToken}tampered`);
    assert.equal(tamperedRes.status, 401);
    assert.equal(tamperedRes.body.error.code, "INVALID_TOKEN");
  });

  test("RBAC prevents Barista from performing Admin-only mutations (403 Forbidden)", async () => {
    const createProdRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${baristaToken}`)
      .send({
        name: "Unauthorized Espresso",
        categoryId: "coffee",
        priceEgp: 60,
      });
    assert.equal(createProdRes.status, 403);
    assert.equal(createProdRes.body.error.code, "FORBIDDEN");

    const analyticsRes = await request(app)
      .get("/api/admin/analytics")
      .set("Authorization", `Bearer ${baristaToken}`);
    assert.equal(analyticsRes.status, 403);
  });

  test("Parameterized SQL queries resist SQL injection payloads", async () => {
    const sqliSearch = await request(app)
      .get("/api/products")
      .query({ search: "' OR 1=1; DROP TABLE products; --" });
    assert.equal(sqliSearch.status, 200);
    assert.equal(sqliSearch.body.data.length, 0);

    const verifyRes = await request(app).get("/api/products");
    assert.equal(verifyRes.body.data.length, 18);
  });
});

describe("3. Order Processing, Coupon Validation, Idempotency & Inventory Protection Tests", () => {
  test("POST /api/coupons/validate validates active coupons and enforces minOrderEgp (BUG-005)", async () => {
    // 1. Valid percentage coupon
    const welcomeRes = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "WELCOME10", subtotalEgp: 200 });
    assert.equal(welcomeRes.status, 200);
    assert.equal(welcomeRes.body.data.discountEgp, 20);

    // 2. Minimum order threshold rejection on COFFEEONUS (min 150 EGP)
    const belowMinRes = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "COFFEEONUS", subtotalEgp: 100 });
    assert.equal(belowMinRes.status, 422);
    assert.equal(belowMinRes.body.error.code, "COUPON_MIN_ORDER");

    // 3. Valid COFFEEONUS when subtotal >= 150 EGP
    const validFixedRes = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "COFFEEONUS", subtotalEgp: 200 });
    assert.equal(validFixedRes.status, 200);
    assert.equal(validFixedRes.body.data.discountEgp, 30);

    // 4. Expired coupon code returns 422 COUPON_INACTIVE
    const expiredRes = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "FALLFAVORITE", subtotalEgp: 200 });
    assert.equal(expiredRes.status, 422);
    assert.equal(expiredRes.body.error.code, "COUPON_INACTIVE");

    // 5. Unknown coupon code returns 404
    const unknownRes = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "NONEXISTENT99", subtotalEgp: 200 });
    assert.equal(unknownRes.status, 404);
    assert.equal(unknownRes.body.error.code, "COUPON_NOT_FOUND");
  });

  test("POST /api/orders validates phone number, delivery address, and non-empty items", async () => {
    const invalidPhoneRes = await request(app).post("/api/orders").send({
      customerName: "Nour El-Din",
      customerPhone: "abc",
      fulfillmentType: "pickup",
      items: [{ productId: "spanish-latte", quantity: 1 }],
    });
    assert.equal(invalidPhoneRes.status, 400);
    assert.equal(invalidPhoneRes.body.error.code, "VALIDATION_ERROR");

    const missingAddressRes = await request(app).post("/api/orders").send({
      customerName: "Nour El-Din",
      customerPhone: "+20 100 123 4567",
      fulfillmentType: "delivery",
      items: [{ productId: "spanish-latte", quantity: 1 }],
    });
    assert.equal(missingAddressRes.status, 400);
    assert.equal(missingAddressRes.body.error.code, "VALIDATION_ERROR");
  });

  test("POST /api/orders calculates authoritative EGP prices, strips XSS tags (BUG-003), enforces idempotency (BUG-006), and deducts inventory", async () => {
    const stockBeforeRes = await query(
      `SELECT i.quantity_available FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.slug = 'butter-croissant'`
    );
    const stockBefore = Number(stockBeforeRes.rows[0].quantity_available);

    const idempotencyKey = "test-idem-key-order-2026-001";
    const orderPayload = {
      customerName: "Nour <script>alert(1)</script>El-Din",
      customerEmail: "nour@example.eg",
      customerPhone: "+20 100 555 0199",
      fulfillmentType: "delivery",
      deliveryAddress: {
        streetAddress: "15 Brazil Street, Apt 4",
        city: "Zamalek, Cairo",
        deliveryNotes: "Ring bell twice",
      },
      paymentMethod: "cash",
      couponCode: "WELCOME10",
      tipRate: 0.1,
      specialInstructions: "<b>Extra hot</b> please",
      idempotencyKey,
      items: [
        {
          productId: "spanish-latte",
          quantity: 2,
          // Client attempts to spoof a 1 EGP price; server must ignore it
          unitPrice: 1,
          customizations: {
            size: "16oz",
            temperature: "iced",
            milk: "oat",
            addons: ["extra-shot"],
          },
          specialInstructions: "Light ice",
        },
        {
          productId: "butter-croissant",
          quantity: 1,
        },
      ],
    };

    const orderRes = await request(app).post("/api/orders").send(orderPayload);
    assert.equal(orderRes.status, 201);
    assert.equal(orderRes.body.success, true);

    const order = orderRes.body.data;
    createdOrderId = order.id;
    createdOrderNumber = order.orderNumber;

    // Verify HTML tags were stripped (BUG-003)
    assert.equal(order.customerName, "Nour alert(1)El-Din");
    assert.equal(order.specialInstructions, "Extra hot please");

    // Verify authoritative EGP pricing
    assert.equal(order.status, "Pending");
    assert.equal(order.subtotalEgp, 375);
    assert.equal(order.discountEgp, 37.5);
    assert.equal(order.deliveryFeeEgp, 25);
    assert.equal(order.tipEgp, 37.5);
    assert.equal(order.totalEgp, 400);

    // Check inventory was decremented by 1
    const stockAfterRes = await query(
      `SELECT i.quantity_available FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.slug = 'butter-croissant'`
    );
    const stockAfter = Number(stockAfterRes.rows[0].quantity_available);
    assert.equal(stockAfter, stockBefore - 1);

    // Repeat submission with the same idempotencyKey must NOT create a duplicate order or deduct stock again (BUG-006)
    const duplicateRes = await request(app).post("/api/orders").send(orderPayload);
    assert.equal(duplicateRes.status, 200);
    assert.equal(duplicateRes.body.data.deduplicated, true);
    assert.equal(duplicateRes.body.data.orderNumber, createdOrderNumber);

    const stockAfterDupRes = await query(
      `SELECT i.quantity_available FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.slug = 'butter-croissant'`
    );
    assert.equal(Number(stockAfterDupRes.rows[0].quantity_available), stockAfter);
  });

  test("POST /api/orders rejects order exceeding available inventory stock with 422", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({
        customerName: "Test Customer",
        customerPhone: "+20 100 555 0100",
        fulfillmentType: "pickup",
        items: [{ productId: "butter-croissant", quantity: 40 }],
      });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, "INSUFFICIENT_STOCK");
  });
});

describe("4. End-to-End Integration Flow, PII Redaction & Batched Query Performance", () => {
  test("Barista fetches newly created order in batched query (< 50ms, BUG-004) and advances lifecycle", async () => {
    const startMs = performance.now();
    const queueRes = await request(app)
      .get("/api/admin/orders?status=Pending")
      .set("Authorization", `Bearer ${baristaToken}`);
    const elapsedMs = performance.now() - startMs;

    assert.equal(queueRes.status, 200);
    assert.ok(elapsedMs < 50, `Expected batched orders query < 50ms, took ${elapsedMs.toFixed(2)}ms`);

    const found = queueRes.body.data.find((o) => o.orderNumber === createdOrderNumber);
    assert.ok(found, "Newly created order must appear in Barista Pending queue");
    // Staff view sees full unmasked phone number
    assert.equal(found.customerPhone, "+20 100 555 0199");

    for (const nextStatus of ["Preparing", "Ready", "Completed"]) {
      const patchRes = await request(app)
        .patch(`/api/admin/orders/${createdOrderId}/status`)
        .set("Authorization", `Bearer ${baristaToken}`)
        .send({ status: nextStatus });
      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.data.status, nextStatus);
    }

    // Attempting invalid backward state transition Completed -> Preparing must fail with 422
    const invalidTransitionRes = await request(app)
      .patch(`/api/admin/orders/${createdOrderId}/status`)
      .set("Authorization", `Bearer ${baristaToken}`)
      .send({ status: "Preparing" });
    assert.equal(invalidTransitionRes.status, 422);
    assert.equal(invalidTransitionRes.body.error.code, "INVALID_STATUS_TRANSITION");
  });

  test("Public tracking endpoint reflects Completed status while masking customer PII (BUG-002)", async () => {
    const publicTrackRes = await request(app).get(`/api/orders/track/${createdOrderNumber}`);
    assert.equal(publicTrackRes.status, 200);
    assert.equal(publicTrackRes.body.data.orderNumber, createdOrderNumber);
    assert.equal(publicTrackRes.body.data.status, "Completed");
    // Public unauthenticated caller receives masked PII
    assert.equal(publicTrackRes.body.data.customerPhone, "+20 ••• ••• 0199");
    assert.equal(publicTrackRes.body.data.customerEmail, "n•••@example.eg");
    assert.ok(!publicTrackRes.body.data.deliveryAddress.includes("15 Brazil Street"));

    // Authenticated staff caller receives full unmasked details
    const staffTrackRes = await request(app)
      .get(`/api/orders/track/${createdOrderNumber}`)
      .set("Authorization", `Bearer ${baristaToken}`);
    assert.equal(staffTrackRes.status, 200);
    assert.equal(staffTrackRes.body.data.customerPhone, "+20 100 555 0199");
  });

  test("Admin CRUD operations & Historical Order Snapshot Immutability", async () => {
    // 1. Create Product
    const createRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Pistachio Croissant",
        categoryId: "bakery",
        shortDescription: "Flaky croissant filled with roasted pistachio cream.",
        priceEgp: 95,
        stockQuantity: 25,
      });
    assert.equal(createRes.status, 201);
    const newProdId = createRes.body.data.dbId;

    // 2. Toggle Availability via PATCH /api/products/:id
    const toggleRes = await request(app)
      .patch(`/api/products/${newProdId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isAvailable: false });
    assert.equal(toggleRes.status, 200);
    assert.equal(toggleRes.body.data.available, false);

    // 3. Delete Product
    const deleteRes = await request(app)
      .delete(`/api/products/${newProdId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(deleteRes.status, 200);

    // 4. Verify historical order snapshot immutability when editing Butter Croissant price
    await request(app)
      .patch("/api/products/butter-croissant")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ priceEgp: 80 });

    const historicalOrderRes = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(historicalOrderRes.status, 200);
    assert.equal(historicalOrderRes.body.data.totalEgp, 400);

    // Restore Butter Croissant price back to 65 EGP
    await request(app)
      .patch("/api/products/butter-croissant")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ priceEgp: 65 });

    // 5. Admin Overview & Analytics
    const overviewRes = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(overviewRes.status, 200);
    assert.ok(overviewRes.body.data.totalOrders >= 1);

    const analyticsRes = await request(app)
      .get("/api/admin/analytics")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(analyticsRes.status, 200);
    assert.ok(Array.isArray(analyticsRes.body.data.revenueByCategory));
  });
});

describe("5. Frontend Domain, Cryptographic & Notification Service Unit Tests", () => {
  test("formatPrice and productService calculate EGP prices accurately", async () => {
    const { formatPrice, APP_CONFIG } = await import("../js/config/constants.js");
    const { productService } = await import("../js/services/productService.js");

    assert.equal(APP_CONFIG.CURRENCY, "EGP");
    assert.equal(formatPrice(0), "0 EGP");
    assert.equal(formatPrice(95), "95 EGP");
    assert.equal(formatPrice(105.5), "105.50 EGP");

    const all = productService.getAllProducts();
    assert.equal(all.length, 18);

    const unitPrice = productService.calculateUnitPrice("spanish-latte", {
      size: "16oz", // +15
      milk: "oat", // +20
      addons: ["extra-shot", "vanilla-syrup"], // +25 + 15
    });
    assert.equal(unitPrice, 95 + 15 + 20 + 25 + 15);
  });

  test("crypto utility hashes passwords, verifies tokens, and rejects expired tokens (BUG-008)", () => {
    const hash = hashPassword("MySecurePass2026!");
    assert.equal(verifyPassword("MySecurePass2026!", hash), true);
    assert.equal(verifyPassword("WrongPass", hash), false);

    const validTok = signToken({ userId: 99, role: "admin" }, 1);
    const decoded = verifyToken(validTok);
    assert.equal(decoded.userId, 99);
    assert.equal(decoded.role, "admin");

    const expiredTok = signToken({ userId: 99, role: "admin" }, -1);
    assert.equal(verifyToken(expiredTok), null);
  });

  test("escapeTelegramMarkdown escapes special Markdown entities safely (BUG-009)", () => {
    const raw = "Customer_Name *bold* `code` [link]";
    const escaped = escapeTelegramMarkdown(raw);
    assert.equal(escaped, "Customer\\_Name \\*bold\\* \\`code\\` \\[link]");
  });
});
