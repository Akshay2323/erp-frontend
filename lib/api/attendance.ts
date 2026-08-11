import { API_BASE_URL } from "@/lib/config";

export type PunchInPayload = {
  latitude: number;
  longitude: number;
  remarks?: string;
  image?: Blob | File;
};

export type AttendanceEnvelope<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
};

export type AttendanceApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new SyntaxError("Empty response from server");
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    // Backend once appended a second JSON error after a successful punch body
    // (afterResponse sync job). Prefer the first complete JSON object.
    const firstEnd = trimmed.indexOf("}{");
    if (firstEnd > 0) {
      try {
        return JSON.parse(trimmed.slice(0, firstEnd + 1)) as T;
      } catch {
        // fall through
      }
    }
    throw error;
  }
};

const isAttendanceApiError = (error: unknown): error is AttendanceApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as AttendanceApiError);

const extractAttendanceFieldErrors = (
  result: AttendanceEnvelope,
): Record<string, string[]> | undefined => {
  if (result.errors && Object.keys(result.errors).length > 0) {
    return result.errors;
  }

  const data = result.data;
  if (data && typeof data === "object" && "errors" in data) {
    const nested = (data as { errors?: Record<string, string[]> }).errors;
    if (nested && typeof nested === "object") return nested;
  }

  return undefined;
};

export async function punchIn(
  token: string,
  payload: PunchInPayload,
): Promise<AttendanceEnvelope> {
  try {
    const formData = new FormData();
    formData.append("latitude", payload.latitude.toString());
    formData.append("longitude", payload.longitude.toString());
    if (payload.remarks) formData.append("remarks", payload.remarks);
    if (payload.image) formData.append("image", payload.image);

    const response = await fetch(`${API_BASE_URL}v1/attendance/punch-in`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: formData,
    });

    const result = await parseResponse<AttendanceEnvelope>(response);
    if (!response.ok || (result.success !== undefined && !result.success)) {
      return fail(
        result.message || "Unable to punch in.",
        extractAttendanceFieldErrors(result),
      );
    }
    return result;
  } catch (error) {
    if (isAttendanceApiError(error)) return Promise.reject(error);
    return fail("Unable to punch in. Please check your network connection.");
  }
}

export async function punchOut(
  token: string,
  payload: PunchInPayload,
): Promise<AttendanceEnvelope> {
  try {
    const formData = new FormData();
    formData.append("latitude", payload.latitude.toString());
    formData.append("longitude", payload.longitude.toString());
    if (payload.remarks) formData.append("remarks", payload.remarks);
    if (payload.image) formData.append("image", payload.image);

    const response = await fetch(`${API_BASE_URL}v1/attendance/punch-out`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: formData,
    });

    const result = await parseResponse<AttendanceEnvelope>(response);
    if (!response.ok || (result.success !== undefined && !result.success)) {
      return fail(
        result.message || "Unable to punch out.",
        extractAttendanceFieldErrors(result),
      );
    }
    return result;
  } catch (error) {
    if (isAttendanceApiError(error)) return Promise.reject(error);
    return fail("Unable to punch out. Please check your network connection.");
  }
}

