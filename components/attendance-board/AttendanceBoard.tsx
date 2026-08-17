"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  LogIn,
  LogOut,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { FeedEmployeeAvatar } from "@/components/live-attendance/FeedEmployeeAvatar";
import { BreakCountValue } from "@/components/attendance/BreakCountValue";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelectFilter } from "@/components/ui/native-select";
import { getBranches, type Branch } from "@/lib/api/branch";
import { normalizeApiList } from "@/lib/api/normalize-list";
import {
  DayAttendanceError,
  getDayAttendanceStatus,
  getDayAttendanceStatusAll,
  type DayAttendanceEmployee,
  type DayAttendanceStatusFilter,
} from "@/lib/api/day-attendance";
import { getDepartments, type Department } from "@/lib/api/department";
import {
  getEmployeeProfilePhotoProxyUrl,
  resolveApiAssetUrl,
} from "@/lib/api/employees/http";
import {
  attendanceBoardHref,
  filterLivePunchView,
  formatBoardDateLabel,
  livePunchStatusLabel,
  localIsoDate,
  shiftIsoDate,
  telHref,
  whatsappHref,
  type AttendanceBoardSection,
  type DailyStatusView,
  type LivePunchView,
} from "@/lib/attendance-board";
import { clearAuthSession } from "@/lib/auth-cookie";
import {
  canViewLiveAttendanceSession,
  isEmployeeSession,
  readAuthUser,
} from "@/lib/auth-session";
import { useAuthToken } from "@/lib/use-auth-token";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function parseSection(raw: string | null): AttendanceBoardSection {
  return raw === "daily" ? "daily" : "live";
}

function parseLiveView(raw: string | null): LivePunchView {
  if (raw === "in" || raw === "out" || raw === "not_in" || raw === "all") return raw;
  return "all";
}

function parseDailyView(raw: string | null): DailyStatusView {
  const allowed: DailyStatusView[] = [
    "all",
    "present",
    "half_day",
    "absent",
    "leave",
    "week_off",
    "holiday",
  ];
  if (raw && (allowed as string[]).includes(raw)) return raw as DailyStatusView;
  return "all";
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

function SelfieThumb({
  src,
  label,
  emptyLabel,
}: {
  src?: string | null;
  label: string;
  emptyLabel: string;
}) {
  const url = resolveApiAssetUrl(src);
  return (
    <div className="shrink-0">
      <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-border bg-muted/40 sm:h-16 sm:w-16">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={label} className="h-full w-full object-cover" src={url} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-0.5 px-1 text-center text-muted-foreground">
            <Camera className="h-3.5 w-3.5 opacity-50" />
            <span className="text-[8px] leading-tight">{emptyLabel}</span>
          </div>
        )}
      </div>
      <p className="mt-0.5 text-center text-[9px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function LiveEmployeeCard({ row }: { row: DayAttendanceEmployee }) {
  const { employee, attendance } = row;
  const status = livePunchStatusLabel(row);
  const photoSrc = employee.profile_photo_url
    ? getEmployeeProfilePhotoProxyUrl(employee.id)
    : undefined;

  return (
    <div className="rounded-xl border border-border p-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        <FeedEmployeeAvatar
          className="h-9 w-9 shrink-0 ring-2 ring-border/60"
          name={employee.name}
          src={photoSrc}
          textClassName="text-[10px]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{employee.name}</p>
          <p className="truncate text-xs text-muted-foreground">{employee.employee_code ?? "—"}</p>
        </div>
        <ContactActions mobile={employee.mobile} />
        <span
          className={cn(
            "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            status === "IN" &&
              "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
            status === "OUT" &&
              "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
            status === "Not Punch-In" &&
              "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
          )}
        >
          {status}
        </span>
      </div>

      <div className="mt-2.5 flex items-end gap-3">
        <div className="flex gap-2">
          <SelfieThumb emptyLabel="—" label="In" src={attendance.punch_in_selfie_url} />
          <SelfieThumb emptyLabel="—" label="Out" src={attendance.punch_out_selfie_url} />
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-xs">
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <LogIn className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            In:{" "}
            <span className="font-semibold text-foreground">
              {attendance.punch_in_time_formatted ?? "—"}
            </span>
          </p>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <LogOut className="h-3.5 w-3.5 shrink-0 text-rose-500" />
            Out:{" "}
            <span className="font-semibold text-foreground">
              {attendance.punch_out_time_formatted ?? "—"}
            </span>
          </p>
          <p className="text-muted-foreground">
            Breaks:{" "}
            <BreakCountValue
              breakCount={attendance.break_count}
              totalBreakMinutes={attendance.total_break_minutes}
              inline
            />
          </p>
        </div>
      </div>
    </div>
  );
}

