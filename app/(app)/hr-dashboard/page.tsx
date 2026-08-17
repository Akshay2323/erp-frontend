"use client";

import { useQueries } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Gift,
  Megaphone,
  PartyPopper,
  Plus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { TodayAttendancePanel } from "@/components/hr-dashboard/TodayAttendancePanel";
import {
  formatEmployeeName,
  LeaveRequestDateRange,
  LeaveStatusBadge,
} from "@/components/leave/leave-shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AnnouncementManagerModal } from "@/components/hr-dashboard/AnnouncementManagerModal";
import { isEmployeeSession, readAuthUser } from "@/lib/auth-session";
import { getEmployees, getEmployeeBirthdays } from "@/lib/api/employee";
import { getHolidays, type Holiday } from "@/lib/api/holiday";
import { getLeaveRequests, normalizeLeaveRequestList } from "@/lib/api/leave-requests";
import { getPayrollWorkspace } from "@/lib/api/payroll";
import { todayIsoDate } from "@/lib/hr-dashboard-utils";
import { formatDisplayDate } from "@/lib/format-date";
import { useAuthToken } from "@/lib/use-auth-token";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { label: "Add Employee", href: "/add-employee", icon: UserPlus, tone: "bg-primary/10 text-primary" },
  { label: "Leave Approval", href: "/leave-approval", icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-600" },
  { label: "Daily Attendance", href: "/attendance", icon: Clock3, tone: "bg-sky-100 text-sky-600" },
  { label: "Run Payroll", href: "/run-payroll", icon: Wallet, tone: "bg-violet-100 text-violet-600" },
  { label: "Employee List", href: "/employee-list", icon: Users, tone: "bg-amber-100 text-amber-600" },
  { label: "Add Holiday", href: "/add-holiday", icon: CalendarDays, tone: "bg-rose-100 text-rose-600" },
] as const;

