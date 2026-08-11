"use client";

import { Bell } from "lucide-react";
import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  isNotificationSupported,
  isStandalonePwa,
  requestNotificationPermission,
} from "@/lib/notifications/app-notifications";
import { NOTIFICATION_SESSION } from "@/lib/notifications/constants";
import {
  canUseWebPushOnThisDevice,
  detectPushPlatform,
  subscribeToWebPush,
} from "@/lib/notifications/push-subscription";
import { isPunchAlertAdminSession, readAuthUser } from "@/lib/auth-session";

/**
 * One-time prompt for admins to allow browser notifications for punch alerts,
 * then register Web Push so alerts arrive when the app is closed.
 */
export function AdminPunchPermissionPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isNotificationSupported()) return;
    if (Notification.permission !== "default") return;

    try {
      if (sessionStorage.getItem(NOTIFICATION_SESSION.ADMIN_PERMISSION_PROMPTED) === "1") {
        return;
      }
    } catch {
      return;
    }

    if (!isPunchAlertAdminSession(readAuthUser())) return;
    setVisible(true);
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(NOTIFICATION_SESSION.ADMIN_PERMISSION_PROMPTED, "1");
    } catch {}
    setVisible(false);
  };

  const enable = async () => {
    const result = await requestNotificationPermission();
    dismiss();
    if (result === "granted") {
      const token = Cookies.get("auth_token");
      if (token && canUseWebPushOnThisDevice()) {
        await subscribeToWebPush(token);
      }
      toast.success(
        canUseWebPushOnThisDevice()
          ? "Alerts enabled — you will get notifications even when the app is closed."
          : "Punch alerts enabled for this browser.",
      );
    } else if (result === "denied") {
      toast.error("Notifications blocked. Enable them in your browser site settings.");
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-lg sm:left-auto sm:right-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Enable punch alerts</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Allow notifications to get instant alerts when employees punch in or out — including
            when this app is closed (Android, desktop, and iOS installed PWA).
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={dismiss}>
          Later
        </Button>
        <Button size="sm" onClick={() => void enable()}>
          Allow notifications
        </Button>
      </div>
    </div>
  );
}

/**
 * Prompt for any logged-in user (employees included) to enable Web Push so
 * leave/salary/reminder notifications work with the app closed.
 * Skips admins (handled by AdminPunchPermissionPrompt) and iOS Safari until
 * the Home Screen PWA is opened.
 */
export function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  useEffect(() => {
    if (!Cookies.get("auth_token")) return;
    if (!isNotificationSupported()) return;

    try {
      if (sessionStorage.getItem(NOTIFICATION_SESSION.PUSH_PERMISSION_PROMPTED) === "1") {
        return;
      }
    } catch {
      return;
    }

    // Admin prompt owns that flow.
    if (isPunchAlertAdminSession(readAuthUser())) return;

    const ios = detectPushPlatform() === "ios";
    if (ios && !isStandalonePwa()) {
      setIosNeedsInstall(true);
      setVisible(true);
      return;
    }

    if (Notification.permission !== "default") return;
    if (!canUseWebPushOnThisDevice()) return;

    setVisible(true);
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(NOTIFICATION_SESSION.PUSH_PERMISSION_PROMPTED, "1");
    } catch {}
    setVisible(false);
  };

  const enable = async () => {
    if (iosNeedsInstall) {
      dismiss();
      toast.message("Add to Home Screen first, then open the app and allow notifications.");
      return;
    }

    const result = await requestNotificationPermission();
    dismiss();
    if (result === "granted") {
      const token = Cookies.get("auth_token");
      if (token) await subscribeToWebPush(token);
      toast.success("Notifications enabled — alerts can arrive when the app is closed.");
    } else if (result === "denied") {
      toast.error("Notifications blocked. Enable them in your browser site settings.");
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-lg sm:left-auto sm:right-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {iosNeedsInstall ? "Install app for alerts" : "Enable notifications"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {iosNeedsInstall
              ? "On iPhone/iPad, tap Share → Add to Home Screen, open the installed app, then allow notifications. Background alerts only work in the installed PWA."
              : "Allow notifications for punch reminders and updates — including when this app is closed."}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={dismiss}>
          Later
        </Button>
        <Button size="sm" onClick={() => void enable()}>
          {iosNeedsInstall ? "Got it" : "Allow notifications"}
        </Button>
      </div>
    </div>
  );
}
