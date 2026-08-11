"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { useMemo, useRef } from "react";
import type { KeyboardEvent } from "react";

import type { Company } from "@/lib/api/company";
import { formatDisplayDate } from "@/lib/format-date";
import { Button } from "../ui/button";

type CompanyTableProps = {
  companies: Company[];
  loading: boolean;
  onDelete: (company: Company) => void;
  onEdit: (company: Company) => void;
  onView: (company: Company) => void;
};

export function CompanyTable({ companies, loading, onDelete, onEdit, onView }: CompanyTableProps) {
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const rowsCount = companies.length;

  const emptyMessage = useMemo(() => {
    if (loading) return "Loading companies...";
    if (!companies.length) return "No companies found. Add your first company.";
    return null;
  }, [loading, companies.length]);

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      rowRefs.current[Math.min(index + 1, rowsCount - 1)]?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      rowRefs.current[Math.max(index - 1, 0)]?.focus();
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Company Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Subscription Dates</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {emptyMessage ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              companies.map((company, index) => (
                <tr
                  className="border-t border-border focus-visible:bg-muted/30 focus-visible:outline-none"
                  key={company.id}
                  onKeyDown={(event) => onRowKeyDown(event, index)}
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3 font-medium">{company.company_name}</td>
                  <td className="px-4 py-3">{company.email ?? "-"}</td>
                  <td className="px-4 py-3">{company.phone ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                      {company.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {formatDisplayDate(company.subscription_start)} —{" "}
                    {formatDisplayDate(company.subscription_end)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => onEdit(company)}
                        size="sm"
                        variant="outline"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => onView(company)}
                        size="sm"
                        variant="ghost"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        onClick={() => onDelete(company)}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
