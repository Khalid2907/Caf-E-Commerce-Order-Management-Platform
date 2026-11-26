# Arabic Localization & RTL Engineering Audit (`EN ↔ AR`)
## Common Ground — Café E-Commerce & Order Management Platform

---

## 1. Scope of Bilingual Transformation

The Common Ground platform consists of **9 HTML entry points** across **3 operational interfaces** plus a **Node.js / Express / PostgreSQL backend**:

1. **Customer-Facing Storefront (7 Pages)**:
   - [index.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/index.html) (`01 · Storefront`): Announcement strip, primary header, hero section, neighborhood favorites grid, origin story banner, footer, and mobile bottom nav.
   - [menu.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/menu.html) (`02 · Order menu` & `12 · Mobile menu`): Menu header, pickup/delivery switcher, live search box, 5 category filters + favorites/full catalog, 18 product cards, sort dropdown, and persistent `Your bag` drawer.
   - [product.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/product.html) (`03 · Customize drink` & `13 · Mobile customize`): Breadcrumbs, origin overlay card, size/temperature/milk/sugar/add-ons customizer, special instructions, allergen notes, quantity stepper, and recommended pairings.
   - [checkout.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/checkout.html) (`04 · Checkout` & `14 · Mobile checkout`): 3-step progress bar, fulfillment cards, conditional delivery address fields, contact details, payment selector (Cash / Card), tip calculator, promo code validator, and itemized order summary.
   - [tracking.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/tracking.html) (`05 · Order confirmed` & `15 · Mobile tracking`): Order reference eyebrow, live status card, 4-stage progress stepper, SMS updates banner, Regulars Club invite, pickup directions card, and itemized receipt.
   - [orders.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/orders.html) (`06 · My orders`): Account sidebar, Regulars Club loyalty progress banner, active order highlight card, past orders table with 1-click reorder, and usual drink banner.
   - [signin.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/signin.html) (`17 · Sign in`): Regulars Club visual card, passwordless email sign-in form, validation messages, and guest checkout shortcut.

2. **Barista Live Orders Workspace (1 Page)**:
   - [barista.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/barista.html) (`07 · Barista live orders` & `22 · Mobile operations`): Staff login modal, live status pill, operational KPIs (`Active orders`, `Oldest order`, `Avg. prep time`, `Picked up today`), 3-column Kanban queue (`New`, `Preparing`, `Ready for pickup`), ticket cards, status action buttons, and store pause bar.

3. **Admin Management Console (1 Page — 7 Modules)**:
   - [admin.html](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/admin.html) (`08`–`11` & `19`–`21`): Manager login modal, left navigation sidebar, `Overview`, `Orders & Inspector`, `Menu & Inventory CRUD`, `Customers & Loyalty CRM`, `Discounts & Promo Codes`, `Sales Analytics`, and `Store Settings & Staff Roster`.

---

## 2. CSS & RTL Structural Audit Findings

### 2.1 Existing Logical Property Coverage
- **Positive Baseline**: Over 95% of existing rules in `css/layout.css`, `css/components.css`, and `css/pages/*.css` already use CSS logical properties (`inline-size`, `block-size`, `margin-inline`, `padding-inline`, `inset-inline-start`, `inset-inline-end`, `text-align: start`).

### 2.2 Identified RTL & Typography Issues Requiring Remediation
1. **Arabic Cursive Letter-Spacing Distortion**:
   - `.eyebrow`, `.product-card__badge`, `.announcement-strip__text`, and `.admin-table th` apply positive `letter-spacing` (`0.02em` to `0.08rem`) and `text-transform: uppercase`. In Arabic (`html[lang="ar"]`), positive `letter-spacing` can break or distort cursive glyph connections in older WebKit/Blink text shapers.
   - **Fix**: Reset `letter-spacing: 0 !important;` on `html[lang="ar"] *` (except explicit LTR code/SKU badges).
2. **Arabic Line-Height & Display Serif Substitution**:
   - `Instrument Serif` is a Latin-only display serif font (`--leading-display: 1.02`, `--leading-tight: 0.95`). When rendering Arabic text, falling back to system Arial/Geeza Pro at `line-height: 1.02` clips Arabic ascenders/descenders and loses editorial warmth.
   - **Fix**: Pair `IBM Plex Sans Arabic` (UI & body) and `Cairo` (headings & editorial titles) on `html[lang="ar"]`, and relax `--leading-display` to `1.24` and `--leading-heading` to `1.3` for Arabic.
3. **Physical Padding & Table Text Alignment**:
   - `css/pages/product.css` line 391 `.pairing-card` uses physical `padding: 10px 18px 10px 10px;` instead of `padding-block: 10px; padding-inline: 10px 18px;`.
   - `css/pages/orders.css` `.order-table th, .order-table td` and `css/pages/admin.css` `.admin-table th, .admin-table td` must explicitly use `text-align: start` (and `text-align: end` for action columns).
4. **Directional Arrows & Icons**:
   - Inline directional arrows (`→`, `↗`) in CTA buttons and links point right in LTR but must point left (`←`, `↖`) in RTL (`dir="rtl"`).
5. **Mixed-Direction Content Isolation (`<bdi>` & `dir="ltr"`)**:
   - Phone numbers (`+20 100 555 0142`), email addresses, SKU codes (`COF-001`), promo codes (`WELCOME10`), and order references (`#1048`) embedded inside Arabic sentences require `dir="ltr"` / `unicode-bidi: isolate` so punctuation (`+`, `#`) never jumps to the wrong side.
