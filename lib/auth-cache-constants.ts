/** Client-readable cookie: timestamp (ms) when `v1/auth/me` last succeeded in middleware. */
export const AUTH_CHECKED_AT_COOKIE = "auth_checked_at";

/** Bearer token cookie name. */
export const AUTH_TOKEN_COOKIE = "auth_token";

/** Role-based home dashboard path (readable by middleware on app open). */
export const HOME_DASHBOARD_COOKIE = "home_dashboard";

/** How long the auth token cookie stays valid (persistent — survives browser close). */
export const AUTH_COOKIE_DAYS = 400;

export const AUTH_COOKIE_MAX_AGE_SEC = AUTH_COOKIE_DAYS * 24 * 60 * 60;

/** How long middleware skips repeat `auth/me` calls after a successful check. */
export const AUTH_CHECK_TTL_MS = 12 * 60 * 60 * 1000;

/** sessionStorage cache for layout/sidebar `auth/me` enrichment. */
export const AUTH_ME_SESSION_KEY = "auth_me_cache_v1";
export const AUTH_ME_SESSION_TTL_MS = 60 * 60 * 1000;

export function isAuthCheckFresh(checkedAtMs: number | null | undefined): boolean {
  if (!checkedAtMs || !Number.isFinite(checkedAtMs)) return false;
  return Date.now() - checkedAtMs < AUTH_CHECK_TTL_MS;
}

export function authCheckCookieMaxAgeSec(): number {
  return Math.floor(AUTH_CHECK_TTL_MS / 1000);
}
