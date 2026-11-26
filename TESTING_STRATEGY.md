# Comprehensive Testing Strategy
## Common Ground — Café E-Commerce & Order Management Platform

---

## 1. Testing Architecture & Philosophy

Our verification strategy follows a 4-tier testing pyramid using Node's native test runner (`node:test`, `node:assert/strict`), `supertest`, an isolated in-memory PostgreSQL 16 database (`@electric-sql/pglite` in `memory://` mode), and real Chromium browser automation via our browser subagent:

1. **Tier 1 — Isolated Unit Tests**:
   - Currency formatting (`formatPrice`) across integer, fractional, zero, and boundary EGP values.
   - Product price & customization delta calculations (`productService.calculateUnitPrice`, `productService.queryProducts`).
   - Cryptographic utilities (`hashPassword`, `verifyPassword`, `signToken`, `verifyToken`, expired token rejection, tampered signature rejection).
   - Input sanitization & Telegram Markdown escaping (`escapeTelegramMarkdown`).
2. **Tier 2 — Backend API & Database Integration Tests**:
   - All 20 PostgreSQL tables, foreign keys, and seeded 18-item EGP catalog (`GET /api/health`, `GET /api/settings/public`, `GET /api/categories`, `GET /api/products`, `GET /api/products/:slug`, `GET /api/customizations`).
   - Coupon validation endpoint (`POST /api/coupons/validate`) for active percentage coupons (`WELCOME10`), minimum-order threshold coupons (`COFFEEONUS` min 200 EGP), and invalid/expired codes.
   - Transactional order processing (`POST /api/orders`): server-side price recalculation ignoring spoofed client prices, inventory stock deduction, `inventory_movements` audit trail creation, and rollback on `422 INSUFFICIENT_STOCK`.
   - Idempotency & duplicate order prevention (`Idempotency-Key` deduplication on `POST /api/orders`).
3. **Tier 3 — Security, RBAC & Data Privacy Tests**:
   - Authentication failure (`401 INVALID_CREDENTIALS`), missing token (`401 UNAUTHORIZED`), tampered token (`401 INVALID_TOKEN`).
   - Role-Based Access Control (`barista` blocked from `POST /api/products`, `DELETE /api/products/:id`, `GET /api/admin/analytics`, `GET /api/admin/customers`, `POST /api/admin/coupons` with `403 FORBIDDEN`).
   - Public tracking privacy (`GET /api/orders/track/:reference` redacts sensitive customer phone, email, and street address while authenticated `/api/orders/:id` returns full details to staff).
   - SQL Injection resilience (`' OR 1=1; DROP TABLE products; --`) and Stored XSS input sanitization (`<script>alert(1)</script>` stripped from order fields).
4. **Tier 4 — End-to-End (E2E) User Journey & Cross-Viewport Browser Verification**:
   - **Customer Journey**: Browse menu → filter categories → customize drink → add to bag → validate coupon → submit checkout → verify bag clears → track live order status.
   - **Barista Journey**: Authenticate → view incoming order in `New` queue → transition `Pending` → `Accepted` → `Preparing` → `Ready` → `Completed` → verify invalid backward transition (`Completed` → `Preparing`) is rejected with `422`.
   - **Admin Journey**: Authenticate → create category & product → toggle product availability (`Sold out`) → create coupon → verify new coupon validates at checkout → inspect analytics & store settings.
   - **Responsive Viewports**: Verified across Desktop (`1440px`), Tablet (`768px`), and Mobile (`390px`).
