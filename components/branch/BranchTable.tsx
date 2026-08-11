"use client";

import { Pencil } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo, useRef } from "react";

import type { Branch } from "@/lib/api/branch";
import type { Company } from "@/lib/api/company";
import { Button } from "../ui/button";

type BranchTableProps = {
  branches: Branch[];
  companies: Company[];
  loading: boolean;
  onEdit: (branch: Branch) => void;
};

export function BranchTable({ branches, companies, loading, onEdit }: BranchTableProps) {
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const companyMap = useMemo(
    () =>
      new Map<number, string>(
        companies.map((company) => [company.id, company.company_name || "-"]),
      ),
    [companies],
  );

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      rowRefs.current[Math.min(index + 1, branches.length - 1)]?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      rowRefs.current[Math.max(index - 1, 0)]?.focus();
    }
  };

  const emptyText = loading
    ? "Loading branches..."
    : branches.length === 0
      ? "No branches found."
      : null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Branch Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Company Name</th>
              <th className="px-4 py-3 font-medium">City / State</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {emptyText ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              branches.map((branch, index) => (
                <tr
                  className="border-t border-border focus-visible:bg-muted/30 focus-visible:outline-none"
                  key={branch.id}
                  onKeyDown={(event) => onRowKeyDown(event, index)}
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3 font-medium">{branch.name}</td>
                  <td className="px-4 py-3">{branch.code || "-"}</td>
                  <td className="px-4 py-3">
                    {branch.company_id ? companyMap.get(branch.company_id) || "-" : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {branch.city || "-"} / {branch.state || "-"}
                  </td>
                  <td className="px-4 py-3">{branch.phone || "-"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                      {branch.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button onClick={() => onEdit(branch)} size="sm" variant="outline">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
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
