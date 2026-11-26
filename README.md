# Common Ground — Café E-Commerce & Order Management Platform

A production-grade, full-stack digital ordering and café operations platform engineered for the Egyptian specialty coffee market (**Egyptian Pound — `EGP`**). Built from the **Common Ground** Figma specification (`cLmY3V9xPDvztKakpCxTvG`) using **Semantic HTML5**, **Modular CSS3 Custom Properties**, **Vanilla ES6+ JavaScript**, **Node.js**, **Express.js**, **Socket.IO**, **PostgreSQL**, and the **Telegram Bot API**.

---

## 1. Platform Architecture & Interfaces

The system unifies three role-specific interfaces backed by a transactional Express/PostgreSQL server and real-time Socket.IO event bus:

1. **Customer-Facing Storefront**
   - [index.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/index.html) (`01 · Storefront`): Brand hero, EGP neighborhood favorites with 1-click `+ Add`, origin story callout, and synced bag counter.
   - [menu.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/menu.html) (`02 · Order menu` & `12 · Mobile menu`): Dynamic 18-product EGP catalog across 5 categories (`Coffee`, `Cold Drinks`, `Bakery`, `Sandwiches`, `Seasonal`), live search, sorting, Sold-Out badges, and persistent right-hand `Your bag` drawer.
   - [product.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/product.html) (`03 · Customize drink` & `13 · Mobile customize`): Size (`12 oz`, `16 oz +15 EGP`), Temperature (`Hot`, `Iced`), Milk (`Whole`, `Oat +20 EGP`, `Almond +20 EGP`, `Skim`), Sweetness (`Regular`, `Less sweet`, `Extra sweet`, `Unsweetened`), Add-ons (`Extra espresso shot +25 EGP`, `Vanilla syrup +15 EGP`, `Caramel drizzle +15 EGP`), special barista notes, and live EGP price calculation.
   - [checkout.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/checkout.html) (`04 · Checkout` & `14 · Mobile checkout`): Pickup (`Free`) vs. Delivery (`25 EGP`) toggle, conditional delivery address validation, contact phone validation, promo codes (`WELCOME10`, `MORNING25`, `FREEDELIVERY`), tip selector, and server-authoritative order creation (`POST /api/orders`).
   - [tracking.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/tracking.html) (`05 · Order confirmed` & `15 · Mobile tracking`): Live 4-stage progress stepper (`Confirmed` → `Preparing` → `Ready for pickup` → `Picked up`) powered by real-time Socket.IO `order:status_updated` events.
   - [orders.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/orders.html) (`06 · My orders`) & [signin.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/signin.html) (`17 · Sign in`): Customer order history with 1-click reorder and Regulars Club loyalty progress.

2. **Barista Live Orders Workspace**
   - [barista.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/barista.html) (`07 · Barista live orders` & `22 · Mobile operations`): High-contrast dark workspace (`#1A1512`) with live status filter tabs (`All active`, `New`, `Preparing`, `Ready`, `Completed`), channel filters (`Pickup`, `Delivery`), 2-column ticket card grid with highlighted oat-milk/extra-shot tags and customer allergy notes, right-hand ticket inspector drawer, and 1-click status transitions (`Start preparing →`, `Mark ready →`, `Mark picked up`).

3. **Admin Management Console**
   - [admin.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/admin.html) (`08 · Admin overview`, `09 · Admin orders`, `10 · Menu management`, `11 · Store settings`, `19 · Customers & loyalty`, `20 · Discounts`, `21 · Sales analytics`): Full back-office management portal with 7 interactive modules:
     - **Overview**: Daily EGP revenue, order volume, average ticket value, hourly traffic chart, top sellers, and low-stock inventory alerts.
     - **Orders**: Searchable/filterable order table with CSV export and order status controls.
     - **Menu & Inventory**: Full CRUD modal for adding, editing, deleting, and toggling availability (`In stock` / `Sold out`) on products and stock quantities.
     - **Customers & Loyalty**: Regulars Club CRM directory with loyalty points and total EGP spend.
     - **Discounts**: Promo code creation and status toggling.
     - **Sales Analytics**: Category revenue breakdown and payment method split.
     - **Store Settings**: Operating hours, pickup/delivery prep times, VAT percentage, delivery fee, and Telegram notification status.

---

## 2. Seeded EGP Product Catalog (18 Items)

| Category | Product Name | Slug | Base Price (EGP) |
| :--- | :--- | :--- | :--- |
| **Coffee** | Spanish Latte | `spanish-latte` | **95 EGP** |
| **Coffee** | Caramel Latte | `caramel-latte` | **105 EGP** |
| **Coffee** | Americano | `americano` | **70 EGP** |
| **Coffee** | Cappuccino | `cappuccino` | **85 EGP** |
| **Coffee** | Flat White | `flat-white` | **90 EGP** |
| **Coffee** | Hot Chocolate | `hot-chocolate` | **85 EGP** |
| **Cold Drinks** | Iced Matcha | `iced-matcha` | **110 EGP** |
| **Cold Drinks** | Iced Chocolate | `iced-chocolate` | **95 EGP** |
| **Cold Drinks** | Iced Spanish Latte | `iced-spanish-latte` | **100 EGP** |
| **Cold Drinks** | Iced Americano | `iced-americano` | **75 EGP** |
| **Cold Drinks** | Iced Caramel Macchiato | `iced-caramel-macchiato` | **115 EGP** |
| **Bakery** | Chocolate Brownie | `chocolate-brownie` | **75 EGP** |
| **Bakery** | Butter Croissant | `butter-croissant` | **65 EGP** |
| **Bakery** | Cheesecake | `cheesecake` | **110 EGP** |
| **Bakery** | Cinnamon Roll | `cinnamon-roll` | **85 EGP** |
| **Sandwiches** | Chicken Sandwich | `chicken-sandwich` | **145 EGP** |
| **Sandwiches** | Turkey Croissant | `turkey-croissant` | **125 EGP** |
| **Sandwiches** | Grilled Cheese Sandwich | `grilled-cheese-sandwich` | **115 EGP** |

