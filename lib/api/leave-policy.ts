import { API_BASE_URL } from "@/lib/config";

export type LeaveStatus = "active" | "inactive";
export type AllocationType = "monthly" | "yearly";
export type GenderSpecific = "male" | "female" | "all";

export type LeaveType = {
  id: number;
  tenant_id: number | null;
  company_id: number | null;
  name: string;
  code: string;
  days_per_year: number;
  carry_forward: boolean;
  status: LeaveStatus;
  created_at: string;
  updated_at: string;
};

export type LeaveDefinition = {
  id?: number;
  leave_policy_id?: number;
  leave_name: string;
  allowed_leaves: number;
  carry_forward: boolean;
  created_at?: string;
  updated_at?: string;
};

export type LeavePolicy = {
  id: number;
  tenant_id: number | null;
  company_id: number;
  name: string;
  leave_cycle: string;
  description: string;
  status: LeaveStatus;
  leave_definitions: LeaveDefinition[];
  created_at: string;
  updated_at: string;
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

export type LeaveApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type LeaveTypeListResponse = Envelope<LeaveType[], LeavePagination>;
export type LeaveTypeMutationResponse = Envelope<{ leave_type: LeaveType }>;

export type LeavePolicyListResponse = Envelope<LeavePolicy[], LeavePagination>;
export type LeavePolicyDetailResponse = Envelope<{ leave_policy: LeavePolicy }>;
export type LeavePolicyMutationResponse = Envelope<{ leave_policy: LeavePolicy }>;

export type AssignLeavePolicyPayload = {
  leave_policy_id: number;
  effective_from: string;
};

export type LeavePolicyAssignment = {
  id: number;
  effective_from: string;
  status: string;
};

export type AssignLeavePolicyResponse = Envelope<{
  employee_id: number;
  assignment: LeavePolicyAssignment;
  leave_policy: LeavePolicy;
}>;

export type CreateLeaveTypePayload = {
  company_id: "" | number;
  name: string;
  code: string;
  days_per_year: number;
  carry_forward: boolean;
  status: LeaveStatus;
};

export type LeaveDefinitionPayload = {
  leave_name: string;
  allowed_leaves: number;
  carry_forward: boolean;
};

export type CreateLeavePolicyPayload = {
  company_id: number;
  name: string;
  leave_cycle: string;
  description: string;
  status: LeaveStatus;
  leave_definitions: LeaveDefinitionPayload[];
};

export type UpdateLeavePolicyPayload = {
  company_id: number;
  name: string;
  leave_cycle: string;
  description: string;
  status: LeaveStatus;
  leave_definitions: LeaveDefinitionPayload[];
};

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const isApiError = (error: unknown): error is LeaveApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as LeaveApiError);

const normalizeLeaveTypeList = (rawData: unknown): LeaveType[] => {
  if (Array.isArray(rawData)) return rawData as LeaveType[];

  if (rawData && typeof rawData === "object") {
    const record = rawData as Record<string, unknown>;
    if (Array.isArray(record.leave_types)) return record.leave_types as LeaveType[];
    if (Array.isArray(record.items)) return record.items as LeaveType[];
  }

  return [];
};

const normalizeLeavePolicyList = (rawData: unknown): LeavePolicy[] => {
  if (Array.isArray(rawData)) return rawData as LeavePolicy[];

  if (rawData && typeof rawData === "object") {
    const record = rawData as Record<string, unknown>;
    if (Array.isArray(record.leave_policies)) return record.leave_policies as LeavePolicy[];
    if (Array.isArray(record.items)) return record.items as LeavePolicy[];
  }

  return [];
};

