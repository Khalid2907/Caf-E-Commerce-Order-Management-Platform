# DATABASE SCHEMA SPECIFICATION (Stage 09)

## 1. Design Principles
- **Relational Normalization (3NF) + Historical Snapshotting**: Product catalog, variants, and customization options are normalized across dedicated tables, while `order_items` and `order_item_customizations` persist immutable snapshots (`product_name_snapshot`, `unit_base_price_piastres`, `option_name_snapshot`, `price_delta_piastres`) so future menu price changes never alter historical order receipts.
- **Exact Financial Arithmetic**: Every monetary column is stored as both **integer minor units (`_piastres`, 1 EGP = 100 piastres)** and **`NUMERIC(10,2)` (`_egp`)** — never IEEE-754 floating point (`REAL`/`FLOAT`).
- **ACID Transactions**: Order creation, item insertion, payment record creation, coupon usage increment, and inventory deduction run inside a single `BEGIN ... COMMIT` PostgreSQL transaction.

---

## 2. All 20 Relational Entities

| # | Table Name | Primary Key | Key Foreign Keys & Purpose |
| :- | :--- | :--- | :--- |
| 1 | `roles` | `id SERIAL` | Defines RBAC roles (`admin`, `barista`, `customer`). |
| 2 | `users` | `id SERIAL` | `role_id -> roles(id)`. Stores salted `scrypt` `password_hash`, `email`, `full_name`. |
| 3 | `staff` | `id SERIAL` | `user_id -> users(id)`. Barista/manager station, shift status, employee code. |
| 4 | `customers` | `id SERIAL` | `user_id -> users(id)`. Customer profile, `loyalty_points`, `usual_drink`, `total_spent_piastres`. |
| 5 | `addresses` | `id SERIAL` | `customer_id -> customers(id)`. Delivery street, city, region, postal code. |
| 6 | `categories` | `id SERIAL` | Menu categories (`coffee`, `non-coffee`, `iced-drinks`, `bakery`, `food`). |
| 7 | `products` | `id SERIAL` | `category_id -> categories(id)`. SKU, slug, descriptions, `base_price_piastres`, `base_price_egp`, `is_available`. |
| 8 | `product_images` | `id SERIAL` | `product_id -> products(id)`. Local/CDN asset path, alt text, primary flag. |
| 9 | `product_variants` | `id SERIAL` | `product_id -> products(id)`. Size variants (`12 oz`, `16 oz`) with price deltas. |
| 10 | `customization_groups` | `id SERIAL` | Configurable groups (`size`, `temperature`, `milk`, `sugar`, `addons`, `syrups`, `toppings`). |
| 11 | `customization_options` | `id SERIAL` | `group_id -> customization_groups(id)`. Individual options (`Oat milk +20 EGP`, `Extra espresso shot +25 EGP`). |
| 12 | `product_customization_assignments` | `id SERIAL` | Many-to-many join (`product_id`, `group_id`) linking products to allowed customization groups. |
| 13 | `inventory` | `id SERIAL` | `product_id -> products(id)`. `quantity_available`, `low_stock_threshold`, `is_tracked`. |
| 14 | `inventory_movements` | `id SERIAL` | `inventory_id -> inventory(id)`. Audit log of stock deductions and restocks. |
| 15 | `coupons` | `id SERIAL` | Promo codes (`WELCOME10`, `MORNING15`, `COFFEEONUS`, etc.) with type, min order, max cap, usage counts. |
| 16 | `orders` | `id SERIAL` | `customer_id`, `address_id`, `coupon_id`, `assigned_staff_id`. Order lifecycle statuses & financial breakdown. |
| 17 | `order_items` | `id SERIAL` | `order_id -> orders(id)`, `product_id -> products(id)`. Line item snapshot prices & quantities. |
| 18 | `order_item_customizations` | `id SERIAL` | `order_item_id -> order_items(id)`. Snapshot of chosen options and option price deltas. |
| 19 | `payments` | `id SERIAL` | `order_id -> orders(id)`. Tracks payment method (`cash`, `card_on_pickup`) and `payment_status` separately from `orders.status`. |
| 20 | `cafe_settings` | `id SERIAL` | Singleton store configuration (currency `EGP`, delivery fee, prep times, accepting orders flag, opening hours JSONB). |

---

## 3. Order Lifecycle State Machine

Valid `orders.status` values:
- `Pending` (displayed as **New** on Barista Kanban)
- `Accepted`
- `Preparing`
- `Ready`
- `Completed`
- `Cancelled`
- `Rejected`

Allowed Transitions (enforced server-side in `server/services/orderService.js`):
- `Pending` → `Accepted` | `Preparing` | `Rejected` | `Cancelled`
- `Accepted` → `Preparing` | `Ready` | `Cancelled`
- `Preparing` → `Ready` | `Cancelled`
- `Ready` → `Completed` | `Cancelled`
- Terminal states: `Completed`, `Cancelled`, `Rejected` (cannot transition back to active states).
