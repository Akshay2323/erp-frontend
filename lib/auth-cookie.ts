import Cookies from "js-cookie";

import {
  AUTH_COOKIE_DAYS,
  AUTH_TOKEN_COOKIE,
  HOME_DASHBOARD_COOKIE,
} from "@/lib/auth-cache-constants";
import { clearClientAuthCheckedCookie, setClientAuthCheckedCookie } from "@/lib/auth-cache";
import { clearAuthMeCache } from "@/lib/auth-me-cache";
import {
  isHomeDashboardPath,
  resolveHomeDashboardPath,
  type AuthUser,
} from "@/lib/auth-session";

function isSecureCookieContext(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

export function authTokenCookieOptions() {
  return {
    // Persistent cookie (not session) — survives browser/tab close until expiry or logout.
    expires: AUTH_COOKIE_DAYS,
    sameSite: "Lax" as const,
    secure: isSecureCookieContext(),
    path: "/",
  };
}

/** Set persistent auth token cookie (survives browser close). */
export function setAuthTokenCookie(token: string): void {
  if (typeof window === "undefined") return;
  Cookies.set(AUTH_TOKEN_COOKIE, token, authTokenCookieOptions());
}

/**
 * Persist the role-based home path so middleware can send Admin users to
 * /hr-dashboard when they reopen the PWA at `/`.
 */
export function setHomeDashboardCookie(user?: AuthUser | null): void {
  if (typeof window === "undefined") return;
  const path = resolveHomeDashboardPath(user ?? null);
  Cookies.set(HOME_DASHBOARD_COOKIE, path, authTokenCookieOptions());
}

export function readHomeDashboardCookie(): string {
  if (typeof window === "undefined") return "/employee-dashboard";
  const raw = Cookies.get(HOME_DASHBOARD_COOKIE);
  return isHomeDashboardPath(raw) ? raw : "/employee-dashboard";
}

/**
 * Extend persistent auth cookie expiry (sliding window).
 * Call after successful auth/me, app activity, or when user reopens the app.
 */
export function refreshAuthTokenCookie(token?: string): void {
  if (typeof window === "undefined") return;
  const value = token ?? Cookies.get(AUTH_TOKEN_COOKIE);
  if (!value) return;
  Cookies.set(AUTH_TOKEN_COOKIE, value, authTokenCookieOptions());
  // Keep home path cookie alive alongside the token.
  const home = Cookies.get(HOME_DASHBOARD_COOKIE);
  if (isHomeDashboardPath(home)) {
    Cookies.set(HOME_DASHBOARD_COOKIE, home, authTokenCookieOptions());
  }
}

/**
 * Remove a cookie with the same attributes used when setting it.
 * Safari (esp. iOS) often fails to delete Secure cookies if remove() omits secure/sameSite.
 */
function removeAuthCookie(name: string): void {
  const secure = isSecureCookieContext();
  Cookies.remove(name, { path: "/", sameSite: "Lax", secure });
  // Fallbacks for cookies set under alternate attributes in older builds.
  Cookies.remove(name, { path: "/", sameSite: "Lax", secure: false });
  Cookies.remove(name, { path: "/" });
}

/** Remove auth cookies and cached session data. */
export function clearAuthSession(options?: { redirectToLogin?: boolean }): void {
  if (typeof window === "undefined") return;

  removeAuthCookie(AUTH_TOKEN_COOKIE);
  removeAuthCookie(HOME_DASHBOARD_COOKIE);
  clearClientAuthCheckedCookie();
  clearAuthMeCache();
  try {
    localStorage.removeItem("auth_user");
  } catch {
    // Private mode / storage blocked — still proceed with cookie clear + redirect.
  }

  if (options?.redirectToLogin) {
    // Hard navigation so middleware and client state cannot keep a stale session (iOS Safari).
    window.location.replace("/login");
  }
}

export function handleAuthMeSuccess(token: string): void {
  refreshAuthTokenCookie(token);
  setClientAuthCheckedCookie();
}

export function handleAuthMeFailure(status: number): boolean {
  if (status === 401 || status === 403) {
    clearAuthSession({ redirectToLogin: true });
    return true;
  }
  return false;
}
