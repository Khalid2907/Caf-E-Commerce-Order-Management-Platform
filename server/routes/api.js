/**
 * COMMON GROUND — Complete REST API Router (Stages 10 & 12)
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { authenticate, requireRole, extractToken } = require("../middleware/auth");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("../utils/crypto");
const { sendNewOrderTelegramAlert } = require("../services/telegramService");

const router = express.Router();

// In-memory idempotency cache for duplicate order submission protection (BUG-006)
const recentIdempotencyOrders = new Map();

/**
 * Strips HTML tags from user-supplied text fields to prevent Stored XSS at the DB boundary (BUG-003).
 * @param {string} value
 * @returns {string}
 */
function stripHtmlTags(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/<[^>]*>/g, "")
    .trim();
}

/**
 * Redacts sensitive customer PII on public unauthenticated order tracking lookups (BUG-002).
 * @param {object} order
 * @returns {object}
 */
function sanitizePublicTrackingOrder(order) {
  if (!order) return null;
  const nameParts = String(order.customerName || "Guest").trim().split(/\s+/);
  const firstName = nameParts[0] || "Guest";
  const lastInitial = nameParts.length > 1 ? ` ${nameParts[nameParts.length - 1][0]}.` : "";

  const digits = String(order.customerPhone || "").replace(/\D/g, "");
  const last4 = digits.slice(-4) || "0000";
  const maskedPhone = `+20 ••• ••• ${last4}`;

  let maskedEmail = "";
  if (order.customerEmail && order.customerEmail.includes("@")) {
    const [local, domain] = order.customerEmail.split("@");
    maskedEmail = `${local[0] || "u"}•••@${domain}`;
  }

  let maskedAddress = null;
  if (order.deliveryAddress) {
    const parts = String(order.deliveryAddress)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    maskedAddress = parts.length > 1 ? parts.slice(1).join(", ") : "Delivery address on file";
  }

  return {
    ...order,
    customerName: `${firstName}${lastInitial}`,
    customerPhone: maskedPhone,
    customerEmail: maskedEmail,
    deliveryAddress: maskedAddress,
  };
}

// Legacy slug alias map so existing links (?id=iced-oat-latte, ?id=batch-brew, ?id=almond-croissant) work seamlessly
const PRODUCT_SLUG_ALIASES = {
  "iced-oat-latte": "spanish-latte",
  "batch-brew": "americano",
  "almond-croissant": "butter-croissant",
};

// Arabic keyword search mapping for bilingual catalog queries (Phase 8)
const ARABIC_PRODUCT_SEARCH_MAP = [
  { keywords: ["سبانيش", "اسبانيش", "لاتيه", "قهوة"], slugs: ["spanish-latte", "iced-spanish-latte", "caramel-latte"] },
  { keywords: ["كراميل", "ماكياتو"], slugs: ["caramel-latte", "iced-caramel-macchiato"] },
  { keywords: ["امريكانو", "أمريكانو", "بلاك"], slugs: ["americano", "iced-americano"] },
  { keywords: ["كابتشينو"], slugs: ["cappuccino"] },
  { keywords: ["فلات", "وايت"], slugs: ["flat-white"] },
  { keywords: ["ماتشا", "شاي"], slugs: ["iced-matcha"] },
  { keywords: ["شوكولاتة", "شوكليت", "هوت"], slugs: ["iced-chocolate", "hot-chocolate", "chocolate-brownie"] },
  { keywords: ["براوني", "كيك", "حلو"], slugs: ["chocolate-brownie", "cheesecake", "cinnamon-roll"] },
  { keywords: ["كرواسون", "زبدة", "مخبوزات"], slugs: ["butter-croissant", "turkey-croissant"] },
  { keywords: ["تشيز", "سان"], slugs: ["cheesecake"] },
  { keywords: ["سينابون", "قرفة", "رول"], slugs: ["cinnamon-roll"] },
  { keywords: ["ساندوتش", "دجاج", "فراخ", "تركي", "جبنة"], slugs: ["chicken-sandwich", "turkey-croissant", "grilled-cheese-sandwich"] },
  { keywords: ["ايس", "آيس", "مثلج", "بارد"], slugs: ["iced-matcha", "iced-chocolate", "iced-spanish-latte", "iced-americano", "iced-caramel-macchiato"] },
];

// Strict Order Status State Machine
const ALLOWED_STATUS_TRANSITIONS = {
  Pending: ["Accepted", "Preparing", "Rejected", "Cancelled"],
  Accepted: ["Preparing", "Ready", "Cancelled"],
  Preparing: ["Ready", "Cancelled"],
  Ready: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
  Rejected: [],
};

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 100 : 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many login attempts. Please try again in 15 minutes.",
    },
  },
});

const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 200 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many order submissions from this IP. Please wait a few minutes.",
    },
  },
});

/**
 * Helper: Formats a database product row for API consumers.
 */
function formatProductRow(row, customizationGroups = undefined) {
  const priceEgp = Number(row.base_price_egp);
  const stockQty =
    row.quantity_available !== undefined && row.quantity_available !== null
      ? Number(row.quantity_available)
      : 50;
  const isTracked = Boolean(row.is_tracked);
  const lowThreshold = Number(row.low_stock_threshold || 8);

  let stockStatus = "Available";
  if (!row.is_available || (isTracked && stockQty <= 0)) {
    stockStatus = "Sold out";
  } else if (isTracked && stockQty <= lowThreshold) {
    stockStatus = "Low stock";
  }

  return {
    id: row.slug,
    dbId: row.id,
    sku: row.sku,
    slug: row.slug,
    categoryId: row.category_slug,
    categoryName: row.category_name,
    categoryIds:
      row.category_slug === "iced-drinks"
        ? ["iced-drinks", "coffee"]
        : [row.category_slug],
    name: row.name,
    badge: row.badge,
    shortDescription: row.short_description,
    menuDescription: row.menu_description || row.short_description,
    detailDescription: row.detail_description || row.short_description,
    originNote: row.origin_note,
    allergenNote: row.allergen_note,
    price: priceEgp,
    priceEgp,
    baseSizePrice: priceEgp,
    basePricePiastres: Number(row.base_price_piastres),
    image: row.image_url || "assets/images/product-flat-white.png",
    available: Boolean(row.is_available && (!isTracked || stockQty > 0)),
    customizable: Boolean(row.is_customizable),
    isFeatured: Boolean(row.is_featured),
    featuredOrder: row.featured_order,
    stockQuantity: stockQty,
    isStockTracked: isTracked,
    lowStockThreshold: lowThreshold,
    stockStatus,
    ...(customizationGroups ? { customizationGroups } : {}),
  };
}

/**
 * Helper: Batch-loads full orders with items & customizations in at most 3 SQL queries
 * (Eliminates N+1 query bottleneck — BUG-004).
 * @param {Array<object>} orderRows
 * @returns {Promise<Array<object>>}
 */
