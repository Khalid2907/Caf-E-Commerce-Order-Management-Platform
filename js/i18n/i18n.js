/**
 * COMMON GROUND — Centralized Internationalization (i18n), RTL Direction & Locale Formatter Engine
 *
 * Responsibilities:
 * 1. Resolves active language (`en` | `ar`) via URL (`?lang=ar|en`) -> `localStorage` -> browser locale -> `en`.
 * 2. Synchronizes `<html lang="ar|en" dir="rtl|ltr">` and URL query parameter without reloading the page.
 * 3. Translates static and dynamic DOM text nodes bidirectionally (`EN <-> AR`), preserving form state and cart.
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

// Build reverse lookup maps for instant AR -> EN switching
const AR_TO_EN_PHRASES = Object.freeze(
  Object.fromEntries(Object.entries(EN_TO_AR_PHRASES).map(([en, ar]) => [ar, en]))
);

const AR_TO_EN_PLACEHOLDERS = Object.freeze(
  Object.fromEntries(Object.entries(EN_TO_AR_PLACEHOLDERS).map(([en, ar]) => [ar, en]))
);

const listeners = new Set();

function detectInitialLanguage() {
  if (typeof window === "undefined") return "en";

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

  const arEntry = AR_PRODUCT_CATALOG[product.id] || AR_PRODUCT_CATALOG[product.slug];
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
      return AR_CUSTOMIZATION_TOKENS[trimmed] || trimmed;
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
  return AR_STATUS_MAP[status] || status;
}

/**
 * Translates an exact phrase or returns the original if not found.
 * @param {string} text
 * @param {string} [lang=currentLang]
 * @returns {string}
 */
export function tPhrase(text, lang = currentLang) {
  if (!text) return "";
  const normalized = String(text).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (lang === "ar") {
    return EN_TO_AR_PHRASES[normalized] || EN_TO_AR_PHRASES[text] || text;
  }
  return AR_TO_EN_PHRASES[normalized] || AR_TO_EN_PHRASES[text] || text;
}

/**
 * Walks the document DOM to translate static text nodes, placeholders, and multi-line headings
 * bidirectionally between English and Arabic.
 */
export function translatePageDOM(lang = currentLang) {
  if (typeof document === "undefined" || !document.body) return;

  // 1. Update <html lang="..." dir="...">
  const htmlEl = document.documentElement;
  htmlEl.setAttribute("lang", lang);
  htmlEl.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");

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
    {
      selector: ".site-footer__col-text",
      en: "42 Maple Street, Zamalek, Cairo<br />Mon–Fri&nbsp;&nbsp;7am–6pm&nbsp;&nbsp;/&nbsp;&nbsp;Sat–Sun&nbsp;&nbsp;8am–5pm",
      ar: "٤٢ شارع مابل، الزمالك، القاهرة<br />الإثنين–الجمعة ٧ص–٦م  /  السبت–الأحد ٨ص–٥م",
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

  // 4. Walk leaf text nodes across the page and translate exact phrase matches
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    const parentTag = currentNode.parentElement?.tagName;
    if (parentTag !== "SCRIPT" && parentTag !== "STYLE") {
      textNodes.push(currentNode);
    }
    currentNode = walker.nextNode();
  }

  textNodes.forEach((node) => {
    const raw = node.nodeValue;
    if (!raw || !raw.trim()) return;
    const normalized = raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

    // Directional arrows flipping
    if (normalized === "↗" || normalized === "↖") {
      node.nodeValue = lang === "ar" ? "↖" : "↗";
      return;
    }
    if (normalized === "→" || normalized === "←") {
      node.nodeValue = lang === "ar" ? "←" : "→";
      return;
    }

    // Dynamic bag counter pattern ("Bag · 2" <-> "السلة · ٢")
    const bagMatchEn = normalized.match(/^Bag\s*·\s*(\d+)$/);
    if (bagMatchEn && lang === "ar") {
      node.nodeValue = `السلة · ${formatLocaleNumber(Number(bagMatchEn[1]), { lang: "ar" })}`;
      return;
    }
    const bagMatchAr = normalized.match(/^السلة\s*·\s*(.+)$/);
    if (bagMatchAr && lang === "en") {
      const asciiDigits = bagMatchAr[1].replace(/[٠-٩]/g, (d) =>
        "٠١٢٣٤٥٦٧٨٩".indexOf(d)
      );
      node.nodeValue = `Bag · ${asciiDigits}`;
      return;
    }

    if (lang === "ar") {
      const translated = EN_TO_AR_PHRASES[normalized] || AR_STATUS_MAP[normalized];
      if (translated) {
        node.nodeValue = translated;
      }
    } else {
      const translatedEn = AR_TO_EN_PHRASES[normalized];
      if (translatedEn) {
        node.nodeValue = translatedEn;
      }
    }
  });

  // 5. Update Language Switcher buttons active states
  document.querySelectorAll("[data-lang-switch]").forEach((btn) => {
    const isTarget = btn.dataset.langSwitch === lang;
    btn.classList.toggle("is-active", isTarget);
    btn.setAttribute("aria-pressed", isTarget ? "true" : "false");
  });
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
