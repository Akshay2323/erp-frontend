import {
  getEmployeeProfilePhotoProxyUrl,
  resolveApiAssetUrl,
} from "@/lib/api/employees/http";
import type { LiveAttendanceFeedItem } from "@/lib/api/live-attendance-feed";

export type AttendanceEvent = {
  id: string;
  logId: number;
  employeeCode: string;
  name: string;
  department: string;
  avatarUrl: string;
  type: "Punch In" | "Punch Out";
  time: string;
  timestamp: Date;
  /** Actual punch GPS coordinates (employee live location). */
  punchLocationLabel: string;
  /** Assigned office / branch geofence address. */
  geofenceSiteLabel: string;
  /** @deprecated Use punchLocationLabel — kept for search compatibility */
  locationName: string;
  latitude: number;
  longitude: number;
  distanceFromCenter: number;
  selfieUrl: string;
  profilePicUrl: string;
  geofenceStatusLabel: string;
  googleMapsUrl: string | null;
  status: "verified" | "flagged";
  device: string;
};

export function getEmployeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "EM";
}

function profilePhotoDisplayUrl(employee: LiveAttendanceFeedItem["employee"]): string {
  if (!employee.profile_photo_url?.trim()) return "";

  const idFromUrl = employee.profile_photo_url.match(/\/employees\/(\d+)\/profile-photo/i)?.[1];
  const employeeId = employee.id ?? (idFromUrl ? Number(idFromUrl) : null);
  if (!employeeId || !Number.isFinite(employeeId)) return "";

  return getEmployeeProfilePhotoProxyUrl(employeeId);
}

function formatPunchCoordinates(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function resolvePunchLocationLabel(item: LiveAttendanceFeedItem): string {
  const location = item.location;
  const fromCoords = formatPunchCoordinates(location.latitude, location.longitude);
  if (fromCoords) return fromCoords;

  const liveAddress =
    (location as { live_address?: string | null }).live_address?.trim() ||
    (location as { punch_address?: string | null }).punch_address?.trim();
  if (liveAddress) return liveAddress;

  return location.address?.trim() || "Location not recorded";
}

function resolveGeofenceSiteLabel(item: LiveAttendanceFeedItem): string {
  const location = item.location;
  const branchName = (location as { branch_name?: string | null }).branch_name?.trim();
  const branchAddress = (location as { branch_address?: string | null }).branch_address?.trim();

  if (branchName && branchAddress) return `${branchName} · ${branchAddress}`;
  if (branchAddress) return branchAddress;
  if (branchName) return branchName;

  // API currently puts branch address in location.address
  const legacyBranch = location.address?.trim();
  if (legacyBranch) return legacyBranch;

  return item.company?.name?.trim() || "Unknown site";
}

export function mapLiveFeedItemToEvent(item: LiveAttendanceFeedItem): AttendanceEvent {
  const isPunchIn = item.punch_type === "punch_in";
  const distance = item.geofence.distance_meters ?? 0;
  const withinRadius = item.geofence.within_radius;
  const isFlagged = withinRadius === false;
  const profileUrl = profilePhotoDisplayUrl(item.employee);
  const selfieUrl = resolveApiAssetUrl(item.selfie_url) ?? "";
  const punchLocationLabel = resolvePunchLocationLabel(item);
  const geofenceSiteLabel = resolveGeofenceSiteLabel(item);

  return {
    id: String(item.id),
    logId: item.id,
    employeeCode: item.employee.employee_code || "—",
    name: item.employee.name || "Employee",
    department: item.employee.department?.trim() || "—",
    avatarUrl: profileUrl,
    type: isPunchIn ? "Punch In" : "Punch Out",
    time: item.punch_time_formatted || "—",
    timestamp: item.punch_time ? new Date(item.punch_time) : new Date(),
    punchLocationLabel,
    geofenceSiteLabel,
    locationName: punchLocationLabel,
    latitude: item.location.latitude ?? 0,
    longitude: item.location.longitude ?? 0,
    distanceFromCenter: Math.round(distance),
    selfieUrl,
    profilePicUrl: profileUrl,
    geofenceStatusLabel: item.geofence.status_label || (isFlagged ? "Outside" : "Inside"),
    googleMapsUrl: item.location.google_maps_url ?? null,
    status: isFlagged ? "flagged" : "verified",
    device: item.device.info?.trim() || "Unknown device",
  };
}

export function mergeFeedEvents(
  existing: AttendanceEvent[],
  incoming: AttendanceEvent[],
): AttendanceEvent[] {
  const map = new Map<string, AttendanceEvent>();
  for (const event of existing) {
    map.set(event.id, event);
  }
  for (const event of incoming) {
    map.set(event.id, event);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime() || b.logId - a.logId,
  );
}

export function maxLogId(events: AttendanceEvent[]): number {
  return events.reduce((max, event) => Math.max(max, event.logId), 0);
}
