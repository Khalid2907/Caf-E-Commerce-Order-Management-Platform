/**
 * COMMON GROUND — Order Confirmation & Live Tracking Controller ("05 · Order tracking" & "15 · Mobile tracking")
 *
 * Retrieves live order status from `GET /api/orders/track/:reference` and polls/listens
 * for real-time barista updates.
 */

import { initHeader } from "../components/header.js";
import { showToast } from "../components/toast.js";
import { formatPrice } from "../config/constants.js";
import { orderService } from "../services/orderService.js";

function renderTrackingOrder(order) {
  if (!order) return;

  const eyebrowEl = document.getElementById("tracking-order-eyebrow");
  const subtitleEl = document.getElementById("tracking-order-subtitle");
  const statusBadgeEl = document.getElementById("tracking-status-badge");
  const etaLabelEl = document.getElementById("tracking-eta-label");
  const etaWindowEl = document.getElementById("tracking-eta-window");
  const trackFillEl = document.getElementById("stepper-track-fill");
  const smsBodyEl = document.getElementById("tracking-sms-body");
  const pickupEyebrowEl = document.getElementById("pickup-card-eyebrow");
  const pickupTitleEl = document.getElementById("pickup-card-title");
  const pickupAddressEl = document.getElementById("pickup-card-address");
  const receiptItemsEl = document.getElementById("receipt-items-list");
  const paidMethodEl = document.getElementById("receipt-paid-method");
  const paidTotalEl = document.getElementById("receipt-paid-total");

  if (eyebrowEl) {
    eyebrowEl.textContent = `ORDER #${order.orderNumber}   /   ${
      order.dateLabel || "TUESDAY, NOVEMBER 24"
    }`;
  }

  if (subtitleEl) {
    if (order.rawStatus === "Cancelled" || order.rawStatus === "Rejected") {
      subtitleEl.textContent = `Order #${order.orderNumber} was ${order.rawStatus.toLowerCase()}. Please contact the café if you need assistance.`;
    } else {
      subtitleEl.textContent = `Thanks, ${
        order.customer?.firstName || "Alex"
      }. We’ll let you know the moment it’s ready.`;
    }
  }

  if (statusBadgeEl) {
    const statusClassMap = {
      New: "status-badge--new",
      Pending: "status-badge--new",
      Accepted: "status-badge--preparing",
      Preparing: "status-badge--preparing",
      Ready: "status-badge--ready",
      Completed: "status-badge--completed",
      Cancelled: "status-badge--cancelled",
      Rejected: "status-badge--cancelled",
    };
    statusBadgeEl.className = `status-badge ${
      statusClassMap[order.status] || "status-badge--preparing"
    }`;
    statusBadgeEl.textContent = order.status;
  }

  if (etaLabelEl) {
    etaLabelEl.textContent =
      order.fulfillment === "delivery" ? "Estimated delivery" : "Estimated pickup";
  }

  if (etaWindowEl) {
    etaWindowEl.textContent = order.estimatedWindow || "10:25–10:30 am";
  }

  const stepIndex = Number.isInteger(order.stepIndex) ? order.stepIndex : 1;
  if (trackFillEl) {
    const pct = Math.round((stepIndex / 3) * 100);
    trackFillEl.style.inlineSize = `${pct}%`;
  }

  document.querySelectorAll("[data-step-index]").forEach((node) => {
    const idx = parseInt(node.dataset.stepIndex, 10);
    const circle = node.querySelector(".stepper-node__circle");
    node.classList.toggle("is-completed", idx < stepIndex);
    node.classList.toggle("is-active", idx === stepIndex);

    if (circle) {
      circle.textContent = idx < stepIndex || idx === 0 ? "✓" : String(idx + 1);
    }
  });

  if (smsBodyEl) {
    smsBodyEl.textContent = `We’ll text ${
      order.customer?.phone || "+20 100 555 0142"
    } when your order is ready. No refreshing needed.`;
  }

  if (order.fulfillment === "delivery") {
    if (pickupEyebrowEl) pickupEyebrowEl.textContent = "DELIVERY FROM MAPLE STREET";
    if (pickupTitleEl) pickupTitleEl.textContent = "On its way soon.";
    if (pickupAddressEl) {
      pickupAddressEl.textContent =
        order.customer?.address || "128 Oak Avenue, Apt 4B, Zamalek, Cairo";
    }
  }

  if (receiptItemsEl) {
    receiptItemsEl.replaceChildren();
    (order.items || []).forEach((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "receipt-item";

      const row = document.createElement("div");
      row.className = "receipt-item__row";

      const name = document.createElement("span");
      name.textContent = `${item.quantity} × ${item.name}`;

      const price = document.createElement("span");
      price.textContent = formatPrice(item.unitPrice * item.quantity);

      row.appendChild(name);
      row.appendChild(price);
      wrapper.appendChild(row);

      if (item.customizationSummary && item.customizationSummary !== "Freshly baked") {
        const meta = document.createElement("p");
        meta.className = "receipt-item__meta";
        meta.textContent = item.customizationSummary;
        wrapper.appendChild(meta);
      }

      receiptItemsEl.appendChild(wrapper);
    });
  }

  if (paidMethodEl) {
    const payStatus = order.payment?.status || "Paid";
    const methodLabel = order.payment?.method || "Cash";
    paidMethodEl.textContent = `${payStatus} · ${methodLabel}${
      order.payment?.last4 ? ` ending ${order.payment.last4}` : ""
    }`;
  }

  if (paidTotalEl) {
    paidTotalEl.textContent = formatPrice(order.total);
  }
}

