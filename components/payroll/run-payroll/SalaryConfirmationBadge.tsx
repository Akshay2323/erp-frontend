"use client";

import { CheckCircle2, Clock3, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalaryConfirmationStatus } from "@/lib/payroll/salary-confirmation-store";

const LABELS: Record<
  SalaryConfirmationStatus,
  { label: string; className: string; Icon: typeof Send }
> = {
  not_sent: {
    label: "Not sent",
    className: "bg-muted text-muted-foreground",
    Icon: Send,
  },
  sent: {
    label: "Sent",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    Icon: Clock3,
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
};

type SalaryConfirmationBadgeProps = {
  status: SalaryConfirmationStatus;
  className?: string;
};

export function SalaryConfirmationBadge({ status, className }: SalaryConfirmationBadgeProps) {
  const meta = LABELS[status] ?? LABELS.not_sent;
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        meta.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
