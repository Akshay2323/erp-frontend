"use client";

import { Download, UploadCloud } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import type { Company } from "@/lib/api/company";
import type { HolidayApiError, HolidayBulkResponse, HolidayStatus } from "@/lib/api/holiday";
import { Button } from "../ui/button";

type BulkUploadSectionProps = {
  loading: boolean;
  companies: Company[];
  onSubmit: (
    file: File,
    isPaid: boolean,
    status: HolidayStatus,
    companyId: number | "all",
  ) => Promise<HolidayBulkResponse>;
};

const sampleCsv = `Holiday Name,Date,Type
New Year,01-01-2027,National
Company Day,15-03-2027,Company`;

export function BulkUploadSection({ loading, companies, onSubmit }: BulkUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  const [status, setStatus] = useState<HolidayStatus>("active");
  const [companyId, setCompanyId] = useState<number | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HolidayBulkResponse["data"] | null>(null);

  const canSubmit = useMemo(() => Boolean(file) && !loading, [file, loading]);

  const validateAndSetFile = (selected: File | null) => {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setError("Only CSV files are allowed.");
      return;
    }
    setError(null);
    setFile(selected);
  };

  const downloadSampleFile = () => {
    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "holiday_upload_sample.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file.");
      return;
    }
    setError(null);
    setResult(null);
    try {
      const response = await onSubmit(file, isPaid, status, companyId);
      setResult(response.data);
    } catch (err) {
      const apiError = err as HolidayApiError;
      setError(apiError.message || "Upload failed.");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm" suppressHydrationWarning>
      <h2 className="text-lg font-semibold">Bulk Upload (CSV)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a CSV file to import multiple holidays.
      </p>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadSampleFile} type="button" variant="outline">
            <Download className="h-4 w-4" />
            Download Sample CSV
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} type="button" variant="outline">
            <UploadCloud className="h-4 w-4" />
            Choose File
          </Button>
        </div>

        <input
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => validateAndSetFile(event.target.files?.[0] ?? null)}
          ref={fileInputRef}
          type="file"
        />

        <div
          className={`rounded-xl border border-dashed p-6 text-center text-sm transition ${
            dragActive
              ? "border-primary bg-primary/5 text-primary"
              : "border-border bg-background text-muted-foreground"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const droppedFile = event.dataTransfer.files?.[0] ?? null;
            validateAndSetFile(droppedFile);
          }}
        >
          <p className="font-medium">Drag and drop CSV file here</p>
          <p className="mt-1 text-xs">or click "Choose File" to browse</p>
          {file ? (
            <p className="mt-3 text-sm text-foreground">
              Selected file: <span className="font-medium">{file.name}</span>
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Company</label>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              onChange={(event) => {
                const v = event.target.value;
                setCompanyId(v === "all" ? "all" : Number(v));
              }}
              value={companyId}
              disabled={loading}
            >
              <option value="all">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input checked={isPaid} onChange={(event) => setIsPaid(event.target.checked)} type="checkbox" />
            Is Paid
          </label>
          <select
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            onChange={(event) => setStatus(event.target.value as HolidayStatus)}
            value={status}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <Button disabled={!canSubmit} onClick={handleUpload} type="button">
          {loading ? "Uploading..." : "Upload CSV"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-border bg-background p-3 text-sm">
          <p className="font-medium">Imported: {result.imported_count}</p>
          {result.row_errors.length ? (
            <ul className="mt-2 list-disc pl-5 text-destructive">
              {result.row_errors.map((rowError, idx) => (
                <li key={idx}>
                  {typeof rowError === "string"
                    ? rowError
                    : `Row ${rowError.row}: ${rowError.message}`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-emerald-600">No row errors.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
