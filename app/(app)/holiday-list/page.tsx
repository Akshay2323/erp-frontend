"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { HolidayCalendar } from "@/components/holiday/HolidayCalendar";
import { HolidayForm, type HolidayFormValues } from "@/components/holiday/HolidayForm";
import { HolidayTable } from "@/components/holiday/HolidayTable";
import { Button } from "@/components/ui/button";
import { PageRefreshingBadge } from "@/components/ui/page-states";
import { isInitialQueryLoad, isQueryRefreshing } from "@/lib/query-loading";
import { Input } from "@/components/ui/input";
import { getCompanies, type Company } from "@/lib/api/company";
import {
  deleteHoliday,
  getHolidayDetail,
  getHolidays,
  updateHoliday,
  type Holiday,
  type HolidayApiError,
} from "@/lib/api/holiday";
import { useAuthToken } from "@/lib/use-auth-token";

const PER_PAGE = 10;
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function HolidayListPage() {
  const router = useRouter();
  const token = useAuthToken();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(2000);

  const [tab, setTab] = useState<"table" | "calendar">("table");
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [serverError, setServerError] = useState<HolidayApiError | null>(null);

  const companiesQuery = useQuery({
    queryKey: ["companies-options", token],
    queryFn: () => getCompanies(token, 1, 100),
    enabled: Boolean(token),
  });

  useEffect(() => {
    const now = new Date();
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    setMounted(true);
  }, []);

  const dateRange = useMemo(() => {
    return {
      holiday_date_from: `${year}-01-01`,
      holiday_date_to: `${year}-12-31`,
    };
  }, [year]);

  const holidaysQuery = useQuery({
    queryKey: [
      "holidays",
      token,
      page,
      PER_PAGE,
      deferredSearchTerm,
      statusFilter,
      year,
      dateRange.holiday_date_from,
      dateRange.holiday_date_to,
    ],
    queryFn: () =>
      getHolidays(token, {
        q: deferredSearchTerm,
        status: statusFilter,
        holiday_date_from: dateRange.holiday_date_from,
        holiday_date_to: dateRange.holiday_date_to,
        year,
        page,
        per_page: PER_PAGE,
      }),
    enabled: Boolean(token) && mounted,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const holidaysData = holidaysQuery.data?.data;
  const holidays = Array.isArray(holidaysData)
    ? holidaysData
    : Array.isArray(holidaysData?.items)
      ? holidaysData.items
      : [];

  const rawMeta = holidaysQuery.data?.meta;
  const pagination = rawMeta && "pagination" in rawMeta ? rawMeta.pagination : rawMeta;
  const lastPage = pagination?.last_page ?? 1;
  const pageInfo = useMemo(() => `Page ${page} of ${lastPage}`, [page, lastPage]);

  const openEdit = async (holiday: Holiday) => {
    if (!token) return;
    setEditLoading(true);
    setServerError(null);
    try {
      const response = await getHolidayDetail(token, holiday.id);
      setEditingHoliday(response.data.holiday);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Unable to fetch holiday details.";
      toast.error(message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (holiday: Holiday) => {
    if (!token) return;
    const yes = window.confirm(`Delete holiday "${holiday.name}"?`);
    if (!yes) return;
    try {
      await deleteHoliday(token, holiday.id);
      toast.success("Holiday deleted successfully.");
      await queryClient.invalidateQueries({ queryKey: ["holidays"] });
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Unable to delete holiday.";
      toast.error(message);
    }
  };

  const submitEdit = async (values: HolidayFormValues) => {
    if (!token || !editingHoliday) return;
    setEditLoading(true);
    setServerError(null);
    try {
      await updateHoliday(token, editingHoliday.id, {
        name: values.name,
        date: values.date,
        type: values.type,
        branch_id: "",
        is_paid: values.is_paid ?? true,
        status: values.status,
      });
      toast.success("Holiday updated successfully.");
      setEditingHoliday(null);
      await queryClient.invalidateQueries({ queryKey: ["holidays"] });
    } catch (error) {
      const err = (error as HolidayApiError) ?? { message: "Unable to update holiday." };
      setServerError(err);
      toast.error(err.message || "Unable to update holiday.");
    } finally {
      setEditLoading(false);
    }
  };

  const companies: Company[] = companiesQuery.data?.data ?? [];
  const isLoading = !mounted || isInitialQueryLoad(holidaysQuery) || editLoading;
  const isRefreshing = mounted && isQueryRefreshing(holidaysQuery);

  return (
    <section className="space-y-5" suppressHydrationWarning>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
                Holiday List
                <PageRefreshingBadge show={isRefreshing} />
              </h1>
              <p className="text-sm text-muted-foreground">
                Default view shows current year holidays with table and calendar tabs.
              </p>
            </div>
          </div>
          <Button onClick={() => router.push("/add-holiday")}>
            <Plus className="h-4 w-4" />
            Add Holiday
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              disabled={!mounted || holidaysQuery.isFetching}
              onClick={() => setYear((prev) => prev - 1)}
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl"
              aria-label="Previous year"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <select
              className="h-10 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setPage(1);
              }}
            >
              {Array.from({ length: 21 }, (_, i) => {
                const y = new Date().getFullYear() - 10 + i;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </select>
            <Button
              disabled={!mounted || holidaysQuery.isFetching}
              onClick={() => setYear((prev) => prev + 1)}
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl"
              aria-label="Next year"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
                placeholder="Search holidays..."
                value={searchTerm}
              />
            </div>
            <select
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              suppressHydrationWarning
              value={statusFilter}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-2">
        <div className="flex gap-2">
          <Button onClick={() => setTab("table")} variant={tab === "table" ? "default" : "outline"}>
            Table View
          </Button>
          <Button
            onClick={() => {
              setTab("calendar");
              setPage(1);
            }}
            variant={tab === "calendar" ? "default" : "outline"}
          >
            Calendar View
          </Button>
        </div>
      </div>

      {tab === "table" ? (
        <>
          <HolidayTable holidays={holidays} loading={isLoading} onDelete={handleDelete} onEdit={openEdit} />
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">{pageInfo}</p>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1 || holidaysQuery.isFetching}
                onClick={() => setPage((prev) => prev - 1)}
                variant="outline"
              >
                Previous
              </Button>
              <Button
                disabled={page >= lastPage || holidaysQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        <HolidayCalendar
          holidays={holidays}
          loading={isLoading}
          month={month}
          year={year}
          onChangeMonth={(m) => setMonth(m)}
        />
      )}

      {editingHoliday ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Holiday</h2>
              <Button onClick={() => setEditingHoliday(null)} variant="ghost">
                Close
              </Button>
            </div>
            <HolidayForm
              companies={companies}
              initialData={editingHoliday}
              loading={editLoading}
              mode="edit"
              onSubmit={submitEdit}
              serverError={serverError}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
