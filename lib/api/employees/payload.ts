import type { CreateEmployeePayload, UpdateEmployeeBasicPayload } from "./types";

export const DEFAULT_EMPLOYEE_PASSWORD = "Welcome@123";

/** Send phone as entered (trimmed); do not add country prefix. */
export function normalizeEmployeePhone(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim().replace(/\s/g, "");
  return raw || null;
}

export function buildCreateEmployeePayload(input: {
  company_id: number;
  branch_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  joining_date: string;
  status?: "draft";
  password?: string | null;
}): CreateEmployeePayload {
  return {
    company_id: input.company_id,
    branch_id: input.branch_id,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim(),
    phone: normalizeEmployeePhone(input.phone),
    joining_date: input.joining_date,
    status: "draft",
    password: DEFAULT_EMPLOYEE_PASSWORD,
  };
}

export function buildUpdateEmployeeBasicPayload(input: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  branch_id: number;
  joining_date: string;
  status: "draft" | "active";
  password?: string | null;
}): UpdateEmployeeBasicPayload {
  return {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim(),
    phone: normalizeEmployeePhone(input.phone),
    branch_id: input.branch_id,
    joining_date: input.joining_date,
    status: input.status,
  };
}
