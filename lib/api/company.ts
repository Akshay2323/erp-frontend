import { API_BASE_URL } from "@/lib/config";
import { getTenantsList } from "@/lib/api/tenants";

export type CompanyStatus = "active" | "inactive";

export type Company = {
  id: number;
  company_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_path: string | null;
  logo_url: string | null;
  status: CompanyStatus;
  subscription_start: string | null;
  subscription_end: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyListMeta = {
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
  meta: Record<string, unknown> | CompanyListMeta;
};

const tenantBasePath = () => "v1/super-admin/tenants";

export type CompanyListResponse = ApiEnvelope<Company[]> & {
  meta: CompanyListMeta;
};

export type CompanyDetailResponse = ApiEnvelope<{ tenant: Company }>;
export type CompanyMutationResponse = ApiEnvelope<{
  tenant: Company;
  company_admin?: {
    id: number;
    name: string;
    email: string;
    status: string;
  };
}>;
export type CompanyDeleteResponse = ApiEnvelope<Record<string, never>>;

export type CompanyApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type CreateCompanyPayload = {
  company_name: string;
  legal_name: string;
  email: string;
  phone: string;
  address: string;
  logo?: File | null;
  subscription_start: string;
  subscription_end: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  admin_password_confirmation: string;
};

export type UpdateCompanyPayload = {
  company_name: string;
  legal_name: string;
  email: string;
  phone: string;
  address: string;
  logo?: File | null;
  subscription_start: string;
  subscription_end: string;
  status: CompanyStatus;
  admin_status?: CompanyStatus;
  admin_name?: string;
  admin_email?: string;
  admin_password?: string;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json()) as T;
  return payload;
};

const throwApiError = (
  message: string,
  fieldErrors?: Record<string, string[]>,
): never => {
  throw { message, fieldErrors } as CompanyApiError;
};

const isCompanyApiError = (error: unknown): error is CompanyApiError =>
  typeof error === "object" && error !== null && "message" in error;

const toFormData = (
  payload: CreateCompanyPayload | UpdateCompanyPayload,
  includeEmpty = false,
): FormData => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      if (includeEmpty) {
        formData.append(key, "");
      }
      return;
    }
    formData.append(key, value as string | Blob);
  });
  return formData;
};

export async function getCompanies(
  token: string,
  page = 1,
  perPage = 10,
  q = "",
  _role?: string,
): Promise<CompanyListResponse> {
  void _role;
  const payload = await getTenantsList(token, page, perPage, q);
  return payload as CompanyListResponse;
}

export async function getCompanyDetail(
  token: string,
  id: number,
  _role?: string,
): Promise<CompanyDetailResponse> {
  void _role;
  try {
    const response = await fetch(`${API_BASE_URL}${tenantBasePath()}/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });

    const payload = await parseResponse<CompanyDetailResponse>(response);
    if (!response.ok || !payload.success) {
      throwApiError(payload.message || "Unable to fetch company details.");
    }
    return payload;
  } catch (error) {
    if (isCompanyApiError(error)) return Promise.reject(error);
    return Promise.reject({
      message: "Unable to fetch company details.",
    } as CompanyApiError);
  }
}

export async function createCompany(
  token: string,
  payload: CreateCompanyPayload,
  _role?: string,
): Promise<CompanyMutationResponse> {
  void _role;
  try {
    const response = await fetch(`${API_BASE_URL}${tenantBasePath()}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: toFormData(payload),
    });

    const result = await parseResponse<CompanyMutationResponse | ApiEnvelope<{ errors?: Record<string, string[]> }>>(response);
    if (!response.ok || !result.success) {
      const errorBag =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      throwApiError(result.message || "Unable to create company.", errorBag);
    }
    return result as CompanyMutationResponse;
  } catch (error) {
    if (isCompanyApiError(error)) return Promise.reject(error);
    return Promise.reject({ message: "Unable to create company." } as CompanyApiError);
  }
}

export async function updateCompany(
  token: string,
  id: number,
  payload: UpdateCompanyPayload,
  _role?: string,
): Promise<CompanyMutationResponse> {
  void _role;
  try {
    const normalizedPayload: UpdateCompanyPayload = {
      company_name: payload.company_name ?? "",
      legal_name: payload.legal_name ?? "",
      email: payload.email ?? "",
      phone: payload.phone ?? "",
      address: payload.address ?? "",
      logo: payload.logo ?? null,
      subscription_start: payload.subscription_start ?? "",
      subscription_end: payload.subscription_end ?? "",
      status: payload.status,
      admin_status: payload.admin_status ?? payload.status,
      admin_name: payload.admin_name ?? "",
      admin_email: payload.admin_email ?? "",
      admin_password: payload.admin_password ?? "",
    };

    const response = await fetch(
      `${API_BASE_URL}${tenantBasePath()}/${id}/update`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "X-CSRF-TOKEN": "",
        },
        // Intentionally do not set Content-Type; browser sets multipart boundary.
        body: toFormData(normalizedPayload, true),
      },
    );

    const result = await parseResponse<CompanyMutationResponse | ApiEnvelope<{ errors?: Record<string, string[]> }>>(response);
    if (!response.ok || !result.success) {
      const errorBag =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      throwApiError(result.message || "Unable to update company.", errorBag);
    }
    return result as CompanyMutationResponse;
  } catch (error) {
    if (isCompanyApiError(error)) return Promise.reject(error);
    return Promise.reject({ message: "Unable to update company." } as CompanyApiError);
  }
}

export async function deleteCompany(
  token: string,
  id: number,
  _role?: string,
): Promise<CompanyDeleteResponse> {
  void _role;
  try {
    const response = await fetch(`${API_BASE_URL}${tenantBasePath()}/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
    });

    const result = await parseResponse<CompanyDeleteResponse>(response);
    if (!response.ok || !result.success) {
      throwApiError(result.message || "Unable to delete company.");
    }
    return result;
  } catch (error) {
    if (isCompanyApiError(error)) return Promise.reject(error);
    return Promise.reject({ message: "Unable to delete company." } as CompanyApiError);
  }
}
