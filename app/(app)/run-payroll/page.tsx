"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageRefreshingBadge, PayrollPageSkeleton } from "@/components/ui/page-states";
import { PayrollBulkActions } from "@/components/payroll/run-payroll/PayrollBulkActions";
import { PayrollFilters } from "@/components/payroll/run-payroll/PayrollFilters";
import { PayrollSummaryCards } from "@/components/payroll/run-payroll/PayrollSummaryCards";
import { PayrollTable } from "@/components/payroll/run-payroll/PayrollTable";
import { PayrollToolbar } from "@/components/payroll/run-payroll/PayrollToolbar";
import { RecordPaymentDrawer } from "@/components/payroll/run-payroll/RecordPaymentDrawer";
import { SalaryConfirmationLogsDrawer } from "@/components/payroll/run-payroll/SalaryConfirmationLogsDrawer";
import {
  bulkDownloadPayslips,
  bulkGeneratePayrollRuns,
  bulkUpdatePayrollRunOtAllowed,
  exportPayrollBankFile,
  exportPayrollRuns,
  finalizePayrollRuns,
  revertPayrollRuns,
  postPayrollRunFlow,
  revertPayrollRuns,
  savePayrollPayments,
  updatePayrollRunOtAllowed,
} from "@/lib/api/payroll";
import type { PayrollApiError } from "@/lib/api/payroll";
import { getRunPayrollBreakdown } from "@/lib/api/run-payroll";
import { mapBreakdownResponse } from "@/lib/payroll/run-payroll-mapper";
import type {
  PayrollSalaryBreakdown,
  RunPayrollFilterState,
  RunPayrollSortBy,
  RunPayrollSortDir,
} from "@/lib/payroll/run-payroll-types";
import {
  getConfirmationStatus,
  sendSalaryConfirmations,
} from "@/lib/payroll/salary-confirmation-store";
import {
  useSalaryConfirmationLogs,
  useSalaryConfirmationVersion,
} from "@/lib/payroll/use-salary-confirmation";
import { savePayrollVerifyContext } from "@/lib/payroll/verify-context";
import { useRunPayrollQueries } from "@/lib/payroll/use-run-payroll-queries";
import { useAuthToken } from "@/lib/use-auth-token";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as PayrollApiError).message);
  }
  return err instanceof Error ? err.message : fallback;
}

function createDefaultFilters(month: number, year: number): RunPayrollFilterState {
  return {
    month,
    year,
    calculationMode: "hour",
    includeOvertime: true,
    includePenalty: true,
    companyId: "all",
    branchId: "all",
    departmentId: "all",
    designationId: "all",
    employmentType: "all",
    employeeStatus: "all",
    searchQuery: "",
    showPendingOnly: false,
  };
}

