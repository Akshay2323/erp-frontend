import type { LeavePolicy, LeaveType } from "@/lib/api/leave-policy";

export type LeaveBalanceRow = {
  leave_type_id?: number;
  leave_type?: { id?: number; name?: string; code?: string };
  balance?: number;
  allocated?: number;
  used?: number;
  days_allocated?: number;
  total?: number;
  allow_half_day?: boolean;
  allow_negative_balance?: boolean;
};

export type LeaveTypeEligibility = {
  leave_type_id: number;
  name: string;
  code: string;
  balance: number;
  allow_half_day: boolean;
  allow_negative_balance: boolean;
  is_unpaid_type: boolean;
};

const UNPAID_CODE_PATTERN = /^(UL|UPL|LWP|UNPAID|LOP|LOSS OF PAY)/i;

export function isUnpaidLeaveType(type: Pick<LeaveType, "name" | "code">): boolean {
  const code = type.code?.trim().toUpperCase() ?? "";
  const name = type.name?.trim().toUpperCase() ?? "";
  return (
    UNPAID_CODE_PATTERN.test(code) ||
    name.includes("UNPAID") ||
    name.includes("LOSS OF PAY") ||
    name.includes("LWP")
  );
}

export function normalizeLeaveBalances(raw: unknown): LeaveBalanceRow[] {
  if (Array.isArray(raw)) return raw as LeaveBalanceRow[];
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items as LeaveBalanceRow[];
    if (Array.isArray(record.balances)) return record.balances as LeaveBalanceRow[];
  }
  return [];
}

/** Merge policy rules + balances + leave types for the apply-leave form. */
export function buildLeaveTypeEligibility(
  leaveTypes: LeaveType[],
  policies: LeavePolicy[],
  balances: LeaveBalanceRow[],
): LeaveTypeEligibility[] {
  const eligibleLeaveNames = new Set<string>();

  for (const policy of policies) {
    if (policy.status !== "active") continue;
    for (const def of policy.leave_definitions ?? []) {
      if (def.leave_name) {
        eligibleLeaveNames.add(def.leave_name.trim().toLowerCase());
      }
    }
  }

  const balanceByTypeId = new Map<number, number>();
  for (const row of balances) {
    const typeId = row.leave_type_id ?? row.leave_type?.id;
    if (!typeId) continue;
    const total = Number(row.allocated ?? row.days_allocated ?? row.total ?? 0);
    const balance =
      row.balance !== undefined
        ? Number(row.balance)
        : Math.max(0, total - Number(row.used ?? 0));
    balanceByTypeId.set(typeId, balance);
  }

  return leaveTypes.map((type) => {
    const isEligible =
      eligibleLeaveNames.has(type.name.trim().toLowerCase()) ||
      eligibleLeaveNames.has(type.code.trim().toLowerCase());
    const unpaid = isUnpaidLeaveType(type);
    return {
      leave_type_id: type.id,
      name: type.name,
      code: type.code,
      balance: balanceByTypeId.get(type.id) ?? 0,
      allow_half_day: isEligible,
      allow_negative_balance: unpaid,
      is_unpaid_type: unpaid,
    };
  });
}

export function estimateLeaveDays(
  fromDate: string,
  toDate: string,
  isHalfDay: boolean,
): number {
  if (!fromDate || !toDate) return 0;
  if (isHalfDay) return 0.5;
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  const diff = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}
