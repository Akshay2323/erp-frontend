"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Edit2,
  Check,
  ArrowLeft,
  CalendarDays,
  Users,
  CircleDot,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageRefreshingBadge, PanelSkeleton, PayrollPageSkeleton } from "@/components/ui/page-states";
import {
  VerifySalaryEditDrawer,
  type VerifySalaryEditTarget,
} from "@/components/payroll/run-payroll/VerifySalaryEditDrawer";
import { finalizePayrollRuns, postPayrollRunFlow, revertPayrollRuns, type PayrollApiError } from "@/lib/api/payroll";
import {
  readPayrollVerifyContext,
  type PayrollVerifyContext,
} from "@/lib/payroll/verify-context";
import { BreakCountValue } from "@/components/attendance/BreakCountValue";
import { useAuthToken } from "@/lib/use-auth-token";
import { cn } from "@/lib/utils";

type StaffRow = Record<string, unknown>;

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function staffAmounts(staff: StaffRow): Record<string, unknown> {
  return (staff.amounts as Record<string, unknown> | undefined) ?? {};
}

function staffOt(staff: StaffRow): number {
  const amounts = staffAmounts(staff);
  return num(staff.ot_payable ?? staff.overtime_amount ?? amounts.overtime_amount);
}

function staffPenalty(staff: StaffRow): number {
  const amounts = staffAmounts(staff);
  return num(staff.penalty ?? amounts.penalty);
}

function staffPayable(staff: StaffRow): number {
  const amounts = staffAmounts(staff);
  return num(
    staff.payable_amount ?? staff.payables ?? staff.estimated_net_salary ?? amounts.net_payable,
  );
}

function staffPaid(staff: StaffRow): number {
  const amounts = staffAmounts(staff);
  return num(staff.paid_amount ?? staff.paid ?? amounts.paid_amount);
}

function staffRemaining(staff: StaffRow): number {
  const amounts = staffAmounts(staff);
  return num(
    staff.remaining_amount ?? staff.remaining ?? staff.pending_amount ?? amounts.pending_amount,
  );
}

function staffBreakCount(staff: StaffRow): number {
  const attendance = (staff.attendance as Record<string, unknown> | undefined) ?? {};
  return num(
    attendance.total_break_count ??
      attendance.break_count ??
      staff.total_break_count ??
      staff.break_count,
  );
}

function staffBreakMinutes(staff: StaffRow): number {
  const attendance = (staff.attendance as Record<string, unknown> | undefined) ?? {};
  return num(attendance.total_break_minutes ?? staff.total_break_minutes);
}

/** Finalized unpaid runs can be unlocked back to draft. */
function staffCanRevert(staff: StaffRow): boolean {
  const payrollRunId = Number(staff.payroll_run_id);
  if (!Number.isFinite(payrollRunId) || payrollRunId <= 0) return false;
  const status = String(staff.payroll_status ?? "").toLowerCase();
  if (status !== "processed") return false;
  return staffPaid(staff) <= 0;
}

