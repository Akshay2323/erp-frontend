"use client";

import { X, Search, Check, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { getEmployees, type EmployeeRecord } from "@/lib/api/employees/methods";
import {
  createPayrollRun,
  type StorePayrollRunPayload,
  type PayrollApiError,
} from "@/lib/api/payroll";
import type { Company } from "@/lib/api/company";
import type { Department } from "@/lib/api/department";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type GeneratePayrollModalProps = {
  open: boolean;
  token: string;
  companies: Company[];
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
};

const formSchema = z.object({
  employee_id: z.number().optional(),
  month: z.number().min(1, "Month must be between 1 and 12").max(12, "Month must be between 1 and 12"),
  year: z.number().min(2000, "Year must be 2000 or greater"),
  lop_days: z.number().min(0, "LOP Days must be 0 or greater").nullable().optional(),
  remarks: z.string().trim().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const inputStyles =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary";

export function GeneratePayrollModal({
  open,
  token,
  companies,
  departments,
  onClose,
  onSuccess,
}: GeneratePayrollModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Tab State: 'single' | 'bulk'
  const [tab, setTab] = useState<"single" | "bulk">("single");

  // Employee Autocomplete State
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [employeesList, setEmployeesList] = useState<EmployeeRecord[]>([]);
  const [fetchingEmployees, setFetchingEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);

  // Bulk State
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");
  const [selectedDeptId, setSelectedDeptId] = useState<number | "">("");
  const [bulkStatus, setBulkStatus] = useState<"idle" | "fetching" | "processing" | "completed">("idle");
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, employeeName: "" });

  type BulkResultItem = {
    employeeName: string;
    employeeCode: string;
    success: boolean;
    error?: string;
  };
  const [bulkResults, setBulkResults] = useState<BulkResultItem[]>([]);

  // Submitting state for Single mode
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<PayrollApiError | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employee_id: 0,
      month: currentMonth,
      year: currentYear,
      lop_days: 0,
      remarks: "",
    },
  });

  // Fetch employees on search input change
  useEffect(() => {
    if (!open || tab !== "single") return;
    const fetchEmps = async () => {
      setFetchingEmployees(true);
      try {
        const response = await getEmployees(token, {
          q: employeeSearch,
          status: "active",
          page: 1,
          per_page: 20,
        });
        const list = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.items)
            ? response.data.items
            : [];
        setEmployeesList(list);
      } catch (err) {
        console.error("Failed to fetch employees", err);
      } finally {
        setFetchingEmployees(false);
      }
    };

    const delay = setTimeout(fetchEmps, 300);
    return () => clearTimeout(delay);
  }, [employeeSearch, open, token, tab]);

  // Reset form when modal opens or tab changes
  useEffect(() => {
    if (!open) return;
    reset({
      employee_id: 0,
      month: currentMonth,
      year: currentYear,
      lop_days: 0,
      remarks: "",
    });
    setSelectedEmployee(null);
    setEmployeeSearch("");
    setSelectedCompanyId("");
    setSelectedDeptId("");
    setBulkStatus("idle");
    setBulkResults([]);
    setServerError(null);
  }, [open, tab, reset, currentMonth, currentYear]);

  // Keyboard accessibility
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && bulkStatus !== "processing" && bulkStatus !== "fetching") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, bulkStatus]);

  const fieldError = (name: string) =>
    (errors as Record<string, { message?: string } | undefined>)[name]?.message ||
    serverError?.fieldErrors?.[name]?.[0];

  // Submit Single Employee Payroll
  const submitSingle = async (values: FormValues) => {
    if (!values.employee_id || values.employee_id <= 0) {
      toast.error("Please select an employee.");
      return;
    }

    setSubmitting(true);
    setServerError(null);

    try {
      await createPayrollRun(token, {
        employee_id: values.employee_id,
        month: values.month,
        year: values.year,
        lop_days: values.lop_days ?? 0,
        remarks: values.remarks || null,
      });
      toast.success("Payroll run generated successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      setServerError(err);
      toast.error(err.message || "Failed to generate payroll run.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Bulk Payroll Generation
  const submitBulk = async () => {
    if (!selectedCompanyId) {
      toast.error("Please select a company.");
      return;
    }

    setBulkStatus("fetching");
    setBulkResults([]);
    setServerError(null);

    try {
      // 1. Fetch active employees
      let allEmployees: EmployeeRecord[] = [];
      let currentPage = 1;
      let lastPage = 1;

      do {
        const res = await getEmployees(token, {
          company_id: String(selectedCompanyId),
          department_id: selectedDeptId ? String(selectedDeptId) : undefined,
          status: "active",
          page: currentPage,
          per_page: 100,
        });
        const items = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.items)
            ? res.data.items
            : [];
        allEmployees = [...allEmployees, ...items];

        const meta = res.meta as any;
        lastPage = meta?.pagination?.last_page ?? meta?.last_page ?? 1;
        currentPage++;
      } while (currentPage <= lastPage);

      if (allEmployees.length === 0) {
        toast.error("No active employees found matching the filters.");
        setBulkStatus("idle");
        return;
      }

      // 2. Loop through sequential generations
      setBulkStatus("processing");
      setBulkProgress({ current: 0, total: allEmployees.length, employeeName: "" });

      const results: BulkResultItem[] = [];
      const month = Number(watch("month"));
      const year = Number(watch("year"));
      const remarks = watch("remarks") || null;

      for (let i = 0; i < allEmployees.length; i++) {
        const emp = allEmployees[i];
        const empName = `${emp.first_name} ${emp.last_name}`;
        setBulkProgress({
          current: i + 1,
          total: allEmployees.length,
          employeeName: `${emp.employee_code} - ${empName}`,
        });

        try {
          await createPayrollRun(token, {
            employee_id: emp.id,
            month,
            year,
            remarks,
          });
          results.push({
            employeeName: empName,
            employeeCode: emp.employee_code || "-",
            success: true,
          });
        } catch (err: any) {
          results.push({
            employeeName: empName,
            employeeCode: emp.employee_code || "-",
            success: false,
            error: err.message || "Failed to generate",
          });
        }
      }

      setBulkResults(results);
      setBulkStatus("completed");
      onSuccess(); // reload payroll runs list
    } catch (err: any) {
      toast.error("An error occurred during bulk generation.");
      setBulkStatus("idle");
    }
  };

  if (!open) return null;

  // Compute stats for completion summary
  const successCount = bulkResults.filter((r) => r.success).length;
  const failCount = bulkResults.filter((r) => !r.success).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 overflow-y-auto">
      <div
        aria-modal="true"
        className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
        ref={modalRef}
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Generate Payroll Run
          </h2>
          {bulkStatus !== "processing" && bulkStatus !== "fetching" && (
            <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Tab Selection (only if not processing bulk) */}
        {bulkStatus === "idle" && (
          <div className="flex border-b border-border bg-muted/20">
            <button
              type="button"
              className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition ${
                tab === "single"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("single")}
            >
              Single Employee
            </button>
            <button
              type="button"
              className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition ${
                tab === "bulk"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("bulk")}
            >
              Bulk Generation
            </button>
          </div>
        )}

        {/* Processing State */}
        {(bulkStatus === "fetching" || bulkStatus === "processing") && (
          <div className="p-8 flex flex-col items-center justify-center space-y-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center space-y-2 w-full">
              <h3 className="font-semibold text-foreground">
                {bulkStatus === "fetching" ? "Fetching Active Employees..." : "Processing Payroll Runs..."}
              </h3>
              {bulkStatus === "processing" && (
                <>
                  <p className="text-xs text-muted-foreground font-medium">
                    {bulkProgress.employeeName}
                  </p>
                  <p className="text-sm text-primary font-semibold mt-1">
                    Employee {bulkProgress.current} of {bulkProgress.total}
                  </p>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-4">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Completed/Summary State */}
        {bulkStatus === "completed" && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Generation Completed</h3>
              <p className="text-sm text-muted-foreground">
                Bulk payroll run generation process has finished.
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-border bg-muted/20 text-center">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Total</div>
                <div className="text-lg font-bold text-foreground mt-0.5">{bulkResults.length}</div>
              </div>
              <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
                <div className="text-xs font-semibold text-emerald-600 uppercase">Succeeded</div>
                <div className="text-lg font-bold text-emerald-600 mt-0.5">{successCount}</div>
              </div>
              <div className="p-3 rounded-xl border border-destructive/20 bg-destructive/5 text-center">
                <div className="text-xs font-semibold text-destructive uppercase">Failed</div>
                <div className="text-lg font-bold text-destructive mt-0.5">{failCount}</div>
              </div>
            </div>

            {/* Error Lists */}
            {failCount > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  Generation Failures ({failCount})
                </h4>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-destructive/10 bg-destructive/5 p-3.5 space-y-2">
                  {bulkResults
                    .filter((r) => !r.success)
                    .map((r, idx) => (
                      <div className="text-xs flex flex-col sm:flex-row sm:justify-between border-b border-destructive/10 pb-1.5 last:border-0 last:pb-0" key={idx}>
                        <span className="font-semibold text-destructive">
                          {r.employeeCode} - {r.employeeName}
                        </span>
                        <span className="text-destructive/80 italic mt-0.5 sm:mt-0">
                          {r.error}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        )}

        {/* Standard Forms */}
        {bulkStatus === "idle" && (
          <form className="p-6 space-y-4" onSubmit={handleSubmit(submitSingle)}>
            {/* Tab: Single Employee */}
            {tab === "single" && (
              <div className="relative">
                <label className="text-sm font-medium text-foreground">Employee</label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary"
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setEmployeeDropdownOpen(true);
                    }}
                    onFocus={() => setEmployeeDropdownOpen(true)}
                    placeholder="Search employee by name or code..."
                    type="text"
                    value={
                      selectedEmployee
                        ? `${selectedEmployee.employee_code} - ${selectedEmployee.first_name} ${selectedEmployee.last_name}`
                        : employeeSearch
                    }
                  />
                  {selectedEmployee && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedEmployee(null);
                        setEmployeeSearch("");
                        setValue("employee_id", 0);
                      }}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {employeeDropdownOpen && !selectedEmployee && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                    {fetchingEmployees ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground">Searching...</div>
                    ) : employeesList.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground">No employees found</div>
                    ) : (
                      employeesList.map((emp) => (
                        <button
                          className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-foreground hover:bg-muted/50"
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setValue("employee_id", emp.id);
                            setEmployeeDropdownOpen(false);
                          }}
                          type="button"
                        >
                          <span>
                            {emp.employee_code} - {emp.first_name} {emp.last_name}
                          </span>
                          <Check className="h-4 w-4 text-primary opacity-0 hover:opacity-100" />
                        </button>
                      ))
                    )}
                  </div>
                )}
                {fieldError("employee_id") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("employee_id")}</p>
                ) : null}
              </div>
            )}

            {/* Tab: Bulk Employees */}
            {tab === "bulk" && (
              <div className="grid grid-cols-2 gap-4">
                {/* Company Select */}
                <div>
                  <label className="text-sm font-medium text-foreground">Company</label>
                  <select
                    className={inputStyles}
                    onChange={(e) => setSelectedCompanyId(Number(e.target.value) || "")}
                    value={selectedCompanyId}
                  >
                    <option value="">Select Company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department Select */}
                <div>
                  <label className="text-sm font-medium text-foreground">Department</label>
                  <select
                    className={inputStyles}
                    onChange={(e) => setSelectedDeptId(Number(e.target.value) || "")}
                    value={selectedDeptId}
                  >
                    <option value="">All Departments</option>
                    {departments
                      .filter((d) => !selectedCompanyId || d.company_id === selectedCompanyId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {/* Shared Month and Year Inputs */}
            <div className="grid grid-cols-2 gap-4">
              {/* Month */}
              <div>
                <label className="text-sm font-medium text-foreground">Month</label>
                <select className={inputStyles} {...register("month", { valueAsNumber: true })}>
                  <option value={1}>January</option>
                  <option value={2}>February</option>
                  <option value={3}>March</option>
                  <option value={4}>April</option>
                  <option value={5}>May</option>
                  <option value={6}>June</option>
                  <option value={7}>July</option>
                  <option value={8}>August</option>
                  <option value={9}>September</option>
                  <option value={10}>October</option>
                  <option value={11}>November</option>
                  <option value={12}>December</option>
                </select>
                {fieldError("month") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("month")}</p>
                ) : null}
              </div>

              {/* Year */}
              <div>
                <label className="text-sm font-medium text-foreground">Year</label>
                <Input
                  className={inputStyles}
                  type="number"
                  {...register("year", { valueAsNumber: true })}
                />
                {fieldError("year") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("year")}</p>
                ) : null}
              </div>
            </div>

            {/* Single Mode specific: LOP Days */}
            {tab === "single" && (
              <div>
                <label className="text-sm font-medium text-foreground">LOP Days (Loss of Pay)</label>
                <Input
                  className={inputStyles}
                  type="number"
                  step="0.5"
                  placeholder="e.g. 1.5 (Leave blank or 0 for none)"
                  {...register("lop_days", {
                    valueAsNumber: true,
                    setValueAs: (v) => (v === "" ? 0 : Number(v)),
                  })}
                />
                {fieldError("lop_days") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("lop_days")}</p>
                ) : null}
              </div>
            )}

            {/* Remarks */}
            <div>
              <label className="text-sm font-medium text-foreground">Remarks</label>
              <Input
                className={inputStyles}
                placeholder={tab === "bulk" ? "e.g. Batch generation notes" : "e.g. Special bonus adjustments"}
                type="text"
                {...register("remarks")}
              />
              {fieldError("remarks") ? (
                <p className="mt-1 text-xs text-destructive">{fieldError("remarks")}</p>
              ) : null}
            </div>

            {serverError?.message ? (
              <p className="text-sm text-destructive">{serverError.message}</p>
            ) : null}

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button onClick={onClose} type="button" variant="outline">
                Cancel
              </Button>
              {tab === "single" ? (
                <Button disabled={submitting} type="submit">
                  {submitting ? "Generating..." : "Generate Payroll"}
                </Button>
              ) : (
                <Button disabled={!selectedCompanyId} onClick={submitBulk} type="button">
                  Generate Bulk Payroll
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
