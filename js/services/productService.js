/**
 * COMMON GROUND — Product Service (Full-Stack API + Local Cache)
 *
 * Hydrates products, categories, and customization options from the Express/PostgreSQL
 * backend (`/api/products`, `/api/categories`, `/api/customizations`) while keeping
 * an in-memory catalog cache for instant synchronous access.
 */

import { CATEGORIES, CUSTOMIZATION_OPTIONS, PRODUCTS } from "../data/products.js";
import { localizeProduct } from "../i18n/i18n.js";
import { apiRequest } from "./apiClient.js";

const SLUG_ALIASES = {
  "iced-oat-latte": "spanish-latte",
  "batch-brew": "americano",
  "almond-croissant": "butter-croissant",
};

let catalogCache = [...PRODUCTS];
let categoriesCache = [...CATEGORIES];
let synced = false;

export const productService = {
  /**
   * Synchronizes the product catalog from the PostgreSQL backend API.
   * @returns {Promise<Array<object>>}
   */
  async syncFromBackend() {
    try {
      const remoteProducts = await apiRequest("/api/products");
      if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
        catalogCache = remoteProducts.map((p) => ({
          ...p,
          defaultCustomizations: p.customizable
            ? {
                size: "12oz",
                temperature: p.categoryId === "iced-drinks" ? "iced" : "hot",
                milk: "whole",
                sugar: "regular-sugar",
                addons: [],
              }
            : { note: "Freshly prepared" },
        }));
        synced = true;
      }
    } catch (err) {
      console.warn("[productService] Using embedded EGP catalog fallback:", err.message);
    }
    return catalogCache;
  },

  isSynced() {
    return synced;
  },

  getCategories() {
    return categoriesCache;
  },

  getAllProducts() {
    return catalogCache;
  },

  getFeaturedProducts() {
    return catalogCache
      .filter((product) => Number.isInteger(product.featuredOrder) || product.isFeatured)
      .sort((a, b) => (a.featuredOrder || 99) - (b.featuredOrder || 99))
      .slice(0, 4);
  },

  getProductById(productId) {
    const normalized = SLUG_ALIASES[productId] || productId;
    return (
      catalogCache.find(
        (product) => product.id === normalized || product.slug === normalized
      ) || null
    );
  },

  async fetchProductDetail(productId) {
    const normalized = SLUG_ALIASES[productId] || productId;
    try {
      const detail = await apiRequest(`/api/products/${encodeURIComponent(normalized)}`);
      if (detail) {
        return {
          ...detail,
          defaultCustomizations: detail.customizable
            ? {
                size: "12oz",
                temperature: detail.categoryId === "iced-drinks" ? "iced" : "hot",
                milk: "whole",
                sugar: "regular-sugar",
                addons: [],
              }
            : { note: "Freshly prepared" },
        };
      }
    } catch {
      // Fallback to cache
    }
    return this.getProductById(normalized);
  },

  queryProducts({ categoryId = "all", query = "", sortBy = "featured" } = {}) {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = catalogCache.filter((product) => {
      const matchesCategory =
        categoryId === "all" ||
        (Array.isArray(product.categoryIds) && product.categoryIds.includes(categoryId)) ||
        product.categoryId === categoryId;

      const arProd = localizeProduct(product, "ar");
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.shortDescription.toLowerCase().includes(normalizedQuery) ||
        (product.menuDescription &&
          product.menuDescription.toLowerCase().includes(normalizedQuery)) ||
        (arProd && arProd.name.toLowerCase().includes(normalizedQuery)) ||
        (arProd && arProd.shortDescription.toLowerCase().includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });

    if (sortBy === "price-asc") {
      return [...filtered].sort((a, b) => a.price - b.price);
    }
    if (sortBy === "price-desc") {
      return [...filtered].sort((a, b) => b.price - a.price);
    }
    if (sortBy === "name-asc") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  },

  getCustomizationOptions() {
    return CUSTOMIZATION_OPTIONS;
  },

  calculateUnitPrice(productId, customizations = {}) {
    const product = this.getProductById(productId);
    if (!product) return 0;
    let total = Number(product.price) || 0;
    const opts = CUSTOMIZATION_OPTIONS;

    if (customizations.size) {
      const sizeOpt = (opts.sizes || []).find((s) => s.id === customizations.size);
      if (sizeOpt) total += Number(sizeOpt.priceDelta) || 0;
    }
    if (customizations.milk) {
      const milkOpt = (opts.milks || []).find((m) => m.id === customizations.milk);
      if (milkOpt) total += Number(milkOpt.priceDelta) || 0;
    }
    if (Array.isArray(customizations.addons)) {
      customizations.addons.forEach((addonId) => {
        const addonOpt = (opts.addons || []).find((a) => a.id === addonId);
        if (addonOpt) total += Number(addonOpt.priceDelta) || 0;
      });
    }
    return total;
  },
};
