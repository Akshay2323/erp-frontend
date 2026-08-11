import type { EmployeeWizardValues } from "@/lib/validations/employee-wizard";

export function getEmployeeWizardDefaults(): EmployeeWizardValues {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  return {
    status: "draft",
    company_id: 0,
    branch_id: 0,
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    joining_date: "",
    department_id: 0,
    designation_id: 0,
    reporting_manager_id: undefined,
    reporting_manager_label: "",
    shift_id: undefined,
    geolocation_id: undefined,
    employment_type: "full_time",
    probation_period: undefined,
    confirmation_date: "",
    date_of_birth: "",
    gender: "male",
    nationality: "Indian",
    marital_status: "single",
    blood_group: "",
    current_address: "",
    permanent_address: "",
    personal_email: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    basic_salary: 0,
    hra: 0,
    allowances: 0,
    deductions: 0,
    pf_applicable: false,
    esi_applicable: false,
    tds_applicable: false,
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    account_holder_name: "",
    account_type: "savings",
    pan_number: "",
    aadhaar_number: "",
    uan_number: "",
    leave_policy_id: undefined,
    effective_from: "",
    leave_policy_skipped: false,
    leave_policy_label: "",
    documents: [],
    profile_photo: undefined,
  };
}

export const INDIAN_BANKS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "IndusInd Bank",
  "IDFC FIRST Bank",
  "Yes Bank",
  "Federal Bank",
  "RBL Bank",
  "AU Small Finance Bank",
  "Indian Bank",
  "Bank of India",
  "Central Bank of India",
] as const;

export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;
