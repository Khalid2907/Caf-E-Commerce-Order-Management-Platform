/**
 * COMMON GROUND — Product Customization Controller ("03 · Product customization" & "13 · Mobile product")
 *
 * Implements:
 * - Dynamic product lookup via `?id=<productId>` URL parameter (defaults to "iced-oat-latte" matching Figma 03).
 * - Size selection (`12 oz · $5.00`, `16 oz · $5.70`).
 * - Milk selection (`Whole milk`, `Oat +$0.80`, `Almond +$0.80`).
 * - Hot / Iced selection & Add-ons (`Extra espresso shot +$1.00`, `Decaf espresso`).
 * - Quantity selection & Special instructions.
 * - Live dynamic price calculation updating both the main price display and "Add to bag · $X.XX".
 * - Complementary pairings ("A good cup deserves good company.") with instant "+ Add".
 */

import { initHeader } from "../components/header.js";
import { showToast } from "../components/toast.js";
import { formatPrice } from "../config/constants.js";
import { cartService } from "../services/cartService.js";
import { productService } from "../services/productService.js";

const state = {
  product: null,
  size: "12oz",
  temperature: "iced",
  milk: "oat",
  addons: new Set(),
  quantity: 1,
  specialInstructions: "",
};

/**
 * Calculates single unit price and total price based on selected customizations.
 */
function calculateCurrentPrices() {
  const product = state.product;
  if (!product) return { unitPrice: 0, totalPrice: 0 };

  if (!product.customizable) {
    const unitPrice = product.price;
    return {
      unitPrice,
      totalPrice: Number((unitPrice * state.quantity).toFixed(2)),
    };
  }

  const options = productService.getCustomizationOptions();
  const baseSizePrice =
    typeof product.baseSizePrice === "number" ? product.baseSizePrice : product.price;

  const sizeOption = options.sizes.find((s) => s.id === state.size);
  const milkOption = options.milks.find((m) => m.id === state.milk);

  const sizeDelta = sizeOption ? sizeOption.priceDelta : 0;
  const milkDelta = milkOption ? milkOption.priceDelta : 0;

  let addonsDelta = 0;
  state.addons.forEach((addonId) => {
    const addonObj = options.addons.find((a) => a.id === addonId);
    if (addonObj) addonsDelta += addonObj.priceDelta;
  });

  const unitPrice = Number((baseSizePrice + sizeDelta + milkDelta + addonsDelta).toFixed(2));
  const totalPrice = Number((unitPrice * state.quantity).toFixed(2));

  return { unitPrice, totalPrice };
}

/**
 * Updates all live price displays on the page.
 */
function updatePriceDisplays() {
  const { unitPrice, totalPrice } = calculateCurrentPrices();

  const unitPriceEl = document.getElementById("product-unit-price");
  const submitBtnEl = document.getElementById("product-add-submit");
  const qtyValueEl = document.getElementById("product-qty-value");

  if (unitPriceEl) {
    unitPriceEl.textContent = formatPrice(unitPrice);
  }
  if (qtyValueEl) {
    qtyValueEl.textContent = String(state.quantity);
  }
  if (submitBtnEl) {
    submitBtnEl.textContent = `Add to bag  ·  ${formatPrice(totalPrice)}`;
  }
}

/**
 * Populates product details and customization controls.
 */
function renderProductDetail() {
  const product = state.product;
  if (!product) return;

  document.title = `${product.name} — Common Ground`;

  const breadcrumbCatEl = document.getElementById("breadcrumb-category");
  const breadcrumbNameEl = document.getElementById("breadcrumb-product-name");
  const imgEl = document.getElementById("product-detail-img");
  const originTextEl = document.getElementById("product-origin-text");
  const titleEl = document.getElementById("product-detail-title");
  const descEl = document.getElementById("product-detail-desc");
  const allergenEl = document.getElementById("product-allergen-note");
  const drinkOptionsContainer = document.getElementById("drink-customization-options");

  const primaryCat = product.categoryIds?.[0] || "coffee";
  const categoryNameMap = {
    coffee: "Coffee",
    "non-coffee": "Tea & matcha",
    bakery: "Bakery",
    "iced-drinks": "Iced Drinks",
    food: "Food & Sandwiches",
  };

  if (breadcrumbCatEl) {
    breadcrumbCatEl.textContent = categoryNameMap[primaryCat] || "Menu";
    breadcrumbCatEl.href = `menu.html?category=${encodeURIComponent(primaryCat)}`;
  }
  if (breadcrumbNameEl) breadcrumbNameEl.textContent = product.name;
  if (imgEl) {
    imgEl.src = product.image;
    imgEl.alt = product.name;
  }
  if (originTextEl) {
    originTextEl.textContent =
      product.originNote || "Small batch • Prepared fresh daily at Maple Street";
  }
  if (titleEl) titleEl.textContent = product.name;
  if (descEl) {
    descEl.textContent =
      product.detailDescription || product.menuDescription || product.shortDescription;
  }
  if (allergenEl) {
    allergenEl.textContent =
      product.allergenNote || "Prepared in a kitchen that handles nuts, wheat, and dairy.";
  }

  // Update Size Option price labels dynamically based on product's baseSizePrice
  const baseSizePrice =
    typeof product.baseSizePrice === "number" ? product.baseSizePrice : product.price;
  const size12Label = document.getElementById("size-12oz-label");
  const size16Label = document.getElementById("size-16oz-label");
  if (size12Label) {
    size12Label.textContent = `12 oz  ·  ${formatPrice(baseSizePrice)}`;
  }
  if (size16Label) {
    size16Label.textContent = `16 oz  ·  ${formatPrice(baseSizePrice + 0.7)}`;
  }

  // Hide drink-only options if product is bakery/food
  if (drinkOptionsContainer) {
    drinkOptionsContainer.hidden = !product.customizable;
  }

  // Sync radio inputs with initial state
  const sizeInputs = document.querySelectorAll('input[name="size"]');
  sizeInputs.forEach((input) => {
    input.checked = input.value === state.size;
  });

  const milkInputs = document.querySelectorAll('input[name="milk"]');
  milkInputs.forEach((input) => {
    input.checked = input.value === state.milk;
  });

  const tempInputs = document.querySelectorAll('input[name="temperature"]');
  tempInputs.forEach((input) => {
    input.checked = input.value === state.temperature;
  });

  updatePriceDisplays();
}

