# PROJECT REQUIREMENTS & BUSINESS ANALYSIS (Stages 01–04)

## Stage 01 — Business Analysis & Operational Context

### 1.1 Business Overview
- **Project Name**: Common Ground — Café E-Commerce & Order Management Platform
- **Domain**: Specialty Café / Coffee Shop / Food & Beverage
- **Target Market & Currency**: Egypt — **Egyptian Pound (`EGP`)**
- **Primary Objective**: Deliver an end-to-end digital ordering ecosystem connecting customers, baristas, and café management in real time.

### 1.2 Operational Workflows & Pain Points Solved
| Workflow | Legacy Problem | Digital Platform Solution |
| :--- | :--- | :--- |
| **Customer Ordering** | Long counter queues during morning rush; misheard milk/sugar/allergy customizations. | Self-service mobile/desktop storefront with structured customization groups, dynamic server-verified pricing, and ahead-of-time pickup or local delivery. |
| **Barista Order Intake** | Paper tickets or verbal handoffs lost during peak volume; unclear allergy notes. | Dedicated **Barista Live Workspace (`barista.html`)** with real-time Socket.IO order push, visual urgency badges (`NEEDS ATTENTION`), prominent allergy/instruction banners, and one-tap status transitions (`New` → `Preparing` → `Ready` → `Completed`). |
| **Menu & Stock Control** | Customers ordering sold-out pastries (`Almond croissant`, `Butter croissant`) before staff can update boards. | Real-time inventory tracking & instant availability toggles in the **Admin Dashboard (`admin.html`)** that immediately prevent checkout of out-of-stock items on the backend. |
| **Order Notifications** | Staff missing new web orders while steaming milk or away from the counter. | Sound alerts on the Barista Dashboard plus automated server-side **Telegram Bot API** notifications on every new order. |

### 1.3 Stakeholders & User Roles
1. **Guest / Registered Customer (`customer`)**: Browses menu, customizes drinks, places pickup/delivery orders, tracks order status in real time, and views past order history / Regulars Club points.
2. **Barista / Café Staff (`barista`)**: Authenticates into the Barista Workspace, receives live orders, accepts/rejects orders, advances preparation stages, and monitors active queue metrics.
3. **Café Owner / Manager (`admin`)**: Full role-based access to business overview KPIs, menu/product CRUD, category CRUD, customization options, pricing, stock availability, order refunds/cancellations, customer loyalty points, promo discounts, staff accounts, and café settings.

---

## Stage 02 — Software Requirements Specification (SRS)

### 2.1 Functional Requirements

#### Customer Requirements (`FR-CUST`)
- **`FR-CUST-01`**: Browse products dynamically retrieved from `GET /api/products`.
- **`FR-CUST-02`**: Filter products by category (`GET /api/categories`) and search by keyword or sort by price/name.
- **`FR-CUST-03`**: View product details (`GET /api/products/:id`) including available variants and assigned customization groups (`Size`, `Temperature`, `Milk type`, `Sugar level`, `Add-ons / Syrups / Toppings`).
- **`FR-CUST-04`**: Dynamically calculate customized item prices and persist shopping bag state across pages.
- **`FR-CUST-05`**: Complete guest or signed-in checkout (`POST /api/orders`) supporting Pickup or Delivery, phone number validation, conditional address validation, promo codes, tips, and Cash / Card-on-pickup payment status tracking.
- **`FR-CUST-06`**: Receive a unique order reference (e.g., `#1051`) and track live status updates (`GET /api/orders/track/:reference` + Socket.IO room updates).

#### Barista Requirements (`FR-BAR`)
- **`FR-BAR-01`**: Authenticate via staff credentials (`POST /api/auth/login`) with role verification (`barista` or `admin`).
- **`FR-BAR-02`**: View live queue grouped by stage (`Pending/New`, `Accepted/Preparing`, `Ready`, `Completed`) with order age, customer details, itemized customizations, and special instructions.
- **`FR-BAR-03`**: Execute validated state transitions (`PATCH /api/admin/orders/:id/status`) — `Accept`, `Reject`, `Start Preparing`, `Mark Ready`, `Complete`.
- **`FR-BAR-04`**: Receive instant real-time order arrivals via Socket.IO with optional audio cue and store pause toggle.

#### Admin Requirements (`FR-ADM`)
- **`FR-ADM-01`**: Role-restricted access (`admin`) to Overview KPIs (`GET /api/admin/overview`) and 30-day sales analytics (`GET /api/admin/analytics`).
- **`FR-ADM-02`**: Full CRUD for Categories (`POST/PATCH/DELETE /api/categories`) and Products (`POST/PATCH/DELETE /api/products`), including price in EGP, stock quantity, and availability toggles.
- **`FR-ADM-03`**: Manage customization groups and options (`GET/POST/PATCH /api/customizations`).
- **`FR-ADM-04`**: View and filter all orders (`GET /api/admin/orders`), inspect order activity logs, update status, or cancel/refund orders.
- **`FR-ADM-05`**: Manage staff accounts (`GET/POST/PATCH /api/admin/staff`), coupons/discounts (`GET/POST/PATCH /api/admin/coupons`), and store settings (`GET/PATCH /api/admin/settings`).

