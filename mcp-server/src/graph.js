/**
 * graph.js — Microsoft Graph API proxy.
 *
 * Direct port of scripts/graph_call.py to Node.js.
 * Validates endpoints, builds authenticated requests, handles
 * 401 auto-retry with silent token refresh.
 *
 * Exports:
 *   makeRequest(method, endpoint, body, headers) → { status, data|error }
 */

import { getToken, AuthRequiredError } from "./auth.js";
import { posix as posixPath } from "node:path";

// ── Constants ────────────────────────────────────────────────────────────────

const GRAPH_BASE_URL  = "https://graph.microsoft.com/v1.0";
const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "DELETE", "PUT"]);
const REQUEST_TIMEOUT = 30_000; // 30 seconds

// ── Endpoint validation ──────────────────────────────────────────────────────

/**
 * Validate that the endpoint starts with /me or /users/.
 * Defence-in-depth — token scopes are the primary guard.
 * @param {string} endpoint
 * @returns {string|null} Error message if invalid, null if OK
 */
function validateEndpoint(endpoint) {
  const pathOnly   = endpoint.split("?")[0];
  const decoded    = decodeURIComponent(pathOnly);
  const normalised = posixPath.normalize(decoded);

  if (normalised.startsWith("/me") || normalised.startsWith("/users/")) {
    return null; // valid
  }
  return "Endpoint must start with /me or /users/";
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute a Microsoft Graph API request.
 *
 * @param {string} method   HTTP method (GET, POST, PATCH, DELETE, PUT)
 * @param {string} endpoint API endpoint (e.g., "/me/messages")
 * @param {string|null} body JSON request body (or null)
 * @param {object} headers  Additional headers as key-value pairs
 * @returns {object} { status, data } on success or { status, error, message } on failure
 */
export async function makeRequest(method, endpoint, body = null, headers = {}, _retried = false) {
  // ── Validate method ─────────────────────────────────────────────────────
  if (!ALLOWED_METHODS.has(method)) {
    return {
      status:  400,
      error:   "invalid_method",
      message: `Method must be one of: ${[...ALLOWED_METHODS].join(", ")}`,
    };
  }

  // ── Validate endpoint ───────────────────────────────────────────────────
  const endpointError = validateEndpoint(endpoint);
  if (endpointError) {
    return {
      status:  400,
      error:   "invalid_endpoint",
      message: endpointError,
    };
  }

  // ── Get token ───────────────────────────────────────────────────────────
  let token;
  try {
    token = await getToken();
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return {
        status:  401,
        error:   "auth_required",
        message: err.message,
      };
    }
    return {
      status:  503,
      error:   "token_error",
      message: err.message,
    };
  }

  // ── Build request ───────────────────────────────────────────────────────
  const url = GRAPH_BASE_URL + endpoint;

  const reqHeaders = {
    Authorization: `Bearer ${token}`,
    ...headers,
  };

  // Add Content-Type for methods with body
  if (["POST", "PATCH", "PUT"].includes(method) && !reqHeaders["Content-Type"]) {
    reqHeaders["Content-Type"] = "application/json";
  }

  const fetchOptions = {
    method,
    headers: reqHeaders,
    signal:  AbortSignal.timeout(REQUEST_TIMEOUT),
  };

  if (body && ["POST", "PATCH", "PUT"].includes(method)) {
    fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  // ── Execute request ─────────────────────────────────────────────────────
  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    return {
      status:  503,
      error:   "network_error",
      message: err.message,
    };
  }

  // ── Handle 401 with auto-retry ──────────────────────────────────────────
  if (response.status === 401 && !_retried) {
    // Retry once — getToken() will trigger silent refresh
    return makeRequest(method, endpoint, body, headers, true);
  }
  if (response.status === 401) {
    return {
      status:  401,
      error:   "auth_required",
      message: "Run: .\\outlook-skills\\auth.ps1 --reauth",
    };
  }

  // ── Parse response ────────────────────────────────────────────────────
  let responseBody;
  try {
    const text = await response.text();
    responseBody = text ? JSON.parse(text) : null;
  } catch {
    responseBody = null;
  }

  if (response.ok) {
    return {
      status: response.status,
      data:   responseBody,
    };
  }

  // ── Error response ────────────────────────────────────────────────────
  return {
    status:  response.status,
    error:   "http_error",
    message: response.statusText,
    details: responseBody,
  };
}
