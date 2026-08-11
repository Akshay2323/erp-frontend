"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Info, Save, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PanelSkeleton } from "@/components/ui/page-states";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getCompanies, type Company } from "@/lib/api/company";
import {
  createShift,
  defaultShiftSchedule,
  deleteShift,
  getShift,
  getShifts,
  updateShift,
  type Shift,
  type ShiftApiError,
  type ShiftDaySchedule,
  type ShiftStatus,
  type UpdateShiftPayload,
} from "@/lib/api/shift";
import {
  DEFAULT_LATE_CONVERSION,
  formatLateConversion,
  resolveLateConversionParts,
  validateLateConversionParts,
} from "@/lib/validations/late-conversion";
import { useAuthToken } from "@/lib/use-auth-token";

type ShiftRulesForm = {
  company_id: string;
  shift_id: string;
  shift_name: string;
  shift_code: string;
  attendance_mode: "fixed" | "hour-based";
  status: ShiftStatus;
  schedule: ShiftDaySchedule[];
  late_grace_minutes: number;
  late_after_minutes: number;
  late_conversion_count: number;
  late_conversion_value: number;
  late_conversion_unit: "day" | "Penalty";
  half_day_after_hours: number;
  half_day_at_time: string;
  half_day_type: "time" | "hours";
  working_min_present_hours: number;
  working_min_half_day_hours: number;
  working_max_break_deduction_minutes: number;
};

const HOUR_BASED_WORKING_DEFAULTS = {
  working_min_present_hours: 9,
  working_min_half_day_hours: 4.5,
  working_max_break_deduction_minutes: 0,
} as const;

const HIDDEN_SHIFT_RULE_DEFAULTS = {
  overtime_rules: {
    type: "After Shift End",
    min_hours: 9,
  },
  geo_location_rules: {
    require_location: true,
    allow_outside_radius: "No",
  },
  auto_absent_rules: {
    no_punch_mark_absent: true,
    missed_punch_handling: "Notify Manager",
  },
  fixed_working_hours_rules: {
    min_present_hours: 8,
    min_half_day_hours: 4,
    max_break_deduction_minutes: 60,
  },
} as const;

function FieldExamples({ examples }: { examples: [string, string] }) {
  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-muted/25 px-2.5 py-2 text-xs text-muted-foreground">
      <div className="flex items-start gap-2">
        <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <ul className="space-y-1">
          <li>Example 1: {examples[0]}</li>
          <li>Example 2: {examples[1]}</li>
        </ul>
      </div>
    </div>
  );
}

const GRACE_MINUTES_EXAMPLES: [string, string] = [
  "Shift starts 9:00 AM with 10 min grace — punch by 9:10 AM is treated as on time.",
  "Shift starts 10:00 AM with 5 min grace — punch by 10:05 AM is treated as on time.",
];

const LATE_AFTER_MINUTES_EXAMPLES: [string, string] = [
  "Grace 10 min + late after 15 min — punch from 9:11 AM to 9:25 AM is in the late window.",
  "Grace 5 min + late after 20 min — punch after 10:25 AM is marked late for a 10:00 AM shift.",
];

const DAY_TO_WEEK_OFF_ABBR: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

