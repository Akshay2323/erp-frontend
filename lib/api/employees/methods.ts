import {
  employeeResourceUrl,
  getEmployeeCollection,
  isEmployeeApiError,
  parseJson,
  postEmployeeJson,
  postEmployeeMultipart,
  rejectEmployeeApi,
  extractFieldErrors,
} from "./http";
import { buildCreateEmployeePayload, buildUpdateEmployeeBasicPayload } from "./payload";
import { API_BASE_URL } from "@/lib/config";

import type {
  BankDetailsPayload,
  ContactDetailsPayload,
  CreateEmployeeResponse,
  CreateEmployeePayload,
  EmployeeApiEnvelope,
  EmployeeApiError,
  EmployeeDocumentRecord,
  EmployeeDocumentsResponse,
  EmployeeDetailResponse,
  EmployeeBirthdaysResponse,
  EmployeeListFilters,
  EmployeeListResponse,
  EmployeeRecord,
  FinalizeEmployeePayload,
  JobDetailsRecord,
  JobDetailsPayload,
  LeaveBalancePayload,
  PersonalDetailsPayload,
  SalaryPayload,
  StatutoryDetailsPayload,
  UpdateEmployeeBasicPayload,
  UploadDocumentPayload,
} from "./types";

export type {
  BankDetailsPayload,
  ContactDetailsPayload,
  CreateEmployeePayload,
  CreateEmployeeResponse,
  EmployeeApiEnvelope,
  EmployeeApiError,
  EmployeeDocumentRecord,
  EmployeeDocumentsResponse,
  EmployeeDetailResponse,
  EmployeeListFilters,
  EmployeeListResponse,
  EmployeeRecord,
  FinalizeEmployeePayload,
  JobDetailsPayload,
  JobDetailsRecord,
  LeaveBalancePayload,
  PersonalDetailsPayload,
  SalaryPayload,
  StatutoryDetailsPayload,
  UpdateEmployeeBasicPayload,
  UploadDocumentPayload,
} from "./types";

export { isEmployeeApiError } from "./http";
export { EMPLOYEES_PATH } from "./paths";

async function wrap<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (isEmployeeApiError(error)) return Promise.reject(error);
    return Promise.reject({ message: "Request failed." } as EmployeeApiError);
  }
}

/** POST `{base}v1/employees` — create base employee. */
export async function createEmployee(
  token: string,
  payload: CreateEmployeePayload,
): Promise<CreateEmployeeResponse> {
  return wrap(async () => {
    const body = buildCreateEmployeePayload(payload);
    const response = await fetch(employeeResourceUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const result = await parseJson<
      CreateEmployeeResponse & {
        data?: EmployeeRecord & { errors?: Record<string, string[]> };
      }
    >(response);
    const ok = result.success === true || result.status === true;
    if (!response.ok || !ok) {
      const ef =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data as { errors?: Record<string, string[]> }).errors
          : undefined;
      rejectEmployeeApi(result.message || "Unable to create employee.", ef);
    }
    return result as CreateEmployeeResponse;
  });
}

