# SYSTEM ARCHITECTURE & TECHNOLOGY STACK (Stages 05–08)

## 1. Architectural Overview

Common Ground uses a **Layered Modular Full-Stack Architecture** designed for high maintainability, strict separation of concerns, and zero frontend framework lock-in:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER (Vanilla ES6+)                    │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐  │
│  │ Customer Storefront  │  │  Barista Workspace   │  │  Admin Dashboard  │  │
│  │ index, menu, product │  │    barista.html      │  │    admin.html     │  │
│  │ checkout, tracking   │  │  Live Kanban Queue   │  │ 7 Management Tabs │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └─────────┬─────────┘  │
│             └─────────────────────────┼────────────────────────┘            │
│                                       ▼                                     │
│             Frontend Service Layer (js/services/*.js + Socket.IO)           │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ REST JSON API (/api/*) + WebSockets
┌───────────────────────────────────────▼─────────────────────────────────────┐
│                        APPLICATION LAYER (Node.js + Express)                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Security & Middleware: Helmet, CORS, Rate Limiter, Auth/RBAC, Logger  │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│  ┌─────────────────┐  ┌──────────────▼──────────────┐  ┌─────────────────┐  │
│  │ Auth & Staff    │  │ Catalog & Inventory Service │  │ Order & Payment │  │
│  │ Controllers     │  │ Products, Categories, Opts  │  │ Transaction Svc │  │
│  └────────┬────────┘  └──────────────┬──────────────┘  └────────┬────────┘  │
│           │                          │                          │           │
│           │                          │                 ┌────────▼────────┐  │
│           │                          │                 │ Integrations    │  │
│           │                          │                 │ Socket.IO +     │  │
│           │                          │                 │ Telegram Bot    │  │
│           │                          │                 └─────────────────┘  │
└───────────┼──────────────────────────┼──────────────────────────┼───────────┘
            └──────────────────────────┼──────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER (PostgreSQL Relational DB)                │
│   20 Normalized Tables · ACID Transactions · Historical Price Snapshots     │
│   Supports external PostgreSQL (`pg` Pool via DATABASE_URL) AND embedded    │
│   persistent PostgreSQL 16 (`@electric-sql/pglite` in `./.pgdata`)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack Validation (Stage 07)

| Layer | Technology | Justification |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5, CSS3 Custom Properties, Vanilla JavaScript (ES6 Modules) | Zero build-step latency, 100% adherence to the Common Ground Figma Design System (`16 · UI foundations`), fast Core Web Vitals, and clean DOM manipulation. |
| **Backend Runtime & API** | Node.js (v20+) + Express.js | Unified JavaScript stack across client and server, clean middleware pipeline for validation, authentication, and centralized error handling. |
| **Relational Database** | PostgreSQL (`pg` + `@electric-sql/pglite`) | Relational integrity across 20 entities, ACID transactions for multi-table order creation and inventory deduction, exact `NUMERIC(10,2)` / integer minor-unit (`piastres`) currency representation. Dual-driver adapter connects to managed cloud Postgres when `DATABASE_URL` is configured, and automatically runs real PostgreSQL 16 via PGlite locally so tests and local development work with zero external daemon setup. |
| **Real-Time Engine** | Socket.IO | Instant bidirectional events (`order:created`, `order:updated`, `product:updated`, `settings:updated`) between Customer Tracking, Barista Kanban, and Admin Overview, with automatic HTTP polling fallback. |
| **Notifications** | Telegram Bot API (via native `fetch`) | Lightweight, zero-cost instant push alerts to café staff mobile devices when new orders arrive; isolated inside a non-blocking try/catch service. |

---

## 3. Security Architecture

1. **Password Storage**: Uses Node's cryptographic `crypto.scryptSync` with per-user 16-byte random salts and `crypto.timingSafeEqual` verification. Plaintext passwords are never stored or logged.
2. **Stateless Signed Authentication Tokens**: Staff and Admin sessions use HMAC-SHA256 signed tokens (`Authorization: Bearer <token>` and `httpOnly` cookies) carrying user ID, role (`admin`, `barista`, `customer`), and expiration timestamp.
3. **Role-Based Access Control (RBAC)**:
   - Public endpoints: `GET /api/products`, `GET /api/categories`, `GET /api/customizations`, `POST /api/orders`, `GET /api/orders/track/:reference`.
   - Staff endpoints (`barista` or `admin`): `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`, `GET /api/admin/overview`.
   - Admin-only endpoints (`admin`): Product/Category/Customization/Coupon/Staff/Settings mutations (`POST`, `PATCH`, `DELETE`).
4. **Server-Side Order Calculation**: `POST /api/orders` ignores any client-side price totals and computes every item base price, variant delta, customization option delta, coupon rules, and delivery fee directly from PostgreSQL rows inside `BEGIN ... COMMIT`.
5. **Parameterized SQL Queries**: Every SQL query uses positional `$1, $2, ...` parameters to eliminate SQL injection vectors.
6. **XSS & HTTP Hardening**: `helmet` security headers, strict input sanitization, and DOM rendering via `textContent` / `createElement`.
