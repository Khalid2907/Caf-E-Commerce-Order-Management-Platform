-- =============================================================================
-- COMMON GROUND — PostgreSQL Relational Schema Migration (001_initial_schema.sql)
-- Implements all 20 required entities with integer piastres + NUMERIC(10,2) EGP
-- =============================================================================

-- 1. Roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(32) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(40),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- 3. Staff
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_code VARCHAR(32) NOT NULL UNIQUE,
  title VARCHAR(100) NOT NULL DEFAULT 'Barista',
  station VARCHAR(100) NOT NULL DEFAULT 'Espresso Bar',
  shift_label VARCHAR(100) NOT NULL DEFAULT 'Morning Shift (7am–3pm)',
  is_on_shift BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Customers
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(40) NOT NULL,
  loyalty_points INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  usual_drink VARCHAR(150) DEFAULT 'Spanish Latte · 12 oz',
  favorite_pairing VARCHAR(150) DEFAULT 'Butter Croissant',
  email_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  sms_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  orders_count INTEGER NOT NULL DEFAULT 0,
  total_spent_piastres INTEGER NOT NULL DEFAULT 0,
  total_spent_egp NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  segment VARCHAR(32) NOT NULL DEFAULT 'Regulars',
  last_visit_label VARCHAR(64) DEFAULT 'Today',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- 5. Addresses
CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  street_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL DEFAULT 'Cairo',
  state_region VARCHAR(100) NOT NULL DEFAULT 'Cairo',
  postal_code VARCHAR(32) DEFAULT '11511',
  delivery_notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Categories
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- 7. Products
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(32) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  badge VARCHAR(64),
  short_description TEXT NOT NULL,
  menu_description TEXT,
  detail_description TEXT,
  origin_note TEXT,
  allergen_note TEXT,
  base_price_piastres INTEGER NOT NULL CHECK (base_price_piastres >= 0),
  base_price_egp NUMERIC(10,2) NOT NULL CHECK (base_price_egp >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_customizable BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  featured_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured, featured_order);

-- 8. Product Images
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text VARCHAR(255) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  price_delta_piastres INTEGER NOT NULL DEFAULT 0,
  price_delta_egp NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Customization Groups
