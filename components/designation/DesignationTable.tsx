"use client";

import { Eye, Pencil } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo, useRef } from "react";

import type { Designation } from "@/lib/api/designation";
import type { Company } from "@/lib/api/company";
import { Button } from "../ui/button";

type DesignationTableProps = {
  designations: Designation[];
  companies: Company[];
  loading: boolean;
  onEdit: (designation: Designation) => void;
  onView: (designation: Designation) => void;
};

export function DesignationTable({
  designations,
  companies,
  loading,
  onEdit,
  onView,
}: DesignationTableProps) {
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const companyMap = useMemo(
    () =>
      new Map<number, string>(
        companies.map((company) => [company.id, company.company_name || "-"]),
      ),
    [companies],
  );
  const rowsCount = designations.length;

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

  const emptyText = loading
    ? "Loading designations..."
    : designations.length === 0
      ? "No designations found. Add your first designation."
      : null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Designation Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Company Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {emptyText ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              designations.map((designation, index) => (
                <tr
                  className="border-t border-border focus-visible:bg-muted/30 focus-visible:outline-none"
                  key={designation.id}
                  onKeyDown={(event) => onRowKeyDown(event, index)}
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3 font-medium">{designation.name}</td>
                  <td className="px-4 py-3">{designation.code || "-"}</td>
                  <td className="px-4 py-3">
                    {designation.company_id
                      ? companyMap.get(designation.company_id) || "-"
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                      {designation.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => onEdit(designation)}
                        size="sm"
                        variant="outline"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => onView(designation)}
                        size="sm"
                        variant="ghost"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
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