export default function HrDashboardPage() {
  const router = useRouter();
  const token = useAuthToken();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [announceModalOpen, setAnnounceModalOpen] = useState(false);

  const today = todayIsoDate();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  useEffect(() => {
    const user = readAuthUser();
    if (isEmployeeSession(user)) {
      router.replace("/employee-dashboard");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompanyName(user?.company?.name ?? null);
  }, [router]);

  const enabled = Boolean(token);

  const [
    pendingLeavesQuery,
    birthdaysQuery,
    holidaysQuery,
    recentEmployeesQuery,
    payrollQuery,
  ] = useQueries({
    queries: [
      {
        queryKey: ["hr-dash-pending-leaves", token],
        queryFn: async () => {
          const res = await getLeaveRequests(token, { status: "pending", page: 1, per_page: 6 });
          return normalizeLeaveRequestList(res);
        },
        enabled,
      },
      {
        queryKey: ["hr-dash-birthdays", token],
        queryFn: () => getEmployeeBirthdays(token, 30),
        enabled,
      },
      {
        queryKey: ["hr-dash-holidays", token, today],
        queryFn: () =>
          getHolidays(token, {
            status: "active",
            holiday_date_from: today,
            per_page: 6,
            page: 1,
          }),
        enabled,
      },
      {
        queryKey: ["hr-dash-recent-employees", token],
        queryFn: () => getEmployees(token, { status: "active", page: 1, per_page: 5 }),
        enabled,
      },
      {
        queryKey: ["hr-dash-payroll", token, month, year],
        queryFn: () => getPayrollWorkspace(token, { screen: "summary", month, year }),
        enabled,
        retry: false,
      },
    ],
  });

  const pendingLeaves = pendingLeavesQuery.data?.items ?? [];
  const pendingTotal = pendingLeavesQuery.data?.pagination?.total ?? pendingLeaves.length;

  const holidays: Holiday[] = useMemo(() => {
    const raw = holidaysQuery.data?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object" && "items" in raw && Array.isArray((raw as { items: Holiday[] }).items)) {
      return (raw as { items: Holiday[] }).items;
    }
    return [];
  }, [holidaysQuery.data]);

  const recentEmployees = recentEmployeesQuery.data?.data?.items ?? [];
  const birthdays = birthdaysQuery.data?.data;
  const payrollSummary = (payrollQuery.data?.data as { payroll_summary?: Record<string, unknown> } | undefined)?.payroll_summary;

  const payrollCards = Array.isArray((payrollSummary as { payroll_summary_cards?: unknown[] } | undefined)?.payroll_summary_cards)
    ? ((payrollSummary as { payroll_summary_cards: Array<{ label: string; staff_count: number; amount: number }> }).payroll_summary_cards)
    : [];

  const payrollPeriod = (payrollSummary as { period_label?: string } | undefined)?.period_label ?? `${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="min-w-0 space-y-4 overflow-x-hidden sm:space-y-6">
      {/* Compact toolbar — no greeting hero */}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">HR Dashboard</h1>
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            {todayLabel}
            {companyName ? ` · ${companyName}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={() => setAnnounceModalOpen(true)}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl px-3"
          >
            <Megaphone className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Announcements</span>
          </Button>
          <Link
            className={cn(buttonVariants({ size: "sm" }), "h-9 gap-1.5 rounded-xl px-3")}
            href="/add-employee"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </Link>
          <Link
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 gap-1.5 rounded-xl px-3")}
            href="/leave-approval"
          >
            Leaves
            {pendingTotal > 0 ? (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {pendingTotal}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Main column */}
        <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-8">
          <TodayAttendancePanel token={token} />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                  <CheckCircle2 className="h-5 w-5 text-amber-500" />
                  Pending leave approvals
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">Requests waiting for HR action</p>
              </div>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/leave-approval">
                Open
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent>
              {pendingLeavesQuery.isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading leave requests…</p>
              ) : pendingLeaves.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-8 text-center sm:py-10">
                  <p className="text-sm font-medium text-foreground">All caught up</p>
                  <p className="mt-1 text-sm text-muted-foreground">No pending leave requests right now.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingLeaves.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col gap-3 rounded-xl border border-border p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4 hover:bg-muted/20"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{formatEmployeeName(request.employee)}</p>
                          <LeaveStatusBadge status={request.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {request.leave_type?.name ?? "Leave"} · <LeaveRequestDateRange request={request} />
                        </p>
                        <p className="mt-1 truncate text-sm">{request.reason}</p>
                      </div>
                      <Link
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                        href="/leave-approval"
                      >
                        Review
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                  <Wallet className="h-5 w-5 text-violet-500" />
                  Payroll snapshot
                </h2>
                <p className="text-xs text-muted-foreground sm:text-sm">{payrollPeriod}</p>
              </div>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/payroll-summary">
                Full summary
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent>
              {payrollQuery.isLoading ? (
                <p className="py-4 text-sm text-muted-foreground">Loading payroll data…</p>
              ) : payrollQuery.isError || payrollCards.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Payroll summary unavailable. Open Run Payroll when ready.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {payrollCards.slice(0, 4).map((card) => (
                    <div
                      key={card.label}
                      className="min-w-0 rounded-xl border border-border p-3 sm:p-4"
                    >
                      <p className="truncate text-xs text-muted-foreground sm:text-sm">{card.label}</p>
                      <p className="mt-1 truncate text-lg font-bold sm:text-xl">
                        ₹ {Number(card.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{card.staff_count} staff</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-4">
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold sm:text-lg">Quick actions</h2>
              <p className="text-xs text-muted-foreground sm:text-sm">Frequent HR workflows</p>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-2">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-2 text-center transition-colors hover:border-primary/30 hover:bg-muted/30 sm:gap-2 sm:p-4"
                  href={action.href}
                >
                  <div className={cn("rounded-xl p-2 sm:p-2.5", action.tone)}>
                    <action.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="text-[10px] font-medium leading-tight sm:text-xs">{action.label}</span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                <PartyPopper className="h-5 w-5 text-amber-500" />
                Birthdays
              </h2>
            </CardHeader>
            <CardContent className="max-h-72 space-y-4 overflow-y-auto">
              {birthdaysQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : !birthdays?.today?.items?.length && !birthdays?.upcoming?.items?.length ? (
                <p className="text-sm text-muted-foreground">No upcoming birthdays in the next 30 days.</p>
              ) : (
                <>
                  {(birthdays?.today?.items ?? []).map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-100 text-pink-600">
                        <Gift className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{emp.full_name || emp.first_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.department?.name ?? "—"}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        Today
                      </span>
                    </div>
                  ))}
                  {(birthdays?.upcoming?.items ?? []).slice(0, 5).map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                        <Gift className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{emp.full_name || emp.first_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.department?.name ?? "—"}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDisplayDate(emp.birthday_date)}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                <CalendarDays className="h-5 w-5 text-sky-500" />
                Upcoming holidays
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {holidaysQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming holidays scheduled.</p>
              ) : (
                holidays.map((holiday) => (
                  <div key={holiday.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{holiday.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{holiday.type ?? "holiday"}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-primary">
                      {formatDisplayDate(holiday.date)}
                    </span>
                  </div>
                ))
              )}
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/holiday-list">
                View holiday calendar
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold sm:text-lg">Recent employees</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentEmployeesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : recentEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employees found.</p>
              ) : (
                recentEmployees.map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {emp.full_name || `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emp.department?.name ?? emp.designation?.name ?? emp.employee_code ?? "—"}
                      </p>
                    </div>
                    <Link
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                      href={`/add-employee?edit=${emp.id}`}
                    >
                      View
                    </Link>
                  </div>
                ))
              )}
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/employee-list">
                All employees
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
      <AnnouncementManagerModal
        open={announceModalOpen}
        onClose={() => setAnnounceModalOpen(false)}
      />
    </section>
  );
}
