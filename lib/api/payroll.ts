import { API_BASE_URL } from "@/lib/config";

export type SalaryComponentType = "earning" | "deduction";
export type SalaryComponentStatus = "active" | "inactive";

export type SalaryComponent = {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  code: string;
  type: SalaryComponentType;
  default_amount: number | null;
  status: SalaryComponentStatus;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeSalaryStructureItem = {
  id?: number;
  salary_component_id: number;
  amount: number;
  type: SalaryComponentType;
  component?: SalaryComponent | null;
};

export type EmployeeSalaryStructure = {
  id: number;
  tenant_id: number;
  company_id: number;
  employee_id: number;
  basic_salary: number;
  gross_salary: number | null;
  effective_from: string; // date: YYYY-MM-DD
  status: "active" | "inactive";
  items: EmployeeSalaryStructureItem[];
  created_at?: string;
  updated_at?: string;
  employee?: {
    id: number;
    first_name: string;
    last_name: string;
    full_name?: string;
    employee_code?: string;
  } | null;
};

export type PayrollPagination = {
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

export type PayrollApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type SalaryComponentListResponse = Envelope<SalaryComponent[], PayrollPagination>;
export type SalaryComponentDetailResponse = Envelope<{ component: SalaryComponent }>;
export type SalaryComponentMutationResponse = Envelope<{ component: SalaryComponent }>;

export type SalaryStructureListResponse = Envelope<EmployeeSalaryStructure[], PayrollPagination>;
export type SalaryStructureDetailResponse = Envelope<{ salary_structure: EmployeeSalaryStructure }>;
export type SalaryStructureMutationResponse = Envelope<{ salary_structure: EmployeeSalaryStructure }>;

export type CreateSalaryComponentPayload = {
  company_id?: number | null;
  name: string;
  code: string;
  type: SalaryComponentType;
  default_amount?: number | null;
  status?: SalaryComponentStatus;
};

export type UpdateSalaryComponentPayload = {
  name: string;
  code: string;
  type: SalaryComponentType;
  default_amount?: number | null;
  status: SalaryComponentStatus;
};

export type SalaryStructureItemPayload = {
  salary_component_id: number;
  amount: number;
  type: SalaryComponentType;
};

export type CreateSalaryStructurePayload = {
  employee_id: number;
  basic_salary: number;
  gross_salary?: number | null;
  effective_from: string; // date: YYYY-MM-DD
  status?: "active" | "inactive";
  items: SalaryStructureItemPayload[];
};

export type UpdateSalaryStructurePayload = {
  basic_salary: number;
  gross_salary?: number | null;
  effective_from: string; // date: YYYY-MM-DD
  status: "active" | "inactive";
  items: SalaryStructureItemPayload[];
};

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const isApiError = (error: unknown): error is PayrollApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as PayrollApiError);

// -------------------------------------------------------------
// SALARY COMPONENTS API
// -------------------------------------------------------------

export async function getSalaryComponents(
  token: string,
  params?: {
    page?: number;
    per_page?: number;
    q?: string;
    type?: SalaryComponentType;
    status?: SalaryComponentStatus;
    company_id?: string | number;
  },
): Promise<SalaryComponentListResponse> {
  try {
    const sp = new URLSearchParams({
      page: String(params?.page ?? 1),
      per_page: String(params?.per_page ?? 10),
    });
    if (params?.q?.trim()) sp.set("q", params.q.trim());
    if (params?.type) sp.set("type", params.type);
    if (params?.status) sp.set("status", params.status);
    if (params?.company_id !== undefined && String(params.company_id).trim()) {
      sp.set("company_id", String(params.company_id).trim());
    }

    const response = await fetch(`${API_BASE_URL}v1/payroll/components?${sp.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<Envelope<any, any>>(response);
    if (!response.ok || !payload.success) return fail(payload.message || "Unable to fetch salary components.");
    
    // Normalize data (backend returns items nested inside data)
    const items = Array.isArray(payload.data) 
      ? payload.data 
      : Array.isArray(payload.data?.items) 
        ? payload.data.items 
        : [];

    return {
      ...payload,
      data: items,
      meta: payload.meta?.pagination ?? payload.meta ?? { current_page: 1, last_page: 1, per_page: 10, total: items.length },
    } as SalaryComponentListResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch salary components.");
  }
}

export async function getSalaryComponentDetail(
  token: string,
  id: number,
): Promise<SalaryComponentDetailResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/components/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<SalaryComponentDetailResponse>(response);
    if (!response.ok || !payload.success) return fail(payload.message || "Unable to fetch salary component.");
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch salary component.");
  }
}

export async function createSalaryComponent(
  token: string,
  payload: CreateSalaryComponentPayload,
): Promise<SalaryComponentMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/components`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<
      SalaryComponentMutationResponse | Envelope<{ errors?: Record<string, string[]> }, any>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to create salary component.", fieldErrors);
    }
    return result as SalaryComponentMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to create salary component.");
  }
}

export async function updateSalaryComponent(
  token: string,
  id: number,
  payload: UpdateSalaryComponentPayload,
): Promise<SalaryComponentMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/components/${id}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<
      SalaryComponentMutationResponse | Envelope<{ errors?: Record<string, string[]> }, any>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update salary component.", fieldErrors);
    }
    return result as SalaryComponentMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to update salary component.");
  }
}

