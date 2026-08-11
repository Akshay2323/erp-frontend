"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getConfirmationStatus,
  getSalaryConfirmationStoreVersion,
  listConfirmationLogs,
  subscribeSalaryConfirmations,
  type SalaryConfirmationLog,
  type SalaryConfirmationStatus,
} from "@/lib/payroll/salary-confirmation-store";

/**
 * Reactive confirmation status for one employee/period.
 * Re-renders when local store changes (same tab or other tabs).
 */
export function useSalaryConfirmationStatus(
  employeeId: number | null | undefined,
  month: number,
  year: number,
): SalaryConfirmationStatus {
  const id = employeeId && Number.isFinite(employeeId) ? employeeId : 0;
  const version = useSalaryConfirmationVersion();
  return useMemo(() => {
    void version;
    return id > 0 ? getConfirmationStatus(id, month, year) : "not_sent";
  }, [id, month, year, version]);
}

export function useSalaryConfirmationLogs(month: number, year: number): SalaryConfirmationLog[] {
  const version = useSalaryConfirmationVersion();
  return useMemo(() => {
    void version;
    return listConfirmationLogs({ month, year });
  }, [month, year, version]);
}

/** Stable numeric version — safe for useSyncExternalStore (primitive equality). */
export function useSalaryConfirmationVersion(): number {
  return useSyncExternalStore(
    subscribeSalaryConfirmations,
    getSalaryConfirmationStoreVersion,
    () => 0,
  );
}
