/**
 * COMMON GROUND — Centralized Internationalization (i18n), RTL Direction & Locale Formatter Engine
 *
 * Responsibilities:
 * 1. Resolves active language (`en` | `ar`) via `window.__CG_INITIAL_LANG__` (from synchronous `boot.js`)
 *    or URL (`?lang=ar|en`) -> `localStorage` -> browser locale -> `en`.
 * 2. Synchronizes `<html lang="ar|en" dir="rtl|ltr">`, removes `data-i18n-pending` the instant
 *    synchronous DOM translation finishes, and updates internal links without page flash.
 * 3. Translates static and dynamic DOM text nodes bidirectionally (`EN <-> AR`) using a `WeakMap`
 *    original-text cache for O(1) zero-collision restoration and fast skip-if-unchanged checks.
 * 4. Provides helper formatters for products (`localizeProduct`), customization summaries (`localizeSummary`),
 *    status badges (`localizeStatus`), numbers (`formatLocaleNumber`), and currency (`formatLocalePrice`).
 * 5. Mounts an accessible `EN | العربية` language switcher across Customer, Barista, and Admin interfaces.
 */

import {
  AR_CUSTOMIZATION_TOKENS,
  AR_PRODUCT_CATALOG,
  AR_STATUS_MAP,
  EN_TO_AR_PHRASES,
  EN_TO_AR_PLACEHOLDERS,
} from "./translations.js";

const LANG_STORAGE_KEY = "common_ground_lang_v1";
const SUPPORTED_LANGS = ["en", "ar"];

// Build reverse lookup maps for AR -> EN fallback when a node was created directly in Arabic
const AR_TO_EN_PHRASES = Object.freeze(
  Object.fromEntries(Object.entries(EN_TO_AR_PHRASES).map(([en, ar]) => [ar, en]))
);

const AR_TO_EN_PLACEHOLDERS = Object.freeze(
  Object.fromEntries(Object.entries(EN_TO_AR_PLACEHOLDERS).map(([en, ar]) => [ar, en]))
);

// WeakMap cache storing each Text node's original English value and last translated state
const originalNodeTextMap = new WeakMap();
const lastTranslatedValueMap = new WeakMap();

const listeners = new Set();

function detectInitialLanguage() {
  if (typeof window === "undefined") return "en";

  if (
    window.__CG_INITIAL_LANG__ &&
    SUPPORTED_LANGS.includes(window.__CG_INITIAL_LANG__)
  ) {
    return window.__CG_INITIAL_LANG__;
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = (urlParams.get("lang") || "").toLowerCase();
    if (SUPPORTED_LANGS.includes(urlLang)) {
      window.localStorage.setItem(LANG_STORAGE_KEY, urlLang);
      return urlLang;
    }
  } catch {
    // Ignore URL parse issues in non-browser tests
  }

  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }

  if (typeof navigator !== "undefined" && navigator.language) {
    if (navigator.language.toLowerCase().startsWith("ar")) {
      return "ar";
    }
  }

  return "en";
}

let currentLang = detectInitialLanguage();

/**
 * Ensures the Google Fonts stylesheet for Arabic (`IBM Plex Sans Arabic` & `Cairo`) is loaded.
 */
function ensureArabicFontsLoaded() {
  if (typeof document === "undefined") return;
  if (document.getElementById("cg-arabic-fonts-link")) return;

  const link = document.createElement("link");
  link.id = "cg-arabic-fonts-link";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

/**
 * Formats a number using Arabic-Indic digits in `ar` mode or Western digits in `en` mode.
 * @param {number} value
 * @param {object} [options]
 * @returns {string}
 */
export function formatLocaleNumber(value, { decimals = 0, lang = currentLang } = {}) {
  const numeric = Number(value) || 0;
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numeric);
}

/**
 * Formats a monetary EGP price in English ("95 EGP") or Arabic ("٩٥ ج.م.").
 * @param {number} amount
 * @param {string} [currency="EGP"]
 * @param {string} [lang=currentLang]
 * @returns {string}
 */
