"use client";

import { useEffect, useRef } from "react";
import Cookies from "js-cookie";

import { fetchAuthMeCached } from "@/lib/auth-me-cache";
import {
  isEmployeeSession,
  isPunchAlertAdminSession,
  readAuthUser,
  type AuthUser,
} from "@/lib/auth-session";
import { checkSuperAdminPunchAlerts } from "@/lib/notifications/admin-punch-alerts";
import {
  checkEmployeeAttendanceReminder,
  disposeAttendanceReminderBroadcast,
} from "@/lib/notifications/attendance-reminders";
import {
  isNotificationSupported,
  NOTIFICATION_PERMISSION_GRANTED_EVENT,
} from "@/lib/notifications/app-notifications";
import {
  ADMIN_PUNCH_POLL_INTERVAL_MS,
  NOTIFICATION_CHECK_INTERVAL_MS,
} from "@/lib/notifications/constants";
import { canUseWebPushOnThisDevice, subscribeToWebPush } from "@/lib/notifications/push-subscription";

function mergeAuthUser(cached: AuthUser | null, me: Awaited<ReturnType<typeof fetchAuthMeCached>>): AuthUser | null {
  if (!cached && !me) return null;
  const base = { ...(cached ?? {}) } as AuthUser;
  if (me?.role) base.role = me.role;
  if (me?.is_admin !== undefined) base.is_admin = me.is_admin;
  if (me?.is_super_admin !== undefined) base.is_super_admin = me.is_super_admin;
  return base;
}

/**
 * Runs attendance reminders (employees) and punch alerts (admins) while logged in.
 */
export function NotificationManager() {
  const roleRef = useRef<"employee" | "admin" | "other">("other");
  const pushRegisteredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let adminIntervalId: ReturnType<typeof setInterval> | null = null;

    const resolveRole = async (): Promise<"employee" | "admin" | "other"> => {
      const cached = readAuthUser();
      if (isPunchAlertAdminSession(cached)) return "admin";
      if (isEmployeeSession(cached)) return "employee";

      const token = Cookies.get("auth_token");
      if (!token) return "other";

      try {
        const me = await fetchAuthMeCached(token);
        const user = mergeAuthUser(cached, me);
        if (isPunchAlertAdminSession(user)) return "admin";
        if (isEmployeeSession(user)) return "employee";
      } catch {
        // keep cached role
      }
      return "other";
    };

    const maybeRegisterPush = async (token: string, forceRefresh = false) => {
      // Subscribe for every logged-in user with permission so leave/salary/punch
      // pushes work in the background on iOS PWA, Android, and desktop — even if
      // in-app reminder toggles are off.
      if (
        (!forceRefresh && pushRegisteredRef.current) ||
        cancelled ||
        !token ||
        !isNotificationSupported() ||
        Notification.permission !== "granted" ||
        !canUseWebPushOnThisDevice()
      ) {
        return;
      }
      const ok = await subscribeToWebPush(token, { forceRefresh });
      if (ok) pushRegisteredRef.current = true;
    };

    const runChecks = async () => {
      const token = Cookies.get("auth_token");
      if (!token || cancelled) return;

      const role = await resolveRole();
      roleRef.current = role;

      if (role === "employee") {
        await checkEmployeeAttendanceReminder(token);
      } else if (role === "admin") {
        await checkSuperAdminPunchAlerts(token);
      }

      await maybeRegisterPush(token);
    };

    const startAdminFastPoll = () => {
      if (adminIntervalId) return;
      adminIntervalId = setInterval(() => {
        if (roleRef.current !== "admin") return;
        const token = Cookies.get("auth_token");
        if (token) void checkSuperAdminPunchAlerts(token);
      }, ADMIN_PUNCH_POLL_INTERVAL_MS);
    };

    const stopAdminFastPoll = () => {
      if (adminIntervalId) {
        clearInterval(adminIntervalId);
        adminIntervalId = null;
      }
    };

    void resolveRole().then((role) => {
      roleRef.current = role;
      if (role === "admin") startAdminFastPoll();
    });

    void runChecks();
    intervalId = setInterval(runChecks, NOTIFICATION_CHECK_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void runChecks();
      }
    };

    const onFocus = () => {
      void runChecks();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener(NOTIFICATION_PERMISSION_GRANTED_EVENT, onFocus);

    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type !== "PUSH_SUBSCRIPTION_CHANGED") return;
      pushRegisteredRef.current = false;
      const token = Cookies.get("auth_token");
      if (token) void maybeRegisterPush(token, true);
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    // After a service worker update, Android/Chrome may invalidate the old FCM
    // endpoint — refresh so closed-app delivery keeps working.
    const onControllerChange = () => {
      pushRegisteredRef.current = false;
      const token = Cookies.get("auth_token");
      if (token) void maybeRegisterPush(token, true);
    };
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      stopAdminFastPoll();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(NOTIFICATION_PERMISSION_GRANTED_EVENT, onFocus);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
      disposeAttendanceReminderBroadcast();
    };
  }, []);

  return null;
}
