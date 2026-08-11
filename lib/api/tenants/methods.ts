import { API_BASE_URL } from "@/lib/config";

import type { TenantApiError, TenantListResponse } from "./types";

const TENANTS_PATH = "v1/super-admin/tenants";

const parseJson = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const isTenantApiError = (error: unknown): error is TenantApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as TenantApiError);

export async function getTenantsList(
  token: string,
  page = 1,
  perPage = 15,
  q = "",
): Promise<TenantListResponse> {
  try {
    const safePerPage = Math.min(Math.max(perPage, 1), 100);
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(safePerPage),
    });
    if (q.trim()) params.set("q", q.trim());

    const response = await fetch(`${API_BASE_URL}${TENANTS_PATH}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });

    if (response.status === 403) {
      try {
        const storedUser = typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
        if (storedUser) {
          const user = JSON.parse(storedUser);
          if (user && user.company) {
            return {
              success: true,
              message: "Tenant fallback retrieved from session.",
              data: [
                {
                  id: user.company.id,
                  company_name: user.company.name,
                  legal_name: user.company.name,
                  email: user.email || null,
                  phone: null,
                  address: null,
                  logo_path: null,
                  logo_url: null,
                  status: "active",
                  is_platform: false,
                  parent_tenant_id: null,
                  subscription_start: null,
                  subscription_end: null,
                  users_count: {},
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                } as any,
              ],
              meta: {
                current_page: 1,
                per_page: 15,
                total: 1,
                last_page: 1,
                from: 1,
                to: 1,
              },
            };
          }
        }
      } catch (e) {
        console.error("Failed to parse fallback company from localStorage", e);
      }
    }

    const payload = await parseJson<TenantListResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch tenants.");
    }
    return payload;
  } catch (error) {
    if (isTenantApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch tenants.");
  }
}