export async function getTodayStatus(token: string): Promise<AttendanceEnvelope<any>> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/attendance/my-today-status`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await parseResponse<AttendanceEnvelope<any>>(response);
    if (!response.ok || (result.success !== undefined && !result.success)) {
      return fail(result.message || "Unable to fetch today's status.", result.errors);
    }
    return result;
  } catch (error) {
    if (isAttendanceApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch today's status. Please check your network connection.");
  }
}

/** One row for the attendance table (UI shape). */
export type EmployeeMonthlySummaryDay = {
  date: string;
  day?: string;
  status?: string;
  punch_in?: string | null;
  punch_out?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  shift_code?: string | null;
  working_hours?: string | number | null;
  overtime_hours?: string | number | null;
  /** Shift-rule late evaluation: On Time | Late | Late with Penalty */
  late_status?: string | null;
  late_minutes?: number;
  /** True when the day is marked late per shift late_rules. */
  late_mark?: boolean;
  remarks?: string | null;
  is_future?: boolean;
};

/** Stats row under the summary cards. */
export type EmployeeMonthlySummaryStats = {
  total_present?: number;
  total_absent?: number;
  total_leave?: number;
  total_half_day?: number;
  total_holidays?: number;
  total_week_off?: number;
  total_working_days?: number;
  /** Total hours for the month (number = decimal hours, or API string like "40h"). */
  total_working_hours?: string | number;
  total_overtime_hours?: string | number;
  total_late_count?: number;
  total_late_minutes?: number;
  [key: string]: unknown;
};

export type EmployeeMonthlySummaryEmployee = {
  id?: number;
  employee_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  branch?: string | null;
  company?: string | null;
};

export type EmployeeMonthlySummaryShift = {
  id?: number;
  name?: string | null;
  shift_code?: string | null;
  attendance_mode?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  shift_timing?: string | null;
};

export type EmployeeMonthlySummaryResult = {
  records: EmployeeMonthlySummaryDay[];
  summary: EmployeeMonthlySummaryStats;
  employee: EmployeeMonthlySummaryEmployee | null;
  shift: EmployeeMonthlySummaryShift | null;
};

/** Parse a single row's working_hours into decimal hours (null if unknown). */
export function parseWorkingHoursToDecimal(
  value: string | number | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const s = String(value).trim().replace(/,/g, "");
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
  }
  const hm = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hm) {
    const h = parseInt(hm[1], 10);
    const m = parseInt(hm[2], 10);
    const sec = hm[3] ? parseInt(hm[3], 10) : 0;
    return h + m / 60 + sec / 3600;
  }
  let total = 0;
  let matched = false;
  const hPart = s.match(/(\d+(?:\.\d+)?)\s*(?:hr|hrs|h)\b/i);
  const mPart = s.match(/(\d+)\s*(?:min|mins|m)\b/i);
  if (hPart) {
    total += parseFloat(hPart[1]);
    matched = true;
  }
  if (mPart) {
    total += parseInt(mPart[1], 10) / 60;
    matched = true;
  }
  if (matched) return total;
  const digits = s.replace(/[^\d.-]/g, "");
  if (!digits) return null;
  const n2 = parseFloat(digits);
  return Number.isNaN(n2) ? null : n2;
}

function sumWorkingHoursFromRecords(records: EmployeeMonthlySummaryDay[]): number {
  let sum = 0;
  for (const r of records) {
    const v = parseWorkingHoursToDecimal(r.working_hours);
    if (v != null) sum += v;
  }
  return Math.round(sum * 1000) / 1000;
}

/** Human-readable total (e.g. `8h 30m`) from decimal hours. */
export function formatDecimalHoursTotal(decimal: number): string {
  if (!Number.isFinite(decimal) || decimal <= 0) return "0h";
  const sign = decimal < 0 ? "-" : "";
  const abs = Math.abs(decimal);
  const totalMinutes = Math.round(abs * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

/** Clock-style duration `HH:MM` (e.g. `01:30`) from total minutes. */
export function formatMinutesAsClock(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes)) return "00:00";
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Clock-style duration `HH:MM` from decimal hours, `H:MM` / `HH:MM`, or
 * human strings like `1h 30m`. Empty / invalid → `00:00`.
 */
export function formatHoursAsClock(value: string | number | null | undefined): string {
  if (value == null || value === "") return "00:00";
  const s = String(value).trim();
  const hm = s.match(/^(-?)(\d+):(\d{2})(?::\d{2})?$/);
  if (hm) {
    return `${hm[1]}${hm[2].padStart(2, "0")}:${hm[3]}`;
  }
  const parsed = parseWorkingHoursToDecimal(value);
  if (parsed == null) return "00:00";
  return formatMinutesAsClock(Math.round(parsed * 60));
}

export function formatWorkingHoursSummaryValue(value: string | number | undefined | null): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") return formatDecimalHoursTotal(value);
  const parsed = parseWorkingHoursToDecimal(value);
  if (parsed != null) return formatDecimalHoursTotal(parsed);
  return String(value);
}

function statusCountsToSummary(
  statusCounts: Record<string, unknown> | null | undefined,
): EmployeeMonthlySummaryStats {
  const summary: EmployeeMonthlySummaryStats = {};
  if (!statusCounts || typeof statusCounts !== "object") return summary;
  for (const [k, v] of Object.entries(statusCounts)) {
    if (!k.trim()) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isNaN(n)) continue;
    const key = k.toLowerCase();
    if (key.includes("present")) summary.total_present = (summary.total_present ?? 0) + n;
    else if (key.includes("absent")) summary.total_absent = (summary.total_absent ?? 0) + n;
    else if (key.includes("leave")) summary.total_leave = (summary.total_leave ?? 0) + n;
    else if (key.includes("half")) summary.total_half_day = (summary.total_half_day ?? 0) + n;
    else if (key.includes("holiday")) summary.total_holidays = (summary.total_holidays ?? 0) + n;
    else if (key.includes("week")) summary.total_week_off = (summary.total_week_off ?? 0) + n;
  }
  return summary;
}

function monthSummaryToStats(
  monthSummary: Record<string, unknown> | null | undefined,
): EmployeeMonthlySummaryStats {
  if (!monthSummary || typeof monthSummary !== "object") return {};
  const summary: EmployeeMonthlySummaryStats = {};
  if (typeof monthSummary.total_present_days === "number")
    summary.total_present = monthSummary.total_present_days;
  if (typeof monthSummary.total_absent_days === "number")
    summary.total_absent = monthSummary.total_absent_days;
  if (typeof monthSummary.total_leave_days === "number")
    summary.total_leave = monthSummary.total_leave_days;
  if (typeof monthSummary.total_half_days === "number")
    summary.total_half_day = monthSummary.total_half_days;
  if (typeof monthSummary.total_holidays === "number")
    summary.total_holidays = monthSummary.total_holidays;
  if (typeof monthSummary.total_week_off_days === "number")
    summary.total_week_off = monthSummary.total_week_off_days;
  if (monthSummary.total_working_hours != null && monthSummary.total_working_hours !== "")
    summary.total_working_hours = monthSummary.total_working_hours as string | number;
  // Prefer minutes when present so clock display stays exact (avoids float rounding).
  if (monthSummary.total_ot_minutes != null && monthSummary.total_ot_minutes !== "") {
    const mins = Number(monthSummary.total_ot_minutes);
    if (Number.isFinite(mins)) summary.total_overtime_hours = mins / 60;
  } else if (monthSummary.total_ot_hours != null && monthSummary.total_ot_hours !== "") {
    summary.total_overtime_hours = monthSummary.total_ot_hours as string | number;
  }
  if (typeof monthSummary.total_late_count === "number")
    summary.total_late_count = monthSummary.total_late_count;
  if (typeof monthSummary.total_late_minutes === "number")
    summary.total_late_minutes = monthSummary.total_late_minutes;
  return summary;
}

function deriveSummaryFromRecords(records: EmployeeMonthlySummaryDay[]): EmployeeMonthlySummaryStats {
  const summary: EmployeeMonthlySummaryStats = {};
  for (const r of records) {
    const s = (r.status ?? "").toLowerCase();
    if (s.includes("present") || s === "p") summary.total_present = (summary.total_present ?? 0) + 1;
    else if (s.includes("absent") || s === "a") summary.total_absent = (summary.total_absent ?? 0) + 1;
    else if (s.includes("leave") || s === "l") summary.total_leave = (summary.total_leave ?? 0) + 1;
    else if (s.includes("half") || s === "hd") summary.total_half_day = (summary.total_half_day ?? 0) + 1;
    else if (s.includes("holiday") || s === "h") summary.total_holidays = (summary.total_holidays ?? 0) + 1;
    else if (
      s.includes("week off") ||
      s.includes("weekoff") ||
      s.includes("weekly off") ||
      s === "wo" ||
      s === "w"
    )
      summary.total_week_off = (summary.total_week_off ?? 0) + 1;
  }
  return summary;
}

export function hoursBetweenPunches(
  punchIn: string | null | undefined,
  punchOut: string | null | undefined,
): number | null {
  if (!punchIn || !punchOut) return null;
  const t0 = new Date(punchIn).getTime();
  const t1 = new Date(punchOut).getTime();
  if (Number.isNaN(t0) || Number.isNaN(t1) || t1 <= t0) return null;
  return Math.round(((t1 - t0) / (1000 * 60 * 60)) * 1000) / 1000;
}

function workingHoursForRow(row: Record<string, unknown>): string | number | null {
  const wh = row.working_hours as string | number | null | undefined;
  if (wh != null && String(wh).trim() !== "") {
    const n = typeof wh === "number" ? wh : parseFloat(String(wh));
    if (!Number.isNaN(n) && n > 0) return wh;
  }
  const totalHours = row.total_hours as number | null | undefined;
  if (typeof totalHours === "number" && totalHours > 0) return totalHours;
  const formatted = (row.total_hours_formatted ?? row.working_hours_formatted) as
    | string
    | null
    | undefined;
  if (formatted != null && String(formatted).trim() !== "" && formatted !== "0:00") return formatted;
  const direct = (row.total_working_hours ?? null) as string | number | null;
  if (direct != null && String(direct).trim() !== "") return direct;
  const pi = (row.punch_in_time ?? row.punch_in ?? null) as string | null;
  const po = (row.punch_out_time ?? row.punch_out ?? null) as string | null;
  return hoursBetweenPunches(pi ?? undefined, po ?? undefined);
}

function mapDailyBreakdownRow(row: Record<string, unknown>): EmployeeMonthlySummaryDay {
  const punchIn = (row.punch_in_time ?? row.punch_in ?? null) as string | null;
  const punchOut = (row.punch_out_time ?? row.punch_out ?? null) as string | null;
  const statusRaw = row.status;
  const status =
    statusRaw != null && String(statusRaw).trim() !== "" ? String(statusRaw) : undefined;
  return {
    date: row.date != null ? String(row.date) : String(row.attendance_date ?? ""),
    day:
      row.day_name != null
        ? String(row.day_name)
        : row.day != null
          ? String(row.day)
          : undefined,
    status,
    punch_in: punchIn,
    punch_out: punchOut,
    shift_start: (row.shift_start ?? null) as string | null,
    shift_end: (row.shift_end ?? null) as string | null,
    shift_code: (row.shift_code ?? null) as string | null,
    working_hours: workingHoursForRow(row),
    overtime_hours: (() => {
      const direct = row.overtime_hours ?? row.overtime;
      if (direct != null && String(direct).trim() !== "") {
        return direct as string | number;
      }
      // API day rows expose OT as minutes (`ot_minutes`), not decimal hours.
      if (row.ot_minutes != null && row.ot_minutes !== "") {
        const mins = Number(row.ot_minutes);
        return Number.isFinite(mins) ? mins / 60 : null;
      }
      return null;
    })(),
    late_status: (row.late_status != null && String(row.late_status).trim() !== ""
      ? String(row.late_status)
      : null) as string | null,
    late_minutes: (() => {
      const mins = Number(row.late_minutes ?? 0);
      return Number.isFinite(mins) ? mins : 0;
    })(),
    late_mark: (() => {
      if (row.late_mark === true) return true;
      if (row.late_mark === false) return false;
      const status = String(row.late_status ?? "").toLowerCase();
      return status === "late" || status.includes("penalty");
    })(),
    remarks: (row.remarks ?? row.holiday_name ?? row.leave_type ?? null) as string | null,
    is_future: row.is_future === true,
  };
}

/** Map `GET v1/employee-monthly-summary` payload to table + summary cards. */
export function normalizeEmployeeMonthlySummary(
  payload: unknown,
): EmployeeMonthlySummaryResult {
  if (!payload || typeof payload !== "object") {
    return { records: [], summary: {}, employee: null, shift: null };
  }
  const d = payload as Record<string, unknown>;

  const rawList =
    (Array.isArray(d.daily_breakdown) && d.daily_breakdown) ||
    (Array.isArray(d.attendances) && d.attendances) ||
    (Array.isArray(d.records) && d.records) ||
    (Array.isArray(d.attendance) && d.attendance) ||
    (Array.isArray(d.data) && d.data) ||
    [];

  const records: EmployeeMonthlySummaryDay[] = (rawList as Record<string, unknown>[]).map((row) =>
    mapDailyBreakdownRow(row),
  );

  const sorted = [...records].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const attendanceSummary = d.attendance_summary as Record<string, unknown> | undefined;
  const fromCounts = statusCountsToSummary(
    attendanceSummary?.status_counts as Record<string, unknown> | undefined,
  );
  const fromMonthSummary = monthSummaryToStats(
    d.month_summary as Record<string, unknown> | undefined,
  );

  let summary: EmployeeMonthlySummaryStats = {
    ...fromCounts,
    ...fromMonthSummary,
    ...(typeof attendanceSummary?.total_working_days === "number"
      ? { total_working_days: attendanceSummary.total_working_days as number }
      : {}),
    ...(attendanceSummary?.total_working_hours != null
      ? { total_working_hours: attendanceSummary.total_working_hours as string | number }
      : {}),
    ...(attendanceSummary?.total_overtime_hours != null
      ? { total_overtime_hours: attendanceSummary.total_overtime_hours as string | number }
      : {}),
  };

  const legacy = d.summary as EmployeeMonthlySummaryStats | undefined;
  if (legacy && typeof legacy === "object") {
    summary = { ...summary, ...legacy };
  }

  const hasNumericStats =
    (summary.total_present ?? 0) > 0 ||
    (summary.total_absent ?? 0) > 0 ||
    (summary.total_leave ?? 0) > 0 ||
    (summary.total_half_day ?? 0) > 0 ||
    (summary.total_holidays ?? 0) > 0 ||
    (summary.total_week_off ?? 0) > 0;

  if (sorted.length > 0 && !hasNumericStats) {
    summary = { ...summary, ...deriveSummaryFromRecords(sorted) };
  }

  const leaves = d.leaves_summary as { total_approved_leave_days?: number } | undefined;
  if (
    leaves &&
    typeof leaves.total_approved_leave_days === "number" &&
    leaves.total_approved_leave_days > 0 &&
    summary.total_leave == null
  ) {
    summary.total_leave = leaves.total_approved_leave_days;
  }

  if (summary.total_working_hours == null || summary.total_working_hours === "") {
    const summed = sumWorkingHoursFromRecords(sorted);
    if (summed > 0) summary.total_working_hours = summed;
  }

  const employee = parseMonthlySummaryEmployee(d.employee);
  const shift = parseMonthlySummaryShift(d.shift);

  return { records: sorted, summary, employee, shift };
}

function parseMonthlySummaryEmployee(raw: unknown): EmployeeMonthlySummaryEmployee | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  return {
    id: typeof e.id === "number" ? e.id : undefined,
    employee_code: e.employee_code != null ? String(e.employee_code) : null,
    first_name: e.first_name != null ? String(e.first_name) : null,
    last_name: e.last_name != null ? String(e.last_name) : null,
    full_name: e.full_name != null ? String(e.full_name) : null,
    email: e.email != null ? String(e.email) : null,
    department: e.department != null && String(e.department).trim() !== "" ? String(e.department) : null,
    designation:
      e.designation != null && String(e.designation).trim() !== "" ? String(e.designation) : null,
    branch: e.branch != null && String(e.branch).trim() !== "" ? String(e.branch) : null,
    company: e.company != null && String(e.company).trim() !== "" ? String(e.company) : null,
  };
}

function parseMonthlySummaryShift(raw: unknown): EmployeeMonthlySummaryShift | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const start =
    s.start_time != null && String(s.start_time).trim() !== "" ? String(s.start_time) : null;
  const end = s.end_time != null && String(s.end_time).trim() !== "" ? String(s.end_time) : null;
  const timing =
    s.shift_timing != null && String(s.shift_timing).trim() !== ""
      ? String(s.shift_timing)
      : start && end
        ? `${start} - ${end}`
        : null;
  return {
    id: typeof s.id === "number" ? s.id : undefined,
    name: s.name != null && String(s.name).trim() !== "" ? String(s.name) : null,
    shift_code: s.shift_code != null && String(s.shift_code).trim() !== "" ? String(s.shift_code) : null,
    attendance_mode:
      s.attendance_mode != null && String(s.attendance_mode).trim() !== ""
        ? String(s.attendance_mode)
        : null,
    start_time: start,
    end_time: end,
    shift_timing: timing,
  };
}

export async function getEmployeeMonthlySummary(
  token: string,
  empcode: string,
  month: string,
): Promise<EmployeeMonthlySummaryResult> {
  try {
    const params = new URLSearchParams({ empcode, month });
    const response = await fetch(`${API_BASE_URL}v1/employee-monthly-summary?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
    });

    const json = (await response.json()) as AttendanceEnvelope<unknown> & { data?: unknown };
    if (!response.ok || (json.success !== undefined && !json.success)) {
      return fail((json as { message?: string }).message || "Failed to fetch attendance data.");
    }
    const inner = json.data ?? json;
    return normalizeEmployeeMonthlySummary(inner);
  } catch (error) {
    if (isAttendanceApiError(error)) return Promise.reject(error);
    return fail("Failed to fetch attendance data. Please check your network connection.");
  }
}

