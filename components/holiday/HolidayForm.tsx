"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Company } from "@/lib/api/company";
import type { Holiday, HolidayApiError, HolidayStatus } from "@/lib/api/holiday";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const baseSchema = z.object({
  company_id: z.number().min(1, "Company is required"),
  name: z.string().trim().min(1, "Holiday name is required"),
  date: z.string().trim().min(1, "Date is required"),
  type: z.string().trim().min(1, "Type is required"),
  is_paid: z.boolean(),
  status: z.enum(["active", "inactive"]),
});

export type HolidayFormValues = z.infer<typeof baseSchema>;

const getHolidaySchema = (mode: "create" | "edit") =>
  baseSchema.refine(
    (data) => {
      if (mode === "edit") return true;
      if (!data.date) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [y, m, d] = data.date.split("-").map(Number);
      const chosen = new Date(y, m - 1, d);
      chosen.setHours(0, 0, 0, 0);
      return chosen >= today;
    },
    {
      message: "Holiday date cannot be in the past",
      path: ["date"],
    }
  );

type HolidayFormProps = {
  mode: "create" | "edit";
  companies: Company[];
  loading: boolean;
  initialData?: Holiday | null;
  serverError?: HolidayApiError | null;
  onSubmit: (values: HolidayFormValues) => Promise<void>;
};

const inputStyles =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary";
const holidayTypeOptions = ["National", "Festival", "Special Day", "Other Holiday"] as const;

export function HolidayForm({
  mode,
  companies,
  loading,
  initialData,
  serverError,
  onSubmit,
}: HolidayFormProps) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayString = `${yyyy}-${mm}-${dd}`;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(getHolidaySchema(mode)),
    defaultValues: {
      company_id: 0,
      name: "",
      date: "",
      type: "",
      is_paid: true,
      status: "active",
    },
  });

  useEffect(() => {
    reset({
      company_id: initialData?.company_id ?? 0,
      name: initialData?.name ?? "",
      date: initialData?.date ?? "",
      type: initialData?.type ?? "",
      is_paid: initialData?.is_paid ?? true,
      status: (initialData?.status as HolidayStatus | undefined) ?? "active",
    });
  }, [initialData, reset]);

  const fieldError = (name: keyof HolidayFormValues) =>
    errors[name]?.message || serverError?.fieldErrors?.[name]?.[0];

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} suppressHydrationWarning>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Company</label>
          <select className={inputStyles} {...register("company_id", { valueAsNumber: true })}>
            <option value={0}>Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name}
              </option>
            ))}
          </select>
          {fieldError("company_id") ? (
            <p className="mt-1 text-xs text-destructive">{fieldError("company_id")}</p>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-medium">Holiday Name</label>
          <Input className={inputStyles} {...register("name")} />
          {fieldError("name") ? (
            <p className="mt-1 text-xs text-destructive">{fieldError("name")}</p>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-medium">Date</label>
          <Input
            className={inputStyles}
            type="date"
            min={mode === "create" ? todayString : undefined}
            {...register("date")}
          />
          {fieldError("date") ? (
            <p className="mt-1 text-xs text-destructive">{fieldError("date")}</p>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-medium">Type</label>
          <Input
            className={inputStyles}
            list="holiday-type-options"
            placeholder="Select or type holiday type"
            {...register("type")}
          />
          <datalist id="holiday-type-options">
            {holidayTypeOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {fieldError("type") ? (
            <p className="mt-1 text-xs text-destructive">{fieldError("type")}</p>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-medium">Status</label>
          <select className={inputStyles} {...register("status")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_paid")} />
            Is Paid Holiday
          </label>
        </div>
      </div>

      {serverError?.message ? <p className="text-sm text-destructive">{serverError.message}</p> : null}

      <div className="flex justify-end">
        <Button disabled={loading} type="submit">
          {loading
            ? "Saving..."
            : mode === "create"
              ? "Create Holiday"
              : "Update Holiday"}
        </Button>
      </div>
    </form>
  );
}
