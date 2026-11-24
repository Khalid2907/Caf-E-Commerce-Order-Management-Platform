/**
 * COMMON GROUND — Homepage Controller ("01 · Storefront")
 *
 * Bootstraps the shared header state, renders the 4 featured "Neighborhood Favorites"
 * from `productService`, and wires quick-add buttons to `cartService` with visual feedback.
 */

import { initHeader } from "../components/header.js";
import { renderProductGrid } from "../components/productCard.js";
import { showToast } from "../components/toast.js";
import { formatPrice } from "../config/constants.js";
import { cartService } from "../services/cartService.js";
import { productService } from "../services/productService.js";

function handleQuickAdd(productId, buttonEl) {
  const addedProduct = cartService.addItem(productId, 1);
  if (!addedProduct) return;

  // Tactile button feedback
  buttonEl.classList.add("is-added");
  buttonEl.textContent = "✓";

  window.setTimeout(() => {
    buttonEl.classList.remove("is-added");
    buttonEl.textContent = "+";
  }, 900);

  const { totalCount } = cartService.getSummary();
  showToast(
    `Added ${addedProduct.name} (${formatPrice(addedProduct.price)}) · Bag has ${totalCount} ${
      totalCount === 1 ? "item" : "items"
    }`
  );
}

function initHomePage() {
  initHeader();

  const featuredGrid = document.getElementById("featured-products-grid");
  const featuredProducts = productService.getFeaturedProducts();

  renderProductGrid(featuredGrid, featuredProducts, handleQuickAdd);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHomePage);
} else {
  initHomePage();
}