export type AdminAttendanceRecord = {
  id: number;
  tenant_id: number;
  company_id: number;
  employee_id: number;
  branch_id: number;
  attendance_date: string;
  punch_in_time: string | null;
  punch_out_time: string | null;
  punch_in_latitude: number | null;
  punch_in_longitude: number | null;
  punch_in_distance: number | null;
  punch_out_latitude: number | null;
  punch_out_longitude: number | null;
  punch_out_distance: number | null;
  status: string | null;
  remarks: string | null;
  outside_location: boolean;
  needs_review: boolean;
  is_manually_modified: boolean;
  manual_modified_by: number | null;
  manual_modified_at: string | null;
  manual_override_reason: string | null;
  punch_in_image: string | null;
  punch_out_image: string | null;
  created_at: string;
  updated_at: string;
  manual_modifier: unknown;
};

export type AdminAttendanceResponse = {
  success: boolean;
  message: string;
  data: {
    records: AdminAttendanceRecord[];
  };
  meta: {
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  };
};

export async function getAdminAttendance(
  token: string,
  params: {
    page?: number;
    per_page?: number;
    employee_id?: string | number;
    company_id?: string;
    branch_id?: string;
    department_id?: string;
    from_date?: string;
    to_date?: string;
  },
): Promise<AdminAttendanceResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.per_page !== undefined) searchParams.set("per_page", String(params.per_page));
    if (params.employee_id !== undefined && String(params.employee_id).trim()) {
      searchParams.set("employee_id", String(params.employee_id).trim());
    }
    if (params.company_id?.trim()) searchParams.set("company_id", params.company_id.trim());
    if (params.branch_id?.trim()) searchParams.set("branch_id", params.branch_id.trim());
    if (params.department_id?.trim()) searchParams.set("department_id", params.department_id.trim());
    if (params.from_date?.trim()) searchParams.set("from_date", params.from_date.trim());
    if (params.to_date?.trim()) searchParams.set("to_date", params.to_date.trim());

    const response = await fetch(`${API_BASE_URL}v1/admin/attendance?${searchParams.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });

    const json = (await response.json()) as AdminAttendanceResponse;
    if (!response.ok || !json.success) {
      const msg = (json as any)?.message || "Failed to fetch admin attendance data.";
      return Promise.reject({ message: msg });
    }
    return json;
  } catch (error: any) {
    return Promise.reject({
      message: error?.message || "Failed to fetch admin attendance data. Please check your network connection.",
    });
  }
}

export async function updateAdminAttendance(
  token: string,
  id: number,
  payload: {
    punch_in_time?: string | null;
    punch_out_time?: string | null;
    status: string;
    remarks?: string | null;
    manual_override_reason: string;
  },
): Promise<{ success: boolean; message: string; data: { attendance: AdminAttendanceRecord } }> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/admin/attendance/${id}/manual-update`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      const msg = json?.message || "Failed to update attendance record.";
      return Promise.reject({ message: msg });
    }
    return json;
  } catch (error: any) {
    return Promise.reject({
      message: error?.message || "Failed to update attendance record. Please check your network connection.",
    });
  }
}

