/**
 * COMMON GROUND — Header, Language Switcher & Live Bag Counter Synchronizer
 * Keeps the header "Bag · N" / "السلة · N" button and language switcher synchronized.
 */

import { formatLocaleNumber, i18n } from "../i18n/i18n.js";
import { cartService } from "../services/cartService.js";

export function initHeader() {
  i18n.init();

  const bagCountElements = document.querySelectorAll("[data-bag-button]");

  function updateBagLabels({ totalCount }) {
    const isAr = i18n.getLanguage() === "ar";
    const formattedCount = formatLocaleNumber(totalCount);
    bagCountElements.forEach((element) => {
      element.textContent = isAr
        ? `السلة · ${formattedCount}`
        : `Bag · ${formattedCount}`;
      element.setAttribute(
        "aria-label",
        isAr
          ? `سلة التسوق، ${formattedCount} منتجات`
          : `Shopping bag, ${totalCount} ${totalCount === 1 ? "item" : "items"}`
      );
    });
  }

  cartService.subscribe(updateBagLabels);
  i18n.subscribe(() => {
    updateBagLabels(cartService.getSummary());
  });
}
