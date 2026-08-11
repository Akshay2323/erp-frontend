"use client";

import {
  Clock,
  DollarSign,
  Wallet,
  Minus,
  ChevronLeft,
  ChevronRight,
  User,
  ShieldCheck,
  Loader2,
  Download,
  AlertCircle,
  Zap,
  Timer,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmSalaryModal } from "@/components/payroll/ConfirmSalaryModal";
import { SalaryConfirmationBadge } from "@/components/payroll/run-payroll/SalaryConfirmationBadge";
import { useAuthToken } from "@/lib/use-auth-token";
import { API_BASE_URL } from "@/lib/config";
import {
  downloadMySalaryPayslip,
  getMySalary,
  type DownloadMySalaryPayslipError,
} from "@/lib/api/payroll";
import { resolveEmployeeSession } from "@/lib/api/employees/methods";
import { clearAuthSession } from "@/lib/auth-cookie";
import { readAuthUser, resolveEmployeeId } from "@/lib/auth-session";
import { confirmSalaryByEmployee, findConfirmationByEmployeeCode } from "@/lib/payroll/salary-confirmation-store";
import { notifyAdminEmployeeEvent } from "@/lib/api/admin-employee-event";
import {
  useSalaryConfirmationStatus,
  useSalaryConfirmationVersion,
} from "@/lib/payroll/use-salary-confirmation";

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isPayslipDownloadError(err: unknown): err is DownloadMySalaryPayslipError {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as DownloadMySalaryPayslipError).status === "number"
  );
}

const fmtCurrency = (v: number) =>
  `₹ ${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtHrs = (h: number) =>
  h === 0 ? "0h" : `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`.replace(" 0m", "");

const fmt12 = (t?: string | null) => {
  if (!t) return "—";
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${min} ${ampm}`;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime()))
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return t;
};

