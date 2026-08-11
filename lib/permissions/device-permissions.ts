/**
 * Device permission helpers for camera & notifications.
 *
 * The web platform never lets a site force-persist a permission — but repeated
 * prompts on Samsung Internet / Android Chrome usually have two causes we CAN
 * address:
 *
 * 1. The browser evicts site data (Samsung "smart anti-tracking", storage
 *    pressure), which also resets granted permissions. Requesting
 *    **persistent storage** exempts the site from eviction.
 * 2. The user picks "Allow this time" instead of "Allow / While using the
 *    app", so the grant expires with the session. We detect that reset and
 *    show device-specific steps to grant permanently.
 */

export type PermissionKind = "camera" | "notifications" | "geolocation";

export type PermissionState = "granted" | "denied" | "prompt" | "unknown";

const GRANTED_ONCE_KEY = "device_permissions_granted_v1";

/** Query current permission state without triggering any prompt. */
export async function queryPermissionState(kind: PermissionKind): Promise<PermissionState> {
  if (typeof navigator === "undefined") return "unknown";

  if (kind === "notifications" && "Notification" in window) {
    const p = Notification.permission;
    if (p === "granted" || p === "denied") return p;
  }

  if (!navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({
      name: kind as PermissionName,
    });
    return status.state as PermissionState;
  } catch {
    return "unknown";
  }
}

/**
 * Ask the browser to protect this site's data from automatic eviction.
 * Safe to call repeatedly; browsers grant it silently for installed PWAs.
 * This is the main fix for Samsung devices "forgetting" permissions.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

function readGrantedMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(GRANTED_ONCE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Remember that the user granted a permission at least once on this device. */
export function rememberPermissionGranted(kind: PermissionKind): void {
  if (typeof window === "undefined") return;
  try {
    const map = readGrantedMap();
    map[kind] = Date.now();
    localStorage.setItem(GRANTED_ONCE_KEY, JSON.stringify(map));
  } catch {}
}

export function wasPermissionGrantedBefore(kind: PermissionKind): boolean {
  return Boolean(readGrantedMap()[kind]);
}

/**
 * True when the permission was granted before but the browser is asking
 * again — i.e. the user picked "Allow this time" or the browser reset site
 * data. Callers should show {@link getPermanentPermissionHelp}.
 */
export async function detectPermissionReset(kind: PermissionKind): Promise<boolean> {
  if (!wasPermissionGrantedBefore(kind)) return false;
  const state = await queryPermissionState(kind);
  return state === "prompt";
}

export function isSamsungInternet(): boolean {
  if (typeof navigator === "undefined") return false;
  return /samsungbrowser/i.test(navigator.userAgent);
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

const KIND_LABEL: Record<PermissionKind, string> = {
  camera: "Camera",
  notifications: "Notifications",
  geolocation: "Location",
};

/**
 * Device-specific steps to grant a permission permanently so the browser
 * stops asking on every use.
 */
export function getPermanentPermissionHelp(kind: PermissionKind): string {
  const label = KIND_LABEL[kind];

  if (isSamsungInternet()) {
    return (
      `To stop repeated ${label.toLowerCase()} prompts on Samsung Internet: ` +
      `tap the lock icon in the address bar → Permissions → ${label} → Allow. ` +
      `Also open Samsung Internet Settings → Sites and downloads → Site permissions → ${label} ` +
      `and make sure this site is set to Allow (not "Ask").`
    );
  }

  if (isIosDevice()) {
    return (
      `On iPhone/iPad: open Settings → Apps → Safari (or the installed app icon) → ${label} ` +
      `and choose Allow. For the installed app, also check Settings → Screen Time is not blocking it.`
    );
  }

  if (isAndroidDevice()) {
    return (
      `When Chrome asks for ${label.toLowerCase()} access, choose "While using the app" or "Allow" — ` +
      `NOT "Only this time" (that expires and asks again). ` +
      `To fix it now: tap the lock icon in the address bar → Permissions → ${label} → Allow.`
    );
  }

  return (
    `Click the lock icon in the address bar → Site settings → ${label} → Allow, ` +
    `so the browser remembers your choice permanently.`
  );
}

/**
 * One-time bootstrap after login/app start:
 * - requests persistent storage (prevents permission/data eviction), and
 * - snapshots already-granted permissions so future resets are detectable.
 */
export async function bootstrapDevicePermissions(): Promise<void> {
  await requestPersistentStorage();
  for (const kind of ["camera", "notifications", "geolocation"] as PermissionKind[]) {
    const state = await queryPermissionState(kind);
    if (state === "granted") rememberPermissionGranted(kind);
  }
}
