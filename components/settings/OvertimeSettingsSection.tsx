"use client";

import { CheckCircle2, Clock, Info, Loader2, Save, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_OVERTIME_SETTINGS,
  getOvertimeSettings,
  saveOvertimeSettings,
  type OvertimeCountingType,
  type OvertimeSettings,
  type OvertimeSettingsApiError,
  type OvertimeWorkingType,
} from "@/lib/api/overtime-settings";
import { cn } from "@/lib/utils";

type OptionCardProps<T extends string> = {
  value: T;
  selected: T;
  title: string;
  description: string;
  onSelect: (value: T) => void;
};

function OptionCard<T extends string>({
  value,
  selected,
  title,
  description,
  onSelect,
}: OptionCardProps<T>) {
  const active = selected === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-all",
        active
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
          )}
        >
          {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
        </span>
      </div>
    </button>
  );
}

const COUNTING_OPTIONS: Array<{
  value: OvertimeCountingType;
  title: string;
  description: string;
}> = [
  {
    value: "monthly_days",
    title: "Monthly Days Counting",
    description:
      "In-scope days are all elapsed calendar days in the month (1st through today for the current month; full month for past months). Week-offs and holidays count toward the total. Present days include Present, Half Day, Week Off, Holiday, and Leave. Only explicit Absent days count against eligibility.",
  },
  {
    value: "working_days",
    title: "Working Days Counting",
    description:
      "Count only scheduled working days in the month. Week-offs and company holidays are excluded from the in-scope total.",
  },
];

const WORKING_OPTIONS: Array<{
  value: OvertimeWorkingType;
  title: string;
  description: string;
}> = [
  {
    value: "all_days_present",
    title: "Must Be Present on All Days",
    description:
      "Overtime is blocked if the employee is absent on any in-scope day in the month.",
  },
  {
    value: "minimum_days",
    title: "Minimum Days Present",
    description:
      "Overtime is blocked when present days are below the minimum threshold. Present days must meet or exceed the configured count.",
  },
  {
    value: "allowed_anyway",
    title: "Allowed Anyway",
    description:
      "Attendance does not block overtime. Payroll admin can still enable or disable OT per employee in Run Payroll.",
  },
];

type OvertimeSettingsSectionProps = {
  token: string;
};

