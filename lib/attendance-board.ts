import type { DayAttendanceEmployee, DayAttendanceStatusFilter } from "@/lib/api/day-attendance";

export type AttendanceBoardSection = "live" | "daily";
export type LivePunchView = "all" | "in" | "out" | "not_in";
export type DailyStatusView = "all" | DayAttendanceStatusFilter;

export function localIsoDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(y, (m ?? 1) - 1, d ?? 1);
  next.setDate(next.getDate() + days);
  return localIsoDate(next);
}

export function formatBoardDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Digits only for tel:/WhatsApp links. */
export function normalizePhoneDigits(mobile: string | null | undefined): string | null {
  if (!mobile?.trim()) return null;
  const digits = mobile.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export function telHref(mobile: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(mobile);
  if (!digits) return null;
  return `tel:+${digits}`;
}

/** WhatsApp chat URL. Assumes India (+91) when number is 10 digits. */
export function whatsappHref(mobile: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(mobile);
  if (!digits) return null;
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

export function isCurrentlyIn(row: DayAttendanceEmployee): boolean {
  return Boolean(row.attendance.is_currently_in);
}

export function hasPunchedOut(row: DayAttendanceEmployee): boolean {
  return Boolean(row.attendance.punch_in_time) && Boolean(row.attendance.punch_out_time);
}

export function hasNotPunchedIn(row: DayAttendanceEmployee): boolean {
  return !row.attendance.is_present && !row.attendance.punch_in_time;
}

export function livePunchStatusLabel(row: DayAttendanceEmployee): "IN" | "OUT" | "Not Punch-In" {
  if (isCurrentlyIn(row)) return "IN";
  if (hasPunchedOut(row)) return "OUT";
  return "Not Punch-In";
}

export function filterLivePunchView(
  employees: DayAttendanceEmployee[],
  view: LivePunchView,
): DayAttendanceEmployee[] {
  switch (view) {
    case "all":
      return employees;
    case "in":
      return employees.filter(isCurrentlyIn);
    case "out":
      return employees.filter(hasPunchedOut);
    case "not_in":
      return employees.filter(hasNotPunchedIn);
    default:
      return employees;
  }
}

export function attendanceBoardHref(opts: {
  section?: AttendanceBoardSection;
  view?: string;
  date?: string;
}): string {
  const params = new URLSearchParams();
  params.set("section", opts.section ?? "live");
  if (opts.view) params.set("view", opts.view);
  if (opts.date) params.set("date", opts.date);
  return `/attendance-board?${params.toString()}`;
}
