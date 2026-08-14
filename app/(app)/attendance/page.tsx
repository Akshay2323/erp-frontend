"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  XCircle,
  Loader2,
  AlertCircle,
  TrendingUp,
  Coffee,
  Moon,
  Search,
  ShieldCheck,
  User,
  Timer,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PanelSkeleton } from "@/components/ui/page-states";
import { EmployeeListAvatar, getEmployeeDisplayName } from "@/components/employee/EmployeeListAvatar";
import { useAuthToken } from "@/lib/use-auth-token";
import { getEmployees, resolveEmployeeSession, type EmployeeRecord } from "@/lib/api/employee";
import {
  getEmployeeMonthlySummary,
  formatHoursAsClock,
  formatBreakMinutes,
  formatWorkingHoursSummaryValue,
  parseWorkingHoursToDecimal,
  type EmployeeMonthlySummaryEmployee,
  type EmployeeMonthlySummaryShift,
} from "@/lib/api/attendance";
import { BreakCountValue } from "@/components/attendance/BreakCountValue";

/* ─────────────────────────────────────────────────────────── types */
type DayRecord = {
  date: string;
  day?: string;
  status?: string;
  punch_in?: string | null;
  punch_out?: string | null;
  working_hours?: string | number | null;
  overtime_hours?: string | number | null;
  late_status?: string | null;
  late_minutes?: number;
  late_mark?: boolean;
  remarks?: string | null;
  break_count?: number;
  [key: string]: any;
};

type SummaryMeta = {
  total_present?: number;
  total_absent?: number;
  total_leave?: number;
  total_half_day?: number;
  total_holidays?: number;
  total_working_days?: number;
  total_working_hours?: string | number;
  total_overtime_hours?: string | number;
  total_late_count?: number;
  total_late_minutes?: number;
  total_break_count?: number;
  total_break_minutes?: number;
  [key: string]: any;
};

