"use client";

import { Info, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  editEmployeeMonthlyAttendance,
  type BulkAttendanceStatus,
  type EmployeeMonthlyEditApplyScope,
  type EmployeeMonthlyEditErrorItem,
  type EmployeeMonthlyEditPayload,
  type AttendanceApiError,
} from "@/lib/api/attendance";
import { normalizeShiftTimeToInput } from "@/lib/attendance/shift-punch-times";
import { cn } from "@/lib/utils";
import type { EmployeeRecord } from "@/lib/api/employee";

const STATUS_OPTIONS: Array<{
  value: BulkAttendanceStatus;
  label: string;
  badgeClass: string;
}> = [
  { value: "present", label: "Present", badgeClass: "bg-emerald-500 text-white" },
  { value: "absent", label: "Absent", badgeClass: "bg-red-500 text-white" },
  { value: "half_day", label: "Half Day", badgeClass: "bg-violet-500 text-white" },
  { value: "late", label: "Late", badgeClass: "bg-orange-500 text-white" },
  { value: "week_off", label: "Week Off", badgeClass: "bg-slate-400 text-white" },
  { value: "on_leave", label: "On Leave", badgeClass: "bg-sky-600 text-white" },
  { value: "holiday", label: "Holiday", badgeClass: "bg-purple-600 text-white" },
];

const PUNCH_VISIBLE_STATUSES = new Set<BulkAttendanceStatus>(["present", "late", "half_day", "week_off"]);

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type EmployeeMonthlyEditModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onRefresh?: () => void;
  token: string;
  year: number;
  month: number;
  employee: EmployeeRecord | null;
};

function ymKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function isMonthEditable(year: number, month: number): boolean {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  if (year > currentYear) return false;
  if (year === currentYear && month > currentMonth) return false;
  return true;
}

function toApiPunchTime(time: string): string {
  const normalized = normalizeShiftTimeToInput(time);
  return normalized ? `${normalized}:00` : "";
}

function empDisplayName(e: EmployeeRecord) {
  return (
    e.full_name?.trim() ||
    e.name?.trim() ||
    [e.first_name, e.last_name].filter(Boolean).join(" ").trim() ||
    "—"
  );
}

