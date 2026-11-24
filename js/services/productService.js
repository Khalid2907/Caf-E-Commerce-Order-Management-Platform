/**
 * COMMON GROUND — Product Service
 *
 * Provides clean data-access methods over the single-source product catalog.
 * Designed so methods can later be switched to async `fetch('/api/products')`
 * calls without changing UI component rendering logic.
 */

import { CATEGORIES, CUSTOMIZATION_OPTIONS, PRODUCTS } from "../data/products.js";

export const productService = {
  /**
   * Returns all menu categories.
   */
  getCategories() {
    return CATEGORIES;
  },

  /**
   * Returns all products in the catalog.
   */
  getAllProducts() {
    return PRODUCTS;
  },

  /**
   * Returns the 4 featured "Neighborhood Favorites" ordered by `featuredOrder`
   * matching Figma Frame "01 · Storefront".
   */
  getFeaturedProducts() {
    return PRODUCTS.filter((product) => Number.isInteger(product.featuredOrder)).sort(
      (a, b) => a.featuredOrder - b.featuredOrder
    );
  },

  /**
   * Looks up a single product by its unique ID.
   * @param {string} productId
   */
  getProductById(productId) {
    return PRODUCTS.find((product) => product.id === productId) || null;
  },

  /**
   * Filters and sorts products by category, search query, and sort option.
   * @param {object} params
   * @param {string} [params.categoryId='all']
   * @param {string} [params.query='']
   * @param {string} [params.sortBy='featured']
   */
  queryProducts({ categoryId = "all", query = "", sortBy = "featured" } = {}) {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = PRODUCTS.filter((product) => {
      const matchesCategory =
        categoryId === "all" || product.categoryIds.includes(categoryId);

      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.shortDescription.toLowerCase().includes(normalizedQuery) ||
        (product.menuDescription &&
          product.menuDescription.toLowerCase().includes(normalizedQuery));

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

  /**
   * Returns global customization options for drinks.
   */
  getCustomizationOptions() {
    return CUSTOMIZATION_OPTIONS;
  },
};
