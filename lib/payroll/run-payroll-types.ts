export type SalaryCalculationMode = "hour" | "day";

export type PayrollDisplayStatus = "draft" | "generated" | "finalized" | "paid" | "hold" | "pending";

export type PayrollRowPermissions = {
  canGenerate: boolean;
  canFinalize: boolean;
  canRecordPayment: boolean;
  canToggleOt: boolean;
  canHold: boolean;
  canRevert: boolean;
  canExpandBreakdown: boolean;
};

export type RunPayrollSortBy = "full_name" | "employee_code" | "net_payable" | "payroll_status";
export type RunPayrollSortDir = "asc" | "desc";

export type RunPayrollTableParams = {
  page: number;
  perPage: number;
  sortBy: RunPayrollSortBy;
  sortDir: RunPayrollSortDir;
};

export type PayrollStaffRow = {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  role: string;
  department: string;
  branch: string;
  payrollRunId: number | null;
  payrollStatus: PayrollDisplayStatus;
  apiPayrollStatus: string;
  otAllowed: boolean;
  attendanceCalculationMode: SalaryCalculationMode;
  totalHours: number;
  workedHours: number;
  otHours: number;
  workingDays: number;
  presentDays: number;
  otDays: number;
  /** Month total break intervals when API provides attendance.total_break_count. */
  breakCount: number;
  /** Total break duration in minutes for the month. */
  breakMinutes: number;
  actualMonthlySalary: number;
  grossSalary: number;
  overtimeAmount: number;
  penalty: number;
  deduction: number;
  netPayable: number;
  paid: number;
  pending: number;
  hasSalaryStructure: boolean;
  ctcType: string;
  ctcAmount: number;
  ctcUnit: string;
  ctcDisplay: string;
  profilePhotoUrl: string | null;
  permissions: PayrollRowPermissions;
  raw: Record<string, unknown>;
};

export type PayrollSummaryStats = {
  employees: number;
  generated: number;
  pending: number;
  grossSalary: number;
  totalOt: number;
  totalDeduction: number;
  netPayable: number;
};

export type PayrollSalaryBreakdown = {
  calculationMode?: SalaryCalculationMode;
  basicSalary: number;
  allowances: number;
  hra: number;
  specialAllowance: number;
  bonus: number;
  otAmount: number;
  hourlyRate?: number;
  monthlyExpectedHours?: number;
  regularHoursEarning?: number;
  dailyRate?: number;
  payableDays?: number;
  latePenalty: number;
  halfDayPenalty: number;
  lopDays?: number;
  lopAmount?: number;
  loanDeduction: number;
  advanceDeduction: number;
  pf: number;
  esi: number;
  professionalTax: number;
  manualDeduction: number;
  netSalary: number;
};

export type RunPayrollFilterState = {
  month: number;
  year: number;
  calculationMode: SalaryCalculationMode;
  includeOvertime: boolean;
  includePenalty: boolean;
  companyId: string;
  branchId: string;
  departmentId: string;
  designationId: string;
  employmentType: string;
  employeeStatus: string;
  searchQuery: string;
  showPendingOnly: boolean;
};
