import { memo } from "react";
import { Users, FileCheck, Clock, IndianRupee, TrendingUp, MinusCircle, Wallet } from "lucide-react";
import { formatIndianCurrency } from "@/lib/payroll/format-currency";
import type { PayrollSummaryStats } from "@/lib/payroll/run-payroll-types";

type PayrollSummaryCardsProps = {
  stats: PayrollSummaryStats;
};

const CARDS = [
  { key: "employees" as const, label: "Employees", icon: Users },
  { key: "generated" as const, label: "Generated Payroll", icon: FileCheck },
  { key: "pending" as const, label: "Pending Payroll", icon: Clock },
  { key: "grossSalary" as const, label: "Gross Salary", icon: IndianRupee },
  { key: "totalOt" as const, label: "Total OT", icon: TrendingUp },
  { key: "totalDeduction" as const, label: "Total Deduction", icon: MinusCircle },
  { key: "netPayable" as const, label: "Net Payable", icon: Wallet },
];

export const PayrollSummaryCards = memo(function PayrollSummaryCards({ stats }: PayrollSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {CARDS.map(({ key, label, icon: Icon }) => {
        const value = stats[key];
        const display =
          key === "employees" || key === "generated" || key === "pending"
            ? String(value)
            : formatIndianCurrency(value as number);

        return (
          <div
            key={key}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground sm:text-xl">{display}</p>
          </div>
        );
      })}
    </div>
  );
});
