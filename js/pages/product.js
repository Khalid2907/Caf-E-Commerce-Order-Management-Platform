/**
 * COMMON GROUND — Product Customization Controller ("03 · Product customization" & "13 · Mobile product")
 *
 * Retrieves product and customization groups from `GET /api/products/:id` (with local fallback),
 * supports Size, Temperature, Milk, Sugar level, Add-ons/Syrups/Toppings, Quantity, and Special Instructions,
 * and computes dynamic EGP pricing.
 */

import { initHeader } from "../components/header.js";
import { showToast } from "../components/toast.js";
import { formatPrice } from "../config/constants.js";
import { formatLocaleNumber, i18n, localizeProduct } from "../i18n/i18n.js";
import { cartService } from "../services/cartService.js";
import { productService } from "../services/productService.js";

const state = {
  product: null,
  size: "12oz",
  temperature: "hot",
  milk: "whole",
  sugar: "regular-sugar",
  addons: new Set(),
  quantity: 1,
  specialInstructions: "",
};

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

function updatePriceDisplays() {
  const { unitPrice, totalPrice } = calculateCurrentPrices();
  const isAr = i18n.getLanguage() === "ar";

  const unitPriceEl = document.getElementById("product-unit-price");
  const submitBtnEl = document.getElementById("product-add-submit");
  const qtyValueEl = document.getElementById("product-qty-value");

  if (unitPriceEl) {
    unitPriceEl.textContent = formatPrice(unitPrice);
  }
  if (qtyValueEl) {
    qtyValueEl.textContent = formatLocaleNumber(state.quantity);
  }
  if (submitBtnEl) {
    if (state.product && !state.product.available) {
      submitBtnEl.disabled = true;
      submitBtnEl.textContent = isAr
        ? "غير متوفر حالياً (نفد المخزون)"
        : "Currently Sold Out";
    } else {
      submitBtnEl.disabled = false;
      submitBtnEl.textContent = isAr
        ? `أضف إلى السلة  ·  ${formatPrice(totalPrice)}`
        : `Add to bag  ·  ${formatPrice(totalPrice)}`;
    }
  }
}

function renderProductDetail() {
  const rawProduct = state.product;
  if (!rawProduct) return;
  const product = localizeProduct(rawProduct);
  const isAr = i18n.getLanguage() === "ar";

  document.title = isAr
    ? `${product.name} — كومون جراوند`
    : `${product.name} — Common Ground`;

  const breadcrumbCatEl = document.getElementById("breadcrumb-category");
  const breadcrumbNameEl = document.getElementById("breadcrumb-product-name");
  const imgEl = document.getElementById("product-detail-img");
  const originTextEl = document.getElementById("product-origin-text");
  const titleEl = document.getElementById("product-detail-title");
  const descEl = document.getElementById("product-detail-desc");
  const allergenEl = document.getElementById("product-allergen-note");
  const drinkOptionsContainer = document.getElementById("drink-customization-options");

  const primaryCat = product.categoryId || product.categoryIds?.[0] || "coffee";
  const categoryNameMap = isAr
    ? {
        coffee: "القهوة",
        "non-coffee": "مشروبات بدون قهوة",
        bakery: "الحلويات والمخبوزات",
        "iced-drinks": "مشروبات مثلجة",
        food: "الساندوتشات والمأكولات",
      }
    : {
        coffee: "Coffee",
        "non-coffee": "Non-Coffee",
        bakery: "Desserts & Bakery",
        "iced-drinks": "Iced Drinks",
        food: "Food & Sandwiches",
      };

  if (breadcrumbCatEl) {
    breadcrumbCatEl.textContent = categoryNameMap[primaryCat] || (isAr ? "القائمة" : "Menu");
    breadcrumbCatEl.href = `menu.html?category=${encodeURIComponent(primaryCat)}${
      isAr ? "&lang=ar" : ""
    }`;
  }
  if (breadcrumbNameEl) breadcrumbNameEl.textContent = product.name;
  if (imgEl) {
    imgEl.src = product.image;
    imgEl.alt = product.name;
  }
  if (originTextEl) {
    originTextEl.textContent =
      product.originNote ||
      (isAr
        ? "تحميص بكميات صغيرة • يُحضر طازجاً يومياً في الزمالك"
        : "Small batch • Prepared fresh daily at Maple Street");
  }
  if (titleEl) titleEl.textContent = product.name;
  if (descEl) {
    descEl.textContent =
      product.detailDescription || product.menuDescription || product.shortDescription;
  }
  if (allergenEl) {
    allergenEl.textContent =
      product.allergenNote ||
      (isAr
        ? "يُحضر في مطبخ يتعامل مع المكسرات والقمح ومنتجات الألبان."
        : "Prepared in a kitchen that handles nuts, wheat, and dairy.");
  }

  const baseSizePrice =
    typeof product.baseSizePrice === "number" ? product.baseSizePrice : product.price;
  const size12Label = document.getElementById("size-12oz-label");
  const size16Label = document.getElementById("size-16oz-label");
  if (size12Label) {
    size12Label.textContent = isAr
      ? `١٢ أونصة  ·  ${formatPrice(baseSizePrice)}`
      : `12 oz  ·  ${formatPrice(baseSizePrice)}`;
  }
  if (size16Label) {
    size16Label.textContent = isAr
      ? `١٦ أونصة  ·  ${formatPrice(baseSizePrice + 15)}`
      : `16 oz  ·  ${formatPrice(baseSizePrice + 15)}`;
  }

  if (drinkOptionsContainer) {
    drinkOptionsContainer.hidden = !product.customizable;
  }

  document.querySelectorAll('input[name="size"]').forEach((input) => {
    input.checked = input.value === state.size;
  });
  document.querySelectorAll('input[name="milk"]').forEach((input) => {
    input.checked = input.value === state.milk;
  });
  document.querySelectorAll('input[name="temperature"]').forEach((input) => {
    input.checked = input.value === state.temperature;
  });
  document.querySelectorAll('input[name="sugar"]').forEach((input) => {
    input.checked = input.value === state.sugar;
  });

  updatePriceDisplays();
}