async function initTrackingPage() {
  initHeader();

  const params = new URLSearchParams(window.location.search);
  const requestedRef = params.get("ref");

  let currentOrder = orderService.getActiveOrder();
  renderTrackingOrder(currentOrder);

  // Fetch authoritative order state from PostgreSQL backend
  try {
    currentOrder = await orderService.fetchOrderTracking(
      requestedRef || currentOrder.orderNumber
    );
    renderTrackingOrder(currentOrder);
  } catch (err) {
    if (requestedRef) {
      showToast(`Order #${requestedRef} not found. Showing latest active order.`);
    }
  }

  // Periodic polling fallback for live status updates
  window.setInterval(async () => {
    try {
      const refreshed = await orderService.fetchOrderTracking(currentOrder.orderNumber);
      if (refreshed && refreshed.status !== currentOrder.status) {
        currentOrder = refreshed;
        renderTrackingOrder(currentOrder);
        showToast(
          `Order #${currentOrder.orderNumber} status updated to: ${currentOrder.status}`
        );
      }
    } catch {
      // Keep current display
    }
  }, 6000);

  const stepper = document.getElementById("tracking-stepper");
  if (stepper) {
    stepper.addEventListener("click", (event) => {
      const node = event.target.closest("[data-step-index]");
      if (!node) return;
      const nextStep = parseInt(node.dataset.stepIndex, 10);
      currentOrder = orderService.updateOrderStep(nextStep);
      renderTrackingOrder(currentOrder);
    });
  }

  const simBtn = document.getElementById("simulate-next-step-btn");
  if (simBtn) {
    simBtn.addEventListener("click", () => {
      const nextStep = (currentOrder.stepIndex + 1) % 4;
      currentOrder = orderService.updateOrderStep(nextStep);
      renderTrackingOrder(currentOrder);
      showToast(`Order #${currentOrder.orderNumber} status updated to: ${currentOrder.status}`, {
        actionLabel: "My orders",
        actionHref: "orders.html",
      });
    });
  }

  const viewReceiptBtn = document.getElementById("view-receipt-btn");
  if (viewReceiptBtn) {
    viewReceiptBtn.addEventListener("click", () => {
      showToast(
        `Receipt for Order #${currentOrder.orderNumber} (${formatPrice(
          currentOrder.total
        )}) sent to ${currentOrder.customer?.email || "alex.johnson@example.com"}`,
        { actionLabel: "My orders", actionHref: "orders.html" }
      );
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTrackingPage);
} else {
  initTrackingPage();
}
