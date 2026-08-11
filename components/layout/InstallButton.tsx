"use client";

import { useEffect, useState } from "react";
import { MonitorDown, Share, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { isStandalonePwa } from "@/lib/notifications/app-notifications";
import { detectPushPlatform } from "@/lib/notifications/push-subscription";
import { usePWAInstall } from "@/lib/use-pwa-install";

/**
 * Shows Install App for Chromium (beforeinstallprompt) and iOS Home Screen
 * instructions — required for background Web Push on iPhone/iPad.
 */
export function InstallButton() {
  const { isInstallable, install } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);

  useEffect(() => {
    if (isStandalonePwa()) {
      setIsIosSafari(false);
      return;
    }
    setIsIosSafari(detectPushPlatform() === "ios");
  }, []);

  if (isStandalonePwa()) return null;

  if (isInstallable) {
    return (
      <Button
        onClick={() => void install()}
        size="sm"
        variant="outline"
        className="inline-flex h-9 items-center gap-1.5 border-primary/20 bg-primary/5 px-2.5 font-bold text-primary hover:bg-primary/10 rounded-xl transition-all shadow-sm"
        title="Install HRMS App"
        type="button"
      >
        <MonitorDown className="h-4 w-4" />
        Install App
      </Button>
    );
  }

  if (!isIosSafari) return null;

  return (
    <>
      <Button
        onClick={() => setShowIosGuide(true)}
        size="sm"
        variant="outline"
        className="inline-flex h-9 items-center gap-1.5 border-primary/20 bg-primary/5 px-2.5 font-bold text-primary hover:bg-primary/10 rounded-xl transition-all shadow-sm"
        title="Add to Home Screen for notifications"
        type="button"
      >
        <Share className="h-4 w-4" />
        Install
      </Button>

      {showIosGuide ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-foreground">Install on iPhone / iPad</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Background notifications only work after you add this app to your Home Screen and
                  open it from there.
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                type="button"
                aria-label="Close"
                onClick={() => setShowIosGuide(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ol className="space-y-2 text-sm text-foreground">
              <li>1. Tap the Share button in Safari.</li>
              <li>2. Choose Add to Home Screen.</li>
              <li>3. Open the app from your Home Screen.</li>
              <li>4. Allow notifications when prompted.</li>
            </ol>
            <Button
              className="mt-4 w-full rounded-xl"
              type="button"
              onClick={() => {
                setShowIosGuide(false);
                toast.message("After installing, open the Home Screen app and allow notifications.");
              }}
            >
              Got it
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
