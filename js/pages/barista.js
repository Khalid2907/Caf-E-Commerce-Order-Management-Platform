/**
 * COMMON GROUND — Barista Live Orders Workspace Controller ("07 · Barista live orders" & "22 · Mobile operations")
 *
 * Implements:
 * - Staff authentication via `POST /api/auth/login` & `GET /api/auth/me`.
 * - Live order retrieval from `GET /api/admin/orders` and metrics from `GET /api/admin/overview`.
 * - Validated status transitions via `PATCH /api/admin/orders/:id/status` (Accept, Start preparing,
 *   Mark ready for pickup, Mark as picked up, Reject).
 * - Store pause/resume toggle via `PATCH /api/admin/settings`.
 * - Real-time Socket.IO event listeners (`order:created`, `order:updated`, `settings:updated`).
 */

import { showToast } from "../components/toast.js";
import { STORAGE_KEYS, formatPrice } from "../config/constants.js";
import {
  formatLocaleNumber,
  i18n,
  localizeCustomizationSummary,
  localizeProduct,
  localizeStatus,
  translatePageDOM,
} from "../i18n/i18n.js";
import { apiRequest } from "../services/apiClient.js";
import { storageService } from "../services/storageService.js";

const state = {
  user: storageService.get(STORAGE_KEYS.AUTH_USER, null),
  activeTab: "live", // 'live' | 'completed'
  orders: [],
  overview: null,
  soundEnabled: true,
  isAcceptingOrders: true,
};

