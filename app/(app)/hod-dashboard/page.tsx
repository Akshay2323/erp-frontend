"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Gift,
  GitBranch,
  LayoutDashboard,
  PartyPopper,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
import { getEmployees, getEmployeeBirthdays } from "@/lib/api/employee";
import { getHolidays, type Holiday } from "@/lib/api/holiday";
import { getLeaveRequests, normalizeLeaveRequestList } from "@/lib/api/leave-requests";
import {
  attendanceStatusClass,
  countAttendanceStatuses,
  formatTimeShort,
  getGreeting,
  todayIsoDate,
} from "@/lib/hr-dashboard-utils";
import { filterByDepartmentEmployeeIds, resolveHodDepartmentContext } from "@/lib/hod-dashboard-utils";
import { formatDisplayDate } from "@/lib/format-date";
import { useAuthToken } from "@/lib/use-auth-token";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { label: "Leave Approval", href: "/leave-approval", icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-600" },
  { label: "Team Attendance", href: "/attendance", icon: Clock3, tone: "bg-sky-100 text-sky-600" },
  { label: "Monthly Report", href: "/monthly-attendance", icon: CalendarDays, tone: "bg-violet-100 text-violet-600" },
  { label: "Team Members", href: "/employee-list", icon: Users, tone: "bg-amber-100 text-amber-600" },
  { label: "Leave Requests", href: "/leave-requests", icon: BriefcaseBusiness, tone: "bg-rose-100 text-rose-600" },
  { label: "Holidays", href: "/holiday-list", icon: PartyPopper, tone: "bg-indigo-100 text-indigo-600" },
] as const;