export async function deleteSalaryComponent(
  token: string,
  id: number,
): Promise<Envelope<any, any>> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/components/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
    });
    const result = await parseResponse<Envelope<any, any>>(response);
    if (!response.ok || !result.success) return fail(result.message || "Unable to delete salary component.");
    return result;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to delete salary component.");
  }
}

// -------------------------------------------------------------
// SALARY STRUCTURES API
// -------------------------------------------------------------

export async function getSalaryStructures(
  token: string,
  params?: {
    page?: number;
    per_page?: number;
    employee_id?: string | number;
    status?: "active" | "inactive";
    company_id?: string | number;
  },
): Promise<SalaryStructureListResponse> {
  try {
    const sp = new URLSearchParams({
      page: String(params?.page ?? 1),
      per_page: String(params?.per_page ?? 10),
    });
    if (params?.employee_id) sp.set("employee_id", String(params.employee_id));
    if (params?.status) sp.set("status", params.status);
    if (params?.company_id !== undefined && String(params.company_id).trim()) {
      sp.set("company_id", String(params.company_id).trim());
    }

    const response = await fetch(`${API_BASE_URL}v1/payroll/salary-structures?${sp.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<Envelope<any, any>>(response);
    if (!response.ok || !payload.success) return fail(payload.message || "Unable to fetch salary structures.");
    
    const items = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.data?.items)
        ? payload.data.items
        : [];

    return {
      ...payload,
      data: items,
      meta: payload.meta?.pagination ?? payload.meta ?? { current_page: 1, last_page: 1, per_page: 10, total: items.length },
    } as SalaryStructureListResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch salary structures.");
  }
}

export async function getSalaryStructureDetail(
  token: string,
  id: number,
): Promise<SalaryStructureDetailResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/salary-structures/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<SalaryStructureDetailResponse>(response);
    if (!response.ok || !payload.success) return fail(payload.message || "Unable to fetch salary structure.");
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch salary structure.");
  }
}

export async function createSalaryStructure(
  token: string,
  payload: CreateSalaryStructurePayload,
): Promise<SalaryStructureMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/salary-structures`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<
      SalaryStructureMutationResponse | Envelope<{ errors?: Record<string, string[]> }, any>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to create salary structure.", fieldErrors);
    }
    return result as SalaryStructureMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to create salary structure.");
  }
}

export async function updateSalaryStructure(
  token: string,
  id: number,
  payload: UpdateSalaryStructurePayload,
): Promise<SalaryStructureMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/salary-structures/${id}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<
      SalaryStructureMutationResponse | Envelope<{ errors?: Record<string, string[]> }, any>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update salary structure.", fieldErrors);
    }
    return result as SalaryStructureMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to update salary structure.");
  }
}

// -------------------------------------------------------------
// PAYROLL RUNS / PROCESSING API
// -------------------------------------------------------------

export type PayrollRunStatus = "draft" | "processed" | "paid";

export type PayrollRunItem = {
  id: number;
  salary_component_id: number | null;
  component_name: string;
  component_code: string | null;
  type: "earning" | "deduction";
  amount: number;
};

