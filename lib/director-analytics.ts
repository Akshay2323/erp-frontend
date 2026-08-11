import type { AdminAttendanceRecord } from "@/lib/api/attendance";
import type { EmployeeRecord } from "@/lib/api/employees/types";

import { countAttendanceStatuses, type AttendanceBreakdown } from "@/lib/hr-dashboard-utils";

export type AiInsightSeverity = "success" | "warning" | "info" | "critical";

export type AiInsight = {
  id: string;
  severity: AiInsightSeverity;
  title: string;
  message: string;
  metric?: string;
  actionLabel?: string;
  actionHref?: string;
};

export type DailyTrendPoint = {
  date: string;
  label: string;
  present: number;
  absent: number;
  onLeave: number;
  total: number;
  presentRate: number;
};

export type DepartmentHealthRow = {
  departmentId: number;
  name: string;
  headcount: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  presentRate: number;
  score: number;
};

export function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export function shortDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function groupAttendanceByDate(records: AdminAttendanceRecord[]): Map<string, AdminAttendanceRecord[]> {
  const map = new Map<string, AdminAttendanceRecord[]>();
  for (const record of records) {
    const key = record.attendance_date?.slice(0, 10) ?? "";
    if (!key) continue;
    const bucket = map.get(key) ?? [];
    bucket.push(record);
    map.set(key, bucket);
  }
  return map;
}

export function buildSevenDayTrend(
  records: AdminAttendanceRecord[],
  activeEmployees: number,
): DailyTrendPoint[] {
  const grouped = groupAttendanceByDate(records);
  const points: DailyTrendPoint[] = [];

  for (let i = 6; i >= 0; i -= 1) {
    const date = isoDateDaysAgo(i);
    const dayRecords = grouped.get(date) ?? [];
    const breakdown = countAttendanceStatuses(dayRecords);
    const denominator = Math.max(activeEmployees, breakdown.total, 1);
    const presentRate = Math.round((breakdown.present / denominator) * 100);
    points.push({
      date,
      label: shortDayLabel(date),
      present: breakdown.present,
      absent: breakdown.absent,
      onLeave: breakdown.onLeave,
      total: breakdown.total,
      presentRate: Math.min(100, presentRate),
    });
  }

  return points;
}

export function buildDepartmentHealth(
  employees: EmployeeRecord[],
  todayRecords: AdminAttendanceRecord[],
): DepartmentHealthRow[] {
  const byDept = new Map<number, { name: string; employeeIds: number[] }>();

  for (const emp of employees) {
    const deptId = emp.department_id ?? emp.department?.id;
    if (!deptId) continue;
    const existing = byDept.get(deptId) ?? {
      name: emp.department?.name ?? `Department #${deptId}`,
      employeeIds: [],
    };
    existing.employeeIds.push(emp.id);
    byDept.set(deptId, existing);
  }

  const presentIds = new Set<number>();
  const absentIds = new Set<number>();
  const leaveIds = new Set<number>();

  for (const record of todayRecords) {
    const status = (record.status ?? "").toLowerCase();
    if (status.includes("leave")) leaveIds.add(record.employee_id);
    else if (status.includes("absent")) absentIds.add(record.employee_id);
    else if (status.includes("present") || status.includes("late") || status.includes("half")) {
      presentIds.add(record.employee_id);
    }
  }

  const rows: DepartmentHealthRow[] = [];

  for (const [departmentId, dept] of byDept.entries()) {
    const headcount = dept.employeeIds.length;
    let presentToday = 0;
    let absentToday = 0;
    let onLeaveToday = 0;

    for (const id of dept.employeeIds) {
      if (leaveIds.has(id)) onLeaveToday += 1;
      else if (absentIds.has(id)) absentToday += 1;
      else if (presentIds.has(id)) presentToday += 1;
    }

    const presentRate = headcount > 0 ? Math.round((presentToday / headcount) * 100) : 0;
    const score = Math.min(
      100,
      Math.round(presentRate * 0.7 + (headcount > 0 ? 30 : 0) - onLeaveToday * 2),
    );

    rows.push({
      departmentId,
      name: dept.name,
      headcount,
      presentToday,
      absentToday,
      onLeaveToday,
      presentRate,
      score: Math.max(0, score),
    });
  }

  return rows.sort((a, b) => a.presentRate - b.presentRate);
}

function presentRateFromBreakdown(breakdown: AttendanceBreakdown, activeEmployees: number): number {
  const denominator = Math.max(activeEmployees, breakdown.total, 1);
  return Math.round((breakdown.present / denominator) * 100);
}

export type DirectorAnalyticsInput = {
  activeEmployees: number;
  draftEmployees: number;
  todayBreakdown: AttendanceBreakdown;
  yesterdayBreakdown: AttendanceBreakdown;
  pendingLeaves: number;
  trend7d: DailyTrendPoint[];
  departmentHealth: DepartmentHealthRow[];
  payrollTotal?: number;
  payrollStaffCount?: number;
};

