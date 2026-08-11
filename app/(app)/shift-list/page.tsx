"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ShiftDetailsModal } from "@/components/shift/ShiftDetailsModal";
import { ShiftTable } from "@/components/shift/ShiftTable";
import { Button } from "@/components/ui/button";
import { PageRefreshingBadge } from "@/components/ui/page-states";
import { isInitialQueryLoad, isQueryRefreshing } from "@/lib/query-loading";
import { Input } from "@/components/ui/input";
import { getCompanies, type Company } from "@/lib/api/company";
import {
  deleteShift,
  getShifts,
  type Shift,
  type ShiftApiError,
  type ShiftListMeta,
  type ShiftStatus,
} from "@/lib/api/shift";
import { useAuthToken } from "@/lib/use-auth-token";

const PER_PAGE = 15;

export default function ShiftListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShiftStatus | "">("");
  const [companyFilter, setCompanyFilter] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [submitting, setSubmitting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailShift, setDetailShift] = useState<Shift | null>(null);

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
    queryKey: ["companies-options", authToken, authRole],
    queryFn: () => getCompanies(authToken, 1, 100, "", authRole),
    enabled: Boolean(authToken),
  });
  const shiftsQuery = useQuery({
    queryKey: [
      "shifts",
      authToken,
      page,
      PER_PAGE,
      deferredSearchTerm,
      statusFilter,
      companyFilter,
    ],
    queryFn: () =>
      getShifts(authToken, {
        page,
        per_page: PER_PAGE,
        q: deferredSearchTerm,
        status: statusFilter,
        company_id: companyFilter,
      }),
    enabled: Boolean(authToken),
  });

  const rawData = shiftsQuery.data?.data;
  const companies: Company[] = companiesQuery.data?.data ?? [];
  const shifts = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.items)
      ? rawData.items
      : [];
  const rawMeta = shiftsQuery.data?.meta;
  const pagination: ShiftListMeta | undefined =
    rawMeta && "pagination" in rawMeta
      ? (rawMeta.pagination as ShiftListMeta)
      : (rawMeta as ShiftListMeta | undefined);
  const lastPage = pagination?.last_page ?? 1;
  const canPrev = page > 1;
  const canNext = page < lastPage;
  const pageInfo = useMemo(() => `Page ${page} of ${lastPage}`, [page, lastPage]);

  const tableLoading = !authReady || isInitialQueryLoad(shiftsQuery) || submitting;
  const isRefreshing = isQueryRefreshing(shiftsQuery);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
                Shift management
                <PageRefreshingBadge show={isRefreshing} />
              </h1>
              <p className="text-sm text-muted-foreground">
                Create and manage employee shift timing and attendance cutoffs.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Search shifts"
              className="pl-9"
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              placeholder="Search shifts..."
              value={searchTerm}
            />
          </div>
          <select
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary"
            onChange={(event) => {
              setStatusFilter(event.target.value as ShiftStatus | "");
              setPage(1);
            }}
            value={statusFilter}
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary"
            onChange={(event) => {
              setCompanyFilter(event.target.value);
              setPage(1);
            }}
            value={companyFilter}
          >
            <option value="">All companies</option>
            {companies.map((company) => (
              <option key={company.id} value={String(company.id)}>
                {company.company_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ShiftTable
        loading={tableLoading}
        onDelete={async (shift) => {
          if (!authToken) return;
          if (!window.confirm(`Delete shift "${shift.shift_name || shift.name}"?`)) return;
          setSubmitting(true);
          try {
            await deleteShift(authToken, shift.id);
            toast.success("Shift deleted successfully.");
            await queryClient.invalidateQueries({ queryKey: ["shifts"] });
          } catch (error) {
            const err = (error as ShiftApiError) ?? { message: "Something went wrong." };
            toast.error(err.message || "Unable to delete shift.");
          } finally {
            setSubmitting(false);
          }
        }}
        onEditRules={(shift) => {
          const shiftId = String(shift.id);
          const shiftCode = encodeURIComponent(shift.shift_code || "");
          router.push(`/shift-rules?shiftId=${shiftId}&shiftCode=${shiftCode}`);
        }}
        onView={(shift) => {
          setDetailShift(shift);
          setDetailsOpen(true);
        }}
        shifts={shifts}
      />

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">{pageInfo}</p>
        <div className="flex gap-2">
          <Button
            disabled={!canPrev || shiftsQuery.isFetching}
            onClick={() => setPage((p) => p - 1)}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={!canNext || shiftsQuery.isFetching}
            onClick={() => setPage((p) => p + 1)}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>

      <ShiftDetailsModal
        onClose={() => {
          setDetailsOpen(false);
          setDetailShift(null);
        }}
        open={detailsOpen}
        shift={detailShift}
      />
    </section>
  );
}
