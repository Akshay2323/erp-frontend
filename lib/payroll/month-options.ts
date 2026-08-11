export type PayrollMonthOption = {
  value: number;
  label: string;
};

export function getPayrollMonthOptions(): PayrollMonthOption[] {
  return Array.from({ length: 12 }, (_, index) => {
    const value = index + 1;
    const label = new Date(2000, index, 1).toLocaleString("en-US", { month: "long" });

    return { value, label };
  });
}

export function resolvePayrollMonthOptions(
  months: Array<{ value: number; label: string }> | undefined,
): PayrollMonthOption[] {
  if (Array.isArray(months) && months.length > 0) {
    return months.map((month) => ({
      value: Number(month.value),
      label: String(month.label),
    }));
  }

  return getPayrollMonthOptions();
}
