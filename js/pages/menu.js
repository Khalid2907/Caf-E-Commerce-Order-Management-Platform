/**
 * COMMON GROUND — Order Menu & Persistent Bag Controller ("02 · Order menu" & "12 · Mobile menu")
 *
 * Implements:
 * - Dynamic category filtering (with "All favorites" defaulting to the 4 Figma flagship cards
 *   and an option to browse all 18 catalog items or filter by any category).
 * - Live search and sorting.
 * - Interactive fulfillment switcher (Pickup vs. Delivery).
 * - Real-time persistent "Your bag" panel with quantity steppers, item removal, café notes,
 *   and subtotal calculation persisted in localStorage.
 */

import { initHeader } from "../components/header.js";
import { showToast } from "../components/toast.js";
import { APP_CONFIG, STORAGE_KEYS, formatPrice } from "../config/constants.js";
import { cartService } from "../services/cartService.js";
import { productService } from "../services/productService.js";
import { storageService } from "../services/storageService.js";

const state = {
  activeCategoryId: "favorites", // 'favorites' (4 flagship items matching Figma 02) or 'all' / category slug
  searchQuery: "",
  sortBy: "featured",
  fulfillment: storageService.get(STORAGE_KEYS.FULFILLMENT, "pickup"),
};

/**
 * Renders the category list into the sidebar.
 */
function renderCategories() {
  const container = document.getElementById("menu-categories-list");
  if (!container) return;

  const categories = [
    { id: "favorites", name: "All favorites" },
    { id: "coffee", name: "Coffee" },
    { id: "non-coffee", name: "Non-Coffee" },
    { id: "iced-drinks", name: "Iced Drinks" },
    { id: "bakery", name: "Desserts & Bakery" },
    { id: "food", name: "Food & Sandwiches" },
    { id: "all", name: "Full catalog (18)" },
  ];

  container.replaceChildren();

  categories.forEach((cat) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `menu-categories__btn${
      state.activeCategoryId === cat.id ? " is-active" : ""
    }`;
    btn.dataset.categoryId = cat.id;
    btn.textContent = cat.name;
    if (state.activeCategoryId === cat.id) {
      btn.setAttribute("aria-current", "true");
    }
    li.appendChild(btn);
    container.appendChild(li);
  });
}

/**
 * Creates a single Menu Catalog card element matching Figma node 6:327.
 */
function createMenuCard(product) {
  const article = document.createElement("article");
  article.className = "menu-card";
  article.dataset.productId = product.id;

  const media = document.createElement("div");
  media.className = "menu-card__media";

  const img = document.createElement("img");
  img.className = "menu-card__img";
  img.src = product.image;
  img.alt = product.name;
  img.width = 328;
  img.height = 148;
  img.loading = "lazy";
  media.appendChild(img);
  article.appendChild(media);

  const title = document.createElement("h3");
  title.className = "menu-card__title";

  const link = document.createElement("a");
  link.className = "menu-card__link";
  link.href = `product.html?id=${encodeURIComponent(product.id)}`;
  link.textContent = product.name;
  title.appendChild(link);
  article.appendChild(title);

  const desc = document.createElement("p");
  desc.className = "menu-card__desc";
  desc.textContent = product.menuDescription || product.shortDescription;
  article.appendChild(desc);

  const footer = document.createElement("footer");
  footer.className = "menu-card__footer";

  const price = document.createElement("span");
  price.className = "menu-card__price";
  price.textContent = formatPrice(product.price);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "menu-card__add-btn";
  if (!product.available) {
    addBtn.disabled = true;
    addBtn.setAttribute("aria-disabled", "true");
    addBtn.setAttribute("aria-label", `${product.name} is currently sold out`);
    addBtn.textContent = "Sold out";
  } else {
    addBtn.dataset.addProductId = product.id;
    addBtn.setAttribute("aria-label", `Add ${product.name} to bag`);
    addBtn.textContent = "+  Add";
  }

  footer.appendChild(price);
  footer.appendChild(addBtn);
  article.appendChild(footer);

  return article;
}

/**
 * Filters and renders the menu catalog grid.
 */
