"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FilePenLine } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { LeavePolicyForm, type LeavePolicyFormValues } from "@/components/leave-policy/LeavePolicyForm";
import { Button } from "@/components/ui/button";
import { getCompanies, type Company } from "@/lib/api/company";
import {
  getLeavePolicyDetail,
  updateLeavePolicy,
  type LeaveApiError,
} from "@/lib/api/leave-policy";
import { useAuthToken } from "@/lib/use-auth-token";

export default function EditLeavePolicyPage() {
  const token = useAuthToken();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [submitting, setSubmitting] = useState(false);

  const companiesQuery = useQuery({
    queryKey: ["companies-options", token],
    queryFn: () => getCompanies(token, 1, 100),
    enabled: Boolean(token),
  });

  const policyQuery = useQuery({
    queryKey: ["leave-policy-detail", token, id],
    queryFn: () => getLeavePolicyDetail(token, id),
    enabled: Boolean(token) && Number.isFinite(id),
  });

  const policy = policyQuery.data?.data.leave_policy ?? null;

  const companies: Company[] = companiesQuery.data?.data ?? [];
  const isLoading =
    companiesQuery.isLoading || policyQuery.isLoading;

  const onSubmit = async (values: LeavePolicyFormValues) => {
    if (!token || !Number.isFinite(id)) return;
    setSubmitting(true);
    try {
      await updateLeavePolicy(token, id, {
        company_id: values.company_id,
        name: values.name,
        leave_cycle: values.leave_cycle,
        description: values.description,
        status: values.status,
        leave_definitions: values.leave_definitions,
      });
      toast.success("Leave policy updated successfully.");
      await queryClient.invalidateQueries({ queryKey: ["leave-policies"] });
      await queryClient.invalidateQueries({ queryKey: ["leave-policy-detail", token, id] });
      router.push("/leave-policies");
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as LeaveApiError).message)
          : "Unable to update leave policy.";
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
              <FilePenLine className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Edit Leave Policy</h1>
              <p className="text-sm text-muted-foreground">
                Update leave definitions or adjust policy settings.
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
        initialData={policy}
        loading={isLoading || submitting}
        mode="edit"
        onSubmit={onSubmit}
      />
    </section>
  );
}
