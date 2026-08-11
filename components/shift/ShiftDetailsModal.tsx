"use client";

import { X } from "lucide-react";

import type { Shift } from "@/lib/api/shift";
import { Button } from "../ui/button";

type ShiftDetailsModalProps = {
  open: boolean;
  shift: Shift | null;
  onClose: () => void;
};

const formatClock = (value: string | null) =>
  value && value.length >= 5 ? value.slice(0, 5) : "—";

export function ShiftDetailsModal({ open, shift, onClose }: ShiftDetailsModalProps) {
  if (!open || !shift) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-xl"
        role="dialog"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{shift.shift_name || shift.name}</h2>
            <p className="text-sm text-muted-foreground">{shift.shift_code}</p>
          </div>
          <Button aria-label="Close" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 p-6 text-sm">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Attendance mode</dt>
              <dd className="font-medium capitalize">{shift.attendance_mode}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{shift.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Default window</dt>
              <dd className="font-medium">
                {formatClock(shift.start_time)} – {formatClock(shift.end_time)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Grace / late / half-day (min)</dt>
              <dd className="font-medium">
                {shift.grace_minutes} / {shift.late_mark_minutes} / {shift.half_day_minutes}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-2 font-medium">Weekly schedule</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Day</th>
                    <th className="px-3 py-2 font-medium">Enabled</th>
                    <th className="px-3 py-2 font-medium">Start</th>
                    <th className="px-3 py-2 font-medium">End</th>
                  </tr>
                </thead>
                <tbody>
                  {shift.schedule.map((row) => (
                    <tr className="border-t border-border" key={row.day}>
                      <td className="px-3 py-2">{row.day}</td>
                      <td className="px-3 py-2">{row.enabled ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{formatClock(row.start_time)}</td>
                      <td className="px-3 py-2">{formatClock(row.end_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Rules (JSON)</h3>
            <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed">
              {JSON.stringify(
                {
                  late_rules: shift.late_rules,
                  half_day_rules: shift.half_day_rules,
                  overtime_rules: shift.overtime_rules,
                  week_off_rules: shift.week_off_rules,
                  geo_location_rules: shift.geo_location_rules,
                  auto_absent_rules: shift.auto_absent_rules,
                  working_hours_rules: shift.working_hours_rules,
                },
                null,
                2,
              )}
            </pre>
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose} type="button" variant="outline">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
