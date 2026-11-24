/**
 * COMMON GROUND — Application Constants & Configuration
 * Centralizes storage keys, routes, and formatting utilities for future API readiness.
 */

export const STORAGE_KEYS = Object.freeze({
  CART: "common_ground_cart_v1",
  ACTIVE_ORDER: "common_ground_active_order_v1",
  FULFILLMENT: "common_ground_fulfillment_v1",
});

export const APP_CONFIG = Object.freeze({
  BRAND_NAME: "Common Ground",
  DEFAULT_LOCATION: "42 Maple Street, Portland, OR",
  PICKUP_ESTIMATE: "10–15 min",
  DELIVERY_ESTIMATE: "25–35 min",
  DELIVERY_FEE: 2.5,
  TAX_RATE: 0.0, // Oregon 0% sales tax as shown in Figma 04 · Checkout
});

/**
 * Formats a numeric price to match Figma's USD display ($5.80) or EGP display.
 * @param {number} amount - Numeric price value
 * @param {string} [currency='USD'] - 'USD' ($5.80) or 'EGP' (95 EGP)
 * @returns {string}
 */
export function formatPrice(amount, currency = "USD") {
  const numeric = Number(amount) || 0;
  if (currency === "EGP") {
    return `${Math.round(numeric)} EGP`;
  }
  return `$${numeric.toFixed(2)}`;
}
