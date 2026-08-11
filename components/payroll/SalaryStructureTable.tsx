"use client";

import { Eye, Pencil } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useRef } from "react";

import type { EmployeeSalaryStructure } from "@/lib/api/payroll";
import { Button } from "../ui/button";

type SalaryStructureTableProps = {
  structures: EmployeeSalaryStructure[];
  loading: boolean;
  onEdit: (structure: EmployeeSalaryStructure) => void;
  onView: (structure: EmployeeSalaryStructure) => void;
};

export function SalaryStructureTable({
  structures,
  loading,
  onEdit,
  onView,
}: SalaryStructureTableProps) {
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const rowsCount = structures.length;

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
    ? "Loading structures..."
    : structures.length === 0
      ? "No employee salary structures found. Add your first salary structure."
      : null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Basic Salary</th>
              <th className="px-4 py-3 font-medium">Gross Salary</th>
              <th className="px-4 py-3 font-medium">Effective From</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {emptyText ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              structures.map((struct, index) => {
                const emp = struct.employee;
                const empName = emp
                  ? `${emp.employee_code || "N/A"} - ${emp.first_name} ${emp.last_name}`
                  : `ID: ${struct.employee_id}`;

                return (
                  <tr
                    className="border-t border-border focus-visible:bg-muted/30 focus-visible:outline-none"
                    key={struct.id}
                    onKeyDown={(event) => onRowKeyDown(event, index)}
                    ref={(el) => {
                      rowRefs.current[index] = el;
                    }}
                    tabIndex={0}
                  >
                    <td className="px-4 py-3 font-medium">{empName}</td>
                    <td className="px-4 py-3">
                      ₹{Number(struct.basic_salary).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">
                      {struct.gross_salary != null
                        ? `₹${Number(struct.gross_salary).toLocaleString("en-IN")}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {struct.effective_from || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                          struct.status === "active"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {struct.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => onEdit(struct)}
                          size="sm"
                          variant="outline"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          onClick={() => onView(struct)}
                          size="sm"
                          variant="ghost"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
