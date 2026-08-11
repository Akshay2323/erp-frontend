"use client";

import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import Cookies from "js-cookie";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  defaultShiftSchedule,
  getShifts,
  type CreateShiftPayload,
  type Shift,
  type ShiftApiError,
  type UpdateShiftPayload,
} from "@/lib/api/shift";
import type { Company } from "@/lib/api/company";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type ShiftFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  loading: boolean;
  initialData?: Shift | null;
  companies: Company[];
  defaultCompanyId?: string;
  serverError?: ShiftApiError | null;
  onClose: () => void;
  onSubmit: (payload: CreateShiftPayload | UpdateShiftPayload) => Promise<void>;
};

const schema = z.object({
  shift_name: z.string().trim().min(1, "Shift name is required"),
  shift_code: z.string().trim().min(1, "Shift code is required"),
  attendance_mode: z.enum(["fixed", "flexible", "hour-based"]),
  status: z.enum(["active", "inactive"]),
  company_id: z.string().trim().min(1, "Company is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  late_grace_minutes: z.number().min(0),
  late_after_minutes: z.number().min(0),
  late_conversion: z.string().trim().min(1, "Late conversion is required"),
  half_day_at_time: z.string().min(1, "Half day at time is required"),
  half_day_after_hours: z.number().min(0),
  overtime_type: z.string().trim().min(1, "Overtime type is required"),
  overtime_min_hours: z.number().min(0),
  week_off_1: z.string().trim().min(1, "Week off day 1 is required"),
  week_off_2: z.string().trim().min(1, "Week off day 2 is required"),
  geo_require_location: z.boolean(),
  geo_allow_outside_radius: z.string().trim().min(1, "Geo rule is required"),
  absent_no_punch_mark_absent: z.boolean(),
  absent_missed_punch_handling: z
    .string()
    .trim()
    .min(1, "Missed punch handling is required"),
  working_min_present_hours: z.number().min(0),
  working_min_half_day_hours: z.number().min(0),
  working_max_break_deduction_minutes: z.number().min(0),
});

type FormValues = z.infer<typeof schema>;

const inputStyles =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary";

const toHms = (time: string) => (time.length === 5 ? `${time}:00` : time);
const readObj = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
const toNum = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const toBool = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;
const toStr = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

export function ShiftFormModal({
  open,
  mode,
  loading,
  initialData,
  companies,
  defaultCompanyId,
  serverError,
  onClose,
  onSubmit,
}: ShiftFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    control,
    setFocus,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      shift_name: "",
      shift_code: "",
      attendance_mode: "fixed",
      status: "active",
      company_id: "",
      start_time: "09:00",
      end_time: "18:00",
      late_grace_minutes: 10,
      late_after_minutes: 15,
      late_conversion: "3 late = 0.5 day",
      half_day_at_time: "14:00",
      half_day_after_hours: 4,
      overtime_type: "After Shift End",
      overtime_min_hours: 9,
      week_off_1: "Sun",
      week_off_2: "Sat",
      geo_require_location: true,
      geo_allow_outside_radius: "No",
      absent_no_punch_mark_absent: true,
      absent_missed_punch_handling: "Notify Manager",
      working_min_present_hours: 8,
      working_min_half_day_hours: 4,
      working_max_break_deduction_minutes: 60,
    },
  });

  const authToken = Cookies.get("auth_token") ?? "";
  const watchedCompanyId = useWatch({ control, name: "company_id" });
  const watchedShiftCode = useWatch({ control, name: "shift_code" });
  const shiftCodesQuery = useQuery({
    queryKey: ["shift-code-options", authToken, watchedCompanyId],
    queryFn: () =>
      getShifts(authToken, {
        page: 1,
        per_page: 100,
        company_id: watchedCompanyId,
      }),
    enabled: Boolean(open && authToken && watchedCompanyId),
  });

  const availableShifts: Shift[] = (() => {
    const raw = shiftCodesQuery.data?.data;
    let items: Shift[] = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (
      raw &&
      typeof raw === "object" &&
      "items" in raw &&
      Array.isArray((raw as { items: Shift[] }).items)
    ) {
      items = (raw as { items: Shift[] }).items;
    }
    return items;
  })();

  const shiftCodes = Array.from(
    new Set(
      availableShifts
        .map((s) => s.shift_code)
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    )
  );
  if (initialData?.shift_code && !shiftCodes.includes(initialData.shift_code)) {
    shiftCodes.unshift(initialData.shift_code);
  }

  useEffect(() => {
    if (!watchedShiftCode) return;
    const shift = availableShifts.find((s) => s.shift_code === watchedShiftCode);
    if (shift && shift.shift_name) {
      setValue("shift_name", shift.shift_name || shift.name || "", { shouldValidate: true });
    }
  }, [watchedShiftCode, availableShifts, setValue]);

  useEffect(() => {
    if (!open) return;
    const lateRules = readObj(initialData?.late_rules);
    const halfDayRules = readObj(initialData?.half_day_rules);
    const overtimeRules = readObj(initialData?.overtime_rules);
    const geoRules = readObj(initialData?.geo_location_rules);
    const absentRules = readObj(initialData?.auto_absent_rules);
    const workingRules = readObj(initialData?.working_hours_rules);
    const weekOffRules = Array.isArray(initialData?.week_off_rules)
      ? initialData.week_off_rules
      : ["Sun", "Sat"];
    reset({
      shift_name: initialData?.shift_name ?? "",
      shift_code: initialData?.shift_code ?? "",
      attendance_mode: (initialData?.attendance_mode as FormValues["attendance_mode"]) ?? "fixed",
      status: initialData?.status === "inactive" ? "inactive" : "active",
      company_id: String(initialData?.company_id ?? defaultCompanyId ?? ""),
      start_time: (initialData?.start_time ?? "09:00:00").slice(0, 5),
      end_time: (initialData?.end_time ?? "18:00:00").slice(0, 5),
      late_grace_minutes: toNum(lateRules.grace_minutes, 10),
      late_after_minutes: toNum(lateRules.late_after_minutes, 15),
      late_conversion: toStr(lateRules.late_conversion, "3 late = 0.5 day"),
      half_day_at_time: toStr(halfDayRules.half_day_at_time, "14:00:00").slice(0, 5),
      half_day_after_hours: toNum(halfDayRules.half_day_after_hours, 4),
      overtime_type: toStr(overtimeRules.type, "After Shift End"),
      overtime_min_hours: toNum(overtimeRules.min_hours, 9),
      week_off_1: weekOffRules[0] ?? "Sun",
      week_off_2: weekOffRules[1] ?? "Sat",
      geo_require_location: toBool(geoRules.require_location, true),
      geo_allow_outside_radius: toStr(geoRules.allow_outside_radius, "No"),
      absent_no_punch_mark_absent: toBool(absentRules.no_punch_mark_absent, true),
      absent_missed_punch_handling: toStr(
        absentRules.missed_punch_handling,
        "Notify Manager",
      ),
      working_min_present_hours: toNum(workingRules.min_present_hours, 8),
      working_min_half_day_hours: toNum(workingRules.min_half_day_hours, 4),
      working_max_break_deduction_minutes: toNum(
        workingRules.max_break_deduction_minutes,
        60,
      ),
    });
    window.setTimeout(() => setFocus("shift_name"), 0);
  }, [open, initialData, defaultCompanyId, reset, setFocus]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const fieldError = (name: keyof FormValues) =>
    errors[name]?.message || serverError?.fieldErrors?.[name]?.[0];

  const submit = async (values: FormValues) => {
    const start = toHms(values.start_time);
    const end = toHms(values.end_time);
    const payload: CreateShiftPayload = {
      company_id: Number(values.company_id),
      shift_name: values.shift_name,
      shift_code: values.shift_code,
      attendance_mode: values.attendance_mode,
      status: values.status,
      schedule: defaultShiftSchedule(start, end),
      late_rules: {
        grace_minutes: values.late_grace_minutes,
        late_after_minutes: values.late_after_minutes,
        late_conversion: values.late_conversion,
      },
      half_day_rules: {
        half_day_at_time: toHms(values.half_day_at_time),
        half_day_after_hours: values.half_day_after_hours,
      },
      overtime_rules: {
        type: values.overtime_type,
        min_hours: values.overtime_min_hours,
      },
      week_off_rules: [values.week_off_1, values.week_off_2],
      geo_location_rules: {
        require_location: values.geo_require_location,
        allow_outside_radius: values.geo_allow_outside_radius,
      },
      auto_absent_rules: {
        no_punch_mark_absent: values.absent_no_punch_mark_absent,
        missed_punch_handling: values.absent_missed_punch_handling,
      },
      working_hours_rules: {
        min_present_hours: values.working_min_present_hours,
        min_half_day_hours: values.working_min_half_day_hours,
        max_break_deduction_minutes: values.working_max_break_deduction_minutes,
      },
    };
    await onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div
        aria-modal="true"
        className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card shadow-xl"
        ref={modalRef}
        role="dialog"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Create shift" : "Update shift"}
          </h2>
          <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form className="space-y-5 p-6" onSubmit={handleSubmit(submit)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium" htmlFor="shift_code">
                Shift code
              </label>
              <select className={inputStyles} id="shift_code" {...register("shift_code")}>
                <option value="">Select shift code</option>
                {shiftCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              {fieldError("shift_code") ? (
                <p className="mt-1 text-xs text-destructive">{fieldError("shift_code")}</p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="shift_name">
                Shift name
              </label>
              <Input
                className={`${inputStyles} bg-muted opacity-70 cursor-not-allowed`}
                id="shift_name"
                readOnly
                {...register("shift_name")}
              />
              {fieldError("shift_name") ? (
                <p className="mt-1 text-xs text-destructive">{fieldError("shift_name")}</p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="attendance_mode">
                Attendance mode
              </label>
              <select className={inputStyles} id="attendance_mode" {...register("attendance_mode")}>
                <option value="fixed">Fixed</option>
                <option value="flexible">Flexible</option>
                <option value="hour-based">Hour-based</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="status">
                Status
              </label>
              <select className={inputStyles} id="status" {...register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="company_id">
                Company
              </label>
              <select className={inputStyles} id="company_id" {...register("company_id")}>
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={String(company.id)}>
                    {company.company_name}
                  </option>
                ))}
              </select>
              {fieldError("company_id") ? (
                <p className="mt-1 text-xs text-destructive">{fieldError("company_id")}</p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="start_time">
                Start (Mon–Fri)
              </label>
              <Input className={inputStyles} id="start_time" type="time" {...register("start_time")} />
              {fieldError("start_time") ? (
                <p className="mt-1 text-xs text-destructive">{fieldError("start_time")}</p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="end_time">
                End (Mon–Fri)
              </label>
              <Input className={inputStyles} id="end_time" type="time" {...register("end_time")} />
              {fieldError("end_time") ? (
                <p className="mt-1 text-xs text-destructive">{fieldError("end_time")}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Late grace minutes</label>
              <Input
                className={inputStyles}
                type="number"
                {...register("late_grace_minutes", { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Late after minutes</label>
              <Input
                className={inputStyles}
                type="number"
                {...register("late_after_minutes", { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Late conversion</label>
              <Input className={inputStyles} {...register("late_conversion")} />
            </div>

            <div>
              <label className="text-sm font-medium">Half day at time</label>
              <Input className={inputStyles} type="time" {...register("half_day_at_time")} />
            </div>
            <div>
              <label className="text-sm font-medium">Half day after hours</label>
              <Input
                className={inputStyles}
                type="number"
                {...register("half_day_after_hours", { valueAsNumber: true })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Overtime type</label>
              <Input className={inputStyles} {...register("overtime_type")} />
            </div>
            <div>
              <label className="text-sm font-medium">Overtime min hours</label>
              <Input
                className={inputStyles}
                type="number"
                {...register("overtime_min_hours", { valueAsNumber: true })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Week off 1</label>
              <Input className={inputStyles} {...register("week_off_1")} />
            </div>
            <div>
              <label className="text-sm font-medium">Week off 2</label>
              <Input className={inputStyles} {...register("week_off_2")} />
            </div>

            <div>
              <label className="text-sm font-medium">Allow outside radius</label>
              <Input className={inputStyles} {...register("geo_allow_outside_radius")} />
            </div>
            <div>
              <label className="text-sm font-medium">Missed punch handling</label>
              <Input className={inputStyles} {...register("absent_missed_punch_handling")} />
            </div>

            <div>
              <label className="text-sm font-medium">Min present hours</label>
              <Input
                className={inputStyles}
                type="number"
                {...register("working_min_present_hours", { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Min half day hours</label>
              <Input
                className={inputStyles}
                type="number"
                {...register("working_min_half_day_hours", { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Max break deduction minutes</label>
              <Input
                className={inputStyles}
                type="number"
                {...register("working_max_break_deduction_minutes", {
                  valueAsNumber: true,
                })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <input type="checkbox" {...register("geo_require_location")} />
              Require location
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <input type="checkbox" {...register("absent_no_punch_mark_absent")} />
              No punch mark absent
            </label>
          </div>

          {serverError?.message ? (
            <p className="text-sm text-destructive">{serverError.message}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={loading} type="submit">
              {loading ? "Saving..." : mode === "create" ? "Create shift" : "Update shift"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
