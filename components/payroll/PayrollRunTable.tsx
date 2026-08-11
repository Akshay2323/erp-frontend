"use client";

import { Eye, Download, CheckCircle, Play } from "lucide-react";
import type { PayrollRun, PayrollRunStatus } from "@/lib/api/payroll";
import { Button } from "../ui/button";

type PayrollRunTableProps = {
  runs: PayrollRun[];
  loading: boolean;
  onView: (run: PayrollRun) => void;
  onUpdateStatus: (id: number, status: PayrollRunStatus) => Promise<void>;
  onDownloadPayslip: (id: number, employeeName: string) => Promise<void>;
  actionLoading?: number | null; // ID of the run currently undergoing action
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
};

export function PayrollRunTable({
  runs,
  loading,
  onView,
  onUpdateStatus,
  onDownloadPayslip,
  actionLoading,
  selectedIds = [],
  onSelectionChange,
}: PayrollRunTableProps) {
  const getStatusBadge = (status: PayrollRunStatus) => {
    switch (status) {
      case "draft":
        return (
          <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2 py-1 text-xs font-semibold text-slate-500 border border-slate-500/20">
            Draft
          </span>
        );
      case "processed":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600 border border-amber-500/20">
            Processed
          </span>
        );
      case "paid":
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
            Paid
          </span>
        );
      default:
        return null;
    }
  };

  const getMonthName = (month: number) => {
    const dates = new Date(2000, month - 1, 1);
    return dates.toLocaleString("default", { month: "long" });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading payroll runs...</p>
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card">
        <p className="text-sm text-muted-foreground">No payroll runs found.</p>
      </div>
    );
  }

  const allSelected = runs.length > 0 && selectedIds.length === runs.length;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <th className="px-6 py-4 w-12">
                <input
                  type="checkbox"
                  className="rounded border-input bg-background text-primary focus:ring-primary h-4 w-4 transition cursor-pointer"
                  checked={allSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSelectionChange?.(runs.map((r) => r.id));
                    } else {
                      onSelectionChange?.([]);
                    }
                  }}
                />
              </th>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Period</th>
              <th className="px-6 py-4">Salary Breakdown</th>
              <th className="px-6 py-4 text-center">LOP (Days / Amt)</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map((run) => {
              const empName = run.employee
                ? `${run.employee.first_name} ${run.employee.last_name}`
                : "Unknown Employee";
              const empCode = run.employee?.employee_code ?? "-";
              const isSelected = selectedIds.includes(run.id);

              return (
                <tr
                  className={`group hover:bg-muted/15 transition-colors ${
                    isSelected ? "bg-primary/5 hover:bg-primary/10" : ""
                  }`}
                  key={run.id}
                >
                  <td className="px-6 py-4 w-12">
                    <input
                      type="checkbox"
                      className="rounded border-input bg-background text-primary focus:ring-primary h-4 w-4 transition cursor-pointer"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onSelectionChange?.([...selectedIds, run.id]);
                        } else {
                          onSelectionChange?.(selectedIds.filter((id) => id !== run.id));
                        }
                      }}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-semibold text-foreground">{empName}</div>
                      <div className="text-xs text-muted-foreground">{empCode}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-foreground">
                    {getMonthName(run.month)} {run.year}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <div>
                        Gross:{" "}
                        <span className="font-medium text-foreground">
                          ₹{Number(run.gross_salary).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        Deductions:{" "}
                        <span className="font-medium text-destructive">
                          ₹{Number(run.total_deductions).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="font-semibold text-primary">
                        Net: ₹{Number(run.net_salary).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {run.lop_days > 0 ? (
                      <div>
                        <span className="font-semibold text-amber-600">{run.lop_days} days</span>
                        <div className="text-xs text-muted-foreground">
                          -₹{Number(run.lop_amount).toLocaleString("en-IN")}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(run.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        onClick={() => onView(run)}
                        size="icon"
                        variant="ghost"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {run.status === "draft" && (
                        <Button
                          onClick={() => onUpdateStatus(run.id, "processed")}
                          disabled={actionLoading === run.id}
                          size="sm"
                          variant="outline"
                          className="gap-1 border-amber-500/30 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                        >
                          <Play className="h-3 w-3" />
                          Process
                        </Button>
                      )}

                      {run.status === "processed" && (
                        <Button
                          onClick={() => onUpdateStatus(run.id, "paid")}
                          disabled={actionLoading === run.id}
                          size="sm"
                          variant="outline"
                          className="gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Mark Paid
                        </Button>
                      )}

                      {run.status !== "draft" && (
                        <Button
                          onClick={() => onDownloadPayslip(run.id, empName)}
                          size="icon"
                          variant="ghost"
                          title="Download payslip PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
