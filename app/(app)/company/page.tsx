"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CompanyDetailsModal } from "@/components/company/CompanyDetailsModal";
import { CompanyFormModal } from "@/components/company/CompanyFormModal";
import { CompanyTable } from "@/components/company/CompanyTable";
import { Button } from "@/components/ui/button";
import { PageRefreshingBadge } from "@/components/ui/page-states";
import { isInitialQueryLoad, isQueryRefreshing } from "@/lib/query-loading";
import { Input } from "@/components/ui/input";
import {
  createCompany,
  deleteCompany,
  getCompanies,
  getCompanyDetail,
  updateCompany,
  type Company,
  type CompanyApiError,
  type CreateCompanyPayload,
  type UpdateCompanyPayload,
} from "@/lib/api/company";
import { useAuthToken } from "@/lib/use-auth-token";

const PER_PAGE = 10;

export default function CompanyPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [submitting, setSubmitting] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [serverError, setServerError] = useState<CompanyApiError | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailCompany, setDetailCompany] = useState<Company | null>(null);

  const authToken = useAuthToken();
  const [authRole, setAuthRole] = useState("");
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem("auth_user");
        const parsed = raw ? (JSON.parse(raw) as { role?: string }) : null;
        setAuthRole(parsed?.role ?? "");
      } catch {
        setAuthRole("");
      }
      setAuthReady(true);
    });
  }, []);

  const queryClient = useQueryClient();
  const companiesQuery = useQuery({
    queryKey: ["companies", page, PER_PAGE, authToken, authRole, deferredSearchTerm],
    queryFn: () => getCompanies(authToken, page, PER_PAGE, deferredSearchTerm, authRole),
    enabled: Boolean(authToken),
  });

  const openCreate = () => {
    setServerError(null);
    setSelectedCompany(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEdit = async (company: Company) => {
    if (!authToken) return;
    setServerError(null);
    setSubmitting(true);
    try {
      const response = await getCompanyDetail(authToken, company.id, authRole);
      setSelectedCompany(response.data.tenant);
      setModalMode("edit");
      setModalOpen(true);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Unable to load company details.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = async (company: Company) => {
    if (!authToken) return;
    setSubmitting(true);
    try {
      const response = await getCompanyDetail(authToken, company.id, authRole);
      setDetailCompany(response.data.tenant);
      setDetailsOpen(true);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Unable to load details.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (payload: CreateCompanyPayload | UpdateCompanyPayload) => {
    if (!authToken) return;
    setSubmitting(true);
    setServerError(null);
    try {
      if (modalMode === "create") {
        await createCompany(authToken, payload as CreateCompanyPayload, authRole);
        toast.success("Company created successfully.");
      } else if (selectedCompany) {
        await updateCompany(
          authToken,
          selectedCompany.id,
          payload as UpdateCompanyPayload,
          authRole,
        );
        toast.success("Company updated successfully.");
      }
      setModalOpen(false);
      setSelectedCompany(null);
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch (error) {
      const err = (error as CompanyApiError) ?? { message: "Something went wrong." };
      setServerError(err);
      toast.error(err.message || "Unable to save company.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (company: Company) => {
    if (!authToken) return;
    const shouldDelete = window.confirm(`Delete "${company.company_name}"? This action cannot be undone.`);
    if (!shouldDelete) return;

    setSubmitting(true);
    try {
      await deleteCompany(authToken, company.id, authRole);
      toast.success("Company deleted successfully.");
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Unable to delete company.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const companies = companiesQuery.data?.data ?? [];
  const isTableLoading =
    !authReady || !authToken || isInitialQueryLoad(companiesQuery) || submitting;
  const isRefreshing = isQueryRefreshing(companiesQuery);
  const lastPage = companiesQuery.data?.meta.last_page ?? 1;
  const canPrev = page > 1;
  const canNext = page < lastPage;
  const pageInfo = useMemo(() => `Page ${page} of ${lastPage}`, [page, lastPage]);

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
                Company Management
                <PageRefreshingBadge show={isRefreshing} />
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage company list, create new company, and update details.
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </div>
        <div className="relative mt-4 max-w-md">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Filter companies"
            className="pl-9"
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search companies..."
            value={searchTerm}
          />
        </div>
      </div>

      <CompanyTable
        companies={companies}
        loading={isTableLoading}
        onDelete={onDelete}
        onEdit={openEdit}
        onView={openDetails}
      />

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">{pageInfo}</p>
        <div className="flex gap-2">
          <Button
            disabled={!canPrev || companiesQuery.isFetching}
            onClick={() => setPage((prev) => prev - 1)}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={!canNext || companiesQuery.isFetching}
            onClick={() => setPage((prev) => prev + 1)}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      <CompanyFormModal
        initialData={selectedCompany}
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

      <CompanyDetailsModal
        company={detailCompany}
        onClose={() => setDetailsOpen(false)}
        open={detailsOpen}
      />
    </section>
  );
}
