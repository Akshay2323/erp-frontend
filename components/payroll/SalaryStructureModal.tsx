"use client";

import { X, Search, Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import type { Company } from "@/lib/api/company";
import { getEmployees, type EmployeeRecord } from "@/lib/api/employees/methods";
import type {
  EmployeeSalaryStructure,
  SalaryComponent,
  PayrollApiError,
  CreateSalaryStructurePayload,
  UpdateSalaryStructurePayload,
} from "@/lib/api/payroll";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type SalaryStructureModalProps = {
  open: boolean;
  mode: "create" | "edit" | "view";
  loading: boolean;
  initialData?: EmployeeSalaryStructure | null;
  companies: Company[];
  components: SalaryComponent[];
  token: string;
  serverError?: PayrollApiError | null;
  onClose: () => void;
  onSubmit: (
    payload: CreateSalaryStructurePayload | UpdateSalaryStructurePayload,
  ) => Promise<void>;
};

const formSchema = z.object({
  employee_id: z.number().min(1, "Employee is required"),
  basic_salary: z.number().min(0, "Basic salary must be 0 or more"),
  effective_from: z.string().min(1, "Effective date is required"),
  status: z.enum(["active", "inactive"]),
  items: z.array(
    z.object({
      salary_component_id: z.number().min(1, "Component is required"),
      amount: z.number().min(0, "Amount must be 0 or more"),
      type: z.enum(["earning", "deduction"]),
    })
  ),
});

type FormValues = z.infer<typeof formSchema>;

const inputStyles =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary";

export function SalaryStructureModal({
  open,
  mode,
  loading,
  initialData,
  companies,
  components,
  token,
  serverError,
  onClose,
  onSubmit,
}: SalaryStructureModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const isViewOnly = mode === "view";

  // Employee Autocomplete State
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [employeesList, setEmployeesList] = useState<EmployeeRecord[]>([]);
  const [fetchingEmployees, setFetchingEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employee_id: 0,
      basic_salary: 0,
      effective_from: new Date().toISOString().split("T")[0],
      status: "active",
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  // Fetch employees on search input change
  useEffect(() => {
    if (!open || mode !== "create") return;
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
  }, [employeeSearch, open, mode, token]);

  // Load initial data
  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      reset({
        employee_id: 0,
        basic_salary: 0,
        effective_from: new Date().toISOString().split("T")[0],
        status: "active",
        items: [],
      });
      setSelectedEmployee(null);
      setEmployeeSearch("");
    } else if (initialData) {
      reset({
        employee_id: initialData.employee_id,
        basic_salary: Number(initialData.basic_salary),
        effective_from: initialData.effective_from,
        status: initialData.status,
        items: initialData.items.map((item) => ({
          salary_component_id: item.salary_component_id,
          amount: Number(item.amount),
          type: item.type,
        })),
      });

      if (initialData.employee) {
        setSelectedEmployee({
          id: initialData.employee_id,
          first_name: initialData.employee.first_name,
          last_name: initialData.employee.last_name,
          employee_code: initialData.employee.employee_code || "",
        } as EmployeeRecord);
      }
    }
  }, [open, initialData, mode, reset]);

  // Escape key handler and keyboard trap
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusables = modalRef.current?.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Calculations
  const basicSalaryVal = watch("basic_salary") || 0;
  const itemsVal = watch("items") || [];

  const totals = useMemo(() => {
    let earnings = 0;
    let deductions = 0;
    itemsVal.forEach((item) => {
      if (item.type === "earning") {
        earnings += Number(item.amount || 0);
      } else if (item.type === "deduction") {
        deductions += Number(item.amount || 0);
      }
    });
    const gross = Number(basicSalaryVal) + earnings;
    const net = gross - deductions;

    return {
      earnings,
      deductions,
      gross,
      net,
    };
  }, [basicSalaryVal, itemsVal]);

  const componentsMap = useMemo(
    () => new Map<number, SalaryComponent>(components.map((c) => [c.id, c])),
    [components]
  );

  const availableComponents = useMemo(() => {
    const selectedIds = new Set(itemsVal.map((i) => i.salary_component_id));
    return components.filter((c) => c.status === "active" && !selectedIds.has(c.id));
  }, [components, itemsVal]);

  const addComponent = (componentId: number) => {
    const comp = componentsMap.get(componentId);
    if (!comp) return;
    append({
      salary_component_id: comp.id,
      amount: comp.default_amount != null ? Number(comp.default_amount) : 0,
      type: comp.type,
    });
  };

  const fieldError = (name: string) =>
    (errors as Record<string, { message?: string } | undefined>)[name]?.message ||
    serverError?.fieldErrors?.[name]?.[0];

  const submit = async (values: FormValues) => {
    const payload = {
      employee_id: values.employee_id,
      basic_salary: values.basic_salary,
      gross_salary: totals.gross,
      effective_from: values.effective_from,
      status: values.status,
      items: values.items.map((it) => ({
        salary_component_id: it.salary_component_id,
        amount: it.amount,
        type: it.type,
      })),
    };

    await onSubmit(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 overflow-y-auto">
      <div
        aria-modal="true"
        className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-xl my-8"
        ref={modalRef}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isViewOnly
              ? "Salary Structure Details"
              : mode === "create"
                ? "Create Salary Structure"
                : "Edit Salary Structure"}
          </h2>
          <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form className="p-6 space-y-6" onSubmit={isViewOnly ? (e) => e.preventDefault() : handleSubmit(submit)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Employee Field */}
            <div className="relative md:col-span-2">
              <label className="text-sm font-medium text-foreground">Employee</label>
              {mode !== "create" || isViewOnly ? (
                <div className={`${inputStyles} bg-muted/40 text-muted-foreground`}>
                  {selectedEmployee
                    ? `${selectedEmployee.employee_code || "N/A"} - ${selectedEmployee.first_name} ${selectedEmployee.last_name}`
                    : `Employee ID: ${initialData?.employee_id}`}
                </div>
              ) : (
                <>
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
                      value={selectedEmployee ? `${selectedEmployee.employee_code} - ${selectedEmployee.first_name} ${selectedEmployee.last_name}` : employeeSearch}
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
                </>
              )}
            </div>

            {/* Status Field */}
            <div>
              <label className="text-sm font-medium text-foreground">Status</label>
              {isViewOnly ? (
                <div className={`${inputStyles} bg-muted/40 text-foreground capitalize`}>
                  {initialData?.status}
                </div>
              ) : (
                <select className={inputStyles} {...register("status")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              )}
            </div>

            {/* Basic Salary */}
            <div>
              <label className="text-sm font-medium text-foreground">Basic Salary (₹)</label>
              {isViewOnly ? (
                <div className={`${inputStyles} bg-muted/40 text-foreground`}>
                  ₹{Number(initialData?.basic_salary || 0).toLocaleString("en-IN")}
                </div>
              ) : (
                <>
                  <Input
                    className={inputStyles}
                    type="number"
                    step="0.01"
                    placeholder="e.g. 25000"
                    {...register("basic_salary", { valueAsNumber: true })}
                  />
                  {fieldError("basic_salary") ? (
                    <p className="mt-1 text-xs text-destructive">{fieldError("basic_salary")}</p>
                  ) : null}
                </>
              )}
            </div>

            {/* Effective From */}
            <div>
              <label className="text-sm font-medium text-foreground">Effective From</label>
              {isViewOnly ? (
                <div className={`${inputStyles} bg-muted/40 text-foreground`}>
                  {initialData?.effective_from}
                </div>
              ) : (
                <>
                  <Input className={inputStyles} type="date" {...register("effective_from")} />
                  {fieldError("effective_from") ? (
                    <p className="mt-1 text-xs text-destructive">{fieldError("effective_from")}</p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* Salary Breakdown Summary Panel */}
          <div className="grid grid-cols-2 gap-4 rounded-2xl bg-muted/40 p-4 md:grid-cols-4">
            <div>
              <span className="text-xs text-muted-foreground">Basic Salary</span>
              <p className="text-lg font-semibold text-foreground">
                ₹{Number(basicSalaryVal || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Total Earnings (+)</span>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                ₹{totals.earnings.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Total Deductions (-)</span>
              <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                ₹{totals.deductions.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-bold">Gross Salary (Base + Earnings)</span>
              <p className="text-lg font-bold text-primary">
                ₹{totals.gross.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Component Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-md font-semibold text-foreground">Salary Components</h3>
              {!isViewOnly && availableComponents.length > 0 && (
                <div className="relative">
                  <select
                    className="h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onChange={(e) => {
                      if (e.target.value) {
                        addComponent(Number(e.target.value));
                        e.target.value = "";
                      }
                    }}
                    value=""
                  >
                    <option value="">Add component...</option>
                    {availableComponents.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        [{comp.type.toUpperCase()}] {comp.name} ({comp.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {fields.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">
                No components added to this structure yet. Add some allowances or deductions above.
              </p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const compId = watch(`items.${index}.salary_component_id`);
                  const comp = componentsMap.get(compId);
                  const type = watch(`items.${index}.type`);

                  return (
                    <div
                      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
                      key={field.id}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {comp?.name || `Component ID: ${compId}`}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {comp?.code}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                              type === "earning"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-36">
                          <label className="text-xs text-muted-foreground">Amount (₹)</label>
                          {isViewOnly ? (
                            <div className="text-sm font-semibold py-1">
                              ₹{Number(watch(`items.${index}.amount`) || 0).toLocaleString("en-IN")}
                            </div>
                          ) : (
                            <Input
                              className="h-9 mt-0.5"
                              type="number"
                              step="0.01"
                              {...register(`items.${index}.amount`, { valueAsNumber: true })}
                            />
                          )}
                        </div>

                        {!isViewOnly && (
                          <Button
                            className="mt-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => remove(index)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {serverError?.message ? (
            <p className="text-sm text-destructive">{serverError.message}</p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button onClick={onClose} type="button" variant="outline">
              {isViewOnly ? "Close" : "Cancel"}
            </Button>
            {!isViewOnly && (
              <Button disabled={loading} type="submit">
                {loading
                  ? "Saving..."
                  : mode === "create"
                    ? "Create Structure"
                    : "Update Structure"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
