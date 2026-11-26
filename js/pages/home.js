/**
 * COMMON GROUND — Homepage Controller ("01 · Storefront")
 *
 * Hydrates featured products from `GET /api/products` via `productService.syncFromBackend()`
 * while rendering immediately from cache for zero layout shift.
 */

import { initHeader } from "../components/header.js";
import { renderProductGrid } from "../components/productCard.js";
import { showToast } from "../components/toast.js";
import { formatPrice } from "../config/constants.js";
import { formatLocaleNumber, i18n, localizeProduct } from "../i18n/i18n.js";
import { cartService } from "../services/cartService.js";
import { productService } from "../services/productService.js";

function handleQuickAdd(productId, buttonEl) {
  const addedProduct = cartService.addItem(productId, 1);
  if (!addedProduct) return;
  const localized = localizeProduct(addedProduct);
  const isAr = i18n.getLanguage() === "ar";

  buttonEl.classList.add("is-added");
  buttonEl.textContent = "✓";

  window.setTimeout(() => {
    buttonEl.classList.remove("is-added");
    buttonEl.textContent = "+";
  }, 900);

  const { totalCount } = cartService.getSummary();
  const msg = isAr
    ? `تمت إضافة ${localized.name} (${formatPrice(addedProduct.price)}) · السلة تحتوي على ${formatLocaleNumber(totalCount)}`
    : `Added ${addedProduct.name} (${formatPrice(addedProduct.price)}) · Bag has ${totalCount} ${
        totalCount === 1 ? "item" : "items"
      }`;
  showToast(msg, {
    actionLabel: isAr ? "عرض السلة" : "View bag",
    actionHref: "menu.html#your-bag",
  });
}

async function initHomePage() {
  initHeader();

  const featuredGrid = document.getElementById("featured-products-grid");
  renderProductGrid(featuredGrid, productService.getFeaturedProducts(), handleQuickAdd);

  i18n.subscribe(() => {
    renderProductGrid(featuredGrid, productService.getFeaturedProducts(), handleQuickAdd);
  });

  await productService.syncFromBackend();
  renderProductGrid(featuredGrid, productService.getFeaturedProducts(), handleQuickAdd);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHomePage);
} else {
  initHomePage();
}
