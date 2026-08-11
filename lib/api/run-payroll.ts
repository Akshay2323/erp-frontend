import { API_BASE_URL } from "@/lib/config";

import type { PayrollApiError } from "./payroll";

type Envelope<TData, TMeta = Record<string, unknown>> = {
  success: boolean;
  message: string;
  data: TData;
  meta: TMeta;
};

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const isApiError = (error: unknown): error is PayrollApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as PayrollApiError);

export type RunPayrollSortBy = "full_name" | "employee_code" | "net_payable" | "payroll_status";
export type RunPayrollSortDir = "asc" | "desc";

export type RunPayrollFilterParams = {
  month: number;
  year: number;
  company_id?: string | number;
  branch_id?: string | number;
  department_id?: string | number;
  designation_id?: string | number;
  employment_type?: string;
  employee_status?: string;
  salary_type?: string;
  calculation_mode?: "hour" | "day";
  include_overtime?: boolean;
  include_penalty?: boolean;
  payroll_status?: string;
  q?: string;
};

export type RunPayrollEmployeesParams = RunPayrollFilterParams & {
  page?: number;
  per_page?: number;
  sort_by?: RunPayrollSortBy;
  sort_dir?: RunPayrollSortDir;
};

export type RunPayrollMetaParams = {
  month: number;
  year: number;
  company_id?: string | number;
};

export type RunPayrollBreakdownParams = {
  month: number;
  year: number;
  calculation_mode?: "hour" | "day";
  include_overtime?: boolean;
  include_penalty?: boolean;
};

export type RunPayrollMetaResponse = Envelope<Record<string, unknown>>;
export type RunPayrollSummaryResponse = Envelope<Record<string, unknown>>;
export type RunPayrollEmployeesResponse = Envelope<Record<string, unknown>>;
export type RunPayrollBreakdownResponse = Envelope<Record<string, unknown>>;

function appendFilterParams(sp: URLSearchParams, params: RunPayrollFilterParams) {
  sp.set("month", String(params.month));
  sp.set("year", String(params.year));

  if (params.company_id !== undefined && String(params.company_id).trim() && params.company_id !== "all") {
    sp.set("company_id", String(params.company_id));
  }
  if (params.branch_id !== undefined && String(params.branch_id).trim() && params.branch_id !== "all") {
    sp.set("branch_id", String(params.branch_id));
  }
  if (params.department_id !== undefined && String(params.department_id).trim() && params.department_id !== "all") {
    sp.set("department_id", String(params.department_id));
  }
  if (params.designation_id !== undefined && String(params.designation_id).trim() && params.designation_id !== "all") {
    sp.set("designation_id", String(params.designation_id));
  }
  if (params.employment_type !== undefined && String(params.employment_type).trim() && params.employment_type !== "all") {
    sp.set("employment_type", String(params.employment_type));
  }
  if (params.employee_status !== undefined && String(params.employee_status).trim() && params.employee_status !== "all") {
    sp.set("employee_status", String(params.employee_status));
  }
  if (params.calculation_mode) {
    sp.set("calculation_mode", params.calculation_mode);
  }
  if (params.include_overtime !== undefined) {
    sp.set("include_overtime", String(params.include_overtime));
  }
  if (params.include_penalty !== undefined) {
    sp.set("include_penalty", String(params.include_penalty));
  }
  if (params.salary_type !== undefined && String(params.salary_type).trim() && params.salary_type !== "all") {
    sp.set("salary_type", String(params.salary_type));
  }
  if (params.payroll_status?.trim()) {
    sp.set("payroll_status", params.payroll_status.trim());
  }
  if (params.q?.trim()) {
    sp.set("q", params.q.trim());
  }
}

export function buildRunPayrollSearchParams(params: RunPayrollFilterParams): URLSearchParams {
  const sp = new URLSearchParams();
  appendFilterParams(sp, params);
  return sp;
}

async function runPayrollGet<T>(token: string, path: string, searchParams: URLSearchParams): Promise<T> {
  try {
    const qs = searchParams.toString();
    const url = `${API_BASE_URL}v1/payroll/run-payroll/${path}${qs ? `?${qs}` : ""}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<Envelope<T>>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch run payroll data.");
    }
    return payload as T;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch run payroll data.");
  }
}

export async function getRunPayrollMeta(
  token: string,
  params: RunPayrollMetaParams,
): Promise<RunPayrollMetaResponse> {
  const sp = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
  });
  if (params.company_id !== undefined && String(params.company_id).trim() && params.company_id !== "all") {
    sp.set("company_id", String(params.company_id));
  }
  return runPayrollGet<RunPayrollMetaResponse>(token, "meta", sp);
}

export async function getRunPayrollSummary(
  token: string,
  params: RunPayrollFilterParams,
): Promise<RunPayrollSummaryResponse> {
  return runPayrollGet<RunPayrollSummaryResponse>(token, "summary", buildRunPayrollSearchParams(params));
}

export async function getRunPayrollEmployees(
  token: string,
  params: RunPayrollEmployeesParams,
): Promise<RunPayrollEmployeesResponse> {
  const sp = buildRunPayrollSearchParams(params);
  if (params.page) sp.set("page", String(params.page));
  if (params.per_page) sp.set("per_page", String(params.per_page));
  if (params.sort_by) sp.set("sort_by", params.sort_by);
  if (params.sort_dir) sp.set("sort_dir", params.sort_dir);
  return runPayrollGet<RunPayrollEmployeesResponse>(token, "employees", sp);
}

export async function getRunPayrollBreakdown(
  token: string,
  employeeId: number,
  params: RunPayrollBreakdownParams,
): Promise<RunPayrollBreakdownResponse> {
  const sp = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
  });
  if (params.calculation_mode) {
    sp.set("calculation_mode", params.calculation_mode);
  }
  if (params.include_overtime !== undefined) {
    sp.set("include_overtime", String(params.include_overtime));
  }
  if (params.include_penalty !== undefined) {
    sp.set("include_penalty", String(params.include_penalty));
  }
  return runPayrollGet<RunPayrollBreakdownResponse>(token, `employees/${employeeId}/breakdown`, sp);
}
