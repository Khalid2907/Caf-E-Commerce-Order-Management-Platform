/**
 * COMMON GROUND — Customer Account & Orders Controller ("06 · My orders")
 *
 * Displays the user's active order from `orderService.getActiveOrder()` and past order
 * history (`#1021`, `#0986`, `#0942`) with one-click "Reorder ↗" adding items to `cartService`.
 */

import { initHeader } from "../components/header.js";
import { showToast } from "../components/toast.js";
import { formatPrice } from "../config/constants.js";
import { cartService } from "../services/cartService.js";
import { orderService } from "../services/orderService.js";

function renderActiveOrderCard() {
  const order = orderService.getActiveOrder();
  if (!order) return;

  const numEl = document.getElementById("active-order-number");
  const itemsEl = document.getElementById("active-order-items");
  const metaEl = document.getElementById("active-order-meta");
  const statusEl = document.getElementById("active-order-status");
  const greetingEl = document.getElementById("account-greeting-title");

  if (greetingEl) {
    greetingEl.textContent = `Good morning, ${order.customer?.firstName || "Alex"}.`;
  }

  if (numEl) {
    numEl.textContent = `Order #${order.orderNumber}`;
  }

  if (itemsEl) {
    const names = (order.items || []).map((i) => i.name.toLowerCase());
    itemsEl.textContent = names.length
      ? names[0].charAt(0).toUpperCase() + names.join(", ").slice(1)
      : "Iced oat latte, almond croissant";
  }

  if (metaEl) {
    const modeLabel = order.fulfillment === "delivery" ? "Delivery" : "Pickup";
    metaEl.textContent = `${
      order.createdAtLabel || "Today · 10:14 am"
    }   /   ${modeLabel} · ${formatPrice(order.total)}`;
  }

  if (statusEl) {
    const statusClassMap = {
      New: "status-badge--new",
      Preparing: "status-badge--preparing",
      Ready: "status-badge--ready",
      Completed: "status-badge--completed",
    };
    statusEl.className = `status-badge ${
      statusClassMap[order.status] || "status-badge--preparing"
    }`;
    statusEl.textContent = order.status;
  }
}

function renderPastOrdersTable() {
  const tbody = document.getElementById("past-orders-tbody");
  if (!tbody) return;

  const pastOrders = orderService.getPastOrders();
  tbody.replaceChildren();

  pastOrders.forEach((entry) => {
    const tr = document.createElement("tr");

    const tdOrder = document.createElement("td");
    tdOrder.className = "order-table__id";
    tdOrder.textContent = `#${entry.orderNumber}`;

    const tdDate = document.createElement("td");
    tdDate.className = "order-table__date";
    tdDate.textContent = entry.date;

    const tdItems = document.createElement("td");
    tdItems.textContent = entry.itemsSummary;

    const tdTotal = document.createElement("td");
    tdTotal.className = "order-table__total";
    tdTotal.textContent = formatPrice(entry.total);

    const tdAction = document.createElement("td");
    tdAction.className = "order-table__action";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reorder-btn";
    btn.dataset.reorderId = entry.orderNumber;
    btn.textContent = "Reorder  ↗";

    tdAction.appendChild(btn);

    tr.appendChild(tdOrder);
    tr.appendChild(tdDate);
    tr.appendChild(tdItems);
    tr.appendChild(tdTotal);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });

  tbody.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-reorder-id]");
    if (!btn) return;
    const orderNum = btn.dataset.reorderId;
    const found = pastOrders.find((o) => o.orderNumber === orderNum);
    if (!found) return;

    (found.reorderItems || []).forEach(({ productId, quantity }) => {
      cartService.addItem(productId, quantity);
    });

    showToast(`Added Order #${found.orderNumber} (${found.itemsSummary}) to your bag`, {
      actionLabel: "Checkout →",
      actionHref: "checkout.html",
    });
  });
}

async function initOrdersPage() {
  initHeader();
  renderActiveOrderCard();
  renderPastOrdersTable();
  try {
    const active = orderService.getActiveOrder();
    if (active && active.orderNumber) {
      await orderService.fetchOrderTracking(active.orderNumber);
      renderActiveOrderCard();
    }
  } catch {
    // Keep local active order snapshot
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initOrdersPage);
} else {
  initOrdersPage();
}
