/**
 * graph.js — Microsoft Graph API proxy.
 *
 * Port of scripts/graph_call.py to Node.js — keep the two in step.
 * Validates endpoints (incl. absolute @odata.nextLink URLs), percent-encodes
 * them, builds authenticated requests, handles 401 auto-retry with silent
 * token refresh, surfaces Retry-After, and sanitises message content in
 * responses (see sanitize.js) unless rawBody is set.
 *
 * Exports:
 *   makeRequest(method, endpoint, body, headers, opts) → { status, data|error }
 *   validateEndpoint(endpoint) → { endpoint, error }
 *   encodeEndpoint(endpoint)   → string
 */

import { getToken, AuthRequiredError } from "./auth.js";
import { sanitizeResponse } from "./sanitize.js";
import { posix as posixPath } from "node:path";

// ── Constants ────────────────────────────────────────────────────────────────

const GRAPH_BASE_URL  = "https://graph.microsoft.com/v1.0";
const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "DELETE", "PUT"]);
const REQUEST_TIMEOUT = 30_000; // 30 seconds

const CONTENT_BYTES_INLINE_LIMIT = 2048;   // base64 chars of an attachment shown inline
const TEXT_INLINE_LIMIT          = 100_000; // chars of a text/plain response shown inline

// Characters left as-is when percent-encoding (mirrors graph_call._URL_SAFE).
const URL_SAFE = new Set("/?&=$'(),:;@!*+%~-._");

const BAD_ENDPOINT = "Endpoint must start with /me or /users/";

// ── Endpoint validation ──────────────────────────────────────────────────────

/** Python-style unquote: decode valid %XX escapes, leave anything else. */
function unquote(s) {
  return s.replace(/(%[0-9A-Fa-f]{2})+/g, (m) => {
    try { return decodeURIComponent(m); } catch { return m; }
  });
}

/**
 * Validate (and normalise) an endpoint. Mirrors graph_call.validate_endpoint:
 * absolute URLs only for Graph v1.0 (nextLink/deltaLink), no backslashes or
 * double-encoding, and a segment-exact /me or /users/ prefix.
 * Defence-in-depth — token scopes are the primary guard.
 * @param {string} endpoint
 * @returns {{endpoint: string, error: string|null}}
 */
export function validateEndpoint(endpoint) {
  if (/^[A-Za-z][A-Za-z0-9+.\-]*:\/\//.test(endpoint) || endpoint.startsWith("//")) {
    if (endpoint.toLowerCase().startsWith(GRAPH_BASE_URL.toLowerCase() + "/")) {
      endpoint = endpoint.slice(GRAPH_BASE_URL.length);
    } else {
      return {
        endpoint,
        error: `Absolute URLs must start with ${GRAPH_BASE_URL}/ (e.g. an ` +
               "@odata.nextLink); otherwise pass a path starting with /me or /users/",
      };
    }
  }

  const pathOnly = endpoint.split("?")[0];
  const lower    = pathOnly.toLowerCase();
  // WHATWG URL parsing turns "\" into "/", so "/me\..\..\beta" would escape.
  if (pathOnly.includes("\\") || lower.includes("%5c") || lower.includes("%25")) {
    return { endpoint, error: BAD_ENDPOINT };
  }
  const normalised = posixPath.normalize(unquote(pathOnly));
  if (!(normalised === "/me" || normalised.startsWith("/me/") || normalised.startsWith("/users/"))) {
    return { endpoint, error: BAD_ENDPOINT };
  }

  // Belt and braces: the URL fetch() will actually request must stay under
  // /v1.0/me or /v1.0/users/ after the URL parser's own normalisation.
  try {
    const parsed = new URL(GRAPH_BASE_URL + encodeEndpoint(endpoint));
    const p = parsed.pathname;
    if (parsed.origin !== new URL(GRAPH_BASE_URL).origin ||
        !(p === "/v1.0/me" || p.startsWith("/v1.0/me/") || p.startsWith("/v1.0/users/"))) {
      return { endpoint, error: BAD_ENDPOINT };
    }
  } catch {
    return { endpoint, error: BAD_ENDPOINT };
  }
  return { endpoint, error: null };
}

/**
 * Percent-encode characters that are not valid in a URL, preserving existing
 * %XX escapes; a bare "%" becomes %25. Mirrors graph_call.encode_endpoint.
 */
