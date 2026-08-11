"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Trash2,
  X,
  Eye,
  Download,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  File as LucideFile,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
  type FieldPath,
  type UseFormSetError,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { toast } from "sonner";
import type { ZodIssue } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getBranches, type Branch } from "@/lib/api/branch";
import { getTenantsList, type Tenant } from "@/lib/api/tenants";
import { getDepartments, type Department } from "@/lib/api/department";
import { getDesignations, type Designation } from "@/lib/api/designation";
import {
  activateEmployee,
  createEmployee,
  updateEmployeeBasic,
  type EmployeeApiError,
  type EmployeeRecord,
  type EmployeeDocumentRecord,
  saveBankDetails,
  saveContactDetails,
  saveJobDetails,
  savePersonalDetails,
  saveSalary,
  saveStatutoryDetails,
  searchEmployees,
  uploadDocuments,
  uploadProfilePhoto,
  computeNetSalary,
  getEmployeeDocuments,
  deleteEmployeeDocument,
  getDocumentPreview,
} from "@/lib/api/employee";
import { getDocumentFileUrl, getEmployeeProfilePhotoUrl, resolveApiAssetUrl } from "@/lib/api/employees/http";
import { buildEmployeeDocumentPreviewUrl } from "@/lib/api/employee-document-preview-url";
import { DocumentPreviewViewport } from "@/components/documents/DocumentPreviewViewport";
import {
  getMimeFromName,
  isImageMime,
  isPdfMime,
  isPreviewable,
  toPreviewBlob,
} from "@/lib/document-preview";
import { getLocations, type GeoLocation } from "@/lib/api/location";
import { getShifts, type Shift } from "@/lib/api/shift";
import { formatDisplayDate } from "@/lib/format-date";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step6Schema,
  step7Schema,
  step8Schema,
  step9Schema,
  step10Schema,
  STEP_LABELS,
  TOTAL_STEPS,
  type EmployeeWizardValues,
} from "@/lib/validations/employee-wizard";
import { cn } from "@/lib/utils";

import { assignEmployeeLeavePolicy } from "@/lib/api/leave-policy";

import { BLOOD_GROUPS, getEmployeeWizardDefaults, INDIAN_BANKS } from "./defaults";
import { LeavePolicyAssignStep } from "./LeavePolicyAssignStep";
import { ManagerCombobox } from "./ManagerCombobox";
import { ProfilePhotoCropper } from "./ProfilePhotoCropper";
import { WizardProgress } from "./WizardProgress";

const STEP_SCHEMAS = [
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step6Schema,
  step7Schema,
  step8Schema,
  step9Schema,
  step10Schema,
];

const selectClass = cn(
  "flex h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const inputErrorClass = "border-destructive focus-visible:ring-destructive";

function OptionalHint() {
  return <span className="ml-1 text-xs font-normal text-muted-foreground">(Optional)</span>;
}

function ClearableInput<TFieldValues extends FieldValues>({
  name,
  placeholder,
  type = "text",
  className,
  inputMode,
  maxLength,
}: {
  name: Path<TFieldValues>;
  placeholder?: string;
  type?: string;
  className?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}) {
  const { register, watch, setValue } = useFormContext<TFieldValues>();
  const value = watch(name) as string | undefined;

  return (
    <div className="relative">
      <Input
        className={cn("pr-10", className)}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        type={type}
        {...register(name)}
      />
      {value ? (
        <button
          aria-label="Clear field"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setValue(name, "" as never, { shouldDirty: true, shouldValidate: true })}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function applyZodIssues<T extends Record<string, unknown>>(
  setError: UseFormSetError<T>,
  issues: ZodIssue[],
) {
  for (const issue of issues) {
    const path = issue.path.join(".") as FieldPath<T>;
    if (path) setError(path, { message: issue.message });
  }
}

function applyApiFieldErrors(
  setError: UseFormSetError<EmployeeWizardValues>,
  fieldErrors?: Record<string, string[]>,
) {
  if (!fieldErrors) return;
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0]) {
      setError(key as FieldPath<EmployeeWizardValues>, { message: messages[0] });
    }
  }
}

function normalizeList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && "items" in raw && Array.isArray((raw as { items: T[] }).items)) {
    return (raw as { items: T[] }).items;
  }
  return [];
}

async function fetchManagerHits(
  token: string,
  params: { company_id?: number; branch_id?: number; q: string },
): Promise<
  { id: number; first_name?: string; last_name?: string; email?: string }[]