export async function getLeaveTypes(
  token: string,
  params?: {
    page?: number;
    per_page?: number;
    q?: string;
    status?: LeaveStatus;
    company_id?: string | number;
  },
): Promise<LeaveTypeListResponse> {
  try {
    const sp = new URLSearchParams({
      page: String(params?.page ?? 1),
      per_page: String(params?.per_page ?? 100),
    });
    if (params?.q?.trim()) sp.set("q", params.q.trim());
    if (params?.status?.trim()) sp.set("status", params.status.trim());
    if (params?.company_id !== undefined && String(params.company_id).trim()) {
      sp.set("company_id", String(params.company_id).trim());
    }

    const response = await fetch(`${API_BASE_URL}v1/leave/types?${sp.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<Envelope<unknown, LeavePagination>>(response);
    if (!response.ok || !payload.success) return fail(payload.message || "Unable to fetch leave types.");
    return {
      ...payload,
      data: normalizeLeaveTypeList(payload.data),
    };
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch leave types.");
  }
}

export async function createLeaveType(
  token: string,
  payload: CreateLeaveTypePayload,
): Promise<LeaveTypeMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/leave/types`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<
      LeaveTypeMutationResponse | Envelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to create leave type.", fieldErrors);
    }
    return result as LeaveTypeMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to create leave type.");
  }
}

export async function getLeavePolicies(
  token: string,
  params: { q?: string; company_id?: string; status?: string; page?: number; per_page?: number },
): Promise<LeavePolicyListResponse> {
  try {
    const sp = new URLSearchParams({
      page: String(params.page ?? 1),
      per_page: String(params.per_page ?? 10),
    });
    if (params.q?.trim()) sp.set("q", params.q.trim());
    if (params.company_id?.trim()) sp.set("company_id", params.company_id.trim());
    if (params.status?.trim()) sp.set("status", params.status.trim());

    const response = await fetch(`${API_BASE_URL}v1/leave/policies?${sp.toString()}`, {
      method: "GET",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<Envelope<unknown, LeavePagination>>(response);
    if (!response.ok || !payload.success) return fail(payload.message || "Unable to fetch leave policies.");
    return {
      ...payload,
      data: normalizeLeavePolicyList(payload.data),
    };
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch leave policies.");
  }
}

export async function getLeavePolicyDetail(
  token: string,
  id: number,
): Promise<LeavePolicyDetailResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/leave/policies/${id}`, {
      method: "GET",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<LeavePolicyDetailResponse>(response);
    if (!response.ok || !payload.success) return fail(payload.message || "Unable to fetch leave policy.");
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch leave policy.");
  }
}

export async function createLeavePolicy(
  token: string,
  payload: CreateLeavePolicyPayload,
): Promise<LeavePolicyMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/leave/policies`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<
      LeavePolicyMutationResponse | Envelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to create leave policy.", fieldErrors);
    }
    return result as LeavePolicyMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to create leave policy.");
  }
}

export async function updateLeavePolicy(
  token: string,
  id: number,
  payload: UpdateLeavePolicyPayload,
): Promise<LeavePolicyMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/leave/policies/${id}`, {
      method: "PUT",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<
      LeavePolicyMutationResponse | Envelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update leave policy.", fieldErrors);
    }
    return result as LeavePolicyMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to update leave policy.");
  }
}

export async function assignEmployeeLeavePolicy(
  token: string,
  employeeId: number,
  payload: AssignLeavePolicyPayload,
): Promise<AssignLeavePolicyResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}v1/leave/assignments`,
      {
        method: "POST",
        headers: {
          Accept: "*/*",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": "",
        },
        body: JSON.stringify({
          employee_id: employeeId,
          leave_policy_id: payload.leave_policy_id,
          effective_from: payload.effective_from,
        }),
        cache: "no-store",
      },
    );
    const result = await parseResponse<
      AssignLeavePolicyResponse | Envelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to assign leave policy.", fieldErrors);
    }
    return result as AssignLeavePolicyResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to assign leave policy.");
  }
}

export async function getLeaveBalances(
  token: string,
  params?: { employee_id?: number | string },
): Promise<Envelope<any>> {
  try {
    const sp = new URLSearchParams();
    if (params?.employee_id !== undefined && String(params.employee_id).trim()) {
      sp.set("employee_id", String(params.employee_id).trim());
    }
    const query = sp.toString();
    const response = await fetch(
      `${API_BASE_URL}v1/leave/balances${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "X-CSRF-TOKEN": "",
        },
      },
    );
    const result = await parseResponse<Envelope<any>>(response);
    if (!response.ok || (result.success !== undefined && !result.success)) {
      return fail(result.message || "Unable to fetch leave balances.");
    }
    return result;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch leave balances.");
  }
}
