import { getTodayStatus } from "@/lib/api/attendance";

import {
  ATTENDANCE_REMINDER_INTERVAL_MS,
  NOTIFICATION_BROADCAST_CHANNEL,
} from "./constants";
import { requestNotificationPermission, showAppNotification } from "./app-notifications";
import {
  getLastReminderAt,
  isAttendanceReminderEnabled,
  setLastReminderAt,
} from "./preferences";

function hasRecentReminder(now: number): boolean {
  const last = getLastReminderAt();
  if (last === null) return false;
  return now - last < ATTENDANCE_REMINDER_INTERVAL_MS;
}

function attendanceState(data: unknown): { punchedIn: boolean; punchedOut: boolean } {
  if (!data || typeof data !== "object") {
    return { punchedIn: false, punchedOut: false };
  }
  const d = data as Record<string, unknown>;
  const inTime =
    d.punch_in_time ?? d.in_time ?? d.first_punch ?? d.punch_in ?? null;
  const outTime =
    d.punch_out_time ?? d.out_time ?? d.last_punch ?? d.punch_out ?? null;
  return {
    punchedIn: Boolean(inTime) || Boolean(d.is_punched_in),
    punchedOut: Boolean(outTime),
  };
}

let broadcastChannel: BroadcastChannel | null = null;

function ensureBroadcastListener(onPeerShown: (tag: string) => void): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  if (broadcastChannel) return;
  broadcastChannel = new BroadcastChannel(NOTIFICATION_BROADCAST_CHANNEL);
  broadcastChannel.onmessage = (event) => {
    const data = event.data as { type?: string; tag?: string };
    if (data?.type === "shown" && typeof data.tag === "string") {
      onPeerShown(data.tag);
    }
  };
}

/**
 * Remind employees to punch in during the morning and punch out after 5 PM.
 * Runs while the app/PWA tab is open (or in background on supported platforms).
 */
export async function checkEmployeeAttendanceReminder(token: string): Promise<void> {
  if (!isAttendanceReminderEnabled()) return;

  const now = Date.now();
  if (hasRecentReminder(now)) return;

  try {
    const res = await getTodayStatus(token);
    const state = attendanceState(res?.data);
    const date = new Date();
    const minutes = date.getHours() * 60 + date.getMinutes();
    const needsPunchIn = minutes >= 8 * 60 && minutes < 12 * 60 && !state.punchedIn;
    const needsPunchOut = minutes >= 17 * 60 && state.punchedIn && !state.punchedOut;
    if (!needsPunchIn && !needsPunchOut) return;

    const permission = await requestNotificationPermission();
    if (permission !== "granted") return;

    const reminderType = needsPunchIn ? "punch-in" : "punch-out";
    const tag = `attendance-${reminderType}-reminder-${date.toISOString().slice(0, 10)}`;
    ensureBroadcastListener((peerTag) => {
      if (peerTag === tag) setLastReminderAt(Date.now());
    });

    const shown = await showAppNotification({
      title: needsPunchIn ? "Punch In Reminder" : "Punch Out Reminder",
      body: needsPunchIn
        ? "You have not punched in today. Please record your attendance."
        : "Your shift is ending and you are still punched in. Please punch out.",
      tag,
      href: "/employee-dashboard",
      kind: needsPunchIn ? "attendance_reminder" : "attendance_punch_out_reminder",
    });

    if (shown) {
      setLastReminderAt(now);
    }
  } catch (error) {
    console.warn("Failed to check punch-in status for attendance reminder", error);
  }
}

export function disposeAttendanceReminderBroadcast(): void {
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
  }
}