export default function HodDashboardPage() {
  const router = useRouter();
  const token = useAuthToken();
  const [userName, setUserName] = useState("HOD");
  const [companyName, setCompanyName] = useState<string | null>(null);

  const today = todayIsoDate();
  const now = new Date();

  useEffect(() => {
    const user = readAuthUser();
    if (isEmployeeSession(user)) {
      router.replace("/employee-dashboard");
      return;
    }
    setUserName(user?.name ?? "HOD");
    setCompanyName(user?.company?.name ?? null);
  }, [router]);

  const enabled = Boolean(token);

  const deptContextQuery = useQuery({
    queryKey: ["hod-dept-context", token],
    queryFn: () => resolveHodDepartmentContext(token),
    enabled,
  });

  const departmentId = deptContextQuery.data?.departmentId ?? "";
  const departmentName = deptContextQuery.data?.departmentName ?? "Department";
  const deptReady = Boolean(departmentId) && !deptContextQuery.isLoading;

  const teamListQuery = useQuery({
    queryKey: ["hod-team-directory", token, departmentId],
    queryFn: () =>
      getEmployees(token, {
        status: "active",
        department_id: departmentId,
        page: 1,
        per_page: 200,
      }),
    enabled: enabled && deptReady,
  });

  const teamEmployeeIds = useMemo(() => {
    const items = teamListQuery.data?.data?.items ?? [];
    return new Set(items.map((e) => e.id));
  }, [teamListQuery.data]);

  const [
    activeTeamQuery,
    attendanceQuery,
    pendingLeavesQuery,
    birthdaysQuery,
    holidaysQuery,
    recentTeamQuery,
  ] = useQueries({
    queries: [
      {
        queryKey: ["hod-active-team", token, departmentId],
        queryFn: () =>
          getEmployees(token, {
            status: "active",
            department_id: departmentId,
            page: 1,
            per_page: 1,
          }),
        enabled: enabled && deptReady,
      },
      {
        queryKey: ["hod-attendance", token, today, departmentId],
        queryFn: () =>
          getAdminAttendance(token, {
            from_date: today,
            to_date: today,
            department_id: departmentId,
            page: 1,
            per_page: 200,
          }),
        enabled: enabled && deptReady,
      },
      {
        queryKey: ["hod-pending-leaves", token, departmentId],
        queryFn: async () => {
          const teamRes = await getEmployees(token, {
            status: "active",
            department_id: departmentId,
            page: 1,
            per_page: 200,
          });
          const ids = new Set((teamRes.data?.items ?? []).map((e) => e.id));
          const res = await getLeaveRequests(token, { status: "pending", page: 1, per_page: 50 });
          const normalized = normalizeLeaveRequestList(res);
          return {
            ...normalized,
            items: filterByDepartmentEmployeeIds(normalized.items, ids),
          };
        },
        enabled: enabled && deptReady,
      },
      {
        queryKey: ["hod-birthdays", token, departmentId],
        queryFn: () => getEmployeeBirthdays(token, 30),
        enabled: enabled && deptReady,
      },
      {
        queryKey: ["hod-holidays", token, today],
        queryFn: () =>
          getHolidays(token, {
            status: "active",
            holiday_date_from: today,
            per_page: 6,
            page: 1,
          }),
        enabled: enabled && deptReady,
      },
      {
        queryKey: ["hod-recent-team", token, departmentId],
        queryFn: () =>
          getEmployees(token, {
            status: "active",
            department_id: departmentId,
            page: 1,
            per_page: 5,
          }),
        enabled: enabled && deptReady,
      },
    ],
  });

  const activeTotal = activeTeamQuery.data?.meta?.total ?? teamEmployeeIds.size;
  const attendanceRecords = attendanceQuery.data?.data?.records ?? [];
  const attendanceBreakdown = useMemo(() => countAttendanceStatuses(attendanceRecords), [attendanceRecords]);
  const pendingLeaves = pendingLeavesQuery.data?.items ?? [];
  const pendingTotal = pendingLeaves.length;

  const employeeNameMap = useMemo(() => {
    const items = teamListQuery.data?.data?.items ?? [];
    const map = new Map<number, string>();
    for (const emp of items) {
      map.set(
        emp.id,
        emp.full_name ||
          emp.name ||
          `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() ||
          emp.employee_code ||
          `#${emp.id}`,
      );
    }
    return map;
  }, [teamListQuery.data]);

  const holidays: Holiday[] = useMemo(() => {
    const raw = holidaysQuery.data?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object" && "items" in raw && Array.isArray((raw as { items: Holiday[] }).items)) {
      return (raw as { items: Holiday[] }).items;
    }
    return [];
  }, [holidaysQuery.data]);

  const birthdays = birthdaysQuery.data?.data;
  const departmentBirthdays = useMemo(() => {
    if (!birthdays) return { today: [], upcoming: [] };
    const inDept = (emp: { department?: { id: number } | null }) =>
      emp.department?.id === Number(departmentId);
    return {
      today: birthdays.today.items.filter(inDept),
      upcoming: birthdays.upcoming.items.filter(inDept),
    };
  }, [birthdays, departmentId]);

  const recentTeam = recentTeamQuery.data?.data?.items ?? [];
  const teamListHref = `/employee-list?department_id=${departmentId}`;

  const statsLoading =
    activeTeamQuery.isLoading || attendanceQuery.isLoading || pendingLeavesQuery.isLoading;

  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (deptContextQuery.isLoading) {
    return (
      <section className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Resolving your department…
      </section>
    );
  }

  if (!departmentId) {
    return (
      <section className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <GitBranch className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Department not linked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is not linked to a department yet. Ask HR to assign you as HOD with a department in job
          details.
        </p>
        <Link className={cn(buttonVariants({ variant: "outline" }), "mt-6 inline-flex")} href="/employee-profile">
          View my profile
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-indigo-500/10 via-card to-card p-6 shadow-sm">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-indigo-500/15 p-3 text-indigo-600 dark:text-indigo-400">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{todayLabel}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                {getGreeting()}, {userName}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-0.5 font-medium text-indigo-700 dark:text-indigo-300">
                  <GitBranch className="h-3.5 w-3.5" />
                  {departmentName}
                </span>
                {companyName ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-0.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {companyName}
                  </span>
                ) : null}
                <span>Department team overview</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants()} href="/leave-approval">
              Review team leaves
              {pendingTotal > 0 ? (
                <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                  {pendingTotal}
                </span>
              ) : null}
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href={teamListHref}>
              View team
            </Link>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <HrStatCard
          hint="Active in your department"
          href={teamListHref}
          icon={Users}
          label="Team members"
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
          value={attendanceBreakdown.present}
        />
        <HrStatCard
          hint="Absent today"
          href="/attendance"
          icon={XCircle}
          label="Absent today"
          loading={statsLoading}
          tone="rose"
          value={attendanceBreakdown.absent}
        />
        <HrStatCard
          hint="On approved leave"
          href="/leave-requests"
          icon={BriefcaseBusiness}
          label="On leave"
          loading={statsLoading}
          tone="sky"
          value={attendanceBreakdown.onLeave}
        />
        <HrStatCard
          hint="Awaiting your review"
          href="/leave-approval"
          icon={CalendarDays}
          label="Pending approvals"
          loading={statsLoading}
          tone="amber"
          value={pendingTotal}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {/* Today's attendance */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Clock3 className="h-5 w-5 text-indigo-500" />
                  Today&apos;s team attendance
                </h2>
                <p className="text-sm text-muted-foreground">{departmentName} — live status</p>
              </div>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/attendance">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Present", value: attendanceBreakdown.present, className: "text-emerald-600" },
                  { label: "Late", value: attendanceBreakdown.late, className: "text-amber-600" },
                  { label: "On leave", value: attendanceBreakdown.onLeave, className: "text-sky-600" },
                  { label: "Half day", value: attendanceBreakdown.halfDay, className: "text-violet-600" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={cn("mt-1 text-2xl font-bold", item.className)}>
                      {attendanceQuery.isLoading ? "—" : item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Employee</th>
                      <th className="px-4 py-2.5 font-medium">Punch in</th>
                      <th className="px-4 py-2.5 font-medium">Punch out</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceQuery.isLoading ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                          Loading attendance…
                        </td>
                      </tr>
                    ) : attendanceRecords.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                          No attendance records for your team today yet.
                        </td>
                      </tr>
                    ) : (
                      attendanceRecords.slice(0, 8).map((record) => (
                        <tr key={record.id} className="border-b border-border/60 hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">
                            {employeeNameMap.get(record.employee_id) ?? `Employee #${record.employee_id}`}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatTimeShort(record.punch_in_time)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatTimeShort(record.punch_out_time)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                attendanceStatusClass(record.status),
                              )}
                            >
                              {record.status ?? "—"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pending leave approvals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-amber-500" />
                  Team leave requests
                </h2>
                <p className="text-sm text-muted-foreground">Pending approvals from {departmentName}</p>
              </div>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/leave-approval">
                Approval queue
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent>
              {pendingLeavesQuery.isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading leave requests…</p>
              ) : pendingLeaves.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center">
                  <p className="text-sm font-medium text-foreground">No pending requests</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your team has no leave requests waiting for approval.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingLeaves.slice(0, 6).map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/20"
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-lg font-semibold">Quick actions</h2>
              <p className="text-sm text-muted-foreground">Department workflows</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => {
                const href =
                  action.label === "Team Members"
                    ? teamListHref
                    : action.href;
                return (
                  <Link
                    key={action.href}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition-colors hover:border-indigo-500/30 hover:bg-muted/30"
                    href={href}
                  >
                    <div className={cn("rounded-xl p-2.5", action.tone)}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium leading-tight">{action.label}</span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <PartyPopper className="h-5 w-5 text-amber-500" />
                Team birthdays
              </h2>
            </CardHeader>
            <CardContent className="max-h-72 space-y-4 overflow-y-auto">
              {birthdaysQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : !departmentBirthdays.today.length && !departmentBirthdays.upcoming.length ? (
                <p className="text-sm text-muted-foreground">No team birthdays in the next 30 days.</p>
              ) : (
                <>
                  {departmentBirthdays.today.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-100 text-pink-600">
                        <Gift className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{emp.full_name || emp.first_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.designation?.name ?? "—"}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-600">
                        Today
                      </span>
                    </div>
                  ))}
                  {departmentBirthdays.upcoming.slice(0, 5).map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                        <Gift className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{emp.full_name || emp.first_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.designation?.name ?? "—"}</p>
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
              <h2 className="flex items-center gap-2 text-lg font-semibold">
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
                  <div
                    key={holiday.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{holiday.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{holiday.type ?? "holiday"}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-indigo-600">
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
              <h2 className="text-lg font-semibold">Team members</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTeamQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : recentTeam.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team members found.</p>
              ) : (
                recentTeam.map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {emp.full_name || `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emp.designation?.name ?? emp.employee_code ?? "—"}
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
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={teamListHref}>
                All team members
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
