"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type HrStatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "primary" | "emerald" | "amber" | "rose" | "sky" | "violet";
  href?: string;
  loading?: boolean;
};

const toneStyles = {
  primary: {
    icon: "bg-primary/10 text-primary",
    value: "text-foreground",
  },
  emerald: {
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  amber: {
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-300",
  },
  rose: {
    icon: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400",
    value: "text-rose-700 dark:text-rose-300",
  },
  sky: {
    icon: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
    value: "text-sky-700 dark:text-sky-300",
  },
  violet: {
    icon: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
    value: "text-violet-700 dark:text-violet-300",
  },
};

export function HrStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  href,
  loading,
}: HrStatCardProps) {
  const styles = toneStyles[tone];

  const content = (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-3.5 sm:p-5 shadow-sm transition-colors",
        href && "hover:border-primary/30 hover:bg-muted/20",
      )}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{label}</p>
          <p className={cn("mt-1.5 text-xl sm:text-3xl font-bold tracking-tight", styles.value)}>
            {loading ? "—" : value}
          </p>
          {hint ? <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground truncate" title={hint}>{hint}</p> : null}
        </div>
        <div className={cn("rounded-xl p-2 sm:p-2.5 shrink-0", styles.icon)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl" href={href}>
        {content}
      </Link>
    );
  }

  return content;
}
