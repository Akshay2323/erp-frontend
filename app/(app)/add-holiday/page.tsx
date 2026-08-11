"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BulkUploadSection } from "@/components/holiday/BulkUploadSection";
import { HolidayForm, type HolidayFormValues } from "@/components/holiday/HolidayForm";
import { Button } from "@/components/ui/button";
import { getCompanies, type Company } from "@/lib/api/company";
import {
  bulkImportHolidays,
  createHoliday,
  type HolidayApiError,
  type HolidayStatus,
} from "@/lib/api/holiday";
import { useAuthToken } from "@/lib/use-auth-token";

export default function AddHolidayPage() {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"manual" | "bulk">("manual");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [serverError, setServerError] = useState<HolidayApiError | null>(null);

  const companiesQuery = useQuery({
    queryKey: ["companies-options", token],
    queryFn: () => getCompanies(token, 1, 100),
    enabled: Boolean(token),
  });

  const companies: Company[] = companiesQuery.data?.data ?? [];

  const submitManual = async (values: HolidayFormValues) => {
    if (!token) return;
    setManualSubmitting(true);
    setServerError(null);
    try {
      await createHoliday(token, values.company_id, {
        name: values.name,
        date: values.date,
        type: values.type,
        branch_id: "",
        is_paid: values.is_paid ?? true,
        status: values.status,
      });
      toast.success("Holiday created successfully.");
      await queryClient.invalidateQueries({ queryKey: ["holidays"] });
    } catch (error) {
      const err = (error as HolidayApiError) ?? { message: "Unable to create holiday." };
      setServerError(err);
      toast.error(err.message || "Unable to create holiday.");
    } finally {
      setManualSubmitting(false);
    }
  };

  const submitBulk = async (
    file: File,
    isPaid: boolean,
    status: HolidayStatus,
    companyId: number | "all",
  ) => {
    if (!token) throw new Error("Missing auth token");
    setBulkSubmitting(true);
    try {
      if (companyId === "all") {
        if (!companies.length) throw new Error("No companies available to import for all.");

        let imported_count = 0;
        let holiday_ids: number[] = [];
        let row_errors: string[] = [];

        for (const c of companies) {
          const resp = await bulkImportHolidays(token, file, isPaid, status, c.id);
          imported_count += resp.data.imported_count;
          holiday_ids = holiday_ids.concat(resp.data.holiday_ids);

          const errors = resp.data.row_errors;
          for (const e of errors as any[]) {
            if (typeof e === "string") row_errors.push(e);
            else if (e && typeof e === "object" && "row" in e && "message" in e) {
              row_errors.push(`Row ${(e as any).row}: ${(e as any).message}`);
            } else {
              row_errors.push(String(e));
            }
          }
        }

        const aggregated = {
          success: true,
          message: `Successfully imported ${imported_count} holidays.`,
          data: { imported_count, holiday_ids, row_errors },
          meta: {},
        };
        toast.success(aggregated.message);
        await queryClient.invalidateQueries({ queryKey: ["holidays"] });
        return aggregated;
      }

      const response = await bulkImportHolidays(token, file, isPaid, status, companyId);
      toast.success(response.message || "Bulk upload completed.");
      await queryClient.invalidateQueries({ queryKey: ["holidays"] });
      return response;
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <section className="space-y-5" suppressHydrationWarning>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <CalendarPlus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Add Holiday</h1>
            <p className="text-sm text-muted-foreground">
              Add holidays manually or upload by CSV. Branch is always sent as empty.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            onClick={() => setActiveTab("manual")}
            variant={activeTab === "manual" ? "default" : "outline"}
          >
            Manual Add
          </Button>
          <Button
            onClick={() => setActiveTab("bulk")}
            variant={activeTab === "bulk" ? "default" : "outline"}
          >
            Bulk Upload
          </Button>
        </div>

        {activeTab === "manual" ? (
          <>
            <h2 className="text-lg font-semibold">Manual Entry</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fill the details to create a single holiday record.
            </p>
            <div className="mt-4">
              <HolidayForm
                companies={companies}
                loading={
                  manualSubmitting ||
                  companiesQuery.isLoading ||
                  companiesQuery.isFetching
                }
                mode="create"
                onSubmit={submitManual}
                serverError={serverError}
              />
            </div>
          </>
        ) : (
          <BulkUploadSection
            loading={bulkSubmitting}
            companies={companies}
            onSubmit={submitBulk}
          />
        )}
      </div>
    </section>
  );
}