export type PayrollRun = {
  id: number;
  tenant_id: number;
  company_id: number;
  month: number;
  year: number;
  employee_id: number;
  salary_structure_id: number | null;
  gross_salary: number;
  total_earnings: number;
  total_deductions: number;
  lop_days: number;
  lop_amount: number;
  net_salary: number;
  status: PayrollRunStatus;
  processed_at: string | null;
  processed_by: number | null;
  paid_at: string | null;
  remarks: string | null;
  items: PayrollRunItem[];
  employee?: {
    id: number;
    first_name: string;
    last_name: string;
    full_name?: string;
    employee_code?: string;
    email?: string;
  } | null;
  processed_by_user?: {
    id: number;
    name: string;
    email: string;
  } | null;
  created_at?: string;
  updated_at?: string;
};

export type StorePayrollRunPayload = {
  employee_id: number;
  month: number;
  year: number;
  salary_structure_id?: number | null;
  lop_days?: number | null;
  lop_amount?: number | null;
  remarks?: string | null;
};

export type PayrollRunListResponse = Envelope<PayrollRun[], PayrollPagination>;
export type PayrollRunDetailResponse = Envelope<{ payroll_run: PayrollRun }>;
export type PayrollRunMutationResponse = Envelope<{ payroll_run: PayrollRun }>;

export async function getPayrollRuns(
  token: string,
  params?: {
    page?: number;
    per_page?: number;
    month?: number;
    year?: number;
    employee_id?: number | string;
    status?: PayrollRunStatus;
    company_id?: number | string;
    department_id?: number | string;
  },
): Promise<PayrollRunListResponse> {
  try {
    const sp = new URLSearchParams({
      page: String(params?.page ?? 1),
      per_page: String(params?.per_page ?? 10),
    });
    if (params?.month) sp.set("month", String(params.month));
    if (params?.year) sp.set("year", String(params.year));
    if (params?.employee_id) sp.set("employee_id", String(params.employee_id));
    if (params?.status) sp.set("status", params.status);
    if (params?.company_id !== undefined && String(params.company_id).trim()) {
      sp.set("company_id", String(params.company_id).trim());
    }
    if (params?.department_id !== undefined && String(params.department_id).trim()) {
      sp.set("department_id", String(params.department_id).trim());
    }

    const response = await fetch(`${API_BASE_URL}v1/payroll/runs?${sp.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<Envelope<any, any>>(response);
    if (!response.ok || !payload.success) return fail(payload.message || "Unable to fetch payroll runs.");
    
    const items = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.data?.items)
        ? payload.data.items
        : [];

    return {
      ...payload,
      data: items,
      meta: payload.meta?.pagination ?? payload.meta ?? { current_page: 1, last_page: 1, per_page: 10, total: items.length },
    } as PayrollRunListResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch payroll runs.");
  }
}

export async function createPayrollRun(
  token: string,
  payload: StorePayrollRunPayload,
): Promise<PayrollRunMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/runs`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<
      PayrollRunMutationResponse | Envelope<{ errors?: Record<string, string[]> }, any>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to generate payroll run.", fieldErrors);
    }
    return result as PayrollRunMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to generate payroll run.");
  }
}

export async function getPayrollRunDetail(
  token: string,
  id: number,
): Promise<PayrollRunDetailResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/runs/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<PayrollRunDetailResponse>(response);
    if (!response.ok || !payload.success) return fail(payload.message || "Unable to fetch payroll run details.");
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch payroll run details.");
  }
}

export async function updatePayrollRunStatus(
  token: string,
  id: number,
  status: PayrollRunStatus,
): Promise<PayrollRunMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/runs/${id}/status`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify({ status }),
    });
    const result = await parseResponse<
      PayrollRunMutationResponse | Envelope<{ errors?: Record<string, string[]> }, any>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update payroll status.", fieldErrors);
    }
    return result as PayrollRunMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to update payroll status.");
  }
}

export async function downloadPayslipPdf(token: string, id: number): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}v1/payroll/payslip/${id}/download`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error("Failed to download payslip PDF.");
  return await response.blob();
}