/** Reusable Step-1 update for edit mode (`PUT /v1/employees/{id}`) */
export async function updateEmployeeBasic(
  token: string,
  employeeId: number,
  payload: UpdateEmployeeBasicPayload,
): Promise<EmployeeApiEnvelope<EmployeeRecord>> {
  return wrap(async () => {
    const body = buildUpdateEmployeeBasicPayload(payload);
    const response = await fetch(employeeResourceUrl(employeeId), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const result = await parseJson<EmployeeApiEnvelope<EmployeeRecord> & { data?: unknown }>(response);
    const ok = result.success === true || result.status === true;
    if (!response.ok || !ok) {
      const fieldErrors =
        typeof result.data === "object" && result.data
          ? (result.data as { errors?: Record<string, string[]> }).errors
          : undefined;
      rejectEmployeeApi(result.message || "Unable to update employee.", fieldErrors);
    }
    return result;
  });
}

export async function saveJobDetails(
  token: string,
  employeeId: number,
  payload: JobDetailsPayload,
): Promise<EmployeeApiEnvelope<JobDetailsRecord>> {
  return wrap(async () => {
    const response = await fetch(employeeResourceUrl(employeeId, "job-details"), {
      method: "POST",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = await parseJson<EmployeeApiEnvelope<JobDetailsRecord> & { data?: unknown }>(response);
    const success = result.success === true || result.status === true;
    const message = String(result.message ?? "");

    if (!response.ok || !success) {
      const fieldErrors = extractFieldErrors(result.data);
      rejectEmployeeApi(message || "Request failed.", fieldErrors);
    }

    return result as EmployeeApiEnvelope<JobDetailsRecord>;
  });
}

export async function savePersonalDetails(
  token: string,
  employeeId: number,
  payload: PersonalDetailsPayload,
): Promise<EmployeeApiEnvelope<unknown>> {
  return wrap(() =>
    postEmployeeJson(token, [employeeId, "personal-details"], payload),
  );
}

export async function saveContactDetails(
  token: string,
  employeeId: number,
  payload: ContactDetailsPayload,
): Promise<EmployeeApiEnvelope<unknown>> {
  return wrap(() =>
    postEmployeeJson(token, [employeeId, "contact-details"], payload),
  );
}

export async function saveSalary(
  token: string,
  employeeId: number,
  payload: SalaryPayload,
): Promise<EmployeeApiEnvelope<unknown>> {
  return wrap(() => postEmployeeJson(token, [employeeId, "salary"], payload));
}

export async function saveBankDetails(
  token: string,
  employeeId: number,
  payload: BankDetailsPayload,
): Promise<EmployeeApiEnvelope<unknown>> {
  return wrap(() =>
    postEmployeeJson(token, [employeeId, "bank-details"], payload),
  );
}

export async function saveStatutoryDetails(
  token: string,
  employeeId: number,
  payload: StatutoryDetailsPayload,
): Promise<EmployeeApiEnvelope<unknown>> {
  return wrap(() =>
    postEmployeeJson(token, [employeeId, "statutory-details"], payload),
  );
}

export async function saveLeaveBalance(
  token: string,
  employeeId: number,
  payload: LeaveBalancePayload,
): Promise<EmployeeApiEnvelope<unknown>> {
  return wrap(() =>
    postEmployeeJson(token, [employeeId, "leave-balance"], payload),
  );
}

/** One multipart request: fields `document_type` + `file` (matches curl). */
export async function uploadEmployeeDocument(
  token: string,
  employeeId: number,
  payload: UploadDocumentPayload,
): Promise<EmployeeApiEnvelope<unknown>> {
  const formData = new FormData();
  formData.append("document_type", payload.document_type);
  formData.append("file", payload.file);
  return wrap(() =>
    postEmployeeMultipart(token, [employeeId, "documents"], formData),
  );
}

/** Sequential requests — backend accepts one pair per POST. */
export async function uploadDocuments(
  token: string,
  employeeId: number,
  rows: UploadDocumentPayload[],
): Promise<EmployeeApiEnvelope<unknown>> {
  if (rows.length === 0) {
    return Promise.resolve({
      success: true,
      message: "No documents uploaded.",
      data: {},
    });
  }
  return wrap(async () => {
    let last: EmployeeApiEnvelope<unknown> | null = null;
    for (const row of rows) {
      const formData = new FormData();
      formData.append("document_type", row.document_type);
      formData.append("file", row.file);
      last = await postEmployeeMultipart(
        token,
        [employeeId, "documents"],
        formData,
      );
    }
    return (
      last ?? {
        success: true,
        message: `Uploaded ${rows.length} document(s).`,
        data: {},
      }
    );
  });
}

export async function uploadProfilePhoto(
  token: string,
  employeeId: number,
  file: File,
): Promise<EmployeeApiEnvelope<unknown>> {
  const formData = new FormData();
  formData.append("photo", file);
  return wrap(() =>
    postEmployeeMultipart(token, [employeeId, "profile-photo"], formData),
  );
}

export async function activateEmployee(
  token: string,
  employeeId: number,
  payload: FinalizeEmployeePayload,
): Promise<EmployeeApiEnvelope<unknown>> {
  return wrap(async () => {
    const body = buildUpdateEmployeeBasicPayload({
      ...payload,
      status: payload.status as "draft" | "active",
    });
    const response = await fetch(employeeResourceUrl(employeeId), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const result = await parseJson<EmployeeApiEnvelope<unknown> & { data?: unknown }>(response);
    const ok = result.success === true || result.status === true;
    if (!response.ok || !ok) {
      const fieldErrors =
        typeof result.data === "object" && result.data
          ? (result.data as { errors?: Record<string, string[]> }).errors
          : undefined;
      rejectEmployeeApi(result.message || "Unable to update employee.", fieldErrors);
    }
    return result;
  });
}

export async function searchEmployees(
  token: string,
  params: { company_id?: number; branch_id?: number; q: string; per_page?: number },
): Promise<EmployeeApiEnvelope<{ items: EmployeeRecord[] } | EmployeeRecord[]>> {
  return wrap(async () => {
    const sp = new URLSearchParams({
      per_page: String(params.per_page ?? 15),
    });
    const q = params.q.trim();
    if (q) sp.set("q", q);
    if (params.company_id) sp.set("company_id", String(params.company_id));
    if (params.branch_id) sp.set("branch_id", String(params.branch_id));
    return getEmployeeCollection<{ items: EmployeeRecord[] } | EmployeeRecord[]>(
      token,
      sp,
    );
  });
}

export async function getEmployees(
  token: string,
  filters: EmployeeListFilters,
): Promise<EmployeeListResponse> {
  return wrap(async () => {
    const sp = new URLSearchParams({
      page: String(filters.page ?? 1),
      per_page: String(filters.per_page ?? 10),
    });
    if (filters.q?.trim()) sp.set("q", filters.q.trim());
    if (filters.status?.trim()) sp.set("status", filters.status.trim());
    if (filters.department_id?.trim()) sp.set("department_id", filters.department_id.trim());
    if (filters.branch_id?.trim()) sp.set("branch_id", filters.branch_id.trim());
    if (filters.company_id?.trim()) sp.set("company_id", filters.company_id.trim());
    const response = await fetch(`${API_BASE_URL}v1/employees?${sp.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const result = await parseJson<EmployeeListResponse>(response);
    const ok = result.success === true || result.status === true;
    if (!response.ok || !ok) {
      rejectEmployeeApi(result.message || "Unable to fetch employees.");
    }
    return result;
  });
}

export async function getEmployeeDetail(
  token: string,
  employeeId: number,
): Promise<EmployeeDetailResponse> {
  return wrap(async () => {
    const response = await fetch(employeeResourceUrl(employeeId), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const result = await parseJson<EmployeeDetailResponse & { data?: unknown }>(response);
    const ok = result.success === true || result.status === true;
    if (!response.ok || !ok) {
      const fieldErrors =
        typeof result.data === "object" && result.data
          ? (result.data as { errors?: Record<string, string[]> }).errors
          : undefined;
      rejectEmployeeApi(result.message || "Unable to fetch employee details.", fieldErrors);
    }
    return result as EmployeeDetailResponse;
  });
}

/** Fetch a document preview blob via `GET /v1/employees/{id}/documents/{docId}/preview`. */
export async function getDocumentPreview(
  token: string,
  employeeId: number,
  documentId: number,
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}v1/employees/${employeeId}/documents/${documentId}/preview`,
    {
      method: "GET",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw { message: "Unable to preview document." } as EmployeeApiError;
  }
  return response.blob();
}

export async function getEmployeeDocuments(
  token: string,
  employeeId: number,
): Promise<EmployeeDocumentsResponse> {
  return wrap(async () => {
    const response = await fetch(`${API_BASE_URL}v1/employees/${employeeId}/documents`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const result = await parseJson<EmployeeApiEnvelope<EmployeeDocumentRecord[]> & { data?: unknown }>(
      response,
    );
    const ok = result.success === true || result.status === true;
    if (!response.ok || !ok) {
      const fieldErrors =
        typeof result.data === "object" && result.data
          ? (result.data as { errors?: Record<string, string[]> }).errors
          : undefined;
      rejectEmployeeApi(result.message || "Unable to fetch employee documents.", fieldErrors);
    }
    return result as EmployeeDocumentsResponse;
  });
}

export async function deleteEmployeeDocument(
  token: string,
  employeeId: number,
  documentId: number,
): Promise<EmployeeApiEnvelope<unknown>> {
  return wrap(async () => {
    const response = await fetch(`${API_BASE_URL}v1/employees/${employeeId}/documents/${documentId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const result = await parseJson<EmployeeApiEnvelope<unknown>>(response);
    const ok = result.success === true || result.status === true;
    if (!response.ok || !ok) {
      rejectEmployeeApi(result.message || "Unable to delete document.");
    }
    return result;
  });
}

function pickStr(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * Maps the logged-in user object to an employee code (+ id when known).
 * Auth `user.id` is often a **User** id, while `/v1/employees/{id}` expects **Employee** id — this helper
 * prefers `employee_id`, then tries `id` as employee id, then directory search by email/code.
 */
export type ResolvedEmployeeSession = {
  employeeCode: string;
  employeeId?: number;
};

export async function resolveEmployeeSession(
  token: string,
  sessionUser: unknown,
): Promise<ResolvedEmployeeSession | null> {
  if (!sessionUser || typeof sessionUser !== "object") return null;
  const u = sessionUser as Record<string, unknown>;
  const nested =
    u.employee && typeof u.employee === "object" ? (u.employee as Record<string, unknown>) : null;

  const directCode = pickStr(
    u.employee_code,
    u.empcode,
    u.emp_code,
    u.employeeCode,
    nested?.employee_code,
  );

  const explicitRaw = u.employee_id ?? u.employeeId ?? nested?.id;
  const explicitEmpId =
    explicitRaw != null && !Number.isNaN(Number(explicitRaw)) ? Number(explicitRaw) : undefined;

  const authUserId = u.id != null && !Number.isNaN(Number(u.id)) ? Number(u.id) : undefined;
  const email = pickStr(u.email);

  if (directCode && explicitEmpId != null) {
    return { employeeCode: directCode, employeeId: explicitEmpId };
  }

  if (directCode) {
    try {
      const result = await getEmployees(token, { q: directCode, per_page: 15, page: 1 });
      const items = result.data?.items ?? [];
      const lower = directCode.toLowerCase();
      // Exact code match only — a loose search hit would resolve to another employee.
      const match = items.find(
        (e) => String(e.employee_code ?? "").toLowerCase() === lower,
      );
      if (match?.employee_code && match.id) {
        return { employeeCode: match.employee_code, employeeId: match.id };
      }
    } catch {
      /* ignore */
    }
    return { employeeCode: directCode };
  }

  if (explicitEmpId != null) {
    try {
      const res = await getEmployeeDetail(token, explicitEmpId);
      const emp = (res?.data as { employee?: EmployeeRecord })?.employee;
      const code = emp?.employee_code;
      if (code) return { employeeCode: code, employeeId: emp?.id ?? explicitEmpId };
    } catch {
      /* ignore */
    }
  }

  // Exact email match in the directory is the safest fallback when the
  // session has no employee code/id.
  if (email) {
    try {
      const result = await getEmployees(token, { q: email, per_page: 15, page: 1 });
      const items = result.data?.items ?? [];
      const lower = email.toLowerCase();
      const match = items.find((e) => e.email?.toLowerCase() === lower);
      if (match?.employee_code && match.id) {
        return { employeeCode: match.employee_code, employeeId: match.id };
      }
    } catch {
      /* ignore */
    }
  }

  // Last resort: try the auth user id as an employee id. Auth `users.id` and
  // `employees.id` are different tables, so only accept the record if its
  // email (or linked user_id) proves it belongs to the logged-in user —
  // otherwise this would show another employee's profile.
  if (authUserId != null && authUserId !== explicitEmpId) {
    try {
      const res = await getEmployeeDetail(token, authUserId);
      const emp = (res?.data as { employee?: EmployeeRecord })?.employee;
      const code = emp?.employee_code;
      const empRec = emp as (EmployeeRecord & { user_id?: number | string }) | undefined;
      const emailMatches =
        !!email && !!empRec?.email && empRec.email.toLowerCase() === email.toLowerCase();
      const userIdMatches =
        empRec?.user_id != null && Number(empRec.user_id) === authUserId;
      if (code && (emailMatches || userIdMatches)) {
        return { employeeCode: code, employeeId: emp?.id ?? authUserId };
      }
    } catch {
      /* ignore — common when auth user id ≠ employees.id */
    }
  }

  return null;
}

export async function getEmployeeBirthdays(
  token: string,
  days: number = 120
): Promise<EmployeeBirthdaysResponse> {
  const url = `${API_BASE_URL}v1/employees/birthdays?days=${days}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-CSRF-TOKEN": "",
    },
  });

  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Failed to fetch employee birthdays");
  }
  return result as EmployeeBirthdaysResponse;
}
