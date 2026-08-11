"use client";

import { memo } from "react";
import {
  FileSpreadsheet,
  Lock,
  Save,
  Wallet,
  FileText,
  Building2,
  Send,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type PayrollToolbarProps = {
  selectedCount: number;
  confirmationSentCount?: number;
  confirmationConfirmedCount?: number;
  onGenerate: () => void;
  onSave: () => void;
  onFinalize: () => void;
  onRecordPayment: () => void;
  onDownloadSalarySheet: () => void;
  onDownloadBankFile: () => void;
  onGeneratePayslips: () => void;
  onSendSalaryConfirmation: () => void;
  onViewConfirmationLogs: () => void;
  busy?: boolean;
};

export const PayrollToolbar = memo(function PayrollToolbar({
  selectedCount,
  confirmationSentCount = 0,
  confirmationConfirmedCount = 0,
  onGenerate,
  onSave,
  onFinalize,
  onRecordPayment,
  onDownloadSalarySheet,
  onDownloadBankFile,
  onGeneratePayslips,
  onSendSalaryConfirmation,
  onViewConfirmationLogs,
  busy,
}: PayrollToolbarProps) {
  const needsSelection = selectedCount === 0;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
      <Button size="sm" onClick={onGenerate} disabled={busy}>
        Generate Payroll
      </Button>
      <Button size="sm" variant="outline" onClick={onSave} disabled={busy || needsSelection}>
        <Save className="mr-2 h-4 w-4" />
        Save Payroll
      </Button>
      <Button size="sm" variant="outline" onClick={onFinalize} disabled={busy || needsSelection}>
        <Lock className="mr-2 h-4 w-4" />
        Finalize Payroll
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onSendSalaryConfirmation}
        disabled={busy || needsSelection}
      >
        <Send className="mr-2 h-4 w-4" />
        Send Salary Confirmation
      </Button>
      <Button size="sm" variant="outline" onClick={onRecordPayment} disabled={busy || needsSelection}>
        <Wallet className="mr-2 h-4 w-4" />
        Record Payment
      </Button>
      <Button size="sm" variant="ghost" onClick={onDownloadSalarySheet} disabled={busy}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Download Salary Sheet
      </Button>
      <Button size="sm" variant="ghost" onClick={onDownloadBankFile} disabled={busy || needsSelection}>
        <Building2 className="mr-2 h-4 w-4" />
        Download Bank File
      </Button>
      <Button size="sm" variant="ghost" onClick={onGeneratePayslips} disabled={busy || needsSelection}>
        <FileText className="mr-2 h-4 w-4" />
        Generate Payslips
      </Button>
      <Button size="sm" variant="ghost" onClick={onViewConfirmationLogs} disabled={busy}>
        <History className="mr-2 h-4 w-4" />
        Confirmation Logs
        {confirmationSentCount + confirmationConfirmedCount > 0 ? (
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {confirmationConfirmedCount}/{confirmationSentCount + confirmationConfirmedCount}
          </span>
        ) : null}
      </Button>
      {selectedCount > 0 ? (
        <span className="ml-auto text-xs text-muted-foreground">{selectedCount} selected</span>
      ) : null}
    </div>
  );
});
