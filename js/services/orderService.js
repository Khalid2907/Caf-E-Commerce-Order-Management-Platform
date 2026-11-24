/**
 * COMMON GROUND — Order Management Service (Backend REST API + Local Persistence)
 *
 * Submits orders to `POST /api/orders` and fetches real-time order tracking status
 * from `GET /api/orders/track/:reference`.
 */

import { STORAGE_KEYS } from "../config/constants.js";
import { apiRequest } from "./apiClient.js";
import { storageService } from "./storageService.js";

const DEFAULT_ACTIVE_ORDER = {
  orderNumber: "1048",
  orderReference: "1048",
  dateLabel: "TUESDAY, NOVEMBER 24",
  createdAtLabel: "Today · 10:14 am",
  status: "Preparing",
  stepIndex: 1,
  estimatedWindow: "10:25–10:30 am",
  confirmedTime: "10:14 am",
  preparingTime: "Started at 10:16 am",
  fulfillment: "pickup",
  customer: {
    fullName: "Alex Johnson",
    firstName: "Alex",
    phone: "+20 100 555 0142",
    email: "alex.johnson@example.com",
    address: "",
  },
  payment: {
    method: "Cash on pickup",
    brand: "Cash",
    last4: "",
    status: "Paid",
  },
  items: [
    {
      productId: "iced-spanish-latte",
      name: "Iced Spanish Latte",
      quantity: 1,
      unitPrice: 100,
      customizationSummary: "12 oz · Oat milk",
    },
    {
      productId: "butter-croissant",
      name: "Butter Croissant",
      quantity: 1,
      unitPrice: 65,
      customizationSummary: "Freshly baked",
    },
  ],
  subtotal: 165,
  tax: 0,
  tip: 0,
  deliveryFee: 0,
  discount: 0,
  total: 165,
};

const DEFAULT_PAST_ORDERS = [
  {
    orderNumber: "1021",
    date: "Nov 21, 2026",
    itemsSummary: "Flat White × 2",
    total: 180,
    reorderItems: [{ productId: "flat-white", quantity: 2 }],
  },
  {
    orderNumber: "0986",
    date: "Nov 18, 2026",
    itemsSummary: "Spanish Latte, Butter Croissant",
    total: 160,
    reorderItems: [
      { productId: "spanish-latte", quantity: 1 },
      { productId: "butter-croissant", quantity: 1 },
    ],
  },
  {
    orderNumber: "0942",
    date: "Nov 14, 2026",
    itemsSummary: "Americano × 2",
    total: 140,
    reorderItems: [{ productId: "americano", quantity: 2 }],
  },
];

function normalizeServerOrder(apiOrder) {
  const firstName =
    (apiOrder.customerName || "Alex").trim().split(/\s+/)[0] || "Alex";
  return {
    id: apiOrder.id,
    orderNumber: apiOrder.orderReference,
    orderReference: apiOrder.orderReference,
    dateLabel: "TUESDAY, NOVEMBER 24",
    createdAtLabel: `Today · ${apiOrder.ageLabel || "Just now"}`,
    status: apiOrder.uiStatus || apiOrder.status,
    rawStatus: apiOrder.status,
    stepIndex: apiOrder.stepIndex ?? 1,
    estimatedWindow: apiOrder.estimatedWindow || "10:25–10:30 am",
    fulfillment: apiOrder.fulfillmentType || "pickup",
    customer: {
      fullName: apiOrder.customerName,
      firstName,
      phone: apiOrder.customerPhone,
      email: apiOrder.customerEmail || "",
      address: apiOrder.deliveryAddress || "",
    },
    payment: {
      method: apiOrder.paymentMethod === "cash" ? "Cash" : "Card on pickup",
      brand: apiOrder.paymentMethod === "cash" ? "Cash" : "Visa",
      last4: apiOrder.paymentMethod === "cash" ? "" : "4242",
      status: apiOrder.paymentStatus || "Pending",
    },
    items: (apiOrder.items || []).map((it) => ({
      productId: it.productId,
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      customizationSummary: it.customizationSummary,
    })),
    subtotal: apiOrder.subtotalEgp,
    tax: apiOrder.taxEgp || 0,
    tip: apiOrder.tipEgp || 0,
    deliveryFee: apiOrder.deliveryFeeEgp || 0,
    discount: apiOrder.discountEgp || 0,
    total: apiOrder.totalEgp,
  };
}

export const orderService = {
  getActiveOrder() {
    const saved = storageService.get(STORAGE_KEYS.ACTIVE_ORDER, null);
    if (saved && saved.orderNumber) {
      return saved;
    }
    storageService.set(STORAGE_KEYS.ACTIVE_ORDER, DEFAULT_ACTIVE_ORDER);
    return { ...DEFAULT_ACTIVE_ORDER };
  },

  /**
   * Submits a new order to the PostgreSQL backend API (`POST /api/orders`).
   */
  async submitOrderToBackend({
    fulfillment,
    customer,
    deliveryAddress,
    payment,
    couponCode,
    tipRate,
    specialInstructions,
    items,
  }) {
    const payload = {
      customerName: customer.fullName,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      fulfillmentType: fulfillment,
      deliveryAddress,
      paymentMethod: payment.method || "cash",
      couponCode: couponCode || "",
      tipRate: tipRate || 0,
      specialInstructions: specialInstructions || "",
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        customizations: item.customizations || {},
        customizationSummary: item.customizationSummary || "",
        specialInstructions: item.customizations?.specialInstructions || "",
      })),
    };

    const apiOrder = await apiRequest("/api/orders", {
      method: "POST",
      body: payload,
    });

    const normalized = normalizeServerOrder(apiOrder);
    storageService.set(STORAGE_KEYS.ACTIVE_ORDER, normalized);
    return normalized;
  },

  /**
   * Fetches live tracking status for an order reference from `GET /api/orders/track/:reference`.
   */
  async fetchOrderTracking(reference) {
    const ref = String(reference || this.getActiveOrder().orderNumber)
      .replace(/^#/, "")
      .trim();
    const apiOrder = await apiRequest(`/api/orders/track/${encodeURIComponent(ref)}`);
    const normalized = normalizeServerOrder(apiOrder);
    storageService.set(STORAGE_KEYS.ACTIVE_ORDER, normalized);
    return normalized;
  },

  updateOrderStep(stepIndex) {
    const order = this.getActiveOrder();
    const clamped = Math.max(0, Math.min(3, stepIndex));
    const statusMap = ["New", "Preparing", "Ready", "Completed"];
    const updated = {
      ...order,
      stepIndex: clamped,
      status: statusMap[clamped],
    };
    storageService.set(STORAGE_KEYS.ACTIVE_ORDER, updated);
    return updated;
  },

  getPastOrders() {
    return DEFAULT_PAST_ORDERS;
  },
};
