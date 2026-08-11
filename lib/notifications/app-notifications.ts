import {
  NOTIFICATION_BROADCAST_CHANNEL,
  NOTIFICATION_HISTORY_EVENT,
  NOTIFICATION_HISTORY_LIMIT,
  NOTIFICATION_STORAGE,
} from "./constants";
import {
  rememberPermissionGranted,
  requestPersistentStorage,
} from "@/lib/permissions/device-permissions";

export type NotificationHistoryItem = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  kind:
    | "attendance_reminder"
    | "attendance_punch_out_reminder"
    | "admin_punch_in"
    | "admin_punch_out"
    | "admin_leave_added"
    | "admin_salary_confirmed"
    | "employee_leave_approved"
    | "employee_leave_rejected"
    | "employee_update"
    | "system";
  href?: string;
};

export const NOTIFICATION_PERMISSION_GRANTED_EVENT =
  "jwork:notification-permission-granted";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** True when running as an installed PWA (Android Chrome, iOS Safari Add to Home Screen). */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported";
  if (Notification.permission !== "default") {
    if (Notification.permission === "granted") {
      rememberPermissionGranted("notifications");
      void requestPersistentStorage();
      window.dispatchEvent(new Event(NOTIFICATION_PERMISSION_GRANTED_EVENT));
    }
    return Notification.permission;
  }
  try {
    const result = await Notification.requestPermission();
    if (result === "granted") {
      // Pin site data so the grant survives browser cleanups (Samsung etc.).
      rememberPermissionGranted("notifications");
      void requestPersistentStorage();
      window.dispatchEvent(new Event(NOTIFICATION_PERMISSION_GRANTED_EVENT));
    }
    return result;
  } catch {
    return Notification.permission;
  }
}

function defaultIcon(): string {
  return "/icon-192x192.png";
}

export function readNotificationHistory(): NotificationHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE.HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as NotificationHistoryItem[];
  } catch {
    return [];
  }
}

function persistHistory(items: NotificationHistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      NOTIFICATION_STORAGE.HISTORY,
      JSON.stringify(items.slice(0, NOTIFICATION_HISTORY_LIMIT)),
    );
    window.dispatchEvent(new CustomEvent(NOTIFICATION_HISTORY_EVENT));
  } catch {}
}

export function appendNotificationHistory(
  item: Omit<NotificationHistoryItem, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  },
): void {
  const entry: NotificationHistoryItem = {
    id: item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: item.createdAt ?? Date.now(),
    title: item.title,
    body: item.body,
    kind: item.kind,
    href: item.href,
  };
  const next = [entry, ...readNotificationHistory()].slice(0, NOTIFICATION_HISTORY_LIMIT);
  persistHistory(next);
}

function broadcastNotificationShown(tag: string): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(NOTIFICATION_BROADCAST_CHANNEL);
    channel.postMessage({ type: "shown", tag, at: Date.now() });
    channel.close();
  } catch {}
}

export type ShowAppNotificationInput = {
  title: string;
  body: string;
  tag?: string;
  href?: string;
  kind?: NotificationHistoryItem["kind"];
  icon?: string | null;
  image?: string | null;
  silent?: boolean;
};

/**
 * Shows a system notification via the service worker (PWA / mobile) with
 * fallback to the Notification constructor (desktop browsers).
 */
export async function showAppNotification(input: ShowAppNotificationInput): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return false;
  }

  const icon = input.icon || defaultIcon();
  const options: NotificationOptions & { image?: string } = {
    body: input.body,
    icon,
    badge: defaultIcon(),
    tag: input.tag,
    data: { url: input.href ?? "/" },
    silent: input.silent,
  };
  if (input.image) {
    options.image = input.image;
  }

  let shown = false;

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && "showNotification" in registration) {
        await registration.showNotification(input.title, options);
        shown = true;
      }
    } catch (error) {
      console.warn("Service Worker notification failed, falling back to Notification API", error);
    }
  }

  if (!shown) {
    try {
      new Notification(input.title, options);
      shown = true;
    } catch (error) {
      console.error("Notification constructor failed", error);
    }
  }

  if (shown) {
    appendNotificationHistory({
      title: input.title,
      body: input.body,
      kind: input.kind ?? "system",
      href: input.href,
    });
    if (input.tag) broadcastNotificationShown(input.tag);
  }

  return shown;
}

/**
 * Shows a browser notification when permitted; otherwise records history and
 * shows an in-app toast (when the tab is visible).
 */
export async function deliverNotification(input: ShowAppNotificationInput): Promise<void> {
  const shown = await showAppNotification(input);
  if (shown) return;

  appendNotificationHistory({
    title: input.title,
    body: input.body,
    kind: input.kind ?? "system",
    href: input.href,
  });
  if (input.tag) broadcastNotificationShown(input.tag);

  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    const { toast } = await import("sonner");
    toast.info(input.title, { description: input.body, duration: 10_000 });
  }
}

export function isWithinAttendanceReminderWindow(now = new Date()): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 8 * 60 && minutes < 12 * 60;
}

export function formatLocalDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
