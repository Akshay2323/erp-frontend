"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { LeavePolicySummary } from "@/components/employee/add-wizard/LeavePolicySummary";
import { NativeSelectFilter } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getLeavePolicies,
  getLeavePolicyDetail,
  type LeavePolicy,
} from "@/lib/api/leave-policy";
import type { EmployeeWizardValues } from "@/lib/validations/employee-wizard";
import { cn } from "@/lib/utils";

const selectClass = cn(
  "flex h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

type LeavePolicyAssignStepProps = {
  token: string;
  companyId: number;
};

export function LeavePolicyAssignStep({ token, companyId }: LeavePolicyAssignStepProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<EmployeeWizardValues>();

  const leavePolicyId = useWatch({ name: "leave_policy_id" });
  const effectiveFrom = useWatch({ name: "effective_from" });
  const joiningDate = useWatch({ name: "joining_date" });

  const policiesQuery = useQuery({
    queryKey: ["leave-policies-wizard", token, companyId],
    queryFn: () =>
      getLeavePolicies(token, {
        company_id: String(companyId),
        status: "active",
        page: 1,
        per_page: 100,
      }),
    enabled: Boolean(token) && companyId > 0,
  });

  const policies: LeavePolicy[] = Array.isArray(policiesQuery.data?.data)
    ? policiesQuery.data.data
    : [];

  const selectedId =
    leavePolicyId != null && Number(leavePolicyId) > 0 ? Number(leavePolicyId) : null;

  const policyDetailQuery = useQuery({
    queryKey: ["leave-policy-detail-wizard", token, selectedId],
    queryFn: () => getLeavePolicyDetail(token, selectedId!),
    enabled: Boolean(token) && selectedId != null,
  });

  const selectedPolicy =
    policyDetailQuery.data?.data.leave_policy ??
    policies.find((p) => p.id === selectedId) ??
    null;

  useEffect(() => {
    if (!effectiveFrom?.trim() && joiningDate?.trim()) {
      setValue("effective_from", joiningDate, { shouldDirty: false });
    }
  }, [effectiveFrom, joiningDate, setValue]);

  const handlePolicyChange = (value: string) => {
    setValue("leave_policy_skipped", false, { shouldDirty: true });
    if (!value) {
      setValue("leave_policy_id", undefined, { shouldDirty: true, shouldValidate: true });
      setValue("leave_policy_label", "", { shouldDirty: true });
      return;
    }
    const id = Number(value);
    setValue("leave_policy_id", id, { shouldDirty: true, shouldValidate: true });
    const match = policies.find((p) => p.id === id);
    if (match) setValue("leave_policy_label", match.name, { shouldDirty: true });
  };

  if (companyId <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a company in step 1 to load leave policies for this employee.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Assign a leave policy to define how leave balances are credited for this employee. This
        step is optional — you can skip and assign a policy later.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="leave_policy_id">
            Leave policy <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
          </Label>
          <NativeSelectFilter
            className={selectClass}
            disabled={policiesQuery.isLoading}
            id="leave_policy_id"
            onChange={(e) => handlePolicyChange(e.target.value)}
            value={selectedId ?? ""}
          >
            <option value="">
              {policiesQuery.isLoading ? "Loading policies…" : "Select a leave policy"}
            </option>
            {policies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.name}
              </option>
            ))}
          </NativeSelectFilter>
          {!policiesQuery.isLoading && policies.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No active policies for this company.{" "}
              <Link className="text-primary underline-offset-2 hover:underline" href="/leave-policies/new">
                Create a leave policy
              </Link>
            </p>
          ) : null}
          {errors.leave_policy_id ? (
            <p className="mt-1 text-xs text-destructive">{errors.leave_policy_id.message}</p>
          ) : null}
        </div>

        {selectedId ? (
          <div>
            <Label htmlFor="effective_from">Effective from</Label>
            <Input id="effective_from" type="date" {...register("effective_from")} />
            {errors.effective_from ? (
              <p className="mt-1 text-xs text-destructive">{errors.effective_from.message}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Leave credits start from this date (defaults to joining date).
              </p>
            )}
          </div>
        ) : null}
      </div>

      <LeavePolicySummary
        effectiveFrom={effectiveFrom}
        loading={Boolean(selectedId) && policyDetailQuery.isLoading}
        policy={selectedPolicy}
      />
    </div>
  );
}
