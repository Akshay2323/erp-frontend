"use client";

import { useEffect, useRef } from "react";
import Cookies from "js-cookie";

import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cache-constants";
import { fetchAuthMeCached } from "@/lib/auth-me-cache";
import { setClientAuthCheckedCookie } from "@/lib/auth-cache";
import { refreshAuthTokenCookie } from "@/lib/auth-cookie";

/** Throttle sliding cookie renewal while the user is active. */
const ACTIVITY_REFRESH_MS = 30 * 60 * 1000;

/** Background session keep-alive (does not force logout on transient API errors). */
const SESSION_KEEPALIVE_MS = 30 * 60 * 1000;

/**
 * Extends auth cookies while the user interacts with the app and periodically
 * refreshes `/v1/auth/me` so sessions stay alive across devices/tabs.
 */
export function AuthSessionRefresh() {
  const lastRefreshRef = useRef(0);
  const keepAliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const renewSession = () => {
      refreshAuthTokenCookie();
      setClientAuthCheckedCookie();
    };

    const renewOnActivity = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < ACTIVITY_REFRESH_MS) return;
      lastRefreshRef.current = now;
      renewSession();
    };

    const renewOnReturn = () => {
      if (document.visibilityState !== "visible") return;
      lastRefreshRef.current = Date.now();
      renewSession();
      const token = Cookies.get(AUTH_TOKEN_COOKIE);
      if (token) {
        void fetchAuthMeCached(token, { force: true });
      }
    };

    const runKeepAlive = () => {
      if (document.visibilityState !== "visible") return;
      const token = Cookies.get(AUTH_TOKEN_COOKIE);
      if (!token) return;
      void fetchAuthMeCached(token, { force: true });
      renewSession();
    };

    const events: Array<keyof WindowEventMap> = [
      "click",
      "keydown",
      "touchstart",
      "scroll",
    ];

    for (const event of events) {
      window.addEventListener(event, renewOnActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", renewOnReturn);

    keepAliveTimerRef.current = setInterval(runKeepAlive, SESSION_KEEPALIVE_MS);
    renewSession();

    return () => {
      for (const event of events) {
        window.removeEventListener(event, renewOnActivity);
      }
      document.removeEventListener("visibilitychange", renewOnReturn);
      if (keepAliveTimerRef.current) {
        clearInterval(keepAliveTimerRef.current);
      }
    };
  }, []);

  return null;
}
