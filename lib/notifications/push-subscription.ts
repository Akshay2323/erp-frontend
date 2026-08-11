import { API_BASE_URL } from "@/lib/config";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

let cachedVapidPublicKey: string | null | undefined;

async function getVapidPublicKey(token: string): Promise<string | null> {
  if (cachedVapidPublicKey !== undefined) return cachedVapidPublicKey;

  // Prefer server key so backend WEB_PUSH_PUBLIC_KEY stays the source of truth.
  try {
    const response = await fetch(`${API_BASE_URL}v1/notifications/push-public-key`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      data?: { public_key?: string | null; configured?: boolean };
    };
    const key = payload.data?.public_key?.trim() || null;
    if (key) {
      cachedVapidPublicKey = key;
      return key;
    }
  } catch {
    // fall through to env key
  }

  const envKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;
  cachedVapidPublicKey = envKey;
  return envKey;
}

export function detectPushPlatform(): "ios" | "android" | "desktop" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

export function isStandaloneForPush(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iOS Safari only supports Web Push inside an installed Home Screen PWA (16.4+). */
export function canUseWebPushOnThisDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (detectPushPlatform() === "ios" && !isStandaloneForPush()) return false;
  return true;
}

const PUSH_REFRESH_SESSION_KEY = "jwork_push_refreshed_v2";
const PUSH_ENDPOINT_STORAGE_KEY = "jwork_push_endpoint";

function shouldForceRefreshSubscription(forceRefresh?: boolean): boolean {
  if (forceRefresh) return true;
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(PUSH_REFRESH_SESSION_KEY) !== "1";
  } catch {
    return false;
  }
}

function markSubscriptionRefreshed(endpoint: string): void {
  try {
    sessionStorage.setItem(PUSH_REFRESH_SESSION_KEY, "1");
    localStorage.setItem(PUSH_ENDPOINT_STORAGE_KEY, endpoint);
  } catch {
    // ignore quota / private mode
  }
}

async function waitForActiveServiceWorker(
  timeoutMs = 12000,
): Promise<ServiceWorkerRegistration | null> {
  let registration = (await navigator.serviceWorker.getRegistration()) ?? null;

  if (!registration) {
    try {
      registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => {
          window.setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);
    } catch {
      return null;
    }
  }

  if (!registration) return null;
  if (registration.active) return registration;

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration | null>((resolve) => {
      const existing = registration;
      const onChange = () => {
        if (existing?.active) {
          navigator.serviceWorker.removeEventListener("controllerchange", onChange);
          resolve(existing);
        }
      };
      navigator.serviceWorker.addEventListener("controllerchange", onChange);
      window.setTimeout(() => {
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve(existing?.active ? existing : null);
      }, timeoutMs);
    }),
  ]);
}

/**
 * Registers a Web Push subscription with the backend so notifications can arrive
 * when the PWA/browser is closed (Android, desktop Chrome, iOS 16.4+ installed PWA).
 *
 * Android/Chrome often keeps a stale PushSubscription locally after FCM returns 410.
 * We force-refresh once per app session so closed-app delivery stays alive.
 */
export async function subscribeToWebPush(
  token: string,
  options?: { forceRefresh?: boolean },
): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (Notification.permission !== "granted") return false;
  // iOS: PushManager may appear in some builds but delivery only works in standalone PWA.
  if (detectPushPlatform() === "ios" && !isStandaloneForPush()) return false;

  try {
    const vapidKey = await getVapidPublicKey(token);
    if (!vapidKey) return false;

    const platform = detectPushPlatform();
    const registration = await waitForActiveServiceWorker(
      platform === "ios" || platform === "android" ? 15000 : 8000,
    );
    if (!registration?.pushManager) return false;

    let subscription = await registration.pushManager.getSubscription();
    let forceRefresh = shouldForceRefreshSubscription(options?.forceRefresh);

    // If the browser endpoint changed since last successful register, refresh.
    try {
      const knownEndpoint = localStorage.getItem(PUSH_ENDPOINT_STORAGE_KEY);
      if (subscription && knownEndpoint && knownEndpoint !== subscription.endpoint) {
        forceRefresh = true;
      }
    } catch {
      // ignore
    }

    if (subscription && forceRefresh) {
      try {
        await subscription.unsubscribe();
      } catch {
        // continue and create a fresh subscription
      }
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const response = await fetch(`${API_BASE_URL}v1/notifications/push-subscribe`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        platform,
        standalone: isStandaloneForPush(),
      }),
    });

    if (response.ok) {
      markSubscriptionRefreshed(subscription.endpoint);
    }

    return response.ok;
  } catch (error) {
    console.warn("Web Push subscription failed (backend may not support push yet)", error);
    return false;
  }
}

export async function unsubscribeFromWebPush(token: string): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    // iOS Safari can hang forever on serviceWorker.ready — never block logout on it.
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), 1500);
      }),
    ]);
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch(`${API_BASE_URL}v1/notifications/push-unsubscribe`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
      signal: (() => {
        if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
          return AbortSignal.timeout(2000);
        }
        const controller = new AbortController();
        window.setTimeout(() => controller.abort(), 2000);
        return controller.signal;
      })(),
    }).catch(() => {});

    await subscription.unsubscribe();
    try {
      sessionStorage.removeItem(PUSH_REFRESH_SESSION_KEY);
      localStorage.removeItem(PUSH_ENDPOINT_STORAGE_KEY);
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

export function isWebPushConfigured(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}
