import { getEmployeeProfilePhotoProxyUrl } from "@/lib/api/employees/http";
import { formatIndianCurrency } from "@/lib/payroll/format-currency";
import type {
  PayrollDisplayStatus,
  PayrollRowPermissions,
  PayrollSalaryBreakdown,
  PayrollStaffRow,
  PayrollSummaryStats,
} from "./run-payroll-types";

function mapApiStatus(status: string | undefined | null): PayrollDisplayStatus {
  switch (status) {
    case "draft":
      return "generated";
    case "processed":
      return "finalized";
    case "paid":
      return "paid";
    case "hold":
      return "hold";
    case "not_generated":
    default:
      return "pending";
  }
}

function mapPermissions(raw: Record<string, unknown> | undefined): PayrollRowPermissions {
  const p = raw ?? {};
  return {
    canGenerate: Boolean(p.can_generate),
    canFinalize: Boolean(p.can_finalize),
    canRecordPayment: Boolean(p.can_record_payment),
    canToggleOt: Boolean(p.can_toggle_ot),
    canHold: Boolean(p.can_hold),
    canExpandBreakdown: p.can_expand_breakdown !== false,
  };
}

function mapSalaryBreakdownFields(structured: Record<string, unknown>): PayrollSalaryBreakdown {
  const mode = structured.hourly_rate != null ? "hour" : structured.daily_rate != null ? "day" : undefined;

  return {
    calculationMode: mode,
    basicSalary: Number(structured.basic_salary ?? 0),
    allowances: Number(structured.allowances ?? 0),
    hra: Number(structured.hra ?? 0),
    specialAllowance: Number(structured.special_allowance ?? 0),
    bonus: Number(structured.bonus ?? 0),
    otAmount: Number(structured.ot_amount ?? 0),
    hourlyRate: structured.hourly_rate != null ? Number(structured.hourly_rate) : undefined,
    monthlyExpectedHours:
      structured.monthly_expected_hours != null ? Number(structured.monthly_expected_hours) : undefined,
    regularHoursEarning:
      structured.regular_hours_earning != null ? Number(structured.regular_hours_earning) : undefined,
    dailyRate: structured.daily_rate != null ? Number(structured.daily_rate) : undefined,
    payableDays: structured.payable_days != null ? Number(structured.payable_days) : undefined,
    latePenalty: Number(structured.late_penalty ?? 0),
    halfDayPenalty: Number(structured.half_day_penalty ?? 0),
    lopDays: structured.lop_days != null ? Number(structured.lop_days) : undefined,
    lopAmount: structured.lop_amount != null ? Number(structured.lop_amount) : undefined,
    loanDeduction: Number(structured.loan_deduction ?? 0),
    advanceDeduction: Number(structured.advance_deduction ?? 0),
    pf: Number(structured.pf ?? 0),
    esi: Number(structured.esi ?? 0),
    professionalTax: Number(structured.professional_tax ?? 0),
    manualDeduction: Number(structured.manual_deduction ?? 0),
    netSalary: Number(structured.net_salary ?? 0),
  };
}

export function formatRowCtc(row: PayrollStaffRow): string {
  if (row.ctcDisplay) {
    return row.ctcDisplay;
  }

  if (row.ctcType === "hourly") {
    return `${formatIndianCurrency(row.ctcAmount)} /hour`;
  }

  return `${formatIndianCurrency(row.ctcAmount)} /month`;
}

/** @deprecated Use mapEmployeeToPayrollRow */
export const mapStaffToPayrollRow = mapEmployeeToPayrollRow;

