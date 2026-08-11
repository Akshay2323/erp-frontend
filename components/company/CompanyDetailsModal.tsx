"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import type { Company } from "@/lib/api/company";
import { Button } from "../ui/button";

type CompanyDetailsModalProps = {
  open: boolean;
  company: Company | null;
  onClose: () => void;
};

const detailItems = (company: Company) => [
  { label: "Company Name", value: company.company_name || "-" },
  { label: "Legal Name", value: company.legal_name || "-" },
  { label: "Email", value: company.email || "-" },
  { label: "Phone", value: company.phone || "-" },
  { label: "Address", value: company.address || "-" },
  { label: "Status", value: company.status || "-" },
  { label: "Subscription Start", value: company.subscription_start || "-" },
  { label: "Subscription End", value: company.subscription_end || "-" },
];

export function CompanyDetailsModal({ open, company, onClose }: CompanyDetailsModalProps) {
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

  if (!open || !company) return null;

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
          <h2 className="text-lg font-semibold">Company Details</h2>
          <Button aria-label="Close details" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          {detailItems(company).map((item) => (
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