export async function exportPayrollRuns(
  token: string,
  params?: {
    month?: number;
    year?: number;
    employee_id?: number | string;
    status?: PayrollRunStatus;
    company_id?: number | string;
    department_id?: number | string;
  },
): Promise<Blob> {
  const sp = new URLSearchParams();
  if (params?.month) sp.set("month", String(params.month));
  if (params?.year) sp.set("year", String(params.year));
  if (params?.employee_id) sp.set("employee_id", String(params.employee_id));
  if (params?.status) sp.set("status", params.status);
  if (params?.company_id !== undefined && String(params.company_id).trim()) {
    sp.set("company_id", String(params.company_id).trim());
  }
  if (params?.department_id !== undefined && String(params.department_id).trim()) {
    sp.set("department_id", String(params.department_id).trim());
  }

  const response = await fetch(`${API_BASE_URL}v1/payroll/runs/export?${sp.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error("Failed to export payroll runs.");
  return await response.blob();
}

// -------------------------------------------------------------
// PAYROLL WORKSPACE / RUN FLOW / PAYMENT HISTORY
// -------------------------------------------------------------

export type PayrollWorkspaceParams = {
  screen: "summary" | "run" | string;
  month?: number;
  year?: number;
  company_id?: string | number;
  branch_id?: string | number;
  department_id?: string | number;
  designation_id?: string | number;
  employment_type?: string;
  employee_status?: string;
  calculation_mode?: "hour" | "day";
  salary_type?: string;
  payroll_status?: string;
  q?: string;
  page?: number;
  per_page?: number;
};

export type BulkGeneratePayrollPayload = {
  month: number;
  year: number;
  company_id?: number;
  employee_ids?: number[];
  include_overtime?: boolean;
  calculation_mode?: "hour" | "day";
  remarks?: string;
};

export type FinalizePayrollPayload = {
  month: number;
  year: number;
  payroll_run_ids?: number[];
  employee_ids?: number[];
  calculation_mode?: "hour" | "day";
  include_overtime?: boolean;
  include_penalty?: boolean;
};

export type RevertPayrollPayload = {
  month: number;
  year: number;
  payroll_run_ids?: number[];
  employee_ids?: number[];
  reason?: string;
};

export type SavePayrollPaymentLine = {
  payroll_run_id: number;
  paid_amount: number;
  full_payment: boolean;
};

export type SavePayrollPaymentsPayload = {
  month: number;
  year: number;
  payments: SavePayrollPaymentLine[];
};

export type PayrollWorkspaceResponse = Envelope<Record<string, unknown>>;

export async function getPayrollWorkspace(
  token: string,
  params: PayrollWorkspaceParams,
): Promise<PayrollWorkspaceResponse> {
  try {
    const sp = new URLSearchParams({ screen: params.screen });
    if (params.month) sp.set("month", String(params.month));
    if (params.year) sp.set("year", String(params.year));
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
    if (params.salary_type !== undefined && String(params.salary_type).trim() && params.salary_type !== "all") {
      sp.set("salary_type", String(params.salary_type));
    }
    if (params.payroll_status?.trim()) {
      sp.set("payroll_status", params.payroll_status.trim());
    }
    if (params.q?.trim()) {
      sp.set("q", params.q.trim());
    }
    if (params.page) {
      sp.set("page", String(params.page));
    }
    if (params.per_page) {
      sp.set("per_page", String(params.per_page));
    }

    const response = await fetch(`${API_BASE_URL}v1/payroll/workspace?${sp.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<PayrollWorkspaceResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch payroll workspace.");
    }
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch payroll workspace.");
  }
}

export type PayrollRunFlowParams = {
  step: number;
  month: number | string;
  year: number | string;
  /** @deprecated Prefer employee_ids with POST body */
  selected_ids?: string;
  employee_ids?: number[];
  company_id?: string | number;
  branch_id?: string | number;
  department_id?: string | number;
  calculation_mode?: "hour" | "day";
  include_overtime?: boolean;
  include_penalty?: boolean;
  per_page?: number;
};

export type PayrollRunFlowResponse = Envelope<Record<string, unknown>>;

