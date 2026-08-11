import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  AUTH_CHECKED_AT_COOKIE,
  AUTH_COOKIE_MAX_AGE_SEC,
  AUTH_TOKEN_COOKIE,
  HOME_DASHBOARD_COOKIE,
  authCheckCookieMaxAgeSec,
  isAuthCheckFresh,
} from "@/lib/auth-cache-constants";
import { serverFetch } from "@/lib/api/server-fetch";
import { SERVER_API_BASE_URL } from "@/lib/config";
import { isHomeDashboardPath } from "@/lib/auth-session";

const BACKEND_URL = SERVER_API_BASE_URL;
const PUBLIC_ROUTES = new Set(["/login", "/forgot-password"]);
/** Accessible with or without login (e.g. user guide from login screen). */
const OPEN_ROUTES = new Set(["/user-guidance"]);
const AUTH_ME_TIMEOUT_MS = 15_000;
const DEFAULT_HOME = "/employee-dashboard";

const normalizeBaseUrl = (url: string) => (url.endsWith("/") ? url : `${url}/`);

/** Match public routes even when the URL has a trailing slash. */
const normalizePathname = (pathname: string) =>
  pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;

function resolveHomeFromRequest(request: NextRequest): string {
  const raw = request.cookies.get(HOME_DASHBOARD_COOKIE)?.value;
  return isHomeDashboardPath(raw) ? raw : DEFAULT_HOME;
}

type TokenValidation = "valid" | "invalid" | "unknown";

async function validateAuthToken(token: string): Promise<TokenValidation> {
  if (!BACKEND_URL) return "unknown";

  try {
    const response = await serverFetch(`${normalizeBaseUrl(BACKEND_URL)}v1/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(AUTH_ME_TIMEOUT_MS),
    });

    if (response.status === 401 || response.status === 403) {
      return "invalid";
    }

    if (!response.ok) {
      return "unknown";
    }

    const result = (await response.json()) as { success?: boolean };
    return result.success === true ? "valid" : "unknown";
  } catch {
    return "unknown";
  }
}

function stampAuthCookies(
  response: NextResponse,
  token: string,
  request: NextRequest,
): void {
  const secure = request.nextUrl.protocol === "https:";

  response.cookies.set(AUTH_TOKEN_COOKIE, token, {
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SEC,
    sameSite: "lax",
    secure,
  });

  response.cookies.set(AUTH_CHECKED_AT_COOKIE, String(Date.now()), {
    path: "/",
    maxAge: authCheckCookieMaxAgeSec(),
    sameSite: "lax",
    secure,
  });
}

function clearAuthCookies(response: NextResponse): void {
  response.cookies.delete(AUTH_TOKEN_COOKIE);
  response.cookies.delete(AUTH_CHECKED_AT_COOKIE);
  response.cookies.delete(HOME_DASHBOARD_COOKIE);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/* is handled by app/api/[...path]/route.ts (not external rewrite)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // PWA / service worker assets must stay public — browsers fetch them without
  // cookies and closed-app Web Push depends on an unauthenticated /sw.js.
  if (
    pathname === "/sw.js" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/workbox-") ||
    pathname.startsWith("/worker-") ||
    pathname.startsWith("/icon-")
  ) {
    return NextResponse.next();
  }

  const normalizedPath = normalizePathname(pathname);
  const token = request.cookies.get("auth_token")?.value;
  const authCheckedRaw = request.cookies.get(AUTH_CHECKED_AT_COOKIE)?.value;
  const authCheckedAt = authCheckedRaw ? Number(authCheckedRaw) : null;
  const hasFreshAuthCheck = isAuthCheckFresh(authCheckedAt);
  const isPublicRoute = PUBLIC_ROUTES.has(normalizedPath);
  const isOpenRoute = OPEN_ROUTES.has(normalizedPath);

  const passThroughWithAuthStamp = () => {
    const response = NextResponse.next();
    if (token && !hasFreshAuthCheck) {
      stampAuthCookies(response, token, request);
    } else if (token) {
      response.cookies.set(AUTH_TOKEN_COOKIE, token, {
        path: "/",
        maxAge: AUTH_COOKIE_MAX_AGE_SEC,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
      });
    }
    return response;
  };

  if (!token) {
    if (normalizedPath === "/") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (isPublicRoute || isOpenRoute) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isOpenRoute) {
    return passThroughWithAuthStamp();
  }

  if (isPublicRoute) {
    const home = resolveHomeFromRequest(request);
    if (hasFreshAuthCheck) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    const validation = await validateAuthToken(token);
    if (validation === "valid") {
      const response = NextResponse.redirect(new URL(home, request.url));
      stampAuthCookies(response, token, request);
      return response;
    }
    if (validation === "invalid") {
      const response = NextResponse.next();
      clearAuthCookies(response);
      return response;
    }
    return passThroughWithAuthStamp();
  }

  if (hasFreshAuthCheck) {
    if (normalizedPath === "/") {
      return NextResponse.redirect(new URL(resolveHomeFromRequest(request), request.url));
    }
    const response = NextResponse.next();
    response.cookies.set(AUTH_TOKEN_COOKIE, token, {
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE_SEC,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
    return response;
  }

  const validation = await validateAuthToken(token);
  if (validation === "invalid") {
    const response = NextResponse.redirect(new URL("/login", request.url));
    clearAuthCookies(response);
    return response;
  }

  if (normalizedPath === "/") {
    const response = NextResponse.redirect(
      new URL(resolveHomeFromRequest(request), request.url),
    );
    if (validation === "valid") {
      stampAuthCookies(response, token, request);
    } else {
      response.cookies.set(AUTH_TOKEN_COOKIE, token, {
        path: "/",
        maxAge: AUTH_COOKIE_MAX_AGE_SEC,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
      });
    }
    return response;
  }

  if (validation === "valid") {
    return passThroughWithAuthStamp();
  }

  const response = NextResponse.next();
  response.cookies.set(AUTH_TOKEN_COOKIE, token, {
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SEC,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|workbox-.*|worker-.*|icon-.*).*)",
  ],
};
