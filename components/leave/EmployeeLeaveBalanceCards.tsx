"use client";

import { Check } from "lucide-react";

import type { LeaveTypeEligibility } from "@/lib/leave-apply-utils";
import { cn } from "@/lib/utils";

type EmployeeLeaveBalanceCardsProps = {
  items: LeaveTypeEligibility[];
  selectedId: number;
  onSelect: (id: number) => void;
  loading?: boolean;
  compact?: boolean;
};

export function EmployeeLeaveBalanceCards({
  items,
  selectedId,
  onSelect,
  loading,
  compact,
}: EmployeeLeaveBalanceCardsProps) {
  if (loading) {
    return (
      <div
        className={cn(
          "grid gap-3",
          compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
        )}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            className="h-24 animate-pulse rounded-xl border border-border bg-muted/40"
            key={i}
          />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
        <p className="text-sm font-medium text-foreground">No leave types available</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Contact HR if you need help with your leave setup.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-3",
        compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
      )}
    >
      {items.map((item) => {
        const selected = selectedId === item.leave_type_id;
        const lowBalance = !item.is_unpaid_type && item.balance <= 1;

        return (
          <button
            className={cn(
              "relative rounded-xl border bg-card p-4 text-left transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected
                ? "border-primary ring-1 ring-primary/30 shadow-sm"
                : "border-border hover:border-primary/40",
            )}
            key={item.leave_type_id}
            onClick={() => onSelect(item.leave_type_id)}
            suppressHydrationWarning
            type="button"
          >
            {selected ? (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            ) : null}

            <p className="pr-6 font-semibold text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.code}</p>

            <div className="mt-3 flex items-end justify-between gap-2">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {item.is_unpaid_type ? "—" : item.balance}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.is_unpaid_type ? "Unpaid (LWP)" : "days left"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {item.allow_half_day ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Half-day
                  </span>
                ) : null}
                {lowBalance && !item.is_unpaid_type ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    Low balance
                  </span>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
