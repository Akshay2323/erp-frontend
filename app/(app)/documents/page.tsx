"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  Eye,
  FileText,
  X,
  Maximize2,
  Minimize2,
  Loader2,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  File,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useAccentTheme } from "@/components/accent-theme-provider";
import {
  getEmployeeDocuments,
  getDocumentPreview,
  getEmployees,
  resolveEmployeeSession,
  type EmployeeDocumentRecord,
  type EmployeeRecord,
} from "@/lib/api/employee";
import { getDocumentFileUrl } from "@/lib/api/employees/http";
import { buildEmployeeDocumentPreviewUrl } from "@/lib/api/employee-document-preview-url";
import {
  getMimeFromName,
  isImageMime,
  isPdfMime,
  isPreviewable,
  toPreviewBlob,
} from "@/lib/document-preview";
import { DocumentPreviewViewport } from "@/components/documents/DocumentPreviewViewport";
import { isAdminSession, readAuthUser, resolveRoleString } from "@/lib/auth-session";
import { useAuthToken } from "@/lib/use-auth-token";
import { cn } from "@/lib/utils";

/* ─── helpers ───────────────────────────────────────────────────── */

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
  return <File className="h-4 w-4 text-blue-500" />;
}

const documentActionBtnClass =
  "inline-flex items-center justify-center gap-2 py-3 px-4 min-h-[44px] h-auto text-xs font-semibold rounded-xl";

function employeeListItemsFromEnvelope(data: unknown): EmployeeRecord[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as EmployeeRecord[];
  if (typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.items)) return d.items as EmployeeRecord[];
  if (Array.isArray(d.data)) return d.data as EmployeeRecord[];
  if (Array.isArray(d.employees)) return d.employees as EmployeeRecord[];
  return [];
}

function employeeDisplayName(emp: EmployeeRecord): string {
  return (
    emp.full_name?.trim() ||
    emp.name?.trim() ||
    [emp.first_name, emp.last_name].filter(Boolean).join(" ").trim() ||
    emp.employee_code ||
    `Employee #${emp.id}`
  );
}

