/**
 * COMMON GROUND — Order Management & Simulation Service
 *
 * Manages active order creation, temporary frontend order numbers, live tracking step
 * simulation (Confirmed -> Preparing -> Ready for pickup -> Picked up), and order history
 * matching Figma Frames "05 · Order tracking" and "06 · My orders".
 */

import { STORAGE_KEYS } from "../config/constants.js";
import { storageService } from "./storageService.js";

const DEFAULT_ACTIVE_ORDER = {
  orderNumber: "1048",
  dateLabel: "TUESDAY, NOVEMBER 24",
  createdAtLabel: "Today · 10:14 am",
  status: "Preparing", // 'Confirmed' | 'Preparing' | 'Ready' | 'Completed'
  stepIndex: 1, // 0: Confirmed, 1: Preparing, 2: Ready for pickup, 3: Picked up
  estimatedWindow: "10:25–10:30 am",
  confirmedTime: "10:14 am",
  preparingTime: "Started at 10:16 am",
  fulfillment: "pickup",
  customer: {
    fullName: "Alex Johnson",
    firstName: "Alex",
    phone: "(503) 555-0142",
    email: "alex.johnson@example.com",
    address: "",
  },
  payment: {
    method: "Credit or debit card",
    brand: "Visa",
    last4: "4242",
  },
  items: [
    {
      productId: "iced-oat-latte",
      name: "Iced oat latte",
      quantity: 1,
      unitPrice: 5.8,
      customizationSummary: "12 oz · Oat milk",
    },
    {
      productId: "almond-croissant",
      name: "Almond croissant",
      quantity: 1,
      unitPrice: 4.8,
      customizationSummary: "Freshly baked",
    },
  ],
  subtotal: 10.6,
  tax: 0.0,
  tip: 0.0,
  deliveryFee: 0.0,
  discount: 0.0,
  total: 10.6,
};

const DEFAULT_PAST_ORDERS = [
  {
    orderNumber: "1021",
    date: "Nov 21, 2026",
    itemsSummary: "Flat white × 2",
    total: 9.0,
    reorderItems: [{ productId: "flat-white", quantity: 2 }],
  },
  {
    orderNumber: "0986",
    date: "Nov 18, 2026",
    itemsSummary: "Iced oat latte, croissant",
    total: 10.6,
    reorderItems: [
      { productId: "iced-oat-latte", quantity: 1 },
      { productId: "almond-croissant", quantity: 1 },
    ],
  },
  {
    orderNumber: "0942",
    date: "Nov 14, 2026",
    itemsSummary: "Batch brew × 2",
    total: 7.6,
    reorderItems: [{ productId: "batch-brew", quantity: 2 }],
  },
];

export const orderService = {
  /**
   * Retrieves the current active order (or seeds the default Figma #1048 order).
   */
  getActiveOrder() {
    const saved = storageService.get(STORAGE_KEYS.ACTIVE_ORDER, null);
    if (saved && saved.orderNumber) {
      return saved;
    }
    storageService.set(STORAGE_KEYS.ACTIVE_ORDER, DEFAULT_ACTIVE_ORDER);
    return { ...DEFAULT_ACTIVE_ORDER };
  },

  /**
   * Creates and persists a new temporary frontend order from Checkout submission.
   */
  createOrder({
    fulfillment,
    customer,
    payment,
    items,
    subtotal,
    tax,
    tip,
    deliveryFee,
    discount = 0,
    total,
  }) {
    const previous = this.getActiveOrder();
    const prevNum = parseInt(previous?.orderNumber, 10);
    const nextOrderNumber = Number.isFinite(prevNum) && prevNum >= 1048 ? String(prevNum + 1) : "1048";

    const firstName = (customer.fullName || "Alex").trim().split(/\s+/)[0] || "Alex";

    const newOrder = {
      orderNumber: nextOrderNumber,
      dateLabel: "TUESDAY, NOVEMBER 24",
      createdAtLabel: "Today · Just now",
      status: "Preparing",
      stepIndex: 1,
      estimatedWindow: fulfillment === "delivery" ? "10:40–10:50 am" : "10:25–10:30 am",
      confirmedTime: "10:14 am",
      preparingTime: "Started at 10:16 am",
      fulfillment,
      customer: {
        ...customer,
        firstName,
      },
      payment: {
        method: payment.method || "Credit or debit card",
        brand: "Visa",
        last4: (payment.cardNumber || "4242").replace(/\D/g, "").slice(-4) || "4242",
      },
      items: items.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        customizationSummary: item.customizationSummary,
      })),
      subtotal,
      tax,
      tip,
      deliveryFee,
      discount,
      total,
    };

    storageService.set(STORAGE_KEYS.ACTIVE_ORDER, newOrder);
    return newOrder;
  },

  /**
   * Updates the simulated step index (0..3) of the active order for interactive testing.
   * @param {number} stepIndex
   */
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

  /**
   * Returns past order history for "06 · My orders".
   */
  getPastOrders() {
    return DEFAULT_PAST_ORDERS;
  },
};
