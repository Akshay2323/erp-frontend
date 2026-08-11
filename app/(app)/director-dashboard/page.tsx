"use client";

import { useQueries } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crown,
  LayoutDashboard,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AiAnalyticsPanel } from "@/components/director-dashboard/AiAnalyticsPanel";
import { HrStatCard } from "@/components/hr-dashboard/HrStatCard";
import {
  formatEmployeeName,
  LeaveRequestDateRange,
  LeaveStatusBadge,
} from "@/components/leave/leave-shared";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAdminAttendance } from "@/lib/api/attendance";
import { isEmployeeSession, readAuthUser } from "@/lib/auth-session";
import { getEmployees } from "@/lib/api/employee";
import { getLeaveRequests, normalizeLeaveRequestList } from "@/lib/api/leave-requests";
import { getPayrollWorkspace } from "@/lib/api/payroll";
import {
  buildDepartmentHealth,
  buildSevenDayTrend,
  generateDirectorAnalytics,
  isoDateDaysAgo,
} from "@/lib/director-analytics";
import {
  countAttendanceStatuses,
  getGreeting,
  todayIsoDate,
} from "@/lib/hr-dashboard-utils";
import { useAuthToken } from "@/lib/use-auth-token";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { label: "HR Dashboard", href: "/hr-dashboard", icon: LayoutDashboard, tone: "bg-primary/10 text-primary" },
  { label: "Payroll Summary", href: "/payroll-summary", icon: Wallet, tone: "bg-violet-100 text-violet-600" },
  { label: "Run Payroll", href: "/run-payroll", icon: TrendingUp, tone: "bg-emerald-100 text-emerald-600" },
  { label: "Leave Approval", href: "/leave-approval", icon: CheckCircle2, tone: "bg-amber-100 text-amber-600" },
  { label: "Attendance", href: "/attendance", icon: Clock3, tone: "bg-sky-100 text-sky-600" },
  { label: "Employee List", href: "/employee-list", icon: Users, tone: "bg-rose-100 text-rose-600" },
] as const;

