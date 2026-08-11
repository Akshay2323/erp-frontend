import { API_BASE_URL } from "@/lib/config";
import { resolveApiAssetUrl } from "@/lib/api/employees/http";
import { resolveRoleString } from "@/lib/auth-session";
import { AUTH_ME_SESSION_KEY, AUTH_ME_SESSION_TTL_MS } from "@/lib/auth-cache-constants";
import {
  handleAuthMeFailure,
  handleAuthMeSuccess,
} from "@/lib/auth-cookie";

export type AuthMeCachePayload = {
  fetchedAt: number;
  role?: string;
  is_admin?: boolean;
  is_super_admin?: boolean;
  companyName?: string;
  tenantName?: string;
  logoUrl?: string | null;
};

function readCache(): AuthMeCachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AUTH_ME_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthMeCachePayload;
    if (!parsed.fetchedAt || Date.now() - parsed.fetchedAt > AUTH_ME_SESSION_TTL_MS) {
      sessionStorage.removeItem(AUTH_ME_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(payload: AuthMeCachePayload) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(AUTH_ME_SESSION_KEY, JSON.stringify(payload));
}

export function getCachedAuthMe(): AuthMeCachePayload | null {
  return readCache();
}

/** Fetch `/auth/me` at most once per tab every AUTH_ME_SESSION_TTL_MS unless forced. */
export async function fetchAuthMeCached(
  token: string,
  options?: { force?: boolean },
): Promise<AuthMeCachePayload | null> {
  if (!options?.force) {
    const cached = readCache();
    if (cached) return cached;
  }

  try {
    const res = await fetch(`${API_BASE_URL}v1/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
    });

    if (handleAuthMeFailure(res.status)) return null;
    if (!res.ok) return readCache();

    const json = await res.json();
    if (json?.success === false && (res.status === 401 || res.status === 403)) {
      handleAuthMeFailure(res.status);
      return null;
    }

    handleAuthMeSuccess(token);
    const user = json?.data?.user;
    const rawLogoUrl =
      json?.data?.tenant?.logo_url ?? json?.data?.logo?.logo_url ?? null;
    const payload: AuthMeCachePayload = {
      fetchedAt: Date.now(),
      role: resolveRoleString(user) ?? undefined,
      is_admin: user?.is_admin === true,
      is_super_admin: user?.is_super_admin === true,
      companyName: json?.data?.company?.name ?? json?.data?.tenant?.name,
      tenantName: json?.data?.tenant?.name,
      logoUrl: resolveApiAssetUrl(rawLogoUrl),
    };
    writeCache(payload);
    return payload;
  } catch {
    return readCache();
  }
}

export function clearAuthMeCache(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_ME_SESSION_KEY);
}