CREATE TABLE IF NOT EXISTS customization_groups (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  min_selections INTEGER NOT NULL DEFAULT 0,
  max_selections INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Customization Options
CREATE TABLE IF NOT EXISTS customization_options (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES customization_groups(id) ON DELETE CASCADE,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  short_label VARCHAR(64),
  price_delta_piastres INTEGER NOT NULL DEFAULT 0,
  price_delta_egp NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customization_options_group_id ON customization_options(group_id);

-- 12. Product Customization Assignments
CREATE TABLE IF NOT EXISTS product_customization_assignments (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES customization_groups(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, group_id)
);

-- 13. Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  quantity_available INTEGER NOT NULL DEFAULT 50 CHECK (quantity_available >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 8,
  is_tracked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  inventory_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  change_amount INTEGER NOT NULL,
  reason VARCHAR(150) NOT NULL,
  reference_order_id INTEGER,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Coupons / Discounts
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  discount_type VARCHAR(24) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0),
  min_order_egp NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  max_discount_egp NUMERIC(10,2),
  usage_limit INTEGER NOT NULL DEFAULT 500,
  used_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Scheduled', 'Expired', 'Paused')),
  starts_at VARCHAR(64) DEFAULT 'Nov 1, 2026',
  ends_at VARCHAR(64) DEFAULT 'Dec 31, 2026',
  first_time_only BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_reference VARCHAR(32) NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  customer_email VARCHAR(255),
  fulfillment_type VARCHAR(24) NOT NULL DEFAULT 'pickup' CHECK (fulfillment_type IN ('pickup', 'delivery')),
  delivery_address_snapshot TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Preparing', 'Ready', 'Completed', 'Cancelled', 'Rejected')),
  payment_status VARCHAR(24) NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Refunded', 'Failed')),
  payment_method VARCHAR(32) NOT NULL DEFAULT 'cash',
  subtotal_piastres INTEGER NOT NULL CHECK (subtotal_piastres >= 0),
  subtotal_egp NUMERIC(10,2) NOT NULL CHECK (subtotal_egp >= 0),
  discount_piastres INTEGER NOT NULL DEFAULT 0 CHECK (discount_piastres >= 0),
  discount_egp NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount_egp >= 0),
  delivery_fee_piastres INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_piastres >= 0),
  delivery_fee_egp NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee_egp >= 0),
  tip_piastres INTEGER NOT NULL DEFAULT 0 CHECK (tip_piastres >= 0),
  tip_egp NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tip_egp >= 0),
  tax_piastres INTEGER NOT NULL DEFAULT 0 CHECK (tax_piastres >= 0),
  tax_egp NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tax_egp >= 0),
  total_piastres INTEGER NOT NULL CHECK (total_piastres >= 0),
  total_egp NUMERIC(10,2) NOT NULL CHECK (total_egp >= 0),
  special_instructions TEXT,
  allergy_flag BOOLEAN NOT NULL DEFAULT FALSE,
  estimated_window VARCHAR(64) DEFAULT '10–15 min',
  assigned_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  accepted_at TIMESTAMPTZ,
  preparing_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(order_reference);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 17. Order Items (with immutable price & name snapshots)
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_slug_snapshot VARCHAR(100),
  product_name_snapshot VARCHAR(150) NOT NULL,
  product_image_snapshot TEXT,
  unit_base_price_piastres INTEGER NOT NULL,
  unit_base_price_egp NUMERIC(10,2) NOT NULL,
  unit_final_price_piastres INTEGER NOT NULL,
  unit_final_price_egp NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_piastres INTEGER NOT NULL,
  line_total_egp NUMERIC(10,2) NOT NULL,
  customization_summary TEXT,
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 18. Order Item Customizations (immutable option snapshots)
CREATE TABLE IF NOT EXISTS order_item_customizations (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  option_id INTEGER REFERENCES customization_options(id) ON DELETE SET NULL,
  group_name_snapshot VARCHAR(100) NOT NULL,
  option_name_snapshot VARCHAR(100) NOT NULL,
  price_delta_piastres INTEGER NOT NULL DEFAULT 0,
  price_delta_egp NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. Payments
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method VARCHAR(32) NOT NULL CHECK (payment_method IN ('cash', 'card_on_pickup', 'card_simulated')),
  payment_status VARCHAR(24) NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Refunded', 'Failed')),
  amount_piastres INTEGER NOT NULL,
  amount_egp NUMERIC(10,2) NOT NULL,
  card_brand VARCHAR(32),
  card_last4 VARCHAR(8),
  transaction_reference VARCHAR(100),
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. Café Settings (Singleton operational configuration)
CREATE TABLE IF NOT EXISTS cafe_settings (
  id SERIAL PRIMARY KEY,
  store_name VARCHAR(150) NOT NULL DEFAULT 'Common Ground',
  branch_name VARCHAR(150) NOT NULL DEFAULT 'Maple Street',
  address_line TEXT NOT NULL DEFAULT '42 Maple Street · Cairo / Portland Roastery',
  phone VARCHAR(40) NOT NULL DEFAULT '+20 100 555 0142',
  email VARCHAR(255) NOT NULL DEFAULT 'hello@commonground.coffee',
  currency_code VARCHAR(10) NOT NULL DEFAULT 'EGP',
  is_accepting_orders BOOLEAN NOT NULL DEFAULT TRUE,
  pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  standard_prep_minutes INTEGER NOT NULL DEFAULT 10,
  pickup_buffer_minutes INTEGER NOT NULL DEFAULT 5,
  max_active_orders INTEGER NOT NULL DEFAULT 12,
  delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  delivery_radius_km NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  delivery_fee_piastres INTEGER NOT NULL DEFAULT 2500,
  delivery_fee_egp NUMERIC(10,2) NOT NULL DEFAULT 25.00,
  delivery_min_order_egp NUMERIC(10,2) NOT NULL DEFAULT 100.00,
  delivery_estimate_label VARCHAR(64) NOT NULL DEFAULT '25–35 minutes',
  pickup_estimate_label VARCHAR(64) NOT NULL DEFAULT '10–15 minutes',
  opening_hours_json JSONB NOT NULL DEFAULT '{"mon_fri":"7:00 am – 6:00 pm","sat":"8:00 am – 5:00 pm","sun":"8:00 am – 5:00 pm"}'::jsonb,
  telegram_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
