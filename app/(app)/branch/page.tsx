"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import { BranchFormModal } from "@/components/branch/BranchFormModal";
import { BranchTable } from "@/components/branch/BranchTable";
import { Button } from "@/components/ui/button";
import { PageRefreshingBadge } from "@/components/ui/page-states";
import { isInitialQueryLoad, isQueryRefreshing } from "@/lib/query-loading";
import { Input } from "@/components/ui/input";
import {
  createBranch,
  getBranches,
  updateBranch,
  type Branch,
  type BranchApiError,
  type CreateBranchPayload,
  type UpdateBranchPayload,
} from "@/lib/api/branch";
import { getCompanies, type Company } from "@/lib/api/company";
import { useAuthToken } from "@/lib/use-auth-token";

const PER_PAGE = 10;

export default function BranchPage() {
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [submitting, setSubmitting] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [serverError, setServerError] = useState<BranchApiError | null>(null);

  const companiesQuery = useQuery({
    queryKey: ["companies-options", token],
    queryFn: () => getCompanies(token, 1, 100),
    enabled: Boolean(token),
  });

  const branchesQuery = useQuery({
    queryKey: [
      "branches",
      token,
      page,
      PER_PAGE,
      deferredSearchTerm,
      statusFilter,
      companyFilter,
    ],
    queryFn: () =>
      getBranches(token, {
        q: deferredSearchTerm,
        status: statusFilter,
        company_id: companyFilter,
        page,
        per_page: PER_PAGE,
      }),
    enabled: Boolean(token),
  });

  const companies: Company[] = companiesQuery.data?.data ?? [];
  const branches = Array.isArray(branchesQuery.data?.data)
    ? branchesQuery.data.data
    : [];
  const lastPage = branchesQuery.data?.meta.last_page ?? 1;

  const openCreate = () => {
    setServerError(null);
    setSelectedBranch(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setServerError(null);
    setSelectedBranch(branch);
    setModalMode("edit");
    setModalOpen(true);
  };

  const onSubmit = async (payload: CreateBranchPayload | UpdateBranchPayload) => {
    if (!token) return;
    setSubmitting(true);
    setServerError(null);
    try {
      if (modalMode === "create") {
        await createBranch(token, payload as CreateBranchPayload);
        toast.success("Branch created successfully.");
      } else if (selectedBranch) {
        await updateBranch(token, selectedBranch.id, payload as UpdateBranchPayload);
        toast.success("Branch updated successfully.");
      }
      setModalOpen(false);
      setSelectedBranch(null);
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
    } catch (error) {
      const err = (error as BranchApiError) ?? { message: "Something went wrong." };
      setServerError(err);
      toast.error(err.message || "Unable to save branch.");
    } finally {
      setSubmitting(false);
    }
  };

  const pageInfo = useMemo(() => `Page ${page} of ${lastPage}`, [page, lastPage]);
  const isTableLoading = isInitialQueryLoad(branchesQuery) || submitting;
  const isRefreshing = isQueryRefreshing(branchesQuery);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
                Branch Management
                <PageRefreshingBadge show={isRefreshing} />
              </h1>
              <p className="text-sm text-muted-foreground">
                Create and manage organization branches with filterable list.
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Branch
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
              placeholder="Search branches..."
              value={searchTerm}
            />
          </div>
          <select
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          <select
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        </div>
      </div>

      <BranchTable
        branches={branches}
        companies={companies}
        loading={isTableLoading}
        onEdit={openEdit}
      />

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">{pageInfo}</p>
        <div className="flex gap-2">
          <Button
            disabled={page <= 1 || branchesQuery.isFetching}
            onClick={() => setPage((prev) => prev - 1)}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={page >= lastPage || branchesQuery.isFetching}
            onClick={() => setPage((prev) => prev + 1)}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      <BranchFormModal
        companies={companies}
        initialData={selectedBranch}
        loading={submitting}
        mode={modalMode}
        onClose={() => {
          setModalOpen(false);
          setServerError(null);
        }}
        onSubmit={onSubmit}
        open={modalOpen}
        serverError={serverError}
      />
    </section>
  );
}
