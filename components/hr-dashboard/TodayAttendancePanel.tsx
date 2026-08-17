"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogIn,
  LogOut,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  Timer,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { FeedEmployeeAvatar } from "@/components/live-attendance/FeedEmployeeAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelectFilter } from "@/components/ui/native-select";
import { getEmployeeProfilePhotoProxyUrl } from "@/lib/api/employees/http";
import { getBranches, type Branch } from "@/lib/api/branch";
import { normalizeApiList } from "@/lib/api/normalize-list";
import {
  DayAttendanceError,
  getDayAttendanceStatus,
  type DayAttendanceEmployee,
  type DayAttendanceSummary,
} from "@/lib/api/day-attendance";
import { getDepartments, type Department } from "@/lib/api/department";
import { attendanceBoardHref, telHref, whatsappHref } from "@/lib/attendance-board";
import { clearAuthSession } from "@/lib/auth-cookie";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 45_000;
const PAGE_SIZE = 20;

type AttendanceTab = "present" | "absent";

function formatClockTime(value: Date): string {
  return value.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function isLate(row: DayAttendanceEmployee): boolean {
  const { late_status: lateStatus, late_minutes: lateMinutes } = row.attendance;
  if (typeof lateMinutes === "number" && lateMinutes > 0) return true;
  if (!lateStatus) return false;
  return lateStatus.trim().toLowerCase() !== "on time";
}

function lateLabel(row: DayAttendanceEmployee): string {
  const { late_status: lateStatus, late_minutes: lateMinutes } = row.attendance;
  if (typeof lateMinutes === "number" && lateMinutes > 0) {
    return `${lateStatus ?? "Late"} · ${lateMinutes} min`;
  }
  return lateStatus ?? "Late";
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  loading: boolean;
}) {
  return (
    <div className="flex w-[6.75rem] shrink-0 flex-col gap-1 rounded-lg border border-border/70 bg-muted/10 px-2 py-1.5 sm:w-[7.5rem] sm:px-2.5 sm:py-2">
      <div className="flex items-center gap-1">
        <div className={cn("rounded-md p-0.5", tone)}>
          <Icon className="h-3 w-3" />
        </div>
        <p className="truncate text-[9px] font-medium leading-none text-muted-foreground sm:text-[10px]">
          {label}
        </p>
      </div>
      <p className="text-base font-bold leading-none tabular-nums sm:text-lg">
        {loading ? "—" : value}
      </p>
    </div>
  );
}

function EmployeeIdentity({ row }: { row: DayAttendanceEmployee }) {
  const { employee } = row;
  const photoSrc = employee.profile_photo_url
    ? getEmployeeProfilePhotoProxyUrl(employee.id)
    : undefined;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <FeedEmployeeAvatar
        className="h-11 w-11 shrink-0 ring-2 ring-border/60"
        name={employee.name}
        src={photoSrc}
        textClassName="text-xs"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{employee.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {employee.employee_code ?? "—"}
          {employee.department ? ` · ${employee.department}` : ""}
          {employee.designation ? ` · ${employee.designation}` : ""}
        </p>
      </div>
    </div>
  );
}

