# Bilingual Localization & RTL Architecture Implementation Guide (`EN ↔ AR`)
## Common Ground — Café E-Commerce & Order Management Platform

---

## 1. Internationalization Architecture (`js/i18n/`)

The bilingual system is implemented as a zero-dependency ES6 module suite under `js/i18n/` that integrates with all 9 application pages and dynamic JavaScript controllers without duplicating HTML pages or breaking existing English functionality:

- [js/i18n/translations.js](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/js/i18n/translations.js):
  - `AR_PRODUCT_CATALOG`: Complete Arabic localization for all 18 Egyptian Pound (`EGP`) products (names, badges, short descriptions, menu descriptions, detailed tasting notes, origin notes, and allergen disclosures).
  - `AR_CUSTOMIZATION_TOKENS`: Arabic labels for sizes (`١٢ أونصة`, `١٦ أونصة`), temperatures (`ساخن`, `مثلج`), milks (`حليب كامل الدسم`, `حليب الشوفان`, `حليب اللوز`, `حليب خالي الدسم`), sugar levels (`سكر عادي`, `سكر خفيف (٥٠٪)`, `بدون سكر`), and add-ons (`شوت إسبريسو إضافي`, `صوص فانيليا`, `صوص كراميل`, `رشة قرفة`).
  - `AR_STATUS_MAP`: Arabic operational status badges (`جديد`, `قيد الانتظار`, `تم القبول`, `قيد التحضير`, `جاهز للاستلام`, `مكتمل`, `ملغي`, `مرفوض`, `متوفر`, `مخزون منخفض`, `نفد المخزون`).
  - `EN_TO_AR_PHRASES` & `EN_TO_AR_PLACEHOLDERS`: Bidirectional dictionary covering every user-facing heading, button, form label, validation message, table column, and placeholder across Customer, Barista, and Admin interfaces.
- [js/i18n/i18n.js](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/js/i18n/i18n.js):
  - **Language Resolution Priority**:
    1. URL query parameter (`?lang=ar` or `?lang=en`)
    2. Persisted user preference in `localStorage` (`common_ground_lang_v1`)
    3. Browser locale (`navigator.language.startsWith("ar")`)
    4. English (`en`) fallback
  - **Zero-Reload Language Switching (`i18n.setLanguage(lang)`)**:
    - Updates `<html lang="ar" dir="rtl">` or `<html lang="en" dir="ltr">`.
    - Updates the browser URL with `?lang=ar` or `?lang=en` via `history.replaceState` while preserving existing query parameters (`?id=spanish-latte`, `?category=coffee`, `?ref=1048`) and hash sections (`#orders`, `#menu`).
    - Preserves shopping bag items (`cartService`), active order state, form input values, and category/search filters.
    - Notifies all subscribed controllers (`i18n.subscribe(...)`) to immediately re-render dynamic DOM views.

---

## 2. Structural RTL & Arabic Typography System

1. **Bilingual Font Pairing ([css/tokens.css](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/css/tokens.css))**:
   - **English (`html[lang="en"]`)**: `Instrument Serif` (Display headings) + `DM Sans` (UI & body).
   - **Arabic (`html[lang="ar"]`)**: `Cairo` (Display & editorial headings) + `IBM Plex Sans Arabic` (UI controls, tables, and body copy), loaded automatically from Google Fonts with relaxed Arabic line-heights (`--leading-display: 1.24`, `--leading-heading: 1.3`, `--leading-normal: 1.55`).
2. **Cursive Ligature Protection ([css/base.css](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/css/base.css))**:
   - `html[lang="ar"] * { letter-spacing: 0 !important; }` prevents positive English letter-spacing tokens from disconnecting Arabic cursive glyphs.
3. **Logical CSS Properties**:
   - Layouts use `inline-size`, `block-size`, `margin-inline`, `padding-inline`, `inset-inline-start`, `inset-inline-end`, and `text-align: start`, allowing the 3-column Menu Workspace (`Categories | Product Grid | Your Bag`), 3-column Barista Kanban (`New | Preparing | Ready`), and Admin Sidebar + Inspector to mirror naturally in `dir="rtl"`.
4. **Mixed-Direction Isolation (`<bdi>` & `.ltr-inline`)**:
   - Phone numbers (`+20 100 555 0142`), emails, order IDs (`#1048`), SKUs (`COF-001`), and card inputs apply `direction: ltr; unicode-bidi: isolate;` so symbols (`+`, `#`) never flip sides inside Arabic sentences.

---

## 3. Locale-Aware Currency, Numbers & Backend Arabic Search

- **Currency Formatting (`formatLocalePrice` in [js/i18n/i18n.js](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/js/i18n/i18n.js))**:
  - English (`en`): `95 EGP`, `156.88 EGP`
  - Arabic (`ar`): `٩٥ ج.م.`, `١٥٦٫٨٨ ج.م.` (via `Intl.NumberFormat("ar-EG")`)
- **Bilingual Catalog Search ([server/routes/api.js](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/server/routes/api.js) & [js/services/productService.js](file:///Users/khalid/Coding/Web%20Development/Cafe%20Full%20System/js/services/productService.js))**:
  - Both the PostgreSQL `/api/products?search=...` endpoint and the client `productService.queryProducts()` service index Arabic keywords (`سبانيش`, `كرواسون`, `ماتشا`, `كراميل`, `أمريكانو`, `شوكولاتة`, `ساندوتش`, etc.) alongside English product names and SKUs.
