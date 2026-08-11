import { API_BASE_URL } from "@/lib/config";

export type HolidayStatus = "active" | "inactive";

export type Holiday = {
  id: number;
  company_id: number;
  name: string;
  date: string;
  type: string;
  branch_id: string | null;
  is_paid: boolean;
  status: HolidayStatus;
  entry_date: string | null;
  entry_user?: {
    id: number;
    name: string;
  } | null;
};

export type HolidayPagination = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

type HolidayEnvelope<TData, TMeta = Record<string, unknown>> = {
  success: boolean;
  message: string;
  data: TData;
  meta: TMeta;
};

export type HolidayApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type HolidayListResponse = HolidayEnvelope<
  Holiday[] | { items: Holiday[] },
  HolidayPagination | { pagination: HolidayPagination }
>;

export type HolidayDetailResponse = HolidayEnvelope<{ holiday: Holiday }>;
export type HolidayMutationResponse = HolidayEnvelope<{ holiday: Holiday }>;
export type HolidayDeleteResponse = HolidayEnvelope<Record<string, never>>;

export type HolidayBulkResponse = HolidayEnvelope<{
  imported_count: number;
  holiday_ids: number[];
  row_errors: Array<{ row: number; message: string }> | string[];
}>;

export type CreateHolidayPayload = {
  name: string;
  date: string;
  type: string;
  branch_id: "";
  is_paid: boolean;
  status: HolidayStatus;
};

export type UpdateHolidayPayload = CreateHolidayPayload;

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const isApiError = (error: unknown): error is HolidayApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as HolidayApiError);

export async function getHolidays(
  token: string,
  params: {
    q?: string;
    status?: string;
    holiday_date_from?: string;
    holiday_date_to?: string;
    month?: number;
    year?: number;
    page?: number;
    per_page?: number;
  },
): Promise<HolidayListResponse> {
  try {
    const searchParams = new URLSearchParams({
      page: String(params.page ?? 1),
      per_page: String(params.per_page ?? 10),
    });
    if (params.q?.trim()) searchParams.set("q", params.q.trim());
    if (params.status?.trim()) searchParams.set("status", params.status.trim());
    if (params.holiday_date_from?.trim()) {
      searchParams.set("holiday_date_from", params.holiday_date_from.trim());
    }
    if (params.holiday_date_to?.trim()) {
      searchParams.set("holiday_date_to", params.holiday_date_to.trim());
    }
    if (params.month) searchParams.set("month", String(params.month));
    if (params.year) searchParams.set("year", String(params.year));

    const response = await fetch(
      `${API_BASE_URL}v1/organization/holidays?${searchParams.toString()}`,
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

    const payload = await parseResponse<HolidayListResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch holidays.");
    }
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch holidays.");
  }
}

export async function getHolidayDetail(
  token: string,
  id: number,
): Promise<HolidayDetailResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/holidays/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });

    const payload = await parseResponse<HolidayDetailResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch holiday details.");
    }
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch holiday details.");
  }
}

export async function createHoliday(
  token: string,
  companyId: number,
  payload: CreateHolidayPayload,
): Promise<HolidayMutationResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}v1/organization/holidays?company_id=${companyId}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": "",
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await parseResponse<
      HolidayMutationResponse | HolidayEnvelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to create holiday.", fieldErrors);
    }
    return result as HolidayMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to create holiday.");
  }
}

export async function updateHoliday(
  token: string,
  id: number,
  payload: UpdateHolidayPayload,
): Promise<HolidayMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/holidays/${id}`, {
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
      HolidayMutationResponse | HolidayEnvelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update holiday.", fieldErrors);
    }
    return result as HolidayMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to update holiday.");
  }
}

export async function deleteHoliday(token: string, id: number): Promise<HolidayDeleteResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/holidays/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
    });
    const payload = await parseResponse<HolidayDeleteResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to delete holiday.");
    }
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to delete holiday.");
  }
}

export async function bulkImportHolidays(
  token: string,
  file: File,
  isPaid = true,
  status: HolidayStatus = "active",
  companyId?: number,
): Promise<HolidayBulkResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("is_paid", String(isPaid));
    formData.append("status", status);

    const url = `${API_BASE_URL}v1/organization/holidays/bulk-import${
      companyId ? `?company_id=${companyId}` : ""
    }`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: formData,
    });

    const result = await parseResponse<
      HolidayBulkResponse | HolidayEnvelope<{ errors?: Record<string, string[]> }>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to import holidays.", fieldErrors);
    }
    return result as HolidayBulkResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to import holidays.");
  }
}