export async function upsertAdminAttendance(
  token: string,
  payload: {
    employee_id: number;
    attendance_date: string;
    punch_in_time?: string | null;
    punch_out_time?: string | null;
    status: string;
    remarks?: string | null;
    manual_override_reason: string;
  },
): Promise<{ success: boolean; message: string; data: { attendance: AdminAttendanceRecord } }> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/admin/attendance/manual-upsert`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      const msg = json?.message || "Failed to upsert attendance record.";
      return Promise.reject({ message: msg });
    }
    return json;
  } catch (error: any) {
    return Promise.reject({
      message: error?.message || "Failed to upsert attendance record. Please check your network connection.",
    });
  }
}


export type EmployeeMonthlySummaryResponse = {
  success: boolean;
  message: string;
  data: {
    employee: any;
    month: string;
    attendance_summary: any;
    attendances: AdminAttendanceRecord[];
  };
};

export async function getEmployeeMonthlySummaryRaw(
  token: string,
  empcode: string,
  month: string,
): Promise<EmployeeMonthlySummaryResponse> {
  try {
    const params = new URLSearchParams({ empcode, month });
    const response = await fetch(`${API_BASE_URL}v1/employee-monthly-summary?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      const msg = json?.message || "Failed to fetch employee attendance summary.";
      return Promise.reject({ message: msg });
    }
    return json;
  } catch (error: any) {
    return Promise.reject({
      message: error?.message || "Failed to fetch employee attendance summary. Please check your network connection.",
    });
  }
}

