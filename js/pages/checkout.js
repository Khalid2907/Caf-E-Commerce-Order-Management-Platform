/**
 * COMMON GROUND — Checkout Controller (Full-Stack API Submission)
 *
 * Submits validated orders to `POST /api/orders`, persists the created database order,
 * supports Cash payment (Stage 12F) and Card on pickup, and redirects to `tracking.html?ref=<orderReference>`.
 */

import { initHeader } from "../components/header.js";
import { showToast } from "../components/toast.js";
import { STORAGE_KEYS, formatPrice } from "../config/constants.js";
import {
  formatLocaleNumber,
  i18n,
  localizeCustomizationSummary,
  localizeProduct,
} from "../i18n/i18n.js";
import { apiRequest } from "../services/apiClient.js";
import { cartService } from "../services/cartService.js";
import { orderService } from "../services/orderService.js";
import { storageService } from "../services/storageService.js";

const PROMO_CODES = {
  WELCOME10: { type: "percent", value: 0.1, minOrder: 80, label: "10% off first order" },
  MORNING15: { type: "percent", value: 0.15, minOrder: 100, label: "15% off morning ritual (min 100 EGP)" },
  COFFEEONUS: { type: "fixed", value: 30, minOrder: 150, label: "30 EGP off orders over 150 EGP" },
  OATLOVER: { type: "fixed", value: 20, minOrder: 95, label: "Free oat milk upgrade (20 EGP off)" },
};

