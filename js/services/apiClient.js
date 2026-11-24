/**
 * COMMON GROUND — Frontend REST API Client
 * Centralizes `fetch()` calls, auth Bearer headers, and JSON error handling.
 */

import { STORAGE_KEYS } from "../config/constants.js";
import { storageService } from "./storageService.js";

export async function apiRequest(endpoint, { method = "GET", body = null, token = null } = {}) {
  const authToken = token || storageService.get(STORAGE_KEYS.AUTH_TOKEN, null);
  const headers = {
    Accept: "application/json",
  };

  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(endpoint, {
    method,
    headers,
    credentials: "same-origin",
    body: body !== null ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const err = new Error(
      payload?.error?.message || `Request to ${endpoint} failed with status ${response.status}`
    );
    err.code = payload?.error?.code || `HTTP_${response.status}`;
    err.status = response.status;
    throw err;
  }

  return payload.data;
}