export type BulkAttendanceStatus =
  | "present"
  | "absent"
  | "half_day"
  | "late"
  | "week_off"
  | "on_leave"
  | "holiday";

export type BulkAttendanceEditPayload = {
  year: number;
  month: number;
  day: number;
  status: BulkAttendanceStatus;
  manual_override_reason: string;
  employee_ids?: number[];
  punch_in_time?: string;
  punch_out_time?: string;
  remarks?: string;
  company_id?: number;
  branch_id?: number;
  department_id?: number;
};

export type BulkAttendanceEditResultItem = {
  employee_id: number;
  employee_name?: string;
  attendance_date: string;
  action: string;
  old_status?: string | null;
  new_status: string;
  is_week_off?: boolean;
  punch_in_time?: string | null;
  punch_out_time?: string | null;
  attendance_id?: number;
};

export type BulkAttendanceEditErrorItem = {
  employee_id: number;
  employee_name?: string;
  message: string;
};

export type BulkAttendanceEditResponse = {
  success: boolean;
  message: string;
  data: {
    attendance_date: string;
    status: string;
    total_employees: number;
    created_count: number;
    updated_count: number;
    results: BulkAttendanceEditResultItem[];
    errors: BulkAttendanceEditErrorItem[];
  };
};

export async function bulkEditAdminAttendance(
  token: string,
  payload: BulkAttendanceEditPayload,
): Promise<BulkAttendanceEditResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/admin/attendance/bulk-edit`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json()) as BulkAttendanceEditResponse & AttendanceEnvelope;

    if (response.status === 403) {
      return fail("You don't have permission to edit attendance.");
    }

    if (!response.ok || !json.success) {
      const fieldErrors = extractAttendanceFieldErrors(json);
      return fail(json.message || "Bulk attendance edit failed.", fieldErrors);
    }

    return json;
  } catch (error) {
    if (isAttendanceApiError(error)) return Promise.reject(error);
    return fail("Bulk attendance edit failed. Please check your network connection.");
  }
}

export type EmployeeMonthlyEditApplyScope = "working_days" | "all_elapsed_days";

export type EmployeeMonthlyEditPayload = {
  employee_id: number;
  month: string;
  status: BulkAttendanceStatus;
  manual_override_reason: string;
  punch_in_time?: string;
  punch_out_time?: string;
  apply_scope?: EmployeeMonthlyEditApplyScope;
  year?: number;
  month_number?: number;
};

export type EmployeeMonthlyEditResultItem = {
  attendance_date: string;
  action: string;
  old_status?: string | null;
  new_status: string;
  is_week_off?: boolean;
  punch_in_time?: string | null;
  punch_out_time?: string | null;
  attendance_id?: number;
};

export type EmployeeMonthlyEditErrorItem = {
  attendance_date?: string;
  date?: string;
  message: string;
};

export type EmployeeMonthlyEditResponse = {
  success: boolean;
  message: string;
  data: {
    employee_id: number;
    employee_name?: string;
    month: string;
    status: string;
    apply_scope: string;
    total_days?: number;
    created_count?: number;
    updated_count?: number;
    skipped_count?: number;
    results?: EmployeeMonthlyEditResultItem[];
    errors: EmployeeMonthlyEditErrorItem[];
  };
};

export async function editEmployeeMonthlyAttendance(
  token: string,
  payload: EmployeeMonthlyEditPayload,
): Promise<EmployeeMonthlyEditResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/admin/attendance/employee-monthly-edit`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json()) as EmployeeMonthlyEditResponse & AttendanceEnvelope;

    if (response.status === 403) {
      return fail("You don't have permission to edit attendance.");
    }

    if (!response.ok || !json.success) {
      const fieldErrors = extractAttendanceFieldErrors(json);
      return fail(json.message || "Monthly attendance edit failed.", fieldErrors);
    }

    return json;
  } catch (error) {
    if (isAttendanceApiError(error)) return Promise.reject(error);
    return fail("Monthly attendance edit failed. Please check your network connection.");
  }
}

