import { API_BASE_URL } from "@/lib/config";

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.replace(/^\//, "")}`;
}

export function bearerHeaders(
  token: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "X-CSRF-TOKEN": "",
    ...extra,
  };
}
