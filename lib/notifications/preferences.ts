import { NOTIFICATION_STORAGE } from "./constants";

function readFlag(key: string, defaultValue = true): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return stored !== "false";
  } catch {
    return defaultValue;
  }
}

function writeFlag(key: string, enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, enabled ? "true" : "false");
  } catch {}
}

export function isAttendanceReminderEnabled(): boolean {
  return readFlag(NOTIFICATION_STORAGE.ATTENDANCE_REMINDERS, true);
}

export function setAttendanceReminderEnabled(enabled: boolean): void {
  writeFlag(NOTIFICATION_STORAGE.ATTENDANCE_REMINDERS, enabled);
}

export function isAdminPunchAlertEnabled(): boolean {
  return readFlag(NOTIFICATION_STORAGE.ADMIN_PUNCH_ALERTS, true);
}

export function setAdminPunchAlertEnabled(enabled: boolean): void {
  writeFlag(NOTIFICATION_STORAGE.ADMIN_PUNCH_ALERTS, enabled);
}

export function getLastReminderAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE.LAST_REMINDER_AT);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function setLastReminderAt(timestamp: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIFICATION_STORAGE.LAST_REMINDER_AT, String(timestamp));
  } catch {}
}

export function readAdminSeenEventKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE.ADMIN_SEEN_EVENTS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

export function writeAdminSeenEventKeys(keys: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    const list = Array.from(keys).slice(-500);
    localStorage.setItem(NOTIFICATION_STORAGE.ADMIN_SEEN_EVENTS, JSON.stringify(list));
  } catch {}
}