/** Load a payroll wizard step via POST JSON body (no query string). */
export async function postPayrollRunFlow(
  token: string,
  params: PayrollRunFlowParams,
): Promise<PayrollRunFlowResponse> {
  try {
    const body: Record<string, unknown> = {
      step: Number(params.step),
      month: Number(params.month),
      year: Number(params.year),
    };

    if (params.employee_ids?.length) {
      body.employee_ids = params.employee_ids;
    } else if (params.selected_ids?.trim()) {
      body.selected_ids = params.selected_ids.trim();
    }
    if (params.company_id !== undefined && String(params.company_id).trim() && params.company_id !== "all") {
      body.company_id = Number(params.company_id);
    }
    if (params.branch_id !== undefined && String(params.branch_id).trim() && params.branch_id !== "all") {
      body.branch_id = Number(params.branch_id);
    }
    if (
      params.department_id !== undefined &&
      String(params.department_id).trim() &&
      params.department_id !== "all"
    ) {
      body.department_id = Number(params.department_id);
    }
    if (params.calculation_mode) {
      body.calculation_mode = params.calculation_mode;
    }
    if (params.include_overtime !== undefined) {
      body.include_overtime = params.include_overtime;
    }
    if (params.include_penalty !== undefined) {
      body.include_penalty = params.include_penalty;
    }
    if (params.per_page) {
      body.per_page = params.per_page;
    }

    const response = await fetch(`${API_BASE_URL}v1/payroll/run-flow`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = await parseResponse<PayrollRunFlowResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch payroll run flow.");
    }
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch payroll run flow.");
  }
}
export async function bulkGeneratePayrollRuns(
  token: string,
  payload: BulkGeneratePayrollPayload,
): Promise<Envelope<Record<string, unknown>>> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/runs/bulk`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<Envelope<Record<string, unknown>>>(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to generate payroll.", fieldErrors);
    }
    return result;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to generate payroll.");
  }
}

/** Unlock unpaid finalized (processed) payroll runs back to draft. */
export async function revertPayrollRuns(
  token: string,
  payload: RevertPayrollPayload,
): Promise<Envelope<Record<string, unknown>>> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/runs/revert`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<Envelope<Record<string, unknown>>>(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to revert payroll to draft.", fieldErrors);
    }
    return result;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to revert payroll to draft.");
  }
}

export async function finalizePayrollRuns(
  token: string,
  payload: FinalizePayrollPayload,
): Promise<Envelope<Record<string, unknown>>> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/runs/finalize`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<Envelope<Record<string, unknown>>>(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to finalize payroll.", fieldErrors);
    }
    return result;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to finalize payroll.");
  }
}

export async function savePayrollPayments(
  token: string,
  payload: SavePayrollPaymentsPayload,
): Promise<Envelope<Record<string, unknown>>> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/save-payments`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<Envelope<Record<string, unknown>>>(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to save payments.", fieldErrors);
    }
    return result;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to save payments.");
  }
}

export async function updatePayrollRunOtAllowed(
  token: string,
  payrollRunId: number,
  otAllowed: boolean,
): Promise<PayrollRunMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/runs/${payrollRunId}/ot-allowed`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify({ ot_allowed: otAllowed }),
    });
    const result = await parseResponse<
      PayrollRunMutationResponse | Envelope<{ errors?: Record<string, string[]> }, unknown>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update overtime setting.", fieldErrors);
    }
    return result as PayrollRunMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to update overtime setting.");
  }
}

export async function bulkUpdatePayrollRunOtAllowed(
  token: string,
  payload: { month: number; year: number; employee_ids: number[]; ot_allowed: boolean },
): Promise<Envelope<Record<string, unknown>>> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/payroll/runs/ot-allowed`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });
    const result = await parseResponse<Envelope<Record<string, unknown>>>(response);
    if (!response.ok || !result.success) {
      return fail(result.message || "Unable to update overtime settings.");
    }
    return result;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to update overtime settings.");
  }
}

export async function exportPayrollBankFile(
  token: string,
  params: {
    month: number;
    year: number;
    company_id?: string | number;
    branch_id?: string | number;
    department_id?: string | number;
    payroll_run_ids?: number[];
    employee_ids?: number[];
    format?: "csv" | "xlsx";
  },
): Promise<Blob> {
  const sp = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
    format: params.format ?? "csv",
  });
  if (params.company_id !== undefined && String(params.company_id).trim()) {
    sp.set("company_id", String(params.company_id));
  }
  if (params.branch_id !== undefined && String(params.branch_id).trim()) {
    sp.set("branch_id", String(params.branch_id));
  }
  if (params.department_id !== undefined && String(params.department_id).trim()) {
    sp.set("department_id", String(params.department_id));
  }
  if (params.payroll_run_ids?.length) {
    sp.set("payroll_run_ids", params.payroll_run_ids.join(","));
  }
  if (params.employee_ids?.length) {
    sp.set("employee_ids", params.employee_ids.join(","));
  }

  const response = await fetch(`${API_BASE_URL}v1/payroll/runs/bank-export?${sp.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Failed to export bank file.");
  return await response.blob();
}

export async function bulkDownloadPayslips(token: string, payrollRunIds: number[]): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}v1/payroll/payslips/bulk-download`, {
    method: "POST",
    headers: {
      Accept: "application/zip",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-CSRF-TOKEN": "",
    },
    body: JSON.stringify({ payroll_run_ids: payrollRunIds }),
  });
  if (!response.ok) throw new Error("Failed to download payslips.");
  return await response.blob();
}

