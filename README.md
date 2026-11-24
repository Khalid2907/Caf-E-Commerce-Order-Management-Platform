# Common Ground — Café E-Commerce & Online Ordering System

> *"A considered cup. A connected experience."*  
> Customer-facing storefront and online ordering frontend translated from the **Common Ground UI Foundations (v1.0)** Figma design system using pure **HTML5**, **CSS3**, and **Vanilla JavaScript (ES6+ Modules)**.

---

## 1. Project Overview

**Common Ground** is a complete café e-commerce and order management platform designed for three distinct interfaces:
1. **Customer-Facing E-Commerce Storefront** *(Implemented in this repository)*
2. **Barista Live Order Management Workspace** *(Planned Phase 2)*
3. **Store Administration & Analytics Dashboard** *(Planned Phase 3)*

This frontend implementation translates all customer-facing desktop and mobile Figma screens into semantic, accessible, zero-dependency HTML5/CSS3/ES6+ code architected for seamless future REST API / backend integration.

---

## 2. Implemented Customer Screens (Figma 1:1 Mapping)

| Page / Entry Point | Figma Desktop Frame | Figma Mobile Frame | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **[`index.html`](index.html)** | `01 · Storefront` (`6:2`) | Responsive + `12 · Mobile menu` nav | Announcement strip, sticky header with live bag count, sunlit hero section with floating card, 4 Neighborhood Favorites cards with quick-add `+`, Origin Story editorial banner, and footer |
| **[`menu.html`](menu.html)** | `02 · Order menu` (`6:8`) | `12 · Mobile menu` (`6:41`) | Interactive Pickup/Delivery fulfillment toggle, live search input, sorting (`Featured`, `Price`, `Name`), category filtering across all 18 catalog items, and a persistent reactive **`Your bag`** panel with quantity steppers, item removal, café notes, and `localStorage` persistence |
| **[`product.html`](product.html)** | `03 · Product customization` (`6:13`) | `13 · Mobile product` (`6:45`) | Dynamic `?id=<product-id>` routing, espresso origin overlay card, Size radio choice cards (`12 oz`, `16 oz`), Milk choice cards (`Whole`, `Oat +$0.80`, `Almond +$0.80`), Add-ons (`Extra espresso shot +$1.00`, `Decaf`), special instructions, quantity stepper, live price calculation, and *"A good cup deserves good company"* pairings |
| **[`checkout.html`](checkout.html)** | `04 · Checkout` (`6:17`) & `18 · Delivery checkout` (`6:1650`) | `14 · Mobile checkout` (`6:49`) | 3-step progress bar, Pickup vs. Delivery mode switch (dynamically toggling `02 / Delivery address`, `$2.50` delivery fee, and *"A smooth handoff"* card), interaction-deferred form validation (`:user-invalid` + ARIA sync), tip calculator (`No tip`, `10%`, `15%`, `20%`), and promo codes (`WELCOME10`, `MORNING15`, `COFFEEONUS`) |
| **[`tracking.html`](tracking.html)** | `05 · Order tracking` (`6:20`) | `15 · Mobile tracking` (`6:53`) | Temporary frontend order generation (`#1048+`), dynamic status pill (`New` → `Preparing` → `Ready` → `Completed`), estimated pickup/delivery window, interactive 4-step progress stepper (horizontal on desktop, vertical rail on mobile), SMS notification banner, pickup directions card, and itemized receipt |
| **[`orders.html`](orders.html)** | `06 · My orders` (`6:23`) | Responsive adaptation | **The Regulars Club** loyalty balance card (`120 / 200 points`), active order status card with `Track order →`, past orders history table (`#1021`, `#0986`, `#0942`) with one-click `Reorder ↗`, and *"Make it your usual"* callout |
| **[`signin.html`](signin.html)** | `17 · Sign in` (`6:1648`) | Responsive adaptation | Split editorial layout with **The Regulars Club** perks card, passwordless magic-link sign-in form with validation and confirmation banner, and *"Continue as guest"* flow |

---

## 3. Technology Stack & Constraints

