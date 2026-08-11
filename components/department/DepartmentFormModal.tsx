"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  getBranches,
  type Branch,
} from "@/lib/api/branch";
import type {
  CreateDepartmentPayload,
  Department,
  DepartmentApiError,
  DepartmentStatus,
  UpdateDepartmentPayload,
} from "@/lib/api/department";
import type { Company } from "@/lib/api/company";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type DepartmentFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  token: string;
  loading: boolean;
  initialData?: Department | null;
  companies: Company[];
  serverError?: DepartmentApiError | null;
  onClose: () => void;
  onSubmit: (
    payload: CreateDepartmentPayload | UpdateDepartmentPayload,
  ) => Promise<void>;
};

const schema = z.object({
  company_id: z.number().optional(),
  branch_id: z.number().min(1, "Branch is required"),
  name: z.string().trim().min(1, "Department name is required"),
  code: z
    .string()
    .trim()
    .min(2, "Code is required")
    .max(20, "Code must be at most 20 characters")
    .regex(/^[A-Za-z0-9-_]+$/, "Code allows letters, numbers, - and _ only"),
  status: z.enum(["active", "inactive"]),
});

type FormValues = z.infer<typeof schema>;

const inputStyles =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary";

export function DepartmentFormModal({
  open,
  mode,
  token,
  loading,
  initialData,
  companies,
  serverError,
  onClose,
  onSubmit,
}: DepartmentFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const {
    control,
    register,
    setValue,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_id: 0,
      branch_id: 0,
      name: "",
      code: "",
      status: "active",
    },
  });

  const companyId = useWatch({
    control,
    name: "company_id",
  });

  const branchesQuery = useQuery({
    queryKey: ["department-branches", token, companyId],
    queryFn: () =>
      getBranches(token, {
        company_id: Number(companyId) > 0 ? String(companyId) : undefined,
        page: 1,
        per_page: 100,
      }),
    enabled: open && Boolean(token),
  });

  const branches: Branch[] = Array.isArray(branchesQuery.data?.data)
    ? branchesQuery.data.data
    : [];

  useEffect(() => {
    if (!open) return;
    reset({
      company_id: initialData?.company_id ?? 0,
      branch_id: initialData?.branch_id ?? 0,
      name: initialData?.name ?? "",
      code: initialData?.code ?? "",
      status: (initialData?.status as DepartmentStatus | undefined) ?? "active",
    });
    window.setTimeout(() => setFocus("name"), 0);
  }, [open, initialData, reset, setFocus]);

  const initialCompanyId = useMemo(
    () => initialData?.company_id ?? 0,
    [initialData?.company_id],
  );

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && companyId === initialCompanyId) return;
    setValue("branch_id", 0);
  }, [companyId, initialCompanyId, mode, open, setValue]);

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

  const fieldError = (name: keyof FormValues) =>
    errors[name]?.message || serverError?.fieldErrors?.[name]?.[0];

  const submit = async (values: FormValues) => {
    if (mode === "create") {
      await onSubmit({
        branch_id: values.branch_id,
        name: values.name,
        code: values.code,
        status: values.status,
      });
      return;
    }

    await onSubmit({
      branch_id: values.branch_id,
      name: values.name,
      code: values.code,
      status: values.status,
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
            {mode === "create" ? "Add Department" : "Edit Department"}
          </h2>
          <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit(submit)}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
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
              </div>

              <div>
                <label className="text-sm font-medium">Branch</label>
                <select
                  className={inputStyles}
                  disabled={!companyId || branchesQuery.isFetching}
                  {...register("branch_id", { valueAsNumber: true })}
                >
                  <option value={0}>
                    {companyId ? "Select branch" : "Select company first"}
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {fieldError("branch_id") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("branch_id")}</p>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium">Department Name</label>
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

              <div>
                <label className="text-sm font-medium">Status</label>
                <select className={inputStyles} {...register("status")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
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
              {loading ? "Saving..." : mode === "create" ? "Create Department" : "Update Department"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
