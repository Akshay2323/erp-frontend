export type ShiftPunchTimes = {
  shiftStart: string;
  shiftEnd: string;
  label: string;
};

/** Normalize API time (`09:00:00` or `09:00`) to HTML time input value `09:00`. */
export function normalizeShiftTimeToInput(time?: string | null): string {
  if (!time) return "";
  const match = String(time).trim().match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "";
}

export function formatShiftTimeLabel(time?: string | null): string {
  const input = normalizeShiftTimeToInput(time);
  if (!input) return "";
  const [hours, minutes] = input.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return input;

  const date = new Date(2000, 0, 1, hours, minutes);
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function shiftPunchLabel(shiftStart?: string | null, shiftEnd?: string | null): string | null {
  if (!shiftStart || !shiftEnd) return null;
  const startLabel = formatShiftTimeLabel(shiftStart);
  const endLabel = formatShiftTimeLabel(shiftEnd);
  if (!startLabel || !endLabel) return null;
  return `${startLabel} - ${endLabel}`;
}

export function buildPunchIso(date: string, timeInput: string, offset = "+05:30"): string {
  return `${date}T${timeInput}:00${offset}`;
}

export function resolveShiftPunchTimes(
  shiftStart?: string | null,
  shiftEnd?: string | null,
): ShiftPunchTimes | null {
  const punchIn = normalizeShiftTimeToInput(shiftStart);
  const punchOut = normalizeShiftTimeToInput(shiftEnd);
  if (!punchIn || !punchOut) return null;

  const label = shiftPunchLabel(shiftStart, shiftEnd);
  if (!label) return null;

  return {
    shiftStart: punchIn,
    shiftEnd: punchOut,
    label,
  };
}
