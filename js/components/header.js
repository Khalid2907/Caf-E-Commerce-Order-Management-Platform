/**
 * COMMON GROUND — Header & Live Bag Counter Synchronizer
 * Keeps the header "Bag · N" button and mobile bag pill synchronized with cartService.
 */

import { cartService } from "../services/cartService.js";

export function initHeader() {
  const bagCountElements = document.querySelectorAll("[data-bag-button]");

  cartService.subscribe(({ totalCount }) => {
    bagCountElements.forEach((element) => {
      element.textContent = `Bag · ${totalCount}`;
      element.setAttribute(
        "aria-label",
        `Shopping bag, ${totalCount} ${totalCount === 1 ? "item" : "items"}`
      );
    });
  });
}