export function formatLocalePrice(amount, currency = "EGP", lang = currentLang) {
  const numeric = Number(amount) || 0;
  if (currency === "USD") {
    return `$${numeric.toFixed(2)}`;
  }
  const hasFraction = Math.abs(numeric - Math.round(numeric)) > 0.005;
  const formattedNum = formatLocaleNumber(numeric, {
    decimals: hasFraction ? 2 : 0,
    lang,
  });
  return lang === "ar" ? `${formattedNum} ج.م.` : `${formattedNum} EGP`;
}

/**
 * Returns a localized shallow copy of a product object for the current language.
 * Never mutates product IDs, SKUs, slugs, or numeric prices.
 * @param {object} product
 * @param {string} [lang=currentLang]
 * @returns {object}
 */
export function localizeProduct(product, lang = currentLang) {
  if (!product) return null;
  if (lang !== "ar") return product;

  const key = product.id || product.slug;
  const arEntry =
    AR_PRODUCT_CATALOG[key] ||
    AR_PRODUCT_CATALOG[product.slug] ||
    Object.values(AR_PRODUCT_CATALOG).find(
      (_, idx) =>
        Object.keys(AR_PRODUCT_CATALOG)[idx] ===
        String(product.name || "")
          .toLowerCase()
          .replace(/\s+/g, "-")
    );
  if (!arEntry) return product;

  return {
    ...product,
    name: arEntry.name || product.name,
    badge: !product.available
      ? "نفد المخزون"
      : arEntry.badge !== undefined
      ? arEntry.badge
      : product.badge,
    shortDescription: arEntry.shortDescription || product.shortDescription,
    menuDescription: arEntry.menuDescription || arEntry.shortDescription || product.menuDescription,
    detailDescription:
      arEntry.detailDescription || arEntry.shortDescription || product.detailDescription,
    originNote: arEntry.originNote || product.originNote,
    allergenNote: arEntry.allergenNote || product.allergenNote,
  };
}

/**
 * Localizes a customization summary string ("16 oz · Iced · Oat milk" -> "١٦ أونصة · مثلج · حليب الشوفان").
 * @param {string} summary
 * @param {string} [lang=currentLang]
 * @returns {string}
 */
export function localizeCustomizationSummary(summary, lang = currentLang) {
  if (!summary) return "";
  if (lang !== "ar") return summary;

  if (AR_CUSTOMIZATION_TOKENS[summary]) {
    return AR_CUSTOMIZATION_TOKENS[summary];
  }

  return summary
    .split(/\s*·\s*/)
    .map((part) => {
      const trimmed = part.trim();
      return AR_CUSTOMIZATION_TOKENS[trimmed] || EN_TO_AR_PHRASES[trimmed] || trimmed;
    })
    .join(" · ");
}

/**
 * Localizes an order or inventory status label.
 * @param {string} status
 * @param {string} [lang=currentLang]
 * @returns {string}
 */
export function localizeStatus(status, lang = currentLang) {
  if (!status) return "";
  if (lang !== "ar") return status;
  return AR_STATUS_MAP[status] || EN_TO_AR_PHRASES[status] || status;
}

/**
 * Translates dynamic pattern strings (prices, bag counts, order numbers, stock counts, points, minutes).
 * @param {string} normalized
 * @param {string} lang
 * @returns {string|null}
 */
