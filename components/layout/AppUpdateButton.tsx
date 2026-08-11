"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/lib/pwa-update";

/**
 * Header refresh control for installed PWAs (desktop, Android, iOS) where
 * there is no browser reload button. Clicking checks for a new build,
 * clears all caches, and reloads to the latest version.
 * Also shows a persistent toast when a new deployment is detected.
 */
export function AppUpdateButton() {
  const { updateAvailable, checkNow, applyUpdate } = useAppUpdate();
  const [busy, setBusy] = useState(false);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!updateAvailable || notifiedRef.current) return;
    notifiedRef.current = true;
    toast.info("A new version of the app is available.", {
      id: "app-update-available",
      duration: Infinity,
      action: {
        label: "Update now",
        onClick: () => void applyUpdate(),
      },
    });
  }, [updateAvailable, applyUpdate]);

  const handleRefresh = async () => {
    if (busy) return;
    setBusy(true);
    toast.loading("Updating app — clearing caches…", { id: "app-hard-refresh" });
    try {
      await checkNow();
      await applyUpdate();
    } catch {
      toast.error("Could not refresh. Please close and reopen the app.", {
        id: "app-hard-refresh",
      });
      setBusy(false);
    }
  };

  return (
    <Button
      aria-label="Refresh app to latest version"
      title="Refresh app (clears caches & loads the latest version)"
      onClick={() => void handleRefresh()}
      size="icon"
      variant="ghost"
      className="relative"
      type="button"
    >
      <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      {updateAvailable ? (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
      ) : null}
    </Button>
  );
}
