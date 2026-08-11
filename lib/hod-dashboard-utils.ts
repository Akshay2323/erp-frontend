import type { AuthUser } from "@/lib/auth-session";
import { readAuthUser, resolveEmployeeId } from "@/lib/auth-session";
import { getEmployeeDetail } from "@/lib/api/employee";
import { getDepartments } from "@/lib/api/department";

export type HodDepartmentContext = {
  departmentId: string;
  departmentName: string;
  companyId?: string;
};

export function readDepartmentFromUser(user: AuthUser | null): HodDepartmentContext | null {
  if (!user) return null;
  const extended = user as AuthUser & {
    department_id?: number;
    department?: { id: number; name: string };
  };
  const id = extended.department_id ?? extended.department?.id;
  if (!id || id <= 0) return null;
  return {
    departmentId: String(id),
    departmentName: extended.department?.name ?? "My Department",
    companyId: user.company?.id ? String(user.company.id) : undefined,
  };
}

export async function resolveHodDepartmentContext(
  token: string,
  user: AuthUser | null = readAuthUser(),
): Promise<HodDepartmentContext | null> {
  const direct = readDepartmentFromUser(user);
  if (direct) return direct;

  const employeeId = resolveEmployeeId(user);
  if (!employeeId) return null;

  try {
    const detail = await getEmployeeDetail(token, employeeId);
    const raw = detail.data as {
      employee?: {
        department_id?: number;
        department?: { id: number; name: string };
        company_id?: number;
      };
      job_detail?: { department_id?: number; department?: { id: number; name: string } };
      job_details?: { department_id?: number; department?: { id: number; name: string } };
    };
    const emp = raw.employee ?? (raw as unknown as typeof raw.employee);
    const job = raw.job_detail ?? raw.job_details;
    const departmentId = emp?.department_id ?? emp?.department?.id ?? job?.department_id ?? job?.department?.id;
    if (!departmentId) return null;

    let departmentName = emp?.department?.name ?? job?.department?.name;
    const companyId = emp?.company_id ?? user?.company?.id;

    if (!departmentName && companyId) {
      const deptRes = await getDepartments(token, {
        company_id: String(companyId),
        per_page: 100,
        page: 1,
      });
      const list = Array.isArray(deptRes.data)
        ? deptRes.data
        : deptRes.data && typeof deptRes.data === "object" && "items" in deptRes.data
          ? (deptRes.data as { items: Array<{ id: number; name: string }> }).items
          : [];
      departmentName = list.find((d) => d.id === departmentId)?.name;
    }

    return {
      departmentId: String(departmentId),
      departmentName: departmentName ?? "My Department",
      companyId: companyId ? String(companyId) : undefined,
    };
  } catch {
    return null;
  }
}

export function filterByDepartmentEmployeeIds<T extends { employee_id?: number; id?: number }>(
  items: T[],
  employeeIds: Set<number>,
  idKey: "employee_id" | "id" = "employee_id",
): T[] {
  return items.filter((item) => {
    const id = idKey === "employee_id" ? item.employee_id : item.id;
    return typeof id === "number" && employeeIds.has(id);
  });
}
