"use client";

import { useEffect } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmSalaryModalProps = {
  open: boolean;
  employeeName: string;
  periodLabel: string;
  netPayableLabel: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmSalaryModal({
  open,
  employeeName,
  periodLabel,
  netPayableLabel,
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmSalaryModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirming) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirming, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        aria-label="Close"
        disabled={confirming}
        onClick={() => (!confirming ? onCancel() : undefined)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-salary-title"
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h2 id="confirm-salary-title" className="text-lg font-semibold text-foreground">
                Confirm this salary
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Please review your net payable for {periodLabel} before confirming.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={confirming}
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-muted/30 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Employee
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{employeeName}</p>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Net payable
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{netPayableLabel}</p>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          By confirming, you acknowledge that this salary amount is correct for the selected period.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={confirming} onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={confirming} onClick={onConfirm} className="gap-2">
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {confirming ? "Confirming…" : "I confirm this salary"}
          </Button>
        </div>
      </div>
    </div>
  );
}