function ContactActions({ mobile }: { mobile: string | null | undefined }) {
  const callUrl = telHref(mobile);
  const waUrl = whatsappHref(mobile);

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {callUrl ? (
        <a
          aria-label="Call"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          href={callUrl}
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      ) : (
        <span
          aria-disabled
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground opacity-50"
          title="No mobile number"
        >
          <Phone className="h-3.5 w-3.5" />
        </span>
      )}
      {waUrl ? (
        <a
          aria-label="WhatsApp"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#25D366]/40 bg-[#25D366]/15 text-[#128C7E] transition-colors hover:bg-[#25D366]/25 dark:text-[#25D366]"
          href={waUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </a>
      ) : (
        <span
          aria-disabled
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground opacity-50"
          title="No mobile number"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

function PresentStatusBadges({ row }: { row: DayAttendanceEmployee }) {
  const att = row.attendance;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        <UserCheck className="h-3 w-3" />
        {att.display_status ?? "Present"}
      </span>
      {att.is_currently_in ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
          </span>
          Currently Working
        </span>
      ) : null}
      {isLate(row) ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <Timer className="h-3 w-3" />
          {lateLabel(row)}
        </span>
      ) : null}
    </div>
  );
}

function PunchTimes({ row }: { row: DayAttendanceEmployee }) {
  const att = row.attendance;
  return (
    <div className="space-y-1 text-xs">
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <LogIn className="h-3 w-3 shrink-0 text-emerald-600" />
        In: <span className="font-medium text-foreground">{att.punch_in_time_formatted ?? "—"}</span>
      </p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <LogOut className="h-3 w-3 shrink-0 text-rose-500" />
        Out:{" "}
        {att.punch_out_time ? (
          <span className="font-medium text-foreground">{att.punch_out_time_formatted}</span>
        ) : (
          <span className="font-medium text-amber-600">Not Punched Out</span>
        )}
      </p>
    </div>
  );
}

export function TodayAttendancePanel({ token }: { token: string }) {
  const [tab, setTab] = useState<AttendanceTab>("present");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const enabled = Boolean(token);

  const dayStatusQuery = useQuery({
    queryKey: ["hr-day-attendance", token, tab, search, branchId, departmentId, page],
    queryFn: () =>
      getDayAttendanceStatus(token, {
        status: tab,
        search: search || undefined,
        branch_id: branchId || undefined,
        department_id: departmentId || undefined,
        page,
        per_page: PAGE_SIZE,
      }),
    enabled,
    staleTime: 0,
    placeholderData: keepPreviousData,
    refetchInterval: POLL_INTERVAL_MS,
    // Pause polling while the window/tab is in the background.
    refetchIntervalInBackground: false,
    retry: (failureCount, error) => {
      if (error instanceof DayAttendanceError && [401, 403, 422].includes(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const { refetch } = dayStatusQuery;

  // Refresh immediately when the browser tab becomes visible again.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refetch]);

  // An expired session should send the user back to login.
  const queryError = dayStatusQuery.error;
  useEffect(() => {
    if (queryError instanceof DayAttendanceError && queryError.status === 401) {
      clearAuthSession({ redirectToLogin: true });
    }
  }, [queryError]);

  const branchesQuery = useQuery({
    queryKey: ["hr-day-attendance-branches", token],
    queryFn: () => getBranches(token, { status: "active", page: 1, per_page: 100 }),
    enabled,
    staleTime: 10 * 60 * 1000,
  });

  const departmentsQuery = useQuery({
    queryKey: ["hr-day-attendance-departments", token],
    queryFn: () => getDepartments(token, { status: "active", page: 1, per_page: 100 }),
    enabled,
    staleTime: 10 * 60 * 1000,
  });

  const branches = normalizeApiList<Branch>(branchesQuery.data?.data);
  const departments: Department[] = useMemo(
    () => normalizeApiList<Department>(departmentsQuery.data?.data),
    [departmentsQuery.data],
  );

  const summary: DayAttendanceSummary | undefined = dayStatusQuery.data?.data.summary;
  const employees = dayStatusQuery.data?.data.employees ?? [];
  const pagination = dayStatusQuery.data?.pagination;
  const lastPage = pagination?.last_page ?? 1;
  const totalRows = pagination?.total ?? employees.length;

  const lastRefreshedAt = dayStatusQuery.dataUpdatedAt
    ? formatClockTime(new Date(dayStatusQuery.dataUpdatedAt))
    : null;

  const isInitialLoading = dayStatusQuery.isLoading;
  const error =
    dayStatusQuery.isError && queryError instanceof DayAttendanceError ? queryError : null;
  const genericError = dayStatusQuery.isError && !error ? (queryError as Error | null) : null;

  const tabs: Array<{ id: AttendanceTab; label: string; count?: number; activeClass: string; dotClass: string }> = [
    {
      id: "present",
      label: "Present",
      count: summary?.present,
      activeClass: "border-emerald-500 text-emerald-700 dark:text-emerald-300",
      dotClass: "bg-emerald-500",
    },
    {
      id: "absent",
      label: "Absent",
      count: summary?.absent,
      activeClass: "border-rose-500 text-rose-700 dark:text-rose-300",
      dotClass: "bg-rose-500",
    },
  ];

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="min-w-0 space-y-3 px-4 pb-2 sm:space-y-4 sm:px-6">
        <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
              <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
              Today&apos;s Attendance
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Who is present and who is absent today
              {dayStatusQuery.data?.data.date ? ` · ${dayStatusQuery.data.data.date}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {lastRefreshedAt ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Updated {lastRefreshedAt}
              </span>
            ) : null}
            <div className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-muted/20 px-2.5 text-sm">
              <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="text-xs text-muted-foreground">Total Staff</span>
              <span className="font-bold tabular-nums text-foreground">
                {isInitialLoading ? "—" : (summary?.total_employees ?? 0)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
                href={attendanceBoardHref({ section: "live", view: "in" })}
              >
                <LogIn className="h-3.5 w-3.5" />
                IN
                <span className="tabular-nums">
                  {isInitialLoading ? "—" : (summary?.yet_to_punch_out ?? 0)}
                </span>
              </Link>
              <Link
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950/70"
                href={attendanceBoardHref({ section: "live", view: "out" })}
              >
                <LogOut className="h-3.5 w-3.5" />
                OUT
                <span className="tabular-nums">
                  {isInitialLoading
                    ? "—"
                    : Math.max(0, (summary?.punched_in ?? 0) - (summary?.yet_to_punch_out ?? 0))}
                </span>
              </Link>
              <Link
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
                href={attendanceBoardHref({ section: "live", view: "not_in" })}
              >
                <UserX className="h-3.5 w-3.5" />
                <span className="hidden min-[380px]:inline">Not Punch-In</span>
                <span className="min-[380px]:hidden">Not IN</span>
                <span className="tabular-nums">
                  {isInitialLoading
                    ? "—"
                    : Math.max(0, (summary?.total_employees ?? 0) - (summary?.punched_in ?? 0))}
                </span>
              </Link>
            </div>
            <Button
              aria-label="Refresh"
              className="h-9 w-9 rounded-xl p-0"
              disabled={dayStatusQuery.isFetching}
              onClick={() => void refetch()}
              size="sm"
              variant="outline"
            >
              <RefreshCw
                className={cn("h-4 w-4", dayStatusQuery.isFetching && "animate-spin")}
              />
            </Button>
          </div>
        </div>

        {/* Compact one-row strip — only this row scrolls sideways */}
        <div className="min-w-0 max-w-full overflow-hidden">
          <div
            aria-label="Attendance summary stats"
            className="flex gap-1.5 overflow-x-auto overscroll-x-contain touch-pan-x pb-0.5 [scrollbar-width:thin]"
          >
            <SummaryTile
              icon={UserCheck}
              label="Present Today"
              loading={isInitialLoading}
              tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
              value={summary?.present ?? 0}
            />
            <SummaryTile
              icon={UserX}
              label="Absent Today"
              loading={isInitialLoading}
              tone="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"
              value={summary?.absent ?? 0}
            />
            <SummaryTile
              icon={CalendarClock}
              label="On Leave"
              loading={isInitialLoading}
              tone="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300"
              value={summary?.on_leave ?? 0}
            />
            <SummaryTile
              icon={Clock3}
              label="Half Day"
              loading={isInitialLoading}
              tone="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300"
              value={summary?.half_day ?? 0}
            />
            <SummaryTile
              icon={Timer}
              label="Yet to Punch Out"
              loading={isInitialLoading}
              tone="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
              value={summary?.yet_to_punch_out ?? 0}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={cn(
                "-mb-px flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-sm font-medium transition-colors sm:gap-2 sm:px-3",
                tab === t.id
                  ? t.activeClass
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
              type="button"
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", t.dotClass)} />
              <span className="truncate">{t.label}</span>
              {typeof t.count === "number" ? (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground sm:px-2 sm:text-xs">
                  {t.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Filters — flex row on desktop, stacked/paired on mobile */}
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-xl pl-9"
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, code, email…"
              value={searchInput}
            />
          </div>
          <div className="flex min-w-0 gap-2 sm:w-auto sm:shrink-0">
            <NativeSelectFilter
              aria-label="Branch"
              className="h-10 min-w-0 flex-1 rounded-xl sm:w-36 sm:flex-none lg:w-40"
              onChange={(e) => {
                setBranchId(e.target.value);
                setPage(1);
              }}
              value={branchId}
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={String(branch.id)}>
                  {branch.name}
                </option>
              ))}
            </NativeSelectFilter>
            <NativeSelectFilter
              aria-label="Department"
              className="h-10 min-w-0 flex-1 rounded-xl sm:w-40 sm:flex-none lg:w-44"
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
              value={departmentId}
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={String(department.id)}>
                  {department.name}
                </option>
              ))}
            </NativeSelectFilter>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pt-2 sm:px-6">
        {/* Error states */}
        {error?.status === 403 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
            <ShieldAlert className="h-8 w-8 text-rose-500" />
            <p className="text-sm font-medium">You do not have permission to view attendance.</p>
          </div>
        ) : error?.status === 422 ? (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              {error.message}
            </p>
            {error.fieldErrors ? (
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
                {Object.entries(error.fieldErrors).map(([field, messages]) => (
                  <li key={field}>{messages.join(", ")}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : error || genericError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
            <div>
              <p className="text-sm font-medium">Unable to load today&apos;s attendance</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error?.message ?? genericError?.message ?? "Something went wrong."}
              </p>
            </div>
            <Button onClick={() => void refetch()} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : isInitialLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3.5">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted/70" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted/70" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted/50" />
                </div>
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted/60" />
              </div>
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
            {tab === "present" ? (
              <UserCheck className="h-8 w-8 text-muted-foreground" />
            ) : (
              <UserX className="h-8 w-8 text-muted-foreground" />
            )}
            <p className="text-sm font-medium">
              {tab === "present" ? "No one present found" : "No one absent found"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search || branchId || departmentId
                ? "Try adjusting your search or filters."
                : "Nothing to show for today yet."}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="space-y-3 lg:hidden">
              {employees.map((row) => (
                <div
                  key={row.employee.id}
                  className={cn(
                    "rounded-xl border p-3.5 shadow-xs",
                    tab === "absent"
                      ? "border-rose-200/70 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/10"
                      : "border-border bg-muted/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <EmployeeIdentity row={row} />
                    {tab === "absent" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                        <UserX className="h-3 w-3" />
                        {row.attendance.display_status ?? "Absent"}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                    <ContactActions mobile={row.employee.mobile} />
                    {tab === "present" ? <PunchTimes row={row} /> : null}
                  </div>
                  {tab === "present" ? (
                    <div className="mt-3">
                      <PresentStatusBadges row={row} />
                    </div>
                  ) : (
                    <p className="mt-3 text-xs italic text-muted-foreground">
                      No attendance recorded today
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border lg:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Employee</th>
                    <th className="px-4 py-2.5 font-medium">Contact</th>
                    {tab === "present" ? (
                      <>
                        <th className="px-4 py-2.5 font-medium">Punch Times</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                      </>
                    ) : (
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((row) => (
                    <tr
                      key={row.employee.id}
                      className="border-b border-border/60 last:border-b-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <EmployeeIdentity row={row} />
                      </td>
                      <td className="px-4 py-3">
                        <ContactActions mobile={row.employee.mobile} />
                      </td>
                      {tab === "present" ? (
                        <>
                          <td className="px-4 py-3">
                            <PunchTimes row={row} />
                          </td>
                          <td className="px-4 py-3">
                            <PresentStatusBadges row={row} />
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                            <UserX className="h-3 w-3" />
                            {row.attendance.display_status ?? "Absent"}
                          </span>
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            No attendance recorded today
                          </p>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && lastPage > 1 ? (
              <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                <p className="text-xs text-muted-foreground">
                  Page {pagination.current_page} of {lastPage} · {totalRows} employees
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={page <= 1 || dayStatusQuery.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    size="sm"
                    variant="outline"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    disabled={page >= lastPage || dayStatusQuery.isFetching}
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                    size="sm"
                    variant="outline"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