export default function DirectorDashboardPage() {
  const router = useRouter();
  const token = useAuthToken();
  const [userName, setUserName] = useState("Director");
  const [companyName, setCompanyName] = useState<string | null>(null);

  const today = todayIsoDate();
  const yesterday = isoDateDaysAgo(1);
  const weekStart = isoDateDaysAgo(6);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  useEffect(() => {
    const user = readAuthUser();
    if (isEmployeeSession(user)) {
      router.replace("/employee-dashboard");
      return;
    }
    setUserName(user?.name ?? "Director");
    setCompanyName(user?.company?.name ?? null);
  }, [router]);

  const enabled = Boolean(token);

  const [
    activeEmployeesQuery,
    draftEmployeesQuery,
    todayAttendanceQuery,
    yesterdayAttendanceQuery,
    weekAttendanceQuery,
    pendingLeavesQuery,
    payrollQuery,
    employeeDirectoryQuery,
  ] = useQueries({
    queries: [
      {
        queryKey: ["director-active-employees", token],
        queryFn: () => getEmployees(token, { status: "active", page: 1, per_page: 1 }),
        enabled,
      },
      {
        queryKey: ["director-draft-employees", token],
        queryFn: () => getEmployees(token, { status: "draft", page: 1, per_page: 1 }),
        enabled,
      },
      {
        queryKey: ["director-attendance-today", token, today],
        queryFn: () =>
          getAdminAttendance(token, { from_date: today, to_date: today, page: 1, per_page: 300 }),
        enabled,
      },
      {
        queryKey: ["director-attendance-yesterday", token, yesterday],
        queryFn: () =>
          getAdminAttendance(token, { from_date: yesterday, to_date: yesterday, page: 1, per_page: 300 }),
        enabled,
      },
      {
        queryKey: ["director-attendance-week", token, weekStart, today],
        queryFn: () =>
          getAdminAttendance(token, { from_date: weekStart, to_date: today, page: 1, per_page: 500 }),
        enabled,
      },
      {
        queryKey: ["director-pending-leaves", token],
        queryFn: async () => {
          const res = await getLeaveRequests(token, { status: "pending", page: 1, per_page: 20 });
          return normalizeLeaveRequestList(res);
        },
        enabled,
      },
      {
        queryKey: ["director-payroll", token, month, year],
        queryFn: () => getPayrollWorkspace(token, { screen: "summary", month, year }),
        enabled,
        retry: false,
      },
      {
        queryKey: ["director-employee-directory", token],
        queryFn: () => getEmployees(token, { status: "active", page: 1, per_page: 300 }),
        enabled,
      },
    ],
  });

  const activeTotal = activeEmployeesQuery.data?.meta?.total ?? 0;
  const draftTotal = draftEmployeesQuery.data?.meta?.total ?? 0;
  const todayRecords = todayAttendanceQuery.data?.data?.records ?? [];
  const yesterdayRecords = yesterdayAttendanceQuery.data?.data?.records ?? [];
  const weekRecords = weekAttendanceQuery.data?.data?.records ?? [];
  const todayBreakdown = useMemo(() => countAttendanceStatuses(todayRecords), [todayRecords]);
  const yesterdayBreakdown = useMemo(() => countAttendanceStatuses(yesterdayRecords), [yesterdayRecords]);
  const pendingLeaves = pendingLeavesQuery.data?.items ?? [];
  const pendingTotal = pendingLeavesQuery.data?.pagination?.total ?? pendingLeaves.length;
  const employees = employeeDirectoryQuery.data?.data?.items ?? [];

  const trend7d = useMemo(
    () => buildSevenDayTrend(weekRecords, activeTotal),
    [weekRecords, activeTotal],
  );

  const departmentHealth = useMemo(
    () => buildDepartmentHealth(employees, todayRecords),
    [employees, todayRecords],
  );

  const payrollSummary = (payrollQuery.data?.data as { payroll_summary?: Record<string, unknown> } | undefined)
    ?.payroll_summary;

  const payrollCards = Array.isArray(
    (payrollSummary as { payroll_summary_cards?: unknown[] } | undefined)?.payroll_summary_cards,
  )
    ? (payrollSummary as { payroll_summary_cards: Array<{ label: string; staff_count: number; amount: number }> })
        .payroll_summary_cards
    : [];

  const payrollTotal = payrollCards.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const payrollStaff = payrollCards.reduce((sum, c) => sum + Number(c.staff_count || 0), 0);

  const analytics = useMemo(
    () =>
      generateDirectorAnalytics({
        activeEmployees: activeTotal,
        draftEmployees: draftTotal,
        todayBreakdown,
        yesterdayBreakdown,
        pendingLeaves: pendingTotal,
        trend7d,
        departmentHealth,
        payrollTotal: payrollTotal > 0 ? payrollTotal : undefined,
        payrollStaffCount: payrollStaff > 0 ? payrollStaff : undefined,
      }),
    [
      activeTotal,
      draftTotal,
      todayBreakdown,
      yesterdayBreakdown,
      pendingTotal,
      trend7d,
      departmentHealth,
      payrollTotal,
      payrollStaff,
    ],
  );

  const analyticsLoading =
    activeEmployeesQuery.isLoading ||
    todayAttendanceQuery.isLoading ||
    weekAttendanceQuery.isLoading;

  const statsLoading =
    activeEmployeesQuery.isLoading || todayAttendanceQuery.isLoading || pendingLeavesQuery.isLoading;

  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 via-card to-amber-500/5 p-6 shadow-sm">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-violet-600/15 p-3 text-violet-700 dark:text-violet-300">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{todayLabel}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                {getGreeting()}, {userName}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {companyName ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-0.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {companyName}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-0.5 font-medium text-violet-700 dark:text-violet-300">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Executive overview
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants()} href="/payroll-summary">
              <Wallet className="h-4 w-4" />
              Payroll summary
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/leave-approval">
              Approvals
              {pendingTotal > 0 ? (
                <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                  {pendingTotal}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <HrStatCard
          hint={`Health score ${analytics.healthScore}/100`}
          href="/employee-list"
          icon={Users}
          label="Workforce"
          loading={statsLoading}
          tone="primary"
          value={activeTotal}
        />
        <HrStatCard
          hint="Present today"
          href="/attendance"
          icon={CheckCircle2}
          label="Present today"
          loading={statsLoading}
          tone="emerald"
          value={todayBreakdown.present}
        />
        <HrStatCard
          hint="Absent today"
          href="/attendance"
          icon={XCircle}
          label="Absent today"
          loading={statsLoading}
          tone="rose"
          value={todayBreakdown.absent}
        />
        <HrStatCard
          hint="On approved leave"
          href="/leave-requests"
          icon={BriefcaseBusiness}
          label="On leave"
          loading={statsLoading}
          tone="sky"
          value={todayBreakdown.onLeave}
        />
        <HrStatCard
          hint="Needs action"
          href="/leave-approval"
          icon={CalendarDays}
          label="Pending leaves"
          loading={statsLoading}
          tone="amber"
          value={pendingTotal}
        />
      </div>

      {/* AI Analytics — flagship section */}
      <AiAnalyticsPanel
        departmentHealth={departmentHealth}
        executiveSummary={analytics.executiveSummary}
        healthScore={analytics.healthScore}
        insights={analytics.insights}
        loading={analyticsLoading}
        trend7d={trend7d}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {/* Payroll snapshot */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Wallet className="h-5 w-5 text-violet-500" />
                  Financial snapshot
                </h2>
                <p className="text-sm text-muted-foreground">
                  {(payrollSummary as { period_label?: string } | undefined)?.period_label ??
                    now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </div>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/payroll-summary">
                Full report
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent>
              {payrollQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading payroll data…</p>
              ) : payrollCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">Payroll summary unavailable for this period.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {payrollCards.slice(0, 4).map((card) => (
                    <div key={card.label} className="rounded-xl border border-border p-4">
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <p className="mt-1 text-xl font-bold">
                        ₹ {Number(card.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{card.staff_count} staff</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending leaves */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <h2 className="text-lg font-semibold">Leave pipeline</h2>
                <p className="text-sm text-muted-foreground">Organization-wide pending requests</p>
              </div>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/leave-approval">
                Manage
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent>
              {pendingLeavesQuery.isLoading ? (
                <p className="py-4 text-sm text-muted-foreground">Loading…</p>
              ) : pendingLeaves.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No pending leave requests.</p>
              ) : (
                <div className="space-y-3">
                  {pendingLeaves.slice(0, 5).map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{formatEmployeeName(request.employee)}</p>
                          <LeaveStatusBadge status={request.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {request.leave_type?.name} · <LeaveRequestDateRange request={request} />
                        </p>
                      </div>
                      <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/leave-approval">
                        Review
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-lg font-semibold">Executive actions</h2>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition-colors hover:border-violet-500/30 hover:bg-muted/30"
                  href={action.href}
                >
                  <div className={cn("rounded-xl p-2.5", action.tone)}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium leading-tight">{action.label}</span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-lg font-semibold">Department leaderboard</h2>
              <p className="text-sm text-muted-foreground">Today&apos;s attendance ranking</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {departmentHealth.length === 0 ? (
                <p className="text-sm text-muted-foreground">Link employees to departments for rankings.</p>
              ) : (
                [...departmentHealth]
                  .sort((a, b) => b.presentRate - a.presentRate)
                  .slice(0, 6)
                  .map((row, index) => (
                    <div key={row.departmentId} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="truncate text-sm font-medium">{row.name}</span>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold",
                          row.presentRate >= 85
                            ? "text-emerald-600"
                            : row.presentRate >= 70
                              ? "text-amber-600"
                              : "text-rose-600",
                        )}
                      >
                        {row.presentRate}%
                      </span>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
