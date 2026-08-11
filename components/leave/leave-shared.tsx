"use client";

import { Activity, BriefcaseBusiness, Calendar, Coffee } from "lucide-react";

import type { LeaveRequest, LeaveRequestEmployee } from "@/lib/api/leave-requests";
import { formatDisplayDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

export function formatEmployeeName(employee?: LeaveRequestEmployee | null): string {
  if (!employee) return "-";
  if (employee.full_name?.trim()) return employee.full_name.trim();
  if (employee.name?.trim()) return employee.name.trim();
  const parts = [employee.first_name, employee.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (employee.employee_code) return employee.employee_code;
  return "-";
}

export function LeaveStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    normalized === "approved"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : normalized === "rejected"
        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
        : normalized === "cancelled"
          ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", className)}>
      {status}
    </span>
  );
}

export function LeaveRequestDateRange({ request }: { request: LeaveRequest }) {
  const isHalf =
    request.is_half_day === true ||
    request.total_days === 0.5 ||
    String(request.half_day_session ?? "").length > 0;

  return (
    <span>
      {formatDisplayDate(request.from_date)}
      {request.to_date !== request.from_date ? ` – ${formatDisplayDate(request.to_date)}` : ""}
      <span className="ml-1 text-muted-foreground">
        ({request.total_days} day{request.total_days === 1 ? "" : "s"}
        {isHalf ? ", half day" : ""}
        {request.is_unpaid ? ", unpaid" : ""})
      </span>
    </span>
  );
}

type LeaveBalanceItem = {
  leave_type?: { name?: string };
  name?: string;
  type?: string;
  allocated?: number;
  days_allocated?: number;
  total?: number;
  balance?: number;
  used?: number;
};

export function LeaveBalancePanel({ balances }: { balances: LeaveBalanceItem[] }) {
  if (!balances.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-indigo-500" />
          Leave Balance
        </h2>
        <p className="text-sm text-muted-foreground">No leave balance data available.</p>
      </div>
    );
  }

  const colors = [
    { bg: "bg-sky-100", text: "text-sky-600", fill: "bg-sky-500", icon: <Coffee className="h-4 w-4" /> },
    { bg: "bg-rose-100", text: "text-rose-600", fill: "bg-rose-500", icon: <Activity className="h-4 w-4" /> },
    { bg: "bg-amber-100", text: "text-amber-600", fill: "bg-amber-500", icon: <BriefcaseBusiness className="h-4 w-4" /> },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Calendar className="h-5 w-5 text-indigo-500" />
        Leave Balance
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((lb, i) => {
          const name = lb.leave_type?.name || lb.name || lb.type || "Leave";
          const total = Number(lb.allocated ?? lb.days_allocated ?? lb.total ?? 0);
          const balance =
            lb.balance !== undefined ? Number(lb.balance) : Math.max(0, total - Number(lb.used ?? 0));
          const pct = total > 0 ? Math.min(100, (balance / total) * 100) : 0;
          const color = colors[i % colors.length];

          return (
            <div key={`${name}-${i}`} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("rounded-lg p-2", color.bg, color.text)}>{color.icon}</div>
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {balance} of {total} days left
                    </p>
                  </div>
                </div>
                <span className="text-lg font-semibold">{balance}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", color.fill)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