export function mapEmployeeToPayrollRow(employee: Record<string, unknown>): PayrollStaffRow {
  const employeeId = Number(employee.employee_id);
  const ctc = (employee.ctc as Record<string, unknown>) ?? {};
  const attendance = (employee.attendance as Record<string, unknown>) ?? {};
  const amounts = (employee.amounts as Record<string, unknown>) ?? {};
  const profilePhoto = employee.profile_photo as Record<string, unknown> | null | undefined;
  const ctcType = String(ctc.type ?? "monthly");
  const ctcAmount = Number(ctc.amount ?? 0);
  const ctcUnit = String(ctc.unit ?? "");
  const ctcDisplay = String(ctc.display ?? "");
  const attendanceMode =
    attendance.calculation_mode === "hour" || attendance.calculation_mode === "day"
      ? (attendance.calculation_mode as "hour" | "day")
      : ctcType === "hourly"
        ? "hour"
        : "day";

  const actualMonthlySalary = Number(amounts.actual_monthly_salary ?? 0);
  const grossSalary = Number(amounts.gross_salary ?? 0);
  const overtimeAmount = Number(amounts.overtime_amount ?? 0);
  const deduction = Number(amounts.total_deductions ?? 0);
  const penalty = Number(amounts.penalty ?? 0);
  const netPayable = Number(amounts.net_payable ?? 0);
  const paid = Number(amounts.paid_amount ?? 0);
  const pending = Number(amounts.pending_amount ?? 0);

  return {
    employeeId,
    employeeCode: String(employee.employee_code ?? ""),
    fullName: String(employee.full_name ?? "—"),
    role: String(employee.job_title ?? "—"),
    department: String(employee.department ?? "—"),
    branch: String(employee.branch ?? "—"),
    payrollRunId: employee.payroll_run_id != null ? Number(employee.payroll_run_id) : null,
    payrollStatus: mapApiStatus(String(employee.payroll_status ?? "not_generated")),
    apiPayrollStatus: String(employee.payroll_status ?? "not_generated"),
    otAllowed: employee.ot_allowed !== undefined ? Boolean(employee.ot_allowed) : true,
    attendanceCalculationMode: attendanceMode,
    totalHours: Number(attendance.total_hours ?? 0),
    workedHours: Number(attendance.worked_hours ?? 0),
    otHours: Number(attendance.ot_hours ?? amounts.overtime_hours ?? 0),
    workingDays: Number(attendance.working_days ?? 0),
    presentDays: Number(attendance.present_days ?? 0),
    otDays: Number(attendance.ot_days ?? 0),
    breakCount: Number(
      attendance.total_break_count ?? attendance.break_count ?? 0,
    ),
    breakMinutes: Number(attendance.total_break_minutes ?? 0),
    actualMonthlySalary,
    grossSalary,
    overtimeAmount,
    penalty,
    deduction,
    netPayable,
    paid,
    pending,
    hasSalaryStructure: Boolean(employee.has_salary_structure),
    ctcType,
    ctcAmount,
    ctcUnit,
    ctcDisplay,
    profilePhotoUrl: profilePhoto?.download_url
      ? getEmployeeProfilePhotoProxyUrl(employeeId)
      : null,
    permissions: mapPermissions(employee.permissions as Record<string, unknown> | undefined),
    raw: employee,
  };
}

export function mapApiSummaryStats(raw: Record<string, unknown> | undefined | null): PayrollSummaryStats {
  if (!raw) {
    return {
      employees: 0,
      generated: 0,
      pending: 0,
      grossSalary: 0,
      totalOt: 0,
      totalDeduction: 0,
      netPayable: 0,
    };
  }

  return {
    employees: Number(raw.employees ?? 0),
    generated: Number(raw.generated ?? 0),
    pending: Number(raw.pending ?? 0),
    grossSalary: Number(raw.gross_salary ?? 0),
    totalOt: Number(raw.total_ot ?? 0),
    totalDeduction: Number(raw.total_deduction ?? 0),
    netPayable: Number(raw.net_payable ?? 0),
  };
}

export function mapBreakdownResponse(data: Record<string, unknown>): PayrollSalaryBreakdown | null {
  const structured =
    (data.salary_breakdown as Record<string, unknown> | null | undefined) ??
    (data.estimated_breakdown as Record<string, unknown> | null | undefined);

  if (!structured || typeof structured !== "object") {
    return null;
  }

  return mapSalaryBreakdownFields(structured);
}

/** @deprecated Prefer mapBreakdownResponse for run-payroll breakdown endpoint */
export function mapPayrollRunToBreakdown(run: Record<string, unknown>): PayrollSalaryBreakdown {
  const structured = run.salary_breakdown as Record<string, unknown> | undefined;
  if (structured) {
    return mapSalaryBreakdownFields(structured);
  }

  return mapSalaryBreakdownFields({
    basic_salary: run.gross_salary,
    ot_amount: run.overtime_amount,
    net_salary: run.net_salary,
  });
}
