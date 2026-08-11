import { memo } from "react";
import { cn } from "@/lib/utils";
import type { PayrollDisplayStatus } from "@/lib/payroll/run-payroll-types";

const STATUS_STYLES: Record<PayrollDisplayStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  draft: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  generated: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
  finalized: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  hold: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
};

const STATUS_LABELS: Record<PayrollDisplayStatus, string> = {
  pending: "Pending",
  draft: "Draft",
  generated: "Generated",
  finalized: "Finalized",
  paid: "Paid",
  hold: "Hold",
};

type PayrollStatusBadgeProps = {
  status: PayrollDisplayStatus;
  className?: string;
};

export const PayrollStatusBadge = memo(function PayrollStatusBadge({
  status,
  className,
}: PayrollStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
});