export function generateDirectorAnalytics(input: DirectorAnalyticsInput): {
  executiveSummary: string;
  insights: AiInsight[];
  healthScore: number;
} {
  const {
    activeEmployees,
    draftEmployees,
    todayBreakdown,
    yesterdayBreakdown,
    pendingLeaves,
    trend7d,
    departmentHealth,
    payrollTotal,
    payrollStaffCount,
  } = input;

  const todayRate = presentRateFromBreakdown(todayBreakdown, activeEmployees);
  const yesterdayRate = presentRateFromBreakdown(yesterdayBreakdown, activeEmployees);
  const rateDelta = todayRate - yesterdayRate;

  const avg7d =
    trend7d.length > 0
      ? Math.round(trend7d.reduce((sum, p) => sum + p.presentRate, 0) / trend7d.length)
      : todayRate;

  const weakestDept = departmentHealth[0];
  const strongestDept = departmentHealth[departmentHealth.length - 1];

  const healthScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        todayRate * 0.45 +
          avg7d * 0.25 +
          Math.max(0, 15 - pendingLeaves * 2) +
          Math.max(0, 10 - todayBreakdown.absent) +
          (draftEmployees === 0 ? 10 : 5),
      ),
    ),
  );

  const insights: AiInsight[] = [];

  if (rateDelta <= -5) {
    insights.push({
      id: "attendance-drop",
      severity: "warning",
      title: "Attendance dip detected",
      message: `Present rate fell to ${todayRate}% today (${rateDelta} pts vs yesterday). Review absentee patterns in Daily Attendance.`,
      metric: `${todayRate}%`,
      actionLabel: "View attendance",
      actionHref: "/attendance",
    });
  } else if (rateDelta >= 5) {
    insights.push({
      id: "attendance-rise",
      severity: "success",
      title: "Strong attendance recovery",
      message: `Present rate improved to ${todayRate}% (+${rateDelta} pts vs yesterday). Momentum is positive across the workforce.`,
      metric: `+${rateDelta} pts`,
    });
  } else {
    insights.push({
      id: "attendance-stable",
      severity: "info",
      title: "Attendance holding steady",
      message: `Today's present rate is ${todayRate}% with a 7-day average of ${avg7d}%. Workforce attendance is within normal range.`,
      metric: `${todayRate}%`,
      actionLabel: "Attendance report",
      actionHref: "/monthly-attendance",
    });
  }

  if (pendingLeaves >= 5) {
    insights.push({
      id: "leave-backlog",
      severity: "critical",
      title: "Leave approval backlog",
      message: `${pendingLeaves} leave requests are pending. Delays may affect shift planning and payroll accuracy.`,
      metric: String(pendingLeaves),
      actionLabel: "Approve leaves",
      actionHref: "/leave-approval",
    });
  } else if (pendingLeaves > 0) {
    insights.push({
      id: "leave-pending",
      severity: "warning",
      title: "Pending leave decisions",
      message: `${pendingLeaves} request${pendingLeaves === 1 ? "" : "s"} await approval. Clearing these keeps teams staffed predictably.`,
      metric: String(pendingLeaves),
      actionLabel: "Review queue",
      actionHref: "/leave-approval",
    });
  }

  if (weakestDept && weakestDept.presentRate < 75 && weakestDept.headcount >= 3) {
    insights.push({
      id: "dept-risk",
      severity: "warning",
      title: `${weakestDept.name} needs attention`,
      message: `${weakestDept.name} shows ${weakestDept.presentRate}% present rate (${weakestDept.absentToday} absent, ${weakestDept.onLeaveToday} on leave). Lowest among active departments.`,
      metric: `${weakestDept.presentRate}%`,
      actionLabel: "HOD dashboard",
      actionHref: "/hod-dashboard",
    });
  }

  if (strongestDept && strongestDept.presentRate >= 90 && strongestDept.departmentId !== weakestDept?.departmentId) {
    insights.push({
      id: "dept-star",
      severity: "success",
      title: `${strongestDept.name} performing well`,
      message: `${strongestDept.name} leads with ${strongestDept.presentRate}% attendance and stable coverage today.`,
      metric: `${strongestDept.presentRate}%`,
    });
  }

  if (draftEmployees > 0) {
    insights.push({
      id: "onboarding",
      severity: "info",
      title: "Onboarding in progress",
      message: `${draftEmployees} employee profile${draftEmployees === 1 ? "" : "s"} still in draft. Completing onboarding improves reporting accuracy.`,
      metric: String(draftEmployees),
      actionLabel: "Employee list",
      actionHref: "/employee-list?status=draft",
    });
  }

  if (payrollTotal && payrollTotal > 0) {
    insights.push({
      id: "payroll-exposure",
      severity: "info",
      title: "Monthly payroll exposure",
      message: `Estimated payroll obligation is ₹${payrollTotal.toLocaleString("en-IN")} for ${payrollStaffCount ?? "active"} staff this period. Monitor variance before finalizing runs.`,
      metric: `₹${Math.round(payrollTotal / 100000)}L+`,
      actionLabel: "Payroll summary",
      actionHref: "/payroll-summary",
    });
  }

  if (todayBreakdown.late >= 3) {
    insights.push({
      id: "late-pattern",
      severity: "warning",
      title: "Late arrival pattern",
      message: `${todayBreakdown.late} late punch-ins today. Repeated lateness may signal shift timing or commute issues.`,
      metric: String(todayBreakdown.late),
      actionHref: "/shift-rules",
      actionLabel: "Shift rules",
    });
  }

  const executiveSummary = [
    `Workforce health score is ${healthScore}/100 across ${activeEmployees} active employees.`,
    `Today's attendance is ${todayRate}% present (${todayBreakdown.absent} absent, ${todayBreakdown.onLeave} on leave).`,
    pendingLeaves > 0
      ? `${pendingLeaves} leave request${pendingLeaves === 1 ? "" : "s"} need executive visibility.`
      : "Leave pipeline is clear with no pending approvals.",
    weakestDept
      ? `${weakestDept.name} is the lowest-performing department at ${weakestDept.presentRate}% present.`
      : "Department coverage data is limited — link employees to departments for richer analytics.",
  ].join(" ");

  return { executiveSummary, insights: insights.slice(0, 6), healthScore };
}
