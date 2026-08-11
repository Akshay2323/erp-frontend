"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * PWA update + hard-refresh helpers.
 *
 * Works for installed PWAs on Desktop (Chrome/Edge), Android (Chrome /
 * Samsung Internet) and iOS (Safari standalone), where the user has no
 * browser reload button and stale service-worker caches can pin the app
 * to an old build.
 */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

function hasServiceWorker(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

/** Ask the service worker to check the server for a newer build. */
export async function checkForAppUpdate(): Promise<boolean> {
  if (!hasServiceWorker()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    await registration.update();
    return Boolean(registration.waiting || registration.installing);
  } catch {
    return false;
  }
}

/**
 * Hard refresh: wipe every Cache Storage entry, drop the current service
 * worker, then reload so the next load fetches the latest deployed build.
 * Auth/localStorage data is intentionally preserved.
 */
export async function hardRefreshApp(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Cache API unavailable (private mode etc.) — reload still helps.
  }

  try {
    if (hasServiceWorker()) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch {
    // ignore — reload will re-register the worker
  }

  // Cache-busting query param defeats any remaining HTTP cache for the shell.
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
}

export type AppUpdateState = {
  /** A newer build is installed and waiting to take over. */
  updateAvailable: boolean;
  /** Currently checking the server for a new build. */
  checking: boolean;
  /** Manually check for a new build; resolves true when one was found. */
  checkNow: () => Promise<boolean>;
  /** Clear caches + service worker and reload to the latest version. */
  applyUpdate: () => Promise<void>;
};

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Detects new deployments while the app is open (installed PWA or tab):
 * checks on mount, on tab focus, and every 30 minutes.
 */
export function useAppUpdate(): AppUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (!hasServiceWorker()) return;

    let cancelled = false;

    const markIfWaiting = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) setUpdateAvailable(true);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // A worker reached "installed" while an old one controls the page
          // means a new build is ready.
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            if (!cancelled) setUpdateAvailable(true);
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration && !cancelled) markIfWaiting(registration);
    });

    const runCheck = () => {
      void checkForAppUpdate().then((found) => {
        if (found && !cancelled) setUpdateAvailable(true);
      });
    };

    runCheck();
    const interval = window.setInterval(runCheck, UPDATE_CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") runCheck();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      const found = await checkForAppUpdate();
      if (found) setUpdateAvailable(true);
      return found;
    } finally {
      setChecking(false);
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    await hardRefreshApp();
  }, []);

  return { updateAvailable, checking, checkNow, applyUpdate };
}
