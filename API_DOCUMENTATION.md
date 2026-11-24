# REST API CONTRACT & DOCUMENTATION (Stage 10)

Base URL: `/api`  
Content-Type: `application/json`  
Authentication: `Authorization: Bearer <token>` (or `cg_auth_token` HTTP-only cookie)

---

## 1. Standard Response Envelope

- **Success (`200 OK`, `201 Created`)**:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
- **Error (`400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`, `429 Too Many Requests`, `500 Internal Server Error`)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Human-readable explanation",
      "details": []
    }
  }
  ```

---

## 2. Health & Store Configuration

### `GET /api/health`
- **Auth**: Public
- **Purpose**: Production health check verifying server uptime and PostgreSQL database connectivity.
- **Response (`200 OK`)**: `{ "success": true, "data": { "status": "ok", "database": "connected", "currency": "EGP" } }`

### `GET /api/settings/public`
- **Auth**: Public
- **Purpose**: Retrieves public café settings (accepting orders flag, pickup/delivery estimates, delivery fee in EGP, opening hours).

---

## 3. Authentication Endpoints

### `POST /api/auth/login`
- **Auth**: Public (Rate-limited)
- **Request Body**: `{ "email": "sam.rivera@commonground.coffee", "password": "..." }`
- **Response (`200 OK`)**: `{ "success": true, "data": { "token": "...", "user": { "id": 1, "email": "...", "fullName": "Sam Rivera", "role": "admin" } } }`
- **Errors**: `400` missing fields, `401` invalid credentials.

### `POST /api/auth/logout`
- **Auth**: Authenticated or Public
- **Response (`200 OK`)**: Clears auth cookie and returns `{ "success": true }`.

### `GET /api/auth/me`
- **Auth**: Bearer Token / Cookie (`barista`, `admin`, `customer`)
- **Response (`200 OK`)**: `{ "success": true, "data": { "user": { ... } } }`

---

## 4. Categories & Catalog Endpoints

### `GET /api/categories`
- **Auth**: Public
- **Purpose**: Lists all categories ordered by `display_order` with product counts.

### `POST /api/categories` | `PATCH /api/categories/:id` | `DELETE /api/categories/:id`
- **Auth**: `admin` only
- **Request Body (`POST`/`PATCH`)**: `{ "name": "Seasonal Specials", "slug": "seasonal", "description": "...", "displayOrder": 7, "isActive": true }`

### `GET /api/products`
- **Auth**: Public
- **Query Params**: `?category=coffee`, `?search=latte`, `?featured=true`, `?available=true`, `?sort=price-asc|price-desc|name-asc`
- **Response (`200 OK`)**: Array of products with primary image, category metadata, inventory stock level, and assigned customization groups.

### `GET /api/products/:idOrSlug`
- **Auth**: Public
- **Response (`200 OK`)**: Full product details including variants and all assigned `customizationGroups` and `options`.

### `POST /api/products` | `PATCH /api/products/:id` | `DELETE /api/products/:id`
- **Auth**: `admin` only
- **Purpose**: Create, update (price in EGP, availability, stock quantity, category, description, allergens), or archive/delete a product.

### `GET /api/customizations` | `POST /api/customizations/options` | `PATCH /api/customizations/options/:id`
- **Auth**: Public (`GET`), `admin` (`POST`/`PATCH`)
- **Purpose**: Retrieve and manage configurable customization groups (`Size`, `Temperature`, `Milk type`, `Sugar level`, `Extra espresso`, `Syrups`, `Toppings`) and their EGP price deltas.

---

## 5. Orders & Real-Time Processing Endpoints

### `POST /api/orders`
- **Auth**: Public (Guest or Customer checkout)
- **Request Body**:
  ```json
  {
    "customerName": "Alex Johnson",
    "customerPhone": "+20 100 555 0142",
    "customerEmail": "alex.johnson@example.com",
    "fulfillmentType": "pickup",
    "deliveryAddress": {
      "streetAddress": "128 Oak Avenue, Apt 4B",
      "city": "Cairo",
      "stateRegion": "Cairo",
      "postalCode": "11511"
    },
    "paymentMethod": "cash",
    "couponCode": "WELCOME10",
    "tipRate": 0.1,
    "specialInstructions": "No straw, please.",
    "items": [
      {
        "productId": "spanish-latte",
        "quantity": 1,
        "selectedOptions": ["12oz", "hot", "oat", "less-sugar", "extra-shot"],
        "specialInstructions": ""
      }
    ]
  }
  ```
- **Server-Side Processing**:
  1. Verifies `cafe_settings.is_accepting_orders` is `true`.
  2. Queries authoritative prices for every product and selected customization option from PostgreSQL.
  3. Checks product availability and inventory stock (`quantity_available >= quantity`).
  4. Computes subtotal, coupon discount, delivery fee, tip, and grand total on the server.
  5. Persists order, items, customization snapshots, and payment record (`payment_status = 'Pending'` for cash), and decrements stock inside a transaction.
  6. Emits Socket.IO `order:created` event and dispatches non-blocking Telegram notification.
- **Response (`201 Created`)**: Full created order object with `orderReference` (e.g. `"1051"`).

### `GET /api/orders/track/:reference`
- **Auth**: Public
- **Purpose**: Retrieves live order status, timestamps, step index, and itemized receipt by order reference (`1048`).

### `GET /api/orders/:id`
- **Auth**: Staff (`barista`, `admin`) or matching order reference token.

### `GET /api/admin/orders`
- **Auth**: `barista` or `admin`
- **Query Params**: `?status=Pending,Preparing,Ready`, `?search=1048`
- **Purpose**: Powers both the Barista Live Kanban Board and the Admin Orders Inspector.

### `PATCH /api/admin/orders/:id/status`
- **Auth**: `barista` or `admin`
- **Request Body**: `{ "status": "Preparing", "paymentStatus": "Paid", "rejectionReason": "" }`
- **Validation**: Enforces state machine transition rules and emits Socket.IO `order:updated`.

---

## 6. Admin Analytics, Customers, Discounts & Settings

- **`GET /api/admin/overview`** (`barista`, `admin`): Today's net sales, active/completed order counts, average order value, average prep time, weekly sales series, crowd favorites, and low-stock alerts.
- **`GET /api/admin/analytics`** (`admin`): 30-day sales trend, revenue breakdown by category, top products by units & net sales, and pickup vs. delivery split.
- **`GET /api/admin/customers`** & **`PATCH /api/admin/customers/:id/points`** (`admin`): Customer CRM list, stats, and Regulars Club loyalty points adjustment.
- **`GET /api/admin/coupons`** & **`POST /api/admin/coupons`** & **`PATCH /api/admin/coupons/:id`** (`admin`): Discount code management.
- **`GET /api/admin/staff`** & **`POST /api/admin/staff`** & **`PATCH /api/admin/staff/:id`** (`admin`): Staff account & role management.
- **`GET /api/admin/settings`** & **`PATCH /api/admin/settings`** (`barista` can toggle pause orders; `admin` can update all settings).
