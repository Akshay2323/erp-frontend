import { apiUrl, bearerHeaders } from "@/lib/api/http";

export type AdminEmployeeEvent =
  | {
      event: "salary_confirmed";
      employee_id?: number;
      month: number;
      year: number;
      net_payable?: number;
    };

/**
 * Notify admins (Web Push) about an employee-driven event such as salary confirmation.
 */
export async function notifyAdminEmployeeEvent(
  token: string,
  payload: AdminEmployeeEvent,
): Promise<void> {
  const response = await fetch(apiUrl("v1/notifications/admin-employee-event"), {
    method: "POST",
    headers: bearerHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Admin event notify failed (${response.status})`);
  }
}
