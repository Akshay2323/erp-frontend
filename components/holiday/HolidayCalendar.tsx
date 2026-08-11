"use client";

import type { Holiday } from "@/lib/api/holiday";

type HolidayCalendarProps = {
  month: number;
  year: number;
  holidays: Holiday[];
  loading: boolean;
  onChangeMonth?: (month: number) => void;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HolidayCalendar({
  month,
  year,
  holidays,
  loading,
  onChangeMonth,
}: HolidayCalendarProps) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, idx) => idx - firstDay + 1);

  const holidayMap = new Map<number, Holiday[]>();
  holidays.forEach((holiday) => {
    const parts = holiday.date.split("-");
    const hYear = Number(parts[0]);
    const hMonth = Number(parts[1]);
    const hDay = Number(parts[2]);
    if (hYear !== year || hMonth !== month || Number.isNaN(hDay)) return;

    const list = holidayMap.get(hDay) ?? [];
    list.push(holiday);
    holidayMap.set(hDay, list);
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex flex-row items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">Calendar View</h3>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-xl border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
            value={month}
            onChange={(e) => onChangeMonth?.(Number(e.target.value))}
          >
            {monthNames.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <span className="rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {year}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center animate-pulse">Loading calendar...</p>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {weekLabels.map((label) => (
            <div
              className="rounded-md bg-muted/40 px-1.5 py-1.5 text-center text-[11px] font-semibold text-muted-foreground"
              key={label}
            >
              {label}
            </div>
          ))}

          {cells.map((dayValue, idx) => {
            const inMonth = dayValue > 0 && dayValue <= daysInMonth;
            const dayHolidays = inMonth ? holidayMap.get(dayValue) ?? [] : [];
            return (
              <div
                className={`min-h-16 rounded-md border p-1.5 transition-all ${
                  inMonth ? "border-border bg-background hover:bg-muted/10" : "border-transparent bg-muted/20 opacity-40"
                }`}
                key={`${dayValue}-${idx}`}
              >
                <p className="text-[11px] font-semibold text-foreground">{inMonth ? dayValue : ""}</p>
                <div className="mt-1 space-y-0.5">
                  {dayHolidays.map((holiday) => (
                    <p
                      className="rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary truncate"
                      key={holiday.id}
                      title={holiday.name}
                    >
                      {holiday.name}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