const EMPTY_FORM: ShiftRulesForm = {
  company_id: "",
  shift_id: "",
  shift_name: "",
  shift_code: "",
  attendance_mode: "fixed",
  status: "active",
  schedule: [],
  late_grace_minutes: 10,
  late_after_minutes: 15,
  late_conversion_count: DEFAULT_LATE_CONVERSION.lateCount,
  late_conversion_value: DEFAULT_LATE_CONVERSION.penaltyValue,
  late_conversion_unit: DEFAULT_LATE_CONVERSION.penaltyUnit,
  half_day_after_hours: 4,
  half_day_at_time: "14:00:00",
  half_day_type: "time",
  ...HOUR_BASED_WORKING_DEFAULTS,
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

const readNum = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readStr = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

const toLocalTime = (value: string | null) => {
  if (!value) return "";
  return value.length >= 5 ? value.slice(0, 5) : value;
};

const toHms = (value: string) => (value.length === 5 ? `${value}:00` : value);
const DAY_FULL_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const deriveWeekOffFromSchedule = (schedule: ShiftDaySchedule[]): string[] =>
  schedule
    .filter((row) => !row.enabled)
    .map((row) => DAY_TO_WEEK_OFF_ABBR[row.day])
    .filter((value): value is string => Boolean(value));

const mapShiftToForm = (shift: Shift): ShiftRulesForm => {
  const lateRules = asRecord(shift.late_rules);
  const halfDayRules = asRecord(shift.half_day_rules);
  const workingRules = asRecord(shift.working_hours_rules);
  const isHourBased = shift.attendance_mode === "hour-based";

  const savedType = halfDayRules.half_day_type as "time" | "hours" | undefined;
  const half_day_type = savedType === "hours" || savedType === "time"
    ? savedType
    : (shift.attendance_mode === "hour-based" ? "hours" : "time");

  return {
    company_id: String(shift.company_id ?? ""),
    shift_id: String(shift.id),
    shift_name: shift.shift_name || shift.name,
    shift_code: shift.shift_code || "",
    attendance_mode: shift.attendance_mode === "hour-based" ? "hour-based" : "fixed",
    status: shift.status === "inactive" ? "inactive" : "active",
    schedule: shift.schedule.map((row) => ({
      day: row.day,
      enabled: row.enabled,
      start_time: row.start_time,
      end_time: row.end_time,
    })),
    late_grace_minutes: readNum(lateRules.grace_minutes, 10),
    late_after_minutes: readNum(lateRules.late_after_minutes, 15),
    ...(() => {
      const lateConversion = resolveLateConversionParts(
        readStr(lateRules.late_conversion, formatLateConversion(DEFAULT_LATE_CONVERSION)),
      );
      return {
        late_conversion_count: lateConversion.lateCount,
        late_conversion_value: lateConversion.penaltyValue,
        late_conversion_unit: lateConversion.penaltyUnit,
      };
    })(),
    half_day_after_hours: readNum(halfDayRules.half_day_after_hours, 4),
    half_day_at_time: readStr(halfDayRules.half_day_at_time, "14:00:00"),
    half_day_type,
    working_min_present_hours: isHourBased
      ? readNum(workingRules.min_present_hours, HOUR_BASED_WORKING_DEFAULTS.working_min_present_hours)
      : HOUR_BASED_WORKING_DEFAULTS.working_min_present_hours,
    working_min_half_day_hours: isHourBased
      ? readNum(workingRules.min_half_day_hours, HOUR_BASED_WORKING_DEFAULTS.working_min_half_day_hours)
      : HOUR_BASED_WORKING_DEFAULTS.working_min_half_day_hours,
    working_max_break_deduction_minutes: isHourBased
      ? readNum(
          workingRules.max_break_deduction_minutes,
          HOUR_BASED_WORKING_DEFAULTS.working_max_break_deduction_minutes,
        )
      : HOUR_BASED_WORKING_DEFAULTS.working_max_break_deduction_minutes,
  };
};

const buildShiftPayload = (form: ShiftRulesForm): UpdateShiftPayload => {
  const isFixedMode = form.attendance_mode === "fixed";

  return {
    company_id: Number(form.company_id),
    shift_name: form.shift_name,
    shift_code: form.shift_code,
    attendance_mode: form.attendance_mode,
    schedule: form.schedule,
    late_rules: {
      grace_minutes: form.late_grace_minutes,
      late_after_minutes: form.late_after_minutes,
      late_conversion: formatLateConversion({
        lateCount: form.late_conversion_count,
        penaltyValue: form.late_conversion_value,
        penaltyUnit: form.late_conversion_unit,
      }),
    },
    half_day_rules: {
      half_day_after_hours: form.half_day_after_hours,
      half_day_at_time: form.half_day_at_time,
      half_day_type: form.half_day_type,
    },
    overtime_rules: HIDDEN_SHIFT_RULE_DEFAULTS.overtime_rules,
    week_off_rules: isFixedMode
      ? deriveWeekOffFromSchedule(form.schedule)
      : ["Sun", "Sat"],
    geo_location_rules: HIDDEN_SHIFT_RULE_DEFAULTS.geo_location_rules,
    auto_absent_rules: HIDDEN_SHIFT_RULE_DEFAULTS.auto_absent_rules,
    working_hours_rules: isFixedMode
      ? HIDDEN_SHIFT_RULE_DEFAULTS.fixed_working_hours_rules
      : {
          min_present_hours: form.working_min_present_hours,
          min_half_day_hours: form.working_min_half_day_hours,
          max_break_deduction_minutes: form.working_max_break_deduction_minutes,
        },
    status: form.status,
  };
};

const isShiftDataPrefillReady = (shift: Shift | null): boolean => {
  if (!shift) return false;
  // If the list endpoint is “lightweight”, some rule fields may be missing.
  // In that case, we should fetch the full shift details via `getShift`.
  const hasSchedule = Array.isArray(shift.schedule) && shift.schedule.length > 0;
  const hasLateRules =
    typeof shift.late_rules === "object" &&
    shift.late_rules !== null &&
    "grace_minutes" in shift.late_rules;
  const hasHalfDayRules =
    typeof shift.half_day_rules === "object" &&
    shift.half_day_rules !== null &&
    "half_day_after_hours" in shift.half_day_rules;
  return hasSchedule && hasLateRules && hasHalfDayRules;
};

function ShiftRulesContent() {
  const searchParams = useSearchParams();
  const authToken = useAuthToken();
  const [authRole, setAuthRole] = useState("");
  const [form, setForm] = useState<ShiftRulesForm>(EMPTY_FORM);
  const [newShiftName, setNewShiftName] = useState("");
  const [newShiftCodeCustom, setNewShiftCodeCustom] = useState("");
  const [bulkStartTime, setBulkStartTime] = useState("09:00");
  const [bulkEndTime, setBulkEndTime] = useState("18:00");
  const [creatingShift, setCreatingShift] = useState(false);
  const [saving, setSaving] = useState(false);
  const isFixedMode = form.attendance_mode === "fixed";
  const lateConversionPreview = formatLateConversion({
    lateCount: form.late_conversion_count,
    penaltyValue: form.late_conversion_value,
    penaltyUnit: form.late_conversion_unit,
  });
  const lateConversionError = validateLateConversionParts({
    lateCount: form.late_conversion_count,
    penaltyValue: form.late_conversion_value,
    penaltyUnit: form.late_conversion_unit,
  });
  const attendanceModeHint = isFixedMode
    ? "Fixed Timing uses shift start/end cutoffs; Hour Based evaluates only working hour thresholds."
    : "Hour Based mode ignores fixed in/out cutoffs and uses minimum working-hour rules.";

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem("auth_user");
        const parsed = raw ? (JSON.parse(raw) as { role?: string }) : null;
        setAuthRole(parsed?.role ?? "");
      } catch {
        setAuthRole("");
      }
    });
  }, []);

  const queryClient = useQueryClient();
  const companiesQuery = useQuery({
    queryKey: ["companies-options", authToken, authRole],
    queryFn: () => getCompanies(authToken, 1, 100, "", authRole),
    enabled: Boolean(authToken),
  });

  const shiftsQuery = useQuery({
    queryKey: ["shift-rules", authToken, form.company_id],
    queryFn: () =>
      getShifts(authToken, {
        page: 1,
        per_page: 100,
        company_id: form.company_id || undefined,
      }),
    enabled: Boolean(authToken),
  });

  const companies: Company[] = companiesQuery.data?.data ?? [];
  const rawShifts = shiftsQuery.data?.data;
  const shifts: Shift[] = useMemo(
    () =>
      Array.isArray(rawShifts)
        ? rawShifts
        : Array.isArray(rawShifts?.items)
          ? rawShifts.items
          : [],
    [rawShifts],
  );

  const selectedShift = useMemo(
    () => shifts.find((shift) => String(shift.id) === form.shift_id) ?? null,
    [shifts, form.shift_id],
  );

  const lastPrefilledShiftIdRef = useRef<string | null>(null);

  useEffect(() => {
    const shiftIdParam = searchParams.get("shiftId");
    if (!authToken || !shiftIdParam) return;
    if (lastPrefilledShiftIdRef.current === shiftIdParam) return;

    const numericId = Number(shiftIdParam);
    if (!Number.isFinite(numericId)) return;

    const shiftFromList = shifts.find((item) => String(item.id) === shiftIdParam) ?? null;

    const run = async () => {
      try {
        const shift =
          isShiftDataPrefillReady(shiftFromList) ? shiftFromList : await getShift(authToken, numericId);
        queueMicrotask(() => {
          if (shift) {
            setForm(mapShiftToForm(shift));
          }
        });
        lastPrefilledShiftIdRef.current = shiftIdParam;
      } catch {
        toast.error("Unable to prefill shift rules.");
      }
    };

    run();
  }, [authToken, searchParams, shifts]);

  const onSelectCompany = (companyId: string) => {
    setForm((prev) => {
      const shiftIdParam = searchParams.get("shiftId");
      return {
        ...prev,
        company_id: companyId,
        shift_id: shiftIdParam ?? "",
      };
    });
  };

  const onSelectShift = (shiftId: string) => {
    const shift = shifts.find((s) => String(s.id) === shiftId);
    if (!shift) {
      setForm((prev) => ({ ...prev, shift_id: "" }));
      return;
    }
    setForm(mapShiftToForm(shift));
  };

  const updateSchedule = (
    index: number,
    key: "enabled" | "start_time" | "end_time",
    value: boolean | string,
  ) => {
    setForm((prev) => {
      const nextSchedule = [...prev.schedule];
      const row = { ...nextSchedule[index] };
      if (key === "enabled") {
        row.enabled = Boolean(value);
        if (!row.enabled) {
          row.start_time = null;
          row.end_time = null;
        } else {
          row.start_time = row.start_time ?? "09:00:00";
          row.end_time = row.end_time ?? "18:00:00";
        }
      } else {
        const normalized = String(value);
        row[key] = row.enabled ? toHms(normalized) : null;
      }
      nextSchedule[index] = row;
      return { ...prev, schedule: nextSchedule };
    });
  };

  const applyWeekdayTemplate = () => {
    setForm((prev) => {
      const nextSchedule = DAY_FULL_NAMES.map((day) => {
        const existing = prev.schedule.find((row) => row.day === day);
        if (["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(day)) {
          return {
            day,
            enabled: true,
            start_time: "09:00:00",
            end_time: "18:00:00",
          };
        }
        return (
          existing ?? {
            day,
            enabled: day === "Saturday",
            start_time: day === "Saturday" ? "11:00:00" : null,
            end_time: day === "Saturday" ? "15:00:00" : null,
          }
        );
      });
      return { ...prev, schedule: nextSchedule };
    });
  };

  const setSaturdayHalfDay = () => {
    setForm((prev) => {
      const nextSchedule = DAY_FULL_NAMES.map((day) => {
        const existing = prev.schedule.find((row) => row.day === day) ?? {
          day,
          enabled: false,
          start_time: null,
          end_time: null,
        };
        if (day !== "Saturday") return existing;
        return {
          ...existing,
          enabled: true,
          start_time: "11:00:00",
          end_time: "15:00:00",
        };
      });
      return { ...prev, schedule: nextSchedule };
    });
  };

  const clearAllDayTimes = () => {
    setForm((prev) => ({
      ...prev,
      schedule: DAY_FULL_NAMES.map((day) => ({
        day,
        enabled: false,
        start_time: null,
        end_time: null,
      })),
    }));
  };

  const applyTimeToAllWorkingDays = () => {
    const start = toHms(bulkStartTime);
    const end = toHms(bulkEndTime);
    const workingDayCount = form.schedule.filter((row) => row.enabled).length;

    if (workingDayCount === 0) {
      toast.error("Select at least one working day first.");
      return;
    }

    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((row) =>
        row.enabled ? { ...row, start_time: start, end_time: end } : row,
      ),
    }));

    toast.success("Applied start and end time to all selected working days.");
  };

  const saveRules = async () => {
    if (!authToken || !selectedShift) return;
    if (!form.company_id) {
      toast.error("Select a company first.");
      return;
    }
    if (lateConversionError) {
      toast.error(lateConversionError);
      return;
    }

    const payload = buildShiftPayload(form);

    setSaving(true);
    try {
      await updateShift(authToken, selectedShift.id, payload);
      toast.success("Shift rules updated successfully.");
      await queryClient.invalidateQueries({ queryKey: ["shift-rules"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["shifts"], exact: false });
    } catch (error) {
      const err = (error as ShiftApiError) ?? { message: "Unable to update shift rules." };
      toast.error(err.message || "Unable to update shift rules.");
    } finally {
      setSaving(false);
    }
  };

  const deleteExistingShift = async () => {
    if (!authToken || !selectedShift) return;
    if (!window.confirm(`Are you sure you want to delete shift "${selectedShift.shift_name || selectedShift.name}"?`)) return;

    setSaving(true);
    try {
      await deleteShift(authToken, selectedShift.id);
      toast.success("Shift deleted successfully.");
      await queryClient.invalidateQueries({ queryKey: ["shift-rules"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["shifts"], exact: false });
      setForm(EMPTY_FORM);
    } catch (error) {
      const err = (error as ShiftApiError) ?? { message: "Unable to delete shift." };
      toast.error(err.message || "Unable to delete shift.");
    } finally {
      setSaving(false);
    }
  };

  const createNewShift = async () => {
    if (!authToken) return;
    if (!form.company_id) {
      toast.error("Select company first.");
      return;
    }
    const createCode = newShiftCodeCustom.trim();

    if (!newShiftName.trim() || !createCode) {
      toast.error("Enter shift name and shift code.");
      return;
    }
    if (lateConversionError) {
      toast.error(lateConversionError);
      return;
    }

    const payload = buildShiftPayload({
      ...form,
      shift_name: newShiftName.trim(),
      shift_code: createCode,
      schedule:
        form.schedule.length > 0
          ? form.schedule
          : defaultShiftSchedule("09:00:00", "18:00:00"),
    });

    setCreatingShift(true);
    try {
      const created = await createShift(authToken, payload);
      toast.success("Shift created. Now select it from dropdown.");
      const createdShift =
        typeof created.data === "object" && created.data && "shift" in created.data
          ? created.data.shift
          : null;
      await queryClient.invalidateQueries({ queryKey: ["shift-rules"], exact: false });
      setNewShiftName("");
      setNewShiftCodeCustom("");
      if (createdShift?.id) {
        setForm((prev) => ({ ...prev, shift_id: String(createdShift.id) }));
      }
    } catch (error) {
      const err = (error as ShiftApiError) ?? { message: "Unable to create shift." };
      toast.error(err.message || "Unable to create shift.");
    } finally {
      setCreatingShift(false);
    }
  };



  return (
    <section className="space-y-5">
      {/* ── Page Header ── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Shift Rules</h1>
              <p className="text-sm text-muted-foreground">
                Configure attendance mode, schedule and rules for a shift.
              </p>
            </div>
          </div>
          <Button disabled={!selectedShift || saving} onClick={saveRules}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Rules"}
          </Button>
        </div>
      </div>

      {/* ── Section 1: Create New Shift ── */}
      <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/[0.03] p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-foreground">Create New Shift</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Select a company, enter shift details, then click Create. The new shift will appear in the dropdown below.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="text-sm font-medium">Company</label>
            <select
              className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              onChange={(event) => onSelectCompany(event.target.value)}
              value={form.company_id}
            >
              <option value="">Select company</option>
              {companies.map((company) => (
                <option key={company.id} value={String(company.id)}>
                  {company.company_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">New Shift Name</label>
            <Input
              className="mt-1"
              onChange={(event) => setNewShiftName(event.target.value)}
              placeholder="e.g. Morning Shift"
              value={newShiftName}
            />
          </div>
          <div>
            <label className="text-sm font-medium">New Shift Code</label>
            <Input
              className="mt-1"
              onChange={(event) => setNewShiftCodeCustom(event.target.value)}
              placeholder="e.g. SHIFT-MOR"
              value={newShiftCodeCustom}
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!form.company_id || creatingShift}
              onClick={createNewShift}
            >
              {creatingShift ? "Creating..." : "Create Shift"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Select Existing Shift ── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="mb-1 text-base font-semibold text-foreground">Select Existing Shift</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Choose a company and then pick an existing shift to view, edit, or delete it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="text-red-500 hover:bg-red-500/10 hover:text-red-600 border-red-200" disabled={!selectedShift || saving} onClick={deleteExistingShift} variant="outline" size="sm">
              <Trash2 className="h-4 w-4" />
              Delete Shift
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div>
            <label className="text-sm font-medium">Company</label>
            <select
              className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              onChange={(event) => onSelectCompany(event.target.value)}
              value={form.company_id}
            >
              <option value="">Select company</option>
              {companies.map((company) => (
                <option key={company.id} value={String(company.id)}>
                  {company.company_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Select Shift</label>
            <select
              className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              disabled={!form.company_id}
              onChange={(event) => onSelectShift(event.target.value)}
              value={form.shift_id}
            >
              <option value="">Select shift</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={String(shift.id)}>
                  {shift.shift_name || shift.name} ({shift.shift_code || ""})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Edit Shift Name</label>
            <Input
              className="mt-1"
              disabled={!form.shift_id}
              onChange={(event) => setForm((p) => ({ ...p, shift_name: event.target.value }))}
              placeholder="Shift Name"
              value={form.shift_name}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Edit Shift Code</label>
            <Input
              className="mt-1"
              disabled={!form.shift_id}
              onChange={(event) => setForm((p) => ({ ...p, shift_code: event.target.value }))}
              placeholder="Shift Code"
              value={form.shift_code}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Attendance Mode</label>
            <select
              className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              onChange={(event) => {
                const attendance_mode = event.target.value as "fixed" | "hour-based";
                setForm((prev) => ({
                  ...prev,
                  attendance_mode,
                  ...(attendance_mode === "hour-based" ? HOUR_BASED_WORKING_DEFAULTS : {}),
                }));
              }}
              value={form.attendance_mode}
            >
              <option value="fixed">Fixed</option>
              <option value="hour-based">Hour-based</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{attendanceModeHint}</p>
      </div>

      {isFixedMode ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Fixed Timing - Day Wise Schedule</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Set exact in/out time for each enabled day. Unchecked days are treated as week off.
          </p>
          <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Start Time</label>
              <Input
                className="mt-1 w-36"
                onChange={(event) => setBulkStartTime(event.target.value)}
                type="time"
                value={bulkStartTime}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">End Time</label>
              <Input
                className="mt-1 w-36"
                onChange={(event) => setBulkEndTime(event.target.value)}
                type="time"
                value={bulkEndTime}
              />
            </div>
            <Button onClick={applyTimeToAllWorkingDays} size="sm" type="button">
              Apply All
            </Button>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <Button onClick={applyWeekdayTemplate} size="sm" type="button" variant="outline">
              Apply 09:00 - 18:00 to Mon-Fri
            </Button>
            <Button onClick={setSaturdayHalfDay} size="sm" type="button" variant="outline">
              Set Saturday 11:00 - 15:00
            </Button>
            <Button onClick={clearAllDayTimes} size="sm" type="button" variant="outline">
              Clear All
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Day</th>
                  <th className="px-3 py-2 font-medium">Working day</th>
                  <th className="px-3 py-2 font-medium">Start time</th>
                  <th className="px-3 py-2 font-medium">End time</th>
                </tr>
              </thead>
              <tbody>
                {form.schedule.map((row, index) => (
                  <tr className="border-t border-border" key={row.day}>
                    <td className="px-3 py-2">{row.day}</td>
                    <td className="px-3 py-2">
                      <input
                        checked={row.enabled}
                        onChange={(event) => updateSchedule(index, "enabled", event.target.checked)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        disabled={!row.enabled}
                        onChange={(event) => updateSchedule(index, "start_time", event.target.value)}
                        type="time"
                        value={toLocalTime(row.start_time)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        disabled={!row.enabled}
                        onChange={(event) => updateSchedule(index, "end_time", event.target.value)}
                        type="time"
                        value={toLocalTime(row.end_time)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Late Rules</h3>
          <div className="mt-3 space-y-3">
            <div>
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium">Grace Minutes</label>
                <span
                  className="inline-flex"
                  title="Minutes allowed after shift start before late marking begins."
                >
                  <Info
                    aria-label="Grace minutes help"
                    className="h-3.5 w-3.5 text-muted-foreground"
                  />
                </span>
              </div>
              <Input
                className="mt-1"
                onChange={(e) => setForm((p) => ({ ...p, late_grace_minutes: Number(e.target.value || 0) }))}
                placeholder="e.g. 10"
                type="number"
                value={form.late_grace_minutes}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Minutes allowed after shift start before marking late.
              </p>
              <FieldExamples examples={GRACE_MINUTES_EXAMPLES} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium">Late After Minutes</label>
                <span
                  className="inline-flex"
                  title="Extra minutes after grace period when attendance is counted as late."
                >
                  <Info
                    aria-label="Late after minutes help"
                    className="h-3.5 w-3.5 text-muted-foreground"
                  />
                </span>
              </div>
              <Input
                className="mt-1"
                onChange={(e) => setForm((p) => ({ ...p, late_after_minutes: Number(e.target.value || 0) }))}
                placeholder="e.g. 15"
                type="number"
                value={form.late_after_minutes}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Minutes after grace period when employee is counted as late.
              </p>
              <FieldExamples examples={LATE_AFTER_MINUTES_EXAMPLES} />
            </div>
            <div>
              <label className="text-sm font-medium">Late Conversion Rule</label>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr_1fr] sm:items-end">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Number of Lates</label>
                  <Input
                    className="mt-1"
                    min={1}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        late_conversion_count: Number(e.target.value || 0),
                      }))
                    }
                    placeholder="e.g. 3"
                    step={1}
                    type="number"
                    value={form.late_conversion_count}
                  />
                </div>
                <p className="hidden pb-2 text-center text-sm font-medium text-muted-foreground sm:block">
                  late =
                </p>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Penalty Value</label>
                  <Input
                    className="mt-1"
                    min={0.1}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        late_conversion_value: Number(e.target.value || 0),
                      }))
                    }
                    placeholder="e.g. 0.5"
                    step={0.1}
                    type="number"
                    value={form.late_conversion_value}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Penalty Type</label>
                  <select
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        late_conversion_unit: e.target.value as "day" | "Penalty",
                      }))
                    }
                    value={form.late_conversion_unit}
                  >
                    <option value="day">Day</option>
                    <option value="Penalty">Penalty</option>
                  </select>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Example: 3 late = 0.5 day or 3 late = 0.5 Penalty
              </p>
              <p className="mt-1 text-xs font-medium text-primary">
                Preview: {lateConversionPreview}
              </p>
              {lateConversionError ? (
                <p className="mt-1 text-xs text-destructive">{lateConversionError}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Half Day Rules</h3>
              <p className="text-xs text-muted-foreground">
                Set how half day cutoff is evaluated.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-medium transition-colors", form.half_day_type === "time" ? "text-foreground font-semibold" : "text-muted-foreground")}>
                Time Wise
              </span>
              <Switch
                checked={form.half_day_type === "hours"}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, half_day_type: checked ? "hours" : "time" }))
                }
              />
              <span className={cn("text-xs font-medium transition-colors", form.half_day_type === "hours" ? "text-foreground font-semibold" : "text-muted-foreground")}>
                Hour Based
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {form.half_day_type === "hours" ? (
              <div>
                <label className="text-sm font-medium">Half Day Minimum Hours</label>
                <Input
                  className="mt-1"
                  onChange={(e) => setForm((p) => ({ ...p, half_day_after_hours: Number(e.target.value || 0) }))}
                  placeholder="e.g. 4"
                  step="0.5"
                  type="number"
                  value={form.half_day_after_hours}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Working hours below this threshold will count as a half day. Enter 0 for no restriction.
                </p>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Half Day Cutoff Time</label>
                <Input
                  className="mt-1"
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      half_day_at_time: toHms(e.target.value),
                    }))
                  }
                  placeholder="14:00"
                  type="time"
                  value={toLocalTime(form.half_day_at_time)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Punch-in after this time will be treated as a half day.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isFixedMode ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Working Hours Rules (Hourly Mode)</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Used only in hour-based attendance mode.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium">Min Hours for Present</label>
              <Input
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    working_min_present_hours: Number(e.target.value || 0),
                  }))
                }
                placeholder="Min present hours"
                step="0.5"
                type="number"
                value={form.working_min_present_hours}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Minimum Hours for Half Day</label>
              <Input
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    working_min_half_day_hours: Number(e.target.value || 0),
                  }))
                }
                placeholder="Min half day hours"
                step="0.5"
                type="number"
                value={form.working_min_half_day_hours}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Max Break Deduction (minutes)</label>
              <Input
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    working_max_break_deduction_minutes: Number(e.target.value || 0),
                  }))
                }
                placeholder="Max break deduction minutes"
                type="number"
                value={form.working_max_break_deduction_minutes}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button disabled={!selectedShift || saving} onClick={saveRules}>
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save All Rules"}
        </Button>
      </div>
    </section>
  );
}

export default function ShiftRulesPage() {
  return (
    <Suspense fallback={<PanelSkeleton className="min-h-[480px]" />}>
      <ShiftRulesContent />
    </Suspense>
  );
}
