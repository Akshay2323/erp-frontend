import { memo } from "react";
import { Button } from "@/components/ui/button";

type PayrollBulkActionsProps = {
  selectedCount: number;
  onEnableOt: () => void;
  onDisableOt: () => void;
  onGenerate: () => void;
  onFinalize: () => void;
  onRevertToDraft: () => void;
  revertEligibleCount?: number;
  onMarkPaid: () => void;
  disabled?: boolean;
};

export const PayrollBulkActions = memo(function PayrollBulkActions({
  selectedCount,
  onEnableOt,
  onDisableOt,
  onGenerate,
  onFinalize,
  onRevertToDraft,
  revertEligibleCount = 0,
  onMarkPaid,
  disabled,
}: PayrollBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
      <span className="font-medium text-foreground">{selectedCount} employees selected</span>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onEnableOt}>
        Enable OT
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onDisableOt}>
        Disable OT
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onGenerate}>
        Generate Payroll
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onFinalize}>
        Finalize Payroll
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || revertEligibleCount === 0}
        onClick={onRevertToDraft}
      >
        Revert to Draft
        {revertEligibleCount > 0 ? ` (${revertEligibleCount})` : ""}
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onMarkPaid}>
        Mark Paid
      </Button>
    </div>
  );
});
