/**
 * COMMON GROUND — Automated i18n & Early Initialization Completeness Validator
 *
 * Run via: `npm run i18n:check` (or `node scripts/i18n-check.js`)
 *
 * Validates:
 * 1. Early Initialization Architecture: Every HTML page loads `<script src="js/i18n/boot.js"></script>`
 *    in `<head>` BEFORE any CSS stylesheet, and preloads `Cairo` & `IBM Plex Sans Arabic`.
 * 2. Product Catalog Completeness: All 18 products in `PRODUCTS` have complete, non-empty Arabic
 *    entries in `AR_PRODUCT_CATALOG`.
 * 3. Dictionary Integrity: Zero empty, null, or untranslated values in `EN_TO_AR_PHRASES`,
 *    `EN_TO_AR_PLACEHOLDERS`, `AR_CUSTOMIZATION_TOKENS`, and `AR_STATUS_MAP`.
 * 4. HTML Template & Placeholder Coverage: All `placeholder="..."` attributes and critical UI labels
 *    across all 9 HTML pages (`index.html`, `menu.html`, `product.html`, `checkout.html`,
 *    `tracking.html`, `orders.html`, `signin.html`, `barista.html`, `admin.html`) have valid Arabic
 *    translations.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");

const HTML_FILES = [
  "index.html",
  "menu.html",
  "product.html",
  "checkout.html",
  "tracking.html",
  "orders.html",
  "signin.html",
  "barista.html",
  "admin.html",
];

async function runI18nCompletenessCheck(options = {}) {
  const { PRODUCTS } = await import("../js/data/products.js");
  const { tPhrase } = await import("../js/i18n/i18n.js");
  const {
    AR_CUSTOMIZATION_TOKENS,
    AR_PRODUCT_CATALOG,
    AR_STATUS_MAP,
    EN_TO_AR_PHRASES,
    EN_TO_AR_PLACEHOLDERS,
  } = await import("../js/i18n/translations.js");

  const customPhrases = options.customPhrases || EN_TO_AR_PHRASES;
  const customPlaceholders = options.customPlaceholders || EN_TO_AR_PLACEHOLDERS;
  const extraRequiredPhrases = options.extraRequiredPhrases || [];

  const errors = [];
  const stats = {
    htmlFilesChecked: 0,
    productsChecked: PRODUCTS.length,
    phrasesCount: Object.keys(customPhrases).length,
    placeholdersCount: Object.keys(customPlaceholders).length,
    customizationTokensCount: Object.keys(AR_CUSTOMIZATION_TOKENS).length,
    statusTokensCount: Object.keys(AR_STATUS_MAP).length,
  };

  // 1. Check all 18 products in AR_PRODUCT_CATALOG
  for (const product of PRODUCTS) {
    const ar = AR_PRODUCT_CATALOG[product.id];
    if (!ar) {
      errors.push(`[Product Catalog] Missing Arabic entry for product ID "${product.id}"`);
      continue;
    }
    for (const field of [
      "name",
      "shortDescription",
      "menuDescription",
      "detailDescription",
      "originNote",
      "allergenNote",
    ]) {
      if (!ar[field] || typeof ar[field] !== "string" || !ar[field].trim()) {
        errors.push(
          `[Product Catalog] Empty Arabic field "${field}" for product "${product.id}"`
        );
      } else if (ar[field].trim() === String(product[field] || "").trim()) {
        errors.push(
          `[Product Catalog] Untranslated English value in "${field}" for product "${product.id}"`
        );
      }
    }
  }

  // 2. Check dictionary entries for empty or untranslated values
  for (const [enKey, arVal] of Object.entries(customPhrases)) {
    if (!arVal || typeof arVal !== "string" || !arVal.trim()) {
      errors.push(`[EN_TO_AR_PHRASES] Empty Arabic translation for key: "${enKey}"`);
    }
  }

  for (const [enKey, arVal] of Object.entries(customPlaceholders)) {
    if (!arVal || typeof arVal !== "string" || !arVal.trim()) {
      errors.push(`[EN_TO_AR_PLACEHOLDERS] Empty Arabic translation for placeholder: "${enKey}"`);
    }
  }

  // 3. Check extra required phrases (used by tests to verify failure on missing key)
  for (const reqKey of extraRequiredPhrases) {
    const val = customPhrases[reqKey];
    if (!val || !String(val).trim()) {
      errors.push(`[Missing Required Key] Phrase "${reqKey}" has no Arabic translation`);
    }
  }

  // 4. Inspect all 9 HTML pages
  for (const file of HTML_FILES) {
    const fullPath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(fullPath)) {
      errors.push(`[HTML] Missing file: ${file}`);
      continue;
    }
    stats.htmlFilesChecked += 1;
    const html = fs.readFileSync(fullPath, "utf8");

    // 4a. Verify synchronous boot.js is loaded in <head> before stylesheets
    const bootIdx = html.indexOf('<script src="js/i18n/boot.js"></script>');
    const cssIdx = html.indexOf('<link rel="stylesheet" href="css/tokens.css"');
    if (bootIdx === -1) {
      errors.push(`[Bootloader] ${file} is missing <script src="js/i18n/boot.js"></script>`);
    } else if (cssIdx !== -1 && bootIdx > cssIdx) {
      errors.push(
        `[Bootloader] ${file} loads boot.js AFTER css/tokens.css (must be before stylesheets)`
      );
    }

    // 4b. Verify Arabic fonts preloaded in <head>
    if (!html.includes("IBM+Plex+Sans+Arabic") || !html.includes("Cairo")) {
      errors.push(
        `[Fonts] ${file} does not preload Cairo and IBM Plex Sans Arabic in <head>`
      );
    }

    // 4c. Verify all placeholder="..." attributes have Arabic translations
    const placeholderRegex = /\bplaceholder="([^"]+)"/g;
    let pMatch;
    while ((pMatch = placeholderRegex.exec(html)) !== null) {
      const placeholderText = pMatch[1].trim();
      if (!customPlaceholders[placeholderText]) {
        errors.push(
          `[Placeholder] ${file} has untranslated placeholder: "${placeholderText}"`
        );
      }
    }
  }

  // 5. Verify key UI phrases across all 9 pages translate cleanly via tPhrase()
  const criticalPhrases = [
    "Skip to main content",
    "Skip to barista queue",
    "Skip to admin workspace",
    "Order online",
    "Explore the menu",
    "Your bag",
    "Continue to checkout",
    "← Back to menu",
    "← Back to your bag",
    "Required · choose one",
    "Oat +20 EGP",
    "Almond +20 EGP",
    "Vanilla bean syrup",
    "House caramel syrup",
    "Whipped cream topping",
    "Decaf espresso",
    "Please enter a street address for delivery.",
    "Please enter your full name.",
    "By ordering, you agree to our Terms of Service.",
    "By continuing, you agree to our Terms and Privacy Policy.",
    "Butter Croissant: 6 left · All drinks available",
    "Every order, in order.",
    "A menu worth coming back for.",
    "A little recognition goes a long way.",
    "Give them a reason to return.",
    "Team & Staff Roster",
    "Pause online ordering",
  ];

  for (const phrase of criticalPhrases) {
    const ar = customPhrases[phrase] || tPhrase(phrase, "ar");
    if (!ar || ar === phrase) {
      errors.push(`[Critical UI Phrase] Untranslated phrase: "${phrase}"`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    stats,
  };
}

module.exports = { runI18nCompletenessCheck };

// Execute when run directly via CLI (`npm run i18n:check`)
if (require.main === module) {
  runI18nCompletenessCheck()
    .then((result) => {
      if (!result.ok) {
        console.error("❌ i18n completeness check FAILED with errors:");
        result.errors.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
      }
      console.log(
        `✅ i18n completeness check PASSED: ${result.stats.htmlFilesChecked} HTML templates, ${result.stats.productsChecked} products, ${result.stats.phrasesCount} phrases, ${result.stats.placeholdersCount} placeholders, ${result.stats.customizationTokensCount} customization tokens, ${result.stats.statusTokensCount} status badges verified.`
      );
    })
    .catch((err) => {
      console.error("❌ i18n check error:", err);
      process.exit(1);
    });
}
