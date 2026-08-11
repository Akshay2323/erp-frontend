"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Company } from "@/lib/api/company";
import type {
  SalaryComponent,
  PayrollApiError,
  SalaryComponentType,
  SalaryComponentStatus,
  CreateSalaryComponentPayload,
  UpdateSalaryComponentPayload,
} from "@/lib/api/payroll";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type SalaryComponentModalProps = {
  open: boolean;
  mode: "create" | "edit" | "view";
  loading: boolean;
  initialData?: SalaryComponent | null;
  companies: Company[];
  serverError?: PayrollApiError | null;
  onClose: () => void;
  onSubmit: (
    payload: CreateSalaryComponentPayload | UpdateSalaryComponentPayload,
  ) => Promise<void>;
};

const createFormSchema = z.object({
  company_id: z.number().optional(),
  name: z.string().trim().min(1, "Component name is required"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(30, "Code must be at most 30 characters")
    .regex(/^[A-Z0-9_]+$/, "Code must be in UPPERCASE letters, numbers, and underscores only"),
  type: z.enum(["earning", "deduction"]),
  default_amount: z.number().min(0, "Default amount must be 0 or more").nullable(),
  status: z.enum(["active", "inactive"]),
});

const editFormSchema = createFormSchema.omit({ company_id: true });

type CreateFormValues = z.infer<typeof createFormSchema>;
type EditFormValues = z.infer<typeof editFormSchema>;
type FormValues = CreateFormValues | EditFormValues;

const inputStyles =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary";

export function SalaryComponentModal({
  open,
  mode,
  loading,
  initialData,
  companies,
  serverError,
  onClose,
  onSubmit,
}: SalaryComponentModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const isViewOnly = mode === "view";

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(mode === "create" ? createFormSchema : editFormSchema),
    defaultValues:
      mode === "create"
        ? { company_id: 0, name: "", code: "", type: "earning", default_amount: 0, status: "active" }
        : { name: "", code: "", type: "earning", default_amount: 0, status: "active" },
  });

  const companyName = useMemo(() => {
    if (!initialData?.company_id) return "All Companies";
    const match = companies.find((c) => c.id === initialData.company_id);
    return match?.company_name ?? "-";
  }, [companies, initialData?.company_id]);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      reset({
        company_id: 0,
        name: "",
        code: "",
        type: "earning",
        default_amount: 0,
        status: "active",
      });
    } else {
      reset({
        name: initialData?.name ?? "",
        code: initialData?.code ?? "",
        type: initialData?.type ?? "earning",
        default_amount: initialData?.default_amount != null ? Number(initialData.default_amount) : 0,
        status: (initialData?.status as SalaryComponentStatus | undefined) ?? "active",
      });
    }
    if (mode !== "view") {
      window.setTimeout(() => setFocus("name"), 0);
    }
  }, [open, initialData, mode, reset, setFocus]);

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

  if (!open) return null;

  const fieldError = (name: string) =>
    (errors as Record<string, { message?: string } | undefined>)[name]?.message ||
    serverError?.fieldErrors?.[name]?.[0];

  const submit = async (values: FormValues) => {
    if (mode === "create") {
      const v = values as CreateFormValues;
      const payload: CreateSalaryComponentPayload = {
        name: v.name,
        code: v.code,
        type: v.type,
        default_amount: v.default_amount,
        status: v.status,
      };
      if (v.company_id && v.company_id > 0) {
        payload.company_id = v.company_id;
      }
      await onSubmit(payload);
      return;
    }

    const v = values as EditFormValues;
    await onSubmit({
      name: v.name,
      code: v.code,
      type: v.type,
      default_amount: v.default_amount,
      status: v.status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div
        aria-modal="true"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl"
        ref={modalRef}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isViewOnly
              ? "Salary Component Details"
              : mode === "create"
                ? "Add Salary Component"
                : "Edit Salary Component"}
          </h2>
          <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form className="space-y-4 p-6" onSubmit={isViewOnly ? (e) => e.preventDefault() : handleSubmit(submit)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {isViewOnly ? (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Company</label>
                <div className={`${inputStyles} bg-muted/40 text-foreground`}>
                  {companyName}
                </div>
              </div>
            ) : mode === "create" ? (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground">Company</label>
                <select
                  className={inputStyles}
                  {...register("company_id", { valueAsNumber: true })}
                >
                  <option value={0}>Select company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.company_name}
                    </option>
                  ))}
                </select>
                {fieldError("company_id") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("company_id")}</p>
                ) : null}
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Company</label>
                <div className={`${inputStyles} cursor-not-allowed bg-muted/50 text-muted-foreground`}>
                  {companyName}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground">Component Name</label>
              {isViewOnly ? (
                <div className={`${inputStyles} bg-muted/40 text-foreground`}>
                  {initialData?.name}
                </div>
              ) : (
                <>
                  <Input className={inputStyles} {...register("name")} placeholder="e.g. House Rent Allowance" />
                  {fieldError("name") ? (
                    <p className="mt-1 text-xs text-destructive">{fieldError("name")}</p>
                  ) : null}
                </>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Code</label>
              {isViewOnly ? (
                <div className={`${inputStyles} font-mono bg-muted/40 text-foreground`}>
                  {initialData?.code}
                </div>
              ) : (
                <>
                  <Input className={inputStyles} {...register("code")} placeholder="e.g. HRA" />
                  {fieldError("code") ? (
                    <p className="mt-1 text-xs text-destructive">{fieldError("code")}</p>
                  ) : null}
                </>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Type</label>
              {isViewOnly ? (
                <div className={`${inputStyles} bg-muted/40 text-foreground capitalize`}>
                  {initialData?.type}
                </div>
              ) : (
                <>
                  <select className={inputStyles} {...register("type")}>
                    <option value="earning">Earning</option>
                    <option value="deduction">Deduction</option>
                  </select>
                  {fieldError("type") ? (
                    <p className="mt-1 text-xs text-destructive">{fieldError("type")}</p>
                  ) : null}
                </>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Default Amount (₹)</label>
              {isViewOnly ? (
                <div className={`${inputStyles} bg-muted/40 text-foreground`}>
                  {initialData?.default_amount != null
                    ? `₹${Number(initialData.default_amount).toLocaleString("en-IN")}`
                    : "₹0"}
                </div>
              ) : (
                <>
                  <Input
                    className={inputStyles}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register("default_amount", {
                      valueAsNumber: true,
                      setValueAs: (value) => (value === "" ? null : Number(value)),
                    })}
                  />
                  {fieldError("default_amount") ? (
                    <p className="mt-1 text-xs text-destructive">{fieldError("default_amount")}</p>
                  ) : null}
                </>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-foreground">Status</label>
              {isViewOnly ? (
                <div className={`${inputStyles} bg-muted/40 text-foreground capitalize`}>
                  {initialData?.status}
                </div>
              ) : (
                <>
                  <select className={inputStyles} {...register("status")}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  {fieldError("status") ? (
                    <p className="mt-1 text-xs text-destructive">{fieldError("status")}</p>
                  ) : null}
                </>
              )}
            </div>
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
                    ? "Create Component"
                    : "Update Component"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