/* ─────────────────────────────────────────────────────── helpers */
const fmt12 = (t?: string | null) => {
  if (!t) return "—";
  const d = new Date(t);
  if (!isNaN(d.getTime()))
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const m = t.match(/(\d+):(\d+)/);
  if (m) {
    let h = parseInt(m[1]);
    const min = m[2];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${min} ${ampm}`;
  }
  return t;
};

const fmtMonth = (month: string) =>
  new Date(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

const prevMonth = (m: string) => {
  const d = new Date(`${m}-01`);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const nextMonth = (m: string) => {
  const d = new Date(`${m}-01`);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const todayMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Normalize Laravel / Spatie-style roles from `auth_user` JSON. */
function collectRoleHints(u: unknown): string[] {
  if (!u || typeof u !== "object") return [];
  const o = u as Record<string, unknown>;
  const hints: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === "string" && v.trim()) hints.push(v.trim().toLowerCase());
  };
  add(o.role);
  add(o.role_name);
  add(o.user_type);
  add(o.type);
  if (typeof o.role === "object" && o.role !== null && "name" in o.role) {
    add((o.role as { name?: string }).name);
  }
  if (Array.isArray(o.roles)) {
    for (const r of o.roles) {
      if (typeof r === "string") add(r);
      else if (r && typeof r === "object" && "name" in r) add((r as { name?: string }).name);
    }
  }
  return hints;
}

function isPrivilegedAdminSession(u: unknown): boolean {
  if (!u || typeof u !== "object") return false;
  const o = u as Record<string, unknown>;
  if (o.is_admin === true || o.is_super_admin === true) return true;
  const hints = collectRoleHints(u);
  for (const r of hints) {
    if (r.includes("admin") || r.includes("superadmin") || r === "super_admin") return true;
    if (r === "hr" || r === "manager") return true;
  }
  return false;
}

const isAdmin = (role?: string, sessionUser?: unknown) => {
  if (sessionUser && isPrivilegedAdminSession(sessionUser)) return true;
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return (
    r.includes("admin") ||
    r.includes("superadmin") ||
    r === "super_admin" ||
    r === "hr" ||
    r === "manager"
  );
};

/** Some backends return `data: []` or `{ employees: [] }` instead of `{ items: [] }`. */
function employeeListItemsFromEnvelope(data: unknown): EmployeeRecord[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as EmployeeRecord[];
  if (typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.items)) return d.items as EmployeeRecord[];
  if (Array.isArray(d.data)) return d.data as EmployeeRecord[];
  if (Array.isArray(d.employees)) return d.employees as EmployeeRecord[];
  if (Array.isArray(d.rows)) return d.rows as EmployeeRecord[];
  if (Array.isArray((d as { results?: unknown }).results))
    return (d as { results: EmployeeRecord[] }).results;
  return [];
}

const employeeOptionLabel = (e: EmployeeRecord) => {
  const code = e.employee_code?.trim() || `#${e.id}`;
  const name =
    e.full_name?.trim() ||
    e.name?.trim() ||
    [e.first_name, e.last_name].filter(Boolean).join(" ").trim() ||
    "—";
  return `${code} — ${name}`;
};

const statusColor = (status?: string) => {
  const s = (status ?? "").toLowerCase();
  if (s.includes("present") || s === "p")
    return { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" };
  if (s.includes("absent") || s === "a")
    return { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" };
  if (s.includes("leave") || s === "l")
    return { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" };
  if (s.includes("half") || s === "hd")
    return { bg: "bg-sky-50 dark:bg-sky-900/20", text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-500" };
  if (s.includes("holiday") || s === "h")
    return { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" };
  if (s.includes("weekend") || s === "w")
    return { bg: "bg-slate-50 dark:bg-slate-800/40", text: "text-slate-500 dark:text-slate-400", dot: "bg-slate-400" };
  return { bg: "bg-muted/40", text: "text-muted-foreground", dot: "bg-muted-foreground" };
};

/** Late mark from shift late_rules — highlight only when actually late. */
function lateMarkDisplay(row: {
  late_mark?: boolean;
  late_status?: string | null;
  late_minutes?: number;
}) {
  const status = String(row.late_status ?? "").trim();
  const isLate =
    row.late_mark === true ||
    /^late$/i.test(status) ||
    /penalty/i.test(status);
  if (!isLate) {
    return { label: "—", minutes: 0, isLate: false, withPenalty: false };
  }
  const withPenalty = /penalty/i.test(status);
  const minutes = Number(row.late_minutes ?? 0);
  return {
    label: withPenalty ? "Late + Penalty" : "Late",
    minutes: Number.isFinite(minutes) ? minutes : 0,
    isLate: true,
    withPenalty,
  };
}

function recordNestedName(
  value: unknown,
): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const s = value.trim();
    return s || null;
  }
  if (typeof value === "object" && value !== null && "name" in value) {
    const n = String((value as { name?: unknown }).name ?? "").trim();
    return n || null;
  }
  return null;
}

function EmployeeProfileSnapshot({
  name,
  code,
  email,
  department,
  designation,
  branch,
  shiftName,
  shiftTiming,
  avatarEmployee,
}: {
  name: string;
  code?: string | null;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  branch?: string | null;
  shiftName?: string | null;
  shiftTiming?: string | null;
  avatarEmployee?: EmployeeRecord | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-4 border-b border-border/60 pb-4">
        {avatarEmployee ? (
          <EmployeeListAvatar
            employee={avatarEmployee}
            className="h-14 w-14 shrink-0 ring-2 ring-primary/15"
            textClassName="text-sm font-semibold"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/15">
            <User className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{name || "—"}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {code || "—"}
            {department ? ` · ${department}` : ""}
          </p>
          {email ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
          ) : null}
        </div>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Code</dt>
          <dd className="mt-0.5 font-medium text-foreground">{code || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</dt>
          <dd className="mt-0.5 text-foreground">{department || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Designation</dt>
          <dd className="mt-0.5 text-foreground">{designation || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Branch</dt>
          <dd className="mt-0.5 text-foreground">{branch || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shift Name</dt>
          <dd className="mt-0.5 text-foreground">{shiftName || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shift Timing</dt>
          <dd className="mt-0.5 tabular-nums text-foreground">{shiftTiming || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ───────────────────────────────────────── shared records display */
function AttendanceTable({
  records,
  summary,
  loading,
  error,
  empCodeReady,
  month,
  onRetry,
}: {
  records: DayRecord[];
  summary: SummaryMeta;
  loading: boolean;
  error: string;
  empCodeReady: boolean;
  month: string;
  onRetry: () => void;
}) {
  const workingHoursDaysCount = records.filter(
    (r) => parseWorkingHoursToDecimal(r.working_hours) != null,
  ).length;

  const hasMonthOvertime = (parseWorkingHoursToDecimal(summary.total_overtime_hours) ?? 0) > 0;
  const lateCount = Number(summary.total_late_count ?? 0);
  const breakCount = Number(summary.total_break_count ?? 0);

  const stats: {
    label: string;
    value: string | number;
    sub?: string;
    icon: typeof CheckCircle2;
    color: string;
    bg: string;
  }[] = [
    { label: "Present",  value: summary.total_present  ?? 0, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
    { label: "Absent",   value: summary.total_absent   ?? 0, icon: XCircle,      color: "text-red-600 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-900/20" },
    { label: "Leave",    value: summary.total_leave    ?? 0, icon: Moon,         color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20" },
    { label: "Half Day", value: summary.total_half_day ?? 0, icon: Coffee,       color: "text-sky-600 dark:text-sky-400",         bg: "bg-sky-50 dark:bg-sky-900/20" },
    { label: "Holidays", value: summary.total_holidays ?? 0, icon: Calendar,     color: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-50 dark:bg-purple-900/20" },
    {
      label: "Late marks",
      value: lateCount,
      sub:
        !loading && lateCount > 0 && Number(summary.total_late_minutes ?? 0) > 0
          ? `${summary.total_late_minutes} min total`
          : undefined,
      icon: Clock,
      color: lateCount > 0 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground",
      bg: lateCount > 0 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-muted",
    },
    {
      label: "Break Count",
      value: breakCount,
      sub:
        !loading && Number(summary.total_break_minutes ?? 0) > 0
          ? formatBreakMinutes(summary.total_break_minutes)
          : undefined,
      icon: Coffee,
      color: breakCount > 0 ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground",
      bg: breakCount > 0 ? "bg-cyan-50 dark:bg-cyan-900/20" : "bg-muted",
    },
    {
      label: "Working hours",
      value: formatWorkingHoursSummaryValue(summary.total_working_hours),
      sub:
        !loading && workingHoursDaysCount > 0
          ? `${workingHoursDaysCount} day${workingHoursDaysCount === 1 ? "" : "s"} with hours`
          : undefined,
      icon: Timer,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-900/20",
    },
    {
      label: "Overtime",
      value: formatHoursAsClock(summary.total_overtime_hours ?? 0),
      icon: TrendingUp,
      color: hasMonthOvertime ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground",
      bg: hasMonthOvertime ? "bg-indigo-50 dark:bg-indigo-900/20" : "bg-muted",
    },
  ];

  const totalWhDisplay = formatWorkingHoursSummaryValue(summary.total_working_hours);

  return (
    <>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className={`mb-2 inline-flex rounded-lg p-2 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            {s.sub ? (
              <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{s.sub}</p>
            ) : null}
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Calendar className="h-4 w-4 text-primary" />
            Daily Breakdown — {fmtMonth(month)}
          </h2>
        </div>

        {!empCodeReady && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Resolving employee profile…</p>
          </div>
        )}
        {empCodeReady && loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading attendance records…</p>
          </div>
        )}
        {empCodeReady && !loading && error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <p className="text-sm text-destructive font-medium text-center max-w-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
          </div>
        )}
        {empCodeReady && !loading && !error && records.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Calendar className="h-10 w-10 opacity-30" />
            <p className="text-sm">No records found for {fmtMonth(month)}.</p>
          </div>
        )}
        {empCodeReady && !loading && !error && records.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Day</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Punch In</th>
                  <th className="px-5 py-3">Punch Out</th>
                  <th className="px-5 py-3">Late Mark</th>
                  <th className="px-5 py-3">Break Count</th>
                  <th className="px-5 py-3">Working Hours</th>
                  <th className="px-5 py-3">Overtime</th>
                  <th className="px-5 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((row, i) => {
                  const colors = statusColor(row.status);
                  const dateStr = row.date
                    ? new Date(row.date).toLocaleDateString("en-US", { day: "2-digit", month: "short" })
                    : "—";
                  const dayStr =
                    row.day ??
                    (row.date ? new Date(row.date).toLocaleDateString("en-US", { weekday: "short" }) : "—");
                  const otDecimal = parseWorkingHoursToDecimal(row.overtime_hours) ?? 0;
                  const hasOt = otDecimal > 0;
                  const late = lateMarkDisplay(row);
                  return (
                    <tr key={i} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-3 font-medium">{dateStr}</td>
                      <td className="px-5 py-3 text-muted-foreground">{dayStr}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                          {row.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 tabular-nums text-muted-foreground">{fmt12(row.punch_in)}</td>
                      <td className="px-5 py-3 tabular-nums text-muted-foreground">{fmt12(row.punch_out)}</td>
                      <td className="px-5 py-3">
                        {late.isLate ? (
                          <span
                            className={`inline-flex flex-col gap-0.5 rounded-md px-2 py-1 text-xs font-medium ${
                              late.withPenalty
                                ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                : "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                            }`}
                          >
                            <span>{late.label}</span>
                            {late.minutes > 0 ? (
                              <span className="tabular-nums font-normal opacity-80">+{late.minutes}m</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <BreakCountValue
                          breakCount={row.break_count}
                          totalBreakMinutes={row.total_break_minutes}
                        />
                      </td>
                      <td className="px-5 py-3 tabular-nums">
                        {row.working_hours != null && row.working_hours !== ""
                          ? formatWorkingHoursSummaryValue(row.working_hours)
                          : "—"}
                      </td>
                      <td
                        className={`px-5 py-3 tabular-nums ${
                          hasOt
                            ? "font-medium text-indigo-600 dark:text-indigo-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatHoursAsClock(row.overtime_hours)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{row.remarks || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-medium">
                  <td colSpan={7} className="px-5 py-3 text-right text-muted-foreground">
                    Month total (working hours)
                  </td>
                  <td className="px-5 py-3 tabular-nums text-foreground">{totalWhDisplay}</td>
                  <td colSpan={2} className="px-5 py-3 text-xs font-normal text-muted-foreground">
                    {workingHoursDaysCount > 0
                      ? `${workingHoursDaysCount} day${workingHoursDaysCount === 1 ? "" : "s"} in total`
                      : ""}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────── main component */
export default function AttendancePage() {
  const token = useAuthToken();

  // Session info
  const [sessionUser, setSessionUser] = useState<Record<string, unknown> | null>(null);
  const [role, setRole] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [sessionReady, setSessionReady] = useState(false);

  // Employee view state
  const [empCode, setEmpCode] = useState<string | null>(null);
  const [empCodeReady, setEmpCodeReady] = useState(false);
  const [month, setMonth] = useState(todayMonth());
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [summary, setSummary] = useState<SummaryMeta>({});
  const [profileEmployee, setProfileEmployee] = useState<EmployeeMonthlySummaryEmployee | null>(null);
  const [profileShift, setProfileShift] = useState<EmployeeMonthlySummaryShift | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Admin: directory + selection
  const [adminEmployees, setAdminEmployees] = useState<EmployeeRecord[]>([]);
  const [adminEmployeesLoading, setAdminEmployeesLoading] = useState(false);
  const [adminEmployeesError, setAdminEmployeesError] = useState("");
  const [adminSelectedCode, setAdminSelectedCode] = useState("");
  const [adminSelectedEmployee, setAdminSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [adminMonth, setAdminMonth] = useState(todayMonth());

  // Derived: both session role AND empcode are resolved
  const fullyReady = sessionReady && empCodeReady;

  /* ── Step 1: read role from session */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        const u = JSON.parse(raw) as Record<string, unknown>;
        setSessionUser(u);
        const roleStr =
          typeof u.role === "string"
            ? u.role
            : u.role &&
                typeof u.role === "object" &&
                u.role !== null &&
                "name" in u.role
              ? String((u.role as { name: string }).name)
              : collectRoleHints(u)[0] ?? "";
        setRole(roleStr);
        const name =
          u.name ||
          u.full_name ||
          u.employee_name ||
          `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
        if (name) setUserName(String(name));
      }
    } catch {}
    setSessionReady(true);
  }, []);

  /* ── Step 2 (employee only): resolve empcode from API */
  useEffect(() => {
    // Wait until session is read first — never act before role is known
    if (!sessionReady) return;

    // Admin: no need to resolve empcode at all
    if (isAdmin(role, sessionUser)) {
      setEmpCodeReady(true);
      return;
    }

    const resolve = async () => {
      try {
        const raw = localStorage.getItem("auth_user");
        if (!raw) { setEmpCodeReady(true); return; }
        const parsedUser = JSON.parse(raw);

        const resolved =
          token && parsedUser ? await resolveEmployeeSession(token, parsedUser) : null;
        if (resolved?.employeeCode) setEmpCode(resolved.employeeCode);
      } catch {}
      setEmpCodeReady(true);
    };
    resolve();
  }, [sessionReady, role, token]);

  /* ── Step 3: fetch monthly attendance (employee + admin) */
  const fetchData = useCallback(async (code: string, m: string) => {
    if (!token) {
      setError("Not authenticated.");
      return;
    }
    if (!code) {
      setError("Could not determine your employee code. Please ensure an employee profile is linked to your account.");
      return;
    }
    setLoading(true);
    setError("");
    setRecords([]);
    setSummary({});
    setProfileEmployee(null);
    setProfileShift(null);
    try {
      const { records: rows, summary: sum, employee, shift } = await getEmployeeMonthlySummary(
        token,
        code,
        m,
      );
      setRecords(rows);
      setSummary(sum);
      setProfileEmployee(employee);
      setProfileShift(shift);
    } catch (e: any) {
      setError(e?.message ?? "Network error.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (fullyReady && !isAdmin(role, sessionUser) && empCode) {
      fetchData(empCode, month);
    }
  }, [fullyReady, month, role, empCode, fetchData]);

  /* ── Admin: load full employee list for dropdown */
  useEffect(() => {
    if (!sessionReady || !isAdmin(role, sessionUser) || !token) return;
    let cancelled = false;
    (async () => {
      setAdminEmployeesLoading(true);
      setAdminEmployeesError("");
      try {
        const all: EmployeeRecord[] = [];
        let page = 1;
        let lastPage = 1;
        do {
          const res = await getEmployees(token, { page, per_page: 100 });
          if (cancelled) return;
          const items = employeeListItemsFromEnvelope(res.data);
          all.push(...items);
          lastPage = res.meta?.last_page ?? 1;
          page += 1;
        } while (page <= lastPage && page < 500);
        all.sort((a, b) => {
          const ca = (a.employee_code ?? `~${a.id}`).toLowerCase();
          const cb = (b.employee_code ?? `~${b.id}`).toLowerCase();
          return ca.localeCompare(cb, undefined, { numeric: true });
        });
        setAdminEmployees(all);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : "";
          setAdminEmployeesError(msg || "Failed to load employees.");
        }
      } finally {
        if (!cancelled) setAdminEmployeesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionReady, role]);

  /* ── Admin: fetch attendance when employee + month are chosen */
  useEffect(() => {
    if (!sessionReady || !isAdmin(role, sessionUser)) return;
    const code = adminSelectedCode.trim();
    if (!code || !adminMonth) {
      setRecords([]);
      setSummary({});
      setProfileEmployee(null);
      setProfileShift(null);
      setError("");
      setLoading(false);
      return;
    }
    fetchData(code, adminMonth);
  }, [sessionReady, role, adminSelectedCode, adminMonth, fetchData]);

  const onAdminEmployeeSelect = (code: string) => {
    setAdminSelectedCode(code);
  };

  /* Keep profile card in sync when the directory finishes loading after a selection. */
  useEffect(() => {
    if (!isAdmin(role, sessionUser)) return;
    if (!adminSelectedCode.trim()) {
      setAdminSelectedEmployee(null);
      return;
    }
    const row =
      adminEmployees.find((e) => e.employee_code === adminSelectedCode) ?? null;
    setAdminSelectedEmployee(row);
  }, [adminEmployees, adminSelectedCode, role, sessionUser]);

  const handlePrev = () => setMonth(prevMonth(month));
  const handleNext = () => { const nm = nextMonth(month); if (nm <= todayMonth()) setMonth(nm); };

  /* ── loading session — show shell immediately */
  if (!sessionReady) {
    return (
      <section className="w-full space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-muted/70" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded-lg bg-muted/40" />
        </div>
        <PanelSkeleton className="min-h-[320px]" />
      </section>
    );
  }

  /* ════════════════════════════ ADMIN VIEW ════════════════════════════ */
  if (isAdmin(role, sessionUser)) {
    return (
      <section className="w-full space-y-5 animate-in fade-in duration-500">
        {/* Header */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Attendance Lookup</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Choose an employee and month to view their attendance summary.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-2 text-base font-semibold">
            <User className="h-4 w-4 text-primary" /> Employee &amp; month
          </h2>
          {adminEmployeesError ? (
            <p className="mb-4 text-sm text-destructive">{adminEmployeesError}</p>
          ) : null}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-1.5">
              <label
                htmlFor="admin-employee-select"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Employee
              </label>
              <div>
                {adminEmployeesLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    Loading employees…
                  </div>
                ) : (
                  <select
                    id="admin-employee-select"
                    value={adminSelectedCode}
                    onChange={(e) => onAdminEmployeeSelect(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium outline-none ring-0 transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  >
                    <option value="">Select an employee…</option>
                    {adminEmployees
                      .filter((e) => e.employee_code?.trim())
                      .map((e) => (
                        <option key={e.id} value={e.employee_code as string}>
                          {employeeOptionLabel(e)}
                          {e.email ? ` (${e.email})` : ""}
                        </option>
                      ))}
                  </select>
                )}
              </div>
              {!adminEmployeesLoading && adminEmployees.length === 0 && !adminEmployeesError ? (
                <p className="text-xs text-muted-foreground">
                  No employees were returned. Check API access and filters, or try the employee list page.
                </p>
              ) : null}
              {!adminEmployeesLoading &&
              adminEmployees.length > 0 &&
              adminEmployees.every((e) => !e.employee_code?.trim()) ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No employees have an employee code assigned. Assign codes to use attendance lookup.
                </p>
              ) : null}
            </div>

            <div className="w-full lg:w-52 space-y-1.5">
              <label
                htmlFor="admin-month"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Month
              </label>
              <input
                id="admin-month"
                type="month"
                value={adminMonth}
                max={todayMonth()}
                onChange={(e) => setAdminMonth(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium outline-none ring-0 transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={!adminSelectedCode.trim() || loading}
              className="h-10 gap-2 rounded-xl shrink-0"
              onClick={() => fetchData(adminSelectedCode.trim(), adminMonth)}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {/* Selected employee snapshot */}
        {(adminSelectedEmployee || profileEmployee) ? (
          <EmployeeProfileSnapshot
            name={
              profileEmployee?.full_name?.trim() ||
              (adminSelectedEmployee ? getEmployeeDisplayName(adminSelectedEmployee) : "") ||
              "—"
            }
            code={
              profileEmployee?.employee_code ??
              adminSelectedEmployee?.employee_code ??
              adminSelectedCode
            }
            email={profileEmployee?.email ?? adminSelectedEmployee?.email ?? null}
            department={
              profileEmployee?.department ??
              recordNestedName(adminSelectedEmployee?.department) ??
              recordNestedName(
                (adminSelectedEmployee as EmployeeRecord & { job_detail?: { department?: unknown } })
                  ?.job_detail?.department,
              )
            }
            designation={
              profileEmployee?.designation ??
              recordNestedName(adminSelectedEmployee?.designation) ??
              recordNestedName(
                (adminSelectedEmployee as EmployeeRecord & { job_detail?: { designation?: unknown } })
                  ?.job_detail?.designation,
              )
            }
            branch={
              profileEmployee?.branch ?? recordNestedName(adminSelectedEmployee?.branch)
            }
            shiftName={profileShift?.name ?? null}
            shiftTiming={profileShift?.shift_timing ?? null}
            avatarEmployee={adminSelectedEmployee}
          />
        ) : null}

        {/* Results */}
        {adminSelectedCode ? (
          <AttendanceTable
            records={records}
            summary={summary}
            loading={loading}
            error={error}
            empCodeReady={true}
            month={adminMonth}
            onRetry={() => fetchData(adminSelectedCode.trim(), adminMonth)}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-16 text-center text-sm text-muted-foreground">
            Select an employee from the list, then choose a month. Attendance loads automatically.
          </div>
        )}
      </section>
    );
  }

  /* ════════════════════════════ EMPLOYEE VIEW ═════════════════════════ */
  return (
    <section className="w-full space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">My Attendance</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your monthly attendance summary
                {userName && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {userName}
                  </span>
                )}
                {empCode && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <User className="h-3 w-3" /> {empCode}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-semibold">{fmtMonth(month)}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleNext} disabled={month === todayMonth()}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {(profileEmployee || empCode) ? (
        <EmployeeProfileSnapshot
          name={
            profileEmployee?.full_name?.trim() ||
            userName ||
            "—"
          }
          code={profileEmployee?.employee_code ?? empCode}
          email={profileEmployee?.email ?? null}
          department={profileEmployee?.department ?? null}
          designation={profileEmployee?.designation ?? null}
          branch={profileEmployee?.branch ?? null}
          shiftName={profileShift?.name ?? null}
          shiftTiming={profileShift?.shift_timing ?? null}
        />
      ) : null}

      <AttendanceTable
        records={records}
        summary={summary}
        loading={loading}
        error={error}
        empCodeReady={empCodeReady}
        month={month}
        onRetry={() => fetchData(empCode ?? "", month)}
      />
    </section>
  );
}
