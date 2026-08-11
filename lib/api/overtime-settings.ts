import { API_BASE_URL } from "@/lib/config";

export type OvertimeCountingType = "monthly_days" | "working_days";

export type OvertimeWorkingType = "all_days_present" | "minimum_days" | "allowed_anyway";

export type OvertimeSettings = {
  overtime_counting_type: OvertimeCountingType;
  overtime_working_type: OvertimeWorkingType;
  minimum_present_days: number | null;
  rate_multiplier: number;
};

export type OvertimeSettingsEnvelope = {
  success: boolean;
  message: string;
  data?: OvertimeSettings | { errors?: Record<string, string[]> };
};

export type OvertimeSettingsApiError = {
  message: string;
  status?: number;
  fieldErrors?: Record<string, string[]>;
};

export const DEFAULT_OVERTIME_SETTINGS: OvertimeSettings = {
  overtime_counting_type: "working_days",
  overtime_working_type: "minimum_days",
  minimum_present_days: 22,
  rate_multiplier: 1.5,
};

const COUNTING_TYPES = new Set<OvertimeCountingType>(["monthly_days", "working_days"]);
const WORKING_TYPES = new Set<OvertimeWorkingType>([
  "all_days_present",
  "minimum_days",
  "allowed_anyway",
]);

const isApiError = (error: unknown): error is OvertimeSettingsApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (
  message: string,
  options?: { status?: number; fieldErrors?: Record<string, string[]> },
) =>
  Promise.reject({
    message,
    status: options?.status,
    fieldErrors: options?.fieldErrors,
  } as OvertimeSettingsApiError);

function extractFieldErrors(json: OvertimeSettingsEnvelope): Record<string, string[]> | undefined {
  const data = json.data;
  if (data && typeof data === "object" && "errors" in data) {
    const errors = (data as { errors?: Record<string, string[]> }).errors;
    if (errors && typeof errors === "object") return errors;
  }
  return undefined;
}

export function normalizeOvertimeSettings(data: unknown): OvertimeSettings {
  if (!data || typeof data !== "object") {
    return DEFAULT_OVERTIME_SETTINGS;
  }

  const raw = data as Partial<OvertimeSettings>;
  const countingType = COUNTING_TYPES.has(raw.overtime_counting_type as OvertimeCountingType)
    ? (raw.overtime_counting_type as OvertimeCountingType)
    : DEFAULT_OVERTIME_SETTINGS.overtime_counting_type;
  const workingType = WORKING_TYPES.has(raw.overtime_working_type as OvertimeWorkingType)
    ? (raw.overtime_working_type as OvertimeWorkingType)
    : DEFAULT_OVERTIME_SETTINGS.overtime_working_type;

  const minimumPresentDays =
    workingType === "minimum_days" &&
    typeof raw.minimum_present_days === "number" &&
    raw.minimum_present_days >= 1
      ? raw.minimum_present_days
      : workingType === "minimum_days"
        ? DEFAULT_OVERTIME_SETTINGS.minimum_present_days
        : null;

  const rateMultiplier =
    typeof raw.rate_multiplier === "number" && raw.rate_multiplier >= 0.01 && raw.rate_multiplier <= 10
      ? raw.rate_multiplier
      : DEFAULT_OVERTIME_SETTINGS.rate_multiplier;

  return {
    overtime_counting_type: countingType,
    overtime_working_type: workingType,
    minimum_present_days: minimumPresentDays,
    rate_multiplier: rateMultiplier,
  };
}

export async function getOvertimeSettings(token: string): Promise<OvertimeSettings> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/settings/overtime`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
    });

    const result = (await response.json()) as OvertimeSettingsEnvelope;

    if (response.status === 403) {
      return fail(result.message || "You don't have permission to view overtime settings.", {
        status: 403,
      });
    }

    if (!response.ok || !result.success) {
      return fail(result.message || "Unable to load overtime settings.", {
        status: response.status,
        fieldErrors: extractFieldErrors(result),
      });
    }

    return normalizeOvertimeSettings(result.data);
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to load overtime settings. Please check your network connection.");
  }
}

export async function saveOvertimeSettings(
  token: string,
  payload: OvertimeSettings,
): Promise<{ settings: OvertimeSettings; message: string }> {
  if (payload.overtime_working_type === "minimum_days") {
    if (payload.minimum_present_days == null || payload.minimum_present_days < 1) {
      return fail("Enter a minimum present-day count of at least 1.", {
        fieldErrors: {
          minimum_present_days: ["Required when minimum days rule is selected."],
        },
      });
    }
  }

  if (payload.rate_multiplier < 0.01 || payload.rate_multiplier > 10) {
    return fail("Overtime rate multiplier must be between 0.01 and 10.", {
      fieldErrors: {
        rate_multiplier: ["Overtime rate multiplier must be between 0.01 and 10."],
      },
    });
  }

  const body: OvertimeSettings = {
    overtime_counting_type: payload.overtime_counting_type,
    overtime_working_type: payload.overtime_working_type,
    minimum_present_days:
      payload.overtime_working_type === "minimum_days" ? payload.minimum_present_days : null,
    rate_multiplier: payload.rate_multiplier,
  };

  try {
    const response = await fetch(`${API_BASE_URL}v1/settings/overtime`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as OvertimeSettingsEnvelope;

    if (response.status === 403) {
      return fail(result.message || "You don't have permission to update overtime settings.", {
        status: 403,
      });
    }

    if (!response.ok || !result.success) {
      return fail(result.message || "Unable to save overtime settings.", {
        status: response.status,
        fieldErrors: extractFieldErrors(result),
      });
    }

    return {
      settings: normalizeOvertimeSettings(result.data),
      message: result.message || "Overtime settings saved.",
    };
  } catch (error) {
    if (isApiError(error)) return Promise.reject(error);
    return fail("Unable to save overtime settings. Please check your network connection.");
  }
}
