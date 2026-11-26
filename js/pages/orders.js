/**
 * COMMON GROUND — Customer Account & Orders Controller ("06 · My orders")
 *
 * Displays the user's active order from `orderService.getActiveOrder()` and past order
 * history (`#1021`, `#0986`, `#0942`) with one-click "Reorder ↗" adding items to `cartService`.
 */

import { initHeader } from "../components/header.js";
import { showToast } from "../components/toast.js";
import { formatPrice } from "../config/constants.js";
import { i18n, localizeProduct, localizeStatus } from "../i18n/i18n.js";
import { cartService } from "../services/cartService.js";
import { orderService } from "../services/orderService.js";

function renderActiveOrderCard() {
  const order = orderService.getActiveOrder();
  if (!order) return;
  const isAr = i18n.getLanguage() === "ar";

  const numEl = document.getElementById("active-order-number");
  const itemsEl = document.getElementById("active-order-items");
  const metaEl = document.getElementById("active-order-meta");
  const statusEl = document.getElementById("active-order-status");
  const greetingEl = document.getElementById("account-greeting-title");

  if (greetingEl) {
    const firstName = order.customer?.firstName || "Alex";
    greetingEl.textContent = isAr
      ? `صباح الخير، ${firstName}.`
      : `Good morning, ${firstName}.`;
  }

  if (numEl) {
    numEl.textContent = isAr
      ? `طلب رقم #${order.orderNumber}`
      : `Order #${order.orderNumber}`;
  }

  if (itemsEl) {
    const names = (order.items || []).map(
      (i) => localizeProduct({ id: i.productId, name: i.name })?.name || i.name
    );
    itemsEl.textContent = names.length
      ? names.join(isAr ? "، " : ", ")
      : isAr
      ? "سبانيش لاتيه، كرواسون بالزبدة"
      : "Spanish latte, butter croissant";
  }

  if (metaEl) {
    const modeLabel =
      order.fulfillment === "delivery"
        ? isAr
          ? "توصيل"
          : "Delivery"
        : isAr
        ? "استلام من الفرع"
        : "Pickup";
    metaEl.textContent = `${
      isAr ? "اليوم · ١٠:١٤ ص" : order.createdAtLabel || "Today · 10:14 am"
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
    statusEl.textContent = localizeStatus(order.status);
  }
}

function renderPastOrdersTable() {
  const tbody = document.getElementById("past-orders-tbody");
  if (!tbody) return;
  const isAr = i18n.getLanguage() === "ar";

  const pastOrders = orderService.getPastOrders();
  tbody.replaceChildren();

  pastOrders.forEach((entry) => {
    const tr = document.createElement("tr");

    const tdOrder = document.createElement("td");
    tdOrder.className = "order-table__id ltr-inline";
    tdOrder.textContent = `#${entry.orderNumber}`;

    const tdDate = document.createElement("td");
    tdDate.className = "order-table__date";
    tdDate.textContent = entry.date;

    const tdItems = document.createElement("td");
    const localizedSummary = isAr
      ? (entry.reorderItems || [])
          .map(
            (r) =>
              `${localizeProduct({ id: r.productId, name: r.productId })?.name || r.productId}${
                r.quantity > 1 ? ` × ${r.quantity}` : ""
              }`
          )
          .join("، ")
      : entry.itemsSummary;
    tdItems.textContent = localizedSummary;

    const tdTotal = document.createElement("td");
    tdTotal.className = "order-table__total";
    tdTotal.textContent = formatPrice(entry.total);

    const tdAction = document.createElement("td");
    tdAction.className = "order-table__action";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reorder-btn";
    btn.dataset.reorderId = entry.orderNumber;
    btn.textContent = isAr ? "إعادة الطلب  ↖" : "Reorder  ↗";

    tdAction.appendChild(btn);

    tr.appendChild(tdOrder);
    tr.appendChild(tdDate);
    tr.appendChild(tdItems);
    tr.appendChild(tdTotal);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });

  if (!tbody.dataset.bound) {
    tbody.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-reorder-id]");
      if (!btn) return;
      const orderNum = btn.dataset.reorderId;
      const found = pastOrders.find((o) => o.orderNumber === orderNum);
      if (!found) return;

      (found.reorderItems || []).forEach(({ productId, quantity }) => {
        cartService.addItem(productId, quantity);
      });

      const ar = i18n.getLanguage() === "ar";
      showToast(
        ar
          ? `تمت إضافة طلب #${found.orderNumber} إلى سلة طلباتك`
          : `Added Order #${found.orderNumber} (${found.itemsSummary}) to your bag`,
        {
          actionLabel: ar ? "إتمام الطلب ←" : "Checkout →",
          actionHref: "checkout.html",
        }
      );
    });
    tbody.dataset.bound = "true";
  }
}

async function initOrdersPage() {
  initHeader();
  renderActiveOrderCard();
  renderPastOrdersTable();

  i18n.subscribe(() => {
    renderActiveOrderCard();
    renderPastOrdersTable();
  });
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