export async function getPayrollRunFlow(
  token: string,
  params: PayrollRunFlowParams,
): Promise<PayrollRunFlowResponse> {
  return postPayrollRunFlow(token, params);
}

export type AdjustPayrollVerifyPayload = {
  overtime_amount?: number;
  penalty?: number;
};

export async function adjustPayrollRunVerifyAmounts(
  token: string,
  payrollRunId: number,
  payload: AdjustPayrollVerifyPayload,
): Promise<PayrollRunMutationResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}v1/payroll/runs/${payrollRunId}/verify-adjust`,
      {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-CSRF-TOKEN": "",
        },
        body: JSON.stringify(payload),
      },
    );
    const result = await parseResponse<
      PayrollRunMutationResponse | Envelope<{ errors?: Record<string, string[]> }, unknown>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update payroll amounts.", fieldErrors);
    }
    return result as PayrollRunMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to update payroll amounts.");
  }
}

export type RecalculatePayrollRunPayload = {
  calculation_mode?: "hour" | "day";
  include_overtime?: boolean;
  include_penalty?: boolean;
};

/** Re-derive a draft/finalized unpaid run from current attendance (after attendance edits). */
export async function recalculatePayrollRun(
  token: string,
  payrollRunId: number,
  payload: RecalculatePayrollRunPayload = {},
): Promise<PayrollRunMutationResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}v1/payroll/runs/${payrollRunId}/recalculate`,
      {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-CSRF-TOKEN": "",
        },
        body: JSON.stringify(payload),
      },
    );
    const result = await parseResponse<
      PayrollRunMutationResponse | Envelope<{ errors?: Record<string, string[]> }, unknown>
    >(response);
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to recalculate payroll.", fieldErrors);
    }
    return result as PayrollRunMutationResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to recalculate payroll.");
  }
}

export type PaymentHistoryParams = {
  page?: number;
  per_page?: number;
  month?: number;
  year?: number;
  company_id?: string | number;
  branch_id?: string | number;
  department_id?: string | number;
  q?: string;
};

export type PaymentHistoryResponse = Envelope<Record<string, unknown>[], PayrollPagination>;

