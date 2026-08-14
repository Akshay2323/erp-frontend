"use client";

import {
  CalendarClock,
  CalendarRange,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  getAdminAttendance,
  hoursBetweenPunches,
  formatDecimalHoursTotal,
  formatBreakCountSummary,
  formatWorkingHoursSummaryValue,
  upsertAdminAttendance,
  getEmployeeMonthlySummary,
  parseWorkingHoursToDecimal,
  type AdminAttendanceRecord,
  type EmployeeMonthlySummaryDay,
} from "@/lib/api/attendance";
import {
  buildPunchIso,
  resolveShiftPunchTimes,
  type ShiftPunchTimes,
} from "@/lib/attendance/shift-punch-times";
import { getBranches, type Branch } from "@/lib/api/branch";
import { getDepartments, type Department } from "@/lib/api/department";
import { getEmployees, resolveEmployeeSession, type EmployeeRecord } from "@/lib/api/employee";
import { EmployeeListAvatar } from "@/components/employee/EmployeeListAvatar";
import { BulkAttendanceEditModal } from "@/components/attendance/BulkAttendanceEditModal";
import { EmployeeMonthlyEditModal } from "@/components/attendance/EmployeeMonthlyEditModal";
import { BreakCountValue } from "@/components/attendance/BreakCountValue";
import { getTenantsList, type Tenant } from "@/lib/api/tenants";
import { useAuthToken } from "@/lib/use-auth-token";

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

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

function ymKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}

function dateFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isDayEditable(year: number, month: number, day: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(year, month - 1, day);
  selected.setHours(0, 0, 0, 0);
  return selected.getTime() <= today.getTime();
}

function isMonthEditable(year: number, month: number): boolean {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  if (year > currentYear) return false;
  if (year === currentYear && month > currentMonth) return false;
  return true;
}

function empDisplayName(e: EmployeeRecord) {
  return (
    e.full_name?.trim() ||
    e.name?.trim() ||
    [e.first_name, e.last_name].filter(Boolean).join(" ").trim() ||
    "—"
  );
}

type Cell = { letter: string; bg: string; text: string; record?: AdminAttendanceRecord };

function statusToCell(status?: string | null): Cell {
  const s = (status ?? "").toLowerCase().replace(/_/g, " ");
  if (!s) return { letter: "", bg: "bg-muted/50", text: "text-muted-foreground" };
  if (s.includes("half") || s === "hd" || s.includes("half day") || s.includes("halfday"))
    return { letter: "HD", bg: "bg-violet-500", text: "text-white" };
  if (
    s.includes("week off") ||
    s.includes("weekoff") ||
    s.includes("weekly off") ||
    s === "wo" ||
    s === "w"
  )
    return { letter: "W", bg: "bg-amber-400", text: "text-slate-900" };
  if (s.includes("present") || s === "p")
    return { letter: "P", bg: "bg-emerald-500", text: "text-white" };
  if (s.includes("absent") || s === "a")
    return { letter: "A", bg: "bg-red-500", text: "text-white" };
  if (s.includes("leave") || s === "l")
    return { letter: "L", bg: "bg-sky-600", text: "text-white" };
  if (s.includes("holiday") || s === "h")
    return { letter: "H", bg: "bg-slate-400", text: "text-white" };
  return { letter: "•", bg: "bg-muted", text: "text-muted-foreground" };
}

function recordDateFromRow(row: { attendance_date?: string; date?: string }): string {
  return row.attendance_date ?? row.date ?? "";
}

function summaryDayToAdminRecord(
  row: EmployeeMonthlySummaryDay,
  empId: number,
): AdminAttendanceRecord {
  return {
    id: 0,
    tenant_id: 0,
    company_id: 0,
    employee_id: empId,
    branch_id: 0,
    attendance_date: row.date,
    punch_in_time: row.punch_in ?? null,
    punch_out_time: row.punch_out ?? null,
    punch_in_latitude: null,
    punch_in_longitude: null,
    punch_in_distance: null,
    punch_out_latitude: null,
    punch_out_longitude: null,
    punch_out_distance: null,
    status: row.status ?? null,
    remarks: row.remarks ?? null,
    outside_location: false,
    needs_review: false,
    is_manually_modified: false,
    manual_modified_by: null,
    manual_modified_at: null,
    manual_override_reason: null,
    punch_in_image: null,
    punch_out_image: null,
    break_count: row.break_count ?? 0,
    other_count: row.other_count ?? 0,
    total_break_minutes: row.total_break_minutes ?? 0,
    total_other_minutes: row.total_other_minutes ?? 0,
    total_interval_minutes: row.total_interval_minutes ?? 0,
    created_at: "",
    updated_at: "",
    manual_modifier: null,
  };
}

function dayFromDateStr(dateStr: string, ym: string): number | null {
  if (!dateStr || !dateStr.startsWith(ym)) return null;
  const d = parseInt(dateStr.slice(8, 10), 10);
  return Number.isFinite(d) && d >= 1 && d <= 31 ? d : null;
}

