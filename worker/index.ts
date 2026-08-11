/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

function isIosServiceWorker(): boolean {
  const ua = self.navigator?.userAgent ?? "";
  return /iPad|iPhone|iPod/i.test(ua);
}

/**
 * Prefetch a remote profile thumb into a same-origin blob URL so notification
 * icon/image rendering is reliable across Android Chrome (and any iOS builds
 * that accept a custom icon). Falls back to null on network/CORS failure.
 */
async function resolveNotificationPhoto(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      cache: "force-cache",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") || blob.size < 32 || blob.size > 512_000) {
      return null;
    }
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Show punch / admin alerts. Prefer the employee profile thumbnail as the
 * notification icon (and Android large image). Fall back to the app icon if
 * the remote photo fails — never skip showNotification.
 */
self.addEventListener("push", (event: PushEvent) => {
  event.waitUntil(
    (async () => {
      let payload: {
        title?: string;
        body?: string;
        tag?: string;
        url?: string;
        icon?: string;
        badge?: string;
        image?: string | null;
        kind?: string;
        event_name?: string;
        employee_name?: string;
        employee_id?: number;
        profile_photo_url?: string | null;
        attendance_log_id?: number;
      } = {};

      try {
        payload = event.data?.json() ?? {};
      } catch {
        payload = { body: event.data?.text() ?? "" };
      }

      const employeeName = payload.employee_name?.trim() || "";
      const eventName = payload.event_name?.trim() || "";
      const title =
        payload.title ||
        (employeeName && eventName
          ? `${employeeName} — ${eventName}`
          : eventName || employeeName || "Jwork");
      const body = payload.body || (eventName ? `${eventName} notification` : "New notification");
      const localIcon = "/icon-192x192.png";
      const photoUrl =
        (payload.profile_photo_url || payload.image || payload.icon || "").trim() || null;
      // Only use remote HTTPS photo URLs — never treat the app icon path as a photo.
      const remotePhotoUrl =
        photoUrl &&
        /^https?:\/\//i.test(photoUrl) &&
        !/\/icon-192x192\.png(?:\?|$)/i.test(photoUrl)
          ? photoUrl
          : null;

      // Prefer a blob URL (same-origin) so the OS can paint the icon reliably.
      // If prefetch fails, still try the HTTPS thumb URL directly.
      const blobPhoto = await resolveNotificationPhoto(remotePhotoUrl);
      const photoIcon = blobPhoto || remotePhotoUrl;

      const data = {
        url: payload.url || "/live-attendance",
        kind: payload.kind,
        eventName,
        employeeName,
        employeeId: payload.employee_id,
        attendanceLogId: payload.attendance_log_id,
      };

      const ios = isIosServiceWorker();
      const options: NotificationOptions & {
        image?: string;
        renotify?: boolean;
        vibrate?: number[];
      } = {
        body,
        // Android shows custom icons well; iOS PWA often still shows the app
        // icon — that is an OS limitation, not a payload bug.
        icon: photoIcon || localIcon,
        badge: localIcon,
        tag: payload.tag || `jwork-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        data,
        renotify: true,
        vibrate: [120, 60, 120],
      };

      // Large preview image is Chromium/Android only.
      if (!ios && photoIcon) {
        options.image = photoIcon;
      }

      try {
        await self.registration.showNotification(title, options);
      } catch (error) {
        console.error("showNotification with photo failed, retrying app icon", error);
        await self.registration.showNotification(title, {
          body,
          icon: localIcon,
          badge: localIcon,
          data,
        });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data?.url as string | undefined) || "/employee-dashboard";
  const absoluteTarget = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            const windowClient = client as WindowClient;
            if ("navigate" in windowClient) {
              try {
                await windowClient.navigate(absoluteTarget);
              } catch {
                // Some browsers reject navigate; focusing is still useful.
              }
            }
            return windowClient.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(absoluteTarget);
        }
        return undefined;
      }),
  );
});

self.addEventListener("pushsubscriptionchange", (event: Event) => {
  const changeEvent = event as ExtendableEvent & {
    oldSubscription?: PushSubscription | null;
    newSubscription?: PushSubscription | null;
  };

  changeEvent.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({
          type: "PUSH_SUBSCRIPTION_CHANGED",
          oldEndpoint: changeEvent.oldSubscription?.endpoint ?? null,
          newEndpoint: changeEvent.newSubscription?.endpoint ?? null,
        });
      }
    })(),
  );
});

export {};
