import { API_BASE_URL } from "@/lib/config";

export type ShiftStatus = "active" | "inactive";
export type ShiftAttendanceMode = "fixed" | "flexible" | "hour-based";

export type ShiftDaySchedule = {
  day: string;
  enabled: boolean;
  end_time: string | null;
  start_time: string | null;
};

export type Shift = {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  shift_name: string;
  shift_code: string;
  attendance_mode: string;
  schedule: ShiftDaySchedule[];
  start_time: string;
  end_time: string;
  grace_minutes: number;
  half_day_minutes: number;
  late_mark_minutes: number;
  late_rules: Record<string, unknown>;
  half_day_rules: Record<string, unknown>;
  overtime_rules: Record<string, unknown>;
  week_off_rules: string[];
  geo_location_rules: Record<string, unknown>;
  auto_absent_rules: Record<string, unknown>;
  working_hours_rules: Record<string, unknown>;
  status: ShiftStatus | string;
  created_at: string;
  updated_at: string;
};

export type ShiftListMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta: ShiftListMeta | Record<string, unknown>;
};

export type ShiftListResponse = ApiEnvelope<Shift[] | { items: Shift[] }> & {
  meta: ShiftListMeta | { pagination: ShiftListMeta };
};

export type ShiftMutationResponse = ApiEnvelope<{ shift: Shift } | Shift>;
export type ShiftDeleteResponse = ApiEnvelope<Record<string, never>>;

export type ShiftApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type CreateShiftPayload = {
  company_id: number;
  shift_name: string;
  shift_code: string;
  attendance_mode: ShiftAttendanceMode;
  schedule: ShiftDaySchedule[];
  late_rules: Record<string, unknown>;
  half_day_rules: Record<string, unknown>;
  overtime_rules: Record<string, unknown>;
  week_off_rules: string[];
  geo_location_rules: Record<string, unknown>;
  auto_absent_rules: Record<string, unknown>;
  working_hours_rules: Record<string, unknown>;
  status: ShiftStatus;
};
export type UpdateShiftPayload = CreateShiftPayload;

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const isApiError = (error: unknown): error is ShiftApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as ShiftApiError);

export function defaultShiftSchedule(
  start: string,
  end: string,
  satStart?: string,
  satEnd?: string,
): ShiftDaySchedule[] {
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
  const satS = satStart ?? "11:00:00";
  const satE = satEnd ?? "15:00:00";
  return [
    ...weekdays.map((day) => ({
      day,
      enabled: true,
      start_time: start,
      end_time: end,
    })),
    { day: "Saturday", enabled: true, start_time: satS, end_time: satE },
    { day: "Sunday", enabled: false, start_time: null, end_time: null },
  ];
}

export function defaultShiftRules(): Pick<
  CreateShiftPayload,
  | "late_rules"
  | "half_day_rules"
  | "overtime_rules"
  | "week_off_rules"
  | "geo_location_rules"
  | "auto_absent_rules"
  | "working_hours_rules"
> {
  return {
    late_rules: {
      grace_minutes: 10,
      late_conversion: "3 late = 0.5 day",
      late_after_minutes: 15,
    },
    half_day_rules: {
      half_day_at_time: "14:00:00",
      half_day_after_hours: 4,
    },
    overtime_rules: {
      type: "After Shift End",
      min_hours: 9,
    },
    week_off_rules: ["Sun", "Sat"],
    geo_location_rules: {
      require_location: true,
      allow_outside_radius: "No",
    },
    auto_absent_rules: {
      no_punch_mark_absent: true,
      missed_punch_handling: "Notify Manager",
    },
    working_hours_rules: {
      min_present_hours: 8,
      min_half_day_hours: 4,
      max_break_deduction_minutes: 60,
    },
  };
}

export async function getShifts(
  token: string,
  params?: {
    page?: number;
    per_page?: number;
    q?: string;
    status?: ShiftStatus | "";
    company_id?: string;
  },
): Promise<ShiftListResponse> {
  try {
    const searchParams = new URLSearchParams({
      page: String(params?.page ?? 1),
      per_page: String(params?.per_page ?? 15),
    });
    if (params?.q?.trim()) searchParams.set("q", params.q.trim());
    if (params?.status?.trim()) searchParams.set("status", params.status.trim());
    if (params?.company_id?.trim()) searchParams.set("company_id", params.company_id.trim());

    const response = await fetch(
      `${API_BASE_URL}v1/organization/shifts?${searchParams.toString()}`,
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

    const payload = await parseResponse<ShiftListResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch shifts.");
    }
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch shifts.");
  }
}

export async function getShift(token: string, id: number): Promise<Shift> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/shifts/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });

    const payload = await parseResponse<
      ShiftMutationResponse | ApiEnvelope<{ shift: Shift }> | ApiEnvelope<Shift>
    >(response);

    if (!response.ok || !(payload as ApiEnvelope<unknown>).success) {
      return fail((payload as ApiEnvelope<unknown>).message || "Unable to fetch shift.");
    }

    const data: unknown = (payload as ApiEnvelope<unknown>).data;
    const shift =
      typeof data === "object" && data !== null && "shift" in (data as Record<string, unknown>)
        ? (data as { shift: Shift }).shift
        : (data as Shift);

    return shift;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch shift.");
  }
}

export async function createShift(
  token: string,
  payload: CreateShiftPayload,
): Promise<ShiftMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/shifts`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });

    const result = await parseResponse<
      ShiftMutationResponse | ApiEnvelope<{ errors?: Record<string, string[]> }>
    >(response);

    if (!response.ok || !result.success) {
      const errorBag =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to create shift.", errorBag);
    }
    return result as ShiftMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to create shift.");
  }
}

export async function updateShift(
  token: string,
  id: number,
  payload: UpdateShiftPayload,
): Promise<ShiftMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/shifts/${id}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });

    const result = await parseResponse<
      ShiftMutationResponse | ApiEnvelope<{ errors?: Record<string, string[]> }>
    >(response);

    if (!response.ok || !result.success) {
      const errorBag =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update shift.", errorBag);
    }
    return result as ShiftMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to update shift.");
  }
}

export async function deleteShift(
  token: string,
  id: number,
): Promise<ShiftDeleteResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/shifts/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
    });

    const result = await parseResponse<ShiftDeleteResponse>(response);
    if (!response.ok || !result.success) {
      return fail(result.message || "Unable to delete shift.");
    }
    return result;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to delete shift.");
  }
}
