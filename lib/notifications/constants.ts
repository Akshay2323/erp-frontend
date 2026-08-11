/** LocalStorage / session keys for notification preferences and state. */
export const NOTIFICATION_STORAGE = {
  ATTENDANCE_REMINDERS: "attendance_notifications_enabled",
  ADMIN_PUNCH_ALERTS: "admin_punch_notifications_enabled",
  LAST_REMINDER_AT: "last_attendance_notification_time",
  ADMIN_SEEN_EVENTS: "admin_punch_notification_seen_keys",
  HISTORY: "notification_history",
} as const;

export const NOTIFICATION_SESSION = {
  ADMIN_BASELINE_SEEDED: "admin_punch_baseline_seeded",
  ADMIN_PERMISSION_PROMPTED: "admin_punch_permission_prompted",
  PUSH_PERMISSION_PROMPTED: "push_permission_prompted",
} as const;

/** Employee punch-in reminder window: 08:00–12:00 local time. */
export const ATTENDANCE_REMINDER_WINDOW = {
  startMinutes: 8 * 60,
  endMinutes: 12 * 60,
} as const;

export const ATTENDANCE_REMINDER_INTERVAL_MS = 30 * 60 * 1000;
export const ADMIN_PUNCH_POLL_INTERVAL_MS = 15 * 1000;
export const NOTIFICATION_CHECK_INTERVAL_MS = 30 * 1000;
export const NOTIFICATION_HISTORY_LIMIT = 50;
export const NOTIFICATION_BROADCAST_CHANNEL = "jwork-notifications";
export const NOTIFICATION_HISTORY_EVENT = "jwork-notification-history-updated";
