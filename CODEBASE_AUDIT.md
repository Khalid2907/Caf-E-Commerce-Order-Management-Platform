# Codebase Architecture & Quality Audit Report
## Common Ground — Café E-Commerce & Order Management Platform

- **Audit Date**: November 26, 2026
- **Baseline Test Suite**: 18 / 18 tests passing (`971.8ms`)
- **Baseline Dependency Audit (`npm audit`)**: `0` vulnerabilities across runtime and dev dependencies
- **Target Market & Currency**: Egypt · Egyptian Pound (`EGP`, integer minor units in `piastres`)

---

## 1. Executive Architecture Assessment

The platform is structured as a modular full-stack web application adhering strictly to the project constraints:
- **Frontend Layer**: 9 HTML5 entry points (`index.html`, `menu.html`, `product.html`, `checkout.html`, `tracking.html`, `orders.html`, `signin.html`, `barista.html`, `admin.html`), modular CSS3 architecture (`css/tokens.css`, `css/base.css`, `css/layout.css`, `css/components.css`, `css/pages/*.css`), and Vanilla ES6 JavaScript modules (`js/config/`, `js/data/`, `js/services/`, `js/components/`, `js/pages/`).
- **Backend Layer**: Node.js + Express.js REST API (`server/index.js`, `server/routes/api.js`), stateless HMAC-SHA256 authentication & RBAC middleware (`server/middleware/auth.js`, `server/utils/crypto.js`), Socket.IO real-time event server, and non-blocking Telegram Bot API order notifications (`server/services/telegramService.js`).
- **Database Layer**: 20-table normalized PostgreSQL schema (`server/db/migrations/001_initial_schema.sql`) with dual-driver execution (`pg` connection pool for external `DATABASE_URL` and `@electric-sql/pglite` embedded PostgreSQL 16 for local development, tests, and serverless cold starts).

---

## 2. Detailed Code Quality Audit Findings

### 2.1 Frontend Vanilla JavaScript Audit
- **Strengths**:
  - Clean separation between domain services (`apiClient.js`, `productService.js`, `cartService.js`, `orderService.js`, `storageService.js`), reusable UI components (`header.js`, `productCard.js`, `toast.js`), and page controllers (`js/pages/*.js`).
  - Zero global namespace pollution; all scripts use native ES6 modules (`<script type="module">`).
  - Post-interaction form validation using `:user-invalid` and ARIA attributes (`aria-invalid`, `aria-describedby`).
- **Identified Weaknesses**:
  1. **Post-Checkout Cart State (`BUG-001`)**: `js/pages/checkout.js` does not clear `cartService` upon successful order creation, leaving purchased items in the customer's bag.
  2. **Unsafe `innerHTML` in Admin Tables (`BUG-003`)**: `js/pages/admin.js` uses `innerHTML` with unescaped template literals when rendering customer names, emails, coupon codes, and staff rows, creating a Stored XSS vector if a customer submits HTML tags in their name.
  3. **Sold-Out Product Button State (`BUG-007`)**: `js/pages/menu.js` and `js/components/productCard.js` render an active `+ Add` button even when `product.available === false`, failing silently when clicked.
  4. **Hardcoded Client Promo Dictionary (`BUG-005`)**: `js/pages/checkout.js` validates promo codes against a static `PROMO_CODES` constant (`COFFEEONUS = 30 EGP`) instead of querying the backend `coupons` table (`COFFEEONUS = 50 EGP, min 200 EGP`), causing client/server discount mismatches and ignoring newly created Admin coupons.
  5. **Static Admin Analytics Panel (`BUG-010`)**: `js/pages/admin.js` did not fetch `/api/admin/analytics` to hydrate the Analytics panel dynamically.

### 2.2 Backend & API Quality Audit
- **Strengths**:
  - Consistent `{ success, data, error: { code, message } }` JSON envelope and centralized Express error middleware.
  - Authoritative server-side price calculation in integer piastres (`base_price_piastres`, `price_delta_piastres`) inside a `BEGIN ... COMMIT` PostgreSQL transaction.
  - Strict order state machine (`ALLOWED_STATUS_TRANSITIONS`) preventing illegal backward transitions.
- **Identified Weaknesses**:
  1. **Unauthenticated PII Exposure on Public Tracking (`BUG-002`)**: `GET /api/orders/track/:reference` returns the full unredacted customer phone, email, and street address for sequential order numbers (`#1043`–`#1050`).
  2. **Missing Order Idempotency / Duplicate Submission Guard (`BUG-006`)**: `POST /api/orders` lacks an idempotency key or short-window duplicate request guard, allowing double-taps or network retries to create duplicate orders and double-deduct stock.
  3. **Environment Variable Naming Mismatch (`BUG-008`)**: `server/utils/crypto.js` reads `process.env.AUTH_TOKEN_SECRET` while `.env.example` and tests configure `process.env.JWT_SECRET`.
  4. **Telegram Markdown Entity Fragility (`BUG-009`)**: `server/services/telegramService.js` interpolates raw customer names and special instructions into Telegram `parse_mode: "Markdown"` payloads without escaping `_`, `*`, or `` ` ``.

### 2.3 Database & Query Performance Audit
- **Strengths**:
  - All 20 tables enforce primary keys, foreign keys, `CHECK` constraints on monetary columns and status enums, and B-tree indexes on lookup columns.
  - `order_items` and `order_item_customizations` store immutable snapshots (`product_name_snapshot`, `unit_base_price_piastres`, `unit_final_price_piastres`, `option_name_snapshot`, `price_delta_piastres`) so historical receipts never mutate when an admin edits catalog prices.
- **Identified Weaknesses**:
  1. **Severe N+1 Query Pattern in `GET /api/admin/orders` (`BUG-004`)**: `GET /api/admin/orders` fetches up to 50 order IDs and calls `loadFullOrder()` in a loop, which queries `orders`, then `order_items`, and then loops over each item to query `order_item_customizations`. Fetching 50 orders with 2 items each triggers `201` sequential SQL queries instead of 3 batched `ANY($1)` queries.
  2. **N+1 Query Pattern in `fetchCustomizationGroupsForProduct` (`BUG-004b`)**: Queries `customization_options` inside a `for` loop over each customization group instead of a single `WHERE group_id = ANY($1)` query.