export type MonthlyAttendanceStatusOption =
  | "present"
  | "absent"
  | "half_day"
  | "late"
  | "week_off"
  | "on_leave"
  | "holiday";

export type EmployeeMonthlyAttendanceDay = {
  date: string;
  day: string;
  status: string;
  punch_in?: string | null;
  punch_out?: string | null;
  working_hours?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  is_late?: boolean;
  holiday_name?: string | null;
  leave_type?: string | null;
};

export type EmployeeMonthlyAttendanceReport = {
  employee: {
    id: number;
    employee_code?: string;
    full_name?: string;
    department?: string | null;
  };
  month: string;
  summary: {
    present_days?: number;
    absent_days?: number;
    half_days?: number;
    leave_days?: number;
    holiday_days?: number;
    weekend_days?: number;
    total_working_hours?: string;
  };
  attendance_grid: EmployeeMonthlyAttendanceDay[];
};

export function mapAttendanceGridCodeToStatus(
  code: string | null | undefined,
): MonthlyAttendanceStatusOption {
  const normalized = String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "P":
    case "PRESENT":
      return "present";
    case "A":
    case "ABSENT":
      return "absent";
    case "HD":
    case "HALF_DAY":
    case "HALFDAY":
      return "half_day";
    case "LT":
    case "LATE":
      return "late";
    case "L":
    case "ON_LEAVE":
    case "LEAVE":
      return "on_leave";
    case "H":
    case "HOLIDAY":
      return "holiday";
    case "W":
    case "WO":
    case "WEEK_OFF":
    case "WEEKOFF":
      return "week_off";
    default:
      return "absent";
  }
}

