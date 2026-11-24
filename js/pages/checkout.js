/**
 * COMMON GROUND — Checkout Controller ("04 · Checkout", "18 · Delivery checkout", "14 · Mobile checkout")
 *
 * Implements:
 * - Pickup vs. Delivery toggle with dynamic section numbering (01..03 for Pickup, 01..04 for Delivery)
 *   and conditional Delivery Address validation + $2.50 delivery fee + "A smooth handoff." banner.
 * - Tip selector (No tip, 10%, 15%, 20%).
 * - Promo code support (e.g., WELCOME10 for 10% off, MORNING15 for 15% off, COFFEEONUS for $3 off)
 *   matching Figma "20 · Discounts".
 * - Accessible form validation after interaction (:user-invalid + aria-invalid / aria-describedby sync).
 * - Order creation via `orderService.createOrder()` and redirection to `tracking.html`.
 */

import { initHeader } from "../components/header.js";
import { APP_CONFIG, STORAGE_KEYS, formatPrice } from "../config/constants.js";
import { cartService } from "../services/cartService.js";
import { orderService } from "../services/orderService.js";
import { storageService } from "../services/storageService.js";

const PROMO_CODES = {
  WELCOME10: { type: "percent", value: 0.1, label: "10% off first order" },
  MORNING15: { type: "percent", value: 0.15, label: "15% off morning ritual" },
  COFFEEONUS: { type: "fixed", value: 3.0, label: "$3.00 off your order" },
};

const state = {
  fulfillment: storageService.get(STORAGE_KEYS.FULFILLMENT, "pickup"),
  tipRate: 0,
  promoCode: "",
  discountAmount: 0,
};

/**
 * Synchronizes `aria-invalid` and `aria-describedby` with `:user-invalid`
 * per modern-web-guidance `validate-input-after-interaction`.
 */
