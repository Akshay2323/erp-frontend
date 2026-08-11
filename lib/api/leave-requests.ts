import { API_BASE_URL } from "@/lib/config";

export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled" | string;

export type LeaveRequestEmployee = {
  id?: number;
  full_name?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  employee_code?: string;
};

export type LeaveRequest = {
  id: number;
  tenant_id?: number;
  company_id?: number;
  employee_id: number;
  leave_name: string;          // API returns leave_name (not leave_type object)
  leave_category: "paid" | "unpaid" | string;
  leave_duration: "full_day" | "half_day" | "first_half" | "second_half" | string;
  from_date: string;
  to_date: string;
  total_days: number;
  reason: string;
  status: LeaveRequestStatus;
  approved_by?: number | null;
  approved_at?: string | null;
  rejected_reason?: string | null;   // API field name
  approved_by_user?: { id?: number; name?: string } | null;
  employee?: LeaveRequestEmployee;
  created_at?: string;
  updated_at?: string;
  // Legacy compat shims (mapped in normalizer)
  leave_type?: { name?: string };
  is_half_day?: boolean;
  is_unpaid?: boolean;
  half_day_session?: string | null;
  rejection_reason?: string | null;
};

export type LeavePagination = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

type Envelope<TData, TMeta = Record<string, unknown>> = {
  success: boolean;
  message: string;
  data: TData;
  meta: TMeta;
};

export type LeaveRequestApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type LeaveRequestListResponse = Envelope<
  LeaveRequest[] | { items: LeaveRequest[] },
  { pagination?: LeavePagination }
>;

export type LeaveRequestMutationResponse = Envelope<{ leave_request: LeaveRequest }>;

export type CreateLeaveRequestPayload = {
  employee_id: number;
  leave_name: string;
  leave_category: "paid" | "unpaid";
  leave_duration: "full_day" | "half_day" | "first_half" | "second_half" | string;
  from_date: string;
  to_date: string;
  reason: string;
};

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const isApiError = (error: unknown): error is LeaveRequestApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as LeaveRequestApiError);

const authHeaders = (token: string, json = false): Record<string, string> => ({
  Accept: "application/json",
  Authorization: `Bearer ${token}`,
  "X-CSRF-TOKEN": "",
  ...(json ? { "Content-Type": "application/json" } : {}),
});

/** Normalize a single record to ensure legacy-compat shims are populated */
export function normalizeLeaveRequest(r: LeaveRequest): LeaveRequest {
  return {
    ...r,
    // Shim: expose leave_name via leave_type.name for any legacy consumers
    leave_type: r.leave_type ?? { name: r.leave_name },
    // Shim: half-day detection from leave_duration
    is_half_day: r.is_half_day ?? (r.leave_duration !== "full_day"),
    is_unpaid: r.is_unpaid ?? (r.leave_category === "unpaid"),
    half_day_session: r.half_day_session ?? (r.leave_duration !== "full_day" && r.leave_duration !== "half_day" ? r.leave_duration : null),
    rejection_reason: r.rejection_reason ?? r.rejected_reason ?? null,
  };
}

export function normalizeLeaveRequestList(payload: LeaveRequestListResponse): {
  items: LeaveRequest[];
  pagination: LeavePagination;
} {
  const raw = payload.data as any;
  // API returns data as:
  //   { requests: [...] }  ← actual shape
  //   { items: [...] }     ← fallback
  //   [...] (bare array)   ← fallback
  const rawItems: LeaveRequest[] =
    Array.isArray(raw?.requests) ? raw.requests :
    Array.isArray(raw?.items)    ? raw.items    :
    Array.isArray(raw)           ? raw          : [];

  const items = rawItems.map(normalizeLeaveRequest);

  const pagination: LeavePagination = payload.meta?.pagination ?? {
    current_page: 1,
    last_page: 1,
    per_page: items.length || 15,
    total: items.length,
    from: items.length ? 1 : null,
    to: items.length ? items.length : null,
  };
  return { items, pagination };
}

export async function getLeaveRequests(
  token: string,
  params?: {
    employee_id?: number | string;
    page?: number;
    per_page?: number;
    status?: string;
    company_id?: number | string;
  },
): Promise<LeaveRequestListResponse> {
  try {
    const sp = new URLSearchParams({
      page: String(params?.page ?? 1),
      per_page: String(params?.per_page ?? 10),
    });
    if (params?.employee_id !== undefined && String(params.employee_id).trim()) {
      sp.set("employee_id", String(params.employee_id));
    }
    if (params?.status?.trim()) sp.set("status", params.status.trim());
    if (params?.company_id !== undefined && String(params.company_id).trim()) {
      sp.set("company_id", String(params.company_id));
    }

    const response = await fetch(`${API_BASE_URL}v1/leave/requests?${sp.toString()}`, {
      method: "GET",
      headers: authHeaders(token),
      cache: "no-store",
    });
    const payload = await parseResponse<LeaveRequestListResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch leave requests.");
    }
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch leave requests.");
  }
}

export async function createLeaveRequest(
  token: string,
  payload: CreateLeaveRequestPayload,
): Promise<LeaveRequestMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/leave/requests`, {
      method: "POST",
      headers: authHeaders(token, true),
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<
      LeaveRequestMutationResponse | Envelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to submit leave request.", fieldErrors);
    }
    return result as LeaveRequestMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to submit leave request.");
  }
}

export async function approveLeaveRequest(
  token: string,
  id: number,
): Promise<LeaveRequestMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/leave/requests/${id}/approve`, {
      method: "PATCH",
      headers: authHeaders(token),
    });
    const result = await parseResponse<LeaveRequestMutationResponse>(response);
    if (!response.ok || !result.success) {
      return fail(result.message || "Unable to approve leave request.");
    }
    return result;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to approve leave request.");
  }
}

export async function rejectLeaveRequest(
  token: string,
  id: number,
  payload: { rejected_reason: string },
): Promise<LeaveRequestMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/leave/requests/${id}/reject`, {
      method: "PATCH",
      headers: authHeaders(token, true),
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<LeaveRequestMutationResponse>(response);
    if (!response.ok || !result.success) {
      return fail(result.message || "Unable to reject leave request.");
    }
    return result;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to reject leave request.");
  }
}

export async function cancelLeaveRequest(
  token: string,
  id: number,
  payload?: { reason?: string },
): Promise<LeaveRequestMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/leave/requests/${id}/cancel`, {
      method: "PATCH",
      headers: authHeaders(token, true),
      body: JSON.stringify(payload ?? {}),
    });
    const result = await parseResponse<LeaveRequestMutationResponse>(response);
    if (!response.ok || !result.success) {
      return fail(result.message || "Unable to cancel leave request.");
    }
    return result;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to cancel leave request.");
  }
}
