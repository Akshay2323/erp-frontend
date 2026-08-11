"use client";

import { memo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FeedEmployeeAvatar } from "@/components/live-attendance/FeedEmployeeAvatar";
import { formatIndianCurrency } from "@/lib/payroll/format-currency";
import { formatRowCtc } from "@/lib/payroll/run-payroll-mapper";
import type { PayrollSalaryBreakdown, PayrollStaffRow } from "@/lib/payroll/run-payroll-types";
import { PayrollExpandableDetails } from "./PayrollExpandableDetails";
import { PayrollStatusBadge } from "./PayrollStatusBadge";
import { OTToggle } from "./OTToggle";
import { SalaryConfirmationBadge } from "./SalaryConfirmationBadge";
import type { SalaryConfirmationStatus } from "@/lib/payroll/salary-confirmation-store";

type PayrollRowProps = {
  row: PayrollStaffRow;
  selected: boolean;
  expanded: boolean;
  confirmationStatus: SalaryConfirmationStatus;
  breakdown: PayrollSalaryBreakdown | null;
  breakdownLoading: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onOtChange: (enabled: boolean) => void;
};

export const PayrollRow = memo(function PayrollRow({
  row,
  selected,
  expanded,
  confirmationStatus,
  breakdown,
  breakdownLoading,
  onToggleSelect,
  onToggleExpand,
  onOtChange,
}: PayrollRowProps) {
  const hourMode = row.attendanceCalculationMode === "hour";

  return (
    <>
      <tr className="border-t border-border/60 hover:bg-muted/20">
        <td className="p-3 w-10">
          <input type="checkbox" className="rounded" checked={selected} onChange={onToggleSelect} />
        </td>
        <td className="p-3 w-10">
          {row.permissions.canExpandBreakdown ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={expanded ? "Collapse row" : "Expand row"}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : null}
        </td>
        <td className="p-3 min-w-[200px]">
          <div className="flex items-center gap-3">
            <FeedEmployeeAvatar
              className="h-9 w-9 shrink-0"
              name={row.fullName}
              src={row.profilePhotoUrl ?? undefined}
              textClassName="text-[10px] font-semibold"
            />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{row.fullName}</p>
              <p className="text-xs text-muted-foreground">{row.employeeCode || "—"}</p>
              {row.hasSalaryStructure ? (
                <p className="text-xs text-muted-foreground">{formatRowCtc(row)}</p>
              ) : null}
            </div>
          </div>
        </td>
        <td className="p-3">
          <PayrollStatusBadge status={row.payrollStatus} />
        </td>
        <td className="p-3">
          <SalaryConfirmationBadge status={confirmationStatus} />
        </td>
        <td className="p-3">
          <OTToggle checked={row.otAllowed} disabled={!row.permissions.canToggleOt} onChange={onOtChange} />
        </td>
        {hourMode ? (
          <>
            <td className="p-3 tabular-nums">{row.totalHours.toFixed(1)}</td>
            <td className="p-3 tabular-nums">{row.workedHours.toFixed(1)}</td>
            <td className="p-3 tabular-nums">{row.otHours.toFixed(1)}</td>
          </>
        ) : (
          <>
            <td className="p-3 tabular-nums">{row.workingDays}</td>
            <td className="p-3 tabular-nums">{row.presentDays.toFixed(1)}</td>
            <td className="p-3 tabular-nums">{row.otDays.toFixed(1)}</td>
          </>
        )}
        <td className="p-3 tabular-nums font-medium">{formatIndianCurrency(row.actualMonthlySalary)}</td>
        <td className="p-3 tabular-nums font-medium">{formatIndianCurrency(row.grossSalary)}</td>
        <td className="p-3 tabular-nums">{formatIndianCurrency(row.overtimeAmount)}</td>
        <td className="p-3 tabular-nums">{formatIndianCurrency(row.penalty)}</td>
        <td className="p-3 tabular-nums">{formatIndianCurrency(row.deduction)}</td>
        <td className="p-3 tabular-nums font-medium">{formatIndianCurrency(row.netPayable)}</td>
        <td className="p-3 tabular-nums">{formatIndianCurrency(row.paid)}</td>
        <td className="p-3 tabular-nums">{formatIndianCurrency(row.pending)}</td>
      </tr>
      {expanded ? (
        <tr className="bg-muted/10">
          <td colSpan={17} className="p-0">
            <PayrollExpandableDetails breakdown={breakdown} loading={breakdownLoading} />
          </td>
        </tr>
      ) : null}
    </>
  );
});