function setupValidationSync(form) {
  if (!form) return;

  const linkError = (el, shown) => {
    const errorId = el.dataset.error;
    if (!errorId) return;
    const ids = (el.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
    else el.removeAttribute("aria-describedby");
  };

  const syncField = (el, forceCheck = false) => {
    if (!el.matches || !el.matches("input, select, textarea")) return;
    const isInvalid = forceCheck ? !el.checkValidity() : el.matches(":user-invalid");
    if (forceCheck) {
      el.classList.toggle("user-invalid-fallback", isInvalid);
    }
    el.setAttribute("aria-invalid", isInvalid ? "true" : "false");
    linkError(el, isInvalid);
  };

  form.querySelectorAll("input, select, textarea").forEach((el) => {
    el.setAttribute("aria-invalid", "false");
  });

  form.addEventListener(
    "blur",
    (e) => {
      syncField(e.target);
    },
    true
  );

  form.addEventListener("input", (e) => {
    if (e.target.hasAttribute("aria-invalid")) {
      e.target.classList.remove("user-invalid-fallback");
      syncField(e.target);
    }
  });

  form.addEventListener(
    "invalid",
    (e) => {
      syncField(e.target, true);
    },
    true
  );
}

/**
 * Toggles Pickup vs. Delivery UI sections, headings, and required attributes.
 */
function updateFulfillmentLayout() {
  const isDelivery = state.fulfillment === "delivery";

  const heroTitle = document.getElementById("checkout-page-title");
  const deliverySection = document.getElementById("delivery-address-section");
  const detailsHeading = document.getElementById("details-section-heading");
  const paymentHeading = document.getElementById("payment-section-heading");
  const timeLabel = document.getElementById("fulfillment-time-label");
  const timeSelect = document.getElementById("fulfillment-time-select");
  const locationSubnote = document.getElementById("fulfillment-location-note");
  const deliverySubtext = document.getElementById("delivery-card-subtext");
  const handoffCard = document.getElementById("delivery-handoff-card");

  if (heroTitle) {
    heroTitle.textContent = isDelivery
      ? "Good coffee, to your door."
      : "Your next good moment.";
  }

  if (deliverySection) {
    deliverySection.hidden = !isDelivery;
    deliverySection.classList.toggle("is-hidden", !isDelivery);
    deliverySection.querySelectorAll("input").forEach((input) => {
      input.required = isDelivery;
      if (!isDelivery) {
        input.setAttribute("aria-invalid", "false");
        input.classList.remove("user-invalid-fallback");
      }
    });
  }

  if (detailsHeading) {
    detailsHeading.textContent = isDelivery ? "03  /  Your details" : "02  /  Your details";
  }

  if (paymentHeading) {
    paymentHeading.textContent = isDelivery ? "04  /  Payment" : "03  /  Payment";
  }

  if (timeLabel) {
    timeLabel.textContent = isDelivery ? "Estimated delivery" : "Pickup time";
  }

  if (timeSelect) {
    timeSelect.options[0].textContent = isDelivery
      ? "ASAP · Arrives in 25–35 minutes"
      : "ASAP · Ready in 10–15 minutes";
  }

  if (locationSubnote) {
    locationSubnote.textContent = isDelivery
      ? "Delivered from Maple Street · $2.50 delivery fee"
      : "42 Maple Street, Portland, OR · Open until 6:00 pm";
  }

  if (deliverySubtext) {
    deliverySubtext.textContent = isDelivery
      ? "Available within 3 miles"
      : "Enter an address to check availability";
  }

  if (handoffCard) {
    handoffCard.hidden = !isDelivery;
  }

  // Sync radio inputs
  document.querySelectorAll('input[name="fulfillment"]').forEach((radio) => {
    radio.checked = radio.value === state.fulfillment;
  });

  renderOrderReview();
}

/**
 * Calculates and renders the right-hand "Your order" summary and totals.
 */
function renderOrderReview() {
  const summary = cartService.getSummary({
    fulfillment: state.fulfillment,
    tipRate: state.tipRate,
  });

  // Calculate promo discount if active
  let discount = 0;
  if (state.promoCode && PROMO_CODES[state.promoCode]) {
    const promo = PROMO_CODES[state.promoCode];
    discount =
      promo.type === "percent"
        ? Number((summary.subtotal * promo.value).toFixed(2))
        : Math.min(summary.subtotal, promo.value);
  }
  state.discountAmount = discount;

  const finalTotal = Math.max(0, Number((summary.total - discount).toFixed(2)));

  // Render items
  const itemsContainer = document.getElementById("checkout-review-items");
  if (itemsContainer) {
    itemsContainer.replaceChildren();
    summary.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "review-item";

      const img = document.createElement("img");
      img.className = "review-item__img";
      img.src = item.image;
      img.alt = item.name;
      img.width = 72;
      img.height = 72;

      const body = document.createElement("div");
      body.className = "review-item__body";

      const name = document.createElement("p");
      name.className = "review-item__name";
      name.textContent = `${item.quantity} × ${item.name}`;

      const meta = document.createElement("p");
      meta.className = "review-item__meta";
      meta.textContent = item.customizationSummary;

      const price = document.createElement("p");
      price.className = "review-item__price";
      price.textContent = formatPrice(item.unitPrice * item.quantity);

      body.appendChild(name);
      body.appendChild(meta);
      body.appendChild(price);

      row.appendChild(img);
      row.appendChild(body);
      itemsContainer.appendChild(row);
    });
  }

  // Update totals
  const subtotalEl = document.getElementById("checkout-subtotal");
  const taxEl = document.getElementById("checkout-tax");
  const tipEl = document.getElementById("checkout-tip");
  const deliveryRow = document.getElementById("checkout-delivery-row");
  const deliveryVal = document.getElementById("checkout-delivery-fee");
  const discountRow = document.getElementById("checkout-discount-row");
  const discountVal = document.getElementById("checkout-discount-val");
  const totalEl = document.getElementById("checkout-total");
  const submitBtn = document.getElementById("checkout-submit-btn");

  if (subtotalEl) subtotalEl.textContent = formatPrice(summary.subtotal);
  if (taxEl) taxEl.textContent = formatPrice(summary.tax);
  if (tipEl) tipEl.textContent = formatPrice(summary.tip);

  if (deliveryRow && deliveryVal) {
    deliveryRow.hidden = state.fulfillment !== "delivery";
    deliveryVal.textContent = formatPrice(summary.deliveryFee);
  }

  if (discountRow && discountVal) {
    discountRow.hidden = discount <= 0;
    discountVal.textContent = `−${formatPrice(discount)}`;
  }

  if (totalEl) totalEl.textContent = formatPrice(finalTotal);

  if (submitBtn) {
    const actionVerb =
      state.fulfillment === "delivery" ? "Place delivery order" : "Place pickup order";
    submitBtn.textContent = `${actionVerb}  ·  ${formatPrice(finalTotal)}`;
    submitBtn.disabled = summary.totalCount === 0;
  }
}

