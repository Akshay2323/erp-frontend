import { API_BASE_URL } from "@/lib/config";

export type DesignationStatus = "active" | "inactive";

export type Designation = {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  code: string;
  status: DesignationStatus;
  created_at: string;
  updated_at: string;
};

export type DesignationPagination = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

type DesignationEnvelope<TData, TMeta = Record<string, unknown>> = {
  success: boolean;
  message: string;
  data: TData;
  meta: TMeta;
};

export type DesignationListResponse = DesignationEnvelope<
  Designation[] | { items: Designation[] },
  DesignationPagination | { pagination: DesignationPagination }
>;

export type DesignationDetailResponse = DesignationEnvelope<{ designation: Designation }>;
export type DesignationMutationResponse = DesignationEnvelope<{ designation: Designation }>;

export type DesignationApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type CreateDesignationPayload = {
  company_id: number;
  name: string;
  code: string;
  status: DesignationStatus;
};

export type UpdateDesignationPayload = {
  name: string;
  code: string;
  status: DesignationStatus;
};

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const isApiError = (error: unknown): error is DesignationApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as DesignationApiError);

export async function getDesignations(
  token: string,
  params: {
    q?: string;
    status?: string;
    company_id?: string;
    page?: number;
    per_page?: number;
  },
): Promise<DesignationListResponse> {
  try {
    const searchParams = new URLSearchParams({
      page: String(params.page ?? 1),
      per_page: String(params.per_page ?? 10),
    });
    if (params.q?.trim()) searchParams.set("q", params.q.trim());
    if (params.status?.trim()) searchParams.set("status", params.status.trim());
    if (params.company_id?.trim()) searchParams.set("company_id", params.company_id.trim());

    const response = await fetch(
      `${API_BASE_URL}v1/organization/designations?${searchParams.toString()}`,
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
    const payload = await parseResponse<DesignationListResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch designations.");
    }
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch designations.");
  }
}

export async function getDesignationDetail(
  token: string,
  id: number,
): Promise<DesignationDetailResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/designations/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<DesignationDetailResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch designation details.");
    }
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch designation details.");
  }
}

export async function createDesignation(
  token: string,
  payload: CreateDesignationPayload,
): Promise<DesignationMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/designations`, {
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
      DesignationMutationResponse | DesignationEnvelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to create designation.", fieldErrors);
    }
    return result as DesignationMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to create designation.");
  }
}

export async function updateDesignation(
  token: string,
  id: number,
  payload: UpdateDesignationPayload,
): Promise<DesignationMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/designations/${id}`, {
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
      DesignationMutationResponse | DesignationEnvelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update designation.", fieldErrors);
    }
    return result as DesignationMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to update designation.");
  }
}
