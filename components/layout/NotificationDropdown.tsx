"use client";

import { Bell } from "lucide-react";
import Cookies from "js-cookie";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getNotificationPermission,
  isStandalonePwa,
  readNotificationHistory,
  requestNotificationPermission,
  type NotificationHistoryItem,
} from "@/lib/notifications/app-notifications";
import {
  canUseWebPushOnThisDevice,
  detectPushPlatform,
  isWebPushConfigured,
  subscribeToWebPush,
} from "@/lib/notifications/push-subscription";
import { NOTIFICATION_HISTORY_EVENT } from "@/lib/notifications/constants";
import {
  isAdminPunchAlertEnabled,
  isAttendanceReminderEnabled,
  setAdminPunchAlertEnabled,
  setAttendanceReminderEnabled,
} from "@/lib/notifications/preferences";
import { isPunchAlertAdminSession, readAuthUser } from "@/lib/auth-session";
import { cn } from "@/lib/utils";

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [adminAlertsEnabled, setAdminAlertsEnabled] = useState(true);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [isPunchAlertAdmin, setIsPunchAlertAdmin] = useState(false);
  const [isPwa, setIsPwa] = useState(false);
  const [pushReadyHint, setPushReadyHint] = useState(false);

  const refreshHistory = useCallback(() => {
    setHistory(readNotificationHistory());
  }, []);

  useEffect(() => {
    setMounted(true);
    setPermission(getNotificationPermission());
    const hydrateTimer = window.setTimeout(() => {
      setRemindersEnabled(isAttendanceReminderEnabled());
      setAdminAlertsEnabled(isAdminPunchAlertEnabled());
      setIsPunchAlertAdmin(isPunchAlertAdminSession(readAuthUser()));
      setIsPwa(isStandalonePwa());
      refreshHistory();
    }, 0);

    const onHistoryUpdate = () => refreshHistory();
    window.addEventListener(NOTIFICATION_HISTORY_EVENT, onHistoryUpdate);
    return () => {
      window.clearTimeout(hydrateTimer);
      window.removeEventListener(NOTIFICATION_HISTORY_EVENT, onHistoryUpdate);
    };
  }, [refreshHistory]);

  const ensurePermission = async (): Promise<boolean> => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result === "granted";
  };

  const registerPush = async () => {
    const token = Cookies.get("auth_token");
    if (!token) return false;
    const platform = detectPushPlatform();
    return subscribeToWebPush(token, {
      forceRefresh: platform === "ios" || platform === "android",
    });
  };

  const handleRemindersToggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await ensurePermission();
      if (!granted) return;
      await registerPush();
    }
    setRemindersEnabled(enabled);
    setAttendanceReminderEnabled(enabled);
  };

  const handleAdminAlertsToggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await ensurePermission();
      if (!granted) return;
      await registerPush();
    }
    // Do not unsubscribe on disable — leave/salary pushes must keep working.
    // Toggle only controls in-app punch polling preference.
    setAdminAlertsEnabled(enabled);
    setAdminPunchAlertEnabled(enabled);
  };

  const handleEnableBackgroundAlerts = async () => {
    const granted = await ensurePermission();
    if (!granted) return;
    const ok = await registerPush();
    if (ok) {
      setPushReadyHint(true);
    }
  };

  const permissionBlocked = mounted && permission === "denied";
  const pushReady = isWebPushConfigured();

  return (
    <div className="relative">
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Notifications"
        onClick={() => setOpen((prev) => !prev)}
        size="icon"
        variant="ghost"
      >
        <Bell className="h-4 w-4" />
        {history.length > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
        )}
      </Button>
      <div
        className={cn(
          "absolute right-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 shadow-lg transition-all",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        )}
        role="menu"
      >
        <div className="border-b border-border pb-2 mb-2 px-1 space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Notifications
          </span>

          {permissionBlocked && (
            <p className="text-[11px] text-destructive leading-snug">
              Notifications are blocked in your browser settings. Enable them for this site to
              receive punch reminders and alerts.
            </p>
          )}

          {mounted && !isPwa && typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
              On iPhone/iPad: tap Share → Add to Home Screen, open the installed app, then allow
              notifications. Background alerts only work in the installed PWA.
            </p>
          )}

          {mounted && isPwa && permission !== "denied" && (
            <p className="text-[11px] text-muted-foreground leading-snug">
              Installed app mode: alerts use the PWA service worker
              {pushReady && canUseWebPushOnThisDevice()
                ? " and can arrive when the app is closed."
                : "."}
            </p>
          )}

          {mounted && permission !== "denied" && canUseWebPushOnThisDevice() && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full text-xs"
              onClick={() => void handleEnableBackgroundAlerts()}
            >
              {pushReadyHint ? "Background alerts ready" : "Enable background alerts"}
            </Button>
          )}

          <label className="flex items-center justify-between cursor-pointer select-none gap-2">
            <span className="text-xs text-foreground">Daily punch-in/out reminders</span>
            <input
              type="checkbox"
              checked={remindersEnabled}
              onChange={(e) => void handleRemindersToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-7 h-4 shrink-0 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[3px] after:left-[3px] peer-checked:after:translate-x-[12px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 after:transition-all" />
          </label>

          {mounted && isPunchAlertAdmin && (
            <label className="flex items-center justify-between cursor-pointer select-none gap-2">
              <span className="text-xs text-foreground">Employee punch in/out alerts</span>
              <input
                type="checkbox"
                checked={adminAlertsEnabled}
                onChange={(e) => void handleAdminAlertsToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-7 h-4 shrink-0 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[3px] after:left-[3px] peer-checked:after:translate-x-[12px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 after:transition-all" />
            </label>
          )}
        </div>

        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {history.length === 0 ? (
            <li className="rounded-lg px-2 py-3 text-xs text-muted-foreground text-center">
              No notifications yet. Enable reminders above and allow browser permission.
            </li>
          ) : (
            history.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block rounded-lg px-2 py-2 hover:bg-muted"
                    onClick={() => setOpen(false)}
                  >
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.body}</p>
                    <p className="text-[10px] text-muted-foreground/80 mt-1">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </Link>
                ) : (
                  <div className="rounded-lg px-2 py-2">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.body}</p>
                    <p className="text-[10px] text-muted-foreground/80 mt-1">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