function DailyEmployeeRow({ row }: { row: DayAttendanceEmployee }) {
  const { employee, attendance } = row;
  const photoSrc = employee.profile_photo_url
    ? getEmployeeProfilePhotoProxyUrl(employee.id)
    : undefined;

  return (
    <div className="rounded-xl border border-border p-3.5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <FeedEmployeeAvatar
            className="h-11 w-11 shrink-0 ring-2 ring-border/60"
            name={employee.name}
            src={photoSrc}
            textClassName="text-xs"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{employee.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {employee.employee_code ?? "—"}
              {employee.department ? ` · ${employee.department}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ContactActions mobile={employee.mobile} />
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              attendance.status === "present" &&
                "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
              attendance.status === "half_day" &&
                "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
              attendance.status === "absent" &&
                "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
              attendance.status === "leave" &&
                "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
              !["present", "half_day", "absent", "leave"].includes(attendance.status ?? "") &&
                "bg-muted text-muted-foreground",
            )}
          >
            {attendance.display_status ?? attendance.status ?? "—"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <LogIn className="h-3 w-3 shrink-0 text-emerald-600" />
          In:{" "}
          <span className="font-medium text-foreground">
            {attendance.punch_in_time_formatted ?? "—"}
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <LogOut className="h-3 w-3 shrink-0 text-rose-500" />
          Out:{" "}
          <span className="font-medium text-foreground">
            {attendance.punch_out_time_formatted ?? "—"}
          </span>
        </p>
        <p className="text-muted-foreground">
          Break Count:{" "}
          <BreakCountValue
            breakCount={attendance.break_count}
            totalBreakMinutes={attendance.total_break_minutes}
            inline
          />
        </p>
      </div>
    </div>
  );
}

export function AttendanceBoard() {
  const token = useAuthToken();
  const router = useRouter();
  const searchParams = useSearchParams();

  const section = parseSection(searchParams.get("section"));
  const liveView = parseLiveView(searchParams.get("view"));
  const dailyView = parseDailyView(searchParams.get("view"));
  const dateParam = searchParams.get("date");
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : localIsoDate();
  const today = localIsoDate();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const user = readAuthUser();
    if (isEmployeeSession(user) || !canViewLiveAttendanceSession(user)) {
      router.replace("/employee-dashboard");
    }
  }, [router]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [section, liveView, dailyView, selectedDate, branchId, departmentId]);

  const replaceQuery = (next: {
    section?: AttendanceBoardSection;
    view?: string;
    date?: string;
  }) => {
    router.replace(
      attendanceBoardHref({
        section: next.section ?? section,
        view: next.view ?? (section === "live" ? liveView : dailyView),
        date: next.date ?? selectedDate,
      }),
    );
  };

  const enabled = Boolean(token);

  const branchesQuery = useQuery({
    queryKey: ["attendance-board-branches", token],
    queryFn: () => getBranches(token, { status: "active", page: 1, per_page: 100 }),
    enabled: enabled && section === "daily",
    staleTime: 10 * 60 * 1000,
  });

  const departmentsQuery = useQuery({
    queryKey: ["attendance-board-departments", token],
    queryFn: () => getDepartments(token, { status: "active", page: 1, per_page: 100 }),
    enabled: enabled && section === "daily",
    staleTime: 10 * 60 * 1000,
  });

  const branches = normalizeApiList<Branch>(branchesQuery.data?.data);
  const departments: Department[] = useMemo(
    () => normalizeApiList<Department>(departmentsQuery.data?.data),
    [departmentsQuery.data],
  );

  const liveQuery = useQuery({
    queryKey: ["attendance-board-live", token, selectedDate, search],
    queryFn: () =>
      getDayAttendanceStatusAll(token, {
        date: selectedDate,
        search: search || undefined,
      }),
    enabled: enabled && section === "live",
    placeholderData: keepPreviousData,
    refetchInterval: selectedDate === today ? 45_000 : false,
  });

  const dailyQuery = useQuery({
    queryKey: [
      "attendance-board-daily",
      token,
      selectedDate,
      dailyView,
      search,
      branchId,
      departmentId,
      page,
    ],
    queryFn: () =>
      getDayAttendanceStatus(token, {
        date: selectedDate,
        status: dailyView === "all" ? undefined : (dailyView as DayAttendanceStatusFilter),
        search: search || undefined,
        branch_id: branchId || undefined,
        department_id: departmentId || undefined,
        page,
        per_page: PAGE_SIZE,
      }),
    enabled: enabled && section === "daily",
    placeholderData: keepPreviousData,
  });

  const activeQuery = section === "live" ? liveQuery : dailyQuery;
  const queryError = activeQuery.error;
  useEffect(() => {
    if (queryError instanceof DayAttendanceError && queryError.status === 401) {
      clearAuthSession({ redirectToLogin: true });
    }
  }, [queryError]);

  const summary = activeQuery.data?.data.summary;
  const liveEmployees = useMemo(() => {
    const all = liveQuery.data?.data.employees ?? [];
    return filterLivePunchView(all, liveView);
  }, [liveQuery.data, liveView]);

  const livePageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return liveEmployees.slice(start, start + PAGE_SIZE);
  }, [liveEmployees, page]);

  const liveLastPage = Math.max(1, Math.ceil(liveEmployees.length / PAGE_SIZE));
  const dailyEmployees = dailyQuery.data?.data.employees ?? [];
  const dailyPagination = dailyQuery.data?.pagination;
  const dailyLastPage = dailyPagination?.last_page ?? 1;

  const displayEmployees = section === "live" ? livePageItems : dailyEmployees;
  const lastPage = section === "live" ? liveLastPage : dailyLastPage;
  const totalRows = section === "live" ? liveEmployees.length : (dailyPagination?.total ?? 0);
  const isLoading = activeQuery.isLoading;
  const isFetching = activeQuery.isFetching;

  const liveCounts = useMemo(() => {
    const all = liveQuery.data?.data.employees ?? [];
    return {
      all: all.length,
      in: filterLivePunchView(all, "in").length,
      out: filterLivePunchView(all, "out").length,
      not_in: filterLivePunchView(all, "not_in").length,
    };
  }, [liveQuery.data]);

  const sectionTabs: Array<{ id: AttendanceBoardSection; label: string }> = [
    { id: "live", label: "Live Attendance" },
    { id: "daily", label: "Daily Attendance" },
  ];

  const liveTabs: Array<{ id: LivePunchView; label: string; count: number; tone: string }> = [
    {
      id: "all",
      label: "ALL",
      count: liveCounts.all,
      tone: "border-primary text-primary",
    },
    {
      id: "in",
      label: "IN",
      count: liveCounts.in,
      tone: "border-emerald-500 text-emerald-700 dark:text-emerald-300",
    },
    {
      id: "out",
      label: "OUT",
      count: liveCounts.out,
      tone: "border-sky-500 text-sky-700 dark:text-sky-300",
    },
    {
      id: "not_in",
      label: "Not Punch-In",
      count: liveCounts.not_in,
      tone: "border-rose-500 text-rose-700 dark:text-rose-300",
    },
  ];

  const dailyTabs: Array<{ id: DailyStatusView; label: string; count?: number }> = [
    { id: "all", label: "ALL", count: summary?.total_employees },
    { id: "present", label: "Present", count: summary?.present },
    { id: "half_day", label: "Half Day", count: summary?.half_day },
    { id: "absent", label: "Absent", count: summary?.absent },
    { id: "leave", label: "On Leave", count: summary?.on_leave },
  ];

  return (
    <section className="min-w-0 space-y-4 overflow-x-hidden sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">Attendance Board</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Live punch status and daily attendance roster
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-muted/20 px-2.5 text-sm">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Total Staff</span>
            <span className="font-bold tabular-nums">
              {isLoading ? "—" : (summary?.total_employees ?? 0)}
            </span>
          </div>
          <Button
            aria-label="Refresh"
            className="h-9 w-9 rounded-xl p-0"
            disabled={isFetching}
            onClick={() => void activeQuery.refetch()}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-xl")} href="/hr-dashboard">
            Back
          </Link>
        </div>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="min-w-0 space-y-3 px-4 pb-2 sm:space-y-4 sm:px-6">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1">
            {sectionTabs.map((tab) => (
              <button
                key={tab.id}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  section === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() =>
                  replaceQuery({
                    section: tab.id,
                    view: "all",
                  })
                }
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              aria-label="Previous day"
              className="h-9 w-9 rounded-xl p-0"
              onClick={() => replaceQuery({ date: shiftIsoDate(selectedDate, -1) })}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 rounded-xl pl-9"
                onChange={(e) => {
                  if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
                    replaceQuery({ date: e.target.value });
                  }
                }}
                type="date"
                value={selectedDate}
              />
            </div>
            <Button
              aria-label="Next day"
              className="h-9 w-9 rounded-xl p-0"
              disabled={selectedDate >= today}
              onClick={() => replaceQuery({ date: shiftIsoDate(selectedDate, 1) })}
              size="sm"
              variant="outline"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              className="h-9 rounded-xl"
              disabled={selectedDate === today}
              onClick={() => replaceQuery({ date: today })}
              size="sm"
              variant="outline"
            >
              Today
            </Button>
            <p className="w-full text-xs text-muted-foreground sm:ml-1 sm:w-auto">
              {formatBoardDateLabel(selectedDate)}
              {selectedDate === today ? " · Today" : ""}
            </p>
          </div>

          {section === "live" ? (
            <div className="flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:thin]">
              {liveTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={cn(
                    "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    liveView === tab.id
                      ? tab.tone
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => replaceQuery({ view: tab.id })}
                  type="button"
                >
                  {tab.id === "all" ? (
                    <LayoutGrid className="h-3.5 w-3.5" />
                  ) : tab.id === "in" ? (
                    <LogIn className="h-3.5 w-3.5" />
                  ) : tab.id === "out" ? (
                    <LogOut className="h-3.5 w-3.5" />
                  ) : (
                    <UserX className="h-3.5 w-3.5" />
                  )}
                  {tab.label}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {liveQuery.isLoading ? "—" : tab.count}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:thin]">
              {dailyTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={cn(
                    "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    dailyView === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => replaceQuery({ view: tab.id })}
                  type="button"
                >
                  {tab.id === "all" ? (
                    <LayoutGrid className="h-3.5 w-3.5" />
                  ) : tab.id === "present" ? (
                    <UserCheck className="h-3.5 w-3.5" />
                  ) : tab.id === "half_day" ? (
                    <Clock3 className="h-3.5 w-3.5" />
                  ) : tab.id === "absent" ? (
                    <UserX className="h-3.5 w-3.5" />
                  ) : (
                    <CalendarDays className="h-3.5 w-3.5" />
                  )}
                  {tab.label}
                  {typeof tab.count === "number" ? (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                      {tab.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {/* Live: search only. Daily: search + branch + department */}
          {section === "live" ? (
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 rounded-xl pl-9"
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, code…"
                value={searchInput}
              />
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 rounded-xl pl-9"
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search name, code, email…"
                  value={searchInput}
                />
              </div>
              <div className="flex min-w-0 gap-2 sm:shrink-0">
                <NativeSelectFilter
                  aria-label="Branch"
                  className="h-10 min-w-0 flex-1 rounded-xl sm:w-36 sm:flex-none"
                  onChange={(e) => setBranchId(e.target.value)}
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
                  className="h-10 min-w-0 flex-1 rounded-xl sm:w-40 sm:flex-none"
                  onChange={(e) => setDepartmentId(e.target.value)}
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
          )}
        </CardHeader>

        <CardContent className="space-y-3 px-4 pt-2 sm:px-6">
          {activeQuery.isError ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-rose-500" />
              <p className="text-sm font-medium">Unable to load attendance</p>
              <p className="text-sm text-muted-foreground">
                {queryError instanceof Error ? queryError.message : "Something went wrong."}
              </p>
              <Button onClick={() => void activeQuery.refetch()} size="sm" variant="outline">
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-muted/70" />
                    <div className="h-4 w-1/3 animate-pulse rounded bg-muted/70" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="aspect-[4/3] animate-pulse rounded-lg bg-muted/50" />
                    <div className="aspect-[4/3] animate-pulse rounded-lg bg-muted/50" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayEmployees.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm font-medium">No records found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another tab, date, or search.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {displayEmployees.map((row) =>
                  section === "live" ? (
                    <LiveEmployeeCard key={row.employee.id} row={row} />
                  ) : (
                    <DailyEmployeeRow key={row.employee.id} row={row} />
                  ),
                )}
              </div>

              {lastPage > 1 ? (
                <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {lastPage} · {totalRows} people
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={page <= 1 || isFetching}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      size="sm"
                      variant="outline"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      disabled={page >= lastPage || isFetching}
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
    </section>
  );
}
