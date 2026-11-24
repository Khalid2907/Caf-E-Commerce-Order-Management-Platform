/**
 * COMMON GROUND — Shopping Bag / Cart Service (EGP Catalog)
 */

import { APP_CONFIG, STORAGE_KEYS } from "../config/constants.js";
import { productService } from "./productService.js";
import { storageService } from "./storageService.js";

const DEFAULT_FIGMA_BAG = [
  {
    cartItemId: "spanish-latte__12oz-hot-whole",
    productId: "spanish-latte",
    name: "Spanish Latte",
    unitPrice: 95,
    quantity: 1,
    image: "assets/images/product-iced-oat-latte.png",
    customizationSummary: "12 oz · Whole milk",
    customizations: {
      size: "12oz",
      temperature: "hot",
      milk: "whole",
      sugar: "regular-sugar",
      addons: [],
      specialInstructions: "",
    },
  },
  {
    cartItemId: "butter-croissant__default",
    productId: "butter-croissant",
    name: "Butter Croissant",
    unitPrice: 65,
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

function buildCartItemId(productId, customizations = {}) {
  const size = customizations.size || "default";
  const temp = customizations.temperature || "default";
  const milk = customizations.milk || "default";
  const sugar = customizations.sugar || "default";
  const addons = Array.isArray(customizations.addons)
    ? [...customizations.addons].sort().join("+")
    : "";
  const note = (customizations.specialInstructions || "").trim().toLowerCase();
  return `${productId}__${size}-${temp}-${milk}-${sugar}-${addons}-${note}`;
}

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

  if (customizations.temperature) {
    const tempObj = options.temperatures?.find((t) => t.id === customizations.temperature);
    if (tempObj) parts.push(tempObj.label);
  }

  if (customizations.milk) {
    const milkObj = options.milks.find((m) => m.id === customizations.milk);
    parts.push(milkObj ? milkObj.label : customizations.milk);
  }

  if (customizations.sugar && customizations.sugar !== "regular-sugar") {
    const sugarObj = options.sugars?.find((s) => s.id === customizations.sugar);
    if (sugarObj) parts.push(sugarObj.label);
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
  getItems() {
    return [...cartItems];
  },

  getSummary({ fulfillment = "pickup", tipRate = 0 } = {}) {
    const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = Number(
      cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2)
    );
    const tax = Number((subtotal * APP_CONFIG.TAX_RATE).toFixed(2));
    const tip = Number(Math.round(subtotal * tipRate).toFixed(2));
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

  updateQuantity(cartItemId, nextQuantity) {
    if (nextQuantity <= 0) {
      return this.removeItem(cartItemId);
    }

    cartItems = cartItems.map((item) =>
      item.cartItemId === cartItemId ? { ...item, quantity: nextQuantity } : item
    );
    notifyListeners();
  },

  removeItem(cartItemId) {
    cartItems = cartItems.filter((item) => item.cartItemId !== cartItemId);
    notifyListeners();
  },

  clear() {
    cartItems = [];
    notifyListeners();
  },

  subscribe(callback) {
    listeners.add(callback);
    callback(this.getSummary());
    return () => listeners.delete(callback);
  },
};
