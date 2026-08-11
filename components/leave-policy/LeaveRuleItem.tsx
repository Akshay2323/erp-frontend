"use client";

import type { FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export type LeaveRuleFormValue = {
  leave_name: string;
  allowed_leaves: number;
  carry_forward: boolean;
};

type LeaveRuleItemProps = {
  index: number;
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  errors: FieldErrors<any>;
  onRemove: (index: number) => void;
  canRemove: boolean;
};

export function LeaveRuleItem({
  index,
  register,
  errors,
  onRemove,
  canRemove,
}: LeaveRuleItemProps) {
  const fieldError = (field: keyof LeaveRuleFormValue) => {
    const defErrors = errors.leave_definitions as Record<number, Record<string, { message?: string }>> | undefined;
    return defErrors?.[index]?.[field]?.message;
  };

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Leave Definition #{index + 1}</h4>
          <p className="text-xs text-muted-foreground">
            Define the leave name and allocation settings.
          </p>
        </div>
        <Button disabled={!canRemove} onClick={() => onRemove(index)} size="sm" variant="ghost">
          Remove
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Leave Name</Label>
          <Input
            placeholder="e.g. Sick Leave"
            {...register(`leave_definitions.${index}.leave_name`)}
          />
          {fieldError("leave_name") ? (
            <p className="text-xs text-destructive">{fieldError("leave_name")}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label>Allowed Leaves</Label>
          <Input
            min={0}
            type="number"
            {...register(`leave_definitions.${index}.allowed_leaves`, { valueAsNumber: true })}
          />
          {fieldError("allowed_leaves") ? (
            <p className="text-xs text-destructive">{fieldError("allowed_leaves")}</p>
          ) : null}
        </div>

        <div className="md:col-span-2 flex items-center gap-2 pt-2">
          <input
            className="h-4 w-4 accent-primary rounded cursor-pointer"
            id={`carry_forward_${index}`}
            type="checkbox"
            {...register(`leave_definitions.${index}.carry_forward`)}
          />
          <Label className="mb-0 cursor-pointer text-sm" htmlFor={`carry_forward_${index}`}>
            Allow unused leave to roll over into the next period (Carry Forward)
          </Label>
        </div>
      </div>
    </div>
  );
}
