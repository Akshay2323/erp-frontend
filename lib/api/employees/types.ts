export type EmployeeApiEnvelope<T> = {
  success?: boolean;
  status?: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type EmployeeApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type EmployeeRecord = {
  id: number;
  tenant_id?: number;
  company_id?: number;
  branch_id?: number;
  department_id?: number | null;
  designation_id?: number | null;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  name?: string;
  email?: string;
  mobile?: string | null;
  phone?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  joining_date?: string;
  status?: "active" | "draft" | string;
  employee_code?: string;
  address?: string | null;
  pan_no?: string | null;
  aadhaar_no?: string | null;
  employment_type?: string | null;
  reporting_manager_id?: number | null;
  company?: { id: number; name: string; code?: string } | null;
  branch?: { id: number; name: string } | null;
  department?: { id: number; name: string } | null;
  designation?: { id: number; name: string } | null;
  reporting_manager?: { id: number; name: string; first_name?: string; last_name?: string; full_name?: string } | null;
  tenant?: { id: number; name: string } | null;
  profile_photo?: EmployeeProfilePhoto | null;
  photo_url?: string | null;
  photo?: string | null;
};

export type CreateEmployeePayload = {
  company_id: number;
  branch_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  joining_date: string;
  status: "draft";
  password?: string;
};

export type UpdateEmployeeBasicPayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  branch_id: number;
  joining_date: string;
  status: "draft" | "active";
  password?: string;
};

export type CreateEmployeeResponse = EmployeeApiEnvelope<EmployeeRecord>;

export type FinalizeEmployeePayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  branch_id: number;
  joining_date: string;
  status: "active";
  password?: string;
};

export type JobDetailsPayload = {
  department_id: number;
  designation_id: number;
  reporting_manager_id?: number | null;
  shift_id?: number | null;
  leave_policy_id?: number | null;
  geolocation_id?: number | null;
  employment_type: "full_time" | "part_time" | "contract";
  /** Months — API field name per backend contract */
  probation_period?: number | null;
  confirmation_date?: string | null;
};

export type JobDetailsRecord = {
  id: number;
  employee_id: number;
  department_id: number;
  designation_id: number;
  reporting_manager_id: number | null;
  shift_id: number | null;
  leave_policy_id: number | null;
  employment_type: "full_time" | "part_time" | "contract";
  probation_period: number | null;
  confirmation_date: string | null;
  department?: { id: number; name: string; code?: string };
  designation?: { id: number; name: string; code?: string };
  reporting_manager?: unknown;
  shift?: { id: number; name: string; shift_code?: string };
  leave_policy?: unknown;
  created_at?: string;
  updated_at?: string;
};

export type PersonalDetailsPayload = {
  date_of_birth: string;
  gender: "male" | "female" | "other";
  nationality: string;
  marital_status: "single" | "married" | "other";
  blood_group: string;
};

export type ContactDetailsPayload = {
  current_address?: string | null;
  permanent_address?: string | null;
  personal_email?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
};

export type SalaryPayload = {
  basic_salary: number;
  hra?: number;
  allowances?: number;
  deductions?: number;
  net_salary: number;
  pf_applicable: boolean;
  esi_applicable: boolean;
  tds_applicable: boolean;
};

export type BankDetailsPayload = {
  bank_name?: string | null;
  account_number: string;
  ifsc_code: string;
  account_holder_name?: string | null;
  account_type: "savings" | "current";
};

export type StatutoryDetailsPayload = {
  pan_number: string;
  aadhaar_number: string;
  uan_number?: string | null;
};

export type LeaveBalancePayload = {
  casual_leave: number;
  sick_leave: number;
  earned_leave: number;
};

export type UploadDocumentPayload = {
  document_type: string;
  file: File;
};

export type EmployeeDocumentRecord = {
  id: number;
  employee_id?: number;
  document_type: string;
  file_path: string;
  document_name: string;
  document_file?: string;
  url?: string;
  preview_url?: string;
  download_url?: string;
  uploaded_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeProfilePhoto = {
  id: number;
  photo_path: string;
  download_url?: string;
  url?: string;
};

export type EmployeeBankDetail = {
  bank_name?: string | null;
  account_holder_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  branch_name?: string | null;
};

export type EmployeeEmergencyContact = {
  name?: string | null;
  phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
};

export type EmployeeDocumentsResponse = EmployeeApiEnvelope<EmployeeDocumentRecord[]>;

export type EmployeeListFilters = {
  q?: string;
  status?: string;
  department_id?: string;
  branch_id?: string;
  company_id?: string;
  page?: number;
  per_page?: number;
};

export type EmployeeListData = {
  items: EmployeeRecord[];
};

export type EmployeeListResponse = EmployeeApiEnvelope<EmployeeListData> & {
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number | null;
    to: number | null;
  };
};

export type EmployeeDetailResponse = EmployeeApiEnvelope<{
  employee: EmployeeRecord;
}>;

export interface EmployeeBirthday {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  mobile: string;
  department: { id: number; name: string } | null;
  designation: { id: number; name: string } | null;
  branch: { id: number; name: string } | null;
  date_of_birth: string;
  birthday_date: string;
  days_until: number;
  is_today: boolean;
  age_turning: number;
}

export interface EmployeeBirthdaysResponse {
  success: boolean;
  message: string;
  data: {
    date: string;
    days: number;
    today: {
      count: number;
      items: EmployeeBirthday[];
    };
    upcoming: {
      count: number;
      items: EmployeeBirthday[];
    };
  };
  meta: Record<string, unknown>;
}
