/**
 * COMMON GROUND — Synchronous Head Bootloader for Instant Language & RTL Initialization
 *
 * Loaded synchronously in `<head>` BEFORE stylesheets on all pages so that:
 * 1. `<html lang="ar|en" dir="rtl|ltr">` is applied before the first browser layout pass.
 * 2. When Arabic is active (`lang === "ar"`), `data-i18n-pending="ar"` is set on `<html>`
 *    until `i18n.init()` completes initial DOM translation (with a 180ms fail-safe timer),
 *    completely eliminating any English-to-Arabic Flash of Untranslated Content (FOUC).
 */
(function () {
  var STORAGE_KEY = "common_ground_lang_v1";
  var lang = "en";
  var resolved = false;

  try {
    var search = (window.location && window.location.search) || "";
    var match = search.match(/[?&]lang=(ar|en)\b/i);
    if (match && match[1]) {
      lang = match[1].toLowerCase();
      resolved = true;
      try {
        window.localStorage.setItem(STORAGE_KEY, lang);
      } catch (e) {}
    }
  } catch (e) {}

  if (!resolved) {
    try {
      var saved = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      if (saved === "ar" || saved === "en") {
        lang = saved;
        resolved = true;
      }
    } catch (e) {}
  }

  if (!resolved) {
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.language &&
        navigator.language.toLowerCase().indexOf("ar") === 0
      ) {
        lang = "ar";
      }
    } catch (e) {}
  }

  var docEl = document.documentElement;
  docEl.setAttribute("lang", lang);
  docEl.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  window.__CG_INITIAL_LANG__ = lang;

  if (lang === "ar") {
    docEl.setAttribute("data-i18n-pending", "ar");
    window.__CG_BOOT_START__ = typeof performance !== "undefined" ? performance.now() : Date.now();
    // Fail-safe: never leave the page hidden if module execution is delayed
    window.__CG_I18N_FAILSAFE__ = setTimeout(function () {
      docEl.removeAttribute("data-i18n-pending");
    }, 180);
  }
})();
