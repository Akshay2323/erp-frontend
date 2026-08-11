"use client";

import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { PageRefreshingBadge, TableRowsSkeleton } from "@/components/ui/page-states";
import { isInitialQueryLoad, isQueryRefreshing } from "@/lib/query-loading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectFilter } from "@/components/ui/native-select";
import { getBranches, type Branch } from "@/lib/api/branch";
import { getDepartments, type Department } from "@/lib/api/department";
import { getEmployees, type EmployeeRecord } from "@/lib/api/employee";
import { EmployeeListAvatar, getEmployeeDisplayName } from "@/components/employee/EmployeeListAvatar";
import { formatDisplayDate } from "@/lib/format-date";
import { getTenantsList, type Tenant } from "@/lib/api/tenants";
import { useAuthToken } from "@/lib/use-auth-token";
import { cn } from "@/lib/utils";

type Filters = {
  q: string;
  status: string;
  company_id: string;
  branch_id: string;
  department_id: string;
  page: number;
  per_page: number;
};

const PAGE_SIZES = [10, 25, 50] as const;

const readFiltersFromParams = (params: URLSearchParams): Filters => {
  const page = Number(params.get("page") || "1");
  const perPage = Number(params.get("per_page") || "10");
  return {
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    company_id: params.get("company_id") ?? "",
    branch_id: params.get("branch_id") ?? "",
    department_id: params.get("department_id") ?? "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    per_page:
      Number.isFinite(perPage) && PAGE_SIZES.includes(perPage as (typeof PAGE_SIZES)[number])
        ? perPage
        : 10,
  };
};

const buildQuery = (f: Filters) => {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set("q", f.q.trim());
  if (f.status) sp.set("status", f.status);
  if (f.company_id) sp.set("company_id", f.company_id);
  if (f.branch_id) sp.set("branch_id", f.branch_id);
  if (f.department_id) sp.set("department_id", f.department_id);
  sp.set("page", String(f.page));
  sp.set("per_page", String(f.per_page));
  return sp;
};

const statusClass = (status: string | undefined) => {
  if (status === "active") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
};