> {
  const res = await searchEmployees(token, {
    company_id: params.company_id,
    branch_id: params.branch_id,
    q: params.q,
    per_page: 100,
  });
  const raw = res.data as any;
  const list: EmployeeRecord[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
    ? raw.employees || raw.items || []
    : [];
  return list.map((e) => ({
    id: e.id,
    first_name: e.first_name ?? (e as { name?: string }).name?.split(" ")[0],
    last_name: e.last_name,
    email: e.email,
  }));
}

function getFileIcon(name: string) {
  const lower = (name || "").toLowerCase();
  if (/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(lower))
    return <FileImage className="h-4 w-4 text-emerald-500" />;
  if (/\.(pdf)$/i.test(lower))
    return <FileText className="h-4 w-4 text-rose-500" />;
  if (/\.(xls|xlsx|csv)$/i.test(lower))
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (/\.(zip|rar|7z|tar|gz)$/i.test(lower))
    return <FileArchive className="h-4 w-4 text-amber-500" />;
  return <LucideFile className="h-4 w-4 text-blue-500" />;
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StepFields({
  stepIndex,
  token,
  companies,
  branches,
  departments,
  designations,
  shifts,
  geolocations,
  excludeEmployeeId,
  loadingDeps,
  uploadedDocs,
  onDeleteDoc,
  deletingDocId,
  existingProfilePhotoUrl,
  onExistingProfilePhotoUpdated,
}: {
  stepIndex: number;
  token: string;
  companies: Tenant[];
  branches: Branch[];
  departments: Department[];
  designations: Designation[];
  shifts: Shift[];
  geolocations: GeoLocation[];
  excludeEmployeeId?: number | null;
  loadingDeps: boolean;
  uploadedDocs?: EmployeeDocumentRecord[];
  onDeleteDoc?: (docId: number) => Promise<void>;
  deletingDocId?: number | null;
  existingProfilePhotoUrl?: string | null;
  onExistingProfilePhotoUpdated?: (url: string | null) => void;
}) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<EmployeeWizardValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "documents" });

  const companyId = useWatch({ control, name: "company_id" });
  const branchId = useWatch({ control, name: "branch_id" });
  const firstName = useWatch({ control, name: "first_name" });
  const lastName = useWatch({ control, name: "last_name" });
  const accountHolderName = useWatch({ control, name: "account_holder_name" });
  const basicSalary = useWatch({ control, name: "basic_salary" });
  const hra = useWatch({ control, name: "hra" });
  const allowances = useWatch({ control, name: "allowances" });
  const deductions = useWatch({ control, name: "deductions" });

  useEffect(() => {
    if (stepIndex !== 4) return;
    const autoName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
    if (!autoName) return;
    if (!accountHolderName?.trim()) {
      setValue("account_holder_name", autoName, { shouldDirty: true });
    }
  }, [stepIndex, firstName, lastName, accountHolderName, setValue]);

  const filteredGeolocations = useMemo(() => {
    if (!companyId || companyId === 0) return geolocations;
    return geolocations.filter(
      (loc) => !loc.company_id || Number(loc.company_id) === Number(companyId),
    );
  }, [geolocations, companyId]);

  const netSalary = useMemo(
    () =>
      computeNetSalary(
        Number(basicSalary) || 0,
        Number(hra) || 0,
        Number(allowances) || 0,
        Number(deductions) || 0,
      ),
    [basicSalary, hra, allowances, deductions],
  );

  const [previewDoc, setPreviewDoc] = useState<EmployeeDocumentRecord | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewMime, setPreviewMime] = useState("");
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [actionDocId, setActionDocId] = useState<number | null>(null);

  const fetchPreviewBlob = useCallback(
    async (doc: EmployeeDocumentRecord): Promise<Blob> => {
      if (!token || !excludeEmployeeId) throw new Error("Authentication token or employee ID not found.");
      return getDocumentPreview(token, excludeEmployeeId, doc.id);
    },
    [token, excludeEmployeeId],
  );

  const fetchDocumentBlob = useCallback(
    async (doc: EmployeeDocumentRecord): Promise<Blob> => {
      if (!token) throw new Error("Authentication token not found.");
      const fileUrl = getDocumentFileUrl(doc);
      if (!fileUrl) throw new Error("Document URL not available.");
      const response = await fetch(fileUrl, {
        method: "GET",
        headers: {
          Accept: "application/octet-stream",
          Authorization: `Bearer ${token}`,
          "X-CSRF-TOKEN": "",
        },
      });
      if (!response.ok) {
        throw new Error("Unauthenticated or unable to fetch file.");
      }
      return response.blob();
    },
    [token],
  );

  const openPreview = useCallback(
    async (doc: EmployeeDocumentRecord) => {
      if (!isPreviewable(doc.document_name)) return;

      setPreviewDoc(doc);
      setPreviewLoading(true);
      setPreviewBlobUrl(null);
      setImageZoom(1);
      setImageRotation(0);
      setPreviewFullscreen(false);

      const guessedMime = getMimeFromName(doc.document_name);
      const usePdfProxy =
        isPdfMime(guessedMime, doc.document_name) &&
        excludeEmployeeId &&
        doc.id > 0;

      if (usePdfProxy) {
        setPreviewMime(guessedMime);
        setPreviewLoading(false);
        return;
      }

      try {
        let blob: Blob;
        try {
          blob = await fetchPreviewBlob(doc);
        } catch {
          blob = await fetchDocumentBlob(doc);
        }

        const finalBlob = toPreviewBlob(blob, doc.document_name);
        setPreviewMime(finalBlob.type || guessedMime);

        const url = URL.createObjectURL(finalBlob);
        setPreviewBlobUrl(url);
      } catch (error: unknown) {
        const err = error as EmployeeApiError;
        toast.error(err.message || "Failed to load document preview.");
        setPreviewDoc(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [excludeEmployeeId, fetchPreviewBlob, fetchDocumentBlob],
  );

  const openLocalFilePreview = useCallback((file: File) => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    const finalBlob = toPreviewBlob(file, file.name);
    const url = URL.createObjectURL(finalBlob);
    setPreviewBlobUrl(url);
    setPreviewMime(finalBlob.type || getMimeFromName(file.name));
    setPreviewDoc({
      id: 0,
      document_name: file.name,
      document_type: "Pending upload",
    } as EmployeeDocumentRecord);
    setPreviewLoading(false);
    setPreviewFullscreen(false);
    setImageZoom(1);
    setImageRotation(0);
  }, [previewBlobUrl]);

  const closePreview = useCallback(() => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewDoc(null);
    setPreviewBlobUrl(null);
    setPreviewLoading(false);
    setPreviewFullscreen(false);
    setImageZoom(1);
    setImageRotation(0);
  }, [previewBlobUrl]);

  const openInNewTab = useCallback(() => {
    if (
      previewDoc &&
      excludeEmployeeId &&
      previewDoc.id > 0 &&
      isPdfMime(previewMime, previewDoc.document_name)
    ) {
      window.open(
        buildEmployeeDocumentPreviewUrl(excludeEmployeeId, previewDoc.id),
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (previewBlobUrl) {
      window.open(previewBlobUrl, "_blank", "noopener,noreferrer");
    }
  }, [previewBlobUrl, previewDoc, excludeEmployeeId, previewMime]);

  const downloadDocument = useCallback(
    async (doc: EmployeeDocumentRecord) => {
      setActionDocId(doc.id);
      try {
        let blob: Blob;
        try {
          blob = await fetchPreviewBlob(doc);
        } catch {
          blob = await fetchDocumentBlob(doc);
        }
        const blobUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = doc.document_name || `document-${doc.id}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(blobUrl);
        toast.success("Document downloaded successfully!");
      } catch (error: unknown) {
        const err = error as EmployeeApiError;
        toast.error(err.message || "Failed to download document.");
      } finally {
        setActionDocId(null);
      }
    },
    [fetchPreviewBlob, fetchDocumentBlob],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!previewDoc) return;
      if (e.key === "Escape") closePreview();
      if (e.key === "f" || e.key === "F") setPreviewFullscreen((p) => !p);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewDoc, closePreview]);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  const pdfPreviewUrl =
    previewDoc && excludeEmployeeId && previewDoc.id > 0 && isPdfMime(previewMime, previewDoc.document_name)
      ? buildEmployeeDocumentPreviewUrl(excludeEmployeeId, previewDoc.id)
      : null;

  if (stepIndex === 0) {
    return (
      <div key="step-basic-info" className="space-y-4">
        <input type="hidden" {...register("status")} />
        
        {/* Company & Branch Inputs Side-by-Side */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <div className="flex-1">
            <Label htmlFor="company_id" markRequired>
              Company
            </Label>
            <NativeSelect className={selectClass} id="company_id" {...register("company_id")}>
              <option disabled value={0}>
                Select company
              </option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </NativeSelect>
            {errors.company_id ? (
              <p className="mt-1 text-xs text-destructive">{errors.company_id.message}</p>
            ) : null}
          </div>
          <div className="flex-1">
            <Label htmlFor="branch_id" markRequired>
              Branch
            </Label>
            <NativeSelect
              className={selectClass}
              disabled={!companyId || companyId === 0}
              id="branch_id"
              {...register("branch_id")}
            >
              <option disabled value={0}>
                {companyId ? "Select branch" : "Select company first"}
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </NativeSelect>
            {errors.branch_id ? (
              <p className="mt-1 text-xs text-destructive">{errors.branch_id.message}</p>
            ) : null}
          </div>
        </div>

        {/* First Name & Last Name Side-by-Side */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <div className="flex-1">
            <Label htmlFor="first_name" markRequired>
              First name
            </Label>
            <Input autoComplete="given-name" id="first_name" {...register("first_name")} />
            {errors.first_name ? (
              <p className="mt-1 text-xs text-destructive">{errors.first_name.message}</p>
            ) : null}
          </div>
          <div className="flex-1">
            <Label htmlFor="last_name" markRequired>
              Last name
            </Label>
            <Input autoComplete="family-name" id="last_name" {...register("last_name")} />
            {errors.last_name ? (
              <p className="mt-1 text-xs text-destructive">{errors.last_name.message}</p>
            ) : null}
          </div>
        </div>

        {/* Work Email, Phone, & Joining Date Side-by-Side */}
        <div className="flex flex-col md:flex-row gap-4 w-full">
          <div className="flex-1">
            <Label htmlFor="email" markRequired>
              Work email
            </Label>
            <ClearableInput<EmployeeWizardValues>
              className={errors.email ? inputErrorClass : undefined}
              inputMode="email"
              name={"email"}
              placeholder="name@company.com"
              type="email"
            />
            {errors.email ? (
              <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>
          <div className="flex-1">
            <Label htmlFor="phone" markRequired>
              Phone
            </Label>
            <Input
              autoComplete="tel"
              id="phone"
              inputMode="numeric"
              maxLength={10}
              placeholder="10 digits"
              {...register("phone")}
            />
            {errors.phone ? (
              <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>
            ) : null}
          </div>
          <div className="flex-1">
            <Label htmlFor="joining_date" markRequired>
              Joining date
            </Label>
            <Input id="joining_date" type="date" {...register("joining_date")} />
            {errors.joining_date ? (
              <p className="mt-1 text-xs text-destructive">{errors.joining_date.message}</p>
            ) : null}
          </div>
        </div>

        {loadingDeps ? (
          <p className="text-xs text-muted-foreground">Loading directory data…</p>
        ) : null}
      </div>
    );
  }

  if (stepIndex === 1) {
    return (
      <div key="step-job-details" className="space-y-4">
        
        {/* Department & Designation Side-by-Side */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <div className="flex-1">
            <Label htmlFor="department_id" markRequired>
              Department
            </Label>
            <NativeSelect className={selectClass} id="department_id" {...register("department_id")}>
              <option disabled value={0}>
                Select department
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
            {errors.department_id ? (
              <p className="mt-1 text-xs text-destructive">{errors.department_id.message}</p>
            ) : null}
          </div>
          <div className="flex-1">
            <Label htmlFor="designation_id" markRequired>
              Designation
            </Label>
            <NativeSelect className={selectClass} id="designation_id" {...register("designation_id")}>
              <option disabled value={0}>
                Select designation
              </option>
              {designations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
            {errors.designation_id ? (
              <p className="mt-1 text-xs text-destructive">{errors.designation_id.message}</p>
            ) : null}
          </div>
        </div>

        {/* Reporting Manager & Shift Side-by-Side */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <div className="flex-1">
            <ManagerCombobox
              branchId={branchId > 0 ? branchId : undefined}
              companyId={companyId > 0 ? companyId : undefined}
              disabled={!companyId}
              excludeEmployeeId={excludeEmployeeId ?? undefined}
              fetchManagers={fetchManagerHits}
              token={token}
            />
            {errors.reporting_manager_id ? (
              <p className="mt-1 text-xs text-destructive">{errors.reporting_manager_id.message}</p>
            ) : null}
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="shift_id">Shift</Label>
            <NativeSelect className={selectClass} id="shift_id" {...register("shift_id")}>
              <option value="">Not selected</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shift_name || s.name}
                </option>
              ))}
            </NativeSelect>
            <Link
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto")}
              href="/shift-rules"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add shift
            </Link>
          </div>
        </div>

        <div className="max-w-md">
          <Label htmlFor="geolocation_id">
            Geo location <OptionalHint />
          </Label>
          <NativeSelect className={selectClass} id="geolocation_id" {...register("geolocation_id")}>
            <option value="">Not selected</option>
            {filteredGeolocations.map((loc) => (
              <option key={String(loc.id)} value={String(loc.id)}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Employment Type */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <fieldset className="flex-1">
            <legend className="mb-2 text-sm font-medium">
              Employment type <span className="text-destructive">*</span>
            </legend>
            <div className="flex flex-wrap gap-4 mt-2">
              {(
                [
                  ["full_time", "Full-time"],
                  ["part_time", "Part-time"],
                  ["contract", "Contract"],
                ] as const
              ).map(([value, label]) => (
                <label className="flex cursor-pointer items-center gap-2 text-sm" key={value}>
                  <input
                    className="h-4 w-4 accent-primary"
                    type="radio"
                    value={value}
                    {...register("employment_type")}
                  />
                  {label}
                </label>
              ))}
            </div>
            {errors.employment_type ? (
              <p className="mt-1 text-xs text-destructive">{errors.employment_type.message}</p>
            ) : null}
          </fieldset>
        </div>

        {/* Probation Period (single input) */}
        <div className="max-w-md">
          <Label htmlFor="probation_period">
            Probation (months) <OptionalHint />
          </Label>
          <Controller
            control={control}
            name="probation_period"
            render={({ field }) => (
              <Input
                autoComplete="off"
                className={errors.probation_period ? inputErrorClass : undefined}
                id="probation_period"
                inputMode="numeric"
                min={0}
                name="probation_months_no_autofill"
                onChange={(e) => {
                  const raw = e.target.value;
                  field.onChange(raw === "" ? undefined : Number(raw));
                }}
                placeholder="e.g. 2"
                step={1}
                type="number"
                value={field.value ?? ""}
              />
            )}
          />
        </div>
      </div>
    );
  }

  if (stepIndex === 2) {
    return (
      <div key="step-personal-details" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div>
          <Label htmlFor="date_of_birth" markRequired>
            Date of birth
          </Label>
          <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
          {errors.date_of_birth ? (
            <p className="mt-1 text-xs text-destructive">{errors.date_of_birth.message}</p>
          ) : null}
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Gender</legend>
          <div className="flex flex-wrap gap-3">
            {(["male", "female", "other"] as const).map((g) => (
              <label className="flex cursor-pointer items-center gap-2 text-sm capitalize" key={g}>
                <input className="h-4 w-4 accent-primary" type="radio" value={g} {...register("gender")} />
                {g}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Label htmlFor="nationality" markRequired>
            Nationality
          </Label>
          <Input id="nationality" {...register("nationality")} />
          {errors.nationality ? (
            <p className="mt-1 text-xs text-destructive">{errors.nationality.message}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="marital_status">Marital status</Label>
          <NativeSelect className={selectClass} id="marital_status" {...register("marital_status")}>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="other">Other</option>
          </NativeSelect>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="blood_group">
            Blood group <OptionalHint />
          </Label>
          <NativeSelect className={selectClass} id="blood_group" {...register("blood_group")}>
            <option value="">Not selected</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
    );
  }

  if (stepIndex === 3) {
    return (
      <div key="step-contact-details" className="grid gap-5">
        <div>
          <Label htmlFor="current_address">Current address</Label>
          <Textarea id="current_address" rows={3} {...register("current_address")} />
        </div>
        <div>
          <Label htmlFor="permanent_address">Permanent address</Label>
          <Textarea id="permanent_address" rows={3} {...register("permanent_address")} />
        </div>
        <div className="sm:grid sm:grid-cols-2 sm:gap-5">
          <div>
            <Label htmlFor="personal_email">
              Personal email <OptionalHint />
            </Label>
            <ClearableInput<EmployeeWizardValues>
              className={errors.personal_email ? inputErrorClass : undefined}
              name={"personal_email"}
              placeholder="name.personal@example.com"
              type="email"
            />
            {errors.personal_email ? (
              <p className="mt-1 text-xs text-destructive">{errors.personal_email.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="emergency_contact_name" markRequired>
              Emergency contact name
            </Label>
            <Input id="emergency_contact_name" {...register("emergency_contact_name")} />
            {errors.emergency_contact_name ? (
              <p className="mt-1 text-xs text-destructive">{errors.emergency_contact_name.message}</p>
            ) : null}
          </div>
        </div>
        <div className="max-w-md">
          <Label htmlFor="emergency_contact_phone" markRequired>
            Emergency contact phone
          </Label>
          <Input
            id="emergency_contact_phone"
            inputMode="numeric"
            maxLength={10}
            placeholder="10 digits"
            {...register("emergency_contact_phone")}
          />
          {errors.emergency_contact_phone ? (
            <p className="mt-1 text-xs text-destructive">{errors.emergency_contact_phone.message}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (stepIndex === 4) {
    return (
      <div key="step-bank-details" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="bank_name">Bank name</Label>
          <Input autoComplete="off" id="bank_name" list="indian-bank-suggestions" {...register("bank_name")} />
          <datalist id="indian-bank-suggestions">
            {INDIAN_BANKS.map((bank) => (
              <option key={bank} value={bank} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="account_number" markRequired>
            Account number
          </Label>
          <Input autoComplete="off" id="account_number" inputMode="numeric" {...register("account_number")} />
          {errors.account_number ? (
            <p className="mt-1 text-xs text-destructive">{errors.account_number.message}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="ifsc_code" markRequired>
            IFSC code
          </Label>
          <Input
            autoComplete="off"
            className="uppercase"
            id="ifsc_code"
            maxLength={11}
            placeholder="HDFC0001234"
            {...register("ifsc_code", {
              onChange: (e) => {
                e.target.value = e.target.value.toUpperCase();
              },
            })}
          />
          {errors.ifsc_code ? (
            <p className="mt-1 text-xs text-destructive">{errors.ifsc_code.message}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Format: ABCD0123456</p>
          )}
        </div>
        <div>
          <Label htmlFor="account_holder_name">Account holder name</Label>
          <div className="flex gap-2">
            <Input autoComplete="off" className="flex-1" id="account_holder_name" {...register("account_holder_name")} />
            <Button
              onClick={() => {
                const autoName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
                if (autoName) setValue("account_holder_name", autoName, { shouldDirty: true });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Use name
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Auto-filled from basic information when empty.
          </p>
        </div>
        <div>
          <Label htmlFor="account_type">Account type</Label>
          <NativeSelect className={selectClass} id="account_type" {...register("account_type")}>
            <option value="savings">Savings</option>
            <option value="current">Current</option>
          </NativeSelect>
        </div>
      </div>
    );
  }

  if (stepIndex === 5) {
    return (
      <div key="step-statutory-details" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div>
          <Label htmlFor="pan_number">
            PAN number <OptionalHint />
          </Label>
          <Input
            autoComplete="off"
            className={cn("uppercase", errors.pan_number ? inputErrorClass : undefined)}
            id="pan_number"
            maxLength={10}
            placeholder="ABCDE1234F"
            {...register("pan_number", {
              onChange: (e) => {
                e.target.value = e.target.value.toUpperCase();
              },
            })}
          />
          {errors.pan_number ? (
            <p className="mt-1 text-xs text-destructive">{errors.pan_number.message}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="aadhaar_number" markRequired>
            Aadhaar number
          </Label>
          <Input
            autoComplete="off"
            className={errors.aadhaar_number ? inputErrorClass : undefined}
            id="aadhaar_number"
            inputMode="numeric"
            maxLength={12}
            placeholder="12 digit number"
            {...register("aadhaar_number")}
          />
          {errors.aadhaar_number ? (
            <p className="mt-1 text-xs text-destructive">{errors.aadhaar_number.message}</p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="uan_number">
            UAN number <OptionalHint />
          </Label>
          <Input autoComplete="off" id="uan_number" inputMode="numeric" {...register("uan_number")} />
          {errors.uan_number ? (
            <p className="mt-1 text-xs text-destructive">{errors.uan_number.message}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (stepIndex === 6) {
    return (
      <LeavePolicyAssignStep
        companyId={companyId ? Number(companyId) : 0}
        key="step-leave-policy"
        token={token}
      />
    );
  }

  if (stepIndex === 7) {
    return (
      <div key="step-documents" className="space-y-4">
        {uploadedDocs && uploadedDocs.length > 0 && (
          <div className="space-y-3 rounded-xl border border-border p-5 bg-card shadow-sm">
            <h3 className="text-sm font-bold text-foreground">Uploaded Documents</h3>
            <ul className="divide-y divide-border/60">
              {uploadedDocs.map((doc) => (
                <li
                  className="flex items-center justify-between py-3 text-sm first:pt-0 last:pb-0"
                  key={doc.id}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 text-xs font-semibold text-foreground border border-border/40">
                      {getFileIcon(doc.document_name)}
                      {doc.document_type}
                    </span>
                    {isPreviewable(doc.document_name) ? (
                      <button
                        onClick={() => openPreview(doc)}
                        type="button"
                        className="font-semibold text-foreground hover:text-primary transition-colors hover:underline text-left truncate max-w-[150px] sm:max-w-xs md:max-w-md"
                        title="Preview document"
                      >
                        {doc.document_name}
                      </button>
                    ) : (
                      <span
                        className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-xs md:max-w-md"
                        title={doc.document_name}
                      >
                        {doc.document_name}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {isPreviewable(doc.document_name) && (
                      <Button
                        aria-label="Preview document"
                        disabled={previewLoading && previewDoc?.id === doc.id}
                        onClick={() => openPreview(doc)}
                        size="icon"
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                      >
                        {previewLoading && previewDoc?.id === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      aria-label="Download document"
                      disabled={actionDocId === doc.id}
                      onClick={() => downloadDocument(doc)}
                      size="icon"
                      type="button"
                      variant="ghost"
                      className="h-8 w-8 text-foreground hover:bg-muted"
                    >
                      {actionDocId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      aria-label="Delete document"
                      disabled={deletingDocId === doc.id}
                      onClick={() => onDeleteDoc?.(doc.id)}
                      size="icon"
                      type="button"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-destructive/10"
                    >
                      {deletingDocId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Add multiple documents. Supported: PDF, JPG, PNG.
          </p>
          <Button
            onClick={() => append({ document_type: "", file: undefined })}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            Add document
          </Button>
        </div>
        {fields.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No documents added. You can skip this step or add rows above.
          </p>
        ) : (
          <ul className="space-y-4">
            {fields.map((field, index) => (
              <li
                className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-end"
                key={field.id}
              >
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`doc-type-${index}`}>Document type</Label>
                  <Input id={`doc-type-${index}`} {...register(`documents.${index}.document_type` as const)} />
                  {errors.documents?.[index]?.document_type ? (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.documents[index]?.document_type?.message}
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`doc-file-${index}`}>File</Label>
                  <Controller
                    control={control}
                    name={`documents.${index}.file`}
                    render={({ field: f }) => (
                      <div>
                        <Input
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          id={`doc-file-${index}`}
                          onChange={(e) => f.onChange(e.target.files?.[0])}
                          type="file"
                        />
                        {f.value instanceof File ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="truncate text-xs text-muted-foreground max-w-full">
                              {f.value.name}
                            </p>
                            {isPreviewable(f.value.name) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => openLocalFilePreview(f.value as File)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Preview
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  />
                  {errors.documents?.[index]?.file ? (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.documents[index]?.file?.message as string}
                    </p>
                  ) : null}
                </div>
                <Button
                  aria-label="Remove row"
                  className="shrink-0"
                  onClick={() => remove(index)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <AnimatePresence>
          {previewDoc && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closePreview();
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`relative flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
                  previewFullscreen ? "w-full h-full rounded-none" : "w-full max-w-5xl h-[85vh]"
                }`}
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30 shrink-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-background border border-border rounded-lg shadow-sm">
                       {getFileIcon(previewDoc.document_name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">
                        {previewDoc.document_name || "Document Preview"}
                      </h3>
                      <p className="text-[10px] text-muted-foreground font-medium truncate flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{previewDoc.document_type}</span> 
                        <span>• Uploaded {formatDate(previewDoc.uploaded_at ?? previewDoc.created_at)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-3 bg-background border border-border/60 rounded-xl p-1 shadow-sm">
                    {previewMime.startsWith("image/") && previewBlobUrl && (
                      <>
                        <button
                          onClick={() => setImageZoom((z) => Math.max(0.25, z - 0.25))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Zoom Out"
                          type="button"
                        >
                          <ZoomOut className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] font-mono font-bold text-foreground min-w-[36px] text-center bg-muted/30 py-1 rounded">
                          {Math.round(imageZoom * 100)}%
                        </span>
                        <button
                          onClick={() => setImageZoom((z) => Math.min(4, z + 0.25))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Zoom In"
                          type="button"
                        >
                          <ZoomIn className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setImageRotation((r) => (r + 90) % 360)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Rotate"
                          type="button"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </button>
                        <div className="w-px h-5 bg-border mx-1" />
                      </>
                    )}

                    <button
                      onClick={openInNewTab}
                      disabled={!previewBlobUrl && !pdfPreviewUrl}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30"
                      title="Open in New Tab"
                      type="button"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => previewDoc && downloadDocument(previewDoc)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-blue-500 hover:bg-blue-500/10 hover:text-blue-600 transition-colors"
                      title="Download"
                      type="button"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setPreviewFullscreen((f) => !f)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title={previewFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                      type="button"
                    >
                      {previewFullscreen ? (
                        <Minimize2 className="h-3.5 w-3.5" />
                      ) : (
                        <Maximize2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <div className="w-px h-5 bg-border mx-1" />
                    <button
                      onClick={closePreview}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Close (Esc)"
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-black/5 relative min-h-[300px]">
                  <DocumentPreviewViewport
                    fileName={previewDoc.document_name}
                    mime={previewMime}
                    loading={previewLoading}
                    pdfPreviewUrl={pdfPreviewUrl}
                    blobPreviewUrl={previewBlobUrl}
                    imageZoom={imageZoom}
                    imageRotation={imageRotation}
                    onOpenInNewTab={openInNewTab}
                    onDownload={() => {
                      if (previewDoc.id === 0 && previewBlobUrl) {
                        const anchor = document.createElement("a");
                        anchor.href = previewBlobUrl;
                        anchor.download = previewDoc.document_name || "document";
                        document.body.appendChild(anchor);
                        anchor.click();
                        anchor.remove();
                        return;
                      }
                      void downloadDocument(previewDoc);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between px-5 py-2.5 border-t border-border bg-muted/20 text-[10px] text-muted-foreground shrink-0">
                  <span className="font-mono bg-background px-2 py-0.5 rounded border border-border/50 font-semibold">{previewMime || "unknown"}</span>
                  <span className="flex items-center gap-1.5">Press <kbd className="px-1.5 py-0.5 bg-background rounded shadow-sm font-bold font-mono border border-border/60">Esc</kbd> to close <span className="opacity-50">•</span> <kbd className="px-1.5 py-0.5 bg-background rounded shadow-sm font-bold font-mono border border-border/60">F</kbd> to toggle fullscreen</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (stepIndex === 8) {
    return (
      <ProfilePhotoStep
        key="step-profile-photo"
        authToken={token}
        existingProfilePhotoUrl={existingProfilePhotoUrl}
        onExistingProfilePhotoUpdated={onExistingProfilePhotoUpdated}
      />
    );
  }

  return null;
}

function ProfilePhotoStep({
  existingProfilePhotoUrl,
  authToken,
  onExistingProfilePhotoUpdated,
}: {
  existingProfilePhotoUrl?: string | null;
  authToken?: string;
  onExistingProfilePhotoUpdated?: (url: string | null) => void;
}) {
  const {
    control,
    formState: { errors },
    watch,
  } = useFormContext<EmployeeWizardValues>();
  const firstName = watch("first_name");
  const lastName = watch("last_name");
  const employeeName = `${firstName ?? ""} ${lastName ?? ""}`.trim();

  return (
    <Controller
      control={control}
      name="profile_photo"
      render={({ field: { value, onChange } }) => (
        <ProfilePhotoCropper
          authToken={authToken}
          employeeName={employeeName}
          error={errors.profile_photo ? String(errors.profile_photo.message) : undefined}
          existingPhotoUrl={existingProfilePhotoUrl}
          onChange={onChange}
          onExistingPhotoUpdated={onExistingProfilePhotoUpdated}
          value={value}
        />
      )}
    />
  );
}

function SummaryView({
  companies,
  branches,
  departments,
  designations,
}: {
  companies: Tenant[];
  branches: Branch[];
  departments: Department[];
  designations: Designation[];
}) {
  const { getValues } = useFormContext<EmployeeWizardValues>();
  const v = getValues();

  const comp = companies.find((c) => c.id === Number(v.company_id));
  const companyName = comp ? comp.company_name : `Company #${v.company_id}`;

  const br = branches.find((b) => b.id === Number(v.branch_id));
  const branchName = br ? `${br.name} (${br.code})` : `Branch #${v.branch_id}`;

  const deptName = departments.find((d) => d.id === Number(v.department_id))?.name || `Department #${v.department_id}`;
  const desName = designations.find((d) => d.id === Number(v.designation_id))?.name || `Designation #${v.designation_id}`;

  const rows: { label: string; value: string }[] = [
    { label: "Company / Branch", value: `${companyName} / ${branchName}` },
    { label: "Name", value: `${v.first_name} ${v.last_name}`.trim() },
    { label: "Email", value: v.email },
    { label: "Phone", value: v.phone || "—" },
    { label: "Joining date", value: formatDisplayDate(v.joining_date) },
    { label: "Department / Designation", value: `${deptName} / ${desName}` },
    { label: "Reporting manager", value: v.reporting_manager_label || "—" },
    { label: "Employment type", value: (v.employment_type ?? "").replace(/_/g, " ") },
    { label: "DOB", value: formatDisplayDate(v.date_of_birth) },
    { label: "Gender / Nationality", value: `${v.gender} / ${v.nationality}` },
    { label: "PAN / Aadhaar", value: `${v.pan_number} / ${v.aadhaar_number}` },
    {
      label: "Leave policy",
      value: v.leave_policy_skipped
        ? "Skipped"
        : v.leave_policy_label?.trim()
          ? `${v.leave_policy_label}${v.effective_from ? ` (from ${formatDisplayDate(v.effective_from)})` : ""}`
          : "Not assigned",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2" key={r.label}>
          <p className="text-xs font-medium text-muted-foreground">{r.label}</p>
          <p className="text-sm text-foreground">{r.value}</p>
        </div>
      ))}
    </div>
  );
}

type EmployeeAddWizardProps = {
  editEmployeeId?: number | null;
  initialData?: EmployeeRecord | null;
  isLoading?: boolean;
};

export function EmployeeAddWizard({ editEmployeeId, initialData, isLoading }: EmployeeAddWizardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const previousCompanyRef = useRef<number | null>(null);
  const hasInitializedRef = useRef<number | null>(null);
  const lastInitialDataRef = useRef<string>("");
  const [token, setToken] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<{ message: string } | null>(null);
  const [existingProfilePhotoUrl, setExistingProfilePhotoUrl] = useState<string | null>(null);

  const methods = useForm<EmployeeWizardValues>({
    defaultValues: getEmployeeWizardDefaults(),
    mode: "onChange",
    delayError: 300,
  });

  const { getValues, setError, clearErrors, setValue, watch, control } = methods;
  const companyIdWatch = useWatch({ control, name: "company_id" });
  const probationWatch = watch("probation_period");
  const phoneWatch = watch("phone");
  const formSnapshot = watch();

  const companyId = companyIdWatch ? Number(companyIdWatch) : 0;

  const tenantsQuery = useQuery({
    queryKey: ["wizard-companies", token],
    queryFn: () => getTenantsList(token, 1, 100),
    enabled: Boolean(token),
  });

  const branchesQuery = useQuery({
    queryKey: ["wizard-branches", token, companyId],
    queryFn: () =>
      getBranches(token, {
        company_id: String(companyId),
        per_page: 200,
        page: 1,
      }),
    enabled: Boolean(token) && companyId > 0,
  });

  const departmentsQuery = useQuery({
    queryKey: ["wizard-departments", token, companyId],
    queryFn: () =>
      getDepartments(token, {
        company_id: String(companyId),
        per_page: 200,
        page: 1,
      }),
    enabled: Boolean(token) && companyId > 0,
  });

  const designationsQuery = useQuery({
    queryKey: ["wizard-designations", token, companyId],
    queryFn: () =>
      getDesignations(token, {
        company_id: String(companyId),
        per_page: 200,
        page: 1,
      }),
    enabled: Boolean(token) && companyId > 0,
  });

  const shiftsQuery = useQuery({
    queryKey: ["wizard-shifts", token, companyId],
    queryFn: () =>
      getShifts(token, {
        company_id: String(companyId),
        per_page: 100,
        page: 1,
      }),
    enabled: Boolean(token) && companyId > 0,
  });

  const locationsQuery = useQuery({
    queryKey: ["wizard-geolocations", token],
    queryFn: () => getLocations(token),
    enabled: Boolean(token),
  });

  const documentsQuery = useQuery({
    queryKey: ["employee-documents", employeeId, token],
    queryFn: () => getEmployeeDocuments(token, employeeId as number),
    enabled: Boolean(token) && Boolean(employeeId),
  });

  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);

  const handleDeleteDocument = async (docId: number) => {
    if (!token || !employeeId) return;
    if (!confirm("Are you sure you want to delete this document?")) return;
    setDeletingDocId(docId);
    try {
      const res = await deleteEmployeeDocument(token, employeeId, docId);
      toast.success(res.message || "Document deleted successfully.");
      void queryClient.invalidateQueries({ queryKey: ["employee-documents", employeeId, token] });
    } catch (e) {
      const err = e as EmployeeApiError;
      toast.error(err.message || "Failed to delete document.");
    } finally {
      setDeletingDocId(null);
    }
  };

  const companies: Tenant[] = tenantsQuery.data?.data ?? [];
  const branches = normalizeList<Branch>(branchesQuery.data?.data);
  const departments = normalizeList<Department>(departmentsQuery.data?.data);
  const designations = normalizeList<Designation>(designationsQuery.data?.data);
  const shifts = normalizeList<Shift>(shiftsQuery.data?.data);
  const geolocations = normalizeList<GeoLocation>(locationsQuery.data?.data);

  const loadingDeps =
    tenantsQuery.isLoading ||
    locationsQuery.isLoading ||
    (companyId > 0 &&
      (branchesQuery.isLoading ||
        departmentsQuery.isLoading ||
        designationsQuery.isLoading ||
        shiftsQuery.isLoading));

  const canProceedToNext = useMemo(() => {
    if (stepIndex >= STEP_SCHEMAS.length) return true;
    return STEP_SCHEMAS[stepIndex].safeParse(formSnapshot).success;
  }, [formSnapshot, stepIndex]);

  const focusFirstField = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const first = root.querySelector<HTMLElement>(
      "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled])",
    );
    first?.focus();
  }, []);

  const focusFirstError = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const firstError = root.querySelector<HTMLElement>(".text-destructive");
    if (!firstError) return;
    const fieldWrapper = firstError.closest("div");
    const field = fieldWrapper?.querySelector<HTMLElement>("input,select,textarea,button");
    if (field) {
      field.focus();
      field.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  useEffect(() => {
    setToken(Cookies.get("auth_token") ?? "");
  }, []);

  useEffect(() => {
    if (companies && companies.length === 1 && !editEmployeeId && companyId === 0) {
      setValue("company_id", companies[0].id);
    }
  }, [companies, editEmployeeId, companyId, setValue]);

  // Auto-select "Employee" designation for new employees once designations load
  useEffect(() => {
    if (editEmployeeId) return;               // skip for edit — initialData handles it
    if (designations.length === 0) return;    // not loaded yet
    const currentDesigId = Number(getValues("designation_id") ?? 0);
    if (currentDesigId > 0) return;           // user already picked one

    const employeeDesig = designations.find(
      (d) => d.name?.trim().toLowerCase() === "employee"
    ) ?? designations.find(
      (d) => d.name?.trim().toLowerCase().includes("employee")
    );

    if (employeeDesig) {
      setValue("designation_id", employeeDesig.id, { shouldValidate: true });
    }
  }, [designations, editEmployeeId, getValues, setValue]);


  // If we transition to Add Employee mode (editEmployeeId is null), reset wizard states & form
  useEffect(() => {
    if (editEmployeeId === null) {
      setEmployeeId(null);
      setStepIndex(0);
      methods.reset(getEmployeeWizardDefaults());
      hasInitializedRef.current = null;
      lastInitialDataRef.current = "";
      previousCompanyRef.current = null;
      setApiError(null);
      setExistingProfilePhotoUrl(null);
    }
  }, [editEmployeeId, methods]);

  useEffect(() => {
    if (!editEmployeeId) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const todayStr = `${yyyy}-${mm}-${dd}`;
      setValue("joining_date", todayStr);
    }
  }, [editEmployeeId, setValue]);

  useEffect(() => {
    const currentCompany = companyIdWatch ? Number(companyIdWatch) : 0;
    if (currentCompany === 0) return;
    if (previousCompanyRef.current === null) {
      previousCompanyRef.current = currentCompany;
      return;
    }
    if (previousCompanyRef.current !== currentCompany) {
      setValue("branch_id", 0);
      previousCompanyRef.current = currentCompany;
    }
  }, [companyIdWatch, setValue]);

  // Guard against aggressive browser autofill putting phone into probation field.
  useEffect(() => {
    if (stepIndex !== 1) return;
    const probationRaw = probationWatch;
    if (probationRaw === undefined || probationRaw === null) return;
    const probationDigits = String(probationRaw).replace(/\D/g, "");
    const phoneDigits = String(phoneWatch ?? "").replace(/\D/g, "");
    const looksLikePhone = probationDigits.length >= 10;
    const sameAsPhone = phoneDigits.length > 0 && probationDigits === phoneDigits;
    if (looksLikePhone || sameAsPhone) {
      setValue("probation_period", undefined, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [stepIndex, probationWatch, phoneWatch, setValue]);

  useEffect(() => {
    if (!initialData) return;
    const currentId = editEmployeeId ?? initialData.id ?? null;
    const initialDataStr = JSON.stringify(initialData);
    if (hasInitializedRef.current === currentId && currentId !== null) {
      return;
    }
    hasInitializedRef.current = currentId;
    lastInitialDataRef.current = initialDataStr;
    setEmployeeId(currentId);
    const initialCompanyId = Number(initialData.company_id ?? 0);
    previousCompanyRef.current = initialCompanyId;
    const safeDate = (val: any) => {
      if (!val) return "";
      const s = String(val).split("T")[0];
      const p = s.split(/[-/]/);
      if (p.length === 3) {
        if (p[0].length <= 2 && p[2].length === 4) return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
        if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
      }
      return s;
    };

    setValue("company_id", initialCompanyId);
    setValue("branch_id", Number(initialData.branch_id ?? 0));
    setValue("first_name", initialData.first_name ?? "");
    setValue("last_name", initialData.last_name ?? "");
    setValue("email", initialData.email ?? "");
    setValue("phone", (initialData as any).phone ?? initialData.mobile ?? "");
    setValue("joining_date", safeDate(initialData.joining_date));

    const anyData = initialData as any;
    
    // Job Details
    const jd = anyData.job_detail || anyData.job_details || anyData;
    if (jd.department_id) setValue("department_id", Number(jd.department_id));
    if (jd.designation_id) setValue("designation_id", Number(jd.designation_id));
    if (
      jd.reporting_manager_id &&
      Number(jd.reporting_manager_id) !== Number(editEmployeeId ?? 0)
    ) {
      setValue("reporting_manager_id", Number(jd.reporting_manager_id));
    }
    if (jd.employment_type) {
      const et = String(jd.employment_type).toLowerCase().replace(/[- ]/g, "_");
      if (et === "full_time" || et === "part_time" || et === "contract") {
        setValue("employment_type", et as "full_time" | "part_time" | "contract");
      } else if (et.includes("part")) {
        setValue("employment_type", "part_time");
      } else if (et.includes("contract")) {
        setValue("employment_type", "contract");
      } else {
        setValue("employment_type", "full_time");
      }
    }
    if (jd.probation_period !== undefined && jd.probation_period !== null) setValue("probation_period", Number(jd.probation_period));
    if (jd.confirmation_date) setValue("confirmation_date", safeDate(jd.confirmation_date));
    if (jd.shift_id) setValue("shift_id", Number(jd.shift_id));
    if (jd.geolocation_id) setValue("geolocation_id", Number(jd.geolocation_id));

    if (jd.reporting_manager?.first_name) {
      setValue("reporting_manager_label", `${jd.reporting_manager.first_name} ${jd.reporting_manager.last_name || ""}`.trim());
    } else if (jd.reporting_manager?.full_name) {
      setValue("reporting_manager_label", jd.reporting_manager.full_name);
    } else if (jd.reporting_manager?.name) {
      setValue("reporting_manager_label", jd.reporting_manager.name);
    } else if (anyData.reporting_manager?.name) {
      setValue("reporting_manager_label", anyData.reporting_manager.name);
    }

    // Personal Details
    const pd = anyData.personal_detail || anyData.personal_details || anyData;
    const dob = pd.date_of_birth || pd.dob || anyData.date_of_birth || anyData.dob;
    if (dob) setValue("date_of_birth", safeDate(dob));
    if (pd.gender) {
      const g = String(pd.gender).toLowerCase();
      if (g === "male" || g === "female" || g === "other") setValue("gender", g as "male" | "female" | "other");
    }
    if (pd.nationality) setValue("nationality", pd.nationality);
    if (pd.marital_status) {
      const ms = String(pd.marital_status).toLowerCase();
      if (ms === "single" || ms === "married" || ms === "other") setValue("marital_status", ms as "single" | "married" | "other");
    }
    if (pd.blood_group) setValue("blood_group", pd.blood_group);

    
    // Contact Details
    const cd = anyData.contact_detail || anyData.contact_details || anyData;
    if (cd.current_address || anyData.address) setValue("current_address", cd.current_address || anyData.address);
    if (cd.permanent_address) setValue("permanent_address", cd.permanent_address);
    if (cd.personal_email) setValue("personal_email", cd.personal_email);
    
    const ec = anyData.emergency_contact || cd;
    if (ec.emergency_contact_name || ec.name) setValue("emergency_contact_name", ec.emergency_contact_name || ec.name);
    if (ec.emergency_contact_phone || ec.phone || ec.mobile) setValue("emergency_contact_phone", ec.emergency_contact_phone || ec.phone || ec.mobile);

    // Salary Details
    const sd = anyData.salary_detail || anyData.salary_details || anyData.salary || anyData;
    if (sd.basic_salary !== undefined && sd.basic_salary !== null) setValue("basic_salary", Number(sd.basic_salary));
    if (sd.hra !== undefined && sd.hra !== null) setValue("hra", Number(sd.hra));
    if (sd.allowances !== undefined && sd.allowances !== null) setValue("allowances", Number(sd.allowances));
    if (sd.deductions !== undefined && sd.deductions !== null) setValue("deductions", Number(sd.deductions));
    if (sd.pf_applicable !== undefined && sd.pf_applicable !== null) setValue("pf_applicable", Boolean(sd.pf_applicable));
    if (sd.esi_applicable !== undefined && sd.esi_applicable !== null) setValue("esi_applicable", Boolean(sd.esi_applicable));
    if (sd.tds_applicable !== undefined && sd.tds_applicable !== null) setValue("tds_applicable", Boolean(sd.tds_applicable));

    // Bank Details
    const bd = anyData.bank_detail || anyData.bank_details || anyData;
    if (bd.bank_name) setValue("bank_name", bd.bank_name);
    if (bd.account_number) setValue("account_number", bd.account_number);
    if (bd.ifsc_code) setValue("ifsc_code", bd.ifsc_code);
    if (bd.account_holder_name) setValue("account_holder_name", bd.account_holder_name);
    if (bd.account_type) setValue("account_type", String(bd.account_type).toLowerCase() === "current" ? "current" : "savings");

    // Statutory Details
    const std = anyData.statutory_detail || anyData.statutory_details || anyData;
    if (std.pan_number || std.pan_no || anyData.pan_no) setValue("pan_number", std.pan_number || std.pan_no || anyData.pan_no);
    if (std.aadhaar_number || std.aadhaar_no || anyData.aadhaar_no) setValue("aadhaar_number", std.aadhaar_number || std.aadhaar_no || anyData.aadhaar_no);
    if (std.uan_number || std.uan_no || anyData.uan_no) setValue("uan_number", std.uan_number || std.uan_no || anyData.uan_no);

    // Leave policy assignment
    const assignment =
      anyData.leave_policy_assignment ||
      anyData.policy_assignment ||
      anyData.leave_assignment;
    const jobDetail = anyData.job_detail || anyData.job_details;
    const policyId =
      assignment?.leave_policy_id ??
      assignment?.leave_policy?.id ??
      jobDetail?.leave_policy_id ??
      anyData.leave_policy_id;
    const effectiveFrom =
      assignment?.effective_from ?? assignment?.assignment?.effective_from;
    if (policyId != null && Number(policyId) > 0) {
      setValue("leave_policy_id", Number(policyId));
      const policyName =
        assignment?.leave_policy?.name ??
        jobDetail?.leave_policy?.name ??
        anyData.leave_policy?.name;
      if (policyName) setValue("leave_policy_label", String(policyName));
    }
    if (effectiveFrom) {
      setValue("effective_from", String(effectiveFrom).split("T")[0] ?? "");
    }

    const photoUrl = getEmployeeProfilePhotoUrl(anyData, currentId);
    setExistingProfilePhotoUrl(photoUrl);
  }, [initialData, editEmployeeId, setValue]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const t = window.setTimeout(() => focusFirstField(), 60);
    return () => window.clearTimeout(t);
  }, [stepIndex, focusFirstField]);

  const persistStep = useCallback(
    async (idx: number): Promise<boolean> => {
      const v = getValues();
      const t = token;
      if (!t) {
        toast.error("You are not signed in.");
        return false;
      }

      clearErrors();

      if (idx === 0) {
        const r = step1Schema.safeParse(v);
        if (!r.success) {
          applyZodIssues(setError, r.error.issues);
          return false;
        }
        try {
          if (employeeId) {
            const editStatus = initialData?.status === "active" ? "active" : "draft";
            const res = await updateEmployeeBasic(t, employeeId, {
              first_name: r.data.first_name,
              last_name: r.data.last_name,
              email: r.data.email,
              phone: r.data.phone || null,
              branch_id: r.data.branch_id,
              joining_date: r.data.joining_date,
              status: editStatus,
            });
            toast.success(res.message || "Basic information updated.");
            void queryClient.invalidateQueries({ queryKey: ["employee-detail"] });
          } else {
            const res = await createEmployee(t, {
              company_id: r.data.company_id,
              branch_id: r.data.branch_id,
              first_name: r.data.first_name,
              last_name: r.data.last_name,
              email: r.data.email,
              phone: r.data.phone || null,
              joining_date: r.data.joining_date,
              status: "draft",
            });
            const created = res.data as {
              id?: number;
              employee?: { id?: number };
            };
            const nested = (res.data as { employee?: { id?: number } } | null)?.employee;
            const id = created.id ?? nested?.id ?? created.employee?.id;
            if (typeof id !== "number") {
              toast.error("Employee created but ID was not returned.");
              return false;
            }
            setEmployeeId(id);
            toast.success(res.message || "Basic information saved.");
            router.replace(`/add-employee?edit=${id}`);
          }
          return true;
        } catch (e) {
          const err = e as EmployeeApiError;
          setApiError({ message: err.message });
          applyApiFieldErrors(setError, err.fieldErrors);
          toast.error(err.message);
          return false;
        }
      }

      const id = employeeId;
      if (id == null) {
        toast.error("Create the employee in step 1 first.");
        return false;
      }

      try {
        if (idx === 1) {
          const r = step2Schema.safeParse(v);
          if (!r.success) {
            applyZodIssues(setError, r.error.issues);
            return false;
          }
          const res = await saveJobDetails(t, id, {
            department_id: r.data.department_id,
            designation_id: r.data.designation_id,
            reporting_manager_id: r.data.reporting_manager_id ?? null,
            shift_id: r.data.shift_id ?? null,
            geolocation_id: r.data.geolocation_id ?? null,
            employment_type: r.data.employment_type,
            probation_period: r.data.probation_period ?? null,
            confirmation_date: r.data.confirmation_date?.trim()
              ? r.data.confirmation_date
              : null,
          });
          toast.success(res.message || "Job details saved.");
          void queryClient.invalidateQueries({ queryKey: ["employee-detail"] });
          return true;
        }
        if (idx === 2) {
          const r = step3Schema.safeParse(v);
          if (!r.success) {
            applyZodIssues(setError, r.error.issues);
            return false;
          }
          const res = await savePersonalDetails(t, id, {
            ...r.data,
            blood_group: r.data.blood_group ?? "",
          });
          toast.success(res.message || "Personal details saved.");
          void queryClient.invalidateQueries({ queryKey: ["employee-detail"] });
          return true;
        }
        if (idx === 3) {
          const r = step4Schema.safeParse(v);
          if (!r.success) {
            applyZodIssues(setError, r.error.issues);
            return false;
          }
          const res = await saveContactDetails(t, id, {
            current_address: r.data.current_address || null,
            permanent_address: r.data.permanent_address || null,
            personal_email: r.data.personal_email || null,
            emergency_contact_name: r.data.emergency_contact_name || null,
            emergency_contact_phone: r.data.emergency_contact_phone || null,
          });
          toast.success(res.message || "Contact details saved.");
          void queryClient.invalidateQueries({ queryKey: ["employee-detail"] });
          return true;
        }
        if (idx === 4) {
          const r = step6Schema.safeParse(v);
          if (!r.success) {
            applyZodIssues(setError, r.error.issues);
            return false;
          }
          const res = await saveBankDetails(t, id, {
            bank_name: r.data.bank_name || null,
            account_number: r.data.account_number,
            ifsc_code: r.data.ifsc_code,
            account_holder_name: r.data.account_holder_name || null,
            account_type: r.data.account_type,
          });
          toast.success(res.message || "Bank details saved.");
          void queryClient.invalidateQueries({ queryKey: ["employee-detail"] });
          return true;
        }
        if (idx === 5) {
          const r = step7Schema.safeParse(v);
          if (!r.success) {
            applyZodIssues(setError, r.error.issues);
            return false;
          }
          const res = await saveStatutoryDetails(t, id, {
            pan_number: r.data.pan_number,
            aadhaar_number: r.data.aadhaar_number,
            uan_number: r.data.uan_number || null,
          });
          toast.success(res.message || "Statutory details saved.");
          void queryClient.invalidateQueries({ queryKey: ["employee-detail"] });
          return true;
        }
        if (idx === 6) {
          const r = step8Schema.safeParse(v);
          if (!r.success) {
            applyZodIssues(setError, r.error.issues);
            return false;
          }
          if (r.data.leave_policy_skipped || !r.data.leave_policy_id) {
            toast.success(
              r.data.leave_policy_skipped
                ? "Leave policy assignment skipped."
                : "No leave policy assigned — you can assign later.",
            );
            return true;
          }
          const res = await assignEmployeeLeavePolicy(t, id, {
            leave_policy_id: r.data.leave_policy_id,
            effective_from: r.data.effective_from!.trim(),
          });
          const policyName = res.data?.leave_policy?.name || r.data.leave_policy_label || "Assigned Policy";
          setValue("leave_policy_label", policyName, { shouldDirty: false });
          toast.success(res.message || "Leave policy assigned successfully.");
          void queryClient.invalidateQueries({ queryKey: ["employee-detail"] });
          return true;
        }
        if (idx === 7) {
          const r = step9Schema.safeParse(v);
          if (!r.success) {
            applyZodIssues(setError, r.error.issues);
            return false;
          }
          const rows = r.data.documents
            .filter((row) => row.document_type.trim() && row.file instanceof File)
            .map((row) => ({
              document_type: row.document_type.trim(),
              file: row.file as File,
            }));
          if (rows.length === 0) {
            toast.success("No documents to upload — step skipped.");
            return true;
          }
          const res = await uploadDocuments(t, id, rows);
          toast.success(res.message || "Documents uploaded.");
          setValue("documents", []);
          void queryClient.invalidateQueries({ queryKey: ["employee-detail"] });
          void queryClient.invalidateQueries({ queryKey: ["employee-documents", id, t] });
          return true;
        }
        if (idx === 8) {
          const r = step10Schema.safeParse(v);
          if (!r.success) {
            applyZodIssues(setError, r.error.issues);
            return false;
          }
          if (r.data.profile_photo instanceof File) {
            const res = await uploadProfilePhoto(t, id, r.data.profile_photo);
            toast.success(res.message || "Profile photo uploaded.");
            const base =
              resolveApiAssetUrl(`/api/v1/employees/${id}/profile-photo`) ??
              getEmployeeProfilePhotoUrl(initialData, id);
            if (base) {
              setExistingProfilePhotoUrl(`${base}${base.includes("?") ? "&" : "?"}t=${Date.now()}`);
            }
            setValue("profile_photo", undefined);
          } else if (existingProfilePhotoUrl) {
            toast.success("Existing profile photo kept — no changes made.");
          } else {
            toast.success("No photo uploaded — you can add it later.");
          }
          void queryClient.invalidateQueries({ queryKey: ["employee-detail"] });
          return true;
        }
      } catch (e) {
        const err = e as EmployeeApiError;
        setApiError({ message: err.message });
        applyApiFieldErrors(setError, err.fieldErrors);
        toast.error(err.message);
        return false;
      }

      return true;
    },
    [employeeId, editEmployeeId, existingProfilePhotoUrl, initialData, getValues, setError, clearErrors, token, queryClient, setValue],
  );

  const onNext = async () => {
    setApiError(null);
    setSubmitting(true);
    try {
      const ok = await persistStep(stepIndex);
      if (!ok) {
        focusFirstError();
        return;
      }
      if (stepIndex < TOTAL_STEPS - 1) setStepIndex((s) => s + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const onBack = () => {
    setApiError(null);
    if (stepIndex > 0) setStepIndex((s) => s - 1);
  };

  const onSkipLeavePolicy = () => {
    setApiError(null);
    clearErrors();
    setValue("leave_policy_skipped", true);
    setValue("leave_policy_id", undefined);
    setValue("effective_from", "");
    setValue("leave_policy_label", "");
    if (stepIndex < TOTAL_STEPS - 1) setStepIndex((s) => s + 1);
    toast.success("Leave policy assignment skipped.");
  };

  const onActivate = async () => {
    if (!token || employeeId == null) return;
    setSubmitting(true);
    setApiError(null);
    try {
      const values = getValues();
      const res = await activateEmployee(token, employeeId, {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone || null,
        branch_id: values.branch_id,
        joining_date: values.joining_date,
        status: "active",
      });
      toast.success(res.message || "Employee updated.");
      router.push("/employee-list");
    } catch (e) {
      const err = e as EmployeeApiError;
      setApiError({ message: err.message });
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const retryLast = () => {
    void onNext();
  };

  const handleKeyboardShortcuts = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const root = rootRef.current;
    if (!root) return;

    if (event.altKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      if (!submitting && !isSummary && canProceedToNext) void onNext();
      return;
    }
    if (event.altKey && event.key.toLowerCase() === "b") {
      event.preventDefault();
      if (!submitting && stepIndex > 0) onBack();
      return;
    }
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      if (isSummary) {
        void onActivate();
      } else if (canProceedToNext) {
        void onNext();
      }
      return;
    }

    if (event.key === "Escape") {
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }

    if (
      event.key === "Enter" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      target.tagName !== "TEXTAREA" &&
      target instanceof HTMLInputElement
    ) {
      event.preventDefault();
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
        ),
      ).filter((el) => el.offsetParent !== null);
      const idx = focusables.indexOf(target);
      if (idx >= 0 && idx < focusables.length - 1) {
        focusables[idx + 1]?.focus();
      }
    }
  };

  const isSummary = stepIndex === TOTAL_STEPS - 1;

  if (isLoading && !employeeId) {
    return (
      <section className="space-y-4">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </section>
    );
  }

  return (
    <FormProvider {...methods}>
      <div
        className="w-full max-w-none space-y-6 px-2 lg:px-4"
        onKeyDown={handleKeyboardShortcuts}
        ref={rootRef}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {editEmployeeId ? "Edit employee" : "Add employee"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {editEmployeeId
                ? "Update the employee record sections by navigating the wizard steps."
                : "Complete each section — your progress is saved step by step."}
            </p>
          </div>
          <Link className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")} href="/employee-list">
            Cancel
          </Link>
        </div>

        <WizardProgress
          currentIndex={stepIndex}
          labels={STEP_LABELS}
          total={TOTAL_STEPS}
          allowJumping={Boolean(editEmployeeId)}
          onStepClick={(i) => setStepIndex(i)}
        />

        {apiError ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>{apiError.message}</span>
            </div>
            {!isSummary ? (
              <Button onClick={retryLast} size="sm" type="button" variant="outline">
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{STEP_LABELS[stepIndex]}</CardTitle>
            <CardDescription>
              {isSummary
                ? "Review everything below, then activate the employee record."
                : "Fill in the fields below. Required items are marked."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isSummary ? (
              <SummaryView
                companies={companies}
                branches={branches}
                departments={departments}
                designations={designations}
              />
            ) : (
              <StepFields
                branches={branches}
                companies={companies}
                departments={departments}
                designations={designations}
                excludeEmployeeId={employeeId ?? editEmployeeId ?? null}
                geolocations={geolocations}
                loadingDeps={loadingDeps}
                shifts={shifts}
                stepIndex={stepIndex}
                token={token}
                uploadedDocs={documentsQuery.data?.data ?? []}
                onDeleteDoc={handleDeleteDocument}
                deletingDocId={deletingDocId}
                existingProfilePhotoUrl={existingProfilePhotoUrl}
                onExistingProfilePhotoUpdated={setExistingProfilePhotoUrl}
              />
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Button
                className="w-full sm:w-auto"
                disabled={stepIndex === 0 || submitting}
                onClick={onBack}
                type="button"
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {stepIndex === 6 && !isSummary ? (
                  <Button
                    className="w-full sm:w-auto"
                    disabled={submitting}
                    onClick={onSkipLeavePolicy}
                    type="button"
                    variant="ghost"
                  >
                    Skip
                  </Button>
                ) : null}
                {isSummary ? (
                  <Button className="w-full sm:w-auto" disabled={submitting || employeeId == null} onClick={onActivate} type="button">
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Submit &amp; activate employee
                  </Button>
                ) : (
                  <Button
                    className="w-full sm:w-auto"
                    disabled={submitting || !canProceedToNext}
                    onClick={() => void onNext()}
                    type="button"
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    {stepIndex === TOTAL_STEPS - 2 ? "Review" : "Next"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </FormProvider>
  );
}

