"use client";

import { Loader2 } from "lucide-react";

import type { LeavePolicy } from "@/lib/api/leave-policy";

type LeavePolicySummaryProps = {
  policy: LeavePolicy | null;
  loading?: boolean;
  effectiveFrom?: string;
};

function formatAllocation(allocationType: string, days: number) {
  const unit = allocationType === "monthly" ? "month" : "year";
  return `${days} day${days === 1 ? "" : "s"} per ${unit}`;
}

export function LeavePolicySummary({ policy, loading, effectiveFrom }: LeavePolicySummaryProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading policy details…
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        Select a leave policy to see how leave balances will be allocated for this employee.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          How this policy works
        </p>
        <p className="mt-1 text-base font-semibold text-foreground">{policy.name}</p>
        {policy.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{policy.description}</p>
        ) : null}
        {effectiveFrom ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Effective from{" "}
            <span className="font-medium text-foreground">{effectiveFrom}</span>
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        {policy.leave_definitions?.map((def) => (
          <div
            className="rounded-lg border border-border/70 bg-background px-3 py-3 text-sm"
            key={def.id ?? def.leave_name}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">
                {def.leave_name}
              </p>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {formatAllocation(policy.leave_cycle, def.allowed_leaves)}
              </span>
            </div>
            <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <li>Carry forward: {def.carry_forward ? "Yes" : "No"}</li>
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Balances are credited according to each rule&apos;s allocation schedule from the effective
        date. Carry-forward and half-day settings apply when the employee applies for leave.
      </p>
    </div>
  );
}