function renderCatalog() {
  const grid = document.getElementById("menu-catalog-grid");
  const headingEl = document.getElementById("menu-category-heading");
  const countEl = document.getElementById("menu-item-count");
  if (!grid) return;

  const totalCatalogSize = productService.getAllProducts().length;
  let products = [];

  if (state.activeCategoryId === "favorites" && !state.searchQuery.trim()) {
    products = productService.getFeaturedProducts();
    if (state.sortBy === "price-asc") {
      products = [...products].sort((a, b) => a.price - b.price);
    } else if (state.sortBy === "price-desc") {
      products = [...products].sort((a, b) => b.price - a.price);
    } else if (state.sortBy === "name-asc") {
      products = [...products].sort((a, b) => a.name.localeCompare(b.name));
    }
  } else {
    const categoryFilter =
      state.activeCategoryId === "favorites" ? "all" : state.activeCategoryId;
    products = productService.queryProducts({
      categoryId: categoryFilter,
      query: state.searchQuery,
      sortBy: state.sortBy,
    });
  }

  const categoryLabels = {
    favorites: "All favorites",
    coffee: "Coffee",
    "non-coffee": "Non-Coffee",
    bakery: "Desserts & Bakery",
    "iced-drinks": "Iced Drinks",
    food: "Food & Sandwiches",
    all: "Full menu catalog",
  };

  if (headingEl) {
    headingEl.textContent = state.searchQuery.trim()
      ? `Search results`
      : categoryLabels[state.activeCategoryId] || "All favorites";
  }

  if (countEl) {
    countEl.textContent = `${products.length} of ${totalCatalogSize} items`;
  }

  grid.replaceChildren();

  if (products.length === 0) {
    const empty = document.createElement("div");
    empty.className = "menu-empty";
    const msg = document.createElement("p");
    msg.textContent = `No items matched "${state.searchQuery}".`;
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn btn--secondary";
    resetBtn.textContent = "Reset filters";
    resetBtn.addEventListener("click", () => {
      state.activeCategoryId = "favorites";
      state.searchQuery = "";
      const searchInput = document.getElementById("menu-search-input");
      if (searchInput) searchInput.value = "";
      renderCategories();
      renderCatalog();
    });
    empty.appendChild(msg);
    empty.appendChild(resetBtn);
    grid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  products.forEach((product) => {
    fragment.appendChild(createMenuCard(product));
  });
  grid.appendChild(fragment);
}

/**
 * Renders the persistent "Your bag" panel on the right column.
 */
function renderBagPanel(summary) {
  const countEl = document.getElementById("bag-panel-count");
  const itemsContainer = document.getElementById("bag-items-list");
  const subtotalEl = document.getElementById("bag-subtotal-value");
  const checkoutBtn = document.getElementById("bag-checkout-btn");
  const mobileBagBtn = document.getElementById("mobile-view-bag-btn");

  if (countEl) {
    countEl.textContent = `${summary.totalCount} ${
      summary.totalCount === 1 ? "item" : "items"
    }`;
  }

  if (subtotalEl) {
    subtotalEl.textContent = formatPrice(summary.subtotal);
  }

  if (mobileBagBtn) {
    mobileBagBtn.textContent = `View bag  ·  ${summary.totalCount} ${
      summary.totalCount === 1 ? "item" : "items"
    }  ·  ${formatPrice(summary.subtotal)}`;
  }

  if (checkoutBtn) {
    if (summary.totalCount === 0) {
      checkoutBtn.setAttribute("aria-disabled", "true");
      checkoutBtn.classList.add("is-disabled");
    } else {
      checkoutBtn.removeAttribute("aria-disabled");
      checkoutBtn.classList.remove("is-disabled");
    }
  }

  if (!itemsContainer) return;
  itemsContainer.replaceChildren();

  if (summary.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "bag-empty";
    empty.textContent = "Your bag is empty. Add your daily cup from the menu.";
    itemsContainer.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  summary.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "bag-item";

    const img = document.createElement("img");
    img.className = "bag-item__img";
    img.src = item.image;
    img.alt = item.name;
    img.width = 64;
    img.height = 64;

    const body = document.createElement("div");
    body.className = "bag-item__body";

    const name = document.createElement("p");
    name.className = "bag-item__name";
    name.textContent = item.name;

    const meta = document.createElement("p");
    meta.className = "bag-item__meta";
    meta.textContent = item.customizationSummary;

    const controls = document.createElement("div");
    controls.className = "bag-item__controls";

    const stepper = document.createElement("div");
    stepper.className = "bag-stepper";

    const decBtn = document.createElement("button");
    decBtn.type = "button";
    decBtn.className = "bag-stepper__btn";
    decBtn.dataset.bagAction = "decrement";
    decBtn.dataset.cartItemId = item.cartItemId;
    decBtn.setAttribute("aria-label", `Decrease quantity of ${item.name}`);
    decBtn.textContent = "−";

    const qty = document.createElement("span");
    qty.className = "bag-stepper__qty";
    qty.textContent = String(item.quantity);

    const incBtn = document.createElement("button");
    incBtn.type = "button";
    incBtn.className = "bag-stepper__btn";
    incBtn.dataset.bagAction = "increment";
    incBtn.dataset.cartItemId = item.cartItemId;
    incBtn.setAttribute("aria-label", `Increase quantity of ${item.name}`);
    incBtn.textContent = "+";

    stepper.appendChild(decBtn);
    stepper.appendChild(qty);
    stepper.appendChild(incBtn);

    const linePrice = document.createElement("span");
    linePrice.className = "bag-item__price";
    linePrice.textContent = formatPrice(item.unitPrice * item.quantity);

    controls.appendChild(stepper);
    controls.appendChild(linePrice);

    body.appendChild(name);
    body.appendChild(meta);
    body.appendChild(controls);

    row.appendChild(img);
    row.appendChild(body);
    fragment.appendChild(row);
  });

  itemsContainer.appendChild(fragment);
}

