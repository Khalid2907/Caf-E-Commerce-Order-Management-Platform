/**
 * COMMON GROUND — Safe LocalStorage Persistence Wrapper
 * Encapsulates browser storage so it can be swapped or synced with a backend API later.
 */

export const storageService = {
  /**
   * Reads and parses a JSON value from localStorage.
   * @template T
   * @param {string} key
   * @param {T} fallbackValue
   * @returns {T}
   */
  get(key, fallbackValue = null) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallbackValue;
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`[storageService] Failed to read key "${key}":`, error);
      return fallbackValue;
    }
  },

  /**
   * Serializes and writes a value to localStorage.
   * @param {string} key
   * @param {unknown} value
   * @returns {boolean}
   */
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`[storageService] Failed to write key "${key}":`, error);
      return false;
    }
  },

  /**
   * Removes a key from localStorage.
   * @param {string} key
   */
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`[storageService] Failed to remove key "${key}":`, error);
    }
  },
};