function DocumentActions({
  doc,
  busy,
  onPreview,
  onDownload,
  layout = "row",
}: {
  doc: EmployeeDocumentRecord;
  busy: boolean;
  onPreview: (doc: EmployeeDocumentRecord) => void;
  onDownload: (doc: EmployeeDocumentRecord) => void;
  layout?: "row" | "stack";
}) {
  const previewEnabled = isPreviewable(doc.document_name);

  if (layout === "stack") {
    return (
      <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-stretch">
        {previewEnabled ? (
          <Button
            disabled={busy}
            onClick={() => onPreview(doc)}
            variant="outline"
            className={cn(
              documentActionBtnClass,
              "flex-1 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10",
            )}
          >
            <Eye className="h-4 w-4 shrink-0" />
            Preview
          </Button>
        ) : null}
        <Button
          disabled={busy}
          onClick={() => onDownload(doc)}
          className={cn(
            documentActionBtnClass,
            "bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 text-white shadow-sm",
            previewEnabled ? "flex-1" : "w-full",
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Download className="h-4 w-4 shrink-0" />}
          Download
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
      {previewEnabled ? (
        <Button
          disabled={busy}
          onClick={() => onPreview(doc)}
          variant="outline"
          className={cn(
            documentActionBtnClass,
            "min-h-[40px] py-2.5 px-3.5 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 shadow-sm",
          )}
        >
          <Eye className="h-3.5 w-3.5 shrink-0" />
          Preview
        </Button>
      ) : null}
      <Button
        disabled={busy}
        onClick={() => onDownload(doc)}
        className={cn(
          documentActionBtnClass,
          "min-h-[40px] py-2.5 px-3.5 bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 hover:from-slate-800 hover:to-slate-900 text-white shadow-sm transition-all",
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Download className="h-3.5 w-3.5 shrink-0" />}
        Download
      </Button>
    </div>
  );
}

/* ─── component ─────────────────────────────────────────────────── */

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const token = useAuthToken();
  const { theme } = useAccentTheme();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [selfEmployeeId, setSelfEmployeeId] = useState<number | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [documents, setDocuments] = useState<EmployeeDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDocId, setActionDocId] = useState<number | null>(null);

  const [userProfile, setUserProfile] = useState<{ name: string; email: string; role: string; code: string } | null>(null);

  const [previewDoc, setPreviewDoc] = useState<EmployeeDocumentRecord | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewMime, setPreviewMime] = useState("");
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  const fetchPreviewBlob = useCallback(
    async (doc: EmployeeDocumentRecord): Promise<Blob> => {
      if (!token || !employeeId) throw new Error("Authentication token not found.");
      return getDocumentPreview(token, employeeId, doc.id);
    },
    [token, employeeId],
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
      setPreviewDoc(doc);
      setPreviewLoading(true);
      setPreviewBlobUrl(null);
      setImageZoom(1);
      setImageRotation(0);
      setPreviewFullscreen(false);

      const guessedMime = getMimeFromName(doc.document_name);
      const usePdfProxy =
        isPdfMime(guessedMime, doc.document_name) && employeeId && doc.id > 0;

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
        const detectedMime = finalBlob.type || guessedMime;
        setPreviewMime(detectedMime);

        const url = URL.createObjectURL(finalBlob);
        setPreviewBlobUrl(url);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load document preview.");
        setPreviewDoc(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [employeeId, fetchPreviewBlob, fetchDocumentBlob],
  );

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
      employeeId &&
      previewDoc.id > 0 &&
      isPdfMime(previewMime, previewDoc.document_name)
    ) {
      window.open(
        buildEmployeeDocumentPreviewUrl(employeeId, previewDoc.id),
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (previewBlobUrl) {
      window.open(previewBlobUrl, "_blank", "noopener,noreferrer");
    }
  }, [previewBlobUrl, previewDoc, employeeId, previewMime]);

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
      } catch (error: any) {
        toast.error(error?.message || "Failed to download document.");
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
    async function resolveEmployeeId() {
      setSessionReady(false);

      const queryEmployeeId = Number(searchParams.get("employeeId"));

      if (!token) {
        setEmployeeId(null);
        setSelfEmployeeId(null);
        setIsAdminUser(false);
        setSessionReady(true);
        return;
      }

      try {
        const parsedUser = readAuthUser();
        const admin = isAdminSession(parsedUser);
        setIsAdminUser(admin);

        if (parsedUser) {
          setUserProfile({
            name: parsedUser.name || "User",
            email: parsedUser.email || "",
            role: resolveRoleString(parsedUser) || "Employee",
            code: parsedUser.employee_code || "",
          });
        }

        const resolved = await resolveEmployeeSession(token, parsedUser);
        const resolvedId = resolved?.employeeId ?? null;
        setSelfEmployeeId(resolvedId);

        if (admin) {
          if (Number.isFinite(queryEmployeeId) && queryEmployeeId > 0) {
            setEmployeeId(queryEmployeeId);
          } else {
            setEmployeeId(null);
          }
        } else {
          setEmployeeId(resolvedId);
        }
      } catch {
        setEmployeeId(null);
        setSelfEmployeeId(null);
        setIsAdminUser(false);
      } finally {
        setSessionReady(true);
      }
    }

    void resolveEmployeeId();
  }, [searchParams, token]);

  useEffect(() => {
    if (!isAdminUser || !token || !sessionReady) return;

    let cancelled = false;

    const loadEmployees = async () => {
      setEmployeesLoading(true);
      try {
        const all: EmployeeRecord[] = [];
        let page = 1;
        let lastPage = 1;
        do {
          const res = await getEmployees(token, {
            page,
            per_page: 100,
            status: "active",
          });
          if (cancelled) return;
          all.push(...employeeListItemsFromEnvelope(res.data));
          lastPage = res.meta?.last_page ?? 1;
          page += 1;
        } while (page <= lastPage && page < 50);

        all.sort((a, b) =>
          employeeDisplayName(a).localeCompare(employeeDisplayName(b), undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        );
        setEmployees(all);
      } catch {
        if (!cancelled) {
          toast.error("Failed to load employees.");
          setEmployees([]);
        }
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    };

    void loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [isAdminUser, token, sessionReady]);

  useEffect(() => {
    async function loadDocuments() {
      if (!token) {
        setLoading(false);
        return;
      }

      if (!employeeId) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await getEmployeeDocuments(token, employeeId);
        setDocuments(Array.isArray(res.data) ? res.data : []);
      } catch (error: any) {
        const message = String(error?.message || "");
        const isForbidden =
          message.toLowerCase().includes("not allowed") ||
          message.toLowerCase().includes("forbidden");
        if (isForbidden && !isAdminUser && selfEmployeeId && selfEmployeeId !== employeeId) {
          try {
            const fallbackRes = await getEmployeeDocuments(token, selfEmployeeId);
            setDocuments(Array.isArray(fallbackRes.data) ? fallbackRes.data : []);
            setEmployeeId(selfEmployeeId);
            toast.info("Showing your own documents due to access restrictions.");
            return;
          } catch {
            // fall through to generic error below
          }
        }
        toast.error(error?.message || "Failed to load documents.");
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    }

    loadDocuments();
  }, [employeeId, selfEmployeeId, token, isAdminUser]);

  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const sortedDocuments = useMemo(
    () =>
      [...documents].sort((a, b) => {
        const aTime = new Date(a.uploaded_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.uploaded_at ?? b.created_at ?? 0).getTime();
        return bTime - aTime;
      }),
    [documents],
  );

  const isPdf = isPdfMime(previewMime, previewDoc?.document_name);
  const isImage = isImageMime(previewMime);
  const pdfPreviewUrl =
    previewDoc && employeeId && isPdf
      ? buildEmployeeDocumentPreviewUrl(employeeId, previewDoc.id)
      : null;

  return (
    <>
      <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6 px-3 sm:px-4 py-2 sm:py-4">
        <div className={`relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r ${theme.banner} p-4 sm:p-5 md:p-6 shadow-lg transition-all duration-500`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-60" />
          <div className="absolute inset-0 bg-grid-white/[0.03] -z-10" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-5">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="relative group shrink-0">
                <div className={`absolute -inset-1 rounded-full bg-gradient-to-r ${theme.banner} opacity-70 blur-sm transition-all duration-300 group-hover:opacity-100`} />
                <div className={`relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-card overflow-hidden border-2 border-white shadow-xl ring-2 ${theme.avatarRing} transition-all duration-300`}>
                  <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${theme.banner} text-white text-xl font-extrabold`}>
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white/90" />
                  </div>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white">Digital Documents</h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Secure
                  </span>
                </div>
                {userProfile ? (
                  <p className="text-white/80 text-xs font-medium flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                    <span className="capitalize font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-sm w-fit">{userProfile.role}</span>
                    <span className="hidden sm:inline text-white/30">•</span>
                    <span className="truncate">{userProfile.name}</span>
                    {userProfile.code ? (
                      <>
                        <span className="hidden sm:inline text-white/30">•</span>
                        <span className="font-mono text-white/95">{userProfile.code}</span>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-white/80 text-xs font-medium leading-relaxed">
                    {isAdminUser
                      ? "Select an employee to view, preview, and download their personnel documents."
                      : "View, preview, and securely download your uploaded personnel documents."}
                  </p>
                )}
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 w-full sm:w-auto justify-between sm:justify-start rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-2.5 sm:bg-transparent sm:border-0 sm:p-0 sm:rounded-none">
              <span className="text-2xl sm:text-4xl font-extrabold text-white/90">{sortedDocuments.length}</span>
              <span className="text-[10px] sm:text-xs font-medium text-white/60 tracking-wider uppercase">Total Files</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-border/60 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${theme.accentBg} ${theme.accentText}`}>
                <FileText className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-foreground">File Repository</h2>
            </div>

            <div className="flex items-center gap-2 text-[11px] sm:text-xs font-medium text-muted-foreground bg-card border border-border/60 rounded-full px-3 py-1.5 shadow-sm w-fit">
              <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-blue-500" /> Preview</span>
              <div className="w-px h-3 bg-border" />
              <span className="flex items-center gap-1.5"><Download className="h-3.5 w-3.5 text-slate-500" /> Download</span>
            </div>
          </div>

          {isAdminUser ? (
            <div className="px-4 sm:px-5 py-4 border-b border-border/40 bg-muted/10">
              <label
                htmlFor="documents-employee-select"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Select Employee
              </label>
              <NativeSelect
                id="documents-employee-select"
                className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={employeeId ?? ""}
                disabled={employeesLoading}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  setEmployeeId(Number.isFinite(nextId) && nextId > 0 ? nextId : null);
                }}
              >
                <option value="">
                  {employeesLoading ? "Loading employees..." : "Choose an employee"}
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {employeeDisplayName(emp)}
                    {emp.employee_code ? ` (${emp.employee_code})` : ""}
                  </option>
                ))}
              </NativeSelect>
              {selectedEmployee ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing documents for{" "}
                  <span className="font-semibold text-foreground">
                    {employeeDisplayName(selectedEmployee)}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {!token ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Authentication token not found.</p>
            </div>
          ) : !sessionReady ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Loading session...
            </div>
          ) : !employeeId ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {isAdminUser
                  ? "Select an employee above to view their document records."
                  : "Could not resolve your employee profile. Please ensure your account is linked to an employee record."}
              </p>
            </div>
          ) : loading ? (
            <>
              <div className="lg:hidden p-3 sm:p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="h-28 animate-pulse rounded-xl bg-muted" key={index} />
                ))}
              </div>
              <div className="hidden lg:block p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="h-14 animate-pulse rounded-xl bg-muted" key={index} />
                ))}
              </div>
            </>
          ) : sortedDocuments.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${theme.accentBg} mb-4`}>
                 <FileText className={`h-8 w-8 ${theme.accentText}`} />
              </div>
              <p className="text-base font-bold text-foreground mb-1">No Documents Uploaded</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">There are currently no digital documents associated with this personnel record in the system.</p>
            </div>
          ) : (
            <>
              {/* Mobile / tablet card list */}
              <div className="lg:hidden divide-y divide-border/40">
                {sortedDocuments.map((doc, index) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="p-4 sm:p-5 space-y-3.5 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/50 border border-border/60 shadow-sm">
                        {getFileIcon(doc.document_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-foreground leading-snug break-words">
                          {doc.document_name || "Unnamed Document"}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1 text-[11px] font-semibold text-foreground border border-border/50">
                            {doc.document_type || "Unknown"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wide">
                            DOC-{doc.id}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground font-medium">
                          {formatDate(doc.uploaded_at ?? doc.created_at)}
                        </p>
                      </div>
                    </div>
                    <DocumentActions
                      busy={actionDocId === doc.id}
                      doc={doc}
                      layout="stack"
                      onDownload={downloadDocument}
                      onPreview={openPreview}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block overflow-auto max-h-[600px]">
              <table className="w-full min-w-[820px] text-sm text-left">
                <thead className="sticky top-0 bg-card z-10 shadow-sm border-b border-border/80">
                  <tr>
                    <th className="px-5 py-4 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="px-5 py-4 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Document Name</th>
                    <th className="px-5 py-4 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Uploaded Date</th>
                    <th className="px-5 py-4 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sortedDocuments.map((doc) => (
                    <motion.tr
                      key={doc.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`group transition-all duration-200 hover:bg-muted/30 cursor-default`}
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground border border-border/50">
                          {getFileIcon(doc.document_name)}
                          {doc.document_type || "Unknown"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                           <span className="font-bold text-foreground text-sm truncate max-w-[320px] group-hover:text-primary transition-colors">
                             {doc.document_name || "Unnamed Document"}
                           </span>
                           <span className="text-[10px] text-muted-foreground font-mono mt-0.5 uppercase tracking-wide">ID: DOC-{doc.id}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground font-medium bg-muted/20 px-2 py-1 rounded border border-border/30">
                          {formatDate(doc.uploaded_at ?? doc.created_at)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <DocumentActions
                          busy={actionDocId === doc.id}
                          doc={doc}
                          onDownload={downloadDocument}
                          onPreview={openPreview}
                        />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closePreview();
            }}
          >
            <motion.div
              ref={previewContainerRef}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`relative flex flex-col bg-card border border-border shadow-2xl overflow-hidden transition-all duration-300 ${previewFullscreen
                ? "w-full h-full rounded-none"
                : "w-full h-[92dvh] sm:h-[85vh] max-w-5xl rounded-t-2xl sm:rounded-2xl"
                }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3.5 border-b border-border bg-muted/30 shrink-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-background border border-border rounded-lg shadow-sm shrink-0">
                     {getFileIcon(previewDoc.document_name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">
                      {previewDoc.document_name || "Document Preview"}
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-medium truncate flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded ${theme.badgeAccent}`}>{previewDoc.document_type}</span>
                      <span className="hidden sm:inline">• Uploaded {formatDate(previewDoc.uploaded_at ?? previewDoc.created_at)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto overflow-x-auto max-w-full bg-background border border-border/60 rounded-xl p-1 shadow-sm">
                  {isImage && previewBlobUrl && (
                    <>
                      <button
                        onClick={() => setImageZoom((z) => Math.max(0.25, z - 0.25))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Zoom Out"
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
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setImageRotation((r) => (r + 90) % 360)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Rotate"
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
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => previewDoc && downloadDocument(previewDoc)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-blue-500 hover:bg-blue-500/10 hover:text-blue-600 transition-colors"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewFullscreen((f) => !f)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title={previewFullscreen ? "Exit Fullscreen" : "Fullscreen"}
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
                  onDownload={() => downloadDocument(previewDoc)}
                  onOpenInNewTab={openInNewTab}
                />
              </div>

              <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-t border-border bg-muted/20 text-[10px] text-muted-foreground shrink-0">
                <span className="font-mono bg-background px-2 py-0.5 rounded border border-border/50 font-semibold truncate max-w-[45%]">{previewMime || "unknown"}</span>
                <span className="hidden sm:flex items-center gap-1.5">Press <kbd className="px-1.5 py-0.5 bg-background rounded shadow-sm font-bold font-mono border border-border/60">Esc</kbd> to close <span className="opacity-50">•</span> <kbd className="px-1.5 py-0.5 bg-background rounded shadow-sm font-bold font-mono border border-border/60">F</kbd> for fullscreen</span>
                <button
                  type="button"
                  onClick={closePreview}
                  className="sm:hidden text-xs font-semibold text-primary"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
