"use client";

import { ChevronDown, CircleHelp, LogOut, Lock, UserRound } from "lucide-react";
import { useState, useEffect } from "react";

import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { logout } from "@/lib/api/auth";
import { clearAuthSession } from "@/lib/auth-cookie";
import { unsubscribeFromWebPush } from "@/lib/notifications/push-subscription";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const profileActions = [
  { label: "My Profile", icon: UserRound },
  { label: "Change Password", icon: Lock },
  { label: "User Guide", icon: CircleHelp },
  { label: "Logout", icon: LogOut },
];

export function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState("Admin");

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("auth_user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user && user.name) {
          setUserName(user.name);
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }, []);

  const router = useRouter();

  const handleAction = async (label: string) => {
    if (label === "My Profile") {
      router.push("/employee-profile");
    } else if (label === "Change Password") {
      router.push("/change-password");
    } else if (label === "User Guide") {
      router.push("/user-guidance");
    } else if (label === "Logout") {
      setOpen(false);
      const token = Cookies.get("auth_token") ?? "";
      // Best-effort server cleanup with a hard timeout so iOS Safari cannot
      // hang forever on serviceWorker.ready / stalled fetch.
      if (token) {
        try {
          await Promise.race([
            (async () => {
              await unsubscribeFromWebPush(token);
              await logout(token);
            })(),
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 2000);
            }),
          ]);
        } catch {
          // ignore — local session clear below always runs
        }
      }
      // Hard redirect clears middleware + client state (router.push can keep session on iOS).
      clearAuthSession({ redirectToLogin: true });
      return;
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        className="h-9 gap-1.5 px-2 sm:px-3"
        onClick={() => setOpen((prev) => !prev)}
        variant="ghost"
      >
        <span className="hidden text-sm md:inline">{userName}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>
      <div
        className={cn(
          "absolute right-0 z-40 mt-2 w-56 rounded-xl border border-border bg-popover p-2 shadow-lg transition-all",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        )}
        role="menu"
      >
        {profileActions.map((item) => (
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            key={item.label}
            role="menuitem"
            suppressHydrationWarning
            type="button"
            onClick={() => handleAction(item.label)}
          >
            <item.icon className="h-4 w-4 text-muted-foreground" />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
