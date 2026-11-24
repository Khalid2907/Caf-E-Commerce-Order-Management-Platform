/**
 * COMMON GROUND — Shopping Bag / Cart Service
 *
 * Manages cart state, localStorage persistence, customization fingerprinting,
 * and reactive UI subscriptions (so header badges and bag summaries update live).
 *
 * Note: Per Figma "01 · Storefront", the design shows "Bag · 2" initially
 * (1 × Iced oat latte $5.80 + 1 × Almond croissant $4.80 = $10.60).
 * On first visit (when no cart key exists in localStorage), we seed those 2
 * default items so the Storefront, Menu bag summary, and Checkout match the
 * Figma reference out of the box, while still allowing full add/remove/clear.
 */

import { APP_CONFIG, STORAGE_KEYS } from "../config/constants.js";
import { productService } from "./productService.js";
import { storageService } from "./storageService.js";

const DEFAULT_FIGMA_BAG = [
  {
    cartItemId: "iced-oat-latte__12oz-iced-oat",
    productId: "iced-oat-latte",
    name: "Iced oat latte",
    unitPrice: 5.8,
    quantity: 1,
    image: "assets/images/product-iced-oat-latte.png",
    customizationSummary: "12 oz · Oat milk",
    customizations: {
      size: "12oz",
      temperature: "iced",
      milk: "oat",
      addons: [],
      specialInstructions: "",
    },
  },
  {
    cartItemId: "almond-croissant__default",
    productId: "almond-croissant",
    name: "Almond croissant",
    unitPrice: 4.8,
    quantity: 1,
    image: "assets/images/product-almond-croissant.png",
    customizationSummary: "Freshly baked",
    customizations: {
      note: "Freshly baked",
      specialInstructions: "",
    },
  },
];

const listeners = new Set();

function loadInitialItems() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("reset") === "1") {
    storageService.set(STORAGE_KEYS.CART, DEFAULT_FIGMA_BAG);
    return [...DEFAULT_FIGMA_BAG];
  }
  const saved = storageService.get(STORAGE_KEYS.CART, null);
  if (Array.isArray(saved)) {
    return saved;
  }
  storageService.set(STORAGE_KEYS.CART, DEFAULT_FIGMA_BAG);
  return [...DEFAULT_FIGMA_BAG];
}

let cartItems = loadInitialItems();

function notifyListeners() {
  storageService.set(STORAGE_KEYS.CART, cartItems);
  const snapshot = cartService.getSummary();
  listeners.forEach((callback) => {
    try {
      callback(snapshot);
    } catch (error) {
      console.error("[cartService] Subscriber error:", error);
    }
  });
}

/**
 * Generates a deterministic cart item key based on product ID and selected customizations.
 */
function buildCartItemId(productId, customizations = {}) {
  const size = customizations.size || "default";
  const temp = customizations.temperature || "default";
  const milk = customizations.milk || "default";
  const addons = Array.isArray(customizations.addons)
    ? [...customizations.addons].sort().join("+")
    : "";
  const note = (customizations.specialInstructions || "").trim().toLowerCase();
  return `${productId}__${size}-${temp}-${milk}-${addons}-${note}`;
}

/**
 * Builds a human-readable summary line matching Figma ("12 oz · Oat milk" or "Freshly baked").
 */
function buildCustomizationSummary(product, customizations = {}) {
  if (!product.customizable) {
    return customizations.note || product.defaultCustomizations?.note || "Freshly prepared";
  }

  const options = productService.getCustomizationOptions();
  const parts = [];

  if (customizations.size) {
    const sizeObj = options.sizes.find((s) => s.id === customizations.size);
    parts.push(sizeObj ? sizeObj.label : customizations.size);
  }

  if (customizations.milk) {
    const milkObj = options.milks.find((m) => m.id === customizations.milk);
    parts.push(milkObj ? milkObj.label : customizations.milk);
  }

  if (Array.isArray(customizations.addons) && customizations.addons.length > 0) {
    customizations.addons.forEach((addonId) => {
      const addonObj = options.addons.find((a) => a.id === addonId);
      if (addonObj) parts.push(addonObj.label);
    });
  }

  return parts.join(" · ") || "Standard recipe";
}

export const cartService = {
  /**
   * Returns a shallow copy of current cart items.
   */
  getItems() {
    return [...cartItems];
  },

  /**
   * Calculates item count, subtotal, tax, and total.
   */
  getSummary({ fulfillment = "pickup", tipRate = 0 } = {}) {
    const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = Number(
      cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2)
    );
    const tax = Number((subtotal * APP_CONFIG.TAX_RATE).toFixed(2));
    const tip = Number((subtotal * tipRate).toFixed(2));
    const deliveryFee =
      fulfillment === "delivery" && totalCount > 0 ? APP_CONFIG.DELIVERY_FEE : 0;
    const total = Number((subtotal + tax + tip + deliveryFee).toFixed(2));

    return {
      items: [...cartItems],
      totalCount,
      subtotal,
      tax,
      tip,
      deliveryFee,
      total,
    };
  },

  /**
   * Adds a product to the bag (or increments quantity if identical customization exists).
   * @param {string} productId
   * @param {number} [quantity=1]
   * @param {object} [customOverrides=null]
   * @param {number} [calculatedUnitPrice=null]
   */
  addItem(productId, quantity = 1, customOverrides = null, calculatedUnitPrice = null) {
    const product = productService.getProductById(productId);
    if (!product || !product.available) return null;

    const customizations = {
      ...(product.defaultCustomizations || {}),
      ...(customOverrides || {}),
    };

    const cartItemId = buildCartItemId(product.id, customizations);
    const unitPrice =
      typeof calculatedUnitPrice === "number" ? calculatedUnitPrice : product.price;

    const existingIndex = cartItems.findIndex((item) => item.cartItemId === cartItemId);

    if (existingIndex > -1) {
      cartItems[existingIndex] = {
        ...cartItems[existingIndex],
        quantity: cartItems[existingIndex].quantity + quantity,
      };
    } else {
      cartItems.push({
        cartItemId,
        productId: product.id,
        name: product.name,
        unitPrice,
        quantity,
        image: product.image,
        customizationSummary: buildCustomizationSummary(product, customizations),
        customizations,
      });
    }

    notifyListeners();
    return product;
  },

  /**
   * Updates quantity for a specific cart item; removes it if quantity <= 0.
   * @param {string} cartItemId
   * @param {number} nextQuantity
   */
  updateQuantity(cartItemId, nextQuantity) {
    if (nextQuantity <= 0) {
      return this.removeItem(cartItemId);
    }

    cartItems = cartItems.map((item) =>
      item.cartItemId === cartItemId ? { ...item, quantity: nextQuantity } : item
    );
    notifyListeners();
  },

  /**
   * Removes an item from the bag.
   * @param {string} cartItemId
   */
  removeItem(cartItemId) {
    cartItems = cartItems.filter((item) => item.cartItemId !== cartItemId);
    notifyListeners();
  },

  /**
   * Clears all items from the bag.
   */
  clear() {
    cartItems = [];
    notifyListeners();
  },

  /**
   * Subscribes a callback to cart state changes and immediately invokes it with current state.
   * @param {(summary: object) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  subscribe(callback) {
    listeners.add(callback);
    callback(this.getSummary());
    return () => listeners.delete(callback);
  },
};
