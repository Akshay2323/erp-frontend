import { z } from "zod";

const optionalPositiveId = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}, z.number().positive().optional());

const requiredSelectId = (message: string) =>
  z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return NaN;
    const n = Number(val);
    return Number.isFinite(n) ? n : NaN;
  }, z.number().positive(message));

const moneyOptional = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}, z.number().min(0));

const requiredEmail = z
  .string()
  .trim()
  .min(1, "Work email is required")
  .email("Enter a valid email address");

const requiredPhone = z
  .string()
  .trim()
  .min(1, "Phone is required")
  .regex(/^\d{10}$/, "Phone must be exactly 10 digits");

/** Step 1 — Basic information */
export const step1Schema = z.object({
  company_id: requiredSelectId("Select a company"),
  branch_id: requiredSelectId("Select a branch"),
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  email: requiredEmail,
  phone: requiredPhone,
  joining_date: z.string().min(1, "Joining date is required"),
  status: z.literal("draft"),
});

/** Step 2 — Job details */
export const step2Schema = z.object({
  department_id: requiredSelectId("Select a department"),
  designation_id: requiredSelectId("Select a designation"),
  reporting_manager_id: optionalPositiveId,
  shift_id: optionalPositiveId,
  geolocation_id: optionalPositiveId,
  employment_type: z.enum(["full_time", "part_time", "contract"], {
    message: "Select employment type",
  }),
  probation_period: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().min(0, "Must be 0 or more").optional()),
  confirmation_date: z.string().optional(),
  reporting_manager_label: z.string().optional(),
});

/** Step 3 — Personal */
export const step3Schema = z.object({
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  nationality: z.string().trim().min(1, "Nationality is required"),
  marital_status: z.enum(["single", "married", "other"]),
  blood_group: z.string().optional(),
});

/** Step 4 — Contact */
export const step4Schema = z.object({
  current_address: z.string().optional(),
  permanent_address: z.string().optional(),
  personal_email: z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? "")
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Invalid email"),
  emergency_contact_name: z.string().trim().min(1, "Emergency contact name is required"),
  emergency_contact_phone: z
    .string()
    .trim()
    .min(1, "Emergency contact phone is required")
    .regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
});

/** Step 5 — Salary */
export const step5Schema = z.object({
  basic_salary: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return NaN;
    return Number(val);
  }, z.number().refine((n) => Number.isFinite(n) && n > 0, "Basic salary is required")),
  hra: moneyOptional,
  allowances: moneyOptional,
  deductions: moneyOptional,
  pf_applicable: z.boolean(),
  esi_applicable: z.boolean(),
  tds_applicable: z.boolean(),
});

/** Step 6 — Bank */
export const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const step6Schema = z.object({
  bank_name: z.string().optional(),
  account_number: z
    .string()
    .trim()
    .min(1, "Account number is required")
    .regex(/^\d+$/, "Account number must contain digits only"),
  ifsc_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(ifscRegex, "Invalid IFSC format (e.g. SBIN0001234)"),
  account_holder_name: z.string().optional(),
  account_type: z.enum(["savings", "current"]),
});

/** Step 7 — Statutory */
export const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const step7Schema = z.object({
  pan_number: z
    .string()
    .optional()
    .transform((v) => v?.trim().toUpperCase() ?? "")
    .refine((v) => v === "" || panRegex.test(v), "Invalid PAN (format ABCDE1234F)"),
  aadhaar_number: z
    .string()
    .trim()
    .min(1, "Aadhaar number is required")
    .regex(/^\d{12}$/, "Aadhaar must be 12 digits"),
  uan_number: z
    .string()
    .optional()
    .transform((v) => v?.trim() ?? "")
    .refine((v) => v === "" || /^\d+$/.test(v), "UAN must contain digits only"),
});

const optionalLeavePolicyId = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined || val === 0) return undefined;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}, z.number().positive().optional());

/** Step 8 — Leave policy (optional; assign via admin API or skip) */
const step8BaseSchema = z.object({
  leave_policy_id: optionalLeavePolicyId,
  effective_from: z.string().optional(),
  leave_policy_skipped: z.boolean().optional(),
  leave_policy_label: z.string().optional(),
});

const step8Refinement = (
  data: z.infer<typeof step8BaseSchema>,
  ctx: z.RefinementCtx,
) => {
  if (data.leave_policy_skipped) return;
  const hasPolicy = data.leave_policy_id != null && data.leave_policy_id > 0;
  if (!hasPolicy) return;
  if (!data.effective_from?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Effective from date is required when a policy is selected",
      path: ["effective_from"],
    });
  }
};

export const step8Schema = step8BaseSchema.superRefine(step8Refinement);

/** Step 9 — document row */
export const documentRowSchema = z.object({
  document_type: z.string().trim(),
  file: z.custom<File | undefined>((val) => val === undefined || val instanceof File),
});

const step9BaseSchema = z.object({
  documents: z.array(documentRowSchema),
});

const step9Refinement = (
  data: z.infer<typeof step9BaseSchema>,
  ctx: z.RefinementCtx,
) => {
  data.documents.forEach((row, index) => {
    const hasType = row.document_type.length > 0;
    const hasFile = row.file instanceof File;
    if (hasType !== hasFile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: hasType ? "Attach a file for this row" : "Enter document type or remove the row",
        path: ["documents", index, hasType ? "file" : "document_type"],
      });
    }
  });
};

export const step9Schema = step9BaseSchema.superRefine(step9Refinement);

/** Step 10 — Photo optional file */
export const step10Schema = z.object({
  profile_photo: z.custom<File | undefined>(
    (val) => val === undefined || val instanceof File,
  ),
});

export const employeeWizardFullSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)
  .merge(step6Schema)
  .merge(step7Schema)
  .merge(step8BaseSchema)
  .merge(step9BaseSchema)
  .merge(step10Schema)
  .superRefine(step8Refinement)
  .superRefine(step9Refinement);

export type EmployeeWizardValues = z.infer<typeof employeeWizardFullSchema>;

export const STEP_LABELS = [
  "Basic information",
  "Job details",
  "Personal details",
  "Contact details",
  "Bank details",
  "Statutory details",
  "Leave policy",
  "Documents",
  "Profile photo",
  "Review & activate",
] as const;

export const TOTAL_STEPS = STEP_LABELS.length;
