"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Company } from "@/lib/api/company";
import type {
  CreateDesignationPayload,
  Designation,
  DesignationApiError,
  DesignationStatus,
  UpdateDesignationPayload,
} from "@/lib/api/designation";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type DesignationFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  loading: boolean;
  initialData?: Designation | null;
  companies: Company[];
  serverError?: DesignationApiError | null;
  onClose: () => void;
  onSubmit: (
    payload: CreateDesignationPayload | UpdateDesignationPayload,
  ) => Promise<void>;
};

const createFormSchema = z.object({
  company_id: z.number().min(1, "Company is required"),
  name: z.string().trim().min(1, "Designation name is required"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(30, "Code must be at most 30 characters")
    .regex(/^[A-Za-z0-9-_]+$/, "Code allows letters, numbers, - and _ only"),
  status: z.enum(["active", "inactive"]),
});

const editFormSchema = createFormSchema.omit({ company_id: true });

type CreateFormValues = z.infer<typeof createFormSchema>;
type EditFormValues = z.infer<typeof editFormSchema>;
type FormValues = CreateFormValues | EditFormValues;

const inputStyles =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary";

export function DesignationFormModal({
  open,
  mode,
  loading,
  initialData,
  companies,
  serverError,
  onClose,
  onSubmit,
}: DesignationFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

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
        ? { company_id: 0, name: "", code: "", status: "active" }
        : { name: "", code: "", status: "active" },
  });

  const companyNameForEdit = useMemo(() => {
    if (!initialData?.company_id) return "-";
    const match = companies.find((c) => c.id === initialData.company_id);
    return match?.company_name ?? "-";
  }, [companies, initialData?.company_id]);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      reset({
        company_id: 0,
        name: initialData?.name ?? "",
        code: initialData?.code ?? "",
        status: (initialData?.status as DesignationStatus | undefined) ?? "active",
      });
    } else {
      reset({
        name: initialData?.name ?? "",
        code: initialData?.code ?? "",
        status: (initialData?.status as DesignationStatus | undefined) ?? "active",
      });
    }
    window.setTimeout(() => setFocus("name"), 0);
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
      await onSubmit({
        company_id: v.company_id,
        name: v.name,
        code: v.code,
        status: v.status,
      });
      return;
    }

    const v = values as EditFormValues;
    await onSubmit({
      name: v.name,
      code: v.code,
      status: v.status,
    });
  };

  return (
    <div className="modal-overlay">
      <div
        aria-modal="true"
        className="modal-content max-w-2xl"
        ref={modalRef}
        role="dialog"
      >
        <div className="modal-header">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Add Designation" : "Edit Designation"}
          </h2>
          <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit(submit)}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {mode === "create" ? (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Company</label>
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
                  <label className="text-sm font-medium">Company</label>
                  <div
                    className={`${inputStyles} cursor-not-allowed bg-muted/50 text-muted-foreground`}
                  >
                    {companyNameForEdit}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Designation Name</label>
                <Input className={inputStyles} {...register("name")} />
                {fieldError("name") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("name")}</p>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium">Code</label>
                <Input className={inputStyles} {...register("code")} />
                {fieldError("code") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("code")}</p>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium">Status</label>
                <select className={inputStyles} {...register("status")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                {fieldError("status") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("status")}</p>
                ) : null}
              </div>
            </div>

            {serverError?.message ? (
              <p className="text-sm text-destructive">{serverError.message}</p>
            ) : null}
          </div>

          <div className="modal-footer">
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={loading} type="submit">
              {loading
                ? "Saving..."
                : mode === "create"
                  ? "Create Designation"
                  : "Update Designation"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