function RunPayrollContent() {
  const token = useAuthToken();
  const router = useRouter();
  const searchParams = useSearchParams();

  const now = new Date();
  const urlMonth = Number(searchParams.get("month"));
  const urlYear = Number(searchParams.get("year"));
  const initialMonth = urlMonth >= 1 && urlMonth <= 12 ? urlMonth : now.getMonth() + 1;
  const initialYear = urlYear >= 2020 && urlYear <= 2100 ? urlYear : now.getFullYear();

  const [filters, setFilters] = useState<RunPayrollFilterState>(() =>
    createDefaultFilters(initialMonth, initialYear),
  );
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [sortBy, setSortBy] = useState<RunPayrollSortBy>("full_name");
  const [sortDir, setSortDir] = useState<RunPayrollSortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [breakdowns, setBreakdowns] = useState<Record<number, PayrollSalaryBreakdown | null>>({});
  const [breakdownLoadingId, setBreakdownLoadingId] = useState<number | null>(null);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [confirmationLogsOpen, setConfirmationLogsOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  const confirmationVersion = useSalaryConfirmationVersion();
  const confirmationLogs = useSalaryConfirmationLogs(filters.month, filters.year);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [filters.searchQuery]);

  const {
    filterOptions,
    summaryStats,
    payrollRows,
    pagination,
    periodLabel,
    isLoading,
    isRefreshing,
    refetchAfterMutation,
    refetchMeta,
  } = useRunPayrollQueries({
    token,
    filters,
    debouncedSearch,
    tableParams: { page, perPage, sortBy, sortDir },
  });

  const paginationTotal = Number(pagination.total ?? payrollRows.length);
  const hasData = !isLoading;

  const handleFilterChange = useCallback(
    <K extends keyof RunPayrollFilterState>(key: K, value: RunPayrollFilterState[K]) => {
      setFilters((prev) => {
        if (key === "companyId" && value !== prev.companyId) {
          void refetchMeta();
        }
        return { ...prev, [key]: value };
      });
      if (
        key !== "searchQuery" &&
        key !== "calculationMode" &&
        key !== "includeOvertime" &&
        key !== "includePenalty"
      ) {
        setPage(1);
        setSelectedIds([]);
      }
    },
    [refetchMeta],
  );

  const handleResetFilters = useCallback(() => {
    setFilters(createDefaultFilters(initialMonth, initialYear));
    setDebouncedSearch("");
    setPage(1);
    setSelectedIds([]);
    setExpandedIds([]);
    setBreakdowns({});
    void refetchMeta();
  }, [initialMonth, initialYear, refetchMeta]);

  const resolveTargetEmployeeIds = useCallback(
    (requireSelection: boolean) => {
      if (selectedIds.length > 0) return selectedIds;
      if (requireSelection) return [];
      return payrollRows.map((r) => r.employeeId);
    },
    [payrollRows, selectedIds],
  );

  const handleGeneratePayroll = useCallback(
    async (requireSelection = false) => {
      if (!token) return;
      const employeeIds = resolveTargetEmployeeIds(requireSelection);
      if (requireSelection && employeeIds.length === 0) {
        toast.error("Select at least one employee.");
        return;
      }

      setActionBusy(true);
      const toastId = toast.loading("Generating payroll…");
      try {
        const payload: Parameters<typeof bulkGeneratePayrollRuns>[1] = {
          month: filters.month,
          year: filters.year,
          include_overtime: filters.includeOvertime,
          calculation_mode: filters.calculationMode,
          remarks: periodLabel ? `${periodLabel} payroll` : undefined,
        };
        if (filters.companyId !== "all") {
          payload.company_id = Number(filters.companyId);
        }
        if (employeeIds.length > 0 && employeeIds.length < payrollRows.length) {
          payload.employee_ids = employeeIds;
        }

        const result = await bulkGeneratePayrollRuns(token, payload);
        const summary = (result.data?.summary ?? {}) as Record<string, number>;
        toast.success(
          `Payroll generated for ${summary.generated ?? (employeeIds.length || "all")} employee(s).`,
          { id: toastId },
        );
        setSelectedIds([]);
        setBreakdowns({});
        await refetchAfterMutation();
      } catch (err) {
        toast.error(apiErrorMessage(err, "Unable to generate payroll."), { id: toastId });
      } finally {
        setActionBusy(false);
      }
    },
    [
      token,
      resolveTargetEmployeeIds,
      filters.month,
      filters.year,
      filters.companyId,
      filters.calculationMode,
      filters.includeOvertime,
      filters.includePenalty,
      payrollRows.length,
      periodLabel,
      refetchAfterMutation,
    ],
  );

  const handleFinalizePayroll = useCallback(async () => {
    if (!token || selectedIds.length === 0) {
      toast.error("Select at least one employee.");
      return;
    }

    const runIds = payrollRows
      .filter((r) => selectedIds.includes(r.employeeId) && r.payrollRunId)
      .map((r) => r.payrollRunId!);

    if (runIds.length === 0) {
      toast.error("Selected employees do not have generated payroll runs.");
      return;
    }

    setActionBusy(true);
    const toastId = toast.loading("Finalizing payroll…");
    try {
      await finalizePayrollRuns(token, {
        month: filters.month,
        year: filters.year,
        payroll_run_ids: runIds,
      });
      toast.success("Payroll finalized successfully.", { id: toastId });
      await refetchAfterMutation();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to finalize payroll."), { id: toastId });
    } finally {
      setActionBusy(false);
    }
  }, [token, selectedIds, payrollRows, filters.month, filters.year, refetchAfterMutation]);

  const revertEligibleRows = useMemo(
    () =>
      payrollRows.filter(
        (r) => selectedIds.includes(r.employeeId) && r.permissions.canRevert && r.payrollRunId,
      ),
    [payrollRows, selectedIds],
  );

  const handleRevertToDraft = useCallback(async () => {
    if (!token) return;
    if (revertEligibleRows.length === 0) {
      toast.error("Select finalized unpaid payroll runs to revert.");
      return;
    }

    const runIds = revertEligibleRows.map((r) => r.payrollRunId!);
    setActionBusy(true);
    const toastId = toast.loading("Reverting payroll to draft…");
    try {
      const result = await revertPayrollRuns(token, {
        month: filters.month,
        year: filters.year,
        payroll_run_ids: runIds,
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
        setSelectedIds([]);
        await refetchAfterMutation();
      } else {
        toast.error(
          firstError || "No payroll runs were reverted. Paid runs cannot be unlocked.",
          { id: toastId },
        );
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to revert payroll to draft."), { id: toastId });
    } finally {
      setActionBusy(false);
    }
  }, [token, revertEligibleRows, filters.month, filters.year, refetchAfterMutation]);

  const confirmationCounts = (() => {
    void confirmationVersion;
    let sent = 0;
    let confirmed = 0;
    for (const row of payrollRows) {
      const status = getConfirmationStatus(row.employeeId, filters.month, filters.year);
      if (status === "sent") sent += 1;
      if (status === "confirmed") confirmed += 1;
    }
    return { sent, confirmed };
  })();

  const handleSendSalaryConfirmation = useCallback(() => {
    if (selectedIds.length === 0) {
      toast.error("Select at least one employee.");
      return;
    }

    let actor = "Admin";
    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        const user = JSON.parse(raw) as Record<string, unknown>;
        actor =
          String(user.name ?? user.full_name ?? user.email ?? "Admin").trim() || "Admin";
      }
    } catch {
      /* ignore */
    }

    const targets = payrollRows.filter((row) => selectedIds.includes(row.employeeId));
    if (targets.length === 0) {
      toast.error("No selected employees found on this page.");
      return;
    }

    const result = sendSalaryConfirmations(
      targets.map((row) => ({
        employeeId: row.employeeId,
        employeeCode: row.employeeCode,
        employeeName: row.fullName,
        month: filters.month,
        year: filters.year,
        netPayable: row.netPayable,
      })),
      actor,
    );

    if (result.sent > 0) {
      toast.success(
        `Salary confirmation sent to ${result.sent} employee${result.sent === 1 ? "" : "s"}.` +
          (result.skipped > 0 ? ` ${result.skipped} already confirmed were skipped.` : ""),
      );
    } else {
      toast.info(
        result.skipped > 0
          ? "Selected employees have already confirmed their salary."
          : "No confirmation requests were sent.",
      );
    }
  }, [selectedIds, payrollRows, filters.month, filters.year]);

  const handleSavePayroll = useCallback(async () => {
    if (!token) {
      toast.error("Please sign in to continue.");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Select at least one employee.");
      return;
    }

    setActionBusy(true);
    const toastId = toast.loading("Preparing salary verification…");
    try {
      await postPayrollRunFlow(token, {
        step: 2,
        month: filters.month,
        year: filters.year,
        employee_ids: selectedIds,
        company_id: filters.companyId !== "all" ? filters.companyId : undefined,
        branch_id: filters.branchId !== "all" ? filters.branchId : undefined,
        department_id: filters.departmentId !== "all" ? filters.departmentId : undefined,
        calculation_mode: filters.calculationMode,
        include_overtime: filters.includeOvertime,
        include_penalty: filters.includePenalty,
        per_page: Math.min(100, Math.max(selectedIds.length, 15)),
      });

      savePayrollVerifyContext({
        month: filters.month,
        year: filters.year,
        employeeIds: selectedIds,
        companyId: filters.companyId !== "all" ? filters.companyId : undefined,
        branchId: filters.branchId !== "all" ? filters.branchId : undefined,
        departmentId: filters.departmentId !== "all" ? filters.departmentId : undefined,
        calculationMode: filters.calculationMode,
        includeOvertime: filters.includeOvertime,
        includePenalty: filters.includePenalty,
      });

      toast.success("Opening verify salary…", { id: toastId });
      router.push("/run-payroll/verify-salary");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to open Save Payroll."), { id: toastId });
    } finally {
      setActionBusy(false);
    }
  }, [
    token,
    router,
    selectedIds,
    filters.month,
    filters.year,
    filters.companyId,
    filters.branchId,
    filters.departmentId,
    filters.calculationMode,
    filters.includeOvertime,
    filters.includePenalty,
  ]);

  const handleDownloadSalarySheet = useCallback(async () => {
    if (!token) return;
    setActionBusy(true);
    try {
      const blob = await exportPayrollRuns(token, {
        month: filters.month,
        year: filters.year,
        company_id: filters.companyId !== "all" ? filters.companyId : undefined,
      });
      downloadBlob(blob, `salary-sheet-${filters.month}-${filters.year}.xlsx`);
      toast.success("Salary sheet downloaded.");
    } catch {
      toast.error("Unable to download salary sheet.");
    } finally {
      setActionBusy(false);
    }
  }, [token, filters.month, filters.year, filters.companyId]);

  const handleDownloadBankFile = useCallback(async () => {
    if (!token || selectedIds.length === 0) {
      toast.error("Select at least one employee.");
      return;
    }

    const runIds = payrollRows
      .filter((r) => selectedIds.includes(r.employeeId) && r.payrollRunId)
      .map((r) => r.payrollRunId!);

    setActionBusy(true);
    try {
      const blob = await exportPayrollBankFile(token, {
        month: filters.month,
        year: filters.year,
        company_id: filters.companyId !== "all" ? filters.companyId : undefined,
        branch_id: filters.branchId !== "all" ? filters.branchId : undefined,
        department_id: filters.departmentId !== "all" ? filters.departmentId : undefined,
        payroll_run_ids: runIds.length > 0 ? runIds : undefined,
        employee_ids: runIds.length === 0 ? selectedIds : undefined,
        format: "csv",
      });
      downloadBlob(blob, `bank-file-${filters.month}-${filters.year}.csv`);
      toast.success("Bank file downloaded.");
    } catch {
      toast.error("Unable to download bank file.");
    } finally {
      setActionBusy(false);
    }
  }, [token, selectedIds, payrollRows, filters.month, filters.year, filters.companyId, filters.branchId, filters.departmentId]);

  const handleGeneratePayslips = useCallback(async () => {
    if (!token || selectedIds.length === 0) {
      toast.error("Select at least one employee.");
      return;
    }

    const runIds = payrollRows
      .filter((r) => selectedIds.includes(r.employeeId) && r.payrollRunId)
      .map((r) => r.payrollRunId!);

    if (runIds.length === 0) {
      toast.error("Selected employees do not have payroll runs.");
      return;
    }

    setActionBusy(true);
    const toastId = toast.loading("Preparing payslips…");
    try {
      const blob = await bulkDownloadPayslips(token, runIds);
      downloadBlob(blob, `payslips-${filters.month}-${filters.year}.zip`);
      toast.success(`Downloaded ${runIds.length} payslip(s).`, { id: toastId });
    } catch {
      toast.error("Unable to download payslips.", { id: toastId });
    } finally {
      setActionBusy(false);
    }
  }, [token, selectedIds, payrollRows, filters.month, filters.year]);

  const handleSavePayments = useCallback(
    async (payments: Array<{ payroll_run_id: number; paid_amount: number; full_payment: boolean }>) => {
      if (!token) return;
      setSavingPayment(true);
      try {
        await savePayrollPayments(token, {
          month: filters.month,
          year: filters.year,
          payments,
        });
        toast.success("Payments recorded successfully.");
        setPaymentDrawerOpen(false);
        setSelectedIds([]);
        await refetchAfterMutation();
      } catch (err) {
        toast.error(apiErrorMessage(err, "Unable to save payments."));
      } finally {
        setSavingPayment(false);
      }
    },
    [token, filters.month, filters.year, refetchAfterMutation],
  );

  const handleToggleSelect = useCallback((employeeId: number) => {
    setSelectedIds((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId],
    );
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? payrollRows.map((r) => r.employeeId) : []);
    },
    [payrollRows],
  );

  useEffect(() => {
    setBreakdowns({});
    setExpandedIds([]);
  }, [filters.calculationMode, filters.includeOvertime, filters.includePenalty]);

  const handleToggleExpand = useCallback(
    async (employeeId: number) => {
      const isExpanded = expandedIds.includes(employeeId);
      if (isExpanded) {
        setExpandedIds((prev) => prev.filter((id) => id !== employeeId));
        return;
      }

      const row = payrollRows.find((r) => r.employeeId === employeeId);
      if (!row?.permissions.canExpandBreakdown) {
        return;
      }

      setExpandedIds((prev) => [...prev, employeeId]);
      if (employeeId in breakdowns || !token) return;

      setBreakdownLoadingId(employeeId);
      try {
        const res = await getRunPayrollBreakdown(token, employeeId, {
          month: filters.month,
          year: filters.year,
          calculation_mode: filters.calculationMode,
          include_overtime: filters.includeOvertime,
          include_penalty: filters.includePenalty,
        });
        const data = res.data as Record<string, unknown>;
        setBreakdowns((prev) => ({
          ...prev,
          [employeeId]: mapBreakdownResponse(data),
        }));
      } catch {
        setBreakdowns((prev) => ({ ...prev, [employeeId]: null }));
      } finally {
        setBreakdownLoadingId(null);
      }
    },
    [expandedIds, payrollRows, breakdowns, token, filters.month, filters.year, filters.calculationMode, filters.includeOvertime, filters.includePenalty],
  );

  const handleOtChange = useCallback(
    async (employeeId: number, enabled: boolean) => {
      if (!token) return;
      const row = payrollRows.find((r) => r.employeeId === employeeId);
      if (!row?.permissions.canToggleOt || !row.payrollRunId) {
        toast.error("OT cannot be changed for this employee.");
        return;
      }

      try {
        await updatePayrollRunOtAllowed(token, row.payrollRunId, enabled);
        toast.success(enabled ? "OT enabled." : "OT disabled.");
        await refetchAfterMutation();
      } catch (err) {
        toast.error(apiErrorMessage(err, "Unable to update OT setting."));
      }
    },
    [token, payrollRows, refetchAfterMutation],
  );

  const handleBulkOt = useCallback(
    async (enabled: boolean) => {
      if (!token || selectedIds.length === 0) return;

      const withRuns = payrollRows.filter(
        (r) => selectedIds.includes(r.employeeId) && r.payrollRunId && r.permissions.canToggleOt,
      );
      if (withRuns.length === 0) {
        toast.error("Selected employees cannot have OT changed.");
        return;
      }

      setActionBusy(true);
      try {
        const result = await bulkUpdatePayrollRunOtAllowed(token, {
          month: filters.month,
          year: filters.year,
          employee_ids: withRuns.map((r) => r.employeeId),
          ot_allowed: enabled,
        });
        const updated = Number((result.data as Record<string, unknown>)?.updated_count ?? 0);
        toast.success(
          updated > 0
            ? `OT ${enabled ? "enabled" : "disabled"} for ${updated} employee(s).`
            : "No payroll runs were updated.",
        );
        await refetchAfterMutation();
      } catch (err) {
        toast.error(apiErrorMessage(err, "Unable to update OT settings."));
      } finally {
        setActionBusy(false);
      }
    },
    [token, selectedIds, payrollRows, filters.month, filters.year, refetchAfterMutation],
  );

  const handleSort = useCallback((column: RunPayrollSortBy) => {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
    setPage(1);
  }, [sortBy]);

  const handleMarkPaid = useCallback(() => {
    setPaymentDrawerOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">Run Payroll</h1>
        <PageRefreshingBadge show={isRefreshing} />
      </div>

      {isLoading ? (
        <PayrollPageSkeleton />
      ) : hasData ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <PayrollFilters
              filters={filters}
              filterOptions={filterOptions}
              onChange={handleFilterChange}
              onReset={handleResetFilters}
              onGenerate={() => handleGeneratePayroll(false)}
              generating={actionBusy}
            />
          </div>

          <div className="space-y-4 lg:col-span-9">
            <PayrollSummaryCards stats={summaryStats} />

            <PayrollToolbar
              selectedCount={selectedIds.length}
              confirmationSentCount={confirmationCounts.sent}
              confirmationConfirmedCount={confirmationCounts.confirmed}
              busy={actionBusy}
              revertEligibleCount={revertEligibleRows.length}
              onGenerate={() => handleGeneratePayroll(true)}
              onSave={handleSavePayroll}
              onFinalize={handleFinalizePayroll}
              onRevertToDraft={() => void handleRevertToDraft()}
              onRecordPayment={() => setPaymentDrawerOpen(true)}
              onDownloadSalarySheet={handleDownloadSalarySheet}
              onDownloadBankFile={handleDownloadBankFile}
              onGeneratePayslips={handleGeneratePayslips}
              onSendSalaryConfirmation={handleSendSalaryConfirmation}
              onViewConfirmationLogs={() => setConfirmationLogsOpen(true)}
            />

            <PayrollBulkActions
              selectedCount={selectedIds.length}
              disabled={actionBusy}
              revertEligibleCount={revertEligibleRows.length}
              onEnableOt={() => handleBulkOt(true)}
              onDisableOt={() => handleBulkOt(false)}
              onGenerate={() => handleGeneratePayroll(true)}
              onFinalize={handleFinalizePayroll}
              onRevertToDraft={() => void handleRevertToDraft()}
              onMarkPaid={handleMarkPaid}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                Showing {payrollRows.length} of {paginationTotal} staff
                {periodLabel ? ` · ${periodLabel}` : ""}
              </span>
              {pagination.last_page && pagination.last_page > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs">
                    Page {page} of {pagination.last_page}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= (pagination.last_page ?? 1)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>

            <PayrollTable
              rows={payrollRows}
              calculationMode={filters.calculationMode}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              breakdowns={breakdowns}
              breakdownLoadingId={breakdownLoadingId}
              month={filters.month}
              year={filters.year}
              confirmationVersion={confirmationVersion}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              onSelectAll={handleSelectAll}
              onToggleSelect={handleToggleSelect}
              onToggleExpand={handleToggleExpand}
              onOtChange={handleOtChange}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Unable to load run payroll data.</p>
      )}

      <RecordPaymentDrawer
        open={paymentDrawerOpen}
        periodLabel={periodLabel}
        rows={payrollRows}
        selectedIds={selectedIds}
        saving={savingPayment}
        onClose={() => setPaymentDrawerOpen(false)}
        onSave={handleSavePayments}
      />

      <SalaryConfirmationLogsDrawer
        open={confirmationLogsOpen}
        periodLabel={periodLabel || `${filters.month}/${filters.year}`}
        logs={confirmationLogs}
        onClose={() => setConfirmationLogsOpen(false)}
      />
    </div>
  );
}

export default function RunPayrollPage() {
  return (
    <Suspense fallback={<PayrollPageSkeleton />}>
      <RunPayrollContent />
    </Suspense>
  );
}