async function hydrateOrderRowsBatch(orderRows) {
  if (!Array.isArray(orderRows) || orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.id);
  const itemsRes = await db.query(
    `SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id ASC`,
    [orderIds]
  );

  const itemIds = itemsRes.rows.map((it) => it.id);
  const custByItemId = new Map();

  if (itemIds.length > 0) {
    const custRes = await db.query(
      `SELECT * FROM order_item_customizations WHERE order_item_id = ANY($1) ORDER BY id ASC`,
      [itemIds]
    );
    for (const c of custRes.rows) {
      if (!custByItemId.has(c.order_item_id)) {
        custByItemId.set(c.order_item_id, []);
      }
      custByItemId.get(c.order_item_id).push({
        groupName: c.group_name_snapshot,
        optionName: c.option_name_snapshot,
        priceDeltaEgp: Number(c.price_delta_egp),
      });
    }
  }

  const itemsByOrderId = new Map();
  for (const it of itemsRes.rows) {
    if (!itemsByOrderId.has(it.order_id)) {
      itemsByOrderId.set(it.order_id, []);
    }
    itemsByOrderId.get(it.order_id).push({
      id: it.id,
      productId: it.product_slug_snapshot,
      name: it.product_name_snapshot,
      image: it.product_image_snapshot || "assets/images/product-iced-oat-latte.png",
      unitBasePriceEgp: Number(it.unit_base_price_egp),
      unitPrice: Number(it.unit_final_price_egp),
      unitFinalPriceEgp: Number(it.unit_final_price_egp),
      quantity: Number(it.quantity),
      lineTotalEgp: Number(it.line_total_egp),
      customizationSummary: it.customization_summary || "",
      specialInstructions: it.special_instructions || "",
      customizations: custByItemId.get(it.id) || [],
    });
  }

  const stepIndexMap = {
    Pending: 0,
    Accepted: 1,
    Preparing: 1,
    Ready: 2,
    Completed: 3,
    Cancelled: 0,
    Rejected: 0,
  };

  return orderRows.map((ord) => {
    const minutesAgo = Math.max(
      0,
      Math.round((Date.now() - new Date(ord.created_at).getTime()) / 60000)
    );
    return {
      id: ord.id,
      orderReference: ord.order_reference,
      orderNumber: ord.order_reference,
      customerId: ord.customer_id,
      customerName: ord.customer_name,
      customerPhone: ord.customer_phone,
      customerEmail: ord.customer_email,
      fulfillmentType: ord.fulfillment_type,
      deliveryAddress: ord.delivery_address_snapshot,
      status: ord.status,
      uiStatus: ord.status === "Pending" ? "New" : ord.status,
      stepIndex: stepIndexMap[ord.status] ?? 1,
      paymentStatus: ord.payment_status,
      paymentMethod: ord.payment_method,
      subtotalEgp: Number(ord.subtotal_egp),
      discountEgp: Number(ord.discount_egp),
      deliveryFeeEgp: Number(ord.delivery_fee_egp),
      tipEgp: Number(ord.tip_egp),
      taxEgp: Number(ord.tax_egp),
      totalEgp: Number(ord.total_egp),
      subtotal: Number(ord.subtotal_egp),
      total: Number(ord.total_egp),
      specialInstructions: ord.special_instructions || "",
      allergyFlag: Boolean(ord.allergy_flag),
      estimatedWindow: ord.estimated_window || "10:25–10:30 am",
      rejectionReason: ord.rejection_reason || "",
      minutesAgo,
      ageLabel: minutesAgo <= 0 ? "Just now" : `${minutesAgo} min ago`,
      createdAt: ord.created_at,
      items: itemsByOrderId.get(ord.id) || [],
    };
  });
}

/**
 * Helper: Loads full order with items & customizations by ID or reference.
 */
async function loadFullOrder(whereColumn, value) {
  const orderRes = await db.query(
    `SELECT * FROM orders WHERE ${whereColumn} = $1 LIMIT 1`,
    [value]
  );
  if (orderRes.rows.length === 0) return null;
  const hydrated = await hydrateOrderRowsBatch(orderRes.rows);
  return hydrated[0] || null;
}

// =============================================================================
// 1. HEALTH & PUBLIC SETTINGS
// =============================================================================

