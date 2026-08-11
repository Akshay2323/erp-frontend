"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatIndianCurrency } from "@/lib/payroll/format-currency";
import type { PayrollStaffRow } from "@/lib/payroll/run-payroll-types";
import { FeedEmployeeAvatar } from "@/components/live-attendance/FeedEmployeeAvatar";

type PaymentLine = {
  payrollRunId: number;
  employeeId: number;
  name: string;
  pending: number;
  fullPayment: boolean;
  paidAmount: string;
};

type RecordPaymentDrawerProps = {
  open: boolean;
  periodLabel?: string;
  rows: PayrollStaffRow[];
  selectedIds: number[];
  saving?: boolean;
  onClose: () => void;
  onSave: (payments: Array<{ payroll_run_id: number; paid_amount: number; full_payment: boolean }>) => void;
};

export const RecordPaymentDrawer = memo(function RecordPaymentDrawer({
  open,
  periodLabel,
  rows,
  selectedIds,
  saving,
  onClose,
  onSave,
}: RecordPaymentDrawerProps) {
  const targetRows = useMemo(
    () => rows.filter((r) => selectedIds.includes(r.employeeId) && r.payrollRunId),
    [rows, selectedIds],
  );

  const [lines, setLines] = useState<PaymentLine[]>([]);

  useEffect(() => {
    if (!open) return;
    setLines(
      targetRows.map((r) => ({
        payrollRunId: r.payrollRunId!,
        employeeId: r.employeeId,
        name: r.fullName,
        pending: r.pending,
        fullPayment: true,
        paidAmount: String(r.pending || 0),
      })),
    );
  }, [open, targetRows]);

  const totalPaid = lines.reduce((s, l) => s + (Number(l.paidAmount) || 0), 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/50 p-5">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
              <X className="h-5 w-5" />
            </Button>
            <h2 className="text-base font-bold">Record Payment</h2>
          </div>
          {periodLabel ? <span className="text-sm text-muted-foreground">{periodLabel}</span> : null}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Select employees with generated payroll to record payments.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 text-xs text-muted-foreground">
                <tr>
                  <th className="pb-3 text-left">Employee</th>
                  <th className="pb-3 text-left">Pending</th>
                  <th className="pb-3 text-center">Full</th>
                  <th className="pb-3 text-left">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {lines.map((line, idx) => (
                  <tr key={line.payrollRunId}>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <FeedEmployeeAvatar className="h-8 w-8" name={line.name} textClassName="text-xs" />
                        <span className="font-medium">{line.name}</span>
                      </div>
                    </td>
                    <td className="py-4 font-medium">{formatIndianCurrency(line.pending)}</td>
                    <td className="py-4 text-center">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={line.fullPayment}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? {
                                    ...l,
                                    fullPayment: checked,
                                    paidAmount: checked ? String(l.pending) : l.paidAmount,
                                  }
                                : l,
                            ),
                          );
                        }}
                      />
                    </td>
                    <td className="py-4">
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-muted-foreground">₹</span>
                        <Input
                          className="pl-7"
                          value={line.paidAmount}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, paidAmount: e.target.value } : l)),
                            )
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 p-6">
          <span className="font-bold">Total paid — {formatIndianCurrency(totalPaid)}</span>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={saving || lines.length === 0}
              onClick={() =>
                onSave(
                  lines.map((l) => ({
                    payroll_run_id: l.payrollRunId,
                    paid_amount: Number(l.paidAmount) || 0,
                    full_payment: l.fullPayment,
                  })),
                )
              }
            >
              {saving ? "Saving…" : "Save Payment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
