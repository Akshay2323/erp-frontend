import type { RunPayrollFilterParams } from "@/lib/api/run-payroll";
import type { RunPayrollFilterState } from "./run-payroll-types";

export function toRunPayrollApiFilters(
  filters: RunPayrollFilterState,
  debouncedSearch: string,
): RunPayrollFilterParams {
  return {
    month: filters.month,
    year: filters.year,
    company_id: filters.companyId,
    branch_id: filters.branchId,
    department_id: filters.departmentId,
    designation_id: filters.designationId,
    employment_type: filters.employmentType,
    employee_status: filters.employeeStatus,
    calculation_mode: filters.calculationMode,
    include_overtime: filters.includeOvertime,
    include_penalty: filters.includePenalty,
    payroll_status: filters.showPendingOnly ? "not_generated" : undefined,
    q: debouncedSearch || undefined,
  };
}