export function OvertimeSettingsSection({ token }: OvertimeSettingsSectionProps) {
  const [settings, setSettings] = useState<OvertimeSettings>(DEFAULT_OVERTIME_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    setLoadError(null);
    try {
      const data = await getOvertimeSettings(token);
      setSettings(data);
      setDirty(false);
      setFieldErrors({});
    } catch (err) {
      const apiErr = err as OvertimeSettingsApiError;
      if (apiErr.status === 403) {
        setForbidden(true);
        return;
      }
      const message = apiErr.message || "Unable to load overtime settings.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateSettings = <K extends keyof OvertimeSettings>(key: K, value: OvertimeSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "overtime_working_type" && value !== "minimum_days") {
        next.minimum_present_days = null;
      }
      if (key === "overtime_working_type" && value === "minimum_days" && next.minimum_present_days == null) {
        next.minimum_present_days = DEFAULT_OVERTIME_SETTINGS.minimum_present_days;
      }
      return next;
    });
    setDirty(true);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[String(key)];
      return next;
    });
  };

  const howItWorks = useMemo(() => {
    const countingNote =
      settings.overtime_counting_type === "monthly_days"
        ? "In-scope days are all elapsed calendar days in the month (not excluding week-offs or holidays). Present/satisfied days include Present, Half Day, Week Off, Holiday, and Leave. Only explicit Absent days reduce eligibility. Days before an employee's joining date are excluded in payroll calculations."
        : "In-scope days are scheduled working days only — week-offs and holidays are excluded from the total.";

    const eligibilityNote =
      settings.overtime_working_type === "all_days_present"
        ? "Overtime is blocked if any in-scope day is marked absent."
        : settings.overtime_working_type === "minimum_days"
          ? `Overtime is blocked when present days (${settings.minimum_present_days ?? "—"} required) are not met for the month.`
          : "Attendance does not block overtime. The OT Allowed toggle in Run Payroll still applies per employee.";

    const exampleNote =
      settings.overtime_counting_type === "monthly_days"
        ? `Example: With Monthly Days Counting and Minimum Days Present = ${settings.minimum_present_days ?? 22}, an employee with 12 present/satisfied days out of 13 in-scope days is blocked until they reach the minimum.`
        : `Example: With Working Days Counting and Minimum Days Present = ${settings.minimum_present_days ?? 22}, an employee with 21 present working days will not receive overtime pay even if they worked extra hours on some days.`;

    return { countingNote, eligibilityNote, exampleNote };
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setFieldErrors({});
    try {
      const result = await saveOvertimeSettings(token, settings);
      setSettings(result.settings);
      setDirty(false);
      toast.success(result.message);
    } catch (err) {
      const apiErr = err as OvertimeSettingsApiError;
      if (apiErr.fieldErrors) {
        setFieldErrors(apiErr.fieldErrors);
      }
      toast.error(apiErr.message || "Unable to save overtime settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border border-border shadow-sm">
        <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading overtime settings…
        </CardContent>
      </Card>
    );
  }

  if (forbidden) {
    return (
      <Card className="rounded-2xl border border-border shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Access restricted</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Overtime settings can be viewed and updated only by Company Admin, HR, or Group Admin.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="rounded-2xl border border-border shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="border-b border-border/60 pb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Overtime Settings</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Control how overtime eligibility is evaluated before payroll. These rules apply organization-wide
              when calculating overtime in Run Payroll.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8 pt-6">
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Overtime Counting Type</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose which days are used as the base when checking monthly attendance for overtime.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {COUNTING_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                value={option.value}
                selected={settings.overtime_counting_type}
                title={option.title}
                description={option.description}
                onSelect={(value) => updateSettings("overtime_counting_type", value)}
              />
            ))}
          </div>
          {fieldErrors.overtime_counting_type?.[0] ? (
            <p className="text-xs text-destructive">{fieldErrors.overtime_counting_type[0]}</p>
          ) : null}
        </section>

        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Overtime Eligibility Rule</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Decide whether monthly attendance must be satisfied before overtime amount is included in payroll.
            </p>
          </div>
          <div className="grid gap-3">
            {WORKING_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                value={option.value}
                selected={settings.overtime_working_type}
                title={option.title}
                description={option.description}
                onSelect={(value) => updateSettings("overtime_working_type", value)}
              />
            ))}
          </div>
          {fieldErrors.overtime_working_type?.[0] ? (
            <p className="text-xs text-destructive">{fieldErrors.overtime_working_type[0]}</p>
          ) : null}
        </section>

        {settings.overtime_working_type === "minimum_days" ? (
          <section className="rounded-xl border border-border bg-muted/20 p-4">
            <Label htmlFor="minimum-present-days" className="text-sm font-semibold">
              Minimum Present Days Required
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Employee must be marked present on at least this many in-scope days to qualify for overtime pay.
            </p>
            <Input
              id="minimum-present-days"
              type="number"
              min={1}
              max={31}
              className="mt-3 max-w-[200px]"
              value={settings.minimum_present_days ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                updateSettings("minimum_present_days", raw === "" ? null : Number(raw));
              }}
            />
            {fieldErrors.minimum_present_days?.[0] ? (
              <p className="mt-2 text-xs text-destructive">{fieldErrors.minimum_present_days[0]}</p>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-xl border border-border bg-muted/20 p-4">
          <Label htmlFor="rate-multiplier" className="text-sm font-semibold">
            Overtime Rate Multiplier (for all employees)
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Applies to all employees for overtime pay unless an employee has a personal Penalty &amp; Overtime
            override. Use values like 1.5 or 2.0.
          </p>
          <Input
            id="rate-multiplier"
            type="number"
            min={0.01}
            max={10}
            step={0.01}
            className="mt-3 max-w-[200px]"
            value={settings.rate_multiplier}
            onChange={(e) => {
              const raw = e.target.value;
              updateSettings("rate_multiplier", raw === "" ? DEFAULT_OVERTIME_SETTINGS.rate_multiplier : Number(raw));
            }}
          />
          {fieldErrors.rate_multiplier?.[0] ? (
            <p className="mt-2 text-xs text-destructive">{fieldErrors.rate_multiplier[0]}</p>
          ) : null}
        </section>

        <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" />
            <div className="space-y-3 text-sm text-sky-950 dark:text-sky-100">
              <p className="font-semibold">How it works</p>
              <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-sky-900/90 dark:text-sky-200/90">
                <li>
                  <strong>Step 1 — Counting base:</strong> {howItWorks.countingNote}
                </li>
                <li>
                  <strong>Step 2 — Eligibility check:</strong> {howItWorks.eligibilityNote}
                </li>
                <li>
                  <strong>Step 3 — Overtime pay rate:</strong> Eligible overtime hours are multiplied by{" "}
                  {settings.rate_multiplier}× the hourly rate (unless an employee has a personal override).
                </li>
                <li>
                  <strong>Step 4 — Overtime hours:</strong> Eligible days use actual punch times and shift rules to
                  calculate overtime hours (extra time beyond shift end or configured threshold).
                </li>
                <li>
                  <strong>Step 5 — Run Payroll:</strong> If eligible, overtime amount appears in Run Payroll.
                  Admins can still enable or disable OT per employee using the OT Allowed toggle.
                </li>
                <li>
                  <strong>Future dates:</strong> Only elapsed days in the selected payroll month are considered;
                  future days are ignored until they occur.
                </li>
              </ul>
              <p className="text-xs text-sky-800/80 dark:text-sky-300/80">{howItWorks.exampleNote}</p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-4">
          {dirty ? (
            <span className="text-xs text-muted-foreground">You have unsaved changes</span>
          ) : (
            <span className="text-xs text-muted-foreground">All changes saved</span>
          )}
          <Button type="button" onClick={() => void handleSave()} disabled={saving || !dirty}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Overtime Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