function playAlertTone() {
  if (!state.soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch {
    // Audio play blocked until user gesture
  }
}

/**
 * Creates a DOM element for a single Barista Order Ticket matching Figma node 6:686.
 */
function createTicketCard(order) {
  const isAr = i18n.getLanguage() === "ar";
  const article = document.createElement("article");
  const isUrgent = Boolean(order.allergyFlag || (order.minutesAgo >= 8 && order.status !== "Completed"));
  article.className = `ticket-card${isUrgent ? " ticket-card--urgent" : ""}`;
  article.dataset.orderId = order.orderReference;

  if (isUrgent && order.status !== "Ready" && order.status !== "Completed") {
    const alertBar = document.createElement("div");
    alertBar.className = "ticket-card__alert-bar";
    alertBar.textContent = isAr
      ? `يحتاج انتباهاً عاجلاً · ${formatLocaleNumber(order.minutesAgo || 8)} د`
      : `NEEDS ATTENTION · ${order.minutesAgo || 8} min`;
    article.appendChild(alertBar);
  }

  const body = document.createElement("div");
  body.className = "ticket-card__body";

  // Top row: #1050 + 1 min ago
  const top = document.createElement("div");
  top.className = "ticket-card__top";

  const ref = document.createElement("h3");
  ref.className = "ticket-card__ref ltr-inline";
  ref.textContent = `#${order.orderReference}`;

  const age = document.createElement("span");
  age.className = "ticket-card__age";
  age.textContent = isAr
    ? order.minutesAgo <= 0
      ? "الآن"
      : `منذ ${formatLocaleNumber(order.minutesAgo)} د`
    : order.ageLabel || "Just now";

  top.appendChild(ref);
  top.appendChild(age);
  body.appendChild(top);

  // Customer & Fulfillment + Total
  const customerRow = document.createElement("div");
  customerRow.className = "ticket-card__customer";

  const custText = document.createElement("span");
  const modeLabel =
    order.fulfillmentType === "delivery"
      ? isAr
        ? "توصيل"
        : "Delivery"
      : isAr
      ? "استلام"
      : "Pickup";
  custText.textContent = `${order.customerName}  ·  ${modeLabel}`;

  const totalText = document.createElement("span");
  totalText.className = "ticket-card__total";
  totalText.textContent = formatPrice(order.totalEgp);

  customerRow.appendChild(custText);
  customerRow.appendChild(totalText);
  body.appendChild(customerRow);

  // Items list
  const itemsList = document.createElement("div");
  itemsList.className = "ticket-items";

  (order.items || []).forEach((it) => {
    const locProd = localizeProduct({ id: it.productId, name: it.name });
    const displayName = locProd?.name || it.name;
    const displayMeta = localizeCustomizationSummary(it.customizationSummary);

    const itemDiv = document.createElement("div");
    itemDiv.className = "ticket-item";

    const itemName = document.createElement("p");
    itemName.className = "ticket-item__name";
    itemName.textContent = `${formatLocaleNumber(it.quantity)} × ${displayName}`;
    itemDiv.appendChild(itemName);

    if (displayMeta && displayMeta !== "Freshly baked") {
      const itemMeta = document.createElement("p");
      itemMeta.className = "ticket-item__meta";
      itemMeta.textContent = displayMeta;
      itemDiv.appendChild(itemMeta);
    }

    itemsList.appendChild(itemDiv);
  });

  body.appendChild(itemsList);

  // Special Instructions / Allergy Banner
  if (order.specialInstructions) {
    const note = document.createElement("div");
    note.className = `ticket-note ${
      order.allergyFlag ? "ticket-note--allergy" : "ticket-note--standard"
    }`;
    note.textContent = order.specialInstructions;
    body.appendChild(note);
  }

  // Action Buttons by Status
  const actions = document.createElement("div");
  actions.className = "ticket-actions";

  if (order.status === "Pending") {
    const acceptPrepBtn = document.createElement("button");
    acceptPrepBtn.type = "button";
    acceptPrepBtn.className = "btn btn--primary ticket-actions__btn";
    acceptPrepBtn.dataset.orderAction = "Preparing";
    acceptPrepBtn.dataset.orderRef = order.orderReference;
    acceptPrepBtn.textContent = isAr ? "قبول وبدء التحضير" : "Accept & start preparing";
    actions.appendChild(acceptPrepBtn);

    const secondaryRow = document.createElement("div");
    secondaryRow.className = "ticket-actions__row";

    const acceptOnlyBtn = document.createElement("button");
    acceptOnlyBtn.type = "button";
    acceptOnlyBtn.className = "btn btn--secondary ticket-actions__btn";
    acceptOnlyBtn.dataset.orderAction = "Accepted";
    acceptOnlyBtn.dataset.orderRef = order.orderReference;
    acceptOnlyBtn.textContent = isAr ? "قبول" : "Accept";

    const rejectBtn = document.createElement("button");
    rejectBtn.type = "button";
    rejectBtn.className = "ticket-actions__reject";
    rejectBtn.dataset.orderAction = "Rejected";
    rejectBtn.dataset.orderRef = order.orderReference;
    rejectBtn.textContent = isAr ? "رفض" : "Reject";

    secondaryRow.appendChild(acceptOnlyBtn);
    secondaryRow.appendChild(rejectBtn);
    actions.appendChild(secondaryRow);
  } else if (order.status === "Accepted") {
    const startPrepBtn = document.createElement("button");
    startPrepBtn.type = "button";
    startPrepBtn.className = "btn btn--primary ticket-actions__btn";
    startPrepBtn.dataset.orderAction = "Preparing";
    startPrepBtn.dataset.orderRef = order.orderReference;
    startPrepBtn.textContent = isAr ? "بدء التحضير" : "Start preparing";
    actions.appendChild(startPrepBtn);
  } else if (order.status === "Preparing") {
    const readyBtn = document.createElement("button");
    readyBtn.type = "button";
    readyBtn.className = "btn btn--primary ticket-actions__btn";
    readyBtn.dataset.orderAction = "Ready";
    readyBtn.dataset.orderRef = order.orderReference;
    readyBtn.textContent = isAr ? "تحديد كجاهز للاستلام" : "Mark ready for pickup";
    actions.appendChild(readyBtn);
  } else if (order.status === "Ready") {
    const completeBtn = document.createElement("button");
    completeBtn.type = "button";
    completeBtn.className = "btn btn--secondary ticket-actions__btn";
    completeBtn.dataset.orderAction = "Completed";
    completeBtn.dataset.orderRef = order.orderReference;
    completeBtn.textContent = isAr ? "تأكيد التسليم للعميل" : "Mark as picked up";
    actions.appendChild(completeBtn);
  } else {
    const badge = document.createElement("span");
    badge.className = `status-badge status-badge--${order.status.toLowerCase()}`;
    badge.textContent = localizeStatus(order.status);
    actions.appendChild(badge);
  }

  body.appendChild(actions);
  article.appendChild(body);

  return article;
}

function renderBaristaWorkspace() {
  const newCol = document.getElementById("kanban-new-list");
  const prepCol = document.getElementById("kanban-preparing-list");
  const readyCol = document.getElementById("kanban-ready-list");

  const newBadge = document.getElementById("kanban-new-count");
  const prepBadge = document.getElementById("kanban-preparing-count");
  const readyBadge = document.getElementById("kanban-ready-count");
  const tabLiveCount = document.getElementById("barista-tab-live");

  const newOrders = state.orders.filter((o) => o.status === "Pending");
  const prepOrders = state.orders.filter(
    (o) => o.status === "Accepted" || o.status === "Preparing"
  );
  const readyOrders = state.orders.filter((o) => o.status === "Ready");
  const completedOrders = state.orders.filter(
    (o) => o.status === "Completed" || o.status === "Cancelled" || o.status === "Rejected"
  );

  const activeTotal = newOrders.length + prepOrders.length + readyOrders.length;
  const isAr = i18n.getLanguage() === "ar";

  if (tabLiveCount) {
    tabLiveCount.textContent = isAr
      ? `الطلبات المباشرة · ${formatLocaleNumber(activeTotal)}`
      : `Live orders · ${activeTotal}`;
  }

  // Update Metrics
  const metricActive = document.getElementById("metric-active-orders");
  const metricPickedUp = document.getElementById("metric-picked-up");
  if (metricActive) metricActive.textContent = formatLocaleNumber(activeTotal);
  if (metricPickedUp && state.overview) {
    metricPickedUp.textContent = formatLocaleNumber(36 + completedOrders.length);
  }

  if (state.activeTab === "completed") {
    if (newBadge) newBadge.textContent = formatLocaleNumber(completedOrders.length);
    if (prepBadge) prepBadge.textContent = formatLocaleNumber(0);
    if (readyBadge) readyBadge.textContent = formatLocaleNumber(0);

    if (newCol) {
      newCol.replaceChildren();
      completedOrders.forEach((o) => newCol.appendChild(createTicketCard(o)));
    }
    if (prepCol) prepCol.replaceChildren();
    if (readyCol) readyCol.replaceChildren();
    return;
  }

  if (newBadge) newBadge.textContent = formatLocaleNumber(newOrders.length);
  if (prepBadge) prepBadge.textContent = formatLocaleNumber(prepOrders.length);
  if (readyBadge) readyBadge.textContent = formatLocaleNumber(readyOrders.length);

  if (newCol) {
    newCol.replaceChildren();
    newOrders.forEach((o) => newCol.appendChild(createTicketCard(o)));
  }
  if (prepCol) {
    prepCol.replaceChildren();
    prepOrders.forEach((o) => prepCol.appendChild(createTicketCard(o)));
  }
  if (readyCol) {
    readyCol.replaceChildren();
    readyOrders.forEach((o) => readyCol.appendChild(createTicketCard(o)));
  }

  // Update Store Accepting Orders status UI
  const pauseBtn = document.getElementById("barista-pause-btn");
  const footerStatus = document.getElementById("barista-store-status-label");
  if (pauseBtn) {
    pauseBtn.textContent = state.isAcceptingOrders
      ? isAr
        ? "إيقاف الطلبات مؤقتاً"
        : "Pause online orders"
      : isAr
      ? "استئناف استقبال الطلبات"
      : "Resume online orders";
    pauseBtn.classList.toggle("is-paused", !state.isAcceptingOrders);
  }
  if (footerStatus) {
    footerStatus.textContent = state.isAcceptingOrders
      ? isAr
        ? "●  الفرع يستقبل الطلبات أونلاين"
        : "●  Store is accepting orders"
      : isAr
      ? "●  الطلبات أونلاين متوقفة مؤقتاً"
      : "●  Online orders are currently paused";
  }
}

async function fetchBaristaData() {
  const storedToken = storageService.get(STORAGE_KEYS.AUTH_TOKEN);
  const storedUser = storageService.get(STORAGE_KEYS.AUTH_USER);
  if (!storedToken || !storedUser) {
    const authOverlay = document.getElementById("barista-auth-overlay");
    if (authOverlay) authOverlay.hidden = false;
    return;
  }

  try {
    const [orders, overview] = await Promise.all([
      apiRequest("/api/admin/orders"),
      apiRequest("/api/admin/overview"),
    ]);
    state.orders = orders || [];
    state.overview = overview || null;
    if (overview && overview.isAcceptingOrders !== undefined) {
      state.isAcceptingOrders = overview.isAcceptingOrders;
    }
    renderBaristaWorkspace();
    const authOverlay = document.getElementById("barista-auth-overlay");
    if (authOverlay) authOverlay.hidden = true;
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      const authOverlay = document.getElementById("barista-auth-overlay");
      if (authOverlay) authOverlay.hidden = false;
    }
  }
}

