"use client";

import { Eye, Trash2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo, useRef } from "react";

import type { Shift } from "@/lib/api/shift";
import { Button } from "../ui/button";

type ShiftTableProps = {
  shifts: Shift[];
  loading: boolean;
  onDelete: (shift: Shift) => void;
  onView: (shift: Shift) => void;
  onEditRules: (shift: Shift) => void;
};

const formatClock = (value: string) =>
  value.length >= 5 ? value.slice(0, 5) : value;
const safeClock = (value: string | null | undefined) =>
  value ? formatClock(value) : "—";

export function ShiftTable({
  shifts,
  loading,
  onDelete,
  onView,
  onEditRules,
}: ShiftTableProps) {
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const emptyText = useMemo(() => {
    if (loading) return "Loading shifts...";
    if (!shifts.length) return "No shifts found. Create your first shift.";
    return null;
  }, [loading, shifts.length]);

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      rowRefs.current[Math.min(index + 1, shifts.length - 1)]?.focus();
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
              <th className="px-4 py-3 font-medium">Shift Name</th>
              <th className="px-4 py-3 font-medium">Shift Code</th>
              <th className="px-4 py-3 font-medium">Start Time</th>
              <th className="px-4 py-3 font-medium">End Time</th>
              <th className="px-4 py-3 font-medium">Grace Time (min)</th>
              <th className="px-4 py-3 font-medium">Half Day Rule</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {emptyText ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              shifts.map((shift, index) => (
                <tr
                  className="border-t border-border focus-visible:bg-muted/30 focus-visible:outline-none"
                  key={shift.id}
                  onKeyDown={(event) => onRowKeyDown(event, index)}
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3 font-medium">{shift.shift_name || shift.name}</td>
                  <td className="px-4 py-3">{shift.shift_code}</td>
                  <td className="px-4 py-3">
                    {safeClock(
                      shift.start_time ??
                        shift.schedule.find((row) => row.enabled)?.start_time ??
                        null,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {safeClock(
                      shift.end_time ?? shift.schedule.find((row) => row.enabled)?.end_time ?? null,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {typeof shift.late_rules?.grace_minutes === "number"
                      ? shift.late_rules.grace_minutes
                      : 0}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {typeof shift.half_day_rules?.half_day_after_hours === "number"
                      ? `After ${shift.half_day_rules.half_day_after_hours} hrs`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                      {shift.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => onEditRules(shift)} size="sm" variant="outline">
                        Edit Rules
                      </Button>
                      <Button onClick={() => onView(shift)} size="sm" variant="ghost">
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        onClick={() => onDelete(shift)}
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