async function fetchAllEmployees(
  token: string,
  filters: { company_id?: string; branch_id?: string; department_id?: string },
): Promise<EmployeeRecord[]> {
  const all: EmployeeRecord[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const res = await getEmployees(token, {
      page,
      per_page: 100,
      company_id: filters.company_id || undefined,
      branch_id: filters.branch_id || undefined,
      department_id: filters.department_id || undefined,
    });
    const items = employeeListItemsFromEnvelope(res.data);
    all.push(...items);
    lastPage = res.meta?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage && page < 500);
  return all;
}

async function fetchAllAdminAttendance(
  token: string,
  filters: {
    company_id?: string;
    branch_id?: string;
    department_id?: string;
    from_date?: string;
    to_date?: string;
  },
): Promise<AdminAttendanceRecord[]> {
  const all: AdminAttendanceRecord[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const res = await getAdminAttendance(token, {
      page,
      per_page: 100,
      company_id: filters.company_id || undefined,
      branch_id: filters.branch_id || undefined,
      department_id: filters.department_id || undefined,
      from_date: filters.from_date || undefined,
      to_date: filters.to_date || undefined,
    });
    const items = res.data?.records ?? [];
    all.push(...items);
    lastPage = res.meta?.pagination?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage && page < 500);
  return all;
}

type GridRow = {
  employee: EmployeeRecord;
  days: (Cell | null)[];
  totalWh: string;
  totalBreakCount: number;
  totalBreakMinutes: number;
  loadError?: string;
};

function collectRoleHints(u: unknown): string[] {
  if (!u || typeof u !== "object") return [];
  const o = u as Record<string, unknown>;
  const hints: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === "string" && v.trim()) hints.push(v.toLowerCase().trim());
  };
  add(o.role_name);
  add(o.role);
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

