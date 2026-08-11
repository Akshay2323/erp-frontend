"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import { LeavePolicyTable } from "@/components/leave-policy/LeavePolicyTable";
import { Button } from "@/components/ui/button";
import { PageRefreshingBadge } from "@/components/ui/page-states";
import { isInitialQueryLoad, isQueryRefreshing } from "@/lib/query-loading";
import { Input } from "@/components/ui/input";
import { getCompanies, type Company } from "@/lib/api/company";
import {
  getLeavePolicies,
  getLeavePolicyDetail,
  type LeavePolicy,
} from "@/lib/api/leave-policy";
import { useAuthToken } from "@/lib/use-auth-token";

const PER_PAGE = 10;

export default function LeavePoliciesPage() {
  const token = useAuthToken();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const [viewingPolicy, setViewingPolicy] = useState<LeavePolicy | null>(null);

  const companiesQuery = useQuery({
    queryKey: ["companies-options", token],
    queryFn: () => getCompanies(token, 1, 100),
    enabled: Boolean(token),
  });

  const policiesQuery = useQuery({
    queryKey: [
      "leave-policies",
      token,
      page,
      PER_PAGE,
      deferredSearch,
      statusFilter,
      companyFilter,
    ],
    queryFn: () =>
      getLeavePolicies(token, {
        q: deferredSearch,
        status: statusFilter,
        company_id: companyFilter,
        page,
        per_page: PER_PAGE,
      }),
    enabled: Boolean(token),
  });

  const companies: Company[] = companiesQuery.data?.data ?? [];
  const policies = Array.isArray(policiesQuery.data?.data) ? policiesQuery.data.data : [];
  const lastPage = policiesQuery.data?.meta.last_page ?? 1;
  const pageInfo = useMemo(() => `Page ${page} of ${lastPage}`, [page, lastPage]);
  const isLoading = isInitialQueryLoad(policiesQuery);
  const isRefreshing = isQueryRefreshing(policiesQuery);

  const openView = async (policy: LeavePolicy) => {
    if (!token) return;
    try {
      const response = await getLeavePolicyDetail(token, policy.id);
      setViewingPolicy(response.data.leave_policy);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Unable to fetch policy details.";
      toast.error(message);
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
                Leave Policies
                <PageRefreshingBadge show={isRefreshing} />
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage leave policy definitions and rule configuration.
              </p>
            </div>
          </div>
          <Button onClick={() => router.push("/leave-policies/new")}>
            <Plus className="h-4 w-4" />
            Add Leave Policy
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-9"
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              placeholder="Search policies..."
              value={searchTerm}
            />
          </div>

          <select
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            onChange={(event) => {
              setCompanyFilter(event.target.value);
              setPage(1);
            }}
            value={companyFilter}
          >
            <option value="">All Companies</option>
            {companies.map((company) => (
              <option key={company.id} value={String(company.id)}>
                {company.company_name}
              </option>
            ))}
          </select>

          <select
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            value={statusFilter}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <LeavePolicyTable
        companies={companies}
        loading={isLoading}
        onEdit={(policy) => router.push(`/leave-policies/${policy.id}`)}
        onView={openView}
        policies={policies}
      />

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">{pageInfo}</p>
        <div className="flex gap-2">
          <Button
            disabled={page <= 1 || policiesQuery.isFetching}
            onClick={() => setPage((prev) => prev - 1)}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={page >= lastPage || policiesQuery.isFetching}
            onClick={() => setPage((prev) => prev + 1)}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      {viewingPolicy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Policy Details</h2>
              <Button onClick={() => setViewingPolicy(null)} variant="ghost">
                Close
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Policy Name</p>
                <p className="font-medium">{viewingPolicy.name}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{viewingPolicy.status}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Leave Cycle</p>
                <p className="font-medium capitalize">{viewingPolicy.leave_cycle || "-"}</p>
              </div>
              <div className="rounded-xl border border-border p-3 md:col-span-3">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="font-medium">{viewingPolicy.description || "-"}</p>
              </div>
              <div className="rounded-xl border border-border p-3 md:col-span-3">
                <p className="mb-3 text-xs text-muted-foreground">Leave Definitions</p>
                <div className="space-y-2">
                  {viewingPolicy.leave_definitions?.map((def) => (
                    <div
                      className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm"
                      key={def.id ?? def.leave_name}
                    >
                      <p className="font-medium">{def.leave_name}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>Allowed Leaves: {def.allowed_leaves}</span>
                        <span>Carry forward: {def.carry_forward ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
