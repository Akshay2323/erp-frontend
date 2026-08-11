"use client";

import { Eye, Pencil } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo, useRef } from "react";

import type { Company } from "@/lib/api/company";
import type { LeavePolicy } from "@/lib/api/leave-policy";
import { Button } from "../ui/button";

type LeavePolicyTableProps = {
  policies: LeavePolicy[];
  companies: Company[];
  loading: boolean;
  onView: (policy: LeavePolicy) => void;
  onEdit: (policy: LeavePolicy) => void;
};

export function LeavePolicyTable({
  policies,
  companies,
  loading,
  onView,
  onEdit,
}: LeavePolicyTableProps) {
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const rowsCount = policies.length;

  const companyMap = useMemo(
    () => new Map<number, string>(companies.map((c) => [c.id, c.company_name || "-"])),
    [companies],
  );

  const emptyMessage = loading
    ? "Loading leave policies..."
    : policies.length === 0
      ? "No leave policies found."
      : null;

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      rowRefs.current[Math.min(index + 1, rowsCount - 1)]?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      rowRefs.current[Math.max(index - 1, 0)]?.focus();
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Policy Name</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Rules Summary</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {emptyMessage ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              policies.map((policy, index) => (
                <tr
                  className="border-t border-border focus-visible:bg-muted/30 focus-visible:outline-none"
                  key={policy.id}
                  onKeyDown={(event) => onRowKeyDown(event, index)}
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3 font-medium">{policy.name}</td>
                  <td className="px-4 py-3">{policy.description || "-"}</td>
                  <td className="px-4 py-3">
                    {companyMap.get(policy.company_id) ?? String(policy.company_id)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                      {policy.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{policy.leave_definitions?.length ?? 0} Leave Types Configured</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button onClick={() => onView(policy)} size="sm" variant="ghost">
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button onClick={() => onEdit(policy)} size="sm" variant="outline">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
