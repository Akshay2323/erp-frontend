// -------------------------------------------------------------
// CONFIGURATION: Set your API URLs here (Single Source of Truth)
// -------------------------------------------------------------
/** Live Laravel API — routes live under /api/v1/... */
const LIVE_API_URL = "https://appapi.jyotielectricals.co.in/api/";
/** Local Laravel (`php artisan serve`) — routes live under /api/v1/... */
const LOCAL_API_URL = "https://appapi.jyotielectricals.co.in/api/";

// Choose mode:
// - "auto": auto-detect based on host/environment
// - "local": force local API (http://127.0.0.1:8000/api/)
// - "live": force live API
const API_MODE = "local" as "auto" | "local" | "live";
// -------------------------------------------------------------

/**
 * Normalize to a trailing-slash base that always includes `/api/`.
 * Also upgrades bare `http://` hosts to `https://` so server-side
 * proxies do not lose Authorization headers on 301 redirects.
 */
const normalizeBaseUrl = (url: string) => {
  let normalized = url.trim();
  if (normalized.startsWith("http://") && !/localhost|127\.0\.0\.1|192\.168\.|10\./.test(normalized)) {
    normalized = `https://${normalized.slice("http://".length)}`;
  }
  if (!normalized.endsWith("/")) {
    normalized = `${normalized}/`;
  }
  // Ensure Laravel /api prefix is present (avoid /v1/... 404/auth failures).
  if (!/\/api\/$/i.test(normalized)) {
    normalized = `${normalized}api/`;
  }
  return normalized;
};

const getFallbackApiUrl = () => {
  // Explicit local mode always wins (including `next start` / production NODE_ENV).
  if (API_MODE === "local") return LOCAL_API_URL;
  if (API_MODE === "live") return LIVE_API_URL;

  // "auto" + production build → live
  if (process.env.NODE_ENV === "production") {
    return LIVE_API_URL;
  }

  // "auto" detection (development)
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.")
    ) {
      return LOCAL_API_URL;
    }
    return LIVE_API_URL;
  }

  if (process.platform === "win32") {
    return LOCAL_API_URL;
  }

  return LIVE_API_URL;
};

const DEFAULT_SERVER_API_BASE_URL = getFallbackApiUrl();

const rawServerApiBaseUrl =
  process.env.SERVER_API_BASE_URL ??
  process.env.API_BASE_URL ??
  DEFAULT_SERVER_API_BASE_URL;

/** Full backend URL for proxy.ts (never use a relative path here). */
export const SERVER_API_BASE_URL = normalizeBaseUrl(rawServerApiBaseUrl);

/**
 * Client-side API base URL — browser calls the API domain directly.
 * Server-side proxy/middleware uses {@link SERVER_API_BASE_URL} (same backend).
 */
const rawClientApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? SERVER_API_BASE_URL;

export const API_BASE_URL = normalizeBaseUrl(rawClientApiBaseUrl);

export const IS_API_PROXY = API_BASE_URL.startsWith("/");

/** Build an absolute Laravel API URL from a path like `v1/employees/1/...`. */
export function serverApiUrl(path: string): string {
  return `${SERVER_API_BASE_URL}${path.replace(/^\//, "")}`;
}

