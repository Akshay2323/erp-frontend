"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, Info } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageRefreshingBadge, PayrollPageSkeleton } from "@/components/ui/page-states";
import { getPayrollWorkspace } from "@/lib/api/payroll";
import type { SalaryCalculationMode } from "@/lib/payroll/run-payroll-types";
import { useAuthToken } from "@/lib/use-auth-token";

const selectClass =
  "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function PayrollSummaryPage() {
  const token = useAuthToken();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [companyId, setCompanyId] = useState<string>("all");
  const [branchId, setBranchId] = useState<string>("all");
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [calculationMode, setCalculationMode] = useState<SalaryCalculationMode>("hour");

  const query = useQuery({
    queryKey: ["payroll-workspace", "summary", token, month, year, companyId, branchId, departmentId, calculationMode],
    queryFn: () =>
      getPayrollWorkspace(token, {
        screen: "summary",
        month,
        year,
        company_id: companyId,
        branch_id: branchId,
        department_id: departmentId,
        calculation_mode: calculationMode,
      }).then((res) => res.data as Record<string, any>),
    enabled: Boolean(token),
  });

  const data = query.data;
  const showSkeleton = query.isLoading && !data;
  const showRefreshing = query.isFetching && Boolean(data);

  const payroll_summary = data?.payroll_summary;
  const filter_options = data?.filter_options ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">
          {payroll_summary?.period_label
            ? `${payroll_summary.period_label} Payroll Summary`
            : "Payroll Summary"}
        </h1>
        <PageRefreshingBadge show={showRefreshing} />
      </div>

      {showSkeleton ? (
        <PayrollPageSkeleton />
      ) : data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <Card className="rounded-xl border border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/50 pb-4 pt-5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </div>
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm text-sky-500 font-medium"
                  onClick={() => {
                    setMonth(now.getMonth() + 1);
                    setYear(now.getFullYear());
                    setCompanyId("all");
                    setBranchId("all");
                    setDepartmentId("all");
                    setCalculationMode("hour");
                  }}
                >
                  Reset
                </Button>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-normal text-muted-foreground">Salary Calculation</Label>
                  <select
                    value={calculationMode}
                    onChange={(e) => setCalculationMode(e.target.value as SalaryCalculationMode)}
                    className={selectClass}
                  >
                    {filter_options.calculation_modes?.length ? (
                      filter_options.calculation_modes.map((m: { value: string; label: string }) => (
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

                <div className="space-y-2">
                  <Label className="text-xs font-normal text-muted-foreground">Payroll Month</Label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className={selectClass}
                  >
                    {filter_options.months?.map((m: { value: number; label: string }) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-normal text-muted-foreground">Company</Label>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="all">All Companies</option>
                    {filter_options.companies?.map((c: { id: number; name: string }) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-normal text-muted-foreground">Company Branches</Label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="all">All Branches</option>
                    {filter_options.branches?.map((b: { id: number; name: string }) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-normal text-muted-foreground">Departments</Label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="all">All Departments</option>
                    {filter_options.departments?.map((d: { id: number; name: string }) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-9">
            <Card className="rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex flex-col">
                {payroll_summary?.payroll_summary_cards?.map((card: { key: string; label: string; staff_count: number; amount: number }, idx: number) => (
                  <div
                    key={card.key}
                    className={`flex items-center justify-between p-5 hover:bg-muted/30 transition-colors ${idx !== (payroll_summary.payroll_summary_cards?.length ?? 0) - 1 ? "border-b border-border/50" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{card.label}</span>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-12 sm:gap-24 text-sm">
                      <span className="text-muted-foreground">{card.staff_count} Staff</span>
                      <span className="font-medium text-right w-24">
                        ₹ {card.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="border-b border-border/50 bg-muted/10 p-5">
                <h2 className="text-sm font-bold">Earning Details</h2>
              </div>
              <div className="flex flex-col">
                {payroll_summary?.earning_details?.map((item: { key: string; label: string; staff_count: number; amount: number }, i: number) => (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between p-5 hover:bg-muted/30 transition-colors ${i !== (payroll_summary.earning_details?.length ?? 0) - 1 ? "border-b border-border/50" : ""}`}
                  >
                    <span className="text-sm text-foreground">{item.label}</span>
                    <div className="flex items-center gap-12 sm:gap-24 text-sm">
                      <span className="text-muted-foreground">{item.staff_count} Staff</span>
                      <span className="font-medium text-right w-24">
                        ₹ {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Unable to load payroll summary.</p>
      )}
    </div>
  );
}