export function EmployeeMonthlyEditModal({
  open,
  onClose,
  onSuccess,
  onRefresh,
  token,
  year,
  month,
  employee,
}: EmployeeMonthlyEditModalProps) {
  const [status, setStatus] = useState<BulkAttendanceStatus>("present");
  const [punchIn, setPunchIn] = useState("");
  const [punchOut, setPunchOut] = useState("");
  const [applyScope, setApplyScope] = useState<EmployeeMonthlyEditApplyScope>("working_days");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [partialErrors, setPartialErrors] = useState<EmployeeMonthlyEditErrorItem[]>([]);

  const monthKey = useMemo(() => ymKey(year, month), [year, month]);
  const monthLabel = useMemo(
    () => `${MONTH_LABELS[month - 1]} ${year}`,
    [year, month],
  );
  const monthEditable = useMemo(() => isMonthEditable(year, month), [year, month]);
  const showPunchFields = PUNCH_VISIBLE_STATUSES.has(status);

  useEffect(() => {
    if (!open) return;
    setStatus("present");
    setPunchIn("");
    setPunchOut("");
    setApplyScope("working_days");
    setOverrideReason("");
    setFieldErrors({});
    setPartialErrors([]);
  }, [open, employee?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    if (!monthEditable) {
      toast.error("Future months cannot be edited.");
      return;
    }
    if (overrideReason.trim().length < 3) {
      toast.error("Override reason must be at least 3 characters.");
      return;
    }

    const punchInApi = punchIn.trim() ? toApiPunchTime(punchIn) : undefined;
    const punchOutApi = punchOut.trim() ? toApiPunchTime(punchOut) : undefined;

    if (showPunchFields && (punchInApi || punchOutApi) && !(punchInApi && punchOutApi)) {
      toast.error("Provide both punch in and punch out times, or leave both empty.");
      return;
    }

    const payload: EmployeeMonthlyEditPayload = {
      employee_id: employee.id,
      month: monthKey,
      status,
      manual_override_reason: overrideReason.trim(),
      apply_scope: applyScope,
    };

    if (showPunchFields && punchInApi && punchOutApi) {
      payload.punch_in_time = punchInApi;
      payload.punch_out_time = punchOutApi;
    }

    setSubmitting(true);
    setFieldErrors({});
    setPartialErrors([]);

    try {
      const result = await editEmployeeMonthlyAttendance(token, payload);
      const errors = result.data?.errors ?? [];

      if (errors.length > 0) {
        setPartialErrors(errors);
        toast.warning(result.message || "Monthly edit completed with some errors.");
        onRefresh?.();
      } else {
        toast.success(result.message || "Monthly attendance updated successfully.");
        onSuccess();
        onClose();
      }
    } catch (err) {
      const apiErr = err as AttendanceApiError;
      if (apiErr.fieldErrors) {
        setFieldErrors(apiErr.fieldErrors);
      }
      toast.error(apiErr.message || "Failed to update monthly attendance.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !employee) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Edit Month Attendance</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Apply one status across the month for{" "}
              <strong className="text-foreground">{empDisplayName(employee)}</strong>
              {employee.employee_code ? ` (${employee.employee_code})` : ""}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="space-y-1.5 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Month</span>
            <input
              type="text"
              value={monthLabel}
              readOnly
              className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground outline-none"
            />
            {!monthEditable ? (
              <span className="text-xs text-destructive">Future months cannot be edited.</span>
            ) : null}
            {fieldErrors.month?.[0] ? (
              <span className="text-xs text-destructive">{fieldErrors.month[0]}</span>
            ) : null}
          </label>

          <label className="space-y-1.5 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BulkAttendanceStatus)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {STATUS_OPTIONS.map((option) => (
                <span
                  key={option.value}
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    option.badgeClass,
                    status === option.value && "ring-2 ring-primary ring-offset-1",
                  )}
                >
                  {option.label}
                </span>
              ))}
            </div>
          </label>

          {showPunchFields ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Punch In (optional)
                </span>
                <input
                  type="time"
                  value={punchIn}
                  onChange={(e) => setPunchIn(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="space-y-1.5 flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Punch Out (optional)
                </span>
                <input
                  type="time"
                  value={punchOut}
                  onChange={(e) => setPunchOut(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Punch times will be cleared for this status.</p>
          )}

          <label className="space-y-1.5 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Apply Scope</span>
            <select
              value={applyScope}
              onChange={(e) => setApplyScope(e.target.value as EmployeeMonthlyEditApplyScope)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="working_days">Working days only (skip week-off &amp; holiday)</option>
              <option value="all_elapsed_days">All elapsed days in month</option>
            </select>
          </label>

          <label className="space-y-1.5 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Override Reason <span className="text-destructive">*</span>
            </span>
            <Textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={2}
              placeholder="Reason for monthly manual override (audit trail)"
              required
            />
            {fieldErrors.manual_override_reason?.[0] ? (
              <span className="text-xs text-destructive">{fieldErrors.manual_override_reason[0]}</span>
            ) : null}
          </label>

          <div className="rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/30 p-3 text-xs text-sky-900 dark:text-sky-200 flex gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Leave punch times empty to use each day&apos;s shift timing. Only elapsed days (not future) are updated.</p>
          </div>

          {partialErrors.length > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs space-y-2">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Some days could not be updated:
              </p>
              <ul className="max-h-32 overflow-y-auto space-y-1 text-amber-800 dark:text-amber-300">
                {partialErrors.map((item, index) => (
                  <li key={`${item.attendance_date ?? item.date ?? index}-${item.message}`}>
                    {item.attendance_date ?? item.date ? `${item.attendance_date ?? item.date}: ` : ""}
                    {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              {partialErrors.length > 0 ? "Close" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={submitting || !monthEditable || overrideReason.trim().length < 3}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating attendance…
                </>
              ) : (
                "Apply to Month"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
