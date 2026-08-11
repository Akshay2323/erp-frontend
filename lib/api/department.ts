import { API_BASE_URL } from "@/lib/config";

export type DepartmentStatus = "active" | "inactive";

export type DepartmentBranch = {
  id: number;
  company_id: number | null;
  name: string;
  code: string;
};

export type Department = {
  id: number;
  tenant_id: number | null;
  company_id: number | null;
  branch_id: number | null;
  name: string;
  code: string;
  status: DepartmentStatus;
  branch?: DepartmentBranch | null;
  created_at: string;
  updated_at: string;
};

export type DepartmentPagination = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

type DepartmentEnvelope<TData, TMeta = Record<string, unknown>> = {
  success: boolean;
  message: string;
  data: TData;
  meta: TMeta;
};

export type DepartmentListResponse = DepartmentEnvelope<
  Department[] | { items: Department[] },
  DepartmentPagination | { pagination: DepartmentPagination }
>;

export type DepartmentDetailResponse = DepartmentEnvelope<{ department: Department }>;
export type DepartmentMutationResponse = DepartmentEnvelope<{ department: Department }>;

export type DepartmentApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type CreateDepartmentPayload = {
  branch_id: number;
  name: string;
  code: string;
  status: DepartmentStatus;
};

export type UpdateDepartmentPayload = {
  branch_id: number;
  name: string;
  code: string;
  status: DepartmentStatus;
};

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const isApiError = (error: unknown): error is DepartmentApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as DepartmentApiError);

export async function getDepartments(
  token: string,
  params: {
    q?: string;
    status?: string;
    company_id?: string;
    page?: number;
    per_page?: number;
  },
): Promise<DepartmentListResponse> {
  try {
    const searchParams = new URLSearchParams({
      page: String(params.page ?? 1),
      per_page: String(params.per_page ?? 10),
    });
    if (params.q?.trim()) searchParams.set("q", params.q.trim());
    if (params.status?.trim()) searchParams.set("status", params.status.trim());
    if (params.company_id?.trim()) searchParams.set("company_id", params.company_id.trim());

    const response = await fetch(
      `${API_BASE_URL}v1/organization/departments?${searchParams.toString()}`,
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
    const payload = await parseResponse<DepartmentListResponse>(response);
    if (!response.ok || !payload.success) return fail(payload.message || "Unable to fetch departments.");
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch departments.");
  }
}

export async function getDepartmentDetail(
  token: string,
  id: number,
): Promise<DepartmentDetailResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/departments/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<DepartmentDetailResponse>(response);
    if (!response.ok || !payload.success) return fail(payload.message || "Unable to fetch department details.");
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch department details.");
  }
}

export async function createDepartment(
  token: string,
  payload: CreateDepartmentPayload,
): Promise<DepartmentMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/departments`, {
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
      DepartmentMutationResponse | DepartmentEnvelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to create department.", fieldErrors);
    }
    return result as DepartmentMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to create department.");
  }
}

export async function updateDepartment(
  token: string,
  id: number,
  payload: UpdateDepartmentPayload,
): Promise<DepartmentMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/departments/${id}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<
      DepartmentMutationResponse | DepartmentEnvelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update department.", fieldErrors);
    }
    return result as DepartmentMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to update department.");
  }
}