/**
 * Renders the 2 pairing cards in "A good cup deserves good company." (Figma node 6:16)
 */
function renderPairings() {
  const container = document.getElementById("pairings-grid");
  if (!container) return;

  const pairingConfigs = [
    {
      id: "almond-croissant",
      tagline: "Buttery, flaky, baked today.",
    },
    {
      id: "batch-brew",
      tagline: "A second cup, for a friend.",
    },
  ];

  container.replaceChildren();

  pairingConfigs.forEach(({ id, tagline }) => {
    const item = productService.getProductById(id);
    if (!item) return;

    const card = document.createElement("article");
    card.className = "pairing-card";

    const img = document.createElement("img");
    img.className = "pairing-card__img";
    img.src = item.image;
    img.alt = item.name;
    img.width = 96;
    img.height = 88;
    img.loading = "lazy";

    const body = document.createElement("div");
    body.className = "pairing-card__body";

    const name = document.createElement("h3");
    name.className = "pairing-card__name";
    const link = document.createElement("a");
    link.className = "pairing-card__link";
    link.href = `product.html?id=${encodeURIComponent(item.id)}`;
    link.textContent = item.name;
    name.appendChild(link);

    const desc = document.createElement("p");
    desc.className = "pairing-card__desc";
    desc.textContent = tagline;

    const price = document.createElement("span");
    price.className = "pairing-card__price";
    price.textContent = formatPrice(item.price);

    body.appendChild(name);
    body.appendChild(desc);
    body.appendChild(price);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "pairing-card__add";
    addBtn.dataset.pairingAdd = item.id;
    addBtn.setAttribute("aria-label", `Add ${item.name} to bag`);
    addBtn.textContent = "+ Add";

    card.appendChild(img);
    card.appendChild(body);
    card.appendChild(addBtn);

    container.appendChild(card);
  });

  container.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-pairing-add]");
    if (!btn) return;
    const added = cartService.addItem(btn.dataset.pairingAdd, 1);
    if (added) {
      showToast(`Added ${added.name} (${formatPrice(added.price)}) to your bag`, {
        actionLabel: "View bag",
        actionHref: "menu.html#your-bag",
      });
    }
  });
}

function initProductPage() {
  initHeader();

  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id") || "iced-oat-latte";
  const product =
    productService.getProductById(requestedId) ||
    productService.getProductById("iced-oat-latte");

  state.product = product;
  if (product.defaultCustomizations) {
    state.size = product.defaultCustomizations.size || "12oz";
    state.temperature = product.defaultCustomizations.temperature || "iced";
    state.milk = product.defaultCustomizations.milk || "oat";
  }

  renderProductDetail();
  renderPairings();

  const form = document.getElementById("product-customizer-form");
  if (form) {
    form.addEventListener("change", (event) => {
      const target = event.target;
      if (target.name === "size") {
        state.size = target.value;
      } else if (target.name === "milk") {
        state.milk = target.value;
      } else if (target.name === "temperature") {
        state.temperature = target.value;
      } else if (target.name === "addon") {
        if (target.checked) {
          state.addons.add(target.value);
        } else {
          state.addons.delete(target.value);
        }
      }
      updatePriceDisplays();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const { unitPrice, totalPrice } = calculateCurrentPrices();

      const customOverrides = state.product.customizable
        ? {
            size: state.size,
            temperature: state.temperature,
            milk: state.milk,
            addons: Array.from(state.addons),
            specialInstructions: state.specialInstructions,
          }
        : {
            note:
              state.specialInstructions ||
              state.product.defaultCustomizations?.note ||
              "Freshly prepared",
            specialInstructions: state.specialInstructions,
          };

      cartService.addItem(state.product.id, state.quantity, customOverrides, unitPrice);

      showToast(
        `Added ${state.quantity} × ${state.product.name} (${formatPrice(totalPrice)}) to bag`,
        {
          actionLabel: "Checkout →",
          actionHref: "checkout.html",
        }
      );
    });
  }

  const instructionsInput = document.getElementById("special-instructions-input");
  if (instructionsInput) {
    instructionsInput.addEventListener("input", (event) => {
      state.specialInstructions = event.target.value;
    });
  }

  // Quantity stepper buttons
  const decBtn = document.getElementById("product-qty-dec");
  const incBtn = document.getElementById("product-qty-inc");

  if (decBtn) {
    decBtn.addEventListener("click", () => {
      if (state.quantity > 1) {
        state.quantity -= 1;
        updatePriceDisplays();
      }
    });
  }

  if (incBtn) {
    incBtn.addEventListener("click", () => {
      state.quantity += 1;
      updatePriceDisplays();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initProductPage);
} else {
  initProductPage();
}
