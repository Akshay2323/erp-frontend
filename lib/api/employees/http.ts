import { API_BASE_URL, IS_API_PROXY } from "@/lib/config";

import type { EmployeeApiEnvelope, EmployeeApiError, EmployeeDocumentRecord } from "./types";
import { EMPLOYEES_PATH } from "./paths";

/** Serve Laravel public storage via same-origin /api proxy (backend route: /api/storage/...). */
function toProxiedStoragePath(url: string): string | null {
  const apiStorageMatch = url.match(/\/api\/storage\/(.+)$/i);
  if (apiStorageMatch) {
    return `/api/storage/${apiStorageMatch[1]}`;
  }

  const storageMatch = url.match(/\/storage\/(.+)$/i);
  if (storageMatch) {
    return `/api/storage/${storageMatch[1]}`;
  }

  return null;
}

/** Rewrite backend absolute URLs (e.g. 127.0.0.1:8000) to the client API base. */
export function resolveApiAssetUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;

  const storagePath = toProxiedStoragePath(url.trim());
  if (storagePath) return storagePath;

  const apiPathMatch = url.match(/\/api\/(.+)$/);
  if (apiPathMatch) {
    const suffix = apiPathMatch[1];
    return IS_API_PROXY ? `/api/${suffix}` : `${API_BASE_URL}${suffix}`;
  }

  if (url.startsWith("/")) {
    return IS_API_PROXY ? url : `${API_BASE_URL.replace(/\/$/, "")}${url}`;
  }

  return url;
}

/** Prefer download URL, then legacy `url`, then preview URL. */
export function getDocumentFileUrl(
  doc: Pick<EmployeeDocumentRecord, "url" | "download_url" | "preview_url">,
): string | null {
  return resolveApiAssetUrl(doc.download_url || doc.url || doc.preview_url);
}

/** Resolve profile photo URL from employee detail payload. */
export function getEmployeeProfilePhotoUrl(
  employee: unknown,
  employeeId?: number | null,
): string | null {
  if (!employee || typeof employee !== "object") return null;

  const record = employee as Record<string, unknown>;
  const profilePhoto = record.profile_photo;

  if (profilePhoto && typeof profilePhoto === "object") {
    const photo = profilePhoto as Record<string, unknown>;
    const direct =
      (typeof photo.download_url === "string" && photo.download_url) ||
      (typeof photo.url === "string" && photo.url);
    if (direct) return resolveApiAssetUrl(direct);
  }

  const legacy =
    (typeof record.photo_url === "string" && record.photo_url) ||
    (typeof record.photo === "string" && record.photo);
  if (legacy) return resolveApiAssetUrl(legacy);

  const id = employeeId ?? (typeof record.id === "number" ? record.id : null);
  if (id && profilePhoto) {
    return resolveApiAssetUrl(`/api/v1/employees/${id}/profile-photo`);
  }

  return null;
}

/** Same-origin URL for protected profile photos (uses auth cookie server-side). */
export function getEmployeeProfilePhotoProxyUrl(employeeId: number): string {
  return `/api/employee-profile-photo?employeeId=${employeeId}`;
}

/** Load profile photo via authenticated fetch (required for protected `/profile-photo` URLs). */
export async function fetchEmployeeProfilePhotoBlobUrl(
  token: string,
  employee: unknown,
  employeeId?: number | null,
): Promise<string | null> {
  const url = getEmployeeProfilePhotoUrl(employee, employeeId);
  if (!url) return null;

  const record = employee as Record<string, unknown>;
  const id = employeeId ?? (typeof record.id === "number" ? record.id : null);
  if (!id) return null;

  // Prefer same-origin proxy so the browser does not need cross-origin Bearer requests.
  const fetchUrl = getEmployeeProfilePhotoProxyUrl(id);
  const response = await fetch(fetchUrl, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) return null;

  const blob = await response.blob();
  if (!blob.size) return null;

  return URL.createObjectURL(blob);
}

export function employeeResourceUrl(...segments: Array<string | number>): string {
  const parts = [EMPLOYEES_PATH, ...segments].filter((s) => s !== "").join("/");
  return `${API_BASE_URL}${parts}`;
}

export const parseJson = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

export const isEmployeeApiError = (error: unknown): error is EmployeeApiError =>
  typeof error === "object" && error !== null && "message" in error;

export function rejectEmployeeApi(
  message: string,
  fieldErrors?: Record<string, string[]>,
): never {
  throw { message, fieldErrors } as EmployeeApiError;
}

export function extractFieldErrors(data: unknown): Record<string, string[]> | undefined {
  if (
    typeof data === "object" &&
    data !== null &&
    "errors" in data &&
    typeof (data as { errors?: unknown }).errors === "object"
  ) {
    const e = (data as { errors?: Record<string, string[]> }).errors;
    return e ?? undefined;
  }
  return undefined;
}

function isEnvelopeSuccessful(result: EmployeeApiEnvelope<unknown>): boolean {
  return result.success === true || result.status === true;
}

/** JSON POST with JSON body (backend examples use wildcard Accept headers). */
export async function postEmployeeJson<TResult extends EmployeeApiEnvelope<unknown>>(
  token: string,
  pathSegments: Array<string | number>,
  body: unknown,
): Promise<TResult> {
  const response = await fetch(employeeResourceUrl(...pathSegments), {
    method: "POST",
    headers: {
      Accept: "*/*",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": "",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const result = await parseJson<TResult & { data?: unknown }>(response);
  const success = isEnvelopeSuccessful(result as EmployeeApiEnvelope<unknown>);
  const message = String((result as EmployeeApiEnvelope<unknown>).message ?? "");

  if (!response.ok || !success) {
    const fieldErrors = extractFieldErrors(result.data);
    rejectEmployeeApi(message || "Request failed.", fieldErrors);
  }

  return result as TResult;
}

/** multipart — do not set Content-Type so the browser adds the boundary */
export async function postEmployeeMultipart<TResult extends EmployeeApiEnvelope<unknown>>(
  token: string,
  pathSegments: Array<string | number>,
  formData: FormData,
): Promise<TResult> {
  const response = await fetch(employeeResourceUrl(...pathSegments), {
    method: "POST",
    headers: {
      Accept: "*/*",
      Authorization: `Bearer ${token}`,
      "X-CSRF-TOKEN": "",
    },
    body: formData,
    cache: "no-store",
  });

  const result = await parseJson<TResult & { data?: unknown }>(response);
  const success = isEnvelopeSuccessful(result as EmployeeApiEnvelope<unknown>);
  const msg = String((result as EmployeeApiEnvelope<unknown>).message ?? "");

  if (!response.ok || !success) {
    const fieldErrors = extractFieldErrors(result.data);
    rejectEmployeeApi(msg || "Request failed.", fieldErrors);
  }

  return result as TResult;
}

export async function getEmployeeCollection<TData>(
  token: string,
  searchParams: URLSearchParams,
): Promise<EmployeeApiEnvelope<TData>> {
  const response = await fetch(
    `${employeeResourceUrl()}?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    },
  );
  const result = await parseJson<EmployeeApiEnvelope<TData>>(response);
  if (!response.ok || !isEnvelopeSuccessful(result as EmployeeApiEnvelope<unknown>)) {
    rejectEmployeeApi(result.message || "Unable to fetch employees.", undefined);
  }
  return result;
}