const state = {
  fulfillment: storageService.get(STORAGE_KEYS.FULFILLMENT, "pickup"),
  paymentMethod: "cash",
  tipRate: 0,
  promoCode: "",
  appliedCoupon: null,
  discountAmount: 0,
  submitting: false,
  idempotencyKey: `cg_chk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
};

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

function updateFulfillmentLayout() {
  const isDelivery = state.fulfillment === "delivery";
  const isAr = i18n.getLanguage() === "ar";

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
      ? isAr
        ? "قهوتك المختصة، حتى باب منزلك."
        : "Good coffee, to your door."
      : isAr
      ? "خطوة واحدة تفصلك عن قهوتك."
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
    detailsHeading.textContent = isDelivery
      ? isAr
        ? "٠٣  /  بيانات التواصل"
        : "03  /  Your details"
      : isAr
      ? "٠٢  /  بيانات التواصل"
      : "02  /  Your details";
  }

  if (paymentHeading) {
    paymentHeading.textContent = isDelivery
      ? isAr
        ? "٠٤  /  طريقة الدفع"
        : "04  /  Payment"
      : isAr
      ? "٠٣  /  طريقة الدفع"
      : "03  /  Payment";
  }

  if (timeLabel) {
    timeLabel.textContent = isDelivery
      ? isAr
        ? "وقت التوصيل المتوقع"
        : "Estimated delivery"
      : isAr
      ? "موعد الاستلام"
      : "Pickup time";
  }

  if (timeSelect) {
    timeSelect.options[0].textContent = isDelivery
      ? isAr
        ? "في أقرب وقت · يصل خلال ٢٥–٣٥ دقيقة"
        : "ASAP · Arrives in 25–35 minutes"
      : isAr
      ? "في أقرب وقت · جاهز خلال ١٠–١٥ دقيقة"
      : "ASAP · Ready in 10–15 minutes";
  }

  if (locationSubnote) {
    locationSubnote.textContent = isDelivery
      ? isAr
        ? "يُوصل من فرع شارع مابل بالزمالك · رسوم التوصيل ٢٥ ج.م."
        : "Delivered from Maple Street · 25 EGP delivery fee"
      : isAr
      ? "٤٢ شارع مابل، الزمالك، القاهرة · مفتوح حتى ٦:٠٠ مساءً"
      : "42 Maple Street, Zamalek, Cairo · Open until 6:00 pm";
  }

  if (deliverySubtext) {
    deliverySubtext.textContent = isDelivery
      ? isAr
        ? "متاح في نطاق ٥ كم من الفرع"
        : "Available within 5 km"
      : isAr
      ? "أدخل عنوانك للتوصيل السريع"
      : "Enter an address to check availability";
  }

  if (handoffCard) {
    handoffCard.hidden = !isDelivery;
  }

  document.querySelectorAll('input[name="fulfillment"]').forEach((radio) => {
    radio.checked = radio.value === state.fulfillment;
  });

  renderOrderReview();
}

function updatePaymentMethodLayout() {
  const isCard = state.paymentMethod === "card_on_pickup";
  const cardFields = document.getElementById("card-details-fields");
  if (cardFields) {
    cardFields.hidden = !isCard;
    cardFields.classList.toggle("is-hidden", !isCard);
    cardFields.querySelectorAll("input").forEach((input) => {
      input.required = isCard;
      if (!isCard) {
        input.setAttribute("aria-invalid", "false");
        input.classList.remove("user-invalid-fallback");
      }
    });
  }
}

function renderOrderReview() {
  const summary = cartService.getSummary({
    fulfillment: state.fulfillment,
    tipRate: state.tipRate,
  });

  let discount = 0;
  if (state.appliedCoupon && state.promoCode === state.appliedCoupon.code) {
    if (summary.subtotal >= (state.appliedCoupon.minOrderEgp || 0)) {
      discount =
        state.appliedCoupon.discountType === "percentage"
          ? Math.round(summary.subtotal * (state.appliedCoupon.discountValue / 100) * 100) / 100
          : Math.min(summary.subtotal, state.appliedCoupon.discountValue);
    }
  } else if (state.promoCode && PROMO_CODES[state.promoCode]) {
    const promo = PROMO_CODES[state.promoCode];
    if (summary.subtotal >= (promo.minOrder || 0)) {
      discount =
        promo.type === "percent"
          ? Math.round(summary.subtotal * promo.value)
          : Math.min(summary.subtotal, promo.value);
    }
  }
  state.discountAmount = discount;

  const finalTotal = Math.max(0, Number((summary.total - discount).toFixed(2)));

  const isAr = i18n.getLanguage() === "ar";
  const itemsContainer = document.getElementById("checkout-review-items");
  if (itemsContainer) {
    itemsContainer.replaceChildren();
    summary.items.forEach((item) => {
      const locProd = localizeProduct({ id: item.productId, name: item.name });
      const displayName = locProd?.name || item.name;
      const displayMeta = localizeCustomizationSummary(item.customizationSummary);

      const row = document.createElement("div");
      row.className = "review-item";

      const img = document.createElement("img");
      img.className = "review-item__img";
      img.src = item.image;
      img.alt = displayName;
      img.width = 72;
      img.height = 72;

      const body = document.createElement("div");
      body.className = "review-item__body";

      const name = document.createElement("p");
      name.className = "review-item__name";
      name.textContent = `${formatLocaleNumber(item.quantity)} × ${displayName}`;

      const meta = document.createElement("p");
      meta.className = "review-item__meta";
      meta.textContent = displayMeta;

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

  if (submitBtn && !state.submitting) {
    const actionVerb =
      state.fulfillment === "delivery"
        ? isAr
          ? "تأكيد طلب التوصيل"
          : "Place delivery order"
        : isAr
        ? "تأكيد طلب الاستلام"
        : "Place pickup order";
    submitBtn.textContent = `${actionVerb}  ·  ${formatPrice(finalTotal)}`;
    submitBtn.disabled = summary.totalCount === 0;
  }
}

function initCheckoutPage() {
  initHeader();

  i18n.subscribe(() => {
    updateFulfillmentLayout();
  });

  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get("mode");
  if (modeParam === "delivery" || modeParam === "pickup") {
    state.fulfillment = modeParam;
    storageService.set(STORAGE_KEYS.FULFILLMENT, modeParam);
  }

  const form = document.getElementById("checkout-form");
  setupValidationSync(form);
  updateFulfillmentLayout();
  updatePaymentMethodLayout();

  document.querySelectorAll('input[name="fulfillment"]').forEach((radio) => {
    radio.addEventListener("change", (event) => {
      state.fulfillment = event.target.value;
      storageService.set(STORAGE_KEYS.FULFILLMENT, state.fulfillment);
      updateFulfillmentLayout();
    });
  });

  document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
    radio.addEventListener("change", (event) => {
      state.paymentMethod = event.target.value;
      updatePaymentMethodLayout();
    });
  });

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
    promoApplyBtn.addEventListener("click", async () => {
      const code = promoInput.value.trim().toUpperCase();
      if (!code) return;
      const summary = cartService.getSummary({
        fulfillment: state.fulfillment,
        tipRate: state.tipRate,
      });
      try {
        const validated = await apiRequest("/api/coupons/validate", {
          method: "POST",
          body: { code, subtotalEgp: summary.subtotal },
        });
        state.promoCode = validated.code;
        state.appliedCoupon = validated;
        if (promoFeedback) {
          promoFeedback.textContent = `✓ Applied ${validated.code} (${validated.description})`;
        }
      } catch (err) {
        state.promoCode = "";
        state.appliedCoupon = null;
        if (promoFeedback) {
          promoFeedback.textContent =
            err.message ||
            "Try WELCOME10 (10% off), MORNING15 (15% off min 120 EGP), or COFFEEONUS (50 EGP off min 200 EGP).";
        }
      }
      renderOrderReview();
    });
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
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
      if (summary.totalCount === 0) return;

      const submitBtn = document.getElementById("checkout-submit-btn");
      const isAr = i18n.getLanguage() === "ar";
      state.submitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = isAr ? "جاري إرسال الطلب..." : "Submitting order...";
      }

      const fullName = document.getElementById("customer-name")?.value || "Alex Johnson";
      const phone = document.getElementById("customer-phone")?.value || "+20 100 555 0142";
      const email =
        document.getElementById("customer-email")?.value || "alex.johnson@example.com";
      const street = document.getElementById("shipping-address")?.value || "";
      const city = document.getElementById("shipping-city")?.value || "Cairo";
      const region = document.getElementById("shipping-state")?.value || "Zamalek";
      const zip = document.getElementById("shipping-zip")?.value || "11511";
      const cafeNote = storageService.get("common_ground_cafe_note_v1", "");

      try {
        const createdOrder = await orderService.submitOrderToBackend({
          fulfillment: state.fulfillment,
          customer: {
            fullName,
            phone,
            email,
          },
          deliveryAddress:
            state.fulfillment === "delivery"
              ? {
                  streetAddress: street,
                  city,
                  stateRegion: region,
                  postalCode: zip,
                }
              : null,
          payment: {
            method: state.paymentMethod,
          },
          couponCode: state.promoCode,
          tipRate: state.tipRate,
          specialInstructions: cafeNote,
          idempotencyKey: state.idempotencyKey,
          items: summary.items,
        });

        cartService.clear();
        storageService.remove("common_ground_cafe_note_v1");
        window.location.href = `tracking.html?ref=${encodeURIComponent(
          createdOrder.orderReference
        )}`;
      } catch (err) {
        state.submitting = false;
        renderOrderReview();
        showToast(`Order error: ${err.message}`, {
          actionLabel: "Review bag",
          actionHref: "menu.html#your-bag",
        });
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCheckoutPage);
} else {
  initCheckoutPage();
}
