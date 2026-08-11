"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import { DepartmentFormModal } from "@/components/department/DepartmentFormModal";
import { DepartmentTable } from "@/components/department/DepartmentTable";
import { Button } from "@/components/ui/button";
import { PageRefreshingBadge } from "@/components/ui/page-states";
import { isInitialQueryLoad, isQueryRefreshing } from "@/lib/query-loading";
import { Input } from "@/components/ui/input";
import {
  createDepartment,
  getDepartmentDetail,
  getDepartments,
  updateDepartment,
  type CreateDepartmentPayload,
  type Department,
  type DepartmentApiError,
  type UpdateDepartmentPayload,
} from "@/lib/api/department";
import { getCompanies, type Company } from "@/lib/api/company";
import { useAuthToken } from "@/lib/use-auth-token";

const PER_PAGE = 10;

export default function DepartmentPage() {
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
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [serverError, setServerError] = useState<DepartmentApiError | null>(null);

  const companiesQuery = useQuery({
    queryKey: ["companies-options", token],
    queryFn: () => getCompanies(token, 1, 100),
    enabled: Boolean(token),
  });

  const departmentsQuery = useQuery({
    queryKey: [
      "departments",
      token,
      page,
      PER_PAGE,
      deferredSearchTerm,
      statusFilter,
      companyFilter,
    ],
    queryFn: () =>
      getDepartments(token, {
        q: deferredSearchTerm,
        status: statusFilter,
        company_id: companyFilter,
        page,
        per_page: PER_PAGE,
      }),
    enabled: Boolean(token),
  });

  const companies: Company[] = companiesQuery.data?.data ?? [];
  const rawDepartmentData = departmentsQuery.data?.data;
  const departments = Array.isArray(rawDepartmentData)
    ? rawDepartmentData
    : Array.isArray(rawDepartmentData?.items)
      ? rawDepartmentData.items
      : [];

  const rawMeta = departmentsQuery.data?.meta;
  const pagination =
    rawMeta && "pagination" in rawMeta
      ? rawMeta.pagination
      : rawMeta;
  const lastPage = pagination?.last_page ?? 1;

  const openCreate = () => {
    setServerError(null);
    setSelectedDepartment(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEdit = async (department: Department) => {
    if (!token) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const response = await getDepartmentDetail(token, department.id);
      setSelectedDepartment(response.data.department);
      setModalMode("edit");
      setModalOpen(true);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Unable to fetch department details.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (
    payload: CreateDepartmentPayload | UpdateDepartmentPayload,
  ) => {
    if (!token) return;
    setSubmitting(true);
    setServerError(null);
    try {
      if (modalMode === "create") {
        await createDepartment(token, payload as CreateDepartmentPayload);
        toast.success("Department created successfully.");
      } else if (selectedDepartment) {
        await updateDepartment(
          token,
          selectedDepartment.id,
          payload as UpdateDepartmentPayload,
        );
        toast.success("Department updated successfully.");
      }
      setModalOpen(false);
      setSelectedDepartment(null);
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    } catch (error) {
      const err = (error as DepartmentApiError) ?? {
        message: "Something went wrong.",
      };
      setServerError(err);
      toast.error(err.message || "Unable to save department.");
    } finally {
      setSubmitting(false);
    }
  };

  const pageInfo = useMemo(() => `Page ${page} of ${lastPage}`, [page, lastPage]);
  const isTableLoading = isInitialQueryLoad(departmentsQuery) || submitting;
  const isRefreshing = isQueryRefreshing(departmentsQuery);

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
                Department Management
                <PageRefreshingBadge show={isRefreshing} />
              </h1>
              <p className="text-sm text-muted-foreground">
                Create and manage department hierarchy with company and branch mapping.
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Department
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
              placeholder="Search departments..."
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

      <DepartmentTable
        companies={companies}
        departments={departments}
        loading={isTableLoading}
        onEdit={openEdit}
      />

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">{pageInfo}</p>
        <div className="flex gap-2">
          <Button
            disabled={page <= 1 || departmentsQuery.isFetching}
            onClick={() => setPage((prev) => prev - 1)}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={page >= lastPage || departmentsQuery.isFetching}
            onClick={() => setPage((prev) => prev + 1)}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      <DepartmentFormModal
        companies={companies}
        initialData={selectedDepartment}
        loading={submitting}
        mode={modalMode}
        onClose={() => {
          setModalOpen(false);
          setServerError(null);
        }}
        onSubmit={onSubmit}
        open={modalOpen}
        serverError={serverError}
        token={token}
      />
    </section>
  );
}
