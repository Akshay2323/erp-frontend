"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { LeavePolicyForm, type LeavePolicyFormValues } from "@/components/leave-policy/LeavePolicyForm";
import { Button } from "@/components/ui/button";
import { getCompanies, type Company } from "@/lib/api/company";
import {
  createLeavePolicy,
  type LeaveApiError,
} from "@/lib/api/leave-policy";
import { useAuthToken } from "@/lib/use-auth-token";

export default function NewLeavePolicyPage() {
  const token = useAuthToken();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const companiesQuery = useQuery({
    queryKey: ["companies-options", token],
    queryFn: () => getCompanies(token, 1, 100),
    enabled: Boolean(token),
  });

  const companies: Company[] = companiesQuery.data?.data ?? [];
  const isLoading = companiesQuery.isLoading;

  const onSubmit = async (values: LeavePolicyFormValues) => {
    if (!token) return;
    setSubmitting(true);
    try {
      await createLeavePolicy(token, {
        company_id: values.company_id,
        name: values.name,
        leave_cycle: values.leave_cycle,
        description: values.description,
        status: "active",
        leave_definitions: values.leave_definitions,
      });
      toast.success("Leave policy created successfully.");
      await queryClient.invalidateQueries({ queryKey: ["leave-policies"] });
      router.push("/leave-policies");
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as LeaveApiError).message)
          : "Unable to create leave policy.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <FilePlus2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Add Leave Policy</h1>
              <p className="text-sm text-muted-foreground">
                Configure policy details and leave definitions.
              </p>
            </div>
          </div>
          <Button onClick={() => router.push("/leave-policies")} variant="outline">
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </Button>
        </div>
      </div>

      <LeavePolicyForm
        companies={companies}
        loading={isLoading || submitting}
        mode="create"
        onSubmit={onSubmit}
      />
    </section>
  );
}
