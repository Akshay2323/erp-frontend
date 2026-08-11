"use client";

import { memo } from "react";
import { formatIndianCurrency } from "@/lib/payroll/format-currency";
import type { PayrollSalaryBreakdown } from "@/lib/payroll/run-payroll-types";

type BreakdownRowProps = { label: string; value: number; emphasize?: boolean };

const BreakdownRow = memo(function BreakdownRow({ label, value, emphasize }: BreakdownRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={emphasize ? "font-semibold text-foreground" : "font-medium tabular-nums"}>
        {formatIndianCurrency(value)}
      </span>
    </div>
  );
});

type PayrollExpandableDetailsProps = {
  breakdown: PayrollSalaryBreakdown | null;
  loading?: boolean;
};

export const PayrollExpandableDetails = memo(function PayrollExpandableDetails({
  breakdown,
  loading,
}: PayrollExpandableDetailsProps) {
  if (loading) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        Loading salary breakdown…
      </div>
    );
  }

  if (!breakdown) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        Salary breakdown is not available for this employee.
      </div>
    );
  }

  const hourMode = breakdown.calculationMode === "hour";

  return (
    <div className="grid gap-4 border-t border-border/60 bg-muted/15 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
      {hourMode ? (
        <>
          {breakdown.hourlyRate != null ? (
            <BreakdownRow label="Hourly Rate" value={breakdown.hourlyRate} />
          ) : null}
          {breakdown.monthlyExpectedHours != null ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Monthly Expected Hours</span>
              <span className="font-medium tabular-nums">{breakdown.monthlyExpectedHours.toFixed(2)}</span>
            </div>
          ) : null}
          {breakdown.regularHoursEarning != null ? (
            <BreakdownRow label="Regular Hours Earning" value={breakdown.regularHoursEarning} />
          ) : null}
        </>
      ) : (
        <>
          {breakdown.dailyRate != null ? <BreakdownRow label="Daily Rate" value={breakdown.dailyRate} /> : null}
          {breakdown.payableDays != null ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Payable Days</span>
              <span className="font-medium tabular-nums">{breakdown.payableDays.toFixed(1)}</span>
            </div>
          ) : null}
        </>
      )}
      <BreakdownRow label="Basic Salary" value={breakdown.basicSalary} />
      <BreakdownRow label="Allowances" value={breakdown.allowances} />
      <BreakdownRow label="HRA" value={breakdown.hra} />
      <BreakdownRow label="Special Allowance" value={breakdown.specialAllowance} />
      <BreakdownRow label="Bonus" value={breakdown.bonus} />
      <BreakdownRow label="OT Amount" value={breakdown.otAmount} />
      {breakdown.lopAmount != null && breakdown.lopAmount > 0 ? (
        <BreakdownRow label="LOP Amount" value={breakdown.lopAmount} />
      ) : null}
      <BreakdownRow label="Late Penalty" value={breakdown.latePenalty} />
      <BreakdownRow label="Half Day Penalty" value={breakdown.halfDayPenalty} />
      <BreakdownRow label="Loan Deduction" value={breakdown.loanDeduction} />
      <BreakdownRow label="Advance Deduction" value={breakdown.advanceDeduction} />
      <BreakdownRow label="PF" value={breakdown.pf} />
      <BreakdownRow label="ESI" value={breakdown.esi} />
      <BreakdownRow label="Professional Tax" value={breakdown.professionalTax} />
      <BreakdownRow label="Manual Deduction" value={breakdown.manualDeduction} />
      <div className="sm:col-span-2 lg:col-span-3 border-t border-border/50 pt-3">
        <BreakdownRow label="Net Salary" value={breakdown.netSalary} emphasize />
      </div>
    </div>
  );
});
