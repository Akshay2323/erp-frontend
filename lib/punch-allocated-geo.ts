import { getEmployeeDetail, resolveEmployeeSession } from "@/lib/api/employee";
import { getLocation, type GeoLocation } from "@/lib/api/location";

function normalizeGeoLocation(raw: unknown): GeoLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const lat = Number(g.lat ?? g.latitude);
  const lng = Number(g.lng ?? g.longitude ?? g.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const radiusRaw = g.radius ?? g.allowed_radius ?? g.geo_radius;
  const radius = Number.isFinite(Number(radiusRaw)) ? Number(radiusRaw) : 100;

  return {
    id: g.id as string | number | undefined,
    code: String(g.code ?? ""),
    name: String(g.name ?? "Work location"),
    lat,
    lng,
    radius,
    active: g.active !== false,
  };
}

/**
 * Loads the geo-tag assigned to the logged-in employee (from job details).
 */
export async function loadEmployeeAllocatedGeolocation(
  token: string,
  sessionUser: unknown,
): Promise<GeoLocation | null> {
  const resolved = await resolveEmployeeSession(token, sessionUser);
  if (!resolved?.employeeId) return null;

  const res = await getEmployeeDetail(token, resolved.employeeId);
  const root = (res.data ?? {}) as Record<string, unknown>;
  const employee = (root.employee ?? root) as Record<string, unknown>;
  const jobDetail = (employee.job_detail ?? employee.job_details ?? {}) as Record<
    string,
    unknown
  >;

  const nested = normalizeGeoLocation(jobDetail.geolocation);
  if (nested) return nested;

  const geoId = jobDetail.geolocation_id;
  if (geoId == null || geoId === "") return null;

  const geoIdValue =
    typeof geoId === "number" || typeof geoId === "string" ? geoId : Number(geoId);
  if (!geoIdValue) return null;

  try {
    const locRes = await getLocation(token, geoIdValue);
    return normalizeGeoLocation(locRes.data?.geolocation) ?? null;
  } catch {
    return null;
  }
}