/**
 * Updates the fulfillment bar text between Pickup and Delivery.
 */
function updateFulfillmentUI() {
  const modeEl = document.getElementById("fulfillment-mode-label");
  const etaEl = document.getElementById("fulfillment-eta-label");
  const bagNoteEl = document.getElementById("bag-fulfillment-note");

  if (state.fulfillment === "delivery") {
    if (modeEl) modeEl.textContent = "Delivery  •  Maple Street";
    if (etaEl) etaEl.textContent = `Arrives in ${APP_CONFIG.DELIVERY_ESTIMATE} ⌄`;
    if (bagNoteEl)
      bagNoteEl.textContent = `Delivery from Maple Street · ${APP_CONFIG.DELIVERY_ESTIMATE}`;
  } else {
    if (modeEl) modeEl.textContent = "Pickup  •  Maple Street";
    if (etaEl) etaEl.textContent = `Ready in ${APP_CONFIG.PICKUP_ESTIMATE} ⌄`;
    if (bagNoteEl)
      bagNoteEl.textContent = `Pickup at Maple Street · ${APP_CONFIG.PICKUP_ESTIMATE}`;
  }
}

async function initMenuPage() {
  initHeader();

  // Check URL query params for pre-selected category
  const params = new URLSearchParams(window.location.search);
  const urlCategory = params.get("category");
  if (urlCategory) {
    state.activeCategoryId = urlCategory;
  }

  renderCategories();
  renderCatalog();
  updateFulfillmentUI();

  // Sync live products & stock availability from PostgreSQL backend
  productService.syncFromBackend().then(() => {
    renderCatalog();
  });

  // Subscribe persistent bag panel to cartService
  cartService.subscribe(renderBagPanel);

  // Category sidebar delegation
  const categoriesList = document.getElementById("menu-categories-list");
  if (categoriesList) {
    categoriesList.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-category-id]");
      if (!btn) return;
      state.activeCategoryId = btn.dataset.categoryId;
      renderCategories();
      renderCatalog();
    });
  }

  // Search input listener
  const searchInput = document.getElementById("menu-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      state.searchQuery = event.target.value;
      renderCatalog();
    });
  }

  // Sort select listener
  const sortSelect = document.getElementById("menu-sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", (event) => {
      state.sortBy = event.target.value;
      renderCatalog();
    });
  }

  // Fulfillment switcher
  const fulfillmentBtn = document.getElementById("fulfillment-toggle-btn");
  if (fulfillmentBtn) {
    fulfillmentBtn.addEventListener("click", () => {
      state.fulfillment = state.fulfillment === "pickup" ? "delivery" : "pickup";
      storageService.set(STORAGE_KEYS.FULFILLMENT, state.fulfillment);
      updateFulfillmentUI();
    });
  }

  // Delegated "+ Add" button in Menu Catalog
  const catalogGrid = document.getElementById("menu-catalog-grid");
  if (catalogGrid) {
    catalogGrid.addEventListener("click", (event) => {
      const addBtn = event.target.closest("[data-add-product-id]");
      if (!addBtn) return;
      event.preventDefault();
      const productId = addBtn.dataset.addProductId;
      const product = cartService.addItem(productId, 1);
      if (!product) return;

      addBtn.classList.add("is-added");
      addBtn.textContent = "✓  Added";
      window.setTimeout(() => {
        addBtn.classList.remove("is-added");
        addBtn.textContent = "+  Add";
      }, 800);

      showToast(`Added ${product.name} to your bag`, {
        actionLabel: "Checkout",
        actionHref: "checkout.html",
      });
    });
  }

  // Delegated quantity stepper in "Your bag" panel
  const bagList = document.getElementById("bag-items-list");
  if (bagList) {
    bagList.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-bag-action]");
      if (!btn) return;
      const { bagAction, cartItemId } = btn.dataset;
      const items = cartService.getItems();
      const target = items.find((i) => i.cartItemId === cartItemId);
      if (!target) return;

      if (bagAction === "increment") {
        cartService.updateQuantity(cartItemId, target.quantity + 1);
      } else if (bagAction === "decrement") {
        cartService.updateQuantity(cartItemId, target.quantity - 1);
      }
    });
  }

  // Café note persistence
  const noteInput = document.getElementById("bag-cafe-note");
  if (noteInput) {
    noteInput.value = storageService.get("common_ground_cafe_note_v1", "");
    noteInput.addEventListener("input", (event) => {
      storageService.set("common_ground_cafe_note_v1", event.target.value);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMenuPage);
} else {
  initMenuPage();
}