export async function getPaymentHistory(
  token: string,
  params?: PaymentHistoryParams,
): Promise<PaymentHistoryResponse> {
  try {
    const sp = new URLSearchParams({
      page: String(params?.page ?? 1),
      per_page: String(params?.per_page ?? 10),
    });
    if (params?.month) sp.set("month", String(params.month));
    if (params?.year) sp.set("year", String(params.year));
    if (params?.company_id !== undefined && String(params.company_id).trim() && params.company_id !== "all") {
      sp.set("company_id", String(params.company_id));
    }
    if (params?.branch_id !== undefined && String(params.branch_id).trim() && params.branch_id !== "all") {
      sp.set("branch_id", String(params.branch_id));
    }
    if (params?.department_id !== undefined && String(params.department_id).trim() && params.department_id !== "all") {
      sp.set("department_id", String(params.department_id));
    }
    if (params?.q?.trim()) sp.set("q", params.q.trim());

    const response = await fetch(`${API_BASE_URL}v1/payroll/payment-history?${sp.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });
    const payload = await parseResponse<Envelope<any, any>>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch payment history.");
    }

    const items = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.data?.items)
        ? payload.data.items
        : Array.isArray(payload.data?.payments)
          ? payload.data.payments
          : [];

    return {
      ...payload,
      data: items,
      meta: payload.meta?.pagination ?? payload.meta ?? { current_page: 1, last_page: 1, per_page: 10, total: items.length },
    } as PaymentHistoryResponse;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch payment history.");
  }
}

// -------------------------------------------------------------
// MY SALARY API
// -------------------------------------------------------------

export type DayStatus = string | null;

export type HourBaseDay = {
  date: string;
  day: string;
  day_name?: string;
  status: DayStatus;
  attendance_id?: number | null;
  punch_in?: string | null;
  punch_out?: string | null;
  shift_id?: number | null;
  shift_code?: string | null;
  shift_name?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  working_hours?: number;
  working_hours_formatted?: string;
  ot_minutes?: number;
  leave_type?: string | null;
  leave_category?: string | null;
  holiday_name?: string | null;
  late_status?: string | null;
  late_minutes?: number;
  is_future?: boolean;
  break_count?: number;
  other_count?: number;
  total_break_minutes?: number;
  total_other_minutes?: number;
  total_interval_minutes?: number;
  regular_hours: number;
  hourly_rate: number;
  regular_earning: number;
  overtime_hours: number;
  overtime_rate: number;
  overtime_earning: number;
  daily_gross: number;
  late_penalty: number;
  early_departure_penalty: number;
  daily_penalty: number;
  daily_net: number;
  early_departure_status?: string | null;
};

export type HourBaseSummary = {
  employee_name: string;
  employee_code: string;
  period: string;
  hourly_rate: number;
  overtime_rate: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  gross_earnings: number;
  total_deductions: number;
  late_penalty: number;
  early_departure_penalty: number;
  total_penalty: number;
  net_payable: number;
  days_present: number;
  total_break_count?: number;
  total_break_minutes?: number;
};

export type MySalaryPeriod = {
  month: string;
  month_label: string;
  from_date: string;
  to_date: string;
  total_calendar_days: number;
  elapsed_days: number;
  future_days: number;
};

export type MySalaryAttendanceSummary = {
  total_records: number;
  status_counts: Record<string, number>;
};

export type MySalaryShiftHistory = {
  shift_id: number;
  shift_code: string;
  shift_name: string;
  effective_from: string;
  effective_to: string | null;
};

export type MySalaryData = {
  summary: HourBaseSummary;
  period: MySalaryPeriod;
  shift_history: MySalaryShiftHistory[];
  attendance_summary: MySalaryAttendanceSummary;
  records: HourBaseDay[];
};

export type MySalaryResponse = Envelope<MySalaryData>;

export type GetMySalaryParams = {
  month: number;
  year: number;
  employee_id?: number | string;
};

export async function getMySalary(
  token: string,
  params: GetMySalaryParams,
): Promise<MySalaryResponse> {
  try {
    const sp = new URLSearchParams({
      month: String(params.month),
      year: String(params.year),
    });
    if (params.employee_id !== undefined && String(params.employee_id).trim()) {
      sp.set("employee_id", String(params.employee_id));
    }

    const response = await fetch(`${API_BASE_URL}v1/payroll/my-salary?${sp.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });

    const payload = await parseResponse<MySalaryResponse>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch salary details.");
    }
    return payload;
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch salary details.");
  }
}

export type DownloadMySalaryPayslipParams = {
  month: number;
  year: number;
  employee_id?: number | string;
};

export type DownloadMySalaryPayslipResult = {
  blob: Blob;
  filename: string;
};

export type DownloadMySalaryPayslipError = {
  message: string;
  status: number;
};

export async function downloadMySalaryPayslip(
  token: string,
  params: DownloadMySalaryPayslipParams,
): Promise<DownloadMySalaryPayslipResult> {
  const sp = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
  });
  if (params.employee_id !== undefined && String(params.employee_id).trim()) {
    sp.set("employee_id", String(params.employee_id));
  }

  const response = await fetch(
    `${API_BASE_URL}v1/payroll/my-salary/payslip?${sp.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/pdf",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    let message = "Unable to generate payslip.";
    try {
      const err = (await response.clone().json()) as { message?: string };
      if (err?.message) message = err.message;
    } catch {
      // Non-JSON error body — keep default message.
    }
    const error: DownloadMySalaryPayslipError = {
      message,
      status: response.status,
    };
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename =
    match?.[1] ||
    `payslip_${String(params.year)}_${String(params.month).padStart(2, "0")}.pdf`;

  return { blob, filename };
}

export {
  getRunPayrollMeta,
  getRunPayrollSummary,
  getRunPayrollEmployees,
  getRunPayrollBreakdown,
  buildRunPayrollSearchParams,
} from "./run-payroll";
export type {
  RunPayrollFilterParams,
  RunPayrollEmployeesParams,
  RunPayrollMetaParams,
  RunPayrollBreakdownParams,
  RunPayrollSortBy,
  RunPayrollSortDir,
} from "./run-payroll";

