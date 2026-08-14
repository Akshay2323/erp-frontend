"use client";

import { memo, useCallback } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatIndianCurrency } from "@/lib/payroll/format-currency";
import { formatRowCtc } from "@/lib/payroll/run-payroll-mapper";
import type {
  PayrollSalaryBreakdown,
  PayrollStaffRow,
  RunPayrollSortBy,
  RunPayrollSortDir,
  SalaryCalculationMode,
} from "@/lib/payroll/run-payroll-types";
import { PayrollRow } from "./PayrollRow";
import { PayrollStatusBadge } from "./PayrollStatusBadge";
import { OTToggle } from "./OTToggle";
import { PayrollExpandableDetails } from "./PayrollExpandableDetails";
import { SalaryConfirmationBadge } from "./SalaryConfirmationBadge";
import { FeedEmployeeAvatar } from "@/components/live-attendance/FeedEmployeeAvatar";
import { BreakCountValue } from "@/components/attendance/BreakCountValue";
import type { SalaryConfirmationStatus } from "@/lib/payroll/salary-confirmation-store";
import { getConfirmationStatus } from "@/lib/payroll/salary-confirmation-store";

type SortableColumn = {
  key: RunPayrollSortBy;
  label: string;
};

const SORTABLE_COLUMNS: SortableColumn[] = [
  { key: "full_name", label: "Employee" },
  { key: "payroll_status", label: "Payroll Status" },
  { key: "net_payable", label: "Net Payable" },
];

type PayrollTableProps = {
  rows: PayrollStaffRow[];
  calculationMode: SalaryCalculationMode;
  selectedIds: number[];
  expandedIds: number[];
  breakdowns: Record<number, PayrollSalaryBreakdown | null>;
  breakdownLoadingId: number | null;
  month: number;
  year: number;
  /** Bump to re-read confirmation statuses from local store. */
  confirmationVersion?: number;
  sortBy?: RunPayrollSortBy;
  sortDir?: RunPayrollSortDir;
  onSort?: (column: RunPayrollSortBy) => void;
  onSelectAll: (checked: boolean) => void;
  onToggleSelect: (employeeId: number) => void;
  onToggleExpand: (employeeId: number) => void;
  onOtChange: (employeeId: number, enabled: boolean) => void;
};

