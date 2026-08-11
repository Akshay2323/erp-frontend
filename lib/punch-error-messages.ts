import type { AttendanceApiError } from "@/lib/api/attendance";

export type PunchAction = "in" | "out";

function isAttendanceApiError(error: unknown): error is AttendanceApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as AttendanceApiError).message === "string"
  );
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function flattenFieldErrors(
  fieldErrors?: Record<string, string[]>,
): string[] {
  if (!fieldErrors) return [];
  return Object.values(fieldErrors).flatMap((messages) =>
    messages.filter((message) => typeof message === "string" && message.trim()),
  );
}

function combinedErrorText(
  message: string,
  fieldErrors?: Record<string, string[]>,
): string {
  return normalizeText([message, ...flattenFieldErrors(fieldErrors)].join(" "));
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function punchLabel(action: PunchAction): string {
  return action === "in" ? "Punch In" : "Punch Out";
}

function matchGeoLocationError(text: string, action: PunchAction): string | null {
  const geoPatterns = [
    /outside.*(location|geo|geofence|radius|area|tag)/i,
    /(location|geo|geofence|radius|area|tag).*(outside|not allowed|not permitted|exceed)/i,
    /not within.*(location|geo|geofence|radius|area|tag)/i,
    /allocated.*(location|geo|geotag|geo-tag)/i,
    /geo[\s-]?tag/i,
    /geofence/i,
    /geo[\s-]?location/i,
    /allowed\s+radius/i,
    /distance.*(exceed|limit|maximum|allowed)/i,
    /away from.*(office|workplace|location|site)/i,
    /must be at.*(office|workplace|location|site)/i,
    /work\s+location/i,
    /outside_location/i,
    /location.*not.*(allowed|permitted|valid)/i,
  ];

  if (!includesAny(text, geoPatterns)) return null;

  return `You are not at your allocated geo-tag work location. Please move within your assigned attendance area and try ${punchLabel(action)} again.`;
}

function matchAlreadyPunchedError(text: string, action: PunchAction): string | null {
  if (action === "in") {
    if (
      includesAny(text, [
        /already\s+punched\s+in/i,
        /already\s+checked\s+in/i,
        /punch\s+in.*already/i,
        /already\s+marked\s+present/i,
      ])
    ) {
      return "You have already punched in for today.";
    }
  }

  if (action === "out") {
    if (
      includesAny(text, [
        /already\s+punched\s+out/i,
        /already\s+checked\s+out/i,
        /punch\s+out.*already/i,
      ])
    ) {
      return "You have already punched out for today.";
    }
  }

  return null;
}

function matchPunchSequenceError(text: string, action: PunchAction): string | null {
  if (action === "out") {
    if (
      includesAny(text, [
        /must\s+punch\s+in/i,
        /punch\s+in\s+first/i,
        /not\s+punched\s+in/i,
        /no\s+punch\s+in/i,
        /already\s+punched\s+out/i,
      ])
    ) {
      return "Please punch in first before punching out.";
    }
  }

  if (action === "in") {
    if (
      includesAny(text, [
        /must\s+punch\s+out/i,
        /punch\s+out\s+first/i,
        /already\s+punched\s+in/i,
      ])
    ) {
      return "You are already punched in. Use Punch Out when your shift ends.";
    }
  }

  return null;
}

function matchImageError(text: string, action: PunchAction): string | null {
  if (
    includesAny(text, [
      /\bimage\b/i,
      /\bselfie\b/i,
      /\bphoto\b/i,
      /face.*(required|missing)/i,
      /capture.*(required|missing)/i,
    ])
  ) {
    return `A selfie is required to complete ${punchLabel(action)}. Please capture your photo and try again.`;
  }
  return null;
}

function matchShiftError(text: string): string | null {
  if (includesAny(text, [/shift/i, /attendance\s+mode/i])) {
    return "Your shift is not configured for attendance. Please contact your HR administrator.";
  }
  return null;
}

function matchHolidayWeekOffError(text: string, action: PunchAction): string | null {
  if (includesAny(text, [/holiday/i, /week[\s-]?off/i, /weekly\s+off/i])) {
    return `${punchLabel(action)} is not allowed today because it is marked as a holiday or week off.`;
  }
  return null;
}

function matchLocationCoordinateError(text: string, action: PunchAction): string | null {
  if (
    includesAny(text, [
      /latitude/i,
      /longitude/i,
      /location.*required/i,
      /gps/i,
      /coordinates?/i,
    ]) &&
    !matchGeoLocationError(text, action)
  ) {
    return `Location is required for ${punchLabel(action)}. Enable GPS/location permission for this site and try again.`;
  }
  return null;
}

function matchAuthError(text: string): string | null {
  if (
    includesAny(text, [
      /unauthenticated/i,
      /unauthorized/i,
      /invalid\s+token/i,
      /session.*expired/i,
      /not\s+logged\s+in/i,
    ])
  ) {
    return "Your session has expired. Please sign in again and retry.";
  }
  return null;
}

function matchEmployeeProfileError(text: string): string | null {
  if (
    includesAny(text, [
      /employee.*not\s+found/i,
      /profile.*not\s+found/i,
      /no\s+employee\s+record/i,
      /employee\s+id/i,
    ])
  ) {
    return "Your employee profile could not be found. Please contact HR to link your account.";
  }
  return null;
}

function matchDatabaseError(text: string, action: PunchAction): string | null {
  if (
    includesAny(text, [
      /database error/i,
      /sqlstate/i,
      /queryexception/i,
      /unknown column/i,
    ])
  ) {
    return `Your ${punchLabel(action)} was recorded, but the server had a follow-up error. Please refresh the dashboard to confirm your status.`;
  }
  return null;
}

/** Map punch API / client errors to clear employee-facing messages. */
export function formatPunchAttendanceError(
  error: unknown,
  action: PunchAction,
): string {
  if (isAttendanceApiError(error)) {
    const text = combinedErrorText(error.message, error.fieldErrors);

    return (
      matchGeoLocationError(text, action) ??
      matchAlreadyPunchedError(text, action) ??
      matchPunchSequenceError(text, action) ??
      matchImageError(text, action) ??
      matchHolidayWeekOffError(text, action) ??
      matchShiftError(text) ??
      matchLocationCoordinateError(text, action) ??
      matchEmployeeProfileError(text) ??
      matchAuthError(text) ??
      matchDatabaseError(text, action) ??
      (normalizeText(error.message) ||
        `Unable to complete ${punchLabel(action)}. Please try again.`)
    );
  }

  if (error instanceof Error && error.message.trim()) {
    const text = normalizeText(error.message);
    return (
      matchGeoLocationError(text, action) ??
      matchAlreadyPunchedError(text, action) ??
      matchPunchSequenceError(text, action) ??
      matchImageError(text, action) ??
      matchHolidayWeekOffError(text, action) ??
      matchShiftError(text) ??
      matchLocationCoordinateError(text, action) ??
      matchEmployeeProfileError(text) ??
      matchAuthError(text) ??
      matchDatabaseError(text, action) ??
      text
    );
  }

  return `Unable to complete ${punchLabel(action)}. Please check your connection and try again.`;
}

export function formatPunchAttendanceSuccess(
  message: string | undefined,
  action: PunchAction,
): string {
  const cleaned = message?.trim();
  if (cleaned) return cleaned;
  return action === "in"
    ? "Punch In recorded successfully."
    : "Punch Out recorded successfully.";
}

export function formatPunchLocationDeniedMessage(action: PunchAction): string {
  return `Location access is required for ${punchLabel(action)}. Allow location permission for this website, turn on GPS, then try again.`;
}

export function formatPunchLocationUnavailableMessage(action: PunchAction): string {
  return `Unable to read your current location for ${punchLabel(action)}. Turn on GPS, move to an open area, wait a moment, and try again.`;
}

export function formatPunchOutsideAllocatedGeoMessage(
  action: PunchAction,
  locationName?: string,
): string {
  const place = locationName?.trim() ? ` (${locationName.trim()})` : "";
  return `You are outside your allocated geo-tag work location${place}. Please move within your assigned attendance area and try ${punchLabel(action)} again.`;
}

export function formatPunchCaptureError(): string {
  return "Failed to capture your selfie. Please try again.";
}

export function formatPunchSignInRequiredMessage(): string {
  return "Please sign in before punching in or out.";
}
