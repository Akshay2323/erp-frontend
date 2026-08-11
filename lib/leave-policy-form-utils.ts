import type {
  CreateLeaveTypePayload,
} from "@/lib/api/leave-policy";

export const DEFAULT_LEAVE_TYPE_FIELDS = {
  days_per_year: 0,
  carry_forward: true,
  status: "active" as const,
};

export const normalizeLeaveTypeCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20) || "LEAVE_TYPE";

export function buildCreateLeaveTypePayload(
  companyId: number,
  name: string,
  code: string,
): CreateLeaveTypePayload {
  return {
    company_id: companyId,
    name: name.trim(),
    code: normalizeLeaveTypeCode(code || name),
    ...DEFAULT_LEAVE_TYPE_FIELDS,
  };
}
