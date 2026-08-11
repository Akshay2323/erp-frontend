"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import type { Company } from "@/lib/api/company";
import type { LeaveApiError, LeavePolicy } from "@/lib/api/leave-policy";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { LeaveRuleItem, type LeaveRuleFormValue } from "./LeaveRuleItem";

const definitionSchema = z.object({
  leave_name: z.string().trim().min(1, "Leave name is required"),
  allowed_leaves: z.number().min(0, "Allowed leaves cannot be negative"),
  carry_forward: z.boolean(),
});

const schema = z.object({
  company_id: z.number().min(1, "Company is required"),
  name: z.string().trim().min(1, "Policy name is required"),
  leave_cycle: z.enum(["monthly", "yearly"]),
  description: z.string().trim().min(1, "Description is required"),
  status: z.enum(["active", "inactive"]),
  leave_definitions: z.array(definitionSchema).min(1, "At least one leave definition is required"),
});

export type LeavePolicyFormValues = z.infer<typeof schema>;

type LeavePolicyFormProps = {
  mode: "create" | "edit";
  companies: Company[];
  loading: boolean;
  initialData?: LeavePolicy | null;
  serverError?: LeaveApiError | null;
  onSubmit: (values: LeavePolicyFormValues) => Promise<void>;
  onCompanyChange?: (companyId: number) => void;
  /** Keeps form company in sync when changed from Leave Type Manager. */
  syncCompanyId?: number;
};

const inputStyles =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary";

const defaultDefinition = (): LeaveRuleFormValue => ({
  leave_name: "",
  allowed_leaves: 0,
  carry_forward: true,
});

export function LeavePolicyForm({
  mode,
  companies,
  loading,
  initialData,
  serverError,
  onSubmit,
  onCompanyChange,
  syncCompanyId,
}: LeavePolicyFormProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeavePolicyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_id: 0,
      name: "",
      leave_cycle: "monthly",
      description: "",
      status: "active",
      leave_definitions: [defaultDefinition()],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "leave_definitions",
  });

  const selectedCompanyId = watch("company_id");

  useEffect(() => {
    if (syncCompanyId && syncCompanyId > 0 && mode === "create") {
      setValue("company_id", syncCompanyId);
    }
  }, [mode, setValue, syncCompanyId]);

  useEffect(() => {
    if (!initialData) {
      reset({
        company_id: 0,
        name: "",
        leave_cycle: "monthly",
        description: "",
        status: "active",
        leave_definitions: [defaultDefinition()],
      });
      return;
    }

    const definitions = initialData.leave_definitions?.length
      ? initialData.leave_definitions.map((def) => ({
          leave_name: def.leave_name,
          allowed_leaves: Number(def.allowed_leaves ?? 0),
          carry_forward: Boolean(def.carry_forward),
        }))
      : [defaultDefinition()];

    reset({
      company_id: initialData.company_id,
      name: initialData.name,
      leave_cycle: initialData.leave_cycle === "yearly" ? "yearly" : "monthly",
      description: initialData.description ?? "",
      status: initialData.status,
      leave_definitions: definitions,
    });
    replace(definitions);
    onCompanyChange?.(initialData.company_id);
  }, [initialData, onCompanyChange, replace, reset]);

  const policyError = useMemo(() => {
    const definitionErrors = errors.leave_definitions as unknown as Array<Record<string, { message?: string }>> | undefined;
    if (!definitionErrors) return null;
    return definitionErrors.find(Boolean);
  }, [errors.leave_definitions]);

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Policy Details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Name and describe the leave policy.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Company</Label>
            <select
              className={inputStyles}
              disabled={mode === "edit"}
              {...register("company_id", {
                valueAsNumber: true,
                onChange: (event) => onCompanyChange?.(Number(event.target.value) || 0),
              })}
            >
              <option value={0}>Select company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.company_name}
                </option>
              ))}
            </select>
            {errors.company_id?.message ? (
              <p className="text-xs text-destructive">{errors.company_id.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Policy Name</Label>
            <Input placeholder="e.g. Standard Policy" {...register("name")} />
            {errors.name?.message ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Leave Cycle</Label>
            <select className={inputStyles} {...register("leave_cycle")}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            {errors.leave_cycle?.message ? (
              <p className="text-xs text-destructive">{errors.leave_cycle.message}</p>
            ) : null}
          </div>

          {mode === "edit" ? (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className={inputStyles} {...register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          ) : null}

          <div className="md:col-span-2 space-y-1.5">
            <Label>Description</Label>
            <textarea
              className={inputStyles}
              placeholder="Brief description of who this policy applies to"
              rows={3}
              {...register("description")}
            />
            {errors.description?.message ? (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Leave Definitions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add one or more leave definitions for this policy.
            </p>
          </div>
          <Button
            disabled={!selectedCompanyId}
            onClick={() => append(defaultDefinition())}
            type="button"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            Add Leave Definition
          </Button>
        </div>

        {!selectedCompanyId ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Select a company above to configure leave definitions.
          </p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <LeaveRuleItem
                canRemove={fields.length > 1}
                errors={errors}
                index={index}
                key={field.id}
                onRemove={remove}
                register={register}
                setValue={setValue}
              />
            ))}
          </div>
        )}

        {errors.leave_definitions?.message ? (
          <p className="mt-3 text-sm text-destructive">{errors.leave_definitions.message}</p>
        ) : null}
      </div>

      {policyError ? (
        <p className="text-sm text-destructive">Please fix errors in leave definition configuration.</p>
      ) : null}
      {serverError?.message ? <p className="text-sm text-destructive">{serverError.message}</p> : null}

      <div className="flex justify-end">
        <Button disabled={loading} type="submit">
          {loading
            ? "Saving..."
            : mode === "create"
              ? "Create Leave Policy"
              : "Update Leave Policy"}
        </Button>
      </div>
    </form>
  );
}
