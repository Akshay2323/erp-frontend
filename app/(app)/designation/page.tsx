"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Plus, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import { DesignationDetailsModal } from "@/components/designation/DesignationDetailsModal";
import { DesignationFormModal } from "@/components/designation/DesignationFormModal";
import { DesignationTable } from "@/components/designation/DesignationTable";
import { Button } from "@/components/ui/button";
import { PageRefreshingBadge } from "@/components/ui/page-states";
import { isInitialQueryLoad, isQueryRefreshing } from "@/lib/query-loading";
import { Input } from "@/components/ui/input";
import { getCompanies, type Company } from "@/lib/api/company";
import {
  createDesignation,
  getDesignationDetail,
  getDesignations,
  updateDesignation,
  type CreateDesignationPayload,
  type Designation,
  type DesignationApiError,
  type UpdateDesignationPayload,
} from "@/lib/api/designation";
import { useAuthToken } from "@/lib/use-auth-token";

const PER_PAGE = 10;

export default function DesignationPage() {
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
  const [selectedDesignation, setSelectedDesignation] = useState<Designation | null>(null);
  const [serverError, setServerError] = useState<DesignationApiError | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailDesignation, setDetailDesignation] = useState<Designation | null>(null);

  const companiesQuery = useQuery({
    queryKey: ["companies-options", token],
    queryFn: () => getCompanies(token, 1, 100),
    enabled: Boolean(token),
  });

  const designationsQuery = useQuery({
    queryKey: [
      "designations",
      token,
      page,
      PER_PAGE,
      deferredSearchTerm,
      statusFilter,
      companyFilter,
    ],
    queryFn: () =>
      getDesignations(token, {
        q: deferredSearchTerm,
        status: statusFilter,
        company_id: companyFilter,
        page,
        per_page: PER_PAGE,
      }),
    enabled: Boolean(token),
  });

  const companies: Company[] = companiesQuery.data?.data ?? [];
  const rawData = designationsQuery.data?.data;
  const designations = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.items)
      ? rawData.items
      : [];

  const rawMeta = designationsQuery.data?.meta;
  const pagination =
    rawMeta && "pagination" in rawMeta ? rawMeta.pagination : rawMeta;
  const lastPage = pagination?.last_page ?? 1;

  const companyNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of companies) {
      map.set(c.id, c.company_name || "-");
    }
    return map;
  }, [companies]);

  const openCreate = () => {
    setServerError(null);
    setSelectedDesignation(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEdit = async (designation: Designation) => {
    if (!token) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const response = await getDesignationDetail(token, designation.id);
      setSelectedDesignation(response.data.designation);
      setModalMode("edit");
      setModalOpen(true);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Unable to fetch designation details.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const openView = async (designation: Designation) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const response = await getDesignationDetail(token, designation.id);
      setDetailDesignation(response.data.designation);
      setDetailsOpen(true);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Unable to load designation details.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (
    payload: CreateDesignationPayload | UpdateDesignationPayload,
  ) => {
    if (!token) return;
    setSubmitting(true);
    setServerError(null);
    try {
      if (modalMode === "create") {
        await createDesignation(token, payload as CreateDesignationPayload);
        toast.success("Designation created successfully.");
      } else if (selectedDesignation) {
        await updateDesignation(
          token,
          selectedDesignation.id,
          payload as UpdateDesignationPayload,
        );
        toast.success("Designation updated successfully.");
      }
      setModalOpen(false);
      setSelectedDesignation(null);
      await queryClient.invalidateQueries({ queryKey: ["designations"] });
    } catch (error) {
      const err = (error as DesignationApiError) ?? {
        message: "Something went wrong.",
      };
      setServerError(err);
      toast.error(err.message || "Unable to save designation.");
    } finally {
      setSubmitting(false);
    }
  };

  const pageInfo = useMemo(() => `Page ${page} of ${lastPage}`, [page, lastPage]);
  const isTableLoading = isInitialQueryLoad(designationsQuery) || submitting;
  const isRefreshing = isQueryRefreshing(designationsQuery);

  const detailCompanyName = detailDesignation
    ? companyNameById.get(detailDesignation.company_id) ?? "-"
    : "-";

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
                Designation Management
                <PageRefreshingBadge show={isRefreshing} />
              </h1>
              <p className="text-sm text-muted-foreground">
                Define job titles and codes mapped to each company.
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Designation
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
              placeholder="Search designations..."
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

      <DesignationTable
        companies={companies}
        designations={designations}
        loading={isTableLoading}
        onEdit={openEdit}
        onView={openView}
      />

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">{pageInfo}</p>
        <div className="flex gap-2">
          <Button
            disabled={page <= 1 || designationsQuery.isFetching}
            onClick={() => setPage((prev) => prev - 1)}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={page >= lastPage || designationsQuery.isFetching}
            onClick={() => setPage((prev) => prev + 1)}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      {modalOpen ? (
        <DesignationFormModal
          key={`${modalMode}-${selectedDesignation?.id ?? "new"}`}
          companies={companies}
          initialData={selectedDesignation}
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
      ) : null}

      <DesignationDetailsModal
        companyName={detailCompanyName}
        designation={detailDesignation}
        onClose={() => {
          setDetailsOpen(false);
          setDetailDesignation(null);
        }}
        open={detailsOpen}
      />
    </section>
  );
}