---

## 3. Quick Start & Local Development

### Prerequisites
- **Node.js** `>= 20.0.0`
- **PostgreSQL**: Works out-of-the-box with zero external daemon setup using embedded PostgreSQL 16 (`@electric-sql/pglite` persisted in `./.pgdata`), or connects to any external PostgreSQL server via `DATABASE_URL` in `.env`.

### Installation & Startup
```bash
# 1. Install dependencies
npm install

# 2. Run PostgreSQL schema migration & seed the 18 EGP products + sample orders
npm run db:seed

# 3. Start the full-stack Express + Socket.IO server on port 8090
npm start
```

Open in your browser:
- **Customer Storefront**: `http://localhost:8090/index.html`
- **Order Menu**: `http://localhost:8090/menu.html`
- **Barista Live Queue**: `http://localhost:8090/barista.html`
- **Admin Console**: `http://localhost:8090/admin.html`
- **API Health Check**: `http://localhost:8090/api/health`

### Default Staff Credentials (Seeded in PostgreSQL)

| Role | Email | Password | Portal |
| :--- | :--- | :--- | :--- |
| **Admin / Store Manager** | `sam.rivera@commonground.coffee` | `CommonGroundAdmin2026!` | [admin.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/admin.html) & [barista.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/barista.html) |
| **Lead Barista** | `jamie@commonground.coffee` | `CommonGroundBarista2026!` | [barista.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/barista.html) |

*(Both internal dashboards also include one-click quick sign-in buttons in the login modal for rapid testing.)*

---

## 4. Running Automated Tests

Execute the full-stack automated verification suite (19 tests covering PostgreSQL schema, 18 EGP products, authentication, RBAC, SQL injection resistance, authoritative server-side order pricing, inventory stock deduction, and order lifecycle state transitions):

```bash
npm test
```

---

## 5. Engineering Documentation Suite

- [PROJECT_REQUIREMENTS.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/PROJECT_REQUIREMENTS.md) — Business domain, personas, functional & non-functional requirements, and user journeys.
- [ARCHITECTURE.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/ARCHITECTURE.md) — Layered system architecture, component diagrams, order state machine, and real-time event flows.
- [DATABASE_SCHEMA.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/DATABASE_SCHEMA.md) — Complete 20-table PostgreSQL relational schema, foreign keys, constraints, and indexing strategy.
- [API_DOCUMENTATION.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/API_DOCUMENTATION.md) — REST API endpoint reference, JSON request/response schemas, RBAC rules, and Socket.IO payloads.
- [IMPLEMENTATION_STATUS.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/IMPLEMENTATION_STATUS.md) — Stage 1–19 completion matrix and requirements traceability table.
- [CODEBASE_AUDIT.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/CODEBASE_AUDIT.md) — Architectural review, code quality findings, and technical debt audit.
- [BUG_TRACKER.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/BUG_TRACKER.md) — Tracked defects (`BUG-001` through `BUG-010`), root causes, fixes, and verification status.
- [TESTING_STRATEGY.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/TESTING_STRATEGY.md) & [TEST_RESULTS.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/TEST_RESULTS.md) — 4-tier testing strategy and 21-test execution results.
- [SECURITY_AUDIT.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/SECURITY_AUDIT.md) — Security findings, PII redaction, XSS/SQLi prevention, and RBAC verification.
- [PERFORMANCE_REPORT.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/PERFORMANCE_REPORT.md) — N+1 SQL query elimination benchmarks (`201 -> 3` queries) and Core Web Vitals optimization.
- [ENHANCEMENTS.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/ENHANCEMENTS.md) — Customer, Barista, and Admin UX/operational enhancements.
- [ARABIC_LOCALIZATION_AUDIT.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/ARABIC_LOCALIZATION_AUDIT.md) & [ARABIC_GLOSSARY.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/ARABIC_GLOSSARY.md) — RTL structural audit and official English ↔ Arabic café terminology glossary.
- [LOCALIZATION_IMPLEMENTATION.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/LOCALIZATION_IMPLEMENTATION.md) & [BILINGUAL_TEST_RESULTS.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/BILINGUAL_TEST_RESULTS.md) — Bilingual i18n architecture, Arabic typography (`Cairo` & `IBM Plex Sans Arabic`), `EGP / ج.م.` locale formatting, and 24-test verification report.
- [TESTING_REPORT.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/TESTING_REPORT.md) — Automated test suite report, security audit, and WCAG 2.1 AA accessibility verification.
- [DEPLOYMENT_GUIDE.md](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/DEPLOYMENT_GUIDE.md) — Environment configuration, PostgreSQL backup/restore commands, and cloud deployment guide.
