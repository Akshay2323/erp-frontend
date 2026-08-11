"use client";

import { X, Calendar, User, FileText, CheckCircle2 } from "lucide-react";
import type { PayrollRun } from "@/lib/api/payroll";
import { Button } from "../ui/button";

type PayrollRunDetailsModalProps = {
  open: boolean;
  run: PayrollRun | null;
  onClose: () => void;
};

export function PayrollRunDetailsModal({ open, run, onClose }: PayrollRunDetailsModalProps) {
  if (!open || !run) return null;

  const empName = run.employee
    ? `${run.employee.first_name} ${run.employee.last_name}`
    : "Unknown Employee";
  const empCode = run.employee?.employee_code ?? "-";
  const empEmail = run.employee?.email ?? "-";

  const getMonthName = (month: number) => {
    const dates = new Date(2000, month - 1, 1);
    return dates.toLocaleString("default", { month: "long" });
  };

  const earnings = run.items.filter((item) => item.type === "earning");
  const deductions = run.items.filter((item) => item.type === "deduction");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div
        aria-modal="true"
        role="dialog"
        className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Payroll Details
            </h2>
          </div>
          <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Employee & Period Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border bg-muted/20 flex gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{empName}</h3>
                <p className="text-xs text-muted-foreground">Code: {empCode}</p>
                <p className="text-xs text-muted-foreground">{empEmail}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/20 flex gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  {getMonthName(run.month)} {run.year}
                </h3>
                <p className="text-xs text-muted-foreground">Status: <span className="capitalize font-semibold text-primary">{run.status}</span></p>
                {run.remarks && (
                  <p className="text-xs text-muted-foreground mt-1 italic">"{run.remarks}"</p>
                )}
              </div>
            </div>
          </div>

          {/* Breakdown Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings */}
            <div className="space-y-3">
              <h4 className="font-semibold text-emerald-600 text-sm border-b border-border pb-1">
                Earnings (+)
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                  <span>Component</span>
                  <span className="text-right">Amount</span>
                </div>
                {earnings.map((item) => (
                  <div className="flex justify-between text-sm" key={item.id}>
                    <span className="text-foreground">
                      {item.component_name}{" "}
                      {item.component_code ? `(${item.component_code})` : ""}
                    </span>
                    <span className="font-semibold text-foreground">
                      ₹{Number(item.amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
                {earnings.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No extra earnings.</p>
                )}
              </div>
            </div>

            {/* Deductions */}
            <div className="space-y-3">
              <h4 className="font-semibold text-orange-600 text-sm border-b border-border pb-1">
                Deductions (-)
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                  <span>Component</span>
                  <span className="text-right">Amount</span>
                </div>
                {deductions.map((item) => (
                  <div className="flex justify-between text-sm" key={item.id}>
                    <span className="text-foreground">
                      {item.component_name}{" "}
                      {item.component_code ? `(${item.component_code})` : ""}
                    </span>
                    <span className="font-semibold text-foreground">
                      ₹{Number(item.amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}

                {run.lop_days > 0 && (
                  <div className="flex justify-between text-sm border-t border-dashed border-border pt-1">
                    <span className="text-foreground font-medium">
                      LOP Deduction ({run.lop_days} Days)
                    </span>
                    <span className="font-semibold text-destructive">
                      ₹{Number(run.lop_amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}

                {deductions.length === 0 && run.lop_days === 0 && (
                  <p className="text-xs text-muted-foreground italic">No deductions.</p>
                )}
              </div>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="p-4 rounded-xl border border-border bg-muted/40 grid grid-cols-3 text-center gap-4">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase">Gross Salary</div>
              <div className="text-lg font-semibold text-foreground mt-0.5">
                ₹{Number(run.gross_salary).toLocaleString("en-IN")}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase">Total Deductions</div>
              <div className="text-lg font-semibold text-destructive mt-0.5">
                ₹{Number(run.total_deductions).toLocaleString("en-IN")}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase">Net Salary</div>
              <div className="text-xl font-bold text-primary mt-0.5">
                ₹{Number(run.net_salary).toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
            {run.processed_at && (
              <div className="flex justify-between">
                <span>Processed At:</span>
                <span className="font-medium text-foreground">
                  {new Date(run.processed_at).toLocaleString()}
                </span>
              </div>
            )}
            {run.processed_by_user && (
              <div className="flex justify-between">
                <span>Processed By:</span>
                <span className="font-medium text-foreground">
                  {run.processed_by_user.name} ({run.processed_by_user.email})
                </span>
              </div>
            )}
            {run.paid_at && (
              <div className="flex justify-between">
                <span>Paid At:</span>
                <span className="font-medium text-foreground">
                  {new Date(run.paid_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border p-4 bg-muted/10">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