function translateDynamicPattern(normalized, lang) {
  if (lang !== "ar") return null;

  // 1. "Bag · 2" -> "السلة · ٢"
  const bagMatch = normalized.match(/^Bag\s*·\s*(\d+)$/i);
  if (bagMatch) {
    return `السلة · ${formatLocaleNumber(Number(bagMatch[1]), { lang: "ar" })}`;
  }

  // 2. "+20 EGP" or "1,490 EGP" or "95 EGP"
  const priceMatch = normalized.match(/^([+-]?)\s*([\d,]+(?:\.\d+)?)\s*EGP$/i);
  if (priceMatch) {
    const sign = priceMatch[1] || "";
    const num = Number(priceMatch[2].replace(/,/g, ""));
    if (!Number.isNaN(num)) {
      return `${sign}${formatLocaleNumber(num, { lang: "ar" })} ج.م.`;
    }
  }

  // 3. "Order #1048" -> "طلب #1048"
  const orderMatch = normalized.match(/^Order\s+#(\d+)$/i);
  if (orderMatch) {
    return `طلب #${orderMatch[1]}`;
  }

  // 4. "6 left" -> "٦ متبقي"
  const leftMatch = normalized.match(/^(\d+)\s+left$/i);
  if (leftMatch) {
    return `${formatLocaleNumber(Number(leftMatch[1]), { lang: "ar" })} متبقي`;
  }

  // 5. "24 orders" -> "٢٤ طلب"
  const ordersCountMatch = normalized.match(/^(\d+)\s+orders$/i);
  if (ordersCountMatch) {
    return `${formatLocaleNumber(Number(ordersCountMatch[1]), { lang: "ar" })} طلب`;
  }

  // 6. "120 points" -> "١٢٠ نقطة"
  const pointsMatch = normalized.match(/^(\d+)\s+points$/i);
  if (pointsMatch) {
    return `${formatLocaleNumber(Number(pointsMatch[1]), { lang: "ar" })} نقطة`;
  }

  // 7. "9 min" -> "٩ دقائق" or "10–15 min" -> "١٠–١٥ دقيقة"
  const minRangeMatch = normalized.match(/^(\d+)[–-](\d+)\s*min$/i);
  if (minRangeMatch) {
    return `${formatLocaleNumber(Number(minRangeMatch[1]), { lang: "ar" })}–${formatLocaleNumber(
      Number(minRangeMatch[2]),
      { lang: "ar" }
    )} دقيقة`;
  }
  const minSingleMatch = normalized.match(/^(\d+)\s*min$/i);
  if (minSingleMatch) {
    const val = Number(minSingleMatch[1]);
    return `${formatLocaleNumber(val, { lang: "ar" })} ${val <= 10 ? "دقائق" : "دقيقة"}`;
  }

  // 8. "1 min ago" -> "منذ ١ د"
  const minAgoMatch = normalized.match(/^(\d+)\s*min\s+ago$/i);
  if (minAgoMatch) {
    return `منذ ${formatLocaleNumber(Number(minAgoMatch[1]), { lang: "ar" })} د`;
  }

  return null;
}

/**
 * Translates an exact phrase or pattern or returns the original if not found.
 * @param {string} text
 * @param {string} [lang=currentLang]
 * @returns {string}
 */
export function tPhrase(text, lang = currentLang) {
  if (!text) return "";
  const normalized = String(text).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (lang === "ar") {
    return (
      EN_TO_AR_PHRASES[normalized] ||
      EN_TO_AR_PHRASES[text] ||
      AR_STATUS_MAP[normalized] ||
      translateDynamicPattern(normalized, "ar") ||
      text
    );
  }
  return AR_TO_EN_PHRASES[normalized] || AR_TO_EN_PHRASES[text] || text;
}

/**
 * Synchronizes internal `.html` navigation links so `?lang=ar` persists across page clicks.
 */
function syncInternalLinks(lang) {
  if (typeof document === "undefined") return;
  document.querySelectorAll("a[href]").forEach((anchor) => {
    const rawHref = anchor.getAttribute("href");
    if (
      !rawHref ||
      rawHref.startsWith("#") ||
      rawHref.startsWith("mailto:") ||
      rawHref.startsWith("tel:") ||
      rawHref.startsWith("http:") ||
      rawHref.startsWith("https:")
    ) {
      return;
    }

    const [pathAndQuery, hashPart] = rawHref.split("#");
    const [pathname, queryPart] = pathAndQuery.split("?");
    if (!pathname.endsWith(".html")) return;

    const params = new URLSearchParams(queryPart || "");
    if (lang === "ar") {
      params.set("lang", "ar");
    } else {
      params.delete("lang");
    }
    const qs = params.toString();
    const nextHref = `${pathname}${qs ? `?${qs}` : ""}${hashPart ? `#${hashPart}` : ""}`;
    if (nextHref !== rawHref) {
      anchor.setAttribute("href", nextHref);
    }
  });
}

/**
 * Walks the document DOM to translate static text nodes, placeholders, and multi-line headings
 * bidirectionally between English and Arabic in O(1) per text node using WeakMap caching.
 */
export function translatePageDOM(lang = currentLang) {
  if (typeof document === "undefined" || !document.body) return;

  // 1. Update <html lang="..." dir="..."> and localize document.title
  const htmlEl = document.documentElement;
  htmlEl.setAttribute("lang", lang);
  htmlEl.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");

  if (typeof document.title === "string" && document.title) {
    if (!htmlEl.dataset.origTitle) {
      htmlEl.dataset.origTitle = document.title;
    }
    const origTitle = htmlEl.dataset.origTitle;
    const titleMapAr = {
      "Common Ground — Coffee, considered.": "كومون جراوند — قهوة، صُنعت بعناية.",
      "Order Menu — Common Ground": "قائمة الطلبات — كومون جراوند",
      "Checkout — Common Ground": "إتمام الطلب — كومون جراوند",
      "Order #1048 Tracking — Common Ground": "تتبع الطلب #1048 — كومون جراوند",
      "My Orders & Regulars Club — Common Ground": "طلباتي ونادي الروّاد — كومون جراوند",
      "Sign In — Common Ground": "تسجيل الدخول — كومون جراوند",
      "Barista Workspace — Common Ground": "شاشة الباريستا — كومون جراوند",
      "Store Management — Common Ground": "إدارة الفرع — كومون جراوند",
    };
    if (lang === "ar" && titleMapAr[origTitle]) {
      document.title = titleMapAr[origTitle];
    } else if (lang === "en" && titleMapAr[origTitle]) {
      document.title = origTitle;
    }
  }

  // 2. Translate multi-line headings that contain <br> tags
  const multilineMap = [
    {
      selector: "#hero-heading",
      en: "Good days start<br />on common ground.",
      ar: "أيامك الجميلة تبدأ<br />من كومون جراوند.",
    },
    {
      selector: ".hero__subtitle",
      en: "Thoughtfully sourced. Carefully brewed.<br />Your neighborhood ritual, ready when you are.",
      ar: "محاصيل مختارة بعناية، ومُحضرة بشغف.<br />قهوتك اليومية في الزمالك، جاهزة في انتظارك.",
    },
    {
      selector: "#origin-story-heading",
      en: "Better coffee.<br />Closer connections.",
      ar: "قهوة أروع.<br />ولحظات أقرب.",
    },
    {
      selector: ".menu-sidebar__care-text",
      en: "Alternative milks.<br />Seasonal ingredients.<br />Always a good choice.",
      ar: "بدائل حليب نباتية.<br />مكونات موسمية طازجة.<br />اختيارك الأفضل دائماً.",
    },
    {
      selector: ".signin-club-card__title",
      en: "A familiar face.<br />A few more perks.",
      ar: "مكانك المألوف.<br />ومكافآت أكثر في كل زيارة.",
    },
    {
      selector: ".signin-club-card__copy",
      en: "Earn points. Save your usual.<br />Make good coffee part of your everyday.",
      ar: "اجمع النقاط، واحفظ مشروبك المعتاد،<br />واجعل القهوة المختصة جزءاً من يومك.",
    },
    {
      selector: ".signin-panel__desc",
      en: "Sign in or join with your email. We’ll send you a secure<br />link, so there’s one less password to remember.",
      ar: "سجّل الدخول أو انضم إلينا ببريدك الإلكتروني. سنرسل لك رابط دخول آمن<br />وفوري بدون الحاجة لتذكر كلمة مرور جديدة.",
    },
    {
      selector: ".pickup-info-card__address",
      en: "42 Maple Street, Zamalek, Cairo<br />Open today until 6:00 pm",
      ar: "٤٢ شارع مابل، الزمالك، القاهرة<br />مفتوح اليوم حتى ٦:٠٠ مساءً",
    },
    {
      selector: ".pickup-info-card__instructions",
      en: "Head to the pickup counter and tell us your name<br />or order number. We’ll take it from there.",
      ar: "توجّه إلى كاونتر الاستلام وأخبرنا باسمك أو برقم طلبك،<br />وسيكون مشروبك جاهزاً في انتظارك.",
    },
  ];

  multilineMap.forEach(({ selector, en, ar }) => {
    const el = document.querySelector(selector);
    if (el) {
      el.innerHTML = lang === "ar" ? ar : en;
    }
  });

  // 3. Translate input placeholders
  document.querySelectorAll("input[placeholder], textarea[placeholder]").forEach((input) => {
    if (!input.dataset.origPlaceholder) {
      input.dataset.origPlaceholder = input.getAttribute("placeholder") || "";
    }
    const orig = input.dataset.origPlaceholder;
    if (lang === "ar") {
      input.setAttribute("placeholder", EN_TO_AR_PLACEHOLDERS[orig] || orig);
    } else {
      input.setAttribute("placeholder", AR_TO_EN_PLACEHOLDERS[orig] || orig);
    }
  });

  // 4. Walk leaf text nodes across the page and translate with WeakMap caching
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode();
  while (node) {
    const parentTag = node.parentElement?.tagName;
    if (parentTag !== "SCRIPT" && parentTag !== "STYLE") {
      const currentVal = node.nodeValue;
      if (currentVal && currentVal.trim()) {
        const lastState = lastTranslatedValueMap.get(node);
        // If nodeValue was modified externally since our last translation, refresh original cache
        if (!originalNodeTextMap.has(node) || (lastState && lastState.value !== currentVal)) {
          const normalizedCurrent = currentVal
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const reverseEn = AR_TO_EN_PHRASES[normalizedCurrent];
          originalNodeTextMap.set(node, reverseEn || currentVal);
        }

        const origRaw = originalNodeTextMap.get(node) || currentVal;
        const normalizedOrig = origRaw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
        const leadingSpace = (origRaw.match(/^\s+/) || [""])[0];
        const trailingSpace = (origRaw.match(/\s+$/) || [""])[0];

        let nextValue = currentVal;

        if (normalizedOrig === "↗" || normalizedOrig === "↖") {
          nextValue = `${leadingSpace}${lang === "ar" ? "↖" : "↗"}${trailingSpace}`;
        } else if (normalizedOrig === "→" || normalizedOrig === "←") {
          nextValue = `${leadingSpace}${lang === "ar" ? "←" : "→"}${trailingSpace}`;
        } else if (lang === "ar") {
          const translated =
            EN_TO_AR_PHRASES[normalizedOrig] ||
            AR_STATUS_MAP[normalizedOrig] ||
            translateDynamicPattern(normalizedOrig, "ar");
          if (translated) {
            nextValue = `${leadingSpace}${translated}${trailingSpace}`;
          }
        } else {
          // Restore original English text
          nextValue = origRaw;
        }

        if (nextValue !== currentVal) {
          node.nodeValue = nextValue;
        }
        lastTranslatedValueMap.set(node, { lang, value: nextValue });
      }
    }
    node = walker.nextNode();
  }

  // 5. Update Language Switcher buttons active states
  document.querySelectorAll("[data-lang-switch]").forEach((btn) => {
    const isTarget = btn.dataset.langSwitch === lang;
    btn.classList.toggle("is-active", isTarget);
    btn.setAttribute("aria-pressed", isTarget ? "true" : "false");
  });

  // 6. Synchronize internal links with active language parameter
  syncInternalLinks(lang);

  // 7. Release anti-FOUC pending attribute set by synchronous boot.js
  if (htmlEl.hasAttribute("data-i18n-pending")) {
    htmlEl.removeAttribute("data-i18n-pending");
    if (typeof window !== "undefined") {
      if (window.__CG_I18N_FAILSAFE__) {
        clearTimeout(window.__CG_I18N_FAILSAFE__);
      }
      if (window.__CG_BOOT_START__) {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        const elapsed = Number((now - window.__CG_BOOT_START__).toFixed(2));
        window.__CG_I18N_READY_MS__ = elapsed;
        htmlEl.setAttribute("data-i18n-ready-ms", String(elapsed));
      }
    }
  }
}

/**
 * Mounts the accessible `EN | العربية` language switcher into the current page's header/topbar.
 */
export function mountLanguageSwitcher() {
  if (typeof document === "undefined") return;

  const targets = [
    document.querySelector(".site-header__actions"),
    document.querySelector(".barista-topbar__right"),
    document.querySelector(".admin-topbar__right"),
  ].filter(Boolean);

  targets.forEach((container) => {
    if (container.querySelector(".lang-switcher")) return;

    const group = document.createElement("div");
    group.className = "lang-switcher";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Language switcher / تغيير اللغة");

    const enBtn = document.createElement("button");
    enBtn.type = "button";
    enBtn.className = `lang-switcher__btn${currentLang === "en" ? " is-active" : ""}`;
    enBtn.dataset.langSwitch = "en";
    enBtn.setAttribute("lang", "en");
    enBtn.setAttribute("aria-label", "Switch language to English");
    enBtn.setAttribute("aria-pressed", currentLang === "en" ? "true" : "false");
    enBtn.textContent = "EN";

    const divider = document.createElement("span");
    divider.className = "lang-switcher__sep";
    divider.setAttribute("aria-hidden", "true");
    divider.textContent = "|";

    const arBtn = document.createElement("button");
    arBtn.type = "button";
    arBtn.className = `lang-switcher__btn lang-switcher__btn--ar${
      currentLang === "ar" ? " is-active" : ""
    }`;
    arBtn.dataset.langSwitch = "ar";
    arBtn.setAttribute("lang", "ar");
    arBtn.setAttribute("aria-label", "تغيير اللغة إلى العربية");
    arBtn.setAttribute("aria-pressed", currentLang === "ar" ? "true" : "false");
    arBtn.textContent = "العربية";

    group.appendChild(enBtn);
    group.appendChild(divider);
    group.appendChild(arBtn);

    group.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-lang-switch]");
      if (!btn) return;
      i18n.setLanguage(btn.dataset.langSwitch);
    });

    container.insertBefore(group, container.firstChild);
  });
}

export const i18n = {
  getLanguage() {
    return currentLang;
  },

  isRTL() {
    return currentLang === "ar";
  },

  setLanguage(nextLang) {
    const normalized = SUPPORTED_LANGS.includes(nextLang) ? nextLang : "en";
    currentLang = normalized;

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, normalized);
      } catch {
        // Ignore storage error
      }

      try {
        const url = new URL(window.location.href);
        url.searchParams.set("lang", normalized);
        window.history.replaceState({}, "", url.toString());
      } catch {
        // Ignore history error
      }
    }

    ensureArabicFontsLoaded();
    translatePageDOM(normalized);

    listeners.forEach((cb) => {
      try {
        cb(normalized);
      } catch (err) {
        console.error("[i18n] Subscriber error:", err);
      }
    });
  },

  subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  init() {
    ensureArabicFontsLoaded();
    mountLanguageSwitcher();
    translatePageDOM(currentLang);
  },
};