router.get("/health", async (req, res, next) => {
  try {
    const dbCheck = await db.query("SELECT 1 AS ok");
    const settingsRes = await db.query(
      "SELECT currency_code, is_accepting_orders FROM cafe_settings LIMIT 1"
    );
    const settings = settingsRes.rows[0] || {
      currency_code: "EGP",
      is_accepting_orders: true,
    };

    res.json({
      success: true,
      data: {
        status: "ok",
        database: dbCheck.rows[0]?.ok === 1 ? "connected" : "degraded",
        currency: settings.currency_code,
        isAcceptingOrders: settings.is_accepting_orders,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/settings/public", async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM cafe_settings ORDER BY id ASC LIMIT 1");
    const s = result.rows[0];
    res.json({
      success: true,
      data: {
        storeName: s.store_name,
        branchName: s.branch_name,
        addressLine: s.address_line,
        phone: s.phone,
        email: s.email,
        currency: s.currency_code,
        isAcceptingOrders: s.is_accepting_orders,
        pickupEnabled: s.pickup_enabled,
        standardPrepMinutes: s.standard_prep_minutes,
        deliveryEnabled: s.delivery_enabled,
        deliveryFeeEgp: Number(s.delivery_fee_egp),
        deliveryMinOrderEgp: Number(s.delivery_min_order_egp),
        pickupEstimate: s.pickup_estimate_label,
        deliveryEstimate: s.delivery_estimate_label,
        openingHours: s.opening_hours_json,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// 2. AUTHENTICATION ENDPOINTS
// =============================================================================

router.post("/auth/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Email and password are required.",
        },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const userRes = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.phone, u.is_active, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE LOWER(u.email) = $1
       LIMIT 1`,
      [normalizedEmail]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      });
    }

    const user = userRes.rows[0];
    if (!user.is_active || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      });
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };

    const token = signToken(tokenPayload, 24);

    res.cookie("cg_auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 3600 * 1000,
    });

    res.json({
      success: true,
      data: {
        token,
        user: tokenPayload,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie("cg_auth_token");
  res.json({ success: true, data: { loggedOut: true } });
});

router.get("/auth/me", authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

// =============================================================================
// 3. CATEGORIES ENDPOINTS
// =============================================================================

router.get("/categories", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.*, COUNT(p.id)::int AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       WHERE c.is_active = TRUE
       GROUP BY c.id
       ORDER BY c.display_order ASC, c.id ASC`
    );

    res.json({
      success: true,
      data: result.rows.map((r) => ({
        id: r.slug,
        dbId: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        displayOrder: r.display_order,
        isActive: r.is_active,
        productCount: r.product_count,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/categories",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { name, slug, description = "", displayOrder = 10 } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Category name is required." },
        });
      }

      const finalSlug = (slug || name)
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const inserted = await db.query(
        `INSERT INTO categories (slug, name, description, display_order, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING *`,
        [finalSlug, String(name).trim(), description, Number(displayOrder) || 10]
      );

      res.status(201).json({
        success: true,
        data: inserted.rows[0],
      });
    } catch (err) {
      if (err.message && err.message.includes("unique")) {
        return res.status(409).json({
          success: false,
          error: { code: "DUPLICATE_CATEGORY", message: "Category slug already exists." },
        });
      }
      next(err);
    }
  }
);

router.patch(
  "/categories/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, description, displayOrder, isActive } = req.body || {};

      const existing = await db.query(
        "SELECT * FROM categories WHERE id::text = $1 OR slug = $1 LIMIT 1",
        [String(id)]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Category not found." },
        });
      }

      const row = existing.rows[0];
      const updated = await db.query(
        `UPDATE categories
         SET name = $1, description = $2, display_order = $3, is_active = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [
          name !== undefined ? String(name).trim() : row.name,
          description !== undefined ? description : row.description,
          displayOrder !== undefined ? Number(displayOrder) : row.display_order,
          isActive !== undefined ? Boolean(isActive) : row.is_active,
          row.id,
        ]
      );

      res.json({ success: true, data: updated.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/categories/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const existing = await db.query(
        "SELECT * FROM categories WHERE id::text = $1 OR slug = $1 LIMIT 1",
        [String(id)]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Category not found." },
        });
      }

      const prodCheck = await db.query(
        "SELECT COUNT(*)::int AS cnt FROM products WHERE category_id = $1",
        [existing.rows[0].id]
      );
      if (prodCheck.rows[0].cnt > 0) {
        return res.status(409).json({
          success: false,
          error: {
            code: "CATEGORY_IN_USE",
            message: "Cannot delete a category that still has assigned products.",
          },
        });
      }

      await db.query("DELETE FROM categories WHERE id = $1", [existing.rows[0].id]);
      res.json({ success: true, data: { deletedId: existing.rows[0].id } });
    } catch (err) {
      next(err);
    }
  }
);

// =============================================================================
// 4. PRODUCTS & CUSTOMIZATIONS ENDPOINTS
// =============================================================================

async function fetchCustomizationGroupsForProduct(productId) {
  const groupsRes = await db.query(
    `SELECT cg.*
     FROM customization_groups cg
     JOIN product_customization_assignments pca ON pca.group_id = cg.id
     WHERE pca.product_id = $1
     ORDER BY pca.display_order ASC, cg.display_order ASC`,
    [productId]
  );

  if (groupsRes.rows.length === 0) return [];
  const groupIds = groupsRes.rows.map((g) => g.id);

  const optsRes = await db.query(
    `SELECT * FROM customization_options
     WHERE group_id = ANY($1) AND is_available = TRUE
     ORDER BY display_order ASC, id ASC`,
    [groupIds]
  );

  const optsByGroupId = new Map();
  for (const o of optsRes.rows) {
    if (!optsByGroupId.has(o.group_id)) {
      optsByGroupId.set(o.group_id, []);
    }
    optsByGroupId.get(o.group_id).push({
      id: o.slug,
      dbId: o.id,
      slug: o.slug,
      label: o.name,
      name: o.name,
      shortLabel: o.short_label || o.name,
      priceDelta: Number(o.price_delta_egp),
      priceDeltaEgp: Number(o.price_delta_egp),
      priceDeltaPiastres: Number(o.price_delta_piastres),
      isDefault: o.is_default,
    });
  }

  return groupsRes.rows.map((g) => ({
    id: g.slug,
    dbId: g.id,
    slug: g.slug,
    name: g.name,
    isRequired: g.is_required,
    minSelections: g.min_selections,
    maxSelections: g.max_selections,
    options: optsByGroupId.get(g.id) || [],
  }));
}

router.get("/products", async (req, res, next) => {
  try {
    const { category, search, featured, available, sort } = req.query;

    const conditions = [];
    const params = [];

    if (category && category !== "all" && category !== "favorites") {
      params.push(String(category));
      conditions.push(`c.slug = $${params.length}`);
    }

    if (featured === "true" || category === "favorites") {
      conditions.push(`p.is_featured = TRUE`);
    }

    if (available === "true") {
      conditions.push(`p.is_available = TRUE`);
    }

    if (search && String(search).trim()) {
      const qLower = String(search).trim().toLowerCase();
      params.push(`%${qLower}%`);
      const likeParamIdx = params.length;

      const matchedArSlugs = new Set();
      for (const entry of ARABIC_PRODUCT_SEARCH_MAP) {
        if (entry.keywords.some((kw) => qLower.includes(kw))) {
          entry.slugs.forEach((s) => matchedArSlugs.add(s));
        }
      }

      if (matchedArSlugs.size > 0) {
        params.push(Array.from(matchedArSlugs));
        const arParamIdx = params.length;
        conditions.push(
          `(LOWER(p.name) LIKE $${likeParamIdx} OR LOWER(p.short_description) LIKE $${likeParamIdx} OR LOWER(p.sku) LIKE $${likeParamIdx} OR p.slug = ANY($${arParamIdx}))`
        );
      } else {
        conditions.push(
          `(LOWER(p.name) LIKE $${likeParamIdx} OR LOWER(p.short_description) LIKE $${likeParamIdx} OR LOWER(p.sku) LIKE $${likeParamIdx})`
        );
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    let orderClause =
      "ORDER BY COALESCE(p.featured_order, 999) ASC, c.display_order ASC, p.id ASC";
    if (sort === "price-asc") {
      orderClause = "ORDER BY p.base_price_piastres ASC";
    } else if (sort === "price-desc") {
      orderClause = "ORDER BY p.base_price_piastres DESC";
    } else if (sort === "name-asc") {
      orderClause = "ORDER BY p.name ASC";
    }

    const result = await db.query(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name,
              pi.image_url, inv.quantity_available, inv.low_stock_threshold, inv.is_tracked
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
       LEFT JOIN inventory inv ON inv.product_id = p.id
       ${whereClause}
       ${orderClause}`,
      params
    );

    res.json({
      success: true,
      data: result.rows.map((r) => formatProductRow(r)),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/products/:idOrSlug", async (req, res, next) => {
  try {
    const rawKey = String(req.params.idOrSlug).trim();
    const lookupKey = PRODUCT_SLUG_ALIASES[rawKey] || rawKey;

    const result = await db.query(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name,
              pi.image_url, inv.quantity_available, inv.low_stock_threshold, inv.is_tracked
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
       LEFT JOIN inventory inv ON inv.product_id = p.id
       WHERE p.slug = $1 OR p.id::text = $1 OR LOWER(p.sku) = LOWER($1)
       LIMIT 1`,
      [lookupKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: "PRODUCT_NOT_FOUND", message: "Product not found." },
      });
    }

    const row = result.rows[0];
    const customizationGroups = row.is_customizable
      ? await fetchCustomizationGroupsForProduct(row.id)
      : [];

    res.json({
      success: true,
      data: formatProductRow(row, customizationGroups),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/products",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const {
        name,
        sku,
        slug,
        categoryId,
        priceEgp,
        shortDescription,
        menuDescription,
        detailDescription,
        allergenNote,
        badge,
        image = "assets/images/product-flat-white.png",
        isAvailable = true,
        isCustomizable = true,
        isFeatured = false,
        stockQuantity = 25,
        isStockTracked = true,
      } = req.body || {};

      if (!name || priceEgp === undefined || Number(priceEgp) < 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Product name and a non-negative EGP price are required.",
          },
        });
      }

      const catRes = await db.query(
        "SELECT id, slug, name FROM categories WHERE slug = $1 OR id::text = $1 LIMIT 1",
        [String(categoryId || "coffee")]
      );
      if (catRes.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_CATEGORY", message: "Valid category is required." },
        });
      }

      const finalSlug = (slug || name)
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const finalSku =
        sku || `PRD-${Math.floor(100 + Math.random() * 900)}`;
      const numericPrice = Number(Number(priceEgp).toFixed(2));
      const piastres = Math.round(numericPrice * 100);

      const createdProduct = await db.withTransaction(async (tx) => {
        const pRes = await tx.query(
          `INSERT INTO products (
            sku, slug, category_id, name, badge, short_description, menu_description,
            detail_description, allergen_note, base_price_piastres, base_price_egp,
            is_available, is_customizable, is_featured
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *`,
          [
            finalSku,
            finalSlug,
            catRes.rows[0].id,
            String(name).trim(),
            badge || null,
            shortDescription || String(name).trim(),
            menuDescription || shortDescription || String(name).trim(),
            detailDescription || shortDescription || String(name).trim(),
            allergenNote || "Prepared in a kitchen that handles nuts, wheat, and dairy.",
            piastres,
            numericPrice,
            Boolean(isAvailable),
            Boolean(isCustomizable),
            Boolean(isFeatured),
          ]
        );
        const prod = pRes.rows[0];

        await tx.query(
          `INSERT INTO product_images (product_id, image_url, alt_text, is_primary)
           VALUES ($1, $2, $3, TRUE)`,
          [prod.id, image, prod.name]
        );

        await tx.query(
          `INSERT INTO inventory (product_id, quantity_available, low_stock_threshold, is_tracked)
           VALUES ($1, $2, 8, $3)`,
          [prod.id, Math.max(0, Number(stockQuantity) || 0), Boolean(isStockTracked)]
        );

        if (isCustomizable) {
          const allGroups = await tx.query("SELECT id, display_order FROM customization_groups");
          for (const g of allGroups.rows) {
            await tx.query(
              `INSERT INTO product_customization_assignments (product_id, group_id, display_order)
               VALUES ($1, $2, $3)`,
              [prod.id, g.id, g.display_order]
            );
          }
        }

        return prod;
      });

      const io = req.app.get("io");
      if (io) io.emit("product:updated", { productId: createdProduct.slug });

      res.status(201).json({
        success: true,
        data: {
          id: createdProduct.slug,
          dbId: createdProduct.id,
          sku: createdProduct.sku,
          slug: createdProduct.slug,
          name: createdProduct.name,
          priceEgp: Number(createdProduct.base_price_egp),
          available: createdProduct.is_available,
        },
      });
    } catch (err) {
      if (err.message && err.message.includes("unique")) {
        return res.status(409).json({
          success: false,
          error: { code: "DUPLICATE_PRODUCT", message: "Product slug or SKU already exists." },
        });
      }
      next(err);
    }
  }
);

router.patch(
  "/products/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const rawKey = String(req.params.id).trim();
      const lookupKey = PRODUCT_SLUG_ALIASES[rawKey] || rawKey;

      const existingRes = await db.query(
        "SELECT * FROM products WHERE slug = $1 OR id::text = $1 OR LOWER(sku) = LOWER($1) LIMIT 1",
        [lookupKey]
      );
      if (existingRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: "PRODUCT_NOT_FOUND", message: "Product not found." },
        });
      }

      const prod = existingRes.rows[0];
      const {
        name,
        categoryId,
        priceEgp,
        shortDescription,
        menuDescription,
        detailDescription,
        allergenNote,
        isAvailable,
        stockQuantity,
        isStockTracked,
      } = req.body || {};

      let nextCategoryId = prod.category_id;
      if (categoryId) {
        const catRes = await db.query(
          "SELECT id FROM categories WHERE slug = $1 OR id::text = $1 LIMIT 1",
          [String(categoryId)]
        );
        if (catRes.rows.length > 0) nextCategoryId = catRes.rows[0].id;
      }

      const nextPriceEgp =
        priceEgp !== undefined ? Number(Number(priceEgp).toFixed(2)) : Number(prod.base_price_egp);
      if (nextPriceEgp < 0) {
        return res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Price cannot be negative." },
        });
      }
      const nextPiastres = Math.round(nextPriceEgp * 100);

      await db.withTransaction(async (tx) => {
        await tx.query(
          `UPDATE products
           SET name = $1,
               category_id = $2,
               base_price_piastres = $3,
               base_price_egp = $4,
               short_description = $5,
               menu_description = $6,
               detail_description = $7,
               allergen_note = $8,
               is_available = $9,
               updated_at = NOW()
           WHERE id = $10`,
          [
            name !== undefined ? String(name).trim() : prod.name,
            nextCategoryId,
            nextPiastres,
            nextPriceEgp,
            shortDescription !== undefined ? shortDescription : prod.short_description,
            menuDescription !== undefined ? menuDescription : prod.menu_description,
            detailDescription !== undefined ? detailDescription : prod.detail_description,
            allergenNote !== undefined ? allergenNote : prod.allergen_note,
            isAvailable !== undefined ? Boolean(isAvailable) : prod.is_available,
            prod.id,
          ]
        );

        if (stockQuantity !== undefined || isStockTracked !== undefined) {
          const invRes = await tx.query(
            "SELECT * FROM inventory WHERE product_id = $1 LIMIT 1",
            [prod.id]
          );
          if (invRes.rows.length > 0) {
            const inv = invRes.rows[0];
            const nextQty =
              stockQuantity !== undefined
                ? Math.max(0, Number(stockQuantity))
                : inv.quantity_available;
            const nextTracked =
              isStockTracked !== undefined ? Boolean(isStockTracked) : inv.is_tracked;

            await tx.query(
              `UPDATE inventory
               SET quantity_available = $1, is_tracked = $2, updated_at = NOW()
               WHERE id = $3`,
              [nextQty, nextTracked, inv.id]
            );
          }
        }
      });

      const refreshed = await db.query(
        `SELECT p.*, c.slug AS category_slug, c.name AS category_name,
                pi.image_url, inv.quantity_available, inv.low_stock_threshold, inv.is_tracked
         FROM products p
         JOIN categories c ON c.id = p.category_id
         LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
         LEFT JOIN inventory inv ON inv.product_id = p.id
         WHERE p.id = $1`,
        [prod.id]
      );

      const io = req.app.get("io");
      if (io) io.emit("product:updated", { productId: prod.slug });

      res.json({
        success: true,
        data: formatProductRow(refreshed.rows[0]),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/products/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const rawKey = String(req.params.id).trim();
      const existingRes = await db.query(
        "SELECT id, slug FROM products WHERE slug = $1 OR id::text = $1 LIMIT 1",
        [rawKey]
      );
      if (existingRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: "PRODUCT_NOT_FOUND", message: "Product not found." },
        });
      }

      await db.query("DELETE FROM products WHERE id = $1", [existingRes.rows[0].id]);
      res.json({ success: true, data: { deletedSlug: existingRes.rows[0].slug } });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/customizations", async (req, res, next) => {
  try {
    const groupsRes = await db.query(
      "SELECT * FROM customization_groups ORDER BY display_order ASC, id ASC"
    );
    const groups = [];
    for (const g of groupsRes.rows) {
      const optsRes = await db.query(
        "SELECT * FROM customization_options WHERE group_id = $1 ORDER BY display_order ASC, id ASC",
        [g.id]
      );
      groups.push({
        id: g.slug,
        dbId: g.id,
        slug: g.slug,
        name: g.name,
        isRequired: g.is_required,
        minSelections: g.min_selections,
        maxSelections: g.max_selections,
        options: optsRes.rows.map((o) => ({
          id: o.slug,
          dbId: o.id,
          slug: o.slug,
          name: o.name,
          shortLabel: o.short_label || o.name,
          priceDeltaEgp: Number(o.price_delta_egp),
          isDefault: o.is_default,
          isAvailable: o.is_available,
        })),
      });
    }
    res.json({ success: true, data: groups });
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// 5. COUPON VALIDATION & TRANSACTIONAL ORDER PROCESSING (Stages 09 & 12E)
// =============================================================================

router.post("/coupons/validate", async (req, res, next) => {
  try {
    const { code, subtotalEgp = 0 } = req.body || {};
    if (!code || !String(code).trim()) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Promo code is required." },
      });
    }

    const normalizedCode = String(code).trim().toUpperCase();
    const couponRes = await db.query(
      "SELECT * FROM coupons WHERE UPPER(code) = $1 LIMIT 1",
      [normalizedCode]
    );

    if (couponRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: "COUPON_NOT_FOUND",
          message: `Promo code "${normalizedCode}" was not found.`,
        },
      });
    }

    const coupon = couponRes.rows[0];
    if (coupon.status !== "Active" || coupon.used_count >= coupon.usage_limit) {
      return res.status(422).json({
        success: false,
        error: {
          code: "COUPON_INACTIVE",
          message: `Promo code "${normalizedCode}" is no longer active.`,
        },
      });
    }

    const numericSubtotal = Math.max(0, Number(subtotalEgp) || 0);
    const minOrderEgp = Number(coupon.min_order_egp) || 0;
    if (numericSubtotal < minOrderEgp) {
      return res.status(422).json({
        success: false,
        error: {
          code: "COUPON_MIN_ORDER",
          message: `Promo code "${normalizedCode}" requires a minimum subtotal of ${minOrderEgp} EGP.`,
        },
      });
    }

    let discountEgp =
      coupon.discount_type === "percentage"
        ? Math.round(numericSubtotal * (Number(coupon.discount_value) / 100) * 100) / 100
        : Number(coupon.discount_value);

    if (coupon.max_discount_egp) {
      discountEgp = Math.min(discountEgp, Number(coupon.max_discount_egp));
    }
    discountEgp = Math.min(discountEgp, numericSubtotal);

    res.json({
      success: true,
      data: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discount_type,
        discountValue: Number(coupon.discount_value),
        minOrderEgp,
        discountEgp: Number(discountEgp.toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/orders", orderLimiter, async (req, res, next) => {
  try {
    const rawBody = req.body || {};
    const customerName = stripHtmlTags(rawBody.customerName);
    const customerPhone = stripHtmlTags(rawBody.customerPhone);
    const customerEmail = stripHtmlTags(rawBody.customerEmail || "");
    const fulfillmentType = rawBody.fulfillmentType || "pickup";
    const deliveryAddress = rawBody.deliveryAddress
      ? {
          streetAddress: stripHtmlTags(rawBody.deliveryAddress.streetAddress),
          city: stripHtmlTags(rawBody.deliveryAddress.city || "Cairo"),
          stateRegion: stripHtmlTags(rawBody.deliveryAddress.stateRegion || "Cairo"),
          postalCode: stripHtmlTags(rawBody.deliveryAddress.postalCode || "11511"),
          deliveryNotes: stripHtmlTags(rawBody.deliveryAddress.deliveryNotes || ""),
        }
      : null;
    const paymentMethod = rawBody.paymentMethod || "cash";
    const couponCode = stripHtmlTags(rawBody.couponCode || "");
    const tipRate = rawBody.tipRate || 0;
    const specialInstructions = stripHtmlTags(rawBody.specialInstructions || "");
    const items = rawBody.items || [];
    const idempotencyKey = stripHtmlTags(
      req.headers["idempotency-key"] || rawBody.idempotencyKey || ""
    );

    if (idempotencyKey && recentIdempotencyOrders.has(idempotencyKey)) {
      const cached = recentIdempotencyOrders.get(idempotencyKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        const existingOrder = await loadFullOrder("id", cached.orderId);
        if (existingOrder) {
          return res.status(200).json({
            success: true,
            data: { ...existingOrder, deduplicated: true },
          });
        }
      }
    }

    // 1. Basic Input Validation
    if (!customerName || !String(customerName).trim()) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Customer full name is required." },
      });
    }
    if (!customerPhone || String(customerPhone).replace(/\D/g, "").length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "A valid phone number (at least 8 digits) is required.",
        },
      });
    }
    if (!["pickup", "delivery"].includes(fulfillmentType)) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Fulfillment type must be pickup or delivery." },
      });
    }
    if (
      fulfillmentType === "delivery" &&
      (!deliveryAddress || !deliveryAddress.streetAddress || !String(deliveryAddress.streetAddress).trim())
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Delivery street address is required for delivery orders.",
        },
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: "EMPTY_ORDER", message: "Order must contain at least one item." },
      });
    }

    // 2. Transactional Server-Side Price & Stock Validation
    const createdOrderId = await db.withTransaction(async (tx) => {
      // Check store settings
      const settingsRes = await tx.query(
        "SELECT * FROM cafe_settings ORDER BY id ASC LIMIT 1"
      );
      const settings = settingsRes.rows[0];
      if (!settings.is_accepting_orders) {
        const pausedErr = new Error("Store is currently paused for online orders.");
        pausedErr.statusCode = 422;
        pausedErr.code = "STORE_PAUSED";
        throw pausedErr;
      }

      // Resolve all customization options once
      const allOptionsRes = await tx.query(
        `SELECT co.*, cg.name AS group_name, cg.slug AS group_slug
         FROM customization_options co
         JOIN customization_groups cg ON cg.id = co.group_id`
      );
      const optionMap = {};
      for (const opt of allOptionsRes.rows) {
        optionMap[opt.slug] = opt;
      }

      let subtotalPiastres = 0;
      const resolvedItems = [];

      for (const reqItem of items) {
        const qty = Number(reqItem.quantity);
        if (!Number.isInteger(qty) || qty <= 0 || qty > 50) {
          const qtyErr = new Error("Invalid item quantity.");
          qtyErr.statusCode = 400;
          qtyErr.code = "INVALID_QUANTITY";
          throw qtyErr;
        }

        const rawProdKey = String(reqItem.productId || "").trim();
        const prodKey = PRODUCT_SLUG_ALIASES[rawProdKey] || rawProdKey;

        const prodRes = await tx.query(
          `SELECT p.*, pi.image_url, inv.id AS inventory_id, inv.quantity_available, inv.is_tracked
           FROM products p
           LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
           LEFT JOIN inventory inv ON inv.product_id = p.id
           WHERE p.slug = $1 OR p.id::text = $1
           LIMIT 1`,
          [prodKey]
        );

        if (prodRes.rows.length === 0) {
          const notFoundErr = new Error(`Product "${rawProdKey}" does not exist.`);
          notFoundErr.statusCode = 404;
          notFoundErr.code = "PRODUCT_NOT_FOUND";
          throw notFoundErr;
        }

        const product = prodRes.rows[0];
        if (!product.is_available) {
          const unavailErr = new Error(`Product "${product.name}" is currently unavailable.`);
          unavailErr.statusCode = 422;
          unavailErr.code = "PRODUCT_UNAVAILABLE";
          throw unavailErr;
        }

        if (product.is_tracked && Number(product.quantity_available) < qty) {
          const stockErr = new Error(
            `Insufficient stock for "${product.name}" (${product.quantity_available} left).`
          );
          stockErr.statusCode = 422;
          stockErr.code = "INSUFFICIENT_STOCK";
          throw stockErr;
        }

        // Resolve customizations for this line item
        const selectedSlugs = [];
        if (Array.isArray(reqItem.selectedOptions)) {
          selectedSlugs.push(...reqItem.selectedOptions);
        } else if (reqItem.customizations && typeof reqItem.customizations === "object") {
          const c = reqItem.customizations;
          if (c.size) selectedSlugs.push(c.size);
          if (c.temperature) selectedSlugs.push(c.temperature);
          if (c.milk) selectedSlugs.push(c.milk);
          if (c.sugar) selectedSlugs.push(c.sugar);
          if (Array.isArray(c.addons)) selectedSlugs.push(...c.addons);
        }

        let optionsDeltaPiastres = 0;
        const resolvedOptions = [];
        const summaryLabels = [];

        if (product.is_customizable) {
          for (const optSlug of selectedSlugs) {
            const optRow = optionMap[optSlug];
            if (!optRow || !optRow.is_available) {
              const optErr = new Error(`Invalid customization option "${optSlug}".`);
              optErr.statusCode = 400;
              optErr.code = "INVALID_CUSTOMIZATION";
              throw optErr;
            }
            optionsDeltaPiastres += Number(optRow.price_delta_piastres);
            resolvedOptions.push(optRow);
            summaryLabels.push(optRow.name);
          }
        }

        const unitBasePiastres = Number(product.base_price_piastres);
        const unitFinalPiastres = unitBasePiastres + optionsDeltaPiastres;
        const lineTotalPiastres = unitFinalPiastres * qty;
        subtotalPiastres += lineTotalPiastres;

        resolvedItems.push({
          product,
          quantity: qty,
          unitBasePiastres,
          unitFinalPiastres,
          lineTotalPiastres,
          resolvedOptions,
          customizationSummary:
            summaryLabels.join(" · ") ||
            reqItem.customizationSummary ||
            (product.is_customizable ? "12 oz · Standard" : "Freshly prepared"),
          specialInstructions: reqItem.specialInstructions || "",
        });
      }

      // Coupon validation
      let couponId = null;
      let discountPiastres = 0;
      if (couponCode && String(couponCode).trim()) {
        const normalizedCode = String(couponCode).trim().toUpperCase();
        const couponRes = await tx.query(
          "SELECT * FROM coupons WHERE UPPER(code) = $1 LIMIT 1",
          [normalizedCode]
        );
        if (couponRes.rows.length > 0) {
          const coupon = couponRes.rows[0];
          const subtotalEgpCheck = subtotalPiastres / 100;
          if (
            coupon.status === "Active" &&
            coupon.used_count < coupon.usage_limit &&
            subtotalEgpCheck >= Number(coupon.min_order_egp)
          ) {
            couponId = coupon.id;
            if (coupon.discount_type === "percentage") {
              discountPiastres = Math.round(
                subtotalPiastres * (Number(coupon.discount_value) / 100)
              );
            } else {
              discountPiastres = Math.round(Number(coupon.discount_value) * 100);
            }
            if (coupon.max_discount_egp) {
              const maxCapPiastres = Math.round(Number(coupon.max_discount_egp) * 100);
              discountPiastres = Math.min(discountPiastres, maxCapPiastres);
            }
            discountPiastres = Math.min(discountPiastres, subtotalPiastres);

            await tx.query(
              "UPDATE coupons SET used_count = used_count + 1 WHERE id = $1",
              [coupon.id]
            );
          }
        }
      }

      const deliveryFeePiastres =
        fulfillmentType === "delivery" ? Number(settings.delivery_fee_piastres) : 0;

      const numericTipRate = Math.max(0, Math.min(0.5, Number(tipRate) || 0));
      const tipPiastres = Math.round(subtotalPiastres * numericTipRate);
      const taxPiastres = 0;

      const totalPiastres = Math.max(
        0,
        subtotalPiastres - discountPiastres + deliveryFeePiastres + tipPiastres + taxPiastres
      );

      // Upsert or create customer record
      let customerId = null;
      const existingCustRes = await tx.query(
        "SELECT id FROM customers WHERE phone = $1 OR (email IS NOT NULL AND email <> '' AND LOWER(email) = LOWER($2)) LIMIT 1",
        [String(customerPhone).trim(), String(customerEmail || "").trim()]
      );
      if (existingCustRes.rows.length > 0) {
        customerId = existingCustRes.rows[0].id;
        await tx.query(
          `UPDATE customers
           SET orders_count = orders_count + 1,
               total_spent_piastres = total_spent_piastres + $1,
               total_spent_egp = ROUND((total_spent_piastres + $1) / 100.0, 2),
               loyalty_points = loyalty_points + $2,
               last_visit_label = 'Today',
               updated_at = NOW()
           WHERE id = $3`,
          [totalPiastres, Math.max(5, Math.round(totalPiastres / 1000)), customerId]
        );
      } else {
        const newCust = await tx.query(
          `INSERT INTO customers (
            full_name, email, phone, loyalty_points, orders_count,
            total_spent_piastres, total_spent_egp, segment, last_visit_label
          ) VALUES ($1, $2, $3, $4, 1, $5, $6, 'New this month', 'Today')
          RETURNING id`,
          [
            String(customerName).trim(),
            String(customerEmail || "").trim() || null,
            String(customerPhone).trim(),
            Math.max(5, Math.round(totalPiastres / 1000)),
            totalPiastres,
            Number((totalPiastres / 100).toFixed(2)),
          ]
        );
        customerId = newCust.rows[0].id;
      }

      // Insert delivery address if delivery
      let addressId = null;
      let addressSnapshot = null;
      if (fulfillmentType === "delivery" && deliveryAddress) {
        addressSnapshot = [
          deliveryAddress.streetAddress,
          deliveryAddress.city || "Cairo",
          deliveryAddress.stateRegion || "",
          deliveryAddress.postalCode || "",
        ]
          .filter(Boolean)
          .join(", ");

        const addrRes = await tx.query(
          `INSERT INTO addresses (customer_id, street_address, city, state_region, postal_code, delivery_notes)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [
            customerId,
            deliveryAddress.streetAddress,
            deliveryAddress.city || "Cairo",
            deliveryAddress.stateRegion || "Cairo",
            deliveryAddress.postalCode || "11511",
            deliveryAddress.deliveryNotes || "",
          ]
        );
        addressId = addrRes.rows[0].id;
      }

      // Generate unique sequential order reference (#1051, #1052, ...)
      const maxRefRes = await tx.query(
        "SELECT COALESCE(MAX(order_reference::int), 1050) AS max_ref FROM orders WHERE order_reference ~ '^[0-9]+$'"
      );
      const nextOrderRef = String(Number(maxRefRes.rows[0].max_ref) + 1);

      const allergyFlag = /allergy|allergic|dairy free|gluten|nut/i.test(
        specialInstructions || ""
      );

      const normalizedPaymentMethod = ["cash", "card_on_pickup", "card_simulated"].includes(
        paymentMethod
      )
        ? paymentMethod
        : "cash";

      // Cash payments start as 'Pending' payment_status until collected at counter
      const initialPaymentStatus =
        normalizedPaymentMethod === "cash" ? "Pending" : "Paid";

      const orderInsertRes = await tx.query(
        `INSERT INTO orders (
          order_reference, customer_id, address_id, coupon_id,
          customer_name, customer_phone, customer_email,
          fulfillment_type, delivery_address_snapshot,
          status, payment_status, payment_method,
          subtotal_piastres, subtotal_egp,
          discount_piastres, discount_egp,
          delivery_fee_piastres, delivery_fee_egp,
          tip_piastres, tip_egp,
          tax_piastres, tax_egp,
          total_piastres, total_egp,
          special_instructions, allergy_flag, estimated_window
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9,
          'Pending', $10, $11,
          $12, $13,
          $14, $15,
          $16, $17,
          $18, $19,
          $20, $21,
          $22, $23,
          $24, $25, $26
        ) RETURNING id`,
        [
          nextOrderRef,
          customerId,
          addressId,
          couponId,
          String(customerName).trim(),
          String(customerPhone).trim(),
          String(customerEmail || "").trim() || null,
          fulfillmentType,
          addressSnapshot,
          initialPaymentStatus,
          normalizedPaymentMethod,
          subtotalPiastres,
          Number((subtotalPiastres / 100).toFixed(2)),
          discountPiastres,
          Number((discountPiastres / 100).toFixed(2)),
          deliveryFeePiastres,
          Number((deliveryFeePiastres / 100).toFixed(2)),
          tipPiastres,
          Number((tipPiastres / 100).toFixed(2)),
          taxPiastres,
          0.0,
          totalPiastres,
          Number((totalPiastres / 100).toFixed(2)),
          specialInstructions || "",
          allergyFlag,
          fulfillmentType === "delivery" ? "25–35 min" : "10–15 min",
        ]
      );
      const newOrderId = orderInsertRes.rows[0].id;

      // Insert order_items, order_item_customizations, and deduct inventory
      for (const ri of resolvedItems) {
        const oiRes = await tx.query(
          `INSERT INTO order_items (
            order_id, product_id, product_slug_snapshot, product_name_snapshot, product_image_snapshot,
            unit_base_price_piastres, unit_base_price_egp,
            unit_final_price_piastres, unit_final_price_egp,
            quantity, line_total_piastres, line_total_egp,
            customization_summary, special_instructions
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id`,
          [
            newOrderId,
            ri.product.id,
            ri.product.slug,
            ri.product.name,
            ri.product.image_url || "assets/images/product-iced-oat-latte.png",
            ri.unitBasePiastres,
            Number((ri.unitBasePiastres / 100).toFixed(2)),
            ri.unitFinalPiastres,
            Number((ri.unitFinalPiastres / 100).toFixed(2)),
            ri.quantity,
            ri.lineTotalPiastres,
            Number((ri.lineTotalPiastres / 100).toFixed(2)),
            ri.customizationSummary,
            ri.specialInstructions,
          ]
        );
        const orderItemId = oiRes.rows[0].id;

        for (const opt of ri.resolvedOptions) {
          await tx.query(
            `INSERT INTO order_item_customizations (
              order_item_id, option_id, group_name_snapshot, option_name_snapshot,
              price_delta_piastres, price_delta_egp
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              orderItemId,
              opt.id,
              opt.group_name,
              opt.name,
              opt.price_delta_piastres,
              Number(opt.price_delta_egp),
            ]
          );
        }

        if (ri.product.is_tracked && ri.product.inventory_id) {
          await tx.query(
            `UPDATE inventory
             SET quantity_available = GREATEST(0, quantity_available - $1), updated_at = NOW()
             WHERE id = $2`,
            [ri.quantity, ri.product.inventory_id]
          );
          await tx.query(
            `INSERT INTO inventory_movements (inventory_id, change_amount, reason, reference_order_id)
             VALUES ($1, $2, $3, $4)`,
            [
              ri.product.inventory_id,
              -ri.quantity,
              `Order #${nextOrderRef} checkout`,
              newOrderId,
            ]
          );
        }
      }

      // Insert payment record
      await tx.query(
        `INSERT INTO payments (
          order_id, payment_method, payment_status, amount_piastres, amount_egp
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          newOrderId,
          normalizedPaymentMethod,
          initialPaymentStatus,
          totalPiastres,
          Number((totalPiastres / 100).toFixed(2)),
        ]
      );

      return newOrderId;
    });

    const fullOrder = await loadFullOrder("id", createdOrderId);

    if (idempotencyKey) {
      recentIdempotencyOrders.set(idempotencyKey, {
        orderId: createdOrderId,
        timestamp: Date.now(),
      });
    }

    // Emit real-time Socket.IO event to Barista & Admin dashboards
    const io = req.app.get("io");
    if (io) {
      io.emit("order:created", fullOrder);
    }

    // Dispatch non-blocking Telegram notification
    sendNewOrderTelegramAlert(fullOrder).catch(() => {});

    res.status(201).json({
      success: true,
      data: fullOrder,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code || "ORDER_ERROR",
          message: err.message,
        },
      });
    }
    next(err);
  }
});

router.get("/orders/track/:reference", async (req, res, next) => {
  try {
    const ref = String(req.params.reference).replace(/^#/, "").trim();
    const order = await loadFullOrder("order_reference", ref);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ORDER_NOT_FOUND",
          message: `No order found with reference #${ref}.`,
        },
      });
    }

    // Check if caller is authenticated staff; otherwise redact PII on public tracking (BUG-002)
    const token = extractToken(req);
    const decodedStaff = token ? verifyToken(token) : null;
    const isStaff =
      decodedStaff && ["admin", "barista"].includes(decodedStaff.role);

    res.json({
      success: true,
      data: isStaff ? order : sanitizePublicTrackingOrder(order),
    });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/orders/:id",
  authenticate,
  requireRole("barista", "admin"),
  async (req, res, next) => {
    try {
      const idOrRef = String(req.params.id).replace(/^#/, "").trim();
      let order = null;
      if (/^\d+$/.test(idOrRef)) {
        order =
          (await loadFullOrder("id", Number(idOrRef))) ||
          (await loadFullOrder("order_reference", idOrRef));
      } else {
        order = await loadFullOrder("order_reference", idOrRef);
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: "ORDER_NOT_FOUND", message: "Order not found." },
        });
      }
      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/admin/orders",
  authenticate,
  requireRole("barista", "admin"),
  async (req, res, next) => {
    try {
      const { status, search } = req.query;
      const conditions = [];
      const params = [];

      if (status && status !== "all") {
        const statuses = String(status)
          .split(",")
          .map((s) => (s.trim() === "New" ? "Pending" : s.trim()));
        params.push(statuses);
        conditions.push(`status = ANY($${params.length})`);
      }

      if (search && String(search).trim()) {
        params.push(`%${String(search).trim().toLowerCase()}%`);
        conditions.push(
          `(LOWER(order_reference) LIKE $${params.length} OR LOWER(customer_name) LIKE $${params.length} OR LOWER(customer_phone) LIKE $${params.length})`
        );
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const ordersRes = await db.query(
        `SELECT * FROM orders ${whereClause} ORDER BY id DESC LIMIT 50`,
        params
      );

      const fullOrders = await hydrateOrderRowsBatch(ordersRes.rows);

      res.json({
        success: true,
        data: fullOrders,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/admin/orders/:id/status",
  authenticate,
  requireRole("barista", "admin"),
  async (req, res, next) => {
    try {
      const idOrRef = String(req.params.id).replace(/^#/, "").trim();
      const { status: rawTargetStatus, paymentStatus, rejectionReason = "" } = req.body || {};

      const targetStatus = rawTargetStatus === "New" ? "Pending" : rawTargetStatus;

      const existing =
        (await loadFullOrder("order_reference", idOrRef)) ||
        (/^\d+$/.test(idOrRef) ? await loadFullOrder("id", Number(idOrRef)) : null);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { code: "ORDER_NOT_FOUND", message: "Order not found." },
        });
      }

      if (targetStatus && targetStatus !== existing.status) {
        const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(targetStatus)) {
          return res.status(422).json({
            success: false,
            error: {
              code: "INVALID_STATUS_TRANSITION",
              message: `Cannot transition order #${existing.orderReference} from "${existing.status}" to "${targetStatus}". Allowed: ${
                allowed.join(", ") || "none (terminal status)"
              }.`,
            },
          });
        }
      }

      const nextStatus = targetStatus || existing.status;
      let nextPaymentStatus = paymentStatus || existing.paymentStatus;
      if (nextStatus === "Completed" && nextPaymentStatus === "Pending") {
        nextPaymentStatus = "Paid";
      }

      const timestampColMap = {
        Accepted: "accepted_at = NOW(),",
        Preparing: "preparing_at = NOW(),",
        Ready: "ready_at = NOW(),",
        Completed: "completed_at = NOW(),",
        Cancelled: "cancelled_at = NOW(),",
        Rejected: "cancelled_at = NOW(),",
      };
      const tsClause = timestampColMap[nextStatus] || "";

      await db.query(
        `UPDATE orders
         SET status = $1,
             payment_status = $2,
             rejection_reason = $3,
             ${tsClause}
             updated_at = NOW()
         WHERE id = $4`,
        [nextStatus, nextPaymentStatus, rejectionReason, existing.id]
      );

      if (paymentStatus) {
        await db.query(
          `UPDATE payments SET payment_status = $1 WHERE order_id = $2`,
          [nextPaymentStatus, existing.id]
        );
      }

      const updatedOrder = await loadFullOrder("id", existing.id);

      const io = req.app.get("io");
      if (io) {
        io.emit("order:updated", updatedOrder);
      }

      res.json({
        success: true,
        data: updatedOrder,
      });
    } catch (err) {
      next(err);
    }
  }
);

// =============================================================================
// 6. ADMIN OVERVIEW, ANALYTICS, CUSTOMERS, COUPONS, STAFF & SETTINGS
// =============================================================================

router.get(
  "/admin/overview",
  authenticate,
  requireRole("barista", "admin"),
  async (req, res, next) => {
    try {
      const statsRes = await db.query(
        `SELECT
           COUNT(*)::int AS total_orders,
           COUNT(*) FILTER (WHERE status IN ('Pending', 'Accepted', 'Preparing', 'Ready'))::int AS active_orders,
           COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed_orders,
           COALESCE(SUM(total_egp) FILTER (WHERE status <> 'Cancelled' AND status <> 'Rejected'), 0)::numeric(10,2) AS net_sales_egp,
           COALESCE(AVG(total_egp) FILTER (WHERE status <> 'Cancelled' AND status <> 'Rejected'), 0)::numeric(10,2) AS avg_order_egp
         FROM orders`
      );

      const lowStockRes = await db.query(
        `SELECT p.name, p.slug, inv.quantity_available, inv.low_stock_threshold
         FROM inventory inv
         JOIN products p ON p.id = inv.product_id
         WHERE inv.is_tracked = TRUE AND inv.quantity_available <= inv.low_stock_threshold
         ORDER BY inv.quantity_available ASC`
      );

      const topItemsRes = await db.query(
        `SELECT product_name_snapshot AS name, SUM(quantity)::int AS units_sold
         FROM order_items
         GROUP BY product_name_snapshot
         ORDER BY units_sold DESC
         LIMIT 4`
      );

      const settingsRes = await db.query(
        "SELECT * FROM cafe_settings ORDER BY id ASC LIMIT 1"
      );
      const staffCountRes = await db.query(
        "SELECT COUNT(*)::int AS on_shift FROM staff WHERE is_on_shift = TRUE"
      );

      const s = statsRes.rows[0];
      res.json({
        success: true,
        data: {
          netSalesEgp: Number(s.net_sales_egp),
          totalOrders: s.total_orders,
          activeOrders: s.active_orders,
          completedOrders: s.completed_orders,
          avgOrderEgp: Number(s.avg_order_egp),
          avgPrepMinutes: 6,
          oldestOrderMinutes: 9,
          staffOnShift: staffCountRes.rows[0].on_shift,
          isAcceptingOrders: settingsRes.rows[0].is_accepting_orders,
          pickupEstimate: settingsRes.rows[0].pickup_estimate_label,
          lowStockAlerts: lowStockRes.rows.map((r) => ({
            name: r.name,
            slug: r.slug,
            quantityAvailable: r.quantity_available,
          })),
          crowdFavorites: topItemsRes.rows,
          weeklySalesEgp: [
            { day: "Wed", salesEgp: 7850 },
            { day: "Thu", salesEgp: 7420 },
            { day: "Fri", salesEgp: 9120 },
            { day: "Sat", salesEgp: 10450 },
            { day: "Sun", salesEgp: 9680 },
            { day: "Mon", salesEgp: 8340 },
            { day: "Tue", salesEgp: Number(s.net_sales_egp) + 4680 },
          ],
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/admin/analytics",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: {
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
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/admin/customers",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { search, segment } = req.query;
      const conditions = [];
      const params = [];

      if (segment && segment !== "All customers") {
        params.push(String(segment));
        conditions.push(`segment = $${params.length}`);
      }
      if (search && String(search).trim()) {
        params.push(`%${String(search).trim().toLowerCase()}%`);
        conditions.push(
          `(LOWER(full_name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR LOWER(phone) LIKE $${params.length})`
        );
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const result = await db.query(
        `SELECT * FROM customers ${whereClause} ORDER BY total_spent_piastres DESC, id ASC`,
        params
      );

      res.json({
        success: true,
        data: result.rows.map((c) => ({
          id: c.id,
          fullName: c.full_name,
          email: c.email,
          phone: c.phone,
          ordersCount: c.orders_count,
          totalSpentEgp: Number(c.total_spent_egp),
          loyaltyPoints: c.loyalty_points,
          usualDrink: c.usual_drink,
          favoritePairing: c.favorite_pairing,
          segment: c.segment,
          lastVisit: c.last_visit_label,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/admin/customers/:id/points",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { loyaltyPoints } = req.body || {};
      const nextPts = Math.max(0, Number(loyaltyPoints) || 0);

      const updated = await db.query(
        `UPDATE customers SET loyalty_points = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [nextPts, Number(id)]
      );
      if (updated.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Customer not found." },
        });
      }
      res.json({
        success: true,
        data: {
          id: updated.rows[0].id,
          loyaltyPoints: updated.rows[0].loyalty_points,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/admin/coupons",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const result = await db.query("SELECT * FROM coupons ORDER BY id ASC");
      res.json({
        success: true,
        data: result.rows.map((c) => ({
          id: c.id,
          code: c.code,
          description: c.description,
          discountType: c.discount_type,
          discountValue: Number(c.discount_value),
          minOrderEgp: Number(c.min_order_egp),
          maxDiscountEgp: c.max_discount_egp ? Number(c.max_discount_egp) : null,
          usageLimit: c.usage_limit,
          usedCount: c.used_count,
          status: c.status,
          startsAt: c.starts_at,
          endsAt: c.ends_at,
          firstTimeOnly: c.first_time_only,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/admin/coupons",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const {
        code,
        description = "Promotional discount",
        discountType = "percentage",
        discountValue = 10,
        minOrderEgp = 0,
        maxDiscountEgp = 50,
        usageLimit = 200,
        status = "Active",
        startsAt = "Nov 24, 2026",
        endsAt = "Dec 31, 2026",
        firstTimeOnly = false,
      } = req.body || {};

      if (!code || !String(code).trim()) {
        return res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Discount code is required." },
        });
      }

      const inserted = await db.query(
        `INSERT INTO coupons (
          code, description, discount_type, discount_value, min_order_egp, max_discount_egp,
          usage_limit, status, starts_at, ends_at, first_time_only
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          String(code).trim().toUpperCase(),
          description,
          discountType === "fixed" ? "fixed" : "percentage",
          Number(discountValue) || 10,
          Number(minOrderEgp) || 0,
          Number(maxDiscountEgp) || null,
          Number(usageLimit) || 200,
          status,
          startsAt,
          endsAt,
          Boolean(firstTimeOnly),
        ]
      );

      res.status(201).json({ success: true, data: inserted.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/admin/coupons/:id",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        code,
        description,
        discountType,
        discountValue,
        minOrderEgp,
        maxDiscountEgp,
        usageLimit,
        status,
        endsAt,
        firstTimeOnly,
      } = req.body || {};

      const existing = await db.query(
        "SELECT * FROM coupons WHERE id::text = $1 OR UPPER(code) = UPPER($1) LIMIT 1",
        [String(id)]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Coupon not found." },
        });
      }
      const c = existing.rows[0];

      const updated = await db.query(
        `UPDATE coupons
         SET code = $1, description = $2, discount_type = $3, discount_value = $4,
             min_order_egp = $5, max_discount_egp = $6, usage_limit = $7,
             status = $8, ends_at = $9, first_time_only = $10
         WHERE id = $11
         RETURNING *`,
        [
          code !== undefined ? String(code).trim().toUpperCase() : c.code,
          description !== undefined ? description : c.description,
          discountType !== undefined ? discountType : c.discount_type,
          discountValue !== undefined ? Number(discountValue) : c.discount_value,
          minOrderEgp !== undefined ? Number(minOrderEgp) : c.min_order_egp,
          maxDiscountEgp !== undefined ? Number(maxDiscountEgp) : c.max_discount_egp,
          usageLimit !== undefined ? Number(usageLimit) : c.usage_limit,
          status !== undefined ? status : c.status,
          endsAt !== undefined ? endsAt : c.ends_at,
          firstTimeOnly !== undefined ? Boolean(firstTimeOnly) : c.first_time_only,
          c.id,
        ]
      );

      res.json({ success: true, data: updated.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/admin/staff",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT s.*, u.full_name, u.email, u.phone, u.is_active, r.name AS role
         FROM staff s
         JOIN users u ON u.id = s.user_id
         JOIN roles r ON r.id = u.role_id
         ORDER BY s.id ASC`
      );
      res.json({
        success: true,
        data: result.rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          employeeCode: r.employee_code,
          fullName: r.full_name,
          email: r.email,
          phone: r.phone,
          role: r.role,
          title: r.title,
          station: r.station,
          shiftLabel: r.shift_label,
          isOnShift: r.is_on_shift,
          isActive: r.is_active,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/admin/settings",
  authenticate,
  requireRole("barista", "admin"),
  async (req, res, next) => {
    try {
      const result = await db.query("SELECT * FROM cafe_settings ORDER BY id ASC LIMIT 1");
      const s = result.rows[0];
      res.json({
        success: true,
        data: {
          storeName: s.store_name,
          branchName: s.branch_name,
          addressLine: s.address_line,
          phone: s.phone,
          email: s.email,
          currencyCode: s.currency_code,
          isAcceptingOrders: s.is_accepting_orders,
          pickupEnabled: s.pickup_enabled,
          standardPrepMinutes: s.standard_prep_minutes,
          pickupBufferMinutes: s.pickup_buffer_minutes,
          maxActiveOrders: s.max_active_orders,
          deliveryEnabled: s.delivery_enabled,
          deliveryRadiusKm: Number(s.delivery_radius_km),
          deliveryFeeEgp: Number(s.delivery_fee_egp),
          deliveryMinOrderEgp: Number(s.delivery_min_order_egp),
          deliveryEstimateLabel: s.delivery_estimate_label,
          pickupEstimateLabel: s.pickup_estimate_label,
          openingHours: s.opening_hours_json,
          telegramNotificationsEnabled: s.telegram_notifications_enabled,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/admin/settings",
  authenticate,
  requireRole("barista", "admin"),
  async (req, res, next) => {
    try {
      const currentRes = await db.query("SELECT * FROM cafe_settings ORDER BY id ASC LIMIT 1");
      const s = currentRes.rows[0];

      // Baristas can only toggle `isAcceptingOrders`; full settings require `admin`
      if (req.user.role === "barista") {
        const nextAccepting =
          req.body.isAcceptingOrders !== undefined
            ? Boolean(req.body.isAcceptingOrders)
            : !s.is_accepting_orders;

        const updated = await db.query(
          "UPDATE cafe_settings SET is_accepting_orders = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
          [nextAccepting, s.id]
        );
        const io = req.app.get("io");
        if (io) io.emit("settings:updated", { isAcceptingOrders: nextAccepting });
        return res.json({
          success: true,
          data: { isAcceptingOrders: updated.rows[0].is_accepting_orders },
        });
      }

      const {
        isAcceptingOrders,
        pickupEnabled,
        standardPrepMinutes,
        pickupBufferMinutes,
        maxActiveOrders,
        deliveryEnabled,
        deliveryRadiusKm,
        deliveryFeeEgp,
        deliveryMinOrderEgp,
        deliveryEstimateLabel,
      } = req.body || {};

      const nextFeeEgp =
        deliveryFeeEgp !== undefined ? Number(deliveryFeeEgp) : Number(s.delivery_fee_egp);
      const nextFeePiastres = Math.round(nextFeeEgp * 100);

      const updated = await db.query(
        `UPDATE cafe_settings
         SET is_accepting_orders = $1,
             pickup_enabled = $2,
             standard_prep_minutes = $3,
             pickup_buffer_minutes = $4,
             max_active_orders = $5,
             delivery_enabled = $6,
             delivery_radius_km = $7,
             delivery_fee_egp = $8,
             delivery_fee_piastres = $9,
             delivery_min_order_egp = $10,
             delivery_estimate_label = $11,
             updated_at = NOW()
         WHERE id = $12
         RETURNING *`,
        [
          isAcceptingOrders !== undefined ? Boolean(isAcceptingOrders) : s.is_accepting_orders,
          pickupEnabled !== undefined ? Boolean(pickupEnabled) : s.pickup_enabled,
          standardPrepMinutes !== undefined ? Number(standardPrepMinutes) : s.standard_prep_minutes,
          pickupBufferMinutes !== undefined ? Number(pickupBufferMinutes) : s.pickup_buffer_minutes,
          maxActiveOrders !== undefined ? Number(maxActiveOrders) : s.max_active_orders,
          deliveryEnabled !== undefined ? Boolean(deliveryEnabled) : s.delivery_enabled,
          deliveryRadiusKm !== undefined ? Number(deliveryRadiusKm) : Number(s.delivery_radius_km),
          nextFeeEgp,
          nextFeePiastres,
          deliveryMinOrderEgp !== undefined ? Number(deliveryMinOrderEgp) : Number(s.delivery_min_order_egp),
          deliveryEstimateLabel !== undefined ? deliveryEstimateLabel : s.delivery_estimate_label,
          s.id,
        ]
      );

      const io = req.app.get("io");
      if (io) io.emit("settings:updated", updated.rows[0]);

      res.json({
        success: true,
        data: updated.rows[0],
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
