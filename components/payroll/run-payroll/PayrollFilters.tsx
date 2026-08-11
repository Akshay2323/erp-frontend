"use client";

import { memo } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RunPayrollFilterState, SalaryCalculationMode } from "@/lib/payroll/run-payroll-types";
import { resolvePayrollMonthOptions } from "@/lib/payroll/month-options";

const selectClass =
  "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

type FilterOptions = {
  months?: Array<{ value: number; label: string }>;
  companies?: Array<{ id: number; name: string }>;
  branches?: Array<{ id: number; name: string }>;
  departments?: Array<{ id: number; name: string }>;
  designations?: Array<{ id: number; name: string }>;
  employment_types?: Array<{ value: string; label: string }>;
  calculation_modes?: Array<{ value: string; label: string }>;
};

type PayrollFiltersProps = {
  filters: RunPayrollFilterState;
  filterOptions: FilterOptions;
  onChange: <K extends keyof RunPayrollFilterState>(key: K, value: RunPayrollFilterState[K]) => void;
  onReset: () => void;
  onGenerate: () => void;
  generating?: boolean;
};

export const PayrollFilters = memo(function PayrollFilters({
  filters,
  filterOptions,
  onChange,
  onReset,
  onGenerate,
  generating,
}: PayrollFiltersProps) {
  const months = resolvePayrollMonthOptions(filterOptions.months);

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/50 pb-4 pt-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filters
        </div>
        <Button variant="link" className="h-auto p-0 text-sm font-medium text-sky-500" onClick={onReset}>
          Reset
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="space-y-2">
          <Label className="text-xs font-normal text-muted-foreground">Payroll Month</Label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filters.month}
              onChange={(e) => onChange("month", Number(e.target.value))}
              className={selectClass}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={2020}
              max={2100}
              value={filters.year}
              onChange={(e) => onChange("year", Number(e.target.value))}
              className="h-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-normal text-muted-foreground">Salary Calculation</Label>
          <select
            value={filters.calculationMode}
            onChange={(e) => onChange("calculationMode", e.target.value as SalaryCalculationMode)}
            className={selectClass}
          >
            {filterOptions.calculation_modes?.length ? (
              filterOptions.calculation_modes.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))
            ) : (
              <>
                <option value="hour">Hour Based</option>
                <option value="day">Day Based</option>
              </>
            )}
          </select>
        </div>

        <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.includeOvertime}
              onChange={(e) => onChange("includeOvertime", e.target.checked)}
              className="rounded border-input"
            />
            Include Overtime
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.includePenalty}
              onChange={(e) => onChange("includePenalty", e.target.checked)}
              className="rounded border-input"
            />
            Apply Penalty Deduction
          </label>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-normal text-muted-foreground">Company</Label>
          <select
            value={filters.companyId}
            onChange={(e) => onChange("companyId", e.target.value)}
            className={selectClass}
          >
            <option value="all">All Companies</option>
            {filterOptions.companies?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-normal text-muted-foreground">Branch</Label>
          <select
            value={filters.branchId}
            onChange={(e) => onChange("branchId", e.target.value)}
            className={selectClass}
          >
            <option value="all">All Branches</option>
            {filterOptions.branches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-normal text-muted-foreground">Department</Label>
          <select
            value={filters.departmentId}
            onChange={(e) => onChange("departmentId", e.target.value)}
            className={selectClass}
          >
            <option value="all">All Departments</option>
            {filterOptions.departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-normal text-muted-foreground">Designation</Label>
          <select
            value={filters.designationId}
            onChange={(e) => onChange("designationId", e.target.value)}
            className={selectClass}
          >
            <option value="all">All Designations</option>
            {filterOptions.designations?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-normal text-muted-foreground">Employment Type</Label>
          <select
            value={filters.employmentType}
            onChange={(e) => onChange("employmentType", e.target.value)}
            className={selectClass}
          >
            <option value="all">All Types</option>
            {filterOptions.employment_types?.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            )) ?? (
              <>
                <option value="full_time">Full Time</option>
                <option value="hourly">Hourly / Part Time</option>
                <option value="contract">Contract</option>
              </>
            )}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-normal text-muted-foreground">Employee Status</Label>
          <select
            value={filters.employeeStatus}
            onChange={(e) => onChange("employeeStatus", e.target.value)}
            className={selectClass}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-normal text-muted-foreground">Search Employee</Label>
          <Input
            value={filters.searchQuery}
            onChange={(e) => onChange("searchQuery", e.target.value)}
            placeholder="Name, code, role…"
            className="h-10"
          />
        </div>

        <label className="flex items-center gap-2 pt-1 text-sm">
          <input
            type="checkbox"
            checked={filters.showPendingOnly}
            onChange={(e) => onChange("showPendingOnly", e.target.checked)}
            className="rounded border-input"
          />
          Show Only Pending Payroll
        </label>

        <Button className="w-full" onClick={onGenerate} disabled={generating}>
          {generating ? "Generating…" : "Generate Payroll"}
        </Button>
      </CardContent>
    </Card>
  );
});