const statusColor = (status?: string | null, isFuture?: boolean) => {
  if (isFuture) {
    return {
      bg: "bg-slate-50 dark:bg-slate-800/40",
      text: "text-slate-400 dark:text-slate-500",
      dot: "bg-slate-300",
      label: "Upcoming",
    };
  }
  const s = (status ?? "").toLowerCase();
  if (s.includes("present"))
    return { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", label: status ?? "Present" };
  if (s.includes("absent"))
    return { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300", dot: "bg-red-500", label: status ?? "Absent" };
  if (s.includes("leave"))
    return { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500", label: status ?? "Leave" };
  if (s.includes("holiday"))
    return { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500", label: status ?? "Holiday" };
  if (s.includes("week"))
    return { bg: "bg-slate-50 dark:bg-slate-800/40", text: "text-slate-500 dark:text-slate-400", dot: "bg-slate-400", label: status ?? "Week Off" };
  return { bg: "bg-muted/40", text: "text-muted-foreground", dot: "bg-muted-foreground", label: status ?? "—" };
};

const ATTENDANCE_COUNT_STYLES: Record<string, { color: string; bg: string }> = {
  Present: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  Absent: { color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
  "Week Off": { color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800/40" },
  Holiday: { color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
  Leave: { color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20" },
};

function isAdminUser(u: unknown): boolean {
  if (!u || typeof u !== "object") return false;
  const o = u as Record<string, unknown>;
  if (o.is_admin === true || o.is_super_admin === true) return true;
  const hints: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === "string" && v.trim()) hints.push(v.trim().toLowerCase());
  };
  add(o.role); add(o.role_name); add(o.user_type);
  if (Array.isArray(o.roles))
    o.roles.forEach((r) =>
      typeof r === "string" ? add(r) : add((r as Record<string, unknown>)?.name),
    );
  return hints.some(
    (r) => r.includes("admin") || r === "hr" || r === "manager" || r === "super_admin",
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE — Hour Base Salary
   ═══════════════════════════════════════════════════════════ */
export default function MySalaryPage() {
  const token = useAuthToken();
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [sessionUser, setSessionUser] = useState<Record<string, unknown> | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | string>("");
  const [downloading, setDownloading] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resolvedSessionEmployeeId, setResolvedSessionEmployeeId] = useState<number | null>(null);

  // Load session user information from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) setSessionUser(JSON.parse(raw));
    } catch {}
    setSessionReady(true);
  }, []);

  const adminView = sessionReady && isAdminUser(sessionUser);

  // Resolve employee id for the logged-in user (needed for salary confirmation).
  useEffect(() => {
    if (!token || !sessionReady || adminView) return;
    const fromSession = resolveEmployeeId(readAuthUser());
    if (fromSession) {
      setResolvedSessionEmployeeId(fromSession);
      return;
    }
    let cancelled = false;
    void resolveEmployeeSession(token, sessionUser ?? readAuthUser()).then((resolved) => {
      if (cancelled) return;
      if (resolved?.employeeId) setResolvedSessionEmployeeId(resolved.employeeId);
    });
    return () => {
      cancelled = true;
    };
  }, [token, sessionReady, adminView, sessionUser]);

  // Fetch employees list if admin/manager view
  const employeesQuery = useQuery({
    queryKey: ["employees-list-salary", token],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}v1/employees?per_page=100`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      return json.success ? (json.data.items || []) : [];
    },
    enabled: Boolean(token) && adminView,
  });

  const employees = employeesQuery.data ?? [];

  // Default select the first employee from the list for admin view
  useEffect(() => {
    if (adminView && employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [adminView, employees, selectedEmployeeId]);

  // Fetch live salary details using react-query
  const salaryQuery = useQuery({
    queryKey: ["my-salary-data", token, month, year, selectedEmployeeId],
    queryFn: () =>
      getMySalary(token, {
        month,
        year,
        employee_id: adminView ? selectedEmployeeId : undefined,
      }),
    enabled: Boolean(token) && sessionReady && (!adminView || Boolean(selectedEmployeeId)),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const salaryData = salaryQuery.data?.data;
  const summary = salaryData?.summary;
  const period = salaryData?.period;
  const attendanceSummary = salaryData?.attendance_summary;
  const records = salaryData?.records || [];
  const netPayable = summary ? Math.max(0, summary.net_payable) : 0;

  const resolvedEmployeeId = useMemo(() => {
    if (adminView && selectedEmployeeId) {
      const n = Number(selectedEmployeeId);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    if (resolvedSessionEmployeeId) return resolvedSessionEmployeeId;
    if (!sessionUser) return null;
    const direct = Number(sessionUser.employee_id ?? sessionUser.employeeId);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const nested = sessionUser.employee;
    if (nested && typeof nested === "object") {
      const id = Number((nested as Record<string, unknown>).id);
      if (Number.isFinite(id) && id > 0) return id;
    }
    return null;
  }, [adminView, selectedEmployeeId, sessionUser, resolvedSessionEmployeeId]);

  const confirmationStatusFromId = useSalaryConfirmationStatus(resolvedEmployeeId, month, year);
  const confirmationVersion = useSalaryConfirmationVersion();
  const confirmationStatus = useMemo(() => {
    void confirmationVersion;
    if (resolvedEmployeeId) return confirmationStatusFromId;
    const code = summary?.employee_code;
    if (!code) return "not_sent" as const;
    return findConfirmationByEmployeeCode(code, month, year)?.status ?? "not_sent";
  }, [
    resolvedEmployeeId,
    confirmationStatusFromId,
    confirmationVersion,
    summary?.employee_code,
    month,
    year,
  ]);

  const prevMonthNav = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonthNav = () => {
    const nm = month === 12 ? { m: 1, y: year + 1 } : { m: month + 1, y: year };
    if (nm.y > now.getFullYear() || (nm.y === now.getFullYear() && nm.m > now.getMonth() + 1)) return;
    setMonth(nm.m);
    setYear(nm.y);
  };

  const isNextDisabled =
    year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);

  const handleDownload = async () => {
    if (!token) {
      clearAuthSession({ redirectToLogin: true });
      return;
    }

    setDownloading(true);
    try {
      const { blob, filename } = await downloadMySalaryPayslip(token, {
        month,
        year,
        employee_id: adminView ? selectedEmployeeId : undefined,
      });
      downloadBlob(blob, filename);
      toast.success("Payslip downloaded.");
    } catch (err) {
      if (isPayslipDownloadError(err)) {
        if (err.status === 401) {
          clearAuthSession({ redirectToLogin: true });
          return;
        }
        if (err.status === 403) {
          toast.error("You are not allowed to download this payslip.");
          return;
        }
        if (err.status === 404) {
          toast.error("Employee not found.");
          return;
        }
        if (err.status === 422) {
          toast.error(err.message || "Unable to generate payslip.");
          return;
        }
        toast.error("Unable to generate payslip. Please try again.");
        return;
      }
      toast.error("Unable to generate payslip. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenConfirmModal = () => {
    if (!summary) return;
    if (confirmationStatus === "confirmed") {
      toast.info("You have already confirmed this salary.");
      return;
    }
    const byCode = summary.employee_code
      ? findConfirmationByEmployeeCode(summary.employee_code, month, year)
      : null;
    const employeeId = resolvedEmployeeId ?? byCode?.employeeId ?? null;
    if (!employeeId && !summary.employee_code) {
      toast.error("Unable to identify your employee profile for confirmation.");
      return;
    }
    setConfirmModalOpen(true);
  };

  const handleConfirmSalary = async () => {
    if (!summary) return;
    const byCode = summary.employee_code
      ? findConfirmationByEmployeeCode(summary.employee_code, month, year)
      : null;
    // Prefer real employee id; fall back to any id from a prior admin send; last resort hash code.
    let employeeId = resolvedEmployeeId ?? byCode?.employeeId ?? null;
    if (!employeeId && summary.employee_code) {
      // Stable positive int from employee code so self-confirm works without session employee_id.
      let hash = 0;
      for (let i = 0; i < summary.employee_code.length; i += 1) {
        hash = (hash * 31 + summary.employee_code.charCodeAt(i)) >>> 0;
      }
      employeeId = (hash % 900000000) + 100000000;
    }
    if (!employeeId) {
      toast.error("Unable to identify your employee profile for confirmation.");
      return;
    }
    setConfirming(true);
    try {
      const actor =
        summary.employee_name ||
        String(sessionUser?.name ?? sessionUser?.full_name ?? "Employee");
      const result = confirmSalaryByEmployee({
        employeeId,
        employeeCode: summary.employee_code || byCode?.employeeCode || "",
        employeeName: summary.employee_name || actor,
        month,
        year,
        netPayable: netPayable,
        actor,
      });
      if (!result.ok) {
        toast.error(result.reason || "Unable to confirm salary.");
        return;
      }
      if (token && resolvedEmployeeId) {
        try {
          await notifyAdminEmployeeEvent(token, {
            event: "salary_confirmed",
            employee_id: resolvedEmployeeId,
            month,
            year,
            net_payable: netPayable,
          });
        } catch (error) {
          console.warn("Failed to notify admins of salary confirmation", error);
        }
      }
      toast.success("Salary confirmed successfully.");
      setConfirmModalOpen(false);
    } finally {
      setConfirming(false);
    }
  };

  const regularTotal = summary ? summary.total_regular_hours * summary.hourly_rate : 0;
  const otTotal = summary ? summary.total_overtime_hours * summary.overtime_rate : 0;
  const totalEarned = regularTotal + otTotal || 1;
  const regPct = Math.round((regularTotal / totalEarned) * 100);

  const statCards = summary
    ? [
        { label: "Regular Hours",  value: fmtHrs(summary.total_regular_hours),  color: "text-sky-600 dark:text-sky-400",         bg: "bg-sky-50 dark:bg-sky-900/20",         icon: Clock },
        { label: "Overtime Hours", value: fmtHrs(summary.total_overtime_hours), color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20",     icon: Zap },
        { label: "Gross Earnings", value: fmtCurrency(summary.gross_earnings),  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: TrendingUp },
        { label: "Deductions",     value: fmtCurrency(summary.total_deductions),color: "text-red-600 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-900/20",         icon: Minus },
        { label: "Penalty",        value: fmtCurrency(summary.total_penalty ?? 0), color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", icon: AlertCircle },
        { label: "Net Payable",    value: fmtCurrency(netPayable),              color: "text-primary",                           bg: "bg-primary/10",                        icon: Wallet },
        { label: "Days Present",   value: summary.days_present,                 color: "text-teal-600 dark:text-teal-400",       bg: "bg-teal-50 dark:bg-teal-900/20",       icon: Timer },
      ]
    : [];

  const isLoading = !sessionReady || salaryQuery.isLoading || (adminView && employeesQuery.isLoading);

  /* ── Loading Skeleton */
  if (isLoading) {
    return (
      <section className="w-full space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-muted/70" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded-lg bg-muted/40" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/30" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-muted/30" />
      </section>
    );
  }

  /* ── Error State */
  if (salaryQuery.isError) {
    const error = salaryQuery.error as any;
    return (
      <section className="w-full space-y-6">
        <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 px-5 py-8 text-center max-w-xl mx-auto shadow-sm">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-3" />
          <h3 className="text-base font-semibold text-red-800 dark:text-red-300">Failed to load salary details</h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1.5">
            {error?.message || "There was an error fetching your salary details. Please check connection and try again."}
          </p>
          <Button className="mt-4 rounded-xl" variant="outline" onClick={() => salaryQuery.refetch()}>
            Retry Fetch
          </Button>
        </div>
      </section>
    );
  }

  /* ── No Data / Not Found */
  if (!summary) {
    return (
      <section className="w-full space-y-6">
        {adminView && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-primary" /> Select Employee
            </h2>
            <select
              id="my-salary-employee-select"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(Number(e.target.value))}
              className="w-full max-w-sm rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="" disabled>Select Employee</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="rounded-2xl border border-border bg-card px-5 py-16 text-center shadow-sm max-w-xl mx-auto">
          <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-foreground">No Salary Record Found</h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            No hour-base salary logs were found for the selected month ({month}/{year}).
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full space-y-6 animate-in fade-in duration-500">

      {/* ── Page Header */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {adminView ? <ShieldCheck className="h-6 w-6" /> : <DollarSign className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">My Salary</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Hour Base salary breakdown for{" "}
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <User className="h-3 w-3" />{summary.employee_name}
                </span>
                {summary.employee_code ? (
                  <span className="text-xs text-muted-foreground"> · {summary.employee_code}</span>
                ) : null}
                {" · "}
                <span className="text-xs">{summary.period}</span>
              </p>
              {period && (
                <p className="text-xs text-muted-foreground mt-1">
                  {period.from_date} → {period.to_date}
                  {" · "}
                  {period.elapsed_days} elapsed / {period.future_days} upcoming
                </p>
              )}
            </div>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={prevMonthNav}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-semibold">{summary.period}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={nextMonthNav} disabled={isNextDisabled}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {confirmationStatus !== "confirmed" ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Confirm your salary</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Net payable for {summary.period}:{" "}
              <span className="font-semibold text-foreground">{fmtCurrency(netPayable)}</span>
            </p>
          </div>
          <Button className="shrink-0 gap-2 rounded-xl" onClick={handleOpenConfirmModal}>
            <CheckCircle2 className="h-4 w-4" />
            I confirm this salary is okay
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          You have confirmed this month&apos;s salary ({fmtCurrency(netPayable)}).
        </div>
      )}

      {/* ── Admin Employee Selector */}
      {adminView && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-primary" /> Select Employee
          </h2>
          <select
            id="my-salary-employee-select"
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(Number(e.target.value))}
            className="w-full max-w-sm rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="" disabled>Select Employee</option>
            {employees.map((e: any) => (
              <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className={`mb-3 inline-flex rounded-lg p-2 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Attendance Summary */}
      {attendanceSummary?.status_counts && Object.keys(attendanceSummary.status_counts).length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {Object.entries(attendanceSummary.status_counts).map(([label, count]) => {
            const style = ATTENDANCE_COUNT_STYLES[label] ?? {
              color: "text-muted-foreground",
              bg: "bg-muted/40",
            };
            return (
              <div key={label} className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                <p className={`text-lg font-bold ${style.color}`}>{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Earnings Breakdown Panel */}
        <Card className="rounded-2xl border border-border shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4 pt-5">
            <h2 className="text-sm font-bold">Earnings Breakdown</h2>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">

            {/* Rates */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hourly Rate</span>
                <span className="font-semibold">
                  {fmtCurrency(summary.hourly_rate)}
                  <span className="text-xs text-muted-foreground">/hr</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overtime Rate</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {fmtCurrency(summary.overtime_rate)}
                  <span className="text-xs text-muted-foreground">/hr</span>
                </span>
              </div>
            </div>

            {/* Visual bars */}
            <div className="border-t border-border/50 pt-4 space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-sky-600 dark:text-sky-400 font-medium">Regular Earning</span>
                  <span className="font-semibold">{fmtCurrency(regularTotal)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/40">
                  <div className="h-2 rounded-full bg-sky-500 transition-all duration-700" style={{ width: `${regPct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtHrs(summary.total_regular_hours)} × {fmtCurrency(summary.hourly_rate)}/hr
                </p>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Overtime Earning</span>
                  <span className="font-semibold">{fmtCurrency(otTotal)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/40">
                  <div className="h-2 rounded-full bg-amber-500 transition-all duration-700" style={{ width: `${100 - regPct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtHrs(summary.total_overtime_hours)} × {fmtCurrency(summary.overtime_rate)}/hr
                </p>
              </div>
            </div>

            {/* Net calculation */}
            <div className="border-t border-border/50 pt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Earnings</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(summary.gross_earnings)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deductions (PF + ESI)</span>
                <span className="font-semibold text-red-600 dark:text-red-400">− {fmtCurrency(summary.total_deductions)}</span>
              </div>
              <div className="space-y-1.5 rounded-lg bg-orange-500/5 px-2.5 py-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Late Penalty</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    − {fmtCurrency(summary.late_penalty ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Early Departure Penalty</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    − {fmtCurrency(summary.early_departure_penalty ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-orange-500/15 pt-1.5">
                  <span className="font-medium text-orange-700 dark:text-orange-300">Total Penalty</span>
                  <span className="font-bold text-orange-700 dark:text-orange-300">
                    − {fmtCurrency(summary.total_penalty ?? 0)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-2">
                <span className="font-bold">Net Payable</span>
                <span className="font-bold text-primary text-base">{fmtCurrency(netPayable)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Salary confirmation</span>
              <SalaryConfirmationBadge status={confirmationStatus} />
            </div>

            {confirmationStatus !== "confirmed" ? (
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">
                  {confirmationStatus === "sent"
                    ? "Admin has asked you to confirm this month’s salary. Please review the net payable and confirm."
                    : "Review your net payable below and confirm if this salary is correct."}
                </p>
                <Button
                  className="w-full gap-2 rounded-xl"
                  variant="default"
                  onClick={handleOpenConfirmModal}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  I confirm this salary is okay
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300">
                You have confirmed this month&apos;s salary.
              </div>
            )}

            {/* Download Payslip */}
            <Button
              id="my-salary-download-payslip"
              className="w-full gap-2 rounded-xl"
              variant="outline"
              onClick={handleDownload}
              disabled={downloading || (adminView && !selectedEmployeeId)}
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? "Generating…" : "Download Payslip"}
            </Button>
          </CardContent>
        </Card>

        {/* Daily Hour Log Table */}
        <Card className="rounded-2xl border border-border shadow-sm overflow-hidden lg:col-span-2">
          <div className="border-b border-border/50 bg-muted/10 px-5 py-4">
            <h2 className="text-sm font-bold">Daily Hour Log — {summary.period}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Day</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 whitespace-nowrap">Punch In</th>
                  <th className="px-4 py-3 whitespace-nowrap">Punch Out</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Work Hrs</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">OT Hrs</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Reg. Earn</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">OT Earn</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Daily Gross</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Penalty</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">After Penalty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((row) => {
                  const cfg = statusColor(row.status, row.is_future);
                  const statusNote =
                    row.holiday_name ||
                    row.leave_type ||
                    [row.late_status, row.early_departure_status].filter(Boolean).join(" · ");
                  const dl = new Date(row.date + "T00:00:00").toLocaleDateString("en-US", {
                    day: "2-digit",
                    month: "short",
                  });
                  return (
                    <tr
                      key={row.date}
                      className={`transition-colors hover:bg-muted/30 ${row.is_future ? "opacity-50" : ""}`}
                    >
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{dl}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.day}</td>
                      <td className="px-4 py-2.5">
                        <div className="space-y-0.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          {statusNote && (
                            <p className="text-[11px] text-muted-foreground pl-1">{statusNote}</p>
                          )}
                          {row.shift_name && (
                            <p className="text-[11px] text-muted-foreground pl-1 truncate max-w-[140px]" title={row.shift_name}>
                              {row.shift_name}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs tabular-nums">{fmt12(row.punch_in)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs tabular-nums">{fmt12(row.punch_out)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {row.working_hours_formatted && row.working_hours_formatted !== "0:00"
                          ? (() => {
                              const [h, m] = row.working_hours_formatted.split(":");
                              const hh = parseInt(h, 10);
                              const mm = parseInt(m, 10);
                              if (hh === 0 && mm === 0) return "—";
                              return `${hh}h ${mm}m`.replace(" 0m", "");
                            })()
                          : row.working_hours && row.working_hours > 0
                            ? fmtHrs(row.working_hours)
                            : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                        {row.overtime_hours > 0 ? fmtHrs(row.overtime_hours) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {row.regular_earning > 0 ? fmtCurrency(row.regular_earning) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                        {row.overtime_earning > 0 ? fmtCurrency(row.overtime_earning) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                        {row.daily_gross > 0 ? fmtCurrency(row.daily_gross) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {(row.daily_penalty ?? 0) > 0 ? (
                          <div>
                            <p className="font-semibold text-orange-600 dark:text-orange-400">
                              − {fmtCurrency(row.daily_penalty ?? 0)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {(row.late_penalty ?? 0) > 0 ? `Late ${fmtCurrency(row.late_penalty ?? 0)}` : ""}
                              {(row.late_penalty ?? 0) > 0 && (row.early_departure_penalty ?? 0) > 0 ? " · " : ""}
                              {(row.early_departure_penalty ?? 0) > 0
                                ? `Early ${fmtCurrency(row.early_departure_penalty ?? 0)}`
                                : ""}
                            </p>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-primary">
                        {row.daily_gross > 0 || (row.daily_penalty ?? 0) > 0
                          ? fmtCurrency(row.daily_net ?? row.daily_gross)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                  <td colSpan={6} className="px-4 py-3 text-right text-sm text-muted-foreground">Monthly Totals</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{fmtHrs(summary.total_overtime_hours)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtCurrency(regularTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{fmtCurrency(otTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary">{fmtCurrency(summary.gross_earnings)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-orange-600 dark:text-orange-400">− {fmtCurrency(summary.total_penalty ?? 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary">{fmtCurrency(netPayable)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>

      <ConfirmSalaryModal
        open={confirmModalOpen}
        employeeName={summary?.employee_name || "Employee"}
        periodLabel={summary?.period || `${month}/${year}`}
        netPayableLabel={fmtCurrency(netPayable)}
        confirming={confirming}
        onCancel={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmSalary}
      />
    </section>
  );
}
