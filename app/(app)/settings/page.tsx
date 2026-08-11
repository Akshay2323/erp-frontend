"use client";

import { Settings } from "lucide-react";
import { useMemo } from "react";

import { AccentThemePicker } from "@/components/accent-theme-picker";
import { OvertimeSettingsSection } from "@/components/settings/OvertimeSettingsSection";
import { useAuthToken } from "@/lib/use-auth-token";

export default function SettingsPage() {
  const token = useAuthToken();
  const ready = useMemo(() => Boolean(token), [token]);

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure organization rules for payroll, attendance, and overtime.
          </p>
        </div>
      </div>

      <AccentThemePicker variant="panel" />

      {ready && token ? (
        <OvertimeSettingsSection token={token} />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Sign in to manage settings.
        </div>
      )}
    </section>
  );
}
