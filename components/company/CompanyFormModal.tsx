"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type {
  Company,
  CompanyApiError,
  CompanyStatus,
  CreateCompanyPayload,
  UpdateCompanyPayload,
} from "@/lib/api/company";
import { resolveApiAssetUrl } from "@/lib/api/employees/http";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type Mode = "create" | "edit";

type CompanyFormModalProps = {
  open: boolean;
  mode: Mode;
  loading: boolean;
  initialData?: Company | null;
  serverError?: CompanyApiError | null;
  onClose: () => void;
  onSubmit: (payload: CreateCompanyPayload | UpdateCompanyPayload) => Promise<void>;
};

const baseSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required"),
  legal_name: z.string().trim().min(1, "Legal name is required"),
  email: z.string().trim().email("Enter a valid company email"),
  phone: z.string().trim().min(1, "Phone is required"),
  address: z.string().trim().min(1, "Address is required"),
  logo: z.any().optional().nullable(),
  subscription_start: z.string().min(1, "Subscription start date is required"),
  subscription_end: z.string().min(1, "Subscription end date is required"),
  admin_name: z.string().trim().optional(),
  admin_email: z.string().trim().optional(),
  admin_password: z.string().optional(),
  admin_password_confirmation: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const createSchema = baseSchema
  .extend({
    admin_name: z.string().trim().min(1, "Admin name is required"),
    admin_email: z.string().trim().email("Enter a valid admin email"),
    admin_password: z.string().min(6, "Password must be at least 6 characters"),
    admin_password_confirmation: z
      .string()
      .min(1, "Confirm password is required"),
  })
  .superRefine((data, ctx) => {
    if (data.admin_password !== data.admin_password_confirmation) {
      ctx.addIssue({
        code: "custom",
        path: ["admin_password_confirmation"],
        message: "Password and confirm password must match",
      });
    }
  });

const editSchema = baseSchema.superRefine((data, ctx) => {
  if (!data.status) {
    ctx.addIssue({
      code: "custom",
      path: ["status"],
      message: "Status is required",
    });
  }
});

type CompanyFormValues = z.infer<typeof baseSchema>;

const inputStyles =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary";