const isSessionAdmin = (role?: string, sessionUser?: unknown) => {
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

function parseTimeOnly(isoStr?: string | null): string {
  if (!isoStr) return "";
  const match = isoStr.match(/T(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  // Try fallback match for space separator
  const matchSpace = isoStr.match(/\s(\d{2}):(\d{2})/);
  if (matchSpace) {
    return `${matchSpace[1]}:${matchSpace[2]}`;
  }
  return "";
}

function fillEmptyPastDays(days: (Cell | null)[], empId: number, ym: string, dim: number): (Cell | null)[] {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-indexed
  const todayDate = today.getDate();

  const [yStr, mStr] = ym.split("-");
  const gridYear = parseInt(yStr);
  const gridMonth = parseInt(mStr);

  for (let d = 1; d <= dim; d++) {
    if (days[d - 1] === null) {
      // Determine if this day is in the past (before today)
      let isPast = false;
      if (gridYear < todayYear) {
        isPast = true;
      } else if (gridYear === todayYear) {
        if (gridMonth < todayMonth) {
          isPast = true;
        } else if (gridMonth === todayMonth) {
          if (d < todayDate) {
            isPast = true;
          }
        }
      }

      if (isPast) {
        days[d - 1] = {
          letter: "A",
          bg: "bg-red-50 dark:bg-red-900/20",
          text: "text-red-700 dark:text-red-300 font-bold",
          record: {
            id: 0, // Mock ID indicates no actual DB record exists yet
            employee_id: empId,
            attendance_date: `${ym}-${String(d).padStart(2, "0")}`,
            status: "absent",
            punch_in_time: null,
            punch_out_time: null,
            remarks: "",
            manual_override_reason: null,
            outside_location: false,
            needs_review: false,
            is_manually_modified: false,
            manual_modified_by: null,
            manual_modified_at: null,
            punch_in_image: null,
            punch_out_image: null,
            created_at: "",
            updated_at: "",
            manual_modifier: null,
            punch_in_latitude: null,
            punch_in_longitude: null,
            punch_in_distance: null,
            punch_out_latitude: null,
            punch_out_longitude: null,
            punch_out_distance: null,
          } as any,
        };
      }
    }
  }
  return days;
}

export default function MonthlyAttendancePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const token = useAuthToken();
  const [companies, setCompanies] = useState<Tenant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [gridRows, setGridRows] = useState<GridRow[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [error, setError] = useState("");

  const [isAdminUser, setIsAdminUser] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<string>("");
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [employeeCode, setEmployeeCode] = useState<string>("");
  const [sessionReady, setSessionReady] = useState(false);

  const ym = useMemo(() => ymKey(year, month), [year, month]);
  const dim = useMemo(() => daysInMonth(year, month), [year, month]);
  const dayNumbers = useMemo(() => Array.from({ length: dim }, (_, i) => i + 1), [dim]);

  const [selectedCell, setSelectedCell] = useState<{
    employee: EmployeeRecord;
    date: string;
    record: AdminAttendanceRecord;
  } | null>(null);

  const [punchInTime, setPunchInTime] = useState("");
  const [punchOutTime, setPunchOutTime] = useState("");
  const [punchInTimeOnly, setPunchInTimeOnly] = useState("");
  const [punchOutTimeOnly, setPunchOutTimeOnly] = useState("");
  const [status, setStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [updating, setUpdating] = useState(false);
  const [shiftDayTimes, setShiftDayTimes] = useState<ShiftPunchTimes | null>(null);
  const [loadingShiftTimes, setLoadingShiftTimes] = useState(false);

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditDay, setBulkEditDay] = useState<number | undefined>(undefined);
  const [monthlyEditEmployee, setMonthlyEditEmployee] = useState<EmployeeRecord | null>(null);

  const bulkTargetCount =
    selectedEmployeeIds.length > 0 ? selectedEmployeeIds.length : gridRows.length;
  const bulkButtonLabel =
    selectedEmployeeIds.length > 0
      ? `Bulk Edit Attendance (${selectedEmployeeIds.length} selected)`
      : "Bulk Edit Attendance (All filtered)";
  const hasEditableDaysInMonth = useMemo(
    () => dayNumbers.some((d) => isDayEditable(year, month, d)),
    [dayNumbers, year, month],
  );
  const allEmployeesSelected =
    gridRows.length > 0 && selectedEmployeeIds.length === gridRows.length;
  const someEmployeesSelected =
    selectedEmployeeIds.length > 0 && selectedEmployeeIds.length < gridRows.length;
  const bulkEditDisabled =
    !isAdminUser ||
    gridRows.length === 0 ||
    !hasEditableDaysInMonth ||
    bulkTargetCount > 250;
  const monthEditDisabled = !isAdminUser || !isMonthEditable(year, month);

  const openBulkEdit = useCallback((day?: number) => {
    setBulkEditDay(day);
    setBulkEditOpen(true);
  }, []);

  const toggleEmployeeSelection = useCallback((employeeId: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId],
    );
  }, []);

  const toggleSelectAllEmployees = useCallback(
    (checked: boolean) => {
      setSelectedEmployeeIds(checked ? gridRows.map((row) => row.employee.id) : []);
    },
    [gridRows],
  );

  useEffect(() => {
    setSelectedEmployeeIds([]);
  }, [year, month, companyId, branchId, departmentId]);

  const applyShiftPunchTimes = useCallback((times: ShiftPunchTimes, date: string) => {
    setPunchInTimeOnly(times.shiftStart);
    setPunchOutTimeOnly(times.shiftEnd);
    setPunchInTime(buildPunchIso(date, times.shiftStart));
    setPunchOutTime(buildPunchIso(date, times.shiftEnd));
  }, []);

  useEffect(() => {
    if (selectedCell) {
      const inT = selectedCell.record.punch_in_time || "";
      const outT = selectedCell.record.punch_out_time || "";
      setPunchInTime(inT);
      setPunchOutTime(outT);
      setPunchInTimeOnly(parseTimeOnly(inT));
      setPunchOutTimeOnly(parseTimeOnly(outT));
      setStatus(selectedCell.record.status || "present");
      setRemarks(selectedCell.record.remarks || "");
      setOverrideReason(selectedCell.record.manual_override_reason || "");
    } else {
      setPunchInTime("");
      setPunchOutTime("");
      setPunchInTimeOnly("");
      setPunchOutTimeOnly("");
      setStatus("");
      setRemarks("");
      setOverrideReason("");
    }
  }, [selectedCell]);

  useEffect(() => {
    if (!selectedCell || !token) {
      setShiftDayTimes(null);
      setLoadingShiftTimes(false);
      return;
    }

    const empCode = selectedCell.employee.employee_code?.trim();
    if (!empCode) {
      setShiftDayTimes(null);
      return;
    }

    let cancelled = false;
    setLoadingShiftTimes(true);

    (async () => {
      try {
        const monthKey = selectedCell.date.slice(0, 7);
        const { records } = await getEmployeeMonthlySummary(token, empCode, monthKey);
        if (cancelled) return;

        const day = records.find((record) => record.date === selectedCell.date);
        const resolved = resolveShiftPunchTimes(day?.shift_start, day?.shift_end);
        setShiftDayTimes(resolved);
      } catch {
        if (!cancelled) setShiftDayTimes(null);
      } finally {
        if (!cancelled) setLoadingShiftTimes(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCell, token]);

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedCell) return;
    if (!overrideReason.trim()) {
      toast.error("Please provide a manual override reason.");
      return;
    }
    setUpdating(true);
    try {
      await upsertAdminAttendance(token, {
        employee_id: selectedCell.employee.id,
        attendance_date: selectedCell.date,
        punch_in_time: punchInTime.trim() || null,
        punch_out_time: punchOutTime.trim() || null,
        status: status,
        remarks: remarks.trim() || null,
        manual_override_reason: overrideReason.trim(),
      });
      toast.success("Attendance updated successfully.");
      setSelectedCell(null);
      loadGrid();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update attendance.");
    } finally {
      setUpdating(false);
    }
  };


  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        const u = JSON.parse(raw);
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
        setUserRole(roleStr);
        setIsAdminUser(isSessionAdmin(roleStr, u));
      }
    } catch {}
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!sessionReady || !token) return;
    if (isAdminUser) {
      return;
    }
    const resolve = async () => {
      try {
        const raw = localStorage.getItem("auth_user");
        if (raw) {
          const parsedUser = JSON.parse(raw);
          const resolved = await resolveEmployeeSession(token, parsedUser);
          if (resolved?.employeeCode) {
            setEmployeeCode(resolved.employeeCode);
          }
        }
      } catch {}
    };
    resolve();
  }, [sessionReady, isAdminUser, token]);

  const loadFiltersData = useCallback(async () => {
    if (!token || !isAdminUser) return;
    setLoadingMeta(true);
    try {
      const tenants = await getTenantsList(token, 1, 100);
      const list = Array.isArray(tenants.data) ? tenants.data : [];
      setCompanies(list);
    } catch {
      setCompanies([]);
    } finally {
      setLoadingMeta(false);
    }
  }, [token, isAdminUser]);

  useEffect(() => {
    loadFiltersData();
  }, [loadFiltersData]);

  useEffect(() => {
    if (!token || !companyId || !isAdminUser) {
      setBranches([]);
      setDepartments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [brRes, depRes] = await Promise.all([
          getBranches(token, { company_id: companyId, per_page: 100, page: 1 }),
          getDepartments(token, { company_id: companyId, per_page: 100, page: 1 }),
        ]);
        if (cancelled) return;
        setBranches(Array.isArray(brRes.data) ? brRes.data : []);
        const depData = depRes.data;
        if (Array.isArray(depData)) setDepartments(depData);
        else if (depData && typeof depData === "object" && "items" in depData && Array.isArray((depData as { items: Department[] }).items))
          setDepartments((depData as { items: Department[] }).items);
        else setDepartments([]);
      } catch {
        if (!cancelled) {
          setBranches([]);
          setDepartments([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, companyId, isAdminUser]);

  const loadGrid = useCallback(async () => {
    if (!token) {
      setError("Not signed in.");
      return;
    }
    setError("");
    setLoadingGrid(true);
    setGridRows([]);
    try {
      if (isAdminUser) {
        const list = await fetchAllEmployees(token, {
          company_id: companyId || undefined,
          branch_id: branchId || undefined,
          department_id: departmentId || undefined,
        });
        setEmployees(list);

        const from_date = `${ym}-01`;
        const to_date = `${ym}-${String(dim).padStart(2, "0")}`;

        const attRecords = await fetchAllAdminAttendance(token, {
          company_id: companyId || undefined,
          branch_id: branchId || undefined,
          department_id: departmentId || undefined,
          from_date,
          to_date,
        });

        // Group attendance records by employee_id
        const recordsByEmpId = new Map<number, AdminAttendanceRecord[]>();
        for (const r of attRecords) {
          const empId = r.employee_id;
          if (!recordsByEmpId.has(empId)) {
            recordsByEmpId.set(empId, []);
          }
          recordsByEmpId.get(empId)!.push(r);
        }

        const ordered: GridRow[] = list.map((emp) => {
          const empRecords = recordsByEmpId.get(emp.id) ?? [];
          const days: (Cell | null)[] = Array.from({ length: dim }, () => null);
          let totalHoursDecimal = 0;
          let totalBreakCount = 0;
          let totalBreakMinutes = 0;

          for (const r of empRecords) {
            const d = dayFromDateStr(recordDateFromRow(r), ym);
            if (d != null && d >= 1 && d <= dim) {
              const status = r.status ? String(r.status) : (r.punch_in_time ? "present" : "");
              days[d - 1] = {
                ...statusToCell(status),
                record: r,
              };
              const hours = hoursBetweenPunches(r.punch_in_time, r.punch_out_time);
              if (hours != null) {
                totalHoursDecimal += hours;
              }
              const breaks = Number(r.break_count ?? 0);
              const breakMins = Number(r.total_break_minutes ?? 0);
              if (Number.isFinite(breaks) && breaks > 0) totalBreakCount += breaks;
              if (Number.isFinite(breakMins) && breakMins > 0) totalBreakMinutes += breakMins;
            }
          }

          const totalWh = totalHoursDecimal > 0 ? formatDecimalHoursTotal(totalHoursDecimal) : "—";
          const filledDays = fillEmptyPastDays(days, emp.id, ym, dim);
          return {
            employee: emp,
            days: filledDays,
            totalWh,
            totalBreakCount,
            totalBreakMinutes,
          } as GridRow;
        });

        setGridRows(ordered);
      } else {
        // Employee flow: use normalized monthly summary (all status types from API)
        if (!employeeCode) {
          setEmployees([]);
          setGridRows([]);
          return;
        }

        const rawUser = localStorage.getItem("auth_user");
        const parsedUser = rawUser ? JSON.parse(rawUser) : null;
        const resolved =
          parsedUser && token ? await resolveEmployeeSession(token, parsedUser) : null;

        const { records: summaryRecords, summary } = await getEmployeeMonthlySummary(
          token,
          employeeCode,
          ym,
        );

        const emp: EmployeeRecord = {
          id: resolved?.employeeId ?? Number(parsedUser?.employee_id) ?? 0,
          employee_code: employeeCode,
          full_name: parsedUser?.name,
          name: parsedUser?.name,
          email: parsedUser?.email,
        };

        setEmployees([emp]);

        const days: (Cell | null)[] = Array.from({ length: dim }, () => null);
        let totalHoursDecimal = 0;
        let totalBreakCount = 0;
        let totalBreakMinutes = 0;

        for (const r of summaryRecords) {
          if (r.is_future) continue;
          const d = dayFromDateStr(r.date, ym);
          if (d != null && d >= 1 && d <= dim) {
            const status = r.status ? String(r.status) : r.punch_in ? "present" : "";
            days[d - 1] = {
              ...statusToCell(status),
              record: summaryDayToAdminRecord(r, emp.id),
            };
            const hours =
              parseWorkingHoursToDecimal(r.working_hours) ??
              hoursBetweenPunches(r.punch_in, r.punch_out);
            if (hours != null) totalHoursDecimal += hours;
            const breaks = Number(r.break_count ?? 0);
            const breakMins = Number(r.total_break_minutes ?? 0);
            if (Number.isFinite(breaks) && breaks > 0) totalBreakCount += breaks;
            if (Number.isFinite(breakMins) && breakMins > 0) totalBreakMinutes += breakMins;
          }
        }

        const summaryHours = parseWorkingHoursToDecimal(summary.total_working_hours);
        const totalWh =
          summaryHours != null && summaryHours > 0
            ? formatDecimalHoursTotal(summaryHours)
            : totalHoursDecimal > 0
              ? formatDecimalHoursTotal(totalHoursDecimal)
              : "—";

        const summaryBreaks = Number(summary.total_break_count ?? 0);
        if (Number.isFinite(summaryBreaks) && summaryBreaks > 0) {
          totalBreakCount = summaryBreaks;
        }
        const summaryBreakMins = Number(summary.total_break_minutes ?? 0);
        if (Number.isFinite(summaryBreakMins) && summaryBreakMins > 0) {
          totalBreakMinutes = summaryBreakMins;
        }

        setGridRows([
          {
            employee: emp,
            days,
            totalWh,
            totalBreakCount,
            totalBreakMinutes,
          } as GridRow,
        ]);
      }
    } catch (e: unknown) {
      const msg = typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : "Failed to load attendance.";
      setError(msg);
    } finally {
      setLoadingGrid(false);
    }
  }, [token, isAdminUser, employeeCode, companyId, branchId, departmentId, ym, dim]);

  const handleBulkEditSuccess = useCallback(() => {
    setSelectedEmployeeIds([]);
    setBulkEditOpen(false);
    setBulkEditDay(undefined);
    void loadGrid();
  }, [loadGrid]);

  const handleMonthlyEditSuccess = useCallback(() => {
    setMonthlyEditEmployee(null);
    void loadGrid();
  }, [loadGrid]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const onExport = () => {
    if (gridRows.length === 0) {
      toast.message("Nothing to export yet.");
      return;
    }
    const header = ["Employee Name", "Employee Code", ...dayNumbers.map(String), "Working hours (total)", "Break Count"];
    const lines = [header.join(",")];
    for (const row of gridRows) {
      const name = `"${empDisplayName(row.employee).replace(/"/g, '""')}"`;
      const code = row.employee.employee_code ?? "";
      const cells = row.days.map((c) => (c ? c.letter : ""));
      lines.push([
        name,
        `"${code}"`,
        ...cells,
        `"${row.totalWh}"`,
        formatBreakCountSummary(row.totalBreakCount, row.totalBreakMinutes),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-attendance-${ym}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded.");
  };

  return (
    <section className="w-full space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Monthly Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Review and manage full-month attendance grid for all employees. Data is loaded from the monthly summary API per employee.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          className="shrink-0 gap-2"
          disabled={loadingGrid}
          onClick={() => loadGrid()}
        >
          {loadingGrid ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarRange className="h-4 w-4 text-primary" />
          Month &amp; filters
        </h2>
        <div className={`grid gap-4 ${isAdminUser ? "sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1"}`}>
          <label className="space-y-1.5 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Month &amp; Year</span>
            <input
              type="month"
              value={`${year}-${String(month).padStart(2, "0")}`}
              max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const [y, m] = val.split("-");
                  setYear(parseInt(y));
                  setMonth(parseInt(m));
                }
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm font-medium outline-none ring-0 transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          {isAdminUser && (
            <>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</span>
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    setBranchId("");
                    setDepartmentId("");
                  }}
                  disabled={loadingMeta}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                >
                  <option value="">All companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Branch</span>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={!companyId}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                >
                  <option value="">All branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Department</span>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={!companyId}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Actions</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onExport}>
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
              {isAdminUser ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                  disabled={bulkEditDisabled}
                  title="Update attendance for selected employees on one day"
                  onClick={() => openBulkEdit()}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {bulkButtonLabel}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => toast.message("Payroll handoff is not wired yet.")}
              >
                <Wallet className="h-3.5 w-3.5" />
                Payroll
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs">
            <p className="font-semibold text-foreground mb-2">Legend</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">P</span>
                Present
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">A</span>
                Absent
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">L</span>
                Leave
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-[10px] font-bold text-white">H</span>
                Holiday
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-slate-900">W</span>
                Weekly off
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">HD</span>
                Half day
              </span>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}

      <div className="relative rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loadingGrid ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-[1px]">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading attendance for {employees.length || "…"} employees</p>
          </div>
        ) : null}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {isAdminUser ? (
                  <th className="min-w-[108px] border-r border-border px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Actions
                  </th>
                ) : null}
                <th className="sticky left-0 z-20 min-w-[200px] border-r border-border bg-muted/50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {isAdminUser ? (
                      <Checkbox
                        checked={allEmployeesSelected ? true : someEmployeesSelected ? "indeterminate" : false}
                        onCheckedChange={(checked) => toggleSelectAllEmployees(checked === true)}
                        aria-label="Select all employees"
                      />
                    ) : null}
                    <span>
                      {isAdminUser ? `Employee (${gridRows.length})` : "Employee name"}
                    </span>
                  </div>
                </th>
                <th className="sticky left-[200px] z-20 min-w-[100px] border-r border-border bg-muted/50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Code
                </th>
                {dayNumbers.map((d) => (
                  <th
                    key={d}
                    className="min-w-[40px] border-r border-border px-1 py-3 text-center text-xs font-semibold text-muted-foreground"
                  >
                    {d}
                  </th>
                ))}
                <th className="min-w-[110px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Working hrs
                </th>
                <th className="min-w-[100px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Break Count
                </th>
              </tr>
              {isAdminUser ? (
                <tr className="border-b border-border bg-[#F0F7FF] dark:bg-muted/40">
                  <th className="border-r border-border bg-[#F0F7FF] dark:bg-muted/40 px-2 py-2" />
                  <th className="sticky left-0 z-20 border-r border-border bg-[#F0F7FF] dark:bg-muted/40 px-3 py-2 text-left">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                      disabled={bulkEditDisabled}
                      title="Update attendance for selected employees on one day"
                      onClick={() => openBulkEdit()}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      <span className="max-w-[140px] truncate text-xs">{bulkButtonLabel}</span>
                    </Button>
                  </th>
                  <th className="sticky left-[200px] z-20 border-r border-border bg-[#F0F7FF] dark:bg-muted/40 px-3 py-2" />
                  {dayNumbers.map((d) => {
                    const editable = isDayEditable(year, month, d);
                    return (
                      <th
                        key={`bulk-${d}`}
                        className="group border-r border-border px-0.5 py-2 text-center align-middle"
                      >
                        {editable ? (
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-primary/10 hover:text-primary group-hover:opacity-100 focus:opacity-100"
                            title={`Bulk edit attendance for ${dateFromParts(year, month, d)}`}
                            onClick={() => openBulkEdit(d)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground/30 opacity-0 group-hover:opacity-100"
                            title="Future dates cannot be edited"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </th>
                    );
                  })}
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2" />
                </tr>
              ) : null}
            </thead>
            <tbody className="divide-y divide-border">
              {gridRows.length === 0 && !loadingGrid ? (
                <tr>
                  <td colSpan={dim + (isAdminUser ? 5 : 4)} className="px-4 py-16 text-center text-muted-foreground">
                    No employees match the filters, or the directory is empty.
                  </td>
                </tr>
              ) : (
                gridRows.map((row) => (
                  <tr key={row.employee.id} className="hover:bg-muted/20">
                    {isAdminUser ? (
                      <td className="border-r border-border px-2 py-2 text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 border-primary/40 px-2 text-xs text-primary hover:bg-primary/5"
                          disabled={monthEditDisabled}
                          title={
                            monthEditDisabled
                              ? "Future months cannot be edited"
                              : "Edit attendance for this employee for the whole month"
                          }
                          onClick={() => setMonthlyEditEmployee(row.employee)}
                        >
                          <CalendarRange className="h-3.5 w-3.5" />
                          Edit Month
                        </Button>
                      </td>
                    ) : null}
                    <td className="sticky left-0 z-10 border-r border-border bg-card px-3 py-2 font-medium text-foreground">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {isAdminUser ? (
                          <Checkbox
                            checked={selectedEmployeeIds.includes(row.employee.id)}
                            onCheckedChange={() => toggleEmployeeSelection(row.employee.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${empDisplayName(row.employee)}`}
                          />
                        ) : null}
                        <EmployeeListAvatar
                          employee={row.employee}
                          className="h-8 w-8 shrink-0"
                          textClassName="text-[10px] font-semibold"
                        />
                        <span className="min-w-0 truncate">{empDisplayName(row.employee)}</span>
                      </div>
                      {row.loadError ? (
                        <span className="mt-1 block text-[10px] font-normal text-destructive" title={row.loadError}>
                          ({row.loadError})
                        </span>
                      ) : null}
                    </td>
                    <td className="sticky left-[200px] z-10 border-r border-border bg-card px-3 py-2 text-muted-foreground tabular-nums">
                      {row.employee.employee_code ?? "—"}
                    </td>
                    {row.days.map((cell, idx) => {
                      const hasRecord = !!cell?.record;
                      return (
                        <td
                          key={idx}
                          className={`border-r border-border px-0.5 py-1.5 text-center align-middle transition-colors ${
                            hasRecord && isAdminUser ? "cursor-pointer hover:bg-muted/40" : ""
                          }`}
                          onClick={() => {
                            if (hasRecord && isAdminUser) {
                              setSelectedCell({
                                employee: row.employee,
                                date: `${ym}-${String(idx + 1).padStart(2, "0")}`,
                                record: cell.record!,
                              });
                            }
                          }}
                        >
                          {cell ? (
                            <span
                              className={`mx-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${cell.bg} ${cell.text}`}
                            >
                              {cell.letter}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">·</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center text-xs font-medium tabular-nums text-foreground">{row.totalWh}</td>
                    <td className="px-3 py-2 text-center text-xs font-medium tabular-nums text-foreground">
                      <BreakCountValue
                        breakCount={row.totalBreakCount}
                        totalBreakMinutes={row.totalBreakMinutes}
                        className="items-center"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Calendar card list */}
        {isAdminUser ? (
          <div className="border-b border-border bg-[#F0F7FF] dark:bg-muted/40 px-4 py-3 lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
              disabled={bulkEditDisabled}
              title="Update attendance for selected employees on one day"
              onClick={() => openBulkEdit()}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {bulkButtonLabel}
            </Button>
          </div>
        ) : null}
        <div className="block lg:hidden divide-y divide-border">
          {gridRows.length === 0 && !loadingGrid ? (
            <div className="px-4 py-16 text-center text-muted-foreground text-sm">
              No employees match the filters, or the directory is empty.
            </div>
          ) : (
            gridRows.map((row) => {
              const presentCount = row.days.filter((d) => d?.letter === "P").length;
              const absentCount = row.days.filter((d) => d?.letter === "A").length;
              const leaveCount = row.days.filter((d) => d?.letter === "L").length;
              const holidayCount = row.days.filter((d) => d?.letter === "H").length;
              const weeklyOffCount = row.days.filter((d) => d?.letter === "W").length;
              const halfDayCount = row.days.filter((d) => d?.letter === "HD").length;

              return (
                <div key={row.employee.id} className="p-4 space-y-4 bg-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <EmployeeListAvatar
                        employee={row.employee}
                        className="h-10 w-10 shrink-0"
                        textClassName="text-xs font-semibold"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {empDisplayName(row.employee)}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Code: {row.employee.employee_code ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-2">
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Working Hrs</p>
                        <p className="text-sm font-semibold text-foreground">{row.totalWh}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Break Count</p>
                        <div className="text-sm font-semibold text-foreground">
                          <BreakCountValue
                            breakCount={row.totalBreakCount}
                            totalBreakMinutes={row.totalBreakMinutes}
                            inline
                          />
                        </div>
                      </div>
                      {isAdminUser ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 border-primary/40 px-2 text-xs text-primary hover:bg-primary/5"
                          disabled={monthEditDisabled}
                          title={
                            monthEditDisabled
                              ? "Future months cannot be edited"
                              : "Edit attendance for this employee for the whole month"
                          }
                          onClick={() => setMonthlyEditEmployee(row.employee)}
                        >
                          <CalendarRange className="h-3.5 w-3.5" />
                          Edit Month
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* Stats Summary row */}
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                    <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md">P: {presentCount}</span>
                    <span className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-md">A: {absentCount}</span>
                    <span className="bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-md">L: {leaveCount}</span>
                    <span className="bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-md">HD: {halfDayCount}</span>
                    <span className="bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">H: {holidayCount}</span>
                    <span className="bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md">W: {weeklyOffCount}</span>
                  </div>

                  {/* Calendar Widget */}
                  <div className="border-t border-border/40 pt-3">
                    <div className="max-w-[280px] mx-auto">
                      {/* Calendar header */}
                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground mb-1.5">
                        <div>Su</div>
                        <div>Mo</div>
                        <div>Tu</div>
                        <div>We</div>
                        <div>Th</div>
                        <div>Fr</div>
                        <div>Sa</div>
                      </div>
                      
                      {/* Calendar days */}
                      <div className="grid grid-cols-7 gap-1.5 justify-items-center">
                        {/* Empty padding cells for start day */}
                        {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
                          <div key={`empty-${i}`} className="w-8 h-8" />
                        ))}
                        
                        {/* Actual days */}
                        {dayNumbers.map((d) => {
                          const cell = row.days[d - 1];
                          const hasRecord = !!cell?.record;
                          return (
                            <div key={d} className="relative">
                              {cell ? (
                                <button
                                  type="button"
                                  disabled={!isAdminUser || !cell.record}
                                  onClick={() => {
                                    if (isAdminUser && cell.record) {
                                      setSelectedCell({
                                        employee: row.employee,
                                        date: `${ym}-${String(d).padStart(2, "0")}`,
                                        record: cell.record!,
                                      });
                                    }
                                  }}
                                  className={cn(
                                    "w-8 h-8 rounded-full flex flex-col items-center justify-center text-[9px] font-bold transition-all relative border border-transparent shadow-xs cursor-default",
                                    cell.bg,
                                    cell.text,
                                    isAdminUser && cell.record && "hover:scale-105 active:scale-95 cursor-pointer hover:border-primary/30"
                                  )}
                                >
                                  <span className="leading-tight mt-0.5">{d}</span>
                                  <span className="text-[7px] font-extrabold opacity-95 leading-none mb-0.5">{cell.letter}</span>
                                </button>
                              ) : (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] text-muted-foreground/40 bg-muted/10">
                                  {d}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {gridRows.length} employee{gridRows.length === 1 ? "" : "s"} for{" "}
        <strong className="text-foreground">
          {MONTH_LABELS[month - 1]} {year}
        </strong>
        . Working hours total is from each employee&apos;s monthly summary.
      </p>
      {/* Manual Update Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <EmployeeListAvatar
                employee={selectedCell.employee}
                className="h-12 w-12 shrink-0 ring-2 ring-primary/15"
                textClassName="text-sm font-semibold"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-foreground">Manual Attendance Update</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Updating attendance for <strong className="text-foreground">{empDisplayName(selectedCell.employee)}</strong> ({selectedCell.employee.employee_code || "—"}) on <strong className="text-foreground">{selectedCell.date}</strong>.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveUpdate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                    <option value="holiday">Holiday</option>
                    <option value="weekly_off">Weekly Off</option>
                    <option value="half_day">Half Day</option>
                  </select>
                </label>

                <label className="space-y-1.5 flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remarks</span>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Work from home"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                <div className="sm:col-span-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Punches</span>
                    {loadingShiftTimes ? (
                      <span className="text-xs text-muted-foreground">Loading shift times…</span>
                    ) : shiftDayTimes ? (
                      <button
                        type="button"
                        onClick={() => applyShiftPunchTimes(shiftDayTimes, selectedCell.date)}
                        className="text-xs text-primary hover:underline cursor-pointer text-right"
                      >
                        Set to shift time ({shiftDayTimes.label})
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Shift times unavailable</span>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Punch In Time</span>
                      <input
                        type="time"
                        value={punchInTimeOnly}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPunchInTimeOnly(v);
                          setPunchInTime(v ? `${selectedCell.date}T${v}:00+05:30` : "");
                        }}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {punchInTime && (
                        <span className="text-[10px] text-muted-foreground font-mono truncate">{punchInTime}</span>
                      )}
                    </label>

                    <label className="space-y-1.5 flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Punch Out Time</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPunchOutTimeOnly("");
                            setPunchOutTime("");
                          }}
                          className="text-[10px] text-destructive hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                      <input
                        type="time"
                        value={punchOutTimeOnly}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPunchOutTimeOnly(v);
                          setPunchOutTime(v ? `${selectedCell.date}T${v}:00+05:30` : "");
                        }}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {punchOutTime && (
                        <span className="text-[10px] text-muted-foreground font-mono truncate">{punchOutTime}</span>
                      )}
                    </label>
                  </div>
                </div>

                <label className="sm:col-span-2 space-y-1.5 flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Manual Override Reason <span className="text-destructive">*</span>
                  </span>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Please specify why this manual change is required."
                    rows={2}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    required
                  />
                </label>
              </div>

              {selectedCell.record.id === 0 && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300">
                  <strong className="font-semibold block mb-0.5">Note:</strong>
                  This is a mock &quot;Absent&quot; record because no database record exists for this day. Manual updates can only be saved to existing database records. Saving will attempt to update, but may fail if the database requires a pre-existing record.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedCell(null)}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updating || !overrideReason.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/95"
                >
                  {updating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {token && isAdminUser ? (
        <BulkAttendanceEditModal
          open={bulkEditOpen}
          onClose={() => {
            setBulkEditOpen(false);
            setBulkEditDay(undefined);
          }}
          onSuccess={handleBulkEditSuccess}
          onRefresh={() => void loadGrid()}
          token={token}
          year={year}
          month={month}
          initialDay={bulkEditDay}
          selectedEmployeeIds={selectedEmployeeIds}
          totalFilteredEmployees={gridRows.length}
          companyId={companyId}
          branchId={branchId}
          departmentId={departmentId}
        />
      ) : null}

      {token && isAdminUser ? (
        <EmployeeMonthlyEditModal
          open={!!monthlyEditEmployee}
          onClose={() => setMonthlyEditEmployee(null)}
          onSuccess={handleMonthlyEditSuccess}
          onRefresh={() => void loadGrid()}
          token={token}
          year={year}
          month={month}
          employee={monthlyEditEmployee}
        />
      ) : null}
    </section>
  );
}
