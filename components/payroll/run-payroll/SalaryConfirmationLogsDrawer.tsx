"use client";

import { useEffect } from "react";
import { CheckCircle2, History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatIndianCurrency } from "@/lib/payroll/format-currency";
import type { SalaryConfirmationLog } from "@/lib/payroll/salary-confirmation-store";
import { SalaryConfirmationBadge } from "./SalaryConfirmationBadge";

type SalaryConfirmationLogsDrawerProps = {
  open: boolean;
  periodLabel: string;
  logs: SalaryConfirmationLog[];
  onClose: () => void;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SalaryConfirmationLogsDrawer({
  open,
  periodLabel,
  logs,
  onClose,
}: SalaryConfirmationLogsDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Close confirmation logs"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="salary-confirmation-logs-title"
        className="relative flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-foreground" />
              <h2 id="salary-confirmation-logs-title" className="text-base font-semibold text-foreground">
                Confirmation logs
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{periodLabel}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No confirmation activity for this period yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-xl border border-border bg-muted/20 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {log.employeeName}
                        {log.employeeCode ? (
                          <span className="ml-1 font-normal text-muted-foreground">
                            · {log.employeeCode}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{log.message}</p>
                    </div>
                    <SalaryConfirmationBadge
                      status={log.action === "confirmed" ? "confirmed" : "sent"}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {log.action === "confirmed" ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      ) : null}
                      {formatWhen(log.at)}
                    </span>
                    <span>by {log.actor}</span>
                    <span className="tabular-nums">{formatIndianCurrency(log.netPayable)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
