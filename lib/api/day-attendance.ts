import { API_BASE_URL } from "@/lib/config";

export type DayAttendanceStatusFilter =
  | "present"
  | "absent"
  | "half_day"
  | "leave"
  | "week_off"
  | "holiday";

export type DayAttendanceSummary = {
  total_employees: number;
  present: number;
  half_day: number;
  absent: number;
  on_leave: number;
  week_off: number;
  holiday: number;
  punched_in: number;
  yet_to_punch_out: number;
};

export type DayAttendanceEmployee = {
  employee: {
    id: number;
    employee_code: string | null;
    name: string;
    email: string | null;
    mobile: string | null;
    department: string | null;
    designation: string | null;
    branch: string | null;
    profile_photo_url: string | null;
  };
  attendance: {
    date: string;
    status: string | null;
    display_status: string | null;
    is_present: boolean;
    is_currently_in: boolean;
    punch_in_time: string | null;
    punch_in_time_formatted: string | null;
    punch_out_time: string | null;
    punch_out_time_formatted: string | null;
    punch_in_selfie_url?: string | null;
    punch_out_selfie_url?: string | null;
    working_hours_formatted: string | null;
    late_status: string | null;
    late_minutes: number | null;
    leave_type: string | null;
    holiday_name: string | null;
    shift_code: string | null;
    shift_start: string | null;
    shift_end: string | null;
    break_count?: number | null;
    other_count?: number | null;
    total_break_minutes?: number | null;
    total_other_minutes?: number | null;
    total_interval_minutes?: number | null;
  };
};

export type DayAttendanceStatusData = {
  date: string;
  summary: DayAttendanceSummary;
  employees: DayAttendanceEmployee[];
};

export type DayAttendancePagination = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type DayAttendanceStatusResult = {
  data: DayAttendanceStatusData;
  pagination: DayAttendancePagination | null;
};

/** Error carrying the HTTP status so the UI can react to 401/403/422 differently. */
export class DayAttendanceError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "DayAttendanceError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type DayStatusEnvelope = {
  success?: boolean;
  message?: string;
  data?: DayAttendanceStatusData;
  errors?: Record<string, string[]>;
  meta?: { pagination?: DayAttendancePagination };
};

export type GetDayAttendanceStatusParams = {
  date?: string;
  status?: DayAttendanceStatusFilter;
  search?: string;
  branch_id?: string;
  department_id?: string;
  company_id?: string;
  page?: number;
  per_page?: number;
};

export async function getDayAttendanceStatus(
  token: string,
  params: GetDayAttendanceStatusParams = {},
): Promise<DayAttendanceStatusResult> {
  const searchParams = new URLSearchParams();
  if (params.date?.trim()) searchParams.set("date", params.date.trim());
  if (params.status) searchParams.set("status", params.status);
  if (params.search?.trim()) searchParams.set("search", params.search.trim());
  if (params.branch_id?.trim()) searchParams.set("branch_id", params.branch_id.trim());
  if (params.department_id?.trim()) {
    searchParams.set("department_id", params.department_id.trim());
  }
  if (params.company_id?.trim()) searchParams.set("company_id", params.company_id.trim());
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("per_page", String(params.per_page ?? 50));

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}v1/admin/attendance/day-status?${searchParams.toString()}`,
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
  } catch {
    throw new DayAttendanceError(
      "Unable to load daily attendance. Please check your network connection.",
      0,
    );
  }

  let json: DayStatusEnvelope;
  try {
    json = (await response.json()) as DayStatusEnvelope;
  } catch {
    throw new DayAttendanceError("Unexpected response from the attendance service.", response.status);
  }

  if (!response.ok || json.success === false || !json.data) {
    throw new DayAttendanceError(
      json.message || "Failed to load daily attendance status.",
      response.status,
      json.errors,
    );
  }

  return {
    data: {
      date: json.data.date,
      summary: json.data.summary,
      employees: Array.isArray(json.data.employees) ? json.data.employees : [],
    },
    pagination: json.meta?.pagination ?? null,
  };
}

/** Load every page for roster views that need client-side IN / OUT / Not Punch-In filters. */
export async function getDayAttendanceStatusAll(
  token: string,
  params: Omit<GetDayAttendanceStatusParams, "page" | "per_page"> = {},
): Promise<DayAttendanceStatusResult> {
  const allEmployees: DayAttendanceEmployee[] = [];
  let page = 1;
  let lastPage = 1;
  let data: DayAttendanceStatusData | null = null;
  let pagination: DayAttendancePagination | null = null;

  do {
    const batch = await getDayAttendanceStatus(token, {
      ...params,
      page,
      per_page: 100,
    });
    data = batch.data;
    pagination = batch.pagination;
    allEmployees.push(...batch.data.employees);
    lastPage = batch.pagination?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage && page <= 50);

  return {
    data: {
      date: data?.date ?? params.date ?? "",
      summary: data?.summary ?? {
        total_employees: allEmployees.length,
        present: 0,
        half_day: 0,
        absent: 0,
        on_leave: 0,
        week_off: 0,
        holiday: 0,
        punched_in: 0,
        yet_to_punch_out: 0,
      },
      employees: allEmployees,
    },
    pagination: pagination
      ? {
          ...pagination,
          current_page: 1,
          last_page: 1,
          per_page: allEmployees.length,
          total: allEmployees.length,
        }
      : null,
  };
}
