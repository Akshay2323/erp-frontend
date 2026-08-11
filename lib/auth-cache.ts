import Cookies from "js-cookie";

import {
  AUTH_CHECKED_AT_COOKIE,
  AUTH_CHECK_TTL_MS,
  AUTH_COOKIE_DAYS,
  AUTH_ME_SESSION_KEY,
  AUTH_ME_SESSION_TTL_MS,
} from "@/lib/auth-cache-constants";

export {
  AUTH_CHECKED_AT_COOKIE,
  AUTH_CHECK_TTL_MS,
  AUTH_ME_SESSION_KEY,
  AUTH_ME_SESSION_TTL_MS,
  isAuthCheckFresh,
} from "@/lib/auth-cache-constants";

export function stampAuthCheckedCookieOptions(secure: boolean) {
  return {
    path: "/",
    sameSite: "Lax" as const,
    secure,
    expires: AUTH_COOKIE_DAYS,
  };
}

export function setClientAuthCheckedCookie(): void {
  if (typeof window === "undefined") return;
  const secure = window.location.protocol === "https:";
  Cookies.set(AUTH_CHECKED_AT_COOKIE, String(Date.now()), stampAuthCheckedCookieOptions(secure));
}

export function clearClientAuthCheckedCookie(): void {
  if (typeof window === "undefined") return;
  const secure = window.location.protocol === "https:";
  // Match set attributes — iOS Safari won't drop Secure cookies with path-only remove.
  Cookies.remove(AUTH_CHECKED_AT_COOKIE, { path: "/", sameSite: "Lax", secure });
  Cookies.remove(AUTH_CHECKED_AT_COOKIE, { path: "/", sameSite: "Lax", secure: false });
  Cookies.remove(AUTH_CHECKED_AT_COOKIE, { path: "/" });
}
