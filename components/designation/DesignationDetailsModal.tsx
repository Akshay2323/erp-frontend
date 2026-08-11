"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import type { Designation } from "@/lib/api/designation";
import { Button } from "../ui/button";

type DesignationDetailsModalProps = {
  open: boolean;
  designation: Designation | null;
  companyName: string;
  onClose: () => void;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function DesignationDetailsModal({
  open,
  designation,
  companyName,
  onClose,
}: DesignationDetailsModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !designation) return null;

  const items = [
    { label: "Designation Name", value: designation.name || "-" },
    { label: "Code", value: designation.code || "-" },
    { label: "Company", value: companyName },
    { label: "Status", value: designation.status || "-" },
    { label: "Created", value: formatDateTime(designation.created_at) },
    { label: "Updated", value: formatDateTime(designation.updated_at) },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        aria-modal="true"
        className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Designation Details</h2>
          <Button aria-label="Close details" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          {items.map((item) => (
            <div className="rounded-xl border border-border bg-background p-3" key={item.label}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm font-medium text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
