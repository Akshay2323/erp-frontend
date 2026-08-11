"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useRef } from "react";

import type { Holiday } from "@/lib/api/holiday";
import { Button } from "../ui/button";

type HolidayTableProps = {
  holidays: Holiday[];
  loading: boolean;
  onEdit: (holiday: Holiday) => void;
  onDelete: (holiday: Holiday) => void;
};

export function HolidayTable({ holidays, loading, onEdit, onDelete }: HolidayTableProps) {
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const rowsCount = holidays.length;
  const emptyText = loading ? "Loading holidays..." : "No holidays found.";

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
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Holiday Name</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holidays.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              holidays.map((holiday, index) => (
                <tr
                  className="border-t border-border focus-visible:bg-muted/30 focus-visible:outline-none"
                  key={holiday.id}
                  onKeyDown={(event) => onRowKeyDown(event, index)}
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3 font-medium">{holiday.name}</td>
                  <td className="px-4 py-3">{holiday.date}</td>
                  <td className="px-4 py-3">{holiday.type}</td>
                  <td className="px-4 py-3">{holiday.is_paid ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                      {holiday.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => onEdit(holiday)} size="sm" variant="outline">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button onClick={() => onDelete(holiday)} size="sm" variant="ghost">
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
