"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  getRunPayrollEmployees,
  getRunPayrollMeta,
  getRunPayrollSummary,
} from "@/lib/api/run-payroll";
import {
  mapApiSummaryStats,
  mapEmployeeToPayrollRow,
} from "@/lib/payroll/run-payroll-mapper";
import { toRunPayrollApiFilters } from "@/lib/payroll/run-payroll-params";
import { resolvePayrollMonthOptions } from "@/lib/payroll/month-options";
import type { PayrollMonthOption } from "@/lib/payroll/month-options";
import type {
  PayrollStaffRow,
  PayrollSummaryStats,
  RunPayrollFilterState,
  RunPayrollSortBy,
  RunPayrollSortDir,
  RunPayrollTableParams,
} from "@/lib/payroll/run-payroll-types";

export type RunPayrollFilterOptions = {
  months: PayrollMonthOption[];
  companies?: Array<{ id: number; name: string }>;
  branches?: Array<{ id: number; name: string }>;
  departments?: Array<{ id: number; name: string }>;
  designations?: Array<{ id: number; name: string }>;
  employment_types?: Array<{ value: string; label: string }>;
  calculation_modes?: Array<{ value: string; label: string }>;
  payroll_statuses?: Array<{ value: string | null; label: string }>;
  employee_statuses?: Array<{ value: string; label: string }>;
};

const META_STALE_TIME = 10 * 60 * 1000;

type UseRunPayrollQueriesOptions = {
  token: string | null;
  filters: RunPayrollFilterState;
  debouncedSearch: string;
  tableParams: RunPayrollTableParams;
};

export function useRunPayrollQueries({
  token,
  filters,
  debouncedSearch,
  tableParams,
}: UseRunPayrollQueriesOptions) {
  const queryClient = useQueryClient();

  const apiFilters = useMemo(
    () => toRunPayrollApiFilters(filters, debouncedSearch),
    [filters, debouncedSearch],
  );

  const metaQuery = useQuery({
    queryKey: ["run-payroll", "meta", token, filters.month, filters.year, filters.companyId],
    queryFn: () =>
      getRunPayrollMeta(token!, {
        month: filters.month,
        year: filters.year,
        company_id: filters.companyId,
      }).then((res) => res.data as Record<string, unknown>),
    enabled: Boolean(token),
    staleTime: META_STALE_TIME,
  });

  const summaryQuery = useQuery({
    queryKey: ["run-payroll", "summary", token, apiFilters],
    queryFn: () =>
      getRunPayrollSummary(token!, apiFilters).then((res) => res.data as Record<string, unknown>),
    enabled: Boolean(token),
  });

  const employeesQuery = useQuery({
    queryKey: [
      "run-payroll",
      "employees",
      token,
      apiFilters,
      tableParams.page,
      tableParams.perPage,
      tableParams.sortBy,
      tableParams.sortDir,
    ],
    queryFn: () =>
      getRunPayrollEmployees(token!, {
        ...apiFilters,
        page: tableParams.page,
        per_page: tableParams.perPage,
        sort_by: tableParams.sortBy,
        sort_dir: tableParams.sortDir,
      }).then((res) => res.data as Record<string, unknown>),
    enabled: Boolean(token),
  });

  const meta = metaQuery.data;
  const summaryData = summaryQuery.data;
  const employeesData = employeesQuery.data;

  const filterOptions = useMemo((): RunPayrollFilterOptions => {
    const raw = (meta?.filter_options ?? {}) as Record<string, unknown>;

    return {
      ...(raw as Omit<RunPayrollFilterOptions, "months">),
      months: resolvePayrollMonthOptions(
        raw.months as Array<{ value: number; label: string }> | undefined,
      ),
    };
  }, [meta?.filter_options]);
  const period = (meta?.period ?? {}) as Record<string, unknown>;
  const actions = (meta?.actions ?? {}) as Record<string, string>;

  const summaryStats: PayrollSummaryStats = useMemo(
    () => mapApiSummaryStats(summaryData?.summary as Record<string, unknown> | undefined),
    [summaryData?.summary],
  );

  const payrollRows: PayrollStaffRow[] = useMemo(() => {
    const list = Array.isArray(employeesData?.employees)
      ? (employeesData.employees as Record<string, unknown>[])
      : [];
    return list.map(mapEmployeeToPayrollRow);
  }, [employeesData?.employees]);

  const pagination = (employeesData?.pagination ?? {}) as Record<string, number>;
  const selectionSummary = (employeesData?.selection_summary ?? {}) as Record<string, number>;
  const periodLabel =
    String(period.label ?? "") || String(employeesData?.period_label ?? "");

  const isLoading =
    (metaQuery.isLoading && !meta) ||
    (summaryQuery.isLoading && !summaryData) ||
    (employeesQuery.isLoading && !employeesData);

  const isRefreshing =
    (metaQuery.isFetching && Boolean(meta)) ||
    (summaryQuery.isFetching && Boolean(summaryData)) ||
    (employeesQuery.isFetching && Boolean(employeesData));

  const refetchAfterMutation = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["run-payroll", "summary"] }),
      queryClient.invalidateQueries({ queryKey: ["run-payroll", "employees"] }),
    ]);
  }, [queryClient]);

  const refetchMeta = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["run-payroll", "meta"] });
  }, [queryClient]);

  return {
    meta,
    filterOptions,
    period,
    actions,
    summaryStats,
    payrollRows,
    pagination,
    selectionSummary,
    periodLabel,
    isLoading,
    isRefreshing,
    refetchAfterMutation,
    refetchMeta,
  };
}

export type { RunPayrollSortBy, RunPayrollSortDir, RunPayrollTableParams };