export function CompanyFormModal({
  open,
  mode,
  loading,
  initialData,
  serverError,
  onClose,
  onSubmit,
}: CompanyFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const schema = useMemo(() => (mode === "create" ? createSchema : editSchema), [mode]);
  const {
    register,
    handleSubmit,
    control,
    reset,
    setFocus,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: "",
      legal_name: "",
      email: "",
      phone: "",
      address: "",
      subscription_start: "",
      subscription_end: "",
      admin_name: "",
      admin_email: "",
      admin_password: "",
      admin_password_confirmation: "",
      status: "active",
      logo: null,
    },
  });

  useEffect(() => {
    if (!open) return;

    reset({
      company_name: initialData?.company_name ?? "",
      legal_name: initialData?.legal_name ?? "",
      email: initialData?.email ?? "",
      phone: initialData?.phone ?? "",
      address: initialData?.address ?? "",
      subscription_start: initialData?.subscription_start ?? "",
      subscription_end: initialData?.subscription_end ?? "",
      admin_name: "",
      admin_email: "",
      admin_password: "",
      admin_password_confirmation: "",
      status: (initialData?.status as CompanyStatus | undefined) ?? "active",
      logo: null,
    });
    window.setTimeout(() => {
      try {
        setFocus("company_name");
      } catch (err) {
        console.warn("Failed to set focus on company_name", err);
      }
    }, 50);
  }, [open, initialData, reset, setFocus]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

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

  const logoFile = watch("logo");
  const existingLogoUrl = useMemo(
    () => resolveApiAssetUrl(initialData?.logo_url) ?? null,
    [initialData?.logo_url],
  );
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUploadPreviewUrl(null);
      return;
    }

    if (logoFile instanceof File) {
      const url = URL.createObjectURL(logoFile);
      setUploadPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    setUploadPreviewUrl(null);
  }, [open, logoFile]);

  const logoPreviewUrl = uploadPreviewUrl ?? (mode === "edit" ? existingLogoUrl : null);

  if (!open) return null;

  const fieldError = (name: keyof CompanyFormValues): string | undefined => {
    const err = errors[name];
    const serverErr = serverError?.fieldErrors?.[name]?.[0];
    if (err && typeof err.message === "string") return err.message;
    return serverErr;
  };

  const submit = async (values: CompanyFormValues) => {
    const payloadBase = {
      company_name: values.company_name,
      legal_name: values.legal_name,
      email: values.email,
      phone: values.phone,
      address: values.address,
      subscription_start: values.subscription_start,
      subscription_end: values.subscription_end,
      logo: values.logo,
    };

    if (mode === "create") {
      await onSubmit({
        ...payloadBase,
        admin_name: values.admin_name ?? "",
        admin_email: values.admin_email ?? "",
        admin_password: values.admin_password ?? "",
        admin_password_confirmation: values.admin_password_confirmation ?? "",
      });
      return;
    }

    await onSubmit({
      ...payloadBase,
      status: (values.status as CompanyStatus) ?? "active",
    });
  };

  return (
    <div className="modal-overlay">
      <div
        aria-modal="true"
        className="modal-content max-w-3xl"
        ref={modalRef}
        role="dialog"
      >
        <div className="modal-header">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Add Company" : "Edit Company"}
          </h2>
          <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit(submit)}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Company Name</label>
                <Input className={inputStyles} {...register("company_name")} />
                {fieldError("company_name") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("company_name")}</p>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium">Legal Name</label>
                <Input className={inputStyles} {...register("legal_name")} />
                {fieldError("legal_name") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("legal_name")}</p>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input className={inputStyles} type="email" {...register("email")} />
                {fieldError("email") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("email")}</p>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input className={inputStyles} {...register("phone")} />
                {fieldError("phone") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("phone")}</p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Address</label>
                <Input className={inputStyles} {...register("address")} />
                {fieldError("address") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("address")}</p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Logo Upload</label>
                <Input
                  accept="image/*"
                  className={inputStyles}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setValue("logo", file, { shouldValidate: true });
                  }}
                  type="file"
                />
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                    {logoPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt="Company logo preview"
                        className="h-full w-full object-contain"
                        src={logoPreviewUrl}
                      />
                    ) : (
                      <span className="px-2 text-center text-[11px] text-muted-foreground">
                        No logo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {uploadPreviewUrl
                      ? "Preview of the selected logo."
                      : existingLogoUrl
                        ? "Current company logo."
                        : "Upload a PNG or JPG to preview the logo here."}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Subscription Start Date</label>
                <Input className={inputStyles} type="date" {...register("subscription_start")} />
                {fieldError("subscription_start") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("subscription_start")}</p>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-medium">Subscription End Date</label>
                <Input className={inputStyles} type="date" {...register("subscription_end")} />
                {fieldError("subscription_end") ? (
                  <p className="mt-1 text-xs text-destructive">{fieldError("subscription_end")}</p>
                ) : null}
              </div>
              {mode === "create" ? (
                <>
                  <div>
                    <label className="text-sm font-medium">Admin Name</label>
                    <Input className={inputStyles} {...register("admin_name")} />
                    {fieldError("admin_name") ? (
                      <p className="mt-1 text-xs text-destructive">{fieldError("admin_name")}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Admin Email</label>
                    <Input className={inputStyles} type="email" {...register("admin_email")} />
                    {fieldError("admin_email") ? (
                      <p className="mt-1 text-xs text-destructive">{fieldError("admin_email")}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Admin Password</label>
                    <Input className={inputStyles} type="password" {...register("admin_password")} />
                    {fieldError("admin_password") ? (
                      <p className="mt-1 text-xs text-destructive">{fieldError("admin_password")}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Confirm Password</label>
                    <Input
                      className={inputStyles}
                      type="password"
                      {...register("admin_password_confirmation")}
                    />
                    {fieldError("admin_password_confirmation") ? (
                      <p className="mt-1 text-xs text-destructive">
                        {fieldError("admin_password_confirmation")}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select className={inputStyles} {...register("status")}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  {fieldError("status") ? (
                    <p className="mt-1 text-xs text-destructive">{fieldError("status")}</p>
                  ) : null}
                </div>
              )}
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
              {loading ? "Saving..." : mode === "create" ? "Create Company" : "Update Company"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