export default function VerifySalaryPage() {
  const token = useAuthToken();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [context, setContext] = useState<PayrollVerifyContext | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editTarget, setEditTarget] = useState<VerifySalaryEditTarget | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    const stored = readPayrollVerifyContext();
    if (!stored || stored.employeeIds.length === 0) {
      toast.error("No employees selected for verification. Choose employees and click Save Payroll.");
      router.replace("/run-payroll");
      return;
    }
    setContext(stored);
    setContextReady(true);
  }, [router]);

  const selectedIds = context?.employeeIds ?? [];
  const initialMonth = context?.month ?? new Date().getMonth() + 1;
  const initialYear = context?.year ?? new Date().getFullYear();

  const query = useQuery({
    queryKey: [
      "payroll-run-flow",
      2,
      token,
      initialMonth,
      initialYear,
      selectedIds.join(","),
      context?.calculationMode,
      context?.includeOvertime,
      context?.includePenalty,
      context?.companyId,
      context?.branchId,
      context?.departmentId,
    ],
    queryFn: () =>
      postPayrollRunFlow(token!, {
        step: 2,
        month: initialMonth,
        year: initialYear,
        employee_ids: selectedIds,
        company_id: context?.companyId,
        branch_id: context?.branchId,
        department_id: context?.departmentId,
        calculation_mode: context?.calculationMode,
        include_overtime: context?.includeOvertime,
        include_penalty: context?.includePenalty,
        per_page: Math.min(100, Math.max(selectedIds.length, 15)),
      }).then((res) => res.data as Record<string, unknown>),
    enabled: Boolean(token) && contextReady && selectedIds.length > 0,
  });

  const data = query.data;
  const showSkeleton = !contextReady || (query.isLoading && !data);
  const showRefreshing = query.isFetching && Boolean(data);
  const error = query.isError
    ? query.error instanceof Error
      ? query.error.message
      : "Unable to load salary verification data."
    : !token
      ? "Please sign in to continue."
      : null;

  const period = (data?.period ?? {}) as Record<string, unknown>;
  const staffList = useMemo(() => {
    let list = (Array.isArray(data?.staff) ? data.staff : []) as StaffRow[];
    if (selectedIds.length > 0) {
      list = list.filter((s) => selectedIds.includes(Number(s.employee_id)));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) =>
        String(s.full_name ?? s.name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, selectedIds, searchQuery]);

  const selectedStaffForFinalize = useMemo(() => {
    let list = (Array.isArray(data?.staff) ? data.staff : []) as StaffRow[];
    if (selectedIds.length > 0) {
      list = list.filter((s) => selectedIds.includes(Number(s.employee_id)));
    }
    return list;
  }, [data, selectedIds]);

  const revertEligibleStaff = useMemo(
    () => selectedStaffForFinalize.filter(staffCanRevert),
    [selectedStaffForFinalize],
  );

  const totals = useMemo(() => {
    let payable = 0;
    let paid = 0;
    let remaining = 0;
    let otPayable = 0;
    let penalty = 0;
    for (const staff of staffList) {
      payable += staffPayable(staff);
      paid += staffPaid(staff);
      remaining += staffRemaining(staff);
      otPayable += staffOt(staff);
      penalty += staffPenalty(staff);
    }
    return { payable, paid, remaining, otPayable, penalty };
  }, [staffList]);

  const formatAmount = (value: unknown) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "-";
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "UN";

  const payrollMonthLabel = String(
    period.payroll_month ?? `${initialMonth}/${initialYear}`,
  );
  const attendanceDays = String(period.days_in_attendance_cycle ?? "-");
  const periodType = String(period.period_type ?? "Calendar Month");

  const openEdit = (staff: StaffRow) => {
    const payrollRunId = Number(staff.payroll_run_id);
    if (!payrollRunId || staff.can_edit === false) {
      toast.error(
        staff.payroll_run_id
          ? "This payroll run cannot be edited (already paid or locked)."
          : "Generate payroll for this employee before editing amounts.",
      );
      return;
    }

    setEditTarget({
      employeeId: Number(staff.employee_id),
      payrollRunId,
      name: String(staff.full_name ?? staff.name ?? "Employee"),
      employeeCode: String(staff.employee_code ?? staff.emp_code ?? ""),
      month: initialMonth,
      year: initialYear,
      overtimeAmount: staffOt(staff),
      penalty: staffPenalty(staff),
      payableAmount: staffPayable(staff),
    });
  };

  const handleFinalizePayroll = useCallback(async () => {
    if (!token) {
      toast.error("Please sign in to continue.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("No employees selected to finalize.");
      return;
    }

    const payrollRunIds = selectedStaffForFinalize
      .map((staff) => Number(staff.payroll_run_id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (payrollRunIds.length === 0) {
      toast.error("Selected employees do not have generated payroll runs.");
      return;
    }

    const missingStructure = selectedStaffForFinalize.filter(
      (staff) => staff.has_salary_structure === false || !staff.payroll_run_id,
    );
    if (missingStructure.length > 0) {
      toast.error(
        `${missingStructure.length} employee(s) are missing a salary structure or payroll run and cannot be finalized.`,
      );
    }

    setFinalizing(true);
    const toastId = toast.loading("Finalizing payroll…");
    try {
      const result = await finalizePayrollRuns(token, {
        month: initialMonth,
        year: initialYear,
        payroll_run_ids: payrollRunIds,
        employee_ids: selectedIds,
        calculation_mode: context?.calculationMode,
        include_overtime: context?.includeOvertime,
        include_penalty: context?.includePenalty,
      });
      const payload = (result.data ?? {}) as {
        finalized_count?: number;
        skipped_count?: number;
        errors?: Array<{ message?: string }>;
      };
      const finalizedCount = Number(payload.finalized_count ?? 0);
      const skippedCount = Number(payload.skipped_count ?? 0);
      const firstError = payload.errors?.[0]?.message;

      if (finalizedCount > 0) {
        toast.success(
          `Payroll finalized for ${finalizedCount} employee${finalizedCount === 1 ? "" : "s"}.` +
            (skippedCount > 0 ? ` ${skippedCount} skipped.` : ""),
          { id: toastId },
        );
      } else {
        toast.error(
          firstError ||
            "No payroll runs were finalized. Check salary structures and draft runs.",
          { id: toastId },
        );
      }

      await queryClient.invalidateQueries({ queryKey: ["payroll-run-flow", 2] });
      await queryClient.invalidateQueries({ queryKey: ["run-payroll"] });
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as PayrollApiError).message)
          : "Unable to finalize payroll.";
      toast.error(message, { id: toastId });
    } finally {
      setFinalizing(false);
    }
  }, [
    token,
    selectedIds,
    selectedStaffForFinalize,
    initialMonth,
    initialYear,
    context?.calculationMode,
    context?.includeOvertime,
    context?.includePenalty,
    queryClient,
  ]);

  const handleRevertToDraft = useCallback(async () => {
    if (!token) {
      toast.error("Please sign in to continue.");
      return;
    }
    if (revertEligibleStaff.length === 0) {
      toast.error("No finalized unpaid payroll runs to revert.");
      return;
    }

    const payrollRunIds = revertEligibleStaff
      .map((staff) => Number(staff.payroll_run_id))
      .filter((id) => Number.isFinite(id) && id > 0);

    setReverting(true);
    const toastId = toast.loading("Reverting payroll to draft…");
    try {
      const result = await revertPayrollRuns(token, {
        month: initialMonth,
        year: initialYear,
        payroll_run_ids: payrollRunIds,
        employee_ids: selectedIds,
      });
      const payload = (result.data ?? {}) as {
        reverted_count?: number;
        skipped_count?: number;
        errors?: Array<{ message?: string }>;
      };
      const revertedCount = Number(payload.reverted_count ?? 0);
      const skippedCount = Number(payload.skipped_count ?? 0);
      const firstError = payload.errors?.[0]?.message;

      if (revertedCount > 0) {
        toast.success(
          `Reverted ${revertedCount} payroll run${revertedCount === 1 ? "" : "s"} to draft.` +
            (skippedCount > 0 ? ` ${skippedCount} skipped.` : ""),
          { id: toastId },
        );
        await queryClient.invalidateQueries({ queryKey: ["payroll-run-flow", 2] });
        await queryClient.invalidateQueries({ queryKey: ["run-payroll"] });
      } else {
        toast.error(
          firstError || "No payroll runs were reverted. Paid runs cannot be unlocked.",
          { id: toastId },
        );
      }
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as PayrollApiError).message)
          : "Unable to revert payroll to draft.";
      toast.error(message, { id: toastId });
    } finally {
      setReverting(false);
    }
  }, [token, revertEligibleStaff, initialMonth, initialYear, selectedIds, queryClient]);

  if (!contextReady) {
    return <PayrollPageSkeleton />;
  }

  return (
    <div className="relative flex min-h-[calc(100vh-6rem)] flex-col pb-24">
      <div className="mb-6 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <Link
              href="/run-payroll"
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Run Payroll
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Verify & Save Payroll
              </h1>
              <PageRefreshingBadge show={showRefreshing} />
            </div>
            <p className="text-sm text-muted-foreground">
              Review payable amounts, OT, and penalties before finalizing this payroll cycle.
            </p>
          </div>

          <nav
            aria-label="Payroll steps"
            className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="hidden text-xs font-medium sm:inline">Generate</span>
            </div>
            <div className="h-px w-6 bg-border" />
            <div className="flex items-center gap-2 text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                2
              </span>
              <span className="hidden text-xs font-semibold sm:inline">Verify</span>
            </div>
            <div className="h-px w-6 bg-border" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-xs font-medium">
                3
              </span>
              <span className="hidden text-xs font-medium sm:inline">Finalize</span>
            </div>
          </nav>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <CalendarDays className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Payroll Month
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                {payrollMonthLabel}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Users className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Attendance Cycle
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {attendanceDays} days
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <CircleDot className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Period Type
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                {periodType}
              </p>
            </div>
          </div>
        </div>
      </div>

      {showSkeleton ? (
        <PanelSkeleton className="min-h-[400px]" />
      ) : error || !data ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-12">
          <p className="text-sm text-muted-foreground">{error ?? "No data available."}</p>
          <Link href="/run-payroll">
            <Button variant="outline">Back to Run Payroll</Button>
          </Link>
        </div>
      ) : (
        <Card className="overflow-hidden border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by employee name"
                className="h-10 pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{staffList.length}</span> employee
              {staffList.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-14 px-4 py-3 font-semibold"> </th>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 text-right font-semibold">CTC / Month</th>
                  <th className="px-4 py-3 text-right font-semibold">Break Count</th>
                  <th className="px-4 py-3 text-right font-semibold">OT Payable</th>
                  <th className="px-4 py-3 text-right font-semibold">Penalty</th>
                  <th className="px-4 py-3 text-right font-semibold">Payable</th>
                  <th className="px-4 py-3 text-right font-semibold">Paid</th>
                  <th className="px-4 py-3 text-right font-semibold">Remaining</th>
                  <th className="w-28 px-4 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      No staff records found for this payroll period.
                    </td>
                  </tr>
                ) : (
                  staffList.map((staff) => {
                    const name = String(staff.full_name ?? staff.name ?? "Unknown");
                    const empCode = String(
                      staff.employee_code ?? staff.emp_code ?? staff.employee_id ?? "",
                    );
                    const ctc = staff.ctc;
                    const ctcDisplay =
                      typeof ctc === "object" && ctc !== null && "display" in ctc
                        ? String((ctc as { display?: string }).display)
                        : formatAmount(staff.ctc_month ?? staff.basic_salary ?? staff.ctc);
                    const canEdit = Boolean(staff.can_edit && staff.payroll_run_id);

                    return (
                      <tr
                        key={String(staff.employee_id)}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                            {initials(name)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{name}</div>
                          {empCode ? (
                            <div className="text-xs text-muted-foreground">ID: {empCode}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {ctcDisplay}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                          <BreakCountValue
                            breakCount={staffBreakCount(staff)}
                            totalBreakMinutes={staffBreakMinutes(staff)}
                            className="items-end"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                          {formatAmount(staffOt(staff))}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                          {formatAmount(staffPenalty(staff))}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                          {formatAmount(staffPayable(staff))}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                          {formatAmount(staffPaid(staff))}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatAmount(staffRemaining(staff))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3"
                              disabled={!canEdit}
                              onClick={() => openEdit(staff)}
                              title={
                                canEdit
                                  ? "Edit OT payable and penalty"
                                  : "Generate payroll first (or run is locked)"
                              }
                            >
                              <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {staffList.length > 0 ? (
                <tfoot className="border-t border-border bg-muted/30">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-foreground">
                      Totals
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatAmount(totals.otPayable)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatAmount(totals.penalty)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatAmount(totals.payable)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatAmount(totals.paid)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatAmount(totals.remaining)}
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:pl-[280px]">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-medium text-foreground">
              {staffList.length} employee{staffList.length === 1 ? "" : "s"} · {payrollMonthLabel}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Net payable {formatAmount(totals.payable)} · OT {formatAmount(totals.otPayable)} ·
              Penalty {formatAmount(totals.penalty)}
            </p>
          </div>
          <div className={cn("flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto")}>
            <Link href="/run-payroll">
              <Button variant="outline" disabled={finalizing || reverting}>
                Cancel
              </Button>
            </Link>
            <Button
              variant="outline"
              disabled={finalizing || reverting || revertEligibleStaff.length === 0}
              onClick={() => void handleRevertToDraft()}
              title={
                revertEligibleStaff.length === 0
                  ? "Only finalized unpaid payroll can be reverted"
                  : `Revert ${revertEligibleStaff.length} run(s) to draft`
              }
            >
              {reverting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reverting…
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Revert to Draft
                  {revertEligibleStaff.length > 0 ? ` (${revertEligibleStaff.length})` : ""}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              disabled={finalizing || reverting}
              onClick={() => router.push("/run-payroll")}
            >
              Finalize Calculation
            </Button>
            <Button
              disabled={finalizing || reverting || staffList.length === 0}
              onClick={() => void handleFinalizePayroll()}
            >
              {finalizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finalizing…
                </>
              ) : (
                "Finalize Payroll"
              )}
            </Button>
          </div>
        </div>
      </div>

      <VerifySalaryEditDrawer
        open={Boolean(editTarget)}
        token={token ?? ""}
        target={editTarget}
        calcOptions={{
          calculation_mode: context?.calculationMode,
          include_overtime: context?.includeOvertime,
          include_penalty: context?.includePenalty,
        }}
        onClose={() => setEditTarget(null)}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["payroll-run-flow", 2] });
        }}
      />
    </div>
  );
}