function initCheckoutPage() {
  initHeader();

  // Check URL query param `?mode=delivery` or `?mode=pickup`
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get("mode");
  if (modeParam === "delivery" || modeParam === "pickup") {
    state.fulfillment = modeParam;
    storageService.set(STORAGE_KEYS.FULFILLMENT, modeParam);
  }

  const form = document.getElementById("checkout-form");
  setupValidationSync(form);
  updateFulfillmentLayout();

  // Fulfillment radio change
  document.querySelectorAll('input[name="fulfillment"]').forEach((radio) => {
    radio.addEventListener("change", (event) => {
      state.fulfillment = event.target.value;
      storageService.set(STORAGE_KEYS.FULFILLMENT, state.fulfillment);
      updateFulfillmentLayout();
    });
  });

  // Tip pills
  const tipContainer = document.getElementById("checkout-tip-pills");
  if (tipContainer) {
    tipContainer.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-tip-rate]");
      if (!btn) return;
      state.tipRate = parseFloat(btn.dataset.tipRate) || 0;
      tipContainer.querySelectorAll("[data-tip-rate]").forEach((el) => {
        const active = el === btn;
        el.classList.toggle("is-active", active);
        el.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderOrderReview();
    });
  }

  // Promo code toggle & apply
  const promoToggle = document.getElementById("promo-toggle-btn");
  const promoBox = document.getElementById("promo-input-box");
  const promoInput = document.getElementById("promo-code-input");
  const promoApplyBtn = document.getElementById("promo-apply-btn");
  const promoFeedback = document.getElementById("promo-feedback-msg");

  if (promoToggle && promoBox) {
    promoToggle.addEventListener("click", () => {
      const nextHidden = !promoBox.hidden;
      promoBox.hidden = nextHidden;
      promoToggle.setAttribute("aria-expanded", String(!nextHidden));
      if (!nextHidden && promoInput) promoInput.focus();
    });
  }

  if (promoApplyBtn && promoInput) {
    promoApplyBtn.addEventListener("click", () => {
      const code = promoInput.value.trim().toUpperCase();
      if (PROMO_CODES[code]) {
        state.promoCode = code;
        if (promoFeedback) {
          promoFeedback.textContent = `✓ Applied ${code} (${PROMO_CODES[code].label})`;
        }
      } else {
        state.promoCode = "";
        if (promoFeedback) {
          promoFeedback.textContent =
            "Try WELCOME10 (10% off), MORNING15 (15% off), or COFFEEONUS ($3 off).";
        }
      }
      renderOrderReview();
    });
  }

  // Form submit -> validate, create order, redirect to tracking.html
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        const firstInvalid = form.querySelector(":invalid");
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      const summary = cartService.getSummary({
        fulfillment: state.fulfillment,
        tipRate: state.tipRate,
      });

      const finalTotal = Math.max(
        0,
        Number((summary.total - state.discountAmount).toFixed(2))
      );

      const fullName = document.getElementById("customer-name")?.value || "Alex Johnson";
      const phone = document.getElementById("customer-phone")?.value || "(503) 555-0142";
      const email =
        document.getElementById("customer-email")?.value || "alex.johnson@example.com";
      const street = document.getElementById("shipping-address")?.value || "";
      const city = document.getElementById("shipping-city")?.value || "Portland";
      const region = document.getElementById("shipping-state")?.value || "OR";
      const zip = document.getElementById("shipping-zip")?.value || "97205";
      const cardNumber = document.getElementById("cc-number")?.value || "4242 4242 4242 4242";

      orderService.createOrder({
        fulfillment: state.fulfillment,
        customer: {
          fullName,
          phone,
          email,
          address:
            state.fulfillment === "delivery" ? `${street}, ${city}, ${region} ${zip}` : "",
        },
        payment: {
          method: "Credit or debit card",
          cardNumber,
        },
        items: summary.items,
        subtotal: summary.subtotal,
        tax: summary.tax,
        tip: summary.tip,
        deliveryFee: summary.deliveryFee,
        discount: state.discountAmount,
        total: finalTotal,
      });

      window.location.href = "tracking.html";
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCheckoutPage);
} else {
  initCheckoutPage();
}