export async function getAdminEmployeeMonthlyAttendanceReport(
  token: string,
  employeeId: number,
  month: string,
): Promise<EmployeeMonthlyAttendanceReport> {
  try {
    const params = new URLSearchParams({ month });
    const response = await fetch(
      `${API_BASE_URL}v1/admin/monthly-attendance-report/${employeeId}?${params}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "X-CSRF-TOKEN": "",
        },
        cache: "no-store",
      },
    );

    const json = (await response.json()) as AttendanceEnvelope<EmployeeMonthlyAttendanceReport>;
    if (!response.ok || json.success === false) {
      return fail(json.message || "Failed to load employee attendance.");
    }

    const data = (json.data ?? json) as EmployeeMonthlyAttendanceReport;
    return {
      employee: data.employee,
      month: data.month ?? month,
      summary: data.summary ?? {},
      attendance_grid: Array.isArray(data.attendance_grid) ? data.attendance_grid : [],
    };
  } catch (error) {
    if (isAttendanceApiError(error)) return Promise.reject(error);
    return fail("Failed to load employee attendance. Please check your network connection.");
  }
}

export async function updateMonthlyAttendanceStatuses(
  token: string,
  payload: {
    reason: string;
    updates: Array<{
      employee_id: number;
      date: string;
      status: MonthlyAttendanceStatusOption;
      remarks?: string;
    }>;
  },
): Promise<{ updated_count: number; created_count: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/admin/monthly-attendance-report/update-status`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json()) as AttendanceEnvelope<{
      updated_count?: number;
      created_count?: number;
    }>;

    if (response.status === 403) {
      return fail("You don't have permission to edit attendance.");
    }
    if (!response.ok || json.success === false) {
      const fieldErrors = extractAttendanceFieldErrors(json);
      return fail(json.message || "Failed to update attendance status.", fieldErrors);
    }

    const data = json.data ?? {};
    return {
      updated_count: Number(data.updated_count ?? 0),
      created_count: Number(data.created_count ?? 0),
    };
  } catch (error) {
    if (isAttendanceApiError(error)) return Promise.reject(error);
    return fail("Failed to update attendance status. Please check your network connection.");
  }
}

