"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarPlus,
  Coffee,
  Heart,
  Star,
  Compass,
  AlertCircle,
  Clock,
  Loader2,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Info
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  isEmployeeSession,
  readAuthUser,
  resolveCompanyId,
  resolveEmployeeId,
} from "@/lib/auth-session";
import { getCompanies, type Company } from "@/lib/api/company";
import { getEmployees, getEmployeeDetail, resolveEmployeeSession } from "@/lib/api/employee";
import { getLeavePolicies, getLeaveBalances } from "@/lib/api/leave-policy";
import { createLeaveRequest, type LeaveRequestApiError } from "@/lib/api/leave-requests";
import { useAuthToken } from "@/lib/use-auth-token";
import { cn } from "@/lib/utils";

const toNumber = (value: string | number) => Number(value);

const schema = z
  .object({
    company_id: z.number().min(0),
    employee_id: z.number().min(0),
    leave_name: z.string().min(1, "Please choose a leave type"),
    leave_category: z.enum(["paid", "unpaid"]),
    leave_duration: z.enum(["full_day", "half_day", "first_half", "second_half"]),
    from_date: z.string().min(1, "Please pick a start date"),
    to_date: z.string().min(1, "Please pick an end date"),
    reason: z
      .string()
      .min(1, "Please add a reason")
      .max(500, "Reason is too long")
      .refine((v) => v.trim().length >= 3, {
        message: "Please add a short reason (at least 3 characters)",
      }),
  })
  .refine((v) => v.leave_duration === "full_day" || v.from_date === v.to_date, {
    message: "Half-day/session leave is for one day only",
    path: ["to_date"],
  })
  .refine((v) => v.to_date >= v.from_date, {
    message: "End date cannot be before start date",
    path: ["to_date"],
  });

type FormValues = z.infer<typeof schema>;

const selectClass =
  "flex h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "flex h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const UNPAID_LEAVE_NAME = "Unpaid Leave";
const EMPTY_LIST: never[] = [];

const getLeaveIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("sick") || n.includes("medical")) return Heart;
  if (n.includes("casual")) return Coffee;
  if (n.includes("privilege") || n.includes("earned") || n.includes("annual")) return Star;
  if (n.includes("unpaid") || n.includes("lop") || n.includes("lwp")) return AlertCircle;
  return Compass;
};

function resolveLeavePolicyId(employee: Record<string, unknown> | null | undefined): number | null {
  if (!employee) return null;
  const jobDetail =
    employee.job_detail && typeof employee.job_detail === "object"
      ? (employee.job_detail as Record<string, unknown>)
      : null;
  const raw = jobDetail?.leave_policy_id ?? employee.leave_policy_id;
  const id = raw != null ? Number(raw) : Number.NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

function UnpaidLeaveCard({
  selected,
  onSelect,
}: {
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start p-4 rounded-xl border text-left transition-all relative overflow-hidden group w-full sm:max-w-xs",
        selected
          ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500 shadow-sm"
          : "border-border hover:border-amber-400/60 bg-background/50 hover:bg-amber-500/[0.02]",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "rounded-lg p-2 transition-colors",
            selected
              ? "bg-amber-500 text-white"
              : "bg-muted text-muted-foreground group-hover:bg-amber-500/10 group-hover:text-amber-500",
          )}
        >
          <AlertCircle className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="font-semibold text-sm leading-none">{UNPAID_LEAVE_NAME}</h3>
          <p className="text-xs text-muted-foreground mt-1">No deduction limit</p>
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight text-amber-500">∞</span>
        <span className="text-xs text-muted-foreground">days</span>
      </div>
    </button>
  );
}

