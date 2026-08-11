export type LateConversionUnit = "day" | "Penalty";

export type LateConversionParts = {
  lateCount: number;
  penaltyValue: number;
  penaltyUnit: LateConversionUnit;
};

export const LATE_CONVERSION_PATTERN =
  /^(\d+(?:\.\d+)?)\s+late\s*=\s*(\d+(?:\.\d+)?)\s+(day|Penalty)$/i;

export const DEFAULT_LATE_CONVERSION: LateConversionParts = {
  lateCount: 3,
  penaltyValue: 0.5,
  penaltyUnit: "day",
};

export function formatLateConversion(parts: LateConversionParts): string {
  return `${parts.lateCount} late = ${parts.penaltyValue} ${parts.penaltyUnit}`;
}

export function parseLateConversion(value: string): LateConversionParts | null {
  const match = value.trim().match(LATE_CONVERSION_PATTERN);
  if (!match) return null;

  const lateCount = Number(match[1]);
  const penaltyValue = Number(match[2]);
  const penaltyUnit: LateConversionUnit =
    match[3].toLowerCase() === "penalty" ? "Penalty" : "day";

  if (!Number.isFinite(lateCount) || !Number.isFinite(penaltyValue)) return null;

  return { lateCount, penaltyValue, penaltyUnit };
}

export function validateLateConversionParts(parts: LateConversionParts): string | null {
  if (!Number.isFinite(parts.lateCount) || parts.lateCount <= 0) {
    return "Number of lates must be greater than 0.";
  }
  if (!Number.isInteger(parts.lateCount)) {
    return "Number of lates must be a whole number.";
  }
  if (!Number.isFinite(parts.penaltyValue) || parts.penaltyValue <= 0) {
    return "Penalty value must be greater than 0.";
  }
  if (parts.penaltyUnit !== "day" && parts.penaltyUnit !== "Penalty") {
    return "Penalty type must be Day or Penalty.";
  }

  const formatted = formatLateConversion(parts);
  if (!LATE_CONVERSION_PATTERN.test(formatted)) {
    return 'Format must be like "3 late = 0.5 day" or "3 late = 0.5 Penalty".';
  }

  return null;
}

export function resolveLateConversionParts(value: string): LateConversionParts {
  return parseLateConversion(value) ?? DEFAULT_LATE_CONVERSION;
}