### 2.2 Non-Functional Requirements (`NFR`)
- **`NFR-SEC-01` (Server-Side Price Integrity)**: Client-submitted prices or totals are never trusted. The backend queries current product and customization option prices from PostgreSQL inside a database transaction.
- **`NFR-SEC-02` (Authentication & RBAC)**: Passwords hashed with salted `scrypt`; HTTP-only / Bearer HMAC-SHA256 signed tokens; role middleware enforcing `barista` and `admin` boundaries; rate limiting on authentication and order creation endpoints.
- **`NFR-DATA-01` (Financial Precision & Historical Snapshots)**: Prices stored in integer minor units (`price_piastres`) and `NUMERIC(10,2)`. `order_items` and `order_item_customizations` snapshot product names and prices at purchase time so later price edits never corrupt historical receipts.
- **`NFR-REL-01` (Graceful Notification Degradation)**: Telegram notifications run asynchronously after transaction commit; a missing token or Telegram network failure is logged without failing the customer's order.
- **`NFR-A11Y-01` (Accessibility)**: WCAG 2.2 AA compliance — visible `:focus-visible` rings, explicit `<label>` elements, interaction-deferred `:user-invalid` + `aria-invalid` error announcements, semantic landmarks, and 44×44px touch targets.

---

## Stage 03 — User & Competitor Research Summary

### 3.1 User Personas
1. **Nour (Daily Commuter Customer, Cairo)**: Orders an *Iced Spanish Latte (Oat milk, Less sugar)* on her phone 10 minutes before arriving at the café. Needs fast load times on mobile networks, clear EGP pricing, and an accurate "Ready for pickup" status.
2. **Jamie (Lead Barista)**: Manages 15+ concurrent morning orders on a counter tablet. Needs high-contrast typography, zero modal clutter, highlighted allergy notes (`DAIRY ALLERGY`), and single-tap stage advancement.
3. **Sam Rivera (Café Manager)**: Reviews daily net sales, disables sold-out bakery items in seconds, adjusts seasonal promo codes (`WELCOME10`, `MORNING15`), and monitors average prep time.

### 3.2 UX Opportunities Implemented
- **Persistent In-Page Bag Summary** on `menu.html` eliminates back-and-forth page loads when building a group order.
- **Interactive Choice Cards** using CSS `:has(:checked)` provide large 48px touch targets without layout shift.
- **3-Column Barista Kanban** mirrors physical espresso bar workflow (`New` → `Preparing` → `Ready for pickup`).

---

## Stage 04 — Sitemap & Core User Flows

### 4.1 Complete Application Sitemap
- **Customer Storefront**:
  - `/` (`index.html`) — Storefront Homepage (`01 · Storefront`)
  - `/menu.html` — Full Dynamic Menu & Persistent Bag (`02 · Order menu` & `12 · Mobile menu`)
  - `/product.html?id=:slug` — Product Details & Customizer (`03 · Product customization` & `13 · Mobile product`)
  - `/checkout.html` — Pickup & Delivery Checkout (`04 · Checkout`, `18 · Delivery checkout`, `14 · Mobile checkout`)
  - `/tracking.html?ref=:orderNumber` — Order Confirmation & Live Tracking (`05 · Order tracking` & `15 · Mobile tracking`)
  - `/orders.html` — Customer Account, Regulars Club & Reorder History (`06 · My orders`)
  - `/signin.html` — Customer Sign In & Staff Portal Link (`17 · Sign in`)
- **Barista Workspace**:
  - `/barista.html` — Staff Login Modal & Live Orders Kanban Dashboard (`07 · Barista live orders` & `22 · Mobile operations`)
- **Admin Management Dashboard**:
  - `/admin.html` — Admin Login & 7-Tab Management Suite (`08 · Overview`, `09 · Orders`, `10 · Menu & Inventory`, `19 · Customers`, `20 · Discounts`, `21 · Analytics`, `11 · Store Settings & Staff`)

### 4.2 End-to-End Order Lifecycle Flow
```text
[Customer: menu.html / product.html]
   │ Configures product + customizations -> stored in Cart
   ▼
[Customer: checkout.html]
   │ Enters name, Egypt/local phone, pickup/delivery address, promo code -> POST /api/orders
   ▼
[Backend: orderController -> orderService (PostgreSQL Transaction)]
   ├─ 1. Validates store is accepting orders & products are available / in stock
   ├─ 2. Fetches authoritative base prices & customization option prices from PostgreSQL
   ├─ 3. Validates & applies coupon discount, delivery fee, and tip
   ├─ 4. Inserts `customers`, `addresses`, `orders`, `order_items`, `order_item_customizations`, `payments`
   ├─ 5. Decrements tracked inventory & logs `inventory_movements`
   └─ 6. Commits transaction -> Emits Socket.IO `order:created` + Sends async Telegram notification
   ▼
[Barista: barista.html] & [Admin: admin.html]
   │ Receives real-time `order:created` event -> Card appears in "New" column
   │ Barista clicks "Accept & start preparing" -> PATCH /api/admin/orders/:id/status (status="Preparing")
   │ Barista clicks "Mark ready for pickup"   -> PATCH /api/admin/orders/:id/status (status="Ready")
   │ Barista clicks "Mark as picked up"       -> PATCH /api/admin/orders/:id/status (status="Completed")
   ▼
[Customer: tracking.html]
   │ Receives real-time `order:updated` event (or polls GET /api/orders/track/:reference)
   └─ Progress stepper advances live from Confirmed -> Preparing -> Ready for pickup -> Picked up
```