function renderPairings() {
  const container = document.getElementById("pairings-grid");
  if (!container) return;
  const isAr = i18n.getLanguage() === "ar";

  const pairingConfigs = [
    {
      id: "butter-croissant",
      tagline: isAr ? "مورق بالزبدة الطبيعية، مخبوز اليوم." : "Buttery, flaky, baked today.",
    },
    {
      id: "americano",
      tagline: isAr ? "كوب ثانٍ، تشاركه مع صديق." : "A second cup, for a friend.",
    },
  ];

  container.replaceChildren();

  pairingConfigs.forEach(({ id, tagline }) => {
    const rawItem = productService.getProductById(id);
    if (!rawItem) return;
    const item = localizeProduct(rawItem);

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
    link.href = `product.html?id=${encodeURIComponent(item.id)}${isAr ? "&lang=ar" : ""}`;
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
    addBtn.textContent = isAr ? "+ إضافة" : "+ Add";

    card.appendChild(img);
    card.appendChild(body);
    card.appendChild(addBtn);

    container.appendChild(card);
  });

  if (!container.dataset.bound) {
    container.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-pairing-add]");
      if (!btn) return;
      const added = cartService.addItem(btn.dataset.pairingAdd, 1);
      if (added) {
        const locAdded = localizeProduct(added);
        const ar = i18n.getLanguage() === "ar";
        showToast(
          ar
            ? `تمت إضافة ${locAdded.name} (${formatPrice(added.price)}) إلى السلة`
            : `Added ${added.name} (${formatPrice(added.price)}) to your bag`,
          {
            actionLabel: ar ? "عرض السلة" : "View bag",
            actionHref: "menu.html#your-bag",
          }
        );
      }
    });
    container.dataset.bound = "true";
  }
}

async function initProductPage() {
  initHeader();

  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id") || "spanish-latte";

  // Initial synchronous render from cache
  let product =
    productService.getProductById(requestedId) ||
    productService.getProductById("spanish-latte");

  state.product = product;
  if (product?.defaultCustomizations) {
    state.size = product.defaultCustomizations.size || "12oz";
    state.temperature = product.defaultCustomizations.temperature || "hot";
    state.milk = product.defaultCustomizations.milk || "whole";
    state.sugar = product.defaultCustomizations.sugar || "regular-sugar";
  }

  renderProductDetail();
  renderPairings();

  i18n.subscribe(() => {
    renderProductDetail();
    renderPairings();
  });

  // Hydrate live product from PostgreSQL backend
  await productService.syncFromBackend();
  const remoteDetail = await productService.fetchProductDetail(requestedId);
  if (remoteDetail) {
    state.product = remoteDetail;
    renderProductDetail();
    renderPairings();
  }

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
      } else if (target.name === "sugar") {
        state.sugar = target.value;
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
      if (!state.product || !state.product.available) return;

      const { unitPrice, totalPrice } = calculateCurrentPrices();

      const customOverrides = state.product.customizable
        ? {
            size: state.size,
            temperature: state.temperature,
            milk: state.milk,
            sugar: state.sugar,
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

      const isAr = i18n.getLanguage() === "ar";
      const locProd = localizeProduct(state.product);
      showToast(
        isAr
          ? `تمت إضافة ${formatLocaleNumber(state.quantity)} × ${locProd.name} (${formatPrice(
              totalPrice
            )}) إلى السلة`
          : `Added ${state.quantity} × ${state.product.name} (${formatPrice(totalPrice)}) to bag`,
        {
          actionLabel: isAr ? "إتمام الطلب ←" : "Checkout →",
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
