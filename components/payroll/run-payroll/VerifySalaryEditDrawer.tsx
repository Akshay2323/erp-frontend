"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, List, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAdminEmployeeMonthlyAttendanceReport,
  mapAttendanceGridCodeToStatus,
  upsertAdminAttendance,
  type MonthlyAttendanceStatusOption,
} from "@/lib/api/attendance";
import {
  adjustPayrollRunVerifyAmounts,
  recalculatePayrollRun,
  type PayrollApiError,
  type RecalculatePayrollRunPayload,
} from "@/lib/api/payroll";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{ value: MonthlyAttendanceStatusOption; label: string; letter: string }> = [
  { value: "present", label: "Present", letter: "P" },
  { value: "absent", label: "Absent", letter: "A" },
  { value: "half_day", label: "Half day", letter: "HD" },
  { value: "late", label: "Late", letter: "LT" },
  { value: "week_off", label: "Week off", letter: "W" },
  { value: "on_leave", label: "On leave", letter: "L" },
  { value: "holiday", label: "Holiday", letter: "H" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type AttendanceEditRow = {
  date: string;
  day: string;
  originalStatus: MonthlyAttendanceStatusOption;
  status: MonthlyAttendanceStatusOption;
  punchIn: string | null;
  punchOut: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  workingHours: string | null;
  editable: boolean;
  note: string | null;
};

export type VerifySalaryEditTarget = {
  employeeId: number;
  payrollRunId: number;
  name: string;
  employeeCode?: string;
  month: number;
  year: number;
  overtimeAmount: number;
  penalty: number;
  payableAmount: number;
};

type VerifySalaryEditDrawerProps = {
  open: boolean;
  token: string;
  target: VerifySalaryEditTarget | null;
  saving?: boolean;
  /** Same calculation options the Verify board was loaded with. */
  calcOptions?: RecalculatePayrollRunPayload;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isDateEditable(dateStr: string): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const date = new Date(`${dateStr}T12:00:00`);
  return date.getTime() <= today.getTime();
}

function statusLetter(status: MonthlyAttendanceStatusOption): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.letter ?? "?";
}

function statusCellClass(status: MonthlyAttendanceStatusOption): string {
  switch (status) {
    case "present":
      return "bg-emerald-500 text-white";
    case "absent":
      return "bg-rose-500 text-white";
    case "half_day":
      return "bg-amber-500 text-white";
    case "late":
      return "bg-orange-500 text-white";
    case "on_leave":
      return "bg-sky-500 text-white";
    case "holiday":
      return "bg-violet-500 text-white";
    case "week_off":
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusBadgeClass(status: MonthlyAttendanceStatusOption): string {
  switch (status) {
    case "present":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "absent":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "half_day":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "late":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-300";
    case "on_leave":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "holiday":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "week_off":
    default:
      return "bg-muted text-muted-foreground";
  }
}

function normalizePunchTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function punchesForStatus(
  row: AttendanceEditRow,
  status: MonthlyAttendanceStatusOption,
): { punch_in_time: string | null; punch_out_time: string | null } {
  const needsPunches = status === "present" || status === "late" || status === "half_day";
  if (!needsPunches) {
    return { punch_in_time: null, punch_out_time: null };
  }

  return {
    punch_in_time:
      normalizePunchTime(row.punchIn) ??
      normalizePunchTime(row.shiftStart) ??
      "09:00:00",
    punch_out_time:
      normalizePunchTime(row.punchOut) ??
      normalizePunchTime(row.shiftEnd) ??
      "18:00:00",
  };
}

function buildCalendarCells(
  year: number,
  month: number,
  rowsByDate: Map<string, AttendanceEditRow>,
): Array<AttendanceEditRow | null> {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startPad = first.getDay();
  const cells: Array<AttendanceEditRow | null> = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existing = rowsByDate.get(date);
    if (existing) {
      cells.push(existing);
      continue;
    }
    cells.push({
      date,
      day: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      originalStatus: "absent",
      status: "absent",
      punchIn: null,
      punchOut: null,
      shiftStart: null,
      shiftEnd: null,
      workingHours: null,
      editable: isDateEditable(date),
      note: null,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function VerifySalaryEditDrawer({
  open,
  token,
  target,
  saving = false,
  calcOptions,
  onClose,
  onSaved,
}: VerifySalaryEditDrawerProps) {
  const [overtimeAmount, setOvertimeAmount] = useState("0");
  const [penalty, setPenalty] = useState("0");
  const [attendanceRows, setAttendanceRows] = useState<AttendanceEditRow[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("Corrected during payroll verify");
  const [localSaving, setLocalSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthKey = target
    ? `${target.year}-${String(target.month).padStart(2, "0")}`
    : "";
  const periodLabel = target
    ? new Date(target.year, target.month - 1, 1).toLocaleString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "";

  useEffect(() => {
    if (!open || !target) return;

    setOvertimeAmount(String(target.overtimeAmount));
    setPenalty(String(target.penalty));
    setOverrideReason("Corrected during payroll verify");
    setAttendanceError(null);
    setSelectedDate(null);
    setViewMode("calendar");

    let cancelled = false;
    setLoadingAttendance(true);

    (async () => {
      try {
        const report = await getAdminEmployeeMonthlyAttendanceReport(
          token,
          target.employeeId,
          monthKey,
        );
        if (cancelled) return;

        setSummary((report.summary ?? {}) as Record<string, unknown>);
        const rows = report.attendance_grid.map((day) => {
          const status = mapAttendanceGridCodeToStatus(day.status);
          return {
            date: day.date,
            day: day.day,
            originalStatus: status,
            status,
            punchIn: day.punch_in ?? null,
            punchOut: day.punch_out ?? null,
            shiftStart: day.shift_start ?? null,
            shiftEnd: day.shift_end ?? null,
            workingHours: day.working_hours ?? null,
            editable: isDateEditable(day.date),
            note: day.holiday_name ?? day.leave_type ?? null,
          };
        });
        setAttendanceRows(rows);
        const firstEditable = rows.find((row) => row.editable);
        setSelectedDate(firstEditable?.date ?? rows[0]?.date ?? null);
      } catch (err) {
        if (cancelled) return;
        const message =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: string }).message)
            : "Unable to load attendance.";
        setAttendanceError(message);
        setAttendanceRows([]);
        setSummary({});
        setSelectedDate(null);
      } finally {
        if (!cancelled) setLoadingAttendance(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, target, token, monthKey]);

  const previewPayable = useMemo(() => {
    if (!target) return 0;
    const oldOt = target.overtimeAmount;
    const oldPenalty = target.penalty;
    const oldPayable = target.payableAmount;
    return round2(oldPayable - oldOt + num(overtimeAmount) + oldPenalty - num(penalty));
  }, [target, overtimeAmount, penalty]);

  const dirtyAttendance = useMemo(
    () => attendanceRows.filter((row) => row.editable && row.status !== row.originalStatus),
    [attendanceRows],
  );

  const rowsByDate = useMemo(() => {
    const map = new Map<string, AttendanceEditRow>();
    for (const row of attendanceRows) {
      map.set(row.date, row);
    }
    return map;
  }, [attendanceRows]);

  const calendarCells = useMemo(() => {
    if (!target) return [];
    return buildCalendarCells(target.year, target.month, rowsByDate);
  }, [target, rowsByDate]);

  const selectedRow = useMemo(() => {
    if (!selectedDate) return null;
    return (
      rowsByDate.get(selectedDate) ??
      calendarCells.find((cell) => cell?.date === selectedDate) ??
      null
    );
  }, [selectedDate, rowsByDate, calendarCells]);
  const busy = saving || localSaving;

  const updateRowStatus = (date: string, status: MonthlyAttendanceStatusOption) => {
    setAttendanceRows((prev) => {
      const existing = prev.find((row) => row.date === date);
      if (existing) {
        return prev.map((row) => (row.date === date ? { ...row, status } : row));
      }
      const fallback =
        calendarCells.find((cell) => cell?.date === date) ??
        ({
          date,
          day: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
          originalStatus: "absent" as MonthlyAttendanceStatusOption,
          status,
          punchIn: null,
          punchOut: null,
          shiftStart: null,
          shiftEnd: null,
          workingHours: null,
          editable: isDateEditable(date),
          note: null,
        } satisfies AttendanceEditRow);
      return [...prev, { ...fallback, status }];
    });
    setSelectedDate(date);
  };

  const reloadAttendance = async () => {
    if (!target) return;
    const report = await getAdminEmployeeMonthlyAttendanceReport(
      token,
      target.employeeId,
      monthKey,
    );
    setSummary((report.summary ?? {}) as Record<string, unknown>);
    const rows = report.attendance_grid.map((day) => {
      const status = mapAttendanceGridCodeToStatus(day.status);
      return {
        date: day.date,
        day: day.day,
        originalStatus: status,
        status,
        punchIn: day.punch_in ?? null,
        punchOut: day.punch_out ?? null,
        shiftStart: day.shift_start ?? null,
        shiftEnd: day.shift_end ?? null,
        workingHours: day.working_hours ?? null,
        editable: isDateEditable(day.date),
        note: day.holiday_name ?? day.leave_type ?? null,
      };
    });
    setAttendanceRows(rows);
  };

  const handleSave = async () => {
    if (!target) return;

    if (dirtyAttendance.length > 0 && !overrideReason.trim()) {
      toast.error("Provide a reason before saving attendance changes.");
      return;
    }

    const otChanged = round2(num(overtimeAmount)) !== round2(target.overtimeAmount);
    const penaltyChanged = round2(num(penalty)) !== round2(target.penalty);
    const amountsChanged = otChanged || penaltyChanged;

    if (dirtyAttendance.length === 0 && !amountsChanged) {
      toast.info("No changes to save.");
      return;
    }

    setLocalSaving(true);
    try {
      for (const row of dirtyAttendance) {
        const punches = punchesForStatus(row, row.status);
        await upsertAdminAttendance(token, {
          employee_id: target.employeeId,
          attendance_date: row.date,
          status: row.status,
          punch_in_time: punches.punch_in_time,
          punch_out_time: punches.punch_out_time,
          remarks: overrideReason.trim(),
          manual_override_reason: overrideReason.trim(),
        });
      }

      // Attendance drives gross/OT/penalty, so re-derive the stored payroll snapshot
      // before applying any manual OT/penalty override on top of it.
      let recalcWarning: string | null = null;
      if (dirtyAttendance.length > 0) {
        const recalc = await recalculatePayrollRun(
          token,
          target.payrollRunId,
          calcOptions ?? {},
        );
        if (!recalc.success) {
          recalcWarning = recalc.message || "Salary could not be recalculated.";
        }
      }

      if (amountsChanged) {
        await adjustPayrollRunVerifyAmounts(token, target.payrollRunId, {
          overtime_amount: num(overtimeAmount),
          penalty: num(penalty),
        });
      }

      if (dirtyAttendance.length > 0) {
        await reloadAttendance();
      }

      const parts = [
        dirtyAttendance.length > 0 ? "Attendance" : null,
        amountsChanged ? "OT and penalty" : null,
      ].filter(Boolean);
      toast.success(`${parts.join(" and ")} updated.`);
      if (recalcWarning) {
        toast.warning(recalcWarning);
      }
      await onSaved();
      onClose();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as PayrollApiError).message)
          : "Unable to save changes.";
      toast.error(message);
    } finally {
      setLocalSaving(false);
    }
  };

  if (!open || !target) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => (!busy ? onClose() : undefined)}
      />
      <div className="relative flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Edit payroll & attendance</h2>
            <p className="truncate text-sm text-muted-foreground">
              {target.name}
              {target.employeeCode ? ` · ${target.employeeCode}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Salary adjustments
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">OT Payable</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={overtimeAmount}
                  disabled={busy}
                  onChange={(e) => setOvertimeAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Penalty</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={penalty}
                  disabled={busy}
                  onChange={(e) => setPenalty(e.target.value)}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Updated payable</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatAmount(previewPayable)}
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Monthly attendance
              </h3>
              <div className="flex items-center gap-2">
                {dirtyAttendance.length > 0 ? (
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    {dirtyAttendance.length} day{dirtyAttendance.length === 1 ? "" : "s"} changed
                  </span>
                ) : null}
                <div className="inline-flex rounded-lg border border-border p-0.5">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
                      viewMode === "calendar"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setViewMode("calendar")}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Calendar
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
                      viewMode === "list"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-3.5 w-3.5" />
                    List
                  </button>
                </div>
              </div>
            </div>

            {!loadingAttendance && !attendanceError ? (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
                  P: {num(summary.present_days)}
                </span>
                <span className="rounded-md bg-rose-500/10 px-2 py-1 text-rose-700 dark:text-rose-300">
                  A: {num(summary.absent_days)}
                </span>
                <span className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
                  HD: {num(summary.half_days)}
                </span>
                <span className="rounded-md bg-sky-500/10 px-2 py-1 text-sky-700 dark:text-sky-300">
                  L: {num(summary.leave_days)}
                </span>
                <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                  Hours: {String(summary.total_working_hours ?? "—")}
                </span>
              </div>
            ) : null}

            {dirtyAttendance.length > 0 ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Attendance override reason
                </label>
                <Input
                  value={overrideReason}
                  disabled={busy}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for attendance correction"
                />
              </div>
            ) : null}

            {loadingAttendance ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading attendance…
              </div>
            ) : attendanceError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
                {attendanceError}
              </p>
            ) : attendanceRows.length === 0 && viewMode === "list" ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No attendance records found for this month.
              </p>
            ) : viewMode === "calendar" ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="grid grid-cols-7 border-b border-border bg-muted/50">
                    {WEEKDAYS.map((label) => (
                      <div
                        key={label}
                        className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {calendarCells.map((cell, index) => {
                      if (!cell) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className="min-h-[64px] border-b border-r border-border/60 bg-muted/20"
                          />
                        );
                      }

                      const dayNum = Number(cell.date.slice(8));
                      const isSelected = selectedDate === cell.date;
                      const isDirty = cell.status !== cell.originalStatus;

                      return (
                        <button
                          key={cell.date}
                          type="button"
                          disabled={busy}
                          onClick={() => setSelectedDate(cell.date)}
                          className={cn(
                            "relative flex min-h-[64px] flex-col items-center gap-1 border-b border-r border-border/60 px-1 py-1.5 text-center transition-colors",
                            cell.editable ? "hover:bg-muted/40" : "opacity-55",
                            isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/40",
                            isDirty && "bg-amber-500/5",
                          )}
                          title={
                            cell.editable
                              ? `${cell.date} · ${cell.status.replace("_", " ")}`
                              : "Future dates cannot be edited"
                          }
                        >
                          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                            {dayNum}
                          </span>
                          <span
                            className={cn(
                              "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                              statusCellClass(cell.status),
                            )}
                          >
                            {statusLetter(cell.status)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((option) => (
                    <span
                      key={option.value}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      <span
                        className={cn(
                          "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold",
                          statusCellClass(option.value),
                        )}
                      >
                        {option.letter}
                      </span>
                      {option.label}
                    </span>
                  ))}
                </div>

                {selectedRow ? (
                  <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {selectedRow.date} · {selectedRow.day}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedRow.punchIn || selectedRow.punchOut
                            ? `${selectedRow.punchIn ?? "—"} → ${selectedRow.punchOut ?? "—"}`
                            : "No punch times"}
                          {selectedRow.workingHours ? ` · ${selectedRow.workingHours}` : ""}
                        </p>
                        {selectedRow.note ? (
                          <p className="text-xs text-muted-foreground">{selectedRow.note}</p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-1 text-xs font-medium capitalize",
                          statusBadgeClass(selectedRow.status),
                        )}
                      >
                        {selectedRow.status.replace("_", " ")}
                      </span>
                    </div>

                    {selectedRow.editable ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Change status
                        </label>
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={selectedRow.status}
                          disabled={busy}
                          onChange={(e) =>
                            updateRowStatus(
                              selectedRow.date,
                              e.target.value as MonthlyAttendanceStatusOption,
                            )
                          }
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.letter} — {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Future dates cannot be edited.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="max-h-[42vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 border-b border-border bg-muted/80 backdrop-blur">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {attendanceRows.map((row) => (
                        <tr
                          key={row.date}
                          className={cn(
                            !row.editable && "opacity-60",
                            row.status !== row.originalStatus && "bg-amber-500/5",
                          )}
                        >
                          <td className="px-3 py-2 align-top">
                            <div className="font-medium tabular-nums text-foreground">
                              {row.date.slice(8)} {row.day}
                            </div>
                            {(row.punchIn || row.punchOut) && (
                              <div className="text-[11px] text-muted-foreground">
                                {row.punchIn ?? "—"} → {row.punchOut ?? "—"}
                              </div>
                            )}
                            {row.note ? (
                              <div className="text-[11px] text-muted-foreground">{row.note}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {row.editable ? (
                              <select
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                value={row.status}
                                disabled={busy}
                                onChange={(e) =>
                                  updateRowStatus(
                                    row.date,
                                    e.target.value as MonthlyAttendanceStatusOption,
                                  )
                                }
                              >
                                {STATUS_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex rounded-md px-2 py-1 text-xs font-medium capitalize",
                                  statusBadgeClass(row.status),
                                )}
                              >
                                {row.status.replace("_", " ")}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 align-top tabular-nums text-muted-foreground">
                            {row.workingHours ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || loadingAttendance} onClick={() => void handleSave()}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
