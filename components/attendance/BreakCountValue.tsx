import { cn } from "@/lib/utils";
import { formatBreakMinutes } from "@/lib/api/attendance";

type BreakCountValueProps = {
  breakCount?: number | null;
  totalBreakMinutes?: number | null;
  className?: string;
  /** When true, count and duration render on one line. */
  inline?: boolean;
};

export function BreakCountValue({
  breakCount,
  totalBreakMinutes,
  className,
  inline = false,
}: BreakCountValueProps) {
  const count = Number(breakCount ?? 0);
  const minutes = Number(totalBreakMinutes ?? 0);

  if (count <= 0 && minutes <= 0) {
    return <span className={cn("text-muted-foreground tabular-nums", className)}>0</span>;
  }

  if (inline) {
    return (
      <span className={cn("tabular-nums", className)}>
        {count > 0 ? (
          <span className="font-medium text-cyan-700 dark:text-cyan-300">{count}</span>
        ) : null}
        {minutes > 0 ? (
          <span
            className={cn(
              count > 0 ? "ml-1.5 text-xs font-normal text-muted-foreground" : "font-medium text-foreground",
            )}
          >
            {formatBreakMinutes(minutes)}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex flex-col gap-0.5 tabular-nums", className)}>
      {count > 0 ? (
        <span className="font-medium text-cyan-700 dark:text-cyan-300">{count}</span>
      ) : null}
      {minutes > 0 ? (
        <span className="text-xs text-muted-foreground">{formatBreakMinutes(minutes)}</span>
      ) : null}
    </span>
  );
}
