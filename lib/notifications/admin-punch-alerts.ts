import {
  getAdminAttendance,
  type AdminAttendanceRecord,
} from "@/lib/api/attendance";
import { getEmployees, type EmployeeRecord } from "@/lib/api/employee";
import { getEmployeeProfilePhotoProxyUrl } from "@/lib/api/employees/http";

import { NOTIFICATION_SESSION } from "./constants";
import { deliverNotification, formatLocalDate } from "./app-notifications";
import {
  isAdminPunchAlertEnabled,
  readAdminSeenEventKeys,
  writeAdminSeenEventKeys,
} from "./preferences";

type PunchEvent = {
  key: string;
  type: "punch_in" | "punch_out";
  employeeId: number;
  time: string;
};

type EmployeeAlertMeta = {
  name: string;
  icon: string | null;
};

function punchEventKey(
  recordId: number,
  type: "punch_in" | "punch_out",
  time: string,
): string {
  return `${recordId}-${type}-${time}`;
}

function extractPunchEvents(records: AdminAttendanceRecord[]): PunchEvent[] {
  const events: PunchEvent[] = [];
  for (const record of records) {
    if (record.punch_in_time) {
      events.push({
        key: punchEventKey(record.id, "punch_in", record.punch_in_time),
        type: "punch_in",
        employeeId: record.employee_id,
        time: record.punch_in_time,
      });
    }
    if (record.punch_out_time) {
      events.push({
        key: punchEventKey(record.id, "punch_out", record.punch_out_time),
        type: "punch_out",
        employeeId: record.employee_id,
        time: record.punch_out_time,
      });
    }
  }
  return events;
}

function empDisplayName(emp: EmployeeRecord | undefined, employeeId: number): string {
  if (!emp) return `Employee #${employeeId}`;
  const name =
    emp.full_name ||
    emp.name ||
    [emp.first_name, emp.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (emp.employee_code) return emp.employee_code;
  return `Employee #${employeeId}`;
}

function formatPunchTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function profileIconForEmployee(emp: EmployeeRecord | undefined, employeeId: number): string | null {
  if (typeof window === "undefined") return null;
  if (emp?.profile_photo || emp?.photo_url || emp?.photo) {
    return `${window.location.origin}${getEmployeeProfilePhotoProxyUrl(employeeId)}`;
  }
  // Still try proxy — returns 404 gracefully if no photo.
  return `${window.location.origin}${getEmployeeProfilePhotoProxyUrl(employeeId)}`;
}

let employeeMetaCache: Map<number, EmployeeAlertMeta> | null = null;
let employeeCacheToken: string | null = null;

async function resolveEmployeeMeta(
  token: string,
  employeeIds: number[],
): Promise<Map<number, EmployeeAlertMeta>> {
  const uniqueIds = new Set(employeeIds);
  if (employeeMetaCache && employeeCacheToken === token) {
    return employeeMetaCache;
  }

  const map = new Map<number, EmployeeAlertMeta>();
  try {
    const res = await getEmployees(token, { per_page: 500, page: 1 });
    const items = res?.data?.items ?? [];

    for (const emp of items) {
      if (typeof emp.id === "number") {
        map.set(emp.id, {
          name: empDisplayName(emp, emp.id),
          icon: profileIconForEmployee(emp, emp.id),
        });
      }
    }
  } catch (error) {
    console.warn("Failed to load employee directory for punch notifications", error);
  }

  for (const id of uniqueIds) {
    if (!map.has(id)) {
      map.set(id, {
        name: `Employee #${id}`,
        icon: profileIconForEmployee(undefined, id),
      });
    }
  }

  employeeMetaCache = map;
  employeeCacheToken = token;
  return map;
}

async function fetchTodayAdminAttendance(
  token: string,
): Promise<AdminAttendanceRecord[]> {
  const today = formatLocalDate();
  const all: AdminAttendanceRecord[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const res = await getAdminAttendance(token, {
      from_date: today,
      to_date: today,
      per_page: 100,
      page,
    });
    all.push(...(res?.data?.records ?? []));
    lastPage = res.meta?.pagination?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage && page <= 20);

  return all;
}

function isBaselineSeeded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(NOTIFICATION_SESSION.ADMIN_BASELINE_SEEDED) === "1";
  } catch {
    return false;
  }
}

function markBaselineSeeded(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(NOTIFICATION_SESSION.ADMIN_BASELINE_SEEDED, "1");
  } catch {}
}

/**
 * Poll today's admin attendance and notify admins when new punch in/out events appear.
 */
export async function checkSuperAdminPunchAlerts(token: string): Promise<void> {
  if (!isAdminPunchAlertEnabled()) return;

  try {
    const records = await fetchTodayAdminAttendance(token);
    const events = extractPunchEvents(records);
    const seen = readAdminSeenEventKeys();

    if (!isBaselineSeeded()) {
      for (const event of events) seen.add(event.key);
      writeAdminSeenEventKeys(seen);
      markBaselineSeeded();
      return;
    }

    const newEvents = events
      .filter((event) => !seen.has(event.key))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    if (newEvents.length === 0) return;

    const meta = await resolveEmployeeMeta(
      token,
      newEvents.map((e) => e.employeeId),
    );

    for (const event of newEvents) {
      const info = meta.get(event.employeeId) ?? {
        name: `Employee #${event.employeeId}`,
        icon: null,
      };
      const at = formatPunchTime(event.time);
      const isIn = event.type === "punch_in";
      const eventName = isIn ? "Punch In" : "Punch Out";

      await deliverNotification({
        title: `${info.name} — ${eventName}`,
        body: `${info.name} punched ${isIn ? "in" : "out"} at ${at}.`,
        tag: event.key,
        href: "/live-attendance",
        kind: isIn ? "admin_punch_in" : "admin_punch_out",
        icon: info.icon,
        image: info.icon,
      });

      seen.add(event.key);
    }

    writeAdminSeenEventKeys(seen);
  } catch (error) {
    console.warn("Failed to poll admin attendance for punch notifications", error);
  }
}

export function resetSuperAdminPunchBaseline(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(NOTIFICATION_SESSION.ADMIN_BASELINE_SEEDED);
  } catch {}
  employeeMetaCache = null;
  employeeCacheToken = null;
}
