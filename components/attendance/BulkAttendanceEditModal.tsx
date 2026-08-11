"use client";

import { Info, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  bulkEditAdminAttendance,
  type BulkAttendanceEditPayload,
  type BulkAttendanceEditErrorItem,
  type BulkAttendanceStatus,
  type AttendanceApiError,
} from "@/lib/api/attendance";
import { normalizeShiftTimeToInput } from "@/lib/attendance/shift-punch-times";
import { cn } from "@/lib/utils";

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
const PUNCH_REQUIRED_STATUSES = new Set<BulkAttendanceStatus>(["present", "late", "half_day"]);

type BulkAttendanceEditModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onRefresh?: () => void;
  token: string;
  year: number;
  month: number;
  initialDay?: number;
  selectedEmployeeIds: number[];
  totalFilteredEmployees: number;
  companyId?: string;
  branchId?: string;
  departmentId?: string;
};

function dateFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isDateEditable(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(`${dateStr}T00:00:00`);
  selected.setHours(0, 0, 0, 0);
  return selected.getTime() <= today.getTime();
}

function toApiPunchTime(time: string): string {
  const normalized = normalizeShiftTimeToInput(time);
  return normalized ? `${normalized}:00` : "";
}

export function BulkAttendanceEditModal({
  open,
  onClose,
  onSuccess,
  onRefresh,
  token,
  year,
  month,
  initialDay,
  selectedEmployeeIds,
  totalFilteredEmployees,
  companyId,
  branchId,
  departmentId,
}: BulkAttendanceEditModalProps) {
  const today = new Date();
  const defaultDay = initialDay ?? Math.min(today.getDate(), new Date(year, month, 0).getDate());

  const [day, setDay] = useState(defaultDay);
  const [status, setStatus] = useState<BulkAttendanceStatus>("present");
  const [punchIn, setPunchIn] = useState("");
  const [punchOut, setPunchOut] = useState("");
  const [remarks, setRemarks] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [partialErrors, setPartialErrors] = useState<BulkAttendanceEditErrorItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setDay(initialDay ?? defaultDay);
    setStatus("present");
    setPunchIn("");
    setPunchOut("");
    setRemarks("");
    setOverrideReason("");
    setFieldErrors({});
    setPartialErrors([]);
  }, [open, initialDay, defaultDay]);

  const attendanceDate = useMemo(() => dateFromParts(year, month, day), [year, month, day]);
  const monthStartDate = useMemo(() => dateFromParts(year, month, 1), [year, month]);
  const monthEndDate = useMemo(
    () => dateFromParts(year, month, new Date(year, month, 0).getDate()),
    [year, month],
  );
  const maxSelectableDate = useMemo(() => {
    const todayStr = dateFromParts(today.getFullYear(), today.getMonth() + 1, today.getDate());
    return monthEndDate < todayStr ? monthEndDate : todayStr;
  }, [monthEndDate, today]);
  const targetCount = selectedEmployeeIds.length > 0 ? selectedEmployeeIds.length : totalFilteredEmployees;
  const showPunchFields = PUNCH_VISIBLE_STATUSES.has(status);
  const punchOptional = status === "week_off";
  const dateEditable = isDateEditable(attendanceDate);
  const overLimit = targetCount > 250;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateEditable) {
      toast.error("Future dates cannot be edited.");
      return;
    }
    if (overrideReason.trim().length < 3) {
      toast.error("Override reason must be at least 3 characters.");
      return;
    }
    if (overLimit) {
      toast.error("Maximum 250 employees per bulk request.");
      return;
    }

    const punchInApi = punchIn.trim() ? toApiPunchTime(punchIn) : undefined;
    const punchOutApi = punchOut.trim() ? toApiPunchTime(punchOut) : undefined;

    if (PUNCH_REQUIRED_STATUSES.has(status) && (punchInApi || punchOutApi) && !(punchInApi && punchOutApi)) {
      toast.error("Provide both punch in and punch out times, or leave both empty.");
      return;
    }

    const payload: BulkAttendanceEditPayload = {
      year,
      month,
      day,
      status,
      manual_override_reason: overrideReason.trim(),
      remarks: remarks.trim() || undefined,
    };

    if (selectedEmployeeIds.length > 0) {
      payload.employee_ids = selectedEmployeeIds;
    } else {
      if (companyId) payload.company_id = Number(companyId);
      if (branchId) payload.branch_id = Number(branchId);
      if (departmentId) payload.department_id = Number(departmentId);
    }

    if (showPunchFields && punchInApi && punchOutApi) {
      payload.punch_in_time = punchInApi;
      payload.punch_out_time = punchOutApi;
    }

    setSubmitting(true);
    setFieldErrors({});
    setPartialErrors([]);

    try {
      const result = await bulkEditAdminAttendance(token, payload);
      const errors = result.data?.errors ?? [];

      if (errors.length > 0) {
        setPartialErrors(errors);
        toast.warning(result.message || "Bulk edit completed with some errors.");
        onRefresh?.();
      } else {
        toast.success(result.message || "Bulk attendance updated successfully.");
        onSuccess();
        onClose();
      }
    } catch (err) {
      const apiErr = err as AttendanceApiError;
      if (apiErr.fieldErrors) {
        setFieldErrors(apiErr.fieldErrors);
      }
      toast.error(apiErr.message || "Failed to update attendance.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Bulk Attendance Edit</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Apply one status to {targetCount} employee{targetCount === 1 ? "" : "s"} for a single day.
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
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</span>
            <input
              type="date"
              value={attendanceDate}
              min={monthStartDate}
              max={maxSelectableDate}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                const [y, m, d] = value.split("-").map(Number);
                if (y === year && m === month) {
                  setDay(d);
                }
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            {!dateEditable ? (
              <span className="text-xs text-destructive">Future dates cannot be edited.</span>
            ) : null}
            {fieldErrors.attendance_date?.[0] ? (
              <span className="text-xs text-destructive">{fieldErrors.attendance_date[0]}</span>
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
                  Punch In {punchOptional ? "(optional — week off)" : "(optional)"}
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
                  Punch Out {punchOptional ? "(optional — week off)" : "(optional)"}
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
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remarks</span>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Optional note"
            />
          </label>

          <label className="space-y-1.5 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Override Reason <span className="text-destructive">*</span>
            </span>
            <Textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={2}
              placeholder="Reason for bulk manual override (audit trail)"
              required
            />
            {fieldErrors.manual_override_reason?.[0] ? (
              <span className="text-xs text-destructive">{fieldErrors.manual_override_reason[0]}</span>
            ) : null}
          </label>

          <div className="rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/30 p-3 text-xs text-sky-900 dark:text-sky-200 flex gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>Punch times are auto-filled from each employee&apos;s shift when left empty on working days.</p>
              <p>On week-off days, punch times are optional. Maximum 250 employees per request.</p>
            </div>
          </div>

          {overLimit ? (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
              Selection exceeds 250 employees. Narrow filters or select fewer employees.
            </div>
          ) : null}

          {partialErrors.length > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs space-y-2">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Some employees could not be updated:
              </p>
              <ul className="max-h-32 overflow-y-auto space-y-1 text-amber-800 dark:text-amber-300">
                {partialErrors.map((item) => (
                  <li key={`${item.employee_id}-${item.message}`}>
                    {item.employee_name ?? `Employee #${item.employee_id}`}: {item.message}
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
              disabled={submitting || !dateEditable || overLimit || overrideReason.trim().length < 3}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating attendance…
                </>
              ) : (
                `Apply to ${targetCount} employee${targetCount === 1 ? "" : "s"}`
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