async function handleStatusTransition(orderRef, nextStatus) {
  try {
    await apiRequest(`/api/admin/orders/${encodeURIComponent(orderRef)}/status`, {
      method: "PATCH",
      body: {
        status: nextStatus,
        rejectionReason:
          nextStatus === "Rejected" ? "Station at capacity / item unavailable" : "",
      },
    });
    showToast(`Order #${orderRef} moved to ${nextStatus}`);
    await fetchBaristaData();
  } catch (err) {
    showToast(`Transition error: ${err.message}`);
  }
}

function connectRealtimeSocket() {
  if (typeof window.io !== "function") return;
  const socket = window.io();

  socket.on("order:created", (newOrder) => {
    playAlertTone();
    showToast(`New Order #${newOrder.orderReference} from ${newOrder.customerName}!`);
    fetchBaristaData();
  });

  socket.on("order:updated", () => {
    fetchBaristaData();
  });

  socket.on("settings:updated", () => {
    fetchBaristaData();
  });
}

function initBaristaPage() {
  i18n.init();
  i18n.subscribe(() => {
    renderBaristaWorkspace();
    translatePageDOM();
  });

  // Bind Staff Login Modal
  const loginForm = document.getElementById("barista-login-form");
  const emailInput = document.getElementById("barista-login-email");
  const passInput = document.getElementById("barista-login-password");
  const errorMsg = document.getElementById("barista-login-error");

  document.querySelectorAll("[data-quick-fill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.quickFill === "barista") {
        emailInput.value = "jamie@commonground.coffee";
        passInput.value = "CommonGroundBarista2026!";
      } else {
        emailInput.value = "sam.rivera@commonground.coffee";
        passInput.value = "CommonGroundAdmin2026!";
      }
    });
  });

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (errorMsg) errorMsg.textContent = "";
      try {
        const result = await apiRequest("/api/auth/login", {
          method: "POST",
          body: {
            email: emailInput.value,
            password: passInput.value,
          },
        });
        storageService.set(STORAGE_KEYS.AUTH_TOKEN, result.token);
        storageService.set(STORAGE_KEYS.AUTH_USER, result.user);
        state.user = result.user;

        const userLabel = document.getElementById("barista-user-label");
        if (userLabel) {
          userLabel.textContent = `${result.user.fullName} · ${
            result.user.role === "admin" ? "Manager" : "Barista"
          }`;
        }

        await fetchBaristaData();
      } catch (err) {
        if (errorMsg) errorMsg.textContent = err.message;
      }
    });
  }

  // Kanban delegated action buttons
  const kanbanBoard = document.getElementById("barista-kanban-board");
  if (kanbanBoard) {
    kanbanBoard.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-order-action]");
      if (!btn) return;
      const { orderRef, orderAction } = btn.dataset;
      handleStatusTransition(orderRef, orderAction);
    });
  }

  // Live vs Completed tabs
  const tabLive = document.getElementById("barista-tab-live");
  const tabCompleted = document.getElementById("barista-tab-completed");
  if (tabLive && tabCompleted) {
    tabLive.addEventListener("click", () => {
      state.activeTab = "live";
      tabLive.classList.add("is-active");
      tabCompleted.classList.remove("is-active");
      renderBaristaWorkspace();
    });
    tabCompleted.addEventListener("click", () => {
      state.activeTab = "completed";
      tabCompleted.classList.add("is-active");
      tabLive.classList.remove("is-active");
      renderBaristaWorkspace();
    });
  }

  // Sound toggle
  const soundBtn = document.getElementById("barista-sound-btn");
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      soundBtn.textContent = state.soundEnabled ? "Sound on" : "Sound muted";
    });
  }

  // Pause online orders toggle
  const pauseBtn = document.getElementById("barista-pause-btn");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", async () => {
      try {
        const res = await apiRequest("/api/admin/settings", {
          method: "PATCH",
          body: { isAcceptingOrders: !state.isAcceptingOrders },
        });
        state.isAcceptingOrders = res.isAcceptingOrders ?? res.is_accepting_orders;
        renderBaristaWorkspace();
        showToast(
          state.isAcceptingOrders
            ? "Online ordering resumed across storefront"
            : "Online ordering paused"
        );
      } catch (err) {
        showToast(`Could not toggle store status: ${err.message}`);
      }
    });
  }

  // Sign out button
  const logoutBtn = document.getElementById("barista-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await apiRequest("/api/auth/logout", { method: "POST" }).catch(() => {});
      storageService.remove(STORAGE_KEYS.AUTH_TOKEN);
      storageService.remove(STORAGE_KEYS.AUTH_USER);
      const authOverlay = document.getElementById("barista-auth-overlay");
      if (authOverlay) authOverlay.hidden = false;
    });
  }

  fetchBaristaData();
  connectRealtimeSocket();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBaristaPage);
} else {
  initBaristaPage();
}