export function encodeEndpoint(endpoint) {
  const fixed = endpoint.replace(/%(?![0-9A-Fa-f]{2})/g, "%25");
  let out = "";
  for (const ch of fixed) {
    if (/[A-Za-z0-9]/.test(ch) || URL_SAFE.has(ch)) {
      out += ch;
    } else {
      for (const b of Buffer.from(ch, "utf8")) out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return out;
}

// ── Response helpers ─────────────────────────────────────────────────────────

function elideContentBytes(data) {
  if (Array.isArray(data)) return data.map(elideContentBytes);
  if (data && typeof data === "object") {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [
      k,
      k === "contentBytes" && typeof v === "string" && v.length > CONTENT_BYTES_INLINE_LIMIT
        ? `<omitted: ${v.length} base64 chars — attachment downloads are not supported over MCP>`
        : elideContentBytes(v),
    ]));
  }
  return data;
}

async function buildSuccess(response, sanitize) {
  const ctype = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const buf   = Buffer.from(await response.arrayBuffer());
  if (buf.length === 0) return { status: response.status, data: null };

  if (ctype.endsWith("json") || !ctype) {
    try {
      let data = JSON.parse(buf.toString("utf8"));
      if (sanitize) data = sanitizeResponse(data);
      return { status: response.status, data: elideContentBytes(data) };
    } catch {
      // fall through — not JSON after all
    }
  }

  if (ctype === "text/plain") {
    const text   = buf.toString("utf8");
    const result = { status: response.status, data: text.slice(0, TEXT_INLINE_LIMIT) };
    if (text.length > TEXT_INLINE_LIMIT) result.truncated = true;
    if (sanitize) result.data = sanitizeResponse({ contentType: "text", content: result.data }).content;
    return result;
  }

  return {
    status:       response.status,
    data:         null,
    content_type: ctype || null,
    bytes:        buf.length,
    message:      "Non-JSON response not shown (binary downloads are not supported over MCP; " +
                  "use scripts/graph_call.py --out-dir/--out-name instead).",
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute a Microsoft Graph API request.
 *
 * @param {string} method   HTTP method (GET, POST, PATCH, DELETE, PUT)
 * @param {string} endpoint API endpoint (e.g., "/me/messages") or an @odata.nextLink URL
 * @param {string|null} body JSON request body (or null)
 * @param {object} headers  Additional headers as key-value pairs
 * @param {object} [opts]   { rawBody: true } returns message bodies unsanitised
 * @returns {object} { status, data } on success or { status, error, message } on failure
 */
export async function makeRequest(method, endpoint, body = null, headers = {}, opts = {}, _retried = false) {
  const sanitize = !opts.rawBody;

  // ── Validate method ─────────────────────────────────────────────────────
  if (!ALLOWED_METHODS.has(method)) {
    return {
      status:  400,
      error:   "invalid_method",
      message: `Method must be one of: ${[...ALLOWED_METHODS].join(", ")}`,
    };
  }

  // ── Validate endpoint ───────────────────────────────────────────────────
  const checked = validateEndpoint(endpoint);
  if (checked.error) {
    return {
      status:  400,
      error:   "invalid_endpoint",
      message: checked.error,
    };
  }
  endpoint = checked.endpoint;

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
  const url = GRAPH_BASE_URL + encodeEndpoint(endpoint);

  const reqHeaders = {
    Authorization: `Bearer ${token}`,
    ...headers,
  };

  // Add Content-Type for methods with body
  if (["POST", "PATCH", "PUT"].includes(method) && !reqHeaders["Content-Type"]) {
    reqHeaders["Content-Type"] = "application/json";
  }

  // fetch (undici) drops Authorization on cross-origin redirects per the
  // Fetch spec, so the token never follows a redirect to another host.
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
    if (err?.name === "TimeoutError") {
      return { status: 504, error: "timeout", message: `No response from Graph within ${REQUEST_TIMEOUT / 1000}s` };
    }
    return {
      status:  503,
      error:   "network_error",
      message: err.message,
    };
  }

  // ── Handle 401 with auto-retry ──────────────────────────────────────────
  if (response.status === 401 && !_retried) {
    // Retry once — getToken() will trigger silent refresh
    return makeRequest(method, endpoint, body, headers, opts, true);
  }
  if (response.status === 401) {
    return {
      status:  401,
      error:   "auth_required",
      message: "Run: .\\outlook-skills\\auth.ps1 --reauth",
    };
  }

  if (response.ok) {
    return buildSuccess(response, sanitize);
  }

  // ── Error response ────────────────────────────────────────────────────
  let responseBody = null;
  try {
    const text = await response.text();
    responseBody = text ? JSON.parse(text) : null;
  } catch {
    responseBody = null;
  }

  const result = {
    status:  response.status,
    error:   "http_error",
    message: response.statusText,
    details: responseBody,
  };
  // Throttling: surface Retry-After so the caller can back off.
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) result.retry_after = retryAfter;
  return result;
}
