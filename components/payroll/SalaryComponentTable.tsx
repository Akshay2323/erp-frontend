"use client";

import { Eye, Pencil } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo, useRef } from "react";

import type { SalaryComponent } from "@/lib/api/payroll";
import type { Company } from "@/lib/api/company";
import { Button } from "../ui/button";

type SalaryComponentTableProps = {
  components: SalaryComponent[];
  companies: Company[];
  loading: boolean;
  onEdit: (component: SalaryComponent) => void;
  onView: (component: SalaryComponent) => void;
};

export function SalaryComponentTable({
  components,
  companies,
  loading,
  onEdit,
  onView,
}: SalaryComponentTableProps) {
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const companyMap = useMemo(
    () =>
      new Map<number, string>(
        companies.map((company) => [company.id, company.company_name || "-"]),
      ),
    [companies],
  );
  const rowsCount = components.length;

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
    ? "Loading components..."
    : components.length === 0
      ? "No salary components found. Add your first component."
      : null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Component Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Default Amount</th>
              <th className="px-4 py-3 font-medium">Company Name</th>
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
              components.map((component, index) => (
                <tr
                  className="border-t border-border focus-visible:bg-muted/30 focus-visible:outline-none"
                  key={component.id}
                  onKeyDown={(event) => onRowKeyDown(event, index)}
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3 font-medium">{component.name}</td>
                  <td className="px-4 py-3 font-mono">{component.code}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        component.type === "earning"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {component.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {component.default_amount != null
                      ? `₹${Number(component.default_amount).toLocaleString("en-IN")}`
                      : "₹0"}
                  </td>
                  <td className="px-4 py-3">
                    {component.company_id
                      ? companyMap.get(component.company_id) || "-"
                      : "All Companies"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                        component.status === "active"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {component.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => onEdit(component)}
                        size="sm"
                        variant="outline"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => onView(component)}
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
