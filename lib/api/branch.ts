import { API_BASE_URL } from "@/lib/config";

export type BranchStatus = "active" | "inactive";

export type Branch = {
  id: number;
  tenant_id: number | null;
  company_id: number | null;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  contact_person_name: string | null;
  latitude: number | null;
  longitude: number | null;
  allowed_radius_meters: number | null;
  location_required: boolean;
  strict_punch_mode: boolean;
  allow_hr_manual_edit: boolean;
  allow_outside_punch_out: boolean;
  status: BranchStatus;
  created_at: string;
  updated_at: string;
};

export type BranchListMeta = {
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
  meta: Record<string, unknown> | BranchListMeta;
};

export type BranchListResponse = ApiEnvelope<Branch[]> & {
  meta: BranchListMeta;
};

export type BranchMutationResponse = ApiEnvelope<{ branch: Branch }>;

export type BranchApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

type BranchPayloadBase = {
  company_id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  contact_person_name: string;
  latitude: number;
  longitude: number;
  allowed_radius_meters: number;
  location_required: boolean;
  strict_punch_mode: boolean;
  allow_hr_manual_edit: boolean;
  allow_outside_punch_out: boolean;
  status: BranchStatus;
};

export type CreateBranchPayload = BranchPayloadBase;
export type UpdateBranchPayload = Omit<BranchPayloadBase, "company_id">;

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const isBranchApiError = (error: unknown): error is BranchApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as BranchApiError);

export async function getBranches(
  token: string,
  params: {
    q?: string;
    status?: string;
    company_id?: string;
    page?: number;
    per_page?: number;
  },
): Promise<BranchListResponse> {
  try {
    const searchParams = new URLSearchParams({
      page: String(params.page ?? 1),
      per_page: String(params.per_page ?? 10),
    });
    if (params.q?.trim()) searchParams.set("q", params.q.trim());
    if (params.status?.trim()) searchParams.set("status", params.status.trim());
    if (params.company_id?.trim()) searchParams.set("company_id", params.company_id.trim());

    const response = await fetch(
      `${API_BASE_URL}v1/organization/branches?${searchParams.toString()}`,
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

    const payload = await parseResponse<BranchListResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch branches.");
    }
    return payload;
  } catch (error) {
    if (isBranchApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch branches.");
  }
}

export async function createBranch(
  token: string,
  payload: CreateBranchPayload,
): Promise<BranchMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/branches`, {
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
      BranchMutationResponse | ApiEnvelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to create branch.", fieldErrors);
    }
    return result as BranchMutationResponse;
  } catch (error) {
    if (isBranchApiError(error)) return Promise.reject(error);
    return fail("Unable to create branch.");
  }
}

export async function updateBranch(
  token: string,
  id: number,
  payload: UpdateBranchPayload,
): Promise<BranchMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/branches/${id}`, {
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
      BranchMutationResponse | ApiEnvelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update branch.", fieldErrors);
    }
    return result as BranchMutationResponse;
  } catch (error) {
    if (isBranchApiError(error)) return Promise.reject(error);
    return fail("Unable to update branch.");
  }
}