export default function ApplyLeavePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAuthToken();
  const [submitting, setSubmitting] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionResolving, setSessionResolving] = useState(true);
  const [sessionError, setSessionError] = useState("");

  const [isEmployee, setIsEmployee] = useState(false);
  const prevCompanyRef = useRef(0);
  const prevEmployeeRef = useRef(0);
  const [employeeName, setEmployeeName] = useState("");
  // Keep session employee data in a ref as submit-time fallback
  const sessionEidRef = useRef<number>(0);
  const sessionCidRef = useRef<number>(0);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      company_id: 0,
      employee_id: 0,
      leave_name: "",
      leave_category: "paid",
      leave_duration: "full_day",
      from_date: "",
      to_date: "",
      reason: "",
    },
  });

  const companyId = watch("company_id");
  const employeeId = watch("employee_id");
  const leaveName = watch("leave_name");
  const leaveCategory = watch("leave_category");
  const leaveDuration = watch("leave_duration");
  const fromDate = watch("from_date");
  const toDate = watch("to_date");
  const reason = watch("reason");

  useEffect(() => {
    let cancelled = false;

    const initSession = async () => {
      const user = readAuthUser();
      const employee = isEmployeeSession(user);
      setIsEmployee(employee);
      setEmployeeName(user?.name ?? "");
      setSessionError("");

      let companyId = resolveCompanyId(user);
      let employeeId = resolveEmployeeId(user);

      const today = new Date().toISOString().split("T")[0];
      setValue("from_date", today);
      setValue("to_date", today);

      if (employee && token && user) {
        try {
          const resolved = await resolveEmployeeSession(token, user);
          if (cancelled) return;

          if (resolved?.employeeId) {
            employeeId = resolved.employeeId;
            try {
              localStorage.setItem(
                "auth_user",
                JSON.stringify({
                  ...user,
                  employee_id: resolved.employeeId,
                  employee_code: resolved.employeeCode ?? user.employee_code,
                }),
              );
            } catch {
              /* ignore */
            }
          }

          if (employeeId && !companyId) {
            const detail = await getEmployeeDetail(token, employeeId);
            if (cancelled) return;
            const emp =
              (detail?.data as { employee?: Record<string, unknown> })?.employee ??
              (detail?.data as Record<string, unknown> | undefined);
            const jobDetail =
              emp?.job_detail && typeof emp.job_detail === "object"
                ? (emp.job_detail as Record<string, unknown>)
                : null;
            const companyFromEmp = emp?.company_id ?? jobDetail?.company_id;
            if (companyFromEmp != null && !Number.isNaN(Number(companyFromEmp))) {
              companyId = Number(companyFromEmp);
            }
          }
        } catch {
          /* resolve via API on next attempt */
        }
      }

      if (cancelled) return;

      if (companyId) {
        sessionCidRef.current = companyId;
        setValue("company_id", companyId);
      }
      if (employeeId) {
        sessionEidRef.current = employeeId;
        setValue("employee_id", employeeId);
      }

      if (employee && !employeeId) {
        setSessionError(
          "Could not determine your employee profile. Please ensure your account is linked to an employee record.",
        );
      }

      setAuthReady(true);
      setSessionResolving(false);
    };

    void initSession();

    return () => {
      cancelled = true;
    };
  }, [setValue, token]);

  useEffect(() => {
    if (leaveDuration !== "full_day" && fromDate) {
      setValue("to_date", fromDate);
    }
  }, [leaveDuration, fromDate, setValue]);

  // Reset leave selection when company changes
  useEffect(() => {
    if (prevCompanyRef.current > 0 && prevCompanyRef.current !== companyId) {
      setValue("leave_name", "");
      setValue("leave_category", "paid");
    }
    prevCompanyRef.current = companyId;
  }, [companyId, setValue]);

  // Reset leave selection when admin changes employee
  useEffect(() => {
    if (prevEmployeeRef.current > 0 && prevEmployeeRef.current !== employeeId) {
      setValue("leave_name", "");
      setValue("leave_category", "paid");
    }
    prevEmployeeRef.current = employeeId;
  }, [employeeId, setValue]);

  const companiesQuery = useQuery({
    queryKey: ["companies-options", token],
    queryFn: () => getCompanies(token, 1, 100),
    enabled: Boolean(token) && !isEmployee,
  });

  const employeesQuery = useQuery({
    queryKey: ["employees-apply-leave", token, companyId],
    queryFn: () =>
      getEmployees(token, {
        company_id: String(companyId),
        status: "active",
        per_page: 100,
        page: 1,
      }),
    enabled: Boolean(token) && companyId > 0 && !isEmployee,
  });

  const policiesQuery = useQuery({
    queryKey: ["leave-policies-apply", token, companyId],
    queryFn: () =>
      getLeavePolicies(token, {
        company_id: String(companyId),
        status: "active",
        per_page: 100,
      }),
    enabled: Boolean(token) && companyId > 0,
  });

  const employeeDetailQuery = useQuery({
    queryKey: ["employee-detail-apply", token, employeeId],
    queryFn: () => getEmployeeDetail(token, employeeId),
    enabled: Boolean(token) && employeeId > 0,
  });

  const balancesQuery = useQuery({
    queryKey: ["leave-balances-apply", token, employeeId],
    queryFn: () => getLeaveBalances(token, { employee_id: employeeId }),
    enabled: Boolean(token) && employeeId > 0,
  });

  const companies = companiesQuery.data?.data ?? EMPTY_LIST;
  const policies = useMemo(() => {
    const data = policiesQuery.data?.data;
    return Array.isArray(data) ? data : EMPTY_LIST;
  }, [policiesQuery.data?.data]);
  const employeeRecord = employeeDetailQuery.data?.data?.employee as Record<string, unknown> | undefined;
  const rawBalances = useMemo(() => {
    const data = balancesQuery.data?.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      if (Array.isArray((data as { items?: unknown }).items)) {
        return (data as { items: unknown[] }).items;
      }
      if (Array.isArray((data as { balances?: unknown }).balances)) {
        return (data as { balances: unknown[] }).balances;
      }
    }
    return EMPTY_LIST;
  }, [balancesQuery.data?.data]);

  const employeeDetailReady =
    employeeId > 0 && employeeDetailQuery.isSuccess && !employeeDetailQuery.isLoading;

  const leavePolicyId = resolveLeavePolicyId(employeeRecord);

  const activePolicy = useMemo(() => {
    if (!leavePolicyId || !Array.isArray(policies)) return null;
    return policies.find((p) => p.id === leavePolicyId) || null;
  }, [leavePolicyId, policies]);

  const hasAssignedLeavePolicy = Boolean(
    employeeDetailReady &&
      activePolicy &&
      Array.isArray(activePolicy.leave_definitions) &&
      activePolicy.leave_definitions.length > 0,
  );

  const isUnpaidOnlyMode = employeeDetailReady && !hasAssignedLeavePolicy;

  // Merge active policy definitions with actual balance counts
  const eligibility = useMemo(() => {
    if (!activePolicy || !Array.isArray(activePolicy.leave_definitions)) return EMPTY_LIST;
    const balancesList = rawBalances;

    return activePolicy.leave_definitions.map((def: any) => {
      const balanceRow = balancesList.find(
        (b: any) =>
          b.leave_name?.trim().toLowerCase() === def.leave_name?.trim().toLowerCase() ||
          b.leave_type?.name?.trim().toLowerCase() === def.leave_name?.trim().toLowerCase()
      );

      const balance = balanceRow ? Number(balanceRow.balance ?? 0) : Number(def.allowed_leaves ?? 0);
      const allocated = balanceRow ? Number(balanceRow.allocated ?? balanceRow.days_allocated ?? balanceRow.total ?? 0) : Number(def.allowed_leaves ?? 0);
      const used = balanceRow ? Number(balanceRow.used ?? 0) : 0;

      return {
        name: def.leave_name,
        balance,
        allocated,
        used,
        carry_forward: def.carry_forward,
      };
    });
  }, [activePolicy, rawBalances]);

  const employees = useMemo<any[]>(() => {
    const raw = employeesQuery.data?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object" && "items" in raw && Array.isArray((raw as any).items)) {
      return (raw as any).items;
    }
    return [];
  }, [employeesQuery.data]);

  const firstEligibleLeaveName = eligibility[0]?.name ?? "";

  // Auto-select leave type based on policy assignment (guarded to avoid render loops)
  useEffect(() => {
    if (!employeeDetailReady) return;

    if (isUnpaidOnlyMode) {
      if (leaveName !== UNPAID_LEAVE_NAME) {
        setValue("leave_name", UNPAID_LEAVE_NAME, { shouldValidate: false, shouldDirty: false });
      }
      if (leaveCategory !== "unpaid") {
        setValue("leave_category", "unpaid", { shouldValidate: false, shouldDirty: false });
      }
      return;
    }

    if (firstEligibleLeaveName && !leaveName) {
      setValue("leave_name", firstEligibleLeaveName, { shouldValidate: false, shouldDirty: false });
    }
  }, [
    employeeDetailReady,
    isUnpaidOnlyMode,
    firstEligibleLeaveName,
    leaveName,
    leaveCategory,
    setValue,
  ]);

  // When unpaid leave is chosen under a policy, default category to unpaid
  useEffect(() => {
    if (leaveName === UNPAID_LEAVE_NAME && leaveCategory !== "unpaid") {
      setValue("leave_category", "unpaid", { shouldValidate: false, shouldDirty: false });
    }
  }, [leaveName, leaveCategory, setValue]);

  const leaveNames = useMemo(() => {
    if (isUnpaidOnlyMode) return [UNPAID_LEAVE_NAME];
    if (eligibility.length > 0) return eligibility.map((e) => e.name);
    return [UNPAID_LEAVE_NAME];
  }, [isUnpaidOnlyMode, eligibility]);

  const selectedEligibility = useMemo(() => {
    return eligibility.find((e) => e.name === leaveName) || null;
  }, [eligibility, leaveName]);

  const estimatedDays = useMemo(() => {
    if (leaveDuration !== "full_day") return 0.5;
    if (!fromDate || !toDate) return 0;
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return 0;
    const diff = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  }, [fromDate, toDate, leaveDuration]);

  const onSubmit = async (values: FormValues) => {
    if (!token) return;
    setSubmitting(true);
    try {
      // For employee sessions: fall back to session-resolved IDs if form value is still 0
      const resolvedEmployeeId = values.employee_id > 0
        ? values.employee_id
        : sessionEidRef.current;

      if (!resolvedEmployeeId) {
        toast.error("Could not determine your employee profile. Please refresh and try again.");
        return;
      }

      const response = await createLeaveRequest(token, {
        employee_id: resolvedEmployeeId,
        leave_name: values.leave_name,
        leave_category:
          values.leave_name === UNPAID_LEAVE_NAME || isUnpaidOnlyMode
            ? "unpaid"
            : values.leave_category,
        leave_duration: values.leave_duration,
        from_date: values.from_date,
        to_date: values.leave_duration === "full_day" ? values.to_date : values.from_date,
        reason: values.reason.trim(),
      });
      toast.success(response.message || "Leave request submitted successfully.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leave-requests"], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["leave-balances"], refetchType: "all" }),
      ]);
      router.push("/leave-requests");
    } catch (error) {
      const err = error as LeaveRequestApiError;
      toast.error(err.message || "Unable to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  const showLoading =
    !authReady || sessionResolving || (employeeId > 0 && employeeDetailQuery.isLoading);
  const showForm = !sessionError && (isEmployee ? employeeId > 0 : employeeId > 0);

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <CalendarPlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Apply Leave</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEmployee
                ? `Submit a leave request${employeeName ? ` as ${employeeName}` : ""}.`
                : "Submit a leave request on behalf of an employee."}
            </p>
          </div>
        </div>
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "rounded-xl self-start md:self-auto shadow-sm hover:bg-accent")}
          href="/leave-requests"
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          My requests
        </Link>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {sessionError ? (
          <div className="lg:col-span-12 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {sessionError}
          </div>
        ) : null}
        {/* Left Area - Form Card */}
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card className="rounded-2xl border-border bg-card/70 backdrop-blur-md shadow-md">
              <CardHeader className="border-b border-border/50 pb-5">
                <CardTitle className="text-lg font-semibold">New Leave Application</CardTitle>
                <CardDescription>Fill out details below to apply for a leave of absence.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {showLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="h-9 w-9 animate-spin text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">Loading employee profile...</span>
                  </div>
                ) : (
                  <>
                    {/* Employee / Company selectors for Admin */}
                    {!isEmployee && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label markRequired>Company</Label>
                          <NativeSelect
                            className={cn(selectClass, "mt-2", errors.company_id && "border-destructive")}
                            {...register("company_id", { setValueAs: toNumber })}
                          >
                            <option value={0}>Select company</option>
                            {companies.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.company_name}
                              </option>
                            ))}
                          </NativeSelect>
                          {errors.company_id && (
                            <p className="mt-1.5 text-xs text-destructive">{errors.company_id.message}</p>
                          )}
                        </div>
                        <div>
                          <Label markRequired>Employee</Label>
                          <NativeSelect
                            className={cn(selectClass, "mt-2", errors.employee_id && "border-destructive")}
                            {...register("employee_id", {
                              setValueAs: toNumber,
                              onChange: (e) => {
                                const id = Number(e.target.value);
                                setValue("employee_id", id);
                                const emp = employees.find((item: any) => item.id === id);
                                if (emp?.company_id) {
                                  setValue("company_id", emp.company_id);
                                }
                              },
                            })}
                          >
                            <option value={0}>Select employee</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.full_name || emp.employee_code || `Employee #${emp.id}`}
                              </option>
                            ))}
                          </NativeSelect>
                          {errors.employee_id && (
                            <p className="mt-1.5 text-xs text-destructive">{errors.employee_id.message}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {isEmployee && (
                      <>
                        <input type="hidden" {...register("company_id", { setValueAs: toNumber })} />
                        <input type="hidden" {...register("employee_id", { setValueAs: toNumber })} />
                      </>
                    )}

                    {showForm ? (
                      <>
                        {/* Interactive Leave Selection Cards */}
                        <div className="space-y-3">
                          <Label markRequired>Select Leave Type</Label>
                          {isUnpaidOnlyMode ? (
                            <div className="space-y-3">
                              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                                No leave policy is assigned to this employee. Only{" "}
                                <span className="font-semibold">{UNPAID_LEAVE_NAME}</span> can be
                                applied.
                              </div>
                              <UnpaidLeaveCard
                                selected={leaveName === UNPAID_LEAVE_NAME}
                                onSelect={() =>
                                  setValue("leave_name", UNPAID_LEAVE_NAME, { shouldValidate: true })
                                }
                              />
                            </div>
                          ) : eligibility.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {eligibility.map((item) => {
                                const IconComp = getLeaveIcon(item.name);
                                const isSelected = leaveName === item.name;
                                return (
                                  <button
                                    key={item.name}
                                    type="button"
                                    onClick={() => setValue("leave_name", item.name, { shouldValidate: true })}
                                    className={cn(
                                      "flex flex-col items-start p-4 rounded-xl border text-left transition-all relative overflow-hidden group",
                                      isSelected
                                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                                        : "border-border hover:border-primary/50 bg-background/50 hover:bg-primary/[0.01]"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={cn(
                                          "rounded-lg p-2 transition-colors",
                                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                                        )}
                                      >
                                        <IconComp className="h-4.5 w-4.5" />
                                      </div>
                                      <div>
                                        <h3 className="font-semibold text-sm leading-none">{item.name}</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Remaining</p>
                                      </div>
                                    </div>
                                    <div className="mt-4 flex items-baseline gap-1.5">
                                      <span className="text-2xl font-bold tracking-tight">{item.balance}</span>
                                      <span className="text-xs text-muted-foreground">days</span>
                                    </div>
                                  </button>
                                );
                              })}

                              <UnpaidLeaveCard
                                selected={leaveName === UNPAID_LEAVE_NAME}
                                onSelect={() =>
                                  setValue("leave_name", UNPAID_LEAVE_NAME, { shouldValidate: true })
                                }
                              />
                            </div>
                          ) : (
                            <NativeSelect
                              className={cn(selectClass, "mt-2", errors.leave_name && "border-destructive")}
                              {...register("leave_name")}
                            >
                              <option value="">Choose leave type</option>
                              {leaveNames.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </NativeSelect>
                          )}
                          {errors.leave_name && (
                            <p className="mt-1 text-xs text-destructive">{errors.leave_name.message}</p>
                          )}
                        </div>

                        {/* Leave Category and Duration */}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label markRequired>Category</Label>
                            {isUnpaidOnlyMode || leaveName === UNPAID_LEAVE_NAME ? (
                              <div className="flex items-center justify-center p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm font-semibold text-amber-700 dark:text-amber-300">
                                Unpaid / LWP
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { value: "paid", label: "Paid Leave" },
                                  { value: "unpaid", label: "Unpaid / LWP" },
                                ].map((opt) => {
                                  const isSelected = leaveCategory === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => setValue("leave_category", opt.value as FormValues["leave_category"])}
                                      className={cn(
                                        "flex items-center justify-center p-3 rounded-xl border text-sm font-semibold transition-all",
                                        isSelected
                                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                                          : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground bg-background/50"
                                      )}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label markRequired>Duration</Label>
                            <NativeSelect
                              className={cn(selectClass, errors.leave_duration && "border-destructive")}
                              {...register("leave_duration")}
                            >
                              <option value="full_day">Full Day</option>
                              <option value="half_day">Half Day</option>
                              <option value="first_half">First Half (Morning)</option>
                              <option value="second_half">Second Half (Afternoon)</option>
                            </NativeSelect>
                          </div>
                        </div>

                        {/* Leave Dates */}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="from_date" markRequired>
                              {leaveDuration === "full_day" ? "From Date" : "Leave Date"}
                            </Label>
                            <Input
                              className={cn(inputClass, "mt-2", errors.from_date && "border-destructive")}
                              id="from_date"
                              type="date"
                              {...register("from_date")}
                            />
                            {errors.from_date && (
                              <p className="mt-1 text-xs text-destructive">{errors.from_date.message}</p>
                            )}
                          </div>
                          {leaveDuration === "full_day" && (
                            <div>
                              <Label htmlFor="to_date" markRequired>
                                To Date
                              </Label>
                              <Input
                                className={cn(inputClass, "mt-2", errors.to_date && "border-destructive")}
                                id="to_date"
                                type="date"
                                {...register("to_date")}
                              />
                              {errors.to_date && (
                                <p className="mt-1 text-xs text-destructive">{errors.to_date.message}</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Reason Textarea */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <Label markRequired>Reason for Leave</Label>
                            <span className="text-xs text-muted-foreground">
                              {reason?.length ?? 0}/500 chars
                            </span>
                          </div>
                          <Textarea
                            className={cn("min-h-[110px] rounded-xl resize-none bg-background/50", errors.reason && "border-destructive")}
                            placeholder="Please provide details (e.g. medical appointment, travel plans, personal commitments)..."
                            rows={4}
                            {...register("reason")}
                          />
                          {errors.reason && (
                            <p className="mt-1 text-xs text-destructive">{errors.reason.message}</p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-5 border-t border-border/50">
                          <Link
                            className={cn(buttonVariants({ variant: "outline" }), "rounded-xl shadow-sm hover:bg-accent")}
                            href="/leave-requests"
                          >
                            Cancel
                          </Link>
                          <Button
                            className="rounded-xl px-6 font-semibold shadow-sm hover:bg-primary/95 transition-all"
                            disabled={submitting}
                            type="submit"
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              "Submit Request"
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-muted/10 p-6">
                        <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                        <h3 className="font-semibold text-base">Select Employee Profile</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                          Select a company and employee above to load custom policies and apply for leave.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Right Area - Sidebar */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
          {/* Request Summary Card */}
          <Card className="rounded-2xl border-border bg-card/80 backdrop-blur-md shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base font-semibold">Request Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-sm">
              <div className="flex justify-between items-start py-2 border-b border-border/40">
                <span className="text-muted-foreground font-medium">Leave Type</span>
                <span className="font-semibold text-right">{leaveName || "—"}</span>
              </div>
              <div className="flex justify-between items-start py-2 border-b border-border/40">
                <span className="text-muted-foreground font-medium">Duration</span>
                <span className="font-semibold text-right">
                  {leaveDuration === "full_day"
                    ? `Full Day (${estimatedDays} day${estimatedDays === 1 ? "" : "s"})`
                    : leaveDuration === "half_day"
                    ? "Half Day (0.5 day)"
                    : leaveDuration === "first_half"
                    ? "First Half Session (0.5 day)"
                    : leaveDuration === "second_half"
                    ? "Second Half Session (0.5 day)"
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-start py-2 border-b border-border/40">
                <span className="text-muted-foreground font-medium">Leave Category</span>
                <div>
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase leading-none tracking-wider",
                      leaveCategory === "paid"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {leaveCategory === "paid" ? "Paid" : "Unpaid"}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-start py-2 border-b border-border/40">
                <span className="text-muted-foreground font-medium">Dates Range</span>
                <span className="font-semibold text-right">
                  {fromDate
                    ? leaveDuration === "full_day" && toDate !== fromDate
                      ? `${fromDate} to ${toDate}`
                      : fromDate
                    : "—"}
                </span>
              </div>
              {reason?.trim() && (
                <div className="rounded-xl bg-muted/40 border border-border/30 p-3 mt-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason Details</span>
                  <p className="mt-1 text-sm text-foreground break-words">{reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Guidelines / How it works */}
          <Card className="rounded-2xl border-border bg-card/80 backdrop-blur-md shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center gap-2">
                <Info className="h-4.5 w-4.5 text-primary" />
                <CardTitle className="text-base font-semibold">Guidelines</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5 text-sm text-muted-foreground">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <p>
                  {isUnpaidOnlyMode
                    ? "Without an assigned leave policy, only unpaid leave can be submitted."
                    : "Balances are dynamically matched from the employee's assigned policy rules."}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <p>Select half-day options if applying for morning or afternoon sessions.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                <p>Your team lead or manager will review and update request status.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