- **HTML5**: Semantic landmarks (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`), native form validation attributes, and WCAG-compliant labeling.
- **CSS3**: Custom Properties (design tokens), CSS Grid & Flexbox, `:has()` parent state selectors for choice cards and stretched card links, `:user-invalid` deferred validation styling, and responsive breakpoints (`1440px+` Desktop, `768–1199px` Tablet, `390px` Mobile).
- **Vanilla JavaScript (ES6+)**: Native ES modules (`import`/`export`), event delegation, pub/sub state synchronization, and safe DOM construction (`createElement` / `textContent`).
- **Zero External Frameworks**: Built without React, Vue, Angular, jQuery, Bootstrap, or Tailwind CSS.

---

## 4. Design System Foundations (`css/tokens.css`)

Extracted directly from Figma frame **`16 · UI foundations`**:

### Color Variables
| Token | Hex | Purpose |
| :--- | :--- | :--- |
| `--color-pine` | `#173F35` | Primary brand dark green (headers, primary buttons, footer) |
| `--color-pine-hover` | `#245748` | Primary button hover state |
| `--color-pine-pressed` | `#102E27` | Primary button active/pressed state |
| `--color-paper` | `#F7F5F0` | Warm editorial cream page background |
| `--color-surface` | `#FFFFFF` | Card, input, and bag panel surfaces |
| `--color-sage` | `#E8EEE6` | Soft sage accent surface, active pills, and confirmation banners |
| `--color-terracotta` | `#B34F32` | Destructive actions and form validation error borders/text |
| `--color-rose` | `#F8E8E3` | Availability alert and error input background |
| `--color-amber` | `#F5E8CB` | `Preparing` order status badge background |
| `--color-warning` | `#805617` | `Preparing` order status badge text |
| `--color-ink` | `#242E29` | High-contrast body and heading text |
| `--color-muted` | `#66716A` | Secondary descriptions, captions, and inactive navigation |
| `--color-line` | `#DEDFD7` | Hairline borders and section dividers |
| `--color-disabled` | `#E7E6E0` | Disabled controls and upcoming stepper circles |

### Typography
- **Editorial Display (`--font-serif`)**: `'Instrument Serif'`, 400 Regular — used for emotional display moments (`76px` Hero H1, `54px` Product Title, `48px` Page Titles, `44px` Section Headings).
- **UI & Everyday Details (`--font-sans`)**: `'DM Sans'`, 400 / 500 / 600 / 700 — used for navigation, product metadata, prices, form controls, and status badges.

---

## 5. Project Folder Structure

```text
Cafe Full System/
├── index.html                    # 01 · Storefront (Homepage)
├── menu.html                     # 02 · Order menu & 12 · Mobile menu
├── product.html                  # 03 · Product customization & 13 · Mobile product
├── checkout.html                 # 04 · Checkout, 18 · Delivery checkout & 14 · Mobile checkout
├── tracking.html                 # 05 · Order tracking & 15 · Mobile tracking
├── orders.html                   # 06 · My orders (Account & Loyalty)
├── signin.html                   # 17 · Sign in
├── assets/
│   ├── icons/                    # Downloaded SVG icons (account, mobile bottom nav)
│   └── images/                   # Downloaded Figma product & hero photography
├── css/
│   ├── tokens.css                # Design tokens (colors, typography, spacing, radii, grid)
│   ├── base.css                  # Reset, focus-visible rings, typography utilities
│   ├── layout.css                # Container, announcement strip, sticky header, footer, mobile nav
│   ├── components.css            # Buttons, product cards, status pills, forms, toast notifications
│   └── pages/
│       ├── home.css              # Homepage layout
│       ├── menu.css              # 3-column menu catalog & persistent bag panel
│       ├── product.css           # Two-column customizer, choice cards & pairings
│       ├── checkout.css          # Checkout form, tip pills, promo disclosure & order review
│       ├── tracking.css          # 4-stage progress stepper, pickup card & receipt
│       ├── orders.css            # Loyalty banner, active order card & history table
│       └── signin.css            # Split editorial sign-in layout
├── js/
│   ├── config/
│   │   └── constants.js          # Storage keys, tax/delivery rates & price formatter
│   ├── data/
│   │   └── products.js           # Single-source normalized catalog (18 unique products)
│   ├── services/
│   │   ├── storageService.js     # Safe JSON localStorage wrapper
│   │   ├── productService.js     # Catalog queries, category filtering, search & sorting
│   │   ├── cartService.js        # Reactive bag state, line-item fingerprinting & pub/sub
│   │   └── orderService.js       # Order creation, live stage simulation & past order history
│   ├── components/
│   │   ├── header.js             # Synchronizes "Bag · N" badge across all pages
│   │   ├── productCard.js        # Reusable <article> card renderer with event delegation
│   │   └── toast.js              # Accessible aria-live="polite" toast notifications
│   └── pages/
│       ├── home.js               # Storefront controller
│       ├── menu.js               # Menu & persistent bag controller
│       ├── product.js            # Product customization & dynamic pricing controller
│       ├── checkout.js           # Checkout validation, tips, promo codes & submission
│       ├── tracking.js           # Live order tracking & stage simulation controller
│       ├── orders.js             # Account history & one-click reorder controller
│       └── signin.js             # Magic-link sign-in controller
└── UI:UX design/                 # Reference PDF specifications exported from Figma
```

---

## 6. How the Frontend is Prepared for Backend Integration

1. **Decoupled Service Layer (`js/services/`)**: UI controllers never manipulate `localStorage` or raw data arrays directly. Replacing mock data with a real backend only requires updating `productService.js`, `cartService.js`, and `orderService.js` to use `fetch()` / `async`/`await`.
2. **Normalized Single-Source Catalog (`js/data/products.js`)**: Each of the 18 products is defined once with a unique `id`, `categoryIds` array, and both Figma USD (`price`) and specification EGP (`priceEgp`) pricing.
3. **Deterministic Cart Line-Item Keys (`cartService.js`)**: Customizations (`size`, `temperature`, `milk`, `addons`, `specialInstructions`) are fingerprinted into a deterministic `cartItemId` so identical drinks stack quantities while differently customized drinks remain separate line items.

---

## 7. Running Locally

Because the application uses native ES6 modules (`<script type="module">`), serve the directory over a local HTTP server:

```bash
# Using Python 3
python3 -m http.server 8090

# Or using Node.js
npx serve -l 8090
```

Then open **`http://localhost:8090`** in your browser.
- Append `?reset=1` to any URL (e.g., `http://localhost:8090/index.html?reset=1`) to reset the shopping bag back to the default Figma 2-item state (`1 × Iced oat latte` + `1 × Almond croissant`).
