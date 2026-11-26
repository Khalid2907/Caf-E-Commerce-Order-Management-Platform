/**
 * COMMON GROUND — Application Constants & Configuration
 * Target Market: Egypt · Default Currency: Egyptian Pound (EGP)
 */

export const STORAGE_KEYS = Object.freeze({
  CART: "common_ground_cart_egp_v2",
  ACTIVE_ORDER: "common_ground_active_order_egp_v2",
  FULFILLMENT: "common_ground_fulfillment_v2",
  AUTH_TOKEN: "common_ground_staff_token_v1",
  AUTH_USER: "common_ground_staff_user_v1",
});

export const APP_CONFIG = Object.freeze({
  BRAND_NAME: "Common Ground",
  DEFAULT_LOCATION: "42 Maple Street, Zamalek, Cairo",
  PICKUP_ESTIMATE: "10–15 min",
  DELIVERY_ESTIMATE: "25–35 min",
  DELIVERY_FEE: 25, // 25 EGP delivery fee
  TAX_RATE: 0.0,
  CURRENCY: "EGP",
});

import { formatLocalePrice } from "../i18n/i18n.js";

/**
 * Formats a numeric price in EGP ("95 EGP" in EN, "٩٥ ج.م." in AR) or USD ("$5.80").
 * @param {number} amount
 * @param {string} [currency=APP_CONFIG.CURRENCY]
 * @param {string} [lang]
 * @returns {string}
 */
export function formatPrice(amount, currency = APP_CONFIG.CURRENCY, lang = undefined) {
  return formatLocalePrice(amount, currency, lang);
}