export default function EmployeeListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const token = useAuthToken();
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

  const [filters, setFilters] = useState<Filters>(() => readFiltersFromParams(new URLSearchParams(searchParams.toString())));
  const deferredQ = useDeferredValue(filters.q);

  useEffect(() => {
    setFilters(readFiltersFromParams(new URLSearchParams(searchParams.toString())));
  }, [searchParams]);

  useEffect(() => {
    const merged: Filters = { ...filters, q: deferredQ };
    const sp = buildQuery(merged);
    router.replace(`${pathname}?${sp.toString()}`);
  }, [
    deferredQ,
    filters.status,
    filters.company_id,
    filters.branch_id,
    filters.department_id,
    filters.page,
    filters.per_page,
    pathname,
    router,
  ]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        router.push("/add-employee");
      }
      if (event.altKey && event.key.toLowerCase() === "e" && selectedRowId) {
        event.preventDefault();
        router.push(`/add-employee?edit=${selectedRowId}`);
      }
      if (event.key === "Escape") {
        setFilters((prev) => ({
          ...prev,
          q: "",
          status: "",
          company_id: "",
          branch_id: "",
          department_id: "",
          page: 1,
        }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, selectedRowId]);

  const tenantQuery = useQuery({
    queryKey: ["employee-list-tenants", token],
    queryFn: () => getTenantsList(token, 1, 100),
    enabled: Boolean(token),
  });

  const branchQuery = useQuery({
    queryKey: ["employee-list-branches", token, filters.company_id],
    queryFn: () =>
      getBranches(token, {
        company_id: filters.company_id,
        per_page: 100,
        page: 1,
      }),
    enabled: Boolean(token) && Boolean(filters.company_id),
  });

  const departmentQuery = useQuery({
    queryKey: ["employee-list-departments", token, filters.company_id],
    queryFn: () =>
      getDepartments(token, {
        company_id: filters.company_id,
        per_page: 100,
        page: 1,
      }),
    enabled: Boolean(token) && Boolean(filters.company_id),
  });

  const employeesQuery = useQuery({
    queryKey: ["employees-list", token, deferredQ, filters.status, filters.company_id, filters.branch_id, filters.department_id, filters.page, filters.per_page],
    queryFn: () =>
      getEmployees(token, {
        q: deferredQ,
        status: filters.status,
        company_id: filters.company_id,
        branch_id: filters.branch_id,
        department_id: filters.department_id,
        page: filters.page,
        per_page: filters.per_page,
      }),
    enabled: Boolean(token),
  });

  const companies: Tenant[] = tenantQuery.data?.data ?? [];
  const branches: Branch[] = Array.isArray(branchQuery.data?.data)
    ? branchQuery.data.data
    : [];
  const departments: Department[] = Array.isArray(departmentQuery.data?.data)
    ? departmentQuery.data.data
    : Array.isArray((departmentQuery.data?.data as { items?: Department[] } | undefined)?.items)
      ? ((departmentQuery.data?.data as { items: Department[] }).items)
      : [];

  const rows: EmployeeRecord[] = employeesQuery.data?.data.items ?? [];
  const meta = employeesQuery.data?.meta;
  const lastPage = meta?.last_page ?? 1;
  const listInitialLoading = isInitialQueryLoad(employeesQuery);
  const listRefreshing = isQueryRefreshing(employeesQuery);
  const selectedIndex = rows.findIndex((r) => r.id === selectedRowId);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedRowId(null);
      return;
    }
    if (!selectedRowId || !rows.some((r) => r.id === selectedRowId)) {
      setSelectedRowId(rows[0]?.id ?? null);
    }
  }, [rows, selectedRowId]);

  const moveSelection = (delta: number) => {
    if (rows.length === 0) return;
    const current = selectedIndex >= 0 ? selectedIndex : 0;
    const next = Math.max(0, Math.min(rows.length - 1, current + delta));
    setSelectedRowId(rows[next]?.id ?? null);
  };

  const onTableKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
    }
    if (event.key === "Enter" && selectedRowId) {
      event.preventDefault();
      router.push(`/add-employee?edit=${selectedRowId}`);
    }
  };

  const resetFilters = () => {
    setFilters({
      q: "",
      status: "",
      company_id: "",
      branch_id: "",
      department_id: "",
      page: 1,
      per_page: filters.per_page,
    });
  };

  return (
    <section className="w-full max-w-none space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            Employee List
            <PageRefreshingBadge show={listRefreshing} />
          </h1>
          <p className="text-sm text-muted-foreground">Manage and edit employee records quickly.</p>
        </div>
        <Link className={cn(buttonVariants({ variant: "default" }))} href="/add-employee">
          <Plus className="h-4 w-4" />
          Add Employee
        </Link>
      </header>

      <div className="relative z-10 rounded-2xl border border-border bg-card p-4 shadow-sm backdrop-blur md:sticky md:top-16">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <Label htmlFor="q">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                id="q"
                onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value, page: 1 }))}
                placeholder="Search employee name/code..."
                ref={searchRef}
                value={filters.q}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <NativeSelectFilter
              id="status"
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value, page: 1 }))}
              value={filters.status}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </NativeSelectFilter>
          </div>

          <div>
            <Label htmlFor="company_id">Company</Label>
            <NativeSelectFilter
              id="company_id"
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  company_id: e.target.value,
                  branch_id: "",
                  department_id: "",
                  page: 1,
                }))
              }
              value={filters.company_id}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </NativeSelectFilter>
          </div>

          <div>
            <Label htmlFor="branch_id">Branch</Label>
            <NativeSelectFilter
              id="branch_id"
              onChange={(e) => setFilters((p) => ({ ...p, branch_id: e.target.value, page: 1 }))}
              value={filters.branch_id}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelectFilter>
          </div>

          <div>
            <Label htmlFor="department_id">Department</Label>
            <NativeSelectFilter
              id="department_id"
              onChange={(e) => setFilters((p) => ({ ...p, department_id: e.target.value, page: 1 }))}
              value={filters.department_id}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelectFilter>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={resetFilters} variant="outline">
            <RotateCcw className="h-4 w-4" />
            Reset Filters
          </Button>
        </div>
      </div>

      <div
        className="hidden overflow-auto rounded-2xl border border-border bg-card shadow-sm md:block"
        onKeyDown={onTableKeyDown}
        tabIndex={0}
      >
        <table className="w-full min-w-[1350px] text-sm">
          <thead className="sticky top-0 z-10 bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="w-14 px-4 py-3 font-medium">Photo</th>
              <th className="px-4 py-3 font-medium">Employee Code</th>
              <th className="px-4 py-3 font-medium">Full Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Branch</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Designation</th>
              <th className="px-4 py-3 font-medium">Joining Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listInitialLoading ? (
              <TableRowsSkeleton cols={12} rows={8} />
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center" colSpan={12}>
                  <p className="text-muted-foreground">No employees found with selected filters.</p>
                  <Link className={cn(buttonVariants({ variant: "default" }), "mt-3 inline-flex")} href="/add-employee">
                    <Plus className="h-4 w-4" />
                    Add Employee
                  </Link>
                </td>
              </tr>
            ) : (
              rows.map((emp) => {
                const selected = selectedRowId === emp.id;
                const displayName = getEmployeeDisplayName(emp);
                return (
                  <tr
                    className={cn(
                      "cursor-pointer border-t border-border hover:bg-muted/40",
                      selected && "bg-primary/10",
                    )}
                    key={emp.id}
                    onClick={() => setSelectedRowId(emp.id)}
                  >
                    <td className="px-4 py-3">
                      <EmployeeListAvatar
                        employee={emp}
                        className="h-9 w-9 shrink-0"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{emp.employee_code ?? "-"}</td>
                    <td className="px-4 py-3">{displayName}</td>
                    <td className="max-w-[220px] truncate px-4 py-3" title={emp.email ?? "-"}>
                      {emp.email ?? "-"}
                    </td>
                    <td className="px-4 py-3">{emp.mobile ?? "-"}</td>
                    <td className="max-w-[180px] truncate px-4 py-3" title={emp.company?.name ?? "-"}>
                      {emp.company?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">{emp.branch?.name ?? "-"}</td>
                    <td className="px-4 py-3">{emp.department?.name ?? "-"}</td>
                    <td className="px-4 py-3">{emp.designation?.name ?? "-"}</td>
                    <td className="px-4 py-3">{formatDisplayDate(emp.joining_date)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium capitalize", statusClass(emp.status))}>
                        {emp.status ?? "draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/add-employee?edit=${emp.id}`);
                          }}
                          size="sm"
                          variant="outline"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="grid gap-4 md:hidden">
        {listInitialLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div className="h-44 animate-pulse rounded-2xl bg-muted" key={i} />
          ))
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-muted-foreground">No employees found with selected filters.</p>
            <Link className={cn(buttonVariants({ variant: "default" }), "mt-3 inline-flex")} href="/add-employee">
              <Plus className="h-4 w-4" />
              Add Employee
            </Link>
          </div>
        ) : (
          rows.map((emp) => {
            const selected = selectedRowId === emp.id;
            const displayName = getEmployeeDisplayName(emp);
            return (
              <div
                className={cn(
                  "flex cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40",
                  selected && "border-primary/50 bg-primary/5",
                )}
                key={emp.id}
                onClick={() => setSelectedRowId(emp.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <EmployeeListAvatar
                      employee={emp}
                      className="h-11 w-11 shrink-0"
                      textClassName="text-xs font-semibold"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{displayName}</h3>
                      <p className="text-sm text-muted-foreground">{emp.employee_code ?? "No Code"}</p>
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize", statusClass(emp.status))}>
                    {emp.status ?? "draft"}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="truncate font-medium">{emp.department?.name ?? "-"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Designation</p>
                    <p className="truncate font-medium">{emp.designation?.name ?? "-"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Branch</p>
                    <p className="truncate font-medium">{emp.branch?.name ?? "-"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Mobile</p>
                    <p className="truncate font-medium">{emp.mobile ?? "-"}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2 border-t border-border/50 pt-3">
                  <Button
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/add-employee?edit=${emp.id}`);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 sm:justify-end">
        <NativeSelect
          className="h-10 rounded-lg border border-border bg-background px-2 text-sm"
          onChange={(e) =>
            setFilters((p) => ({
              ...p,
              per_page: Number(e.target.value),
              page: 1,
            }))
          }
          value={filters.per_page}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </NativeSelect>
        <Button
          disabled={filters.page <= 1 || employeesQuery.isFetching}
          onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
          variant="outline"
        >
          Prev
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {filters.page} of {lastPage}
        </span>
        <Button
          disabled={filters.page >= lastPage || employeesQuery.isFetching}
          onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
          variant="outline"
        >
          Next
        </Button>
      </div>
    </section>
  );
}
