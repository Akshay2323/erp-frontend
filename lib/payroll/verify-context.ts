export const PAYROLL_VERIFY_CONTEXT_KEY = "payroll_verify_context_v1";

export type PayrollVerifyContext = {
  month: number;
  year: number;
  employeeIds: number[];
  companyId?: string | number;
  branchId?: string | number;
  departmentId?: string | number;
  calculationMode?: "hour" | "day";
  includeOvertime?: boolean;
  includePenalty?: boolean;
  savedAt: number;
};

export function savePayrollVerifyContext(context: Omit<PayrollVerifyContext, "savedAt">): void {
  if (typeof window === "undefined") return;
  const payload: PayrollVerifyContext = {
    ...context,
    savedAt: Date.now(),
  };
  sessionStorage.setItem(PAYROLL_VERIFY_CONTEXT_KEY, JSON.stringify(payload));
}

export function readPayrollVerifyContext(): PayrollVerifyContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PAYROLL_VERIFY_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PayrollVerifyContext;
    if (
      !parsed ||
      typeof parsed.month !== "number" ||
      typeof parsed.year !== "number" ||
      !Array.isArray(parsed.employeeIds)
    ) {
      return null;
    }
    return {
      month: parsed.month,
      year: parsed.year,
      employeeIds: parsed.employeeIds.map(Number).filter((id) => id > 0),
      companyId: parsed.companyId,
      branchId: parsed.branchId,
      departmentId: parsed.departmentId,
      calculationMode:
        parsed.calculationMode === "hour" || parsed.calculationMode === "day"
          ? parsed.calculationMode
          : undefined,
      includeOvertime:
        typeof parsed.includeOvertime === "boolean" ? parsed.includeOvertime : undefined,
      includePenalty:
        typeof parsed.includePenalty === "boolean" ? parsed.includePenalty : undefined,
      savedAt: Number(parsed.savedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearPayrollVerifyContext(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PAYROLL_VERIFY_CONTEXT_KEY);
}
