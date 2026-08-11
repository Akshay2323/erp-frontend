"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function PageRefreshingBadge({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      <Loader2 className="h-3 w-3 animate-spin" />
      Updating
    </span>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={cn("grid gap-4", count <= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-5")}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-border/60">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="px-3 py-3">
              <div className="h-4 animate-pulse rounded bg-muted/70" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-2xl border border-border bg-card p-5", className)}>
      <div className="mb-4 h-5 w-40 rounded bg-muted/70" />
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-muted/50" />
        <div className="h-4 w-5/6 rounded bg-muted/50" />
        <div className="h-4 w-2/3 rounded bg-muted/50" />
      </div>
    </div>
  );
}

export function PayrollPageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-muted/70" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-card lg:col-span-3" />
        <div className="space-y-4 lg:col-span-9">
          <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </div>
    </div>
  );
}
