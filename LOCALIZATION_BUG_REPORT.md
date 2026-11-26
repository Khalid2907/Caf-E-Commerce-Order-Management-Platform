# LOCALIZATION BUG REPORT — ROOT CAUSE ANALYSIS & REMEDIATION PLAN

**System:** Common Ground — Café E-Commerce & Order Management Platform  
**Scope:** Bilingual Localization (`EN ↔ AR`), Early Language/RTL Initialization, and DOM Translation Performance  

---

## 1. Executive Summary

A deep engineering investigation of the bilingual Arabic/English implementation identified the root causes behind the two reported issues:

1. **Problem 1 — Incomplete Translations (`EN -> AR`)**: Several static HTML phrases, multi-line strings with `<br />` tags, form validation messages, input placeholders, dynamic option price badges (`+20 EGP`, `+25 EGP`), and asynchronously hydrated dashboard views (`barista.js` and `admin.js`) bypassed or missed the phrase lookup table.
2. **Problem 2 — Slow Arabic Initialization & English-to-Arabic Flash (FOUC)**: Every HTML page hardcoded `<html lang="en">` and loaded the localization engine inside a deferred ES module (`<script type="module" src="js/pages/...">`) at the bottom of `<body>`. Because the browser parses and paints the static English LTR DOM before deferred modules execute—and because Arabic Google Fonts (`Cairo` and `IBM Plex Sans Arabic`) were injected dynamically via JavaScript after module load—navigating between pages in Arabic produced a visible English-to-Arabic flash and layout shift.

---

## 2. Identified Problems & Root Causes

| Bug ID | Problem Description | Root Cause | Affected Files | Severity |
| :--- | :--- | :--- | :--- | :--- |
| **L10N-BUG-001** | **English-to-Arabic Flash (FOUC) & Delayed RTL Layout on Navigation** | All 9 HTML documents start with `<html lang="en">` and load `i18n.init()` inside `<script type="module">` at the end of `<body>`. Deferred module scripts execute *after* HTML parsing, allowing the browser to paint English text in LTR before switching to `lang="ar" dir="rtl"`. | `index.html`, `menu.html`, `product.html`, `checkout.html`, `tracking.html`, `orders.html`, `signin.html`, `barista.html`, `admin.html`, `js/i18n/i18n.js` | **Critical (P0)** |
| **L10N-BUG-002** | **Late Arabic Webfont Loading (`Cairo` & `IBM Plex Sans Arabic`)** | `ensureArabicFontsLoaded()` in `js/i18n/i18n.js` dynamically created the Google Fonts `<link>` tag after JavaScript module execution instead of preloading it in `<head>`, causing a secondary font reflow in Arabic mode. | `js/i18n/i18n.js`, all 9 `.html` files | **High (P1)** |
| **L10N-BUG-003** | **Loss of `?lang=ar` Query Parameter Across Internal Links** | Static `<a href="...">` links across headers, footers, breadcrumbs, and cards pointed to bare filenames (`menu.html`, `orders.html`, etc.) without propagating `?lang=ar`. | `js/i18n/i18n.js`, all 9 `.html` files | **Medium (P2)** |
| **L10N-BUG-004** | **Footer Address Multiline Mismatch** | `multilineMap` in `js/i18n/i18n.js` checked `.site-footer__col-text` against `"42 Maple Street, Zamalek, Cairo..."`, whereas the HTML templates contained `"42 Maple Street, Portland, OR<br />Mon–Fri..."`. | `js/i18n/i18n.js`, `js/i18n/translations.js` | **High (P1)** |
| **L10N-BUG-005** | **Untranslated Static Strings & Validation Errors on Product & Checkout Pages** | Option sublabels (`"Oat +20 EGP"`, `"Almond +20 EGP"`, `"+25 EGP"`, `"+15 EGP"`), breadcrumb `"← Back to your bag"`, step indicators (`"1 Your details"`, `"2 Payment"`, `"3 Enjoy"`), and inline `.checkout-field__error` validation messages were absent from `EN_TO_AR_PHRASES`. | `product.html`, `checkout.html`, `js/i18n/translations.js` | **High (P1)** |
| **L10N-BUG-006** | **Untranslated Static & Dynamic Strings in Barista & Admin Dashboards** | Several static KPI labels, table headers, modal labels, and dynamically rendered strings in `js/pages/barista.js` (staff identity badge, note prefix) and `js/pages/admin.js` (order inspector details, customer loyalty metadata, staff roster roles/stations/shifts, category select options) were missing from `EN_TO_AR_PHRASES` or rendered asynchronously without re-running `translatePageDOM()`. | `barista.html`, `admin.html`, `js/pages/barista.js`, `js/pages/admin.js`, `js/i18n/translations.js` | **High (P1)** |
| **L10N-BUG-007** | **Redundant Full-DOM Tree Walks & Reverse-Lookup Collisions** | `translatePageDOM()` relied on reverse dictionary lookups (`AR_TO_EN_PHRASES`) when switching back from Arabic to English instead of caching each text node's original English value in a `WeakMap`, and did not short-circuit when a node was already translated. | `js/i18n/i18n.js` | **Medium (P2)** |

---

## 3. Architectural Fixes & Verification Strategy

1. **Synchronous `<head>` Boot Script (`js/i18n/boot.js`)**:
   - Execute a `< 1 KB` synchronous script at the very top of `<head>` on all 9 pages before CSS parsing.
   - Immediately resolve the active language (`?lang=` -> `localStorage` -> `navigator.language` -> `"en"`), set `<html lang="ar|en" dir="rtl|ltr">`, and when `lang === "ar"`, set `data-i18n-pending="ar"` (which hides `body` via `opacity: 0` in `css/base.css` until `i18n.init()` finishes translating the DOM, with a 180ms fail-safe fallback).
2. **Preload Arabic Fonts in `<head>`**:
   - Include `Cairo:wght@500;600;700` and `IBM+Plex+Sans+Arabic:wght@400;500;600;700` directly in the `<head>` Google Fonts stylesheet link across all 9 HTML pages.
3. **100% Phrase, Placeholder, Pattern & Dynamic Coverage**:
   - Expand `EN_TO_AR_PHRASES` and `EN_TO_AR_PLACEHOLDERS` in `js/i18n/translations.js` to cover every static and dynamic string across all 9 pages.
   - Add pattern-based token translation in `js/i18n/i18n.js` for dynamic numeric strings (`"+25 EGP"`, `"6 left"`, `"120 points"`, `"10–15 min"`,timestamps, and order numbers) and `WeakMap`-backed original text caching for O(1) `AR -> EN` restoration.
4. **Automated Completeness Gate (`npm run i18n:check`)**:
   - Build `scripts/i18n-check.js` to scan all 9 HTML files and verify that 100% of text nodes and placeholders resolve to non-empty Arabic translations.