function SortIcon({
  column,
  sortBy,
  sortDir,
}: {
  column: RunPayrollSortBy;
  sortBy?: RunPayrollSortBy;
  sortDir?: RunPayrollSortDir;
}) {
  if (sortBy !== column) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

export const PayrollTable = memo(function PayrollTable({
  rows,
  calculationMode,
  selectedIds,
  expandedIds,
  breakdowns,
  breakdownLoadingId,
  month,
  year,
  confirmationVersion = 0,
  sortBy,
  sortDir,
  onSort,
  onSelectAll,
  onToggleSelect,
  onToggleExpand,
  onOtChange,
}: PayrollTableProps) {
  const hourMode = calculationMode === "hour";
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  const statusFor = (employeeId: number): SalaryConfirmationStatus => {
    void confirmationVersion;
    return getConfirmationStatus(employeeId, month, year);
  };

  const hourHeaders = hourMode
    ? ["Expected Hours", "Worked Hours", "OT Hours", "Break Count"]
    : ["Working Days", "Present Days", "OT Days", "Break Count"];

  const renderSortableHeader = (col: SortableColumn) => (
    <th key={col.key} className="p-3 text-left font-medium">
      {onSort ? (
        <button
          type="button"
          className="inline-flex items-center hover:text-foreground"
          onClick={() => onSort(col.key)}
        >
          {col.label}
          <SortIcon column={col.key} sortBy={sortBy} sortDir={sortDir} />
        </button>
      ) : (
        col.label
      )}
    </th>
  );

  const renderMobileCard = useCallback(
    (row: PayrollStaffRow) => {
      const expanded = expandedIds.includes(row.employeeId);
      const canExpand = row.permissions.canExpandBreakdown;
      return (
        <Card key={row.employeeId} className="overflow-hidden rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 rounded"
              checked={selectedIds.includes(row.employeeId)}
              onChange={() => onToggleSelect(row.employeeId)}
            />
            <FeedEmployeeAvatar
              className="h-10 w-10 shrink-0"
              name={row.fullName}
              src={row.profilePhotoUrl ?? undefined}
              textClassName="text-xs font-semibold"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{row.fullName}</p>
              <p className="text-xs text-muted-foreground">{row.employeeCode}</p>
              {row.hasSalaryStructure ? (
                <p className="text-xs text-muted-foreground">{formatRowCtc(row)}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PayrollStatusBadge status={row.payrollStatus} />
                <SalaryConfirmationBadge status={statusFor(row.employeeId)} />
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Actual Monthly</span>
              <p className="font-semibold">{formatIndianCurrency(row.actualMonthlySalary)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Overtime</span>
              <p className="font-semibold">{formatIndianCurrency(row.overtimeAmount)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Net Payable</span>
              <p className="font-semibold">{formatIndianCurrency(row.netPayable)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Pending</span>
              <p className="font-semibold">{formatIndianCurrency(row.pending)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Break Count</span>
              <div className="font-semibold">
                <BreakCountValue
                  breakCount={row.breakCount}
                  totalBreakMinutes={row.breakMinutes}
                  inline
                />
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Confirmation</span>
              <div className="mt-1">
                <SalaryConfirmationBadge status={statusFor(row.employeeId)} />
              </div>
            </div>
            <div className="col-span-2 flex items-center justify-between pt-1">
              <span className="text-muted-foreground">OT Allowed</span>
              <OTToggle
                checked={row.otAllowed}
                disabled={!row.permissions.canToggleOt}
                onChange={(v) => onOtChange(row.employeeId, v)}
              />
            </div>
          </div>
          {canExpand ? (
            <button
              type="button"
              className="mt-3 text-xs font-medium text-primary"
              onClick={() => onToggleExpand(row.employeeId)}
            >
              {expanded ? "Hide breakdown" : "View breakdown"}
            </button>
          ) : null}
          {expanded ? (
            <PayrollExpandableDetails
              breakdown={breakdowns[row.employeeId] ?? null}
              loading={breakdownLoadingId === row.employeeId}
            />
          ) : null}
        </Card>
      );
    },
    [
      breakdownLoadingId,
      breakdowns,
      confirmationVersion,
      expandedIds,
      month,
      onOtChange,
      onToggleExpand,
      onToggleSelect,
      selectedIds,
      year,
    ],
  );

  if (rows.length === 0) {
    return (
      <Card className="rounded-xl border border-border p-12 text-center text-sm text-muted-foreground shadow-sm">
        No employees match the selected filters.
      </Card>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 w-10">
                  <input type="checkbox" className="rounded" checked={allSelected} onChange={(e) => onSelectAll(e.target.checked)} />
                </th>
                <th className="p-3 w-10" />
                {renderSortableHeader(SORTABLE_COLUMNS[0])}
                {renderSortableHeader(SORTABLE_COLUMNS[1])}
                <th className="p-3 text-left font-medium">Employee Confirmation</th>
                <th className="p-3 text-left font-medium">OT Allowed</th>
                {hourHeaders.map((h) => (
                  <th key={h} className="p-3 text-left font-medium">
                    {h}
                  </th>
                ))}
                <th className="p-3 text-left font-medium">Actual Monthly Salary</th>
                <th className="p-3 text-left font-medium">Gross Salary</th>
                <th className="p-3 text-left font-medium">Overtime Amount</th>
                <th className="p-3 text-left font-medium">Penalty</th>
                <th className="p-3 text-left font-medium">Deduction</th>
                {renderSortableHeader(SORTABLE_COLUMNS[2])}
                <th className="p-3 text-left font-medium">Paid</th>
                <th className="p-3 text-left font-medium">Pending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <PayrollRow
                  key={row.employeeId}
                  row={row}
                  selected={selectedIds.includes(row.employeeId)}
                  expanded={expandedIds.includes(row.employeeId)}
                  confirmationStatus={statusFor(row.employeeId)}
                  breakdown={breakdowns[row.employeeId] ?? null}
                  breakdownLoading={breakdownLoadingId === row.employeeId}
                  onToggleSelect={() => onToggleSelect(row.employeeId)}
                  onToggleExpand={() => onToggleExpand(row.employeeId)}
                  onOtChange={(enabled) => onOtChange(row.employeeId, enabled)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cn("grid gap-3 lg:hidden")}>{rows.map(renderMobileCard)}</div>
    </>
  );
});
