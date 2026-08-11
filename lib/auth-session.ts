export type AuthUser = {
  id?: number;
  name?: string;
  email?: string;
  role?: string | { name?: string; slug?: string };
  employee_id?: number;
  employee_code?: string;
  empcode?: string;
  employee?: { id?: number; employee_code?: string };
  company?: { id?: number; name?: string };
  tenant?: { id?: number; name?: string };
  is_admin?: boolean;
  is_super_admin?: boolean;
  accessible_companies?: unknown[];
  [key: string]: unknown;
};

function slugifyRole(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function readAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("auth_user");
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Normalize API / localStorage role (string, `{ name }`, or roles array) to a single label. */
export function resolveRoleString(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const u = user as Record<string, unknown>;

  if (typeof u.role === "string" && u.role.trim()) return u.role.trim();

  if (u.role && typeof u.role === "object" && u.role !== null) {
    const roleObj = u.role as { name?: string; slug?: string };
    if (typeof roleObj.name === "string" && roleObj.name.trim()) {
      return roleObj.name.trim();
    }
    if (typeof roleObj.slug === "string" && roleObj.slug.trim()) {
      return roleObj.slug.trim();
    }
  }

  return null;
}

function collectRoleHints(user: AuthUser | null): string[] {
  if (!user) return [];

  const hints = new Set<string>();
  const primary = resolveRoleString(user);
  if (primary) hints.add(slugifyRole(primary));

  const roles = user.roles;
  if (Array.isArray(roles)) {
    for (const role of roles) {
      if (typeof role === "string" && role.trim()) {
        hints.add(slugifyRole(role));
        continue;
      }
      if (role && typeof role === "object") {
        const label = resolveRoleString({ role });
        if (label) hints.add(slugifyRole(label));
      }
    }
  }

  return Array.from(hints);
}

export function resolveEmployeeId(user: AuthUser | null = readAuthUser()): number | null {
  if (!user) return null;
  const id = user.employee_id ?? user.employee?.id;
  return typeof id === "number" && id > 0 ? id : null;
}

export function resolveCompanyId(user: AuthUser | null = readAuthUser()): number | null {
  if (!user) return null;
  const companyId = user.company?.id;
  const tenantId = user.tenant?.id;
  const fallback =
    typeof user.company_id === "number" ? user.company_id : undefined;
  const id = companyId ?? tenantId ?? fallback;
  return typeof id === "number" && id > 0 ? id : null;
}

export function isEmployeeSession(user: AuthUser | null = readAuthUser()): boolean {
  const hints = collectRoleHints(user);
  if (hints.length === 0) return false;
  return hints.every((role) => role === "employee");
}

export function isAdminSession(user: AuthUser | null = readAuthUser()): boolean {
  if (!user) return false;
  if (user.is_admin === true || user.is_super_admin === true) return true;
  const hints = collectRoleHints(user);
  return hints.some(
    (role) =>
      role.includes("admin") || role.includes("superadmin") || role === "super_admin",
  );
}

export function isSuperAdminSession(user: AuthUser | null = readAuthUser()): boolean {
  if (!user) return false;
  if (user.is_super_admin === true) return true;
  const hints = collectRoleHints(user);
  return hints.some(
    (role) =>
      role === "super_admin" ||
      role.includes("superadmin") ||
      (role.includes("super") && role.includes("admin")),
  );
}

/** Admins / super admins who should receive live punch in/out alerts (not employees). */
export function isPunchAlertAdminSession(user: AuthUser | null = readAuthUser()): boolean {
  if (!user) return false;
  if (isEmployeeSession(user) && !isAdminSession(user) && !isSuperAdminSession(user)) {
    return false;
  }
  return isSuperAdminSession(user) || isAdminSession(user);
}

export function isDirectorSession(user: AuthUser | null = readAuthUser()): boolean {
  const hints = collectRoleHints(user);
  return hints.some((role) => role === "director" || role.includes("director"));
}

export function isHodSession(user: AuthUser | null = readAuthUser()): boolean {
  const hints = collectRoleHints(user);
  return hints.some(
    (role) => role === "hod" || role.includes("head_of_department") || role.includes("hod"),
  );
}

export function isHrSession(user: AuthUser | null = readAuthUser()): boolean {
  const hints = collectRoleHints(user);
  return hints.some((role) => role === "hr" || role.includes("human_resource"));
}

/** Admin / HR roles allowed to open the live attendance feed (matches backend policy). */
export function canViewLiveAttendanceSession(user: AuthUser | null = readAuthUser()): boolean {
  if (!user) return false;
  if (isEmployeeSession(user) && !isAdminSession(user) && !isHrSession(user)) {
    return false;
  }
  return (
    isSuperAdminSession(user) ||
    isAdminSession(user) ||
    isHrSession(user) ||
    isDirectorSession(user) ||
    isHodSession(user)
  );
}

export function isLeaveApproverSession(user: AuthUser | null = readAuthUser()): boolean {
  if (!user) return false;
  if (
    isAdminSession(user) ||
    isDirectorSession(user) ||
    isHrSession(user) ||
    isHodSession(user)
  ) {
    return true;
  }

  const hints = collectRoleHints(user);
  return hints.some(
    (role) =>
      role.includes("approver") || role.includes("manager") || role === "supervisor",
  );
}

/** Default landing page after login / app open, based on role. */
export function resolveHomeDashboardPath(
  user: AuthUser | null = readAuthUser(),
): string {
  if (!user) return "/employee-dashboard";

  // Admin / Super Admin / HR always open on HR Dashboard.
  if (isAdminSession(user) || isSuperAdminSession(user) || isHrSession(user)) {
    return "/hr-dashboard";
  }
  if (isDirectorSession(user)) return "/director-dashboard";
  if (isHodSession(user)) return "/hod-dashboard";
  return "/employee-dashboard";
}

export const HOME_DASHBOARD_PATHS = [
  "/hr-dashboard",
  "/employee-dashboard",
  "/hod-dashboard",
  "/director-dashboard",
] as const;

export type HomeDashboardPath = (typeof HOME_DASHBOARD_PATHS)[number];

export function isHomeDashboardPath(value: unknown): value is HomeDashboardPath {
  return (
    typeof value === "string" &&
    (HOME_DASHBOARD_PATHS as readonly string[]).includes(value)
  );
}
