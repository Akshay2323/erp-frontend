import type { AdminAttendanceRecord } from "@/lib/api/attendance";

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

export type AttendanceBreakdown = {
  present: number;
  absent: number;
  onLeave: number;
  halfDay: number;
  late: number;
  other: number;
  total: number;
};

export function countAttendanceStatuses(records: AdminAttendanceRecord[]): AttendanceBreakdown {
  const breakdown: AttendanceBreakdown = {
    present: 0,
    absent: 0,
    onLeave: 0,
    halfDay: 0,
    late: 0,
    other: 0,
    total: records.length,
  };

  for (const record of records) {
    const status = (record.status ?? "").toLowerCase().replace(/\s+/g, "_");
    if (!status) {
      breakdown.other += 1;
      continue;
    }
    if (status.includes("half")) {
      breakdown.halfDay += 1;
    } else if (status.includes("leave") || status === "on_leave") {
      breakdown.onLeave += 1;
    } else if (status.includes("absent")) {
      breakdown.absent += 1;
    } else if (status.includes("late")) {
      breakdown.late += 1;
      breakdown.present += 1;
    } else if (status.includes("present") || status === "p") {
      breakdown.present += 1;
    } else {
      breakdown.other += 1;
    }
  }

  return breakdown;
}

export function attendanceStatusClass(status?: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("present") && !s.includes("late")) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (s.includes("late")) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }
  if (s.includes("absent")) {
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  }
  if (s.includes("leave")) {
    return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
  }
  if (s.includes("half")) {
    return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
  }
  return "bg-muted text-muted-foreground";
}

export function formatTimeShort(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return value;
}
