/**
 * COMMON GROUND — Reusable Product Card Component
 *
 * Renders semantic `<article class="product-card">` matching Figma Frame "01 · Storefront"
 * and handles event delegation for quick-add actions.
 */

import { formatPrice } from "../config/constants.js";
import { i18n, localizeProduct } from "../i18n/i18n.js";

/**
 * Creates a DOM element for a single product card.
 * Uses DOM APIs (`createElement` / `textContent`) rather than raw `innerHTML`
 * interpolation to guarantee safe rendering of dynamic data.
 *
 * @param {object} rawProduct
 * @returns {HTMLElement}
 */
export function createProductCardElement(rawProduct) {
  const product = localizeProduct(rawProduct);
  const isAr = i18n.getLanguage() === "ar";
  const article = document.createElement("article");
  article.className = "product-card";
  article.dataset.productId = product.id;

  // 1. Media region (image + optional uppercase badge)
  const mediaWrapper = document.createElement("div");
  mediaWrapper.className = "product-card__media";

  const img = document.createElement("img");
  img.className = "product-card__img";
  img.src = product.image;
  img.alt = product.name;
  img.width = 310;
  img.height = 224;
  img.loading = "lazy";
  mediaWrapper.appendChild(img);

  const badgeLabel = !product.available
    ? isAr
      ? "نفد المخزون"
      : "SOLD OUT"
    : product.badge;
  if (badgeLabel) {
    const badge = document.createElement("span");
    badge.className = "product-card__badge";
    badge.textContent = badgeLabel;
    mediaWrapper.appendChild(badge);
  }

  article.appendChild(mediaWrapper);

  // 2. Header region (title link + price)
  const header = document.createElement("header");
  header.className = "product-card__header";

  const title = document.createElement("h3");
  title.className = "product-card__title";

  const link = document.createElement("a");
  link.className = "product-card__link";
  link.href = `product.html?id=${encodeURIComponent(product.id)}`;
  link.dataset.productLink = product.id;
  link.textContent = product.name;
  title.appendChild(link);

  const price = document.createElement("span");
  price.className = "product-card__price";
  price.textContent = formatPrice(product.price);

  header.appendChild(title);
  header.appendChild(price);
  article.appendChild(header);

  // 3. Description paragraph
  const description = document.createElement("p");
  description.className = "product-card__description";
  description.textContent = product.shortDescription;
  article.appendChild(description);

  // 4. Footer region (circular quick-add "+" button)
  const footer = document.createElement("footer");
  footer.className = "product-card__footer";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "btn-quick-add";
  if (!product.available) {
    addButton.disabled = true;
    addButton.setAttribute("aria-disabled", "true");
    addButton.setAttribute("aria-label", `${product.name} is sold out`);
    addButton.textContent = "×";
  } else {
    addButton.dataset.quickAdd = product.id;
    addButton.setAttribute("aria-label", `Add ${product.name} to bag`);
    addButton.textContent = "+";
  }

  footer.appendChild(addButton);
  article.appendChild(footer);

  return article;
}

/**
 * Renders an array of products into a container element and attaches a single
 * delegated click listener for quick-add buttons.
 *
 * @param {HTMLElement} container
 * @param {Array<object>} products
 * @param {(productId: string, buttonEl: HTMLButtonElement) => void} onQuickAdd
 */
export function renderProductGrid(container, products, onQuickAdd) {
  if (!container) return;

  container.replaceChildren();

  if (!Array.isArray(products) || products.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "product-card__description";
    emptyMsg.textContent = "No items available right now.";
    container.appendChild(emptyMsg);
    return;
  }

  const fragment = document.createDocumentFragment();
  products.forEach((product) => {
    fragment.appendChild(createProductCardElement(product));
  });
  container.appendChild(fragment);

  // Bind delegated event listener once per container
  if (!container.dataset.delegatedBound) {
    container.addEventListener("click", (event) => {
      const quickAddBtn = event.target.closest("[data-quick-add]");
      if (quickAddBtn && container.contains(quickAddBtn)) {
        event.preventDefault();
        const productId = quickAddBtn.dataset.quickAdd;
        if (typeof onQuickAdd === "function") {
          onQuickAdd(productId, quickAddBtn);
        }
      }
    });
    container.dataset.delegatedBound = "true";
  }
}
